/**
 * Whether this deployment can actually sign anyone in.
 *
 * Written for a specific hazard in the Clerk migration. The image that switches
 * sign-in to Auth.js can reach the VM before anyone configures it, and the
 * failure mode is total: the app boots, serves pages, reports healthy, and
 * nobody can log in. `/api/health` would have said "healthy" throughout,
 * because it only ever checked the Clerk-era variables.
 *
 * The first version of this file checked that five variables were non-empty and
 * called that ready. It then reported `auth: true` on a deployment where every
 * Auth.js route was returning 500, which is worse than not having checked at
 * all — a green light that is wrong teaches people to stop looking at it. The
 * two faults it missed are both encoded below, and both were real.
 *
 * Names and diagnoses only, never values. The caller logs these server-side and
 * publishes a boolean, because /api/health is public — it is polled by the
 * container healthcheck, which carries no session. A public endpoint listing
 * exactly what a deployment is missing is a map for anyone probing it.
 */

export type AuthReadiness = {
  ready: boolean;
  /** Short diagnoses, in the order an operator should work through them. */
  problems: string[];
};

/**
 * The five that auth cannot function without.
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

/** OAuth providers, as `AUTH_<ID>_ID` / `AUTH_<ID>_SECRET` pairs. */
const OAUTH_PROVIDERS = ["GOOGLE", "GITHUB"] as const;

const present = (value: string | undefined) => Boolean(value?.trim());

/**
 * Mirrors `config.trustHost ??= !!(AUTH_URL ?? AUTH_TRUST_HOST ?? VERCEL ?? CF_PAGES ?? NODE_ENV !== "production")`
 * from @auth/core.
 *
 * When this is false, `assertConfig` returns UntrustedHost and every Auth.js
 * route answers 500 — rendered to the user as "There was a problem with the
 * server configuration", which reads like a missing secret.
 *
 * The subtlety worth reproducing exactly is `??`. It falls through only on
 * null/undefined, so an AUTH_URL set to the empty string stops the chain at the
 * first term and yields false. An empty variable is therefore strictly worse
 * than an absent one, which is not a thing anyone guesses while debugging.
 */
const willTrustHost = (env: Record<string, string | undefined>): boolean => {
  const first = [env.AUTH_URL, env.AUTH_TRUST_HOST, env.VERCEL, env.CF_PAGES].find(
    (value) => value !== undefined && value !== null,
  );

  if (first !== undefined) return Boolean(first);

  return env.NODE_ENV !== "production";
};

export const getAuthReadiness = (
  env: Record<string, string | undefined>,
): AuthReadiness => {
  const problems: string[] = [];

  for (const name of REQUIRED) {
    // Trimmed, because a variable set to whitespace is the same as unset for
    // every one of these and is an easy thing to paste by accident.
    if (!present(env[name])) problems.push(`${name} is not set`);
  }

  if (!willTrustHost(env)) {
    problems.push(
      env.AUTH_URL === ""
        ? "AUTH_URL is set but empty, so Auth.js will reject every request as an untrusted host"
        : "AUTH_URL is not set, so Auth.js will reject every request as an untrusted host",
    );
  }

  /**
   * A half-configured provider is fatal, not degraded.
   *
   * The earlier version of this file deliberately ignored the OAuth credentials,
   * reasoning that a deployment with no Google app still supports credentials
   * and magic-link sign-in. True — but only when the provider is absent
   * entirely. An id without its secret makes Auth.js throw while building the
   * provider list, which takes down every sign-in method including the ones
   * that need no provider at all.
   */
  for (const provider of OAUTH_PROVIDERS) {
    const id = present(env[`AUTH_${provider}_ID`]);
    const secret = present(env[`AUTH_${provider}_SECRET`]);

    if (id !== secret) {
      problems.push(
        `AUTH_${provider}_${id ? "SECRET" : "ID"} is missing while its pair is set; a half-configured provider breaks all sign-in`,
      );
    }
  }

  return { ready: problems.length === 0, problems };
};
