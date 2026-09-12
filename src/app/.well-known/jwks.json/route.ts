import { NextResponse } from "next/server";

import { publicJwkFromPem } from "@/lib/auth/convexToken";

/**
 * The public half of the Convex token seam.
 *
 * Convex fetches this unauthenticated to verify the JWTs we mint. It must stay
 * listed in PUBLIC_ROUTES: if middleware sends it to /signin, every Convex call
 * fails with an authorization error that looks like a bug in permissions rather
 * than a blocked well-known route.
 */

// jose's PEM import is not available on the Edge runtime.
export const runtime = "nodejs";

export async function GET() {
  // Env values carry escaped newlines because a PEM cannot survive a one-line
  // .env otherwise.
  const pem = process.env.AUTH_JWT_PUBLIC_KEY?.replace(/\\n/g, "\n");
  const kid = process.env.AUTH_JWT_KID;

  if (!pem || !kid) {
    // 503 rather than 500: this is a missing configuration, not a failure, and
    // the distinction is what tells an operator to go set the variable.
    return NextResponse.json(
      { error: "JWKS not configured" },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }

  const jwk = await publicJwkFromPem(pem, kid);

  return NextResponse.json(
    { keys: [jwk] },
    // Convex caches this. An hour keeps key rotation quick without being fetched
    // on every verification.
    { headers: { "cache-control": "public, max-age=3600" } },
  );
}
