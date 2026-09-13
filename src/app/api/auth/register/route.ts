import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "../../../../../convex/_generated/api";
import { hashPassword, MIN_PASSWORD_LENGTH } from "@/lib/auth/password";
import {
  consumeRateLimit,
  getRateLimitHeaders,
  getRateLimitKey,
} from "@/lib/rateLimit";

/**
 * Password registration.
 *
 * Auth.js has no sign-up: its Credentials provider only ever authorizes an
 * existing credential, so creating one is ours to do.
 *
 * THE THING TO NOT GET WRONG
 * --------------------------
 * convex/authAdapter.ts `createUser` is idempotent by email — it returns the
 * existing row rather than creating a second one, which is right for OAuth and
 * a trapdoor here. Calling `setCredential` on whatever it returns would let
 * anyone register with an address that already has an account and thereby set a
 * password on it. That is account takeover with no exploit required: type a
 * victim's email into a signup form, choose a password, sign in as them.
 *
 * So a credential is only ever written for an address that has no account at
 * all. An existing user — whether they signed up with a password or only ever
 * used Google — cannot gain one through this route. The way to add a password
 * to an existing account is the reset flow, which proves control of the inbox
 * first.
 *
 * WHY THE RESPONSE SAYS NOTHING
 * -----------------------------
 * Every outcome returns the same 200 and the same body. "That email is taken"
 * is a membership oracle, and a signup form is the easiest place in any app to
 * query one in bulk. The client follows a success by attempting a normal
 * sign-in, which succeeds if the account was just created and fails with the
 * form's generic credential error otherwise — so a legitimate user is one click
 * from the truth and an enumerator learns nothing.
 */

export const runtime = "nodejs";

/** Generous enough for a typo or two, tight enough that bulk probing is useless. */
const RATE_LIMIT = { limit: 5, windowMs: 60_000 } as const;

const MAX_NAME_LENGTH = 80;

/** Not RFC 5322. Enough to reject a value that is obviously not an address. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ok = (headers?: Record<string, string>) =>
  NextResponse.json({ ok: true }, { status: 200, headers });

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit({
    key: getRateLimitKey("auth.register", request),
    ...RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  let body: { email?: unknown; name?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  const password = typeof body.password === "string" ? body.password : "";

  // These two are told the truth, because neither reveals anything about who
  // else has an account: the submitter already knows what they typed.
  if (!LOOKS_LIKE_EMAIL.test(email)) {
    return NextResponse.json(
      { ok: false, error: "Enter a valid email address." },
      { status: 400 },
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        ok: false,
        error: `Use at least ${MIN_PASSWORD_LENGTH} characters.`,
      },
      { status: 400 },
    );
  }

  const secret = process.env.AUTH_ADAPTER_SECRET?.trim();

  if (!secret) {
    console.error("[auth] AUTH_ADAPTER_SECRET is not set; registration cannot proceed");
    return NextResponse.json(
      { ok: false, error: "Registration is unavailable." },
      { status: 503 },
    );
  }

  try {
    const existing = await fetchQuery(api.authAdapter.getUserByEmail, { secret, email });

    if (existing) {
      // Deliberately indistinguishable from success, and deliberately not a
      // credential write. See the header comment.
      return ok(getRateLimitHeaders(rateLimit));
    }

    // hashPassword re-checks MIN_PASSWORD_LENGTH and throws below it, so the
    // check above is the message rather than the enforcement.
    const passwordHash = await hashPassword(password);

    const created = (await fetchMutation(api.authAdapter.createUser, {
      secret,
      email,
      name: name || email.split("@")[0],
    })) as { id: string } | null;

    if (!created?.id) {
      return NextResponse.json(
        { ok: false, error: "Registration is unavailable." },
        { status: 503 },
      );
    }

    await fetchMutation(api.authAdapter.setCredential, {
      secret,
      userId: created.id,
      passwordHash,
    });

    return ok(getRateLimitHeaders(rateLimit));
  } catch (error) {
    console.error("[auth] registration failed", error);
    return NextResponse.json(
      { ok: false, error: "Registration is unavailable." },
      { status: 503 },
    );
  }
}
