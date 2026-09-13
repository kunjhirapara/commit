import { NextResponse } from "next/server";

import { auth } from "@/auth";
import { CONVEX_TOKEN_TTL_SECONDS, mintConvexToken } from "@/lib/auth/convexToken";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Mints the short-lived JWT the Convex client presents on every call.
 *
 * This is the whole seam between Auth.js and Convex. Auth.js owns the session
 * cookie; Convex has never heard of it and verifies a signed token against the
 * JWKS at /.well-known/jwks.json instead. This route is what turns one into the
 * other.
 */

// jose's PKCS8 import is not available on the Edge runtime.
export const runtime = "nodejs";

const noStore = { "cache-control": "no-store" } as const;

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;

  if (!userId) {
    // 401 rather than a redirect. The caller is fetch() from the Convex client,
    // and a 307 to /signin arrives there as opaque HTML that fails to parse as
    // a token -- which surfaces as a confusing client error instead of the
    // "not signed in" the client already knows how to handle.
    return NextResponse.json(
      { error: "Unauthenticated" },
      { status: 401, headers: noStore },
    );
  }

  // Escaped newlines, for the same reason as the JWKS route: a PEM cannot
  // survive a one-line .env otherwise.
  const privateKeyPem = process.env.AUTH_JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const kid = process.env.AUTH_JWT_KID;

  if (!privateKeyPem || !kid) {
    // 503, matching the JWKS route: missing configuration is not a failure, and
    // the distinction is what tells an operator to go set the variable rather
    // than read a stack trace.
    return NextResponse.json(
      { error: "Convex token signing is not configured" },
      { status: 503, headers: noStore },
    );
  }

  try {
    const token = await mintConvexToken({
      userId,
      privateKeyPem,
      kid,
      /**
       * Must equal SITE_URL on the Convex deployment, exactly.
       *
       * convex/auth.config.ts registers our provider with `issuer: SITE_URL`
       * and Convex compares that against the token's `iss` claim as a string.
       * A mismatch -- a trailing slash, http against https, the apex against
       * www -- rejects every token, and the symptom is "you must be signed in"
       * for users who are. `siteUrl` is normalised, which removes the trailing
       * slash half of that trap; the rest is an operator making the two values
       * agree.
       */
      issuer: siteUrl,
    });

    return NextResponse.json(
      { token, expiresInSeconds: CONVEX_TOKEN_TTL_SECONDS },
      { headers: noStore },
    );
  } catch (error) {
    // A malformed key reaches here. Say nothing useful to the caller and keep
    // the detail in the server log: the caller is our own client, and anything
    // descriptive only helps someone probing the endpoint.
    console.error("[auth] could not mint a Convex token", error);

    return NextResponse.json(
      { error: "Could not mint a token" },
      { status: 500, headers: noStore },
    );
  }
}
