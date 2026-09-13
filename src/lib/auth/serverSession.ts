import { fetchQuery } from "convex/nextjs";

import { api } from "../../../convex/_generated/api";
import { auth } from "@/auth";
import { mintConvexToken } from "@/lib/auth/convexToken";
import { siteUrl } from "@/lib/siteUrl";

/**
 * Server-side session and Convex token.
 *
 * Replaces Clerk's `const { userId, getToken } = await auth()` followed by
 * `getToken({ template: "convex" })`, which appeared in five server files. Auth.js
 * has no equivalent of a token template, so the token is minted here with the
 * same key and issuer the /api/auth/convex-token route uses — one implementation
 * rather than five, because a divergence in issuer or expiry would show up as
 * Convex rejecting tokens from one route and not the others.
 *
 * Node-only: it reaches src/auth.ts and jose's PKCS8 import.
 */

/**
 * The Convex document id of the signed-in user, or null.
 *
 * Note that this is *not* the id Stream knows anyone by. Under Clerk they were
 * the same value; they are not any more. Anything calling Stream must read
 * `streamUserId` from the Convex user record — see src/hooks/useCurrentUser.ts.
 */
export const getCurrentUserId = async (): Promise<string | null> => {
  const session = await auth();
  return session?.user?.id ?? null;
};

/**
 * Mints a Convex token for the signed-in user.
 *
 * Returns null when nobody is signed in, and also when signing is not
 * configured — the caller cannot do anything useful in either case, and the
 * configuration failure is logged here rather than surfaced to a user who
 * cannot act on it.
 */
export const mintConvexTokenForCurrentUser = async (): Promise<string | null> => {
  const userId = await getCurrentUserId();

  if (!userId) return null;

  return mintConvexTokenForUser(userId);
};

/**
 * The minting half on its own, for callers that already resolved the user.
 *
 * Escaped newlines, for the same reason as the JWKS route: a PEM cannot survive
 * a one-line .env otherwise.
 */
export const mintConvexTokenForUser = async (
  userId: string,
): Promise<string | null> => {
  const privateKeyPem = process.env.AUTH_JWT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const kid = process.env.AUTH_JWT_KID;

  if (!privateKeyPem || !kid) {
    console.error(
      "[auth] AUTH_JWT_PRIVATE_KEY or AUTH_JWT_KID is not set; cannot mint a Convex token",
    );
    return null;
  }

  try {
    return await mintConvexToken({
      userId,
      privateKeyPem,
      kid,
      // Must equal SITE_URL on the Convex deployment exactly; see the token
      // route for what a mismatch looks like from the outside.
      issuer: siteUrl,
    });
  } catch (error) {
    console.error("[auth] could not mint a Convex token", error);
    return null;
  }
};

/**
 * The signed-in user's Convex record, server-side.
 *
 * Replaces Clerk's `currentUser()`. It returns the same row every server check
 * is decided from, rather than a provider's idea of a profile — which matters
 * beyond tidiness, because the record carries `streamUserId` and `role` and the
 * session does not.
 */
export const getCurrentConvexUser = async () => {
  const token = await mintConvexTokenForCurrentUser();

  if (!token) return null;

  try {
    return await fetchQuery(
      api.users.getCurrentUser,
      {},
      { token, url: process.env.NEXT_PUBLIC_CONVEX_URL },
    );
  } catch (error) {
    console.error("[auth] could not load the current user from Convex", error);
    return null;
  }
};
