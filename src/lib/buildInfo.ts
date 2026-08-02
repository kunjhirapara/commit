/**
 * The commit an image was built from, as a short SHA.
 *
 * This exists so a deploy can be verified from outside the VM. CI passes the
 * full SHA as a `BUILD_SHA` build-arg, and the Deploy workflow polls
 * /api/health after publishing to check that the running container reports the
 * commit it just built. Without it, nothing distinguishes a deploy that reached
 * users from an image still sitting in the registry — which is exactly how a
 * merged fix stayed invisible in production while CI showed green.
 *
 * Truncated rather than full: twelve hex characters are unambiguous for this
 * comparison, and there is no reason to publish more of a private repository's
 * history than the check needs.
 */

export const UNKNOWN_BUILD_VERSION = "unknown";

const SHORT_SHA_LENGTH = 12;

/** Git object names are hex; anything else is a misconfigured build arg. */
const SHA_PATTERN = /^[0-9a-f]{7,40}$/i;

export const getBuildVersion = (
  sha: string | undefined = process.env.BUILD_SHA,
): string => {
  if (!sha) return UNKNOWN_BUILD_VERSION;

  const trimmed = sha.trim();
  if (!SHA_PATTERN.test(trimmed)) return UNKNOWN_BUILD_VERSION;

  // Lowercased so the workflow can compare without worrying about the case CI
  // happens to hand it.
  return trimmed.slice(0, SHORT_SHA_LENGTH).toLowerCase();
};
