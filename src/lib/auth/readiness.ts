/**
 * Whether this deployment can actually sign anyone in.
 *
 * Written for a specific hazard in the Clerk migration. The image that switches
 * sign-in to Auth.js can reach the VM before anyone sets the Auth.js
 * environment variables, and the failure mode is total: the app boots, serves
 * pages, reports healthy, and nobody can log in. `/api/health` would have said
 * "healthy" throughout, because it only ever checked the Clerk-era variables.
 *
 * So this is a pre-flight, not a diagnostic after the fact. Check it against a
 * deployment *before* letting the new image roll out to it.
 *
 * Names only, never values. The caller logs the missing names server-side and
 * publishes a boolean, because /api/health is public — it is polled by the
 * container healthcheck, which carries no session. A public endpoint listing
 * exactly which secrets a deployment is missing is a map for anyone probing it.
 */

export type AuthReadiness = {
  ready: boolean;
  /** Variable names, in the order an operator should set them. Never values. */
  missing: string[];
};

/**
 * The five that auth cannot function without.
 *
 * Deliberately not the OAuth client IDs. Credentials and magic-link sign-in work
 * without them — a deployment with no Google app is degraded, not broken, and
 * conflating the two would make this flag fire for something a user can work
 * around. These five have no workaround:
 *
 *   AUTH_SECRET            signs and encrypts the session cookie
 *   AUTH_ADAPTER_SECRET    every adapter call to Convex is rejected without it
 *   AUTH_JWT_PRIVATE_KEY   mints the token Convex verifies
 *   AUTH_JWT_PUBLIC_KEY    served at /.well-known/jwks.json for that verification
 *   AUTH_JWT_KID           names the key in both halves; a mismatch rejects every token
 */
const REQUIRED = [
  "AUTH_SECRET",
  "AUTH_ADAPTER_SECRET",
  "AUTH_JWT_PRIVATE_KEY",
  "AUTH_JWT_PUBLIC_KEY",
  "AUTH_JWT_KID",
] as const;

export const getAuthReadiness = (
  env: Record<string, string | undefined>,
): AuthReadiness => {
  // Trimmed, because an environment variable set to whitespace is the same as
  // unset for every one of these and is an easy thing to paste by accident.
  const missing = REQUIRED.filter((name) => !env[name]?.trim());

  return { ready: missing.length === 0, missing: [...missing] };
};
