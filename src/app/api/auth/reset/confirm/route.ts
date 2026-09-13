import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "../../../../../../convex/_generated/api";
import { hashVerificationToken } from "@/lib/auth/convexAdapter";
import { hashPassword } from "@/lib/auth/password";
import { MIN_PASSWORD_LENGTH } from "@/lib/auth/passwordPolicy";
import {
  consumeRateLimit,
  getRateLimitHeaders,
  getRateLimitKey,
} from "@/lib/rateLimit";

/**
 * Step two of a password reset: redeem the token and write the new credential.
 *
 * Unlike the request step, this one tells the truth about failure. Once someone
 * holds a token there is nothing left to enumerate — they already proved the
 * address exists by reading its inbox — and "that link has expired" is the
 * difference between a user retrying and a user giving up.
 *
 * The token is redeemed by `useVerificationToken`, which deletes the row before
 * checking expiry and before returning. That ordering is what makes a reset
 * link single-use even against two concurrent requests.
 */

export const runtime = "nodejs";

/** Guessing a 32-byte token is hopeless; this is for the rest of the endpoint. */
const RATE_LIMIT = { limit: 10, windowMs: 60_000 } as const;

const INVALID_TOKEN =
  "That reset link is invalid or has expired. Request a new one.";

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit({
    key: getRateLimitKey("auth.reset.confirm", request),
    ...RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  let body: { email?: unknown; token?: unknown; password?: unknown };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid request." }, { status: 400 });
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  const token = typeof body.token === "string" ? body.token.trim() : "";
  const password = typeof body.password === "string" ? body.password : "";

  if (!email || !token) {
    return NextResponse.json({ ok: false, error: INVALID_TOKEN }, { status: 400 });
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      { ok: false, error: `Use at least ${MIN_PASSWORD_LENGTH} characters.` },
      { status: 400 },
    );
  }

  const secret = process.env.AUTH_ADAPTER_SECRET?.trim();

  if (!secret) {
    console.error("[auth] AUTH_ADAPTER_SECRET is not set; password reset cannot proceed");
    return NextResponse.json(
      { ok: false, error: "Password reset is unavailable." },
      { status: 503 },
    );
  }

  try {
    /**
     * Hash the password before redeeming the token, not after.
     *
     * The token is consumed destructively — redeeming it deletes the row. If
     * hashing then threw, the user would be left holding a spent link and no
     * new password, with nothing to do but request another. Doing the work that
     * can fail first means a failure leaves the link still usable.
     */
    const passwordHash = await hashPassword(password);

    const redeemed = (await fetchMutation(api.authAdapter.useVerificationToken, {
      secret,
      identifier: email,
      tokenHash: hashVerificationToken(token),
    })) as { identifier: string; expires: number } | null;

    if (!redeemed) {
      return NextResponse.json({ ok: false, error: INVALID_TOKEN }, { status: 400 });
    }

    /**
     * Resolved from the redeemed identifier rather than from the request body,
     * so a token issued for one address cannot set a password on another.
     *
     * A lookup rather than `createUser`. That mutation is idempotent by email
     * and would therefore *create* an account for an address whose account had
     * been deleted between requesting the reset and using it — resurrecting a
     * deleted user from a stale link in an inbox.
     */
    const user = (await fetchQuery(api.authAdapter.getUserByEmail, {
      secret,
      email: redeemed.identifier,
    })) as { id: string } | null;

    if (!user?.id) {
      return NextResponse.json({ ok: false, error: INVALID_TOKEN }, { status: 400 });
    }

    await fetchMutation(api.authAdapter.setCredential, {
      secret,
      userId: user.id,
      passwordHash,
    });

    return NextResponse.json(
      { ok: true },
      { status: 200, headers: getRateLimitHeaders(rateLimit) },
    );
  } catch (error) {
    console.error("[auth] password reset confirmation failed", error);
    return NextResponse.json(
      { ok: false, error: "Password reset is unavailable." },
      { status: 503 },
    );
  }
}
