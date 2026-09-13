/**
 * Which GitHub address to sign someone in with, and whether GitHub has verified it.
 *
 * This exists because the stock Auth.js GitHub provider does not answer the
 * second question, and `mayLinkToExistingUser` cannot do its job without a
 * truthful answer. Two gaps in the default:
 *
 *   1. It calls /user/emails only when the profile has no public email, so for
 *      anyone with a public email the verification state is never fetched.
 *   2. When it does call it, it picks `emails.find(e => e.primary)` and discards
 *      the `verified` flag entirely.
 *
 * The linking rule treats "verified" as permission to attach a new OAuth
 * identity to an existing account. An unverified address flowing through as
 * though it were verified is therefore account takeover: anyone who can add a
 * victim's address to their own GitHub account inherits the victim's Commit
 * account and its role.
 *
 * Kept in its own module rather than inline in src/auth.config.ts for the same
 * reason src/lib/auth/linking.ts is: a security decision buried in a config
 * literal is one nobody re-reads, and one nobody tests.
 */

export type GitHubEmail = {
  email: string;
  primary: boolean;
  verified: boolean;
};

export type PickedGitHubEmail = {
  email: string;
  verified: boolean;
};

/**
 * Fails closed. No verified address — because the scope was missing, the call
 * was rate-limited, or the account genuinely has none — yields `verified:
 * false`, which costs a user the convenience of linking and costs an attacker
 * the account.
 *
 * `currentEmail` is whatever /user already reported. It is preferred when it is
 * among the verified addresses so that linking does not silently change which
 * address a returning user is known by.
 */
export const pickVerifiedGitHubEmail = (
  emails: GitHubEmail[],
  currentEmail: string | null | undefined,
): PickedGitHubEmail => {
  const usable = Array.isArray(emails) ? emails : [];
  const verified = usable.filter(
    (entry) => entry && entry.verified === true && typeof entry.email === "string" && entry.email,
  );

  if (verified.length === 0) {
    return { email: currentEmail ?? "", verified: false };
  }

  const normalized = currentEmail?.trim().toLowerCase();

  const match =
    (normalized
      ? verified.find((entry) => entry.email.trim().toLowerCase() === normalized)
      : undefined) ??
    verified.find((entry) => entry.primary === true) ??
    verified[0];

  return { email: match.email, verified: true };
};
