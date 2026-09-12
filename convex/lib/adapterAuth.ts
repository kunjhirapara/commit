/**
 * The guard in front of the Auth.js adapter's Convex functions.
 *
 * Those functions create users and link OAuth identities, so they are as
 * security-critical as anything in the codebase, and they have a public
 * endpoint. They have one because the alternative is worse: internal functions
 * cannot be called from outside Convex without a deploy key, and a deploy key
 * in the Next server's runtime would mean a compromised web server implies a
 * compromised deployment — it can deploy code, read and write every table, and
 * rewrite environment variables. A narrow shared secret in front of narrow
 * mutations is the smaller blast radius. Established by experiment; see the
 * Task 6 spike in docs/superpowers/plans/2026-09-12-custom-auth.md.
 *
 * The secret is its own value rather than a reuse of INTERNAL_API_KEY, which
 * guards Convex calling into Next. One credential spanning both directions
 * means a leak in either compromises both.
 */

/**
 * Constant-time string comparison.
 *
 * Hand-rolled rather than `crypto.timingSafeEqual` because Convex functions run
 * in a V8 isolate rather than Node, so the node:crypto surface is not something
 * to rely on here. Comparing with `===` would leak the secret a character at a
 * time to an attacker who can measure response times.
 */
const constantTimeEqual = (a: string, b: string): boolean => {
  // Folding the lengths in means a length mismatch cannot short-circuit the
  // loop, and the loop always runs over the longer of the two.
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);

  for (let i = 0; i < length; i += 1) {
    // charCodeAt past the end is NaN, which `|| 0` turns into a value that
    // still participates in the comparison rather than ending it.
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }

  return diff === 0;
};

/**
 * Whether a presented secret matches the configured one.
 *
 * Fails closed on an unconfigured secret. An unset environment variable meaning
 * "allow everything" is the single most likely way this becomes an open door,
 * so an empty or missing `configured` rejects every input including an empty one.
 */
export const isValidAdapterSecret = (
  configured: string | undefined | null,
  presented: string | undefined | null,
): boolean => {
  if (!configured) return false;
  if (!presented) return false;

  return constantTimeEqual(configured, presented);
};

/**
 * Handler-side guard. Throws rather than returning, so a function that forgets
 * to check the result still cannot proceed unauthenticated.
 */
export const assertAdapterSecret = (presented: string | undefined | null): void => {
  if (!isValidAdapterSecret(process.env.AUTH_ADAPTER_SECRET, presented)) {
    // Deliberately uninformative: the caller is our own server, and anything
    // more descriptive only helps someone probing the endpoint.
    throw new Error("Unauthorized");
  }
};
