/**
 * Owner identification.
 *
 * `admin` is a flat peer group, not the top of a hierarchy: any admin can grant
 * admin to anyone (users.inviteUser, users.updateUserRole) and demote any other
 * admin, the only guards being "not yourself" and "not the last one". So the
 * moment a second admin exists, that account can remove the person who created
 * the deployment. On a public signup that is the wrong shape for anything the
 * operator alone should control.
 *
 * The fix is deliberately NOT a sixth role. A role lives in `users.role`, which
 * is a row that admins can already reach — so "admin escalates to super admin"
 * stays one forgotten guard away forever. Ownership instead lives in an
 * environment variable on the Convex deployment, which the application can read
 * but has no way to write. Changing who owns the deployment requires the Convex
 * dashboard or CLI, i.e. credentials the app never holds.
 *
 * That also removes the bootstrap problem. Previously the first admin had to be
 * created by hand-editing the database, because signups are always `candidate`
 * and roles are granted only by an existing admin.
 *
 * Set it on the deployment, not just in .env.local:
 *
 *   npx convex env set OWNER_EMAILS you@example.com
 *   npx convex env set OWNER_EMAILS "you@example.com, cofounder@example.com"
 *
 * Deliberately dependency-free so it can be unit tested from src/ without
 * pulling in the Convex runtime.
 */

export const OWNER_EMAILS_ENV_VAR = "OWNER_EMAILS";

/**
 * Accepts comma, semicolon, whitespace or newline separated addresses so that a
 * value pasted from a config file or a shell quote both behave.
 */
export const parseOwnerEmails = (raw: string | undefined | null): string[] => {
  if (!raw) return [];

  const seen = new Set<string>();

  for (const candidate of raw.split(/[,;\s]+/)) {
    const normalized = candidate.trim().toLowerCase();

    // Require an "@" so a stray token can never match a real address, and in
    // particular so a misconfigured empty-ish value cannot make everyone owner.
    if (!normalized || !normalized.includes("@")) continue;

    seen.add(normalized);
  }

  return Array.from(seen);
};

export const getOwnerEmails = (): string[] =>
  parseOwnerEmails(process.env[OWNER_EMAILS_ENV_VAR]);

/**
 * Returns false when no owner is configured. Failing closed matters here: an
 * unset variable must not mean "everyone is owner", and it must not mean
 * "nobody can be checked" either — callers treat false as "not the owner".
 */
export const isOwnerEmail = (
  email: string | undefined | null,
  ownerEmails: string[] = getOwnerEmails(),
): boolean => {
  if (!email || ownerEmails.length === 0) return false;

  return ownerEmails.includes(email.trim().toLowerCase());
};

export const isOwnerConfigured = (): boolean => getOwnerEmails().length > 0;
