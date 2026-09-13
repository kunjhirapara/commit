import { randomBytes } from "node:crypto";

import { NextRequest, NextResponse } from "next/server";
import { fetchMutation, fetchQuery } from "convex/nextjs";

import { api } from "../../../../../../convex/_generated/api";
import { hashVerificationToken } from "@/lib/auth/convexAdapter";
import { passwordResetTemplate } from "@/lib/email/templates";
import { sendEmail } from "@/lib/email";
import { absoluteUrl } from "@/lib/siteUrl";
import {
  consumeRateLimit,
  getRateLimitHeaders,
  getRateLimitKey,
} from "@/lib/rateLimit";

/**
 * Step one of a password reset: prove control of the inbox.
 *
 * This is also the only way an account that has only ever used Google or GitHub
 * can gain a password. /api/auth/register deliberately refuses to write a
 * credential for an address that already has an account, because doing so would
 * be account takeover; this route can, because reaching step two requires
 * reading the mailbox.
 *
 * Answers identically whether or not the address has an account. A reset form
 * that says "no account with that email" is a membership oracle, and unlike the
 * sign-in form it can be queried without even guessing a password.
 */

export const runtime = "nodejs";

/** Tighter than registration: this one sends mail, so abuse costs reputation. */
const RATE_LIMIT = { limit: 3, windowMs: 60_000 } as const;

/** Short, because the link is a password-change capability sitting in an inbox. */
const TOKEN_TTL_MINUTES = 30;

const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(request: NextRequest) {
  const rateLimit = consumeRateLimit({
    key: getRateLimitKey("auth.reset.request", request),
    ...RATE_LIMIT,
  });

  if (!rateLimit.allowed) {
    return NextResponse.json(
      { ok: false, error: "Too many attempts. Please wait and try again." },
      { status: 429, headers: getRateLimitHeaders(rateLimit) },
    );
  }

  // Every path below this point returns exactly this.
  const generic = NextResponse.json(
    { ok: true },
    { status: 200, headers: getRateLimitHeaders(rateLimit) },
  );

  let body: { email?: unknown };

  try {
    body = await request.json();
  } catch {
    return generic;
  }

  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!LOOKS_LIKE_EMAIL.test(email)) return generic;

  const secret = process.env.AUTH_ADAPTER_SECRET?.trim();

  if (!secret) {
    console.error("[auth] AUTH_ADAPTER_SECRET is not set; password reset cannot proceed");
    return generic;
  }

  try {
    const user = await fetchQuery(api.authAdapter.getUserByEmail, { secret, email });

    // No account. Nothing is sent, and the caller cannot tell.
    if (!user) return generic;

    // 32 bytes of randomness. Only its hash is stored, so a database snapshot
    // contains no working reset links — the same reasoning as the magic-link
    // tokens, and the reason hashVerificationToken is shared with them.
    const token = randomBytes(32).toString("hex");
    const expires = Date.now() + TOKEN_TTL_MINUTES * 60_000;

    await fetchMutation(api.authAdapter.createVerificationToken, {
      secret,
      identifier: email,
      tokenHash: hashVerificationToken(token),
      expires,
    });

    const url = absoluteUrl(
      `/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`,
    );

    const template = passwordResetTemplate({ url, expiresInMinutes: TOKEN_TTL_MINUTES });

    const result = await sendEmail({
      to: email,
      subject: template.subject,
      html: template.html,
    });

    if (!result.success) {
      // Logged, not surfaced. Telling the caller the send failed would confirm
      // the account exists, which is the one thing this route must not do.
      console.error("[auth] could not send a password reset email", result.error);
    }
  } catch (error) {
    console.error("[auth] password reset request failed", error);
  }

  return generic;
}
