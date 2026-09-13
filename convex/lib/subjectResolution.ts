/**
 * Finding the signed-in user from `identity.subject`.
 *
 * Kept import-free and in convex/lib for the same reason as ./retention.ts and
 * ./owner.ts: a test can then import it without pulling in the Convex server
 * runtime. That matters more here than usual, because getting this wrong does
 * not throw — it silently reports that a signed-in user has no account, and
 * tells them to sign out and try again, which does not help.
 *
 * `subject` is now always the Convex document id of the user. Auth.js is the
 * only provider registered in convex/auth.config.ts, and it takes the subject
 * from the id the adapter returned, so there is exactly one thing it can be.
 *
 * This used to try three lookups. While Clerk was also registered, a token
 * could arrive carrying a Clerk user id instead, and resolving it meant falling
 * back to `by_clerk_id` and then `by_legacy_clerk_id`. Both fallbacks went with
 * Clerk: no token in existence carries a Clerk id any more, so those reads
 * could only ever miss.
 *
 * `users.clerkId` still exists and is still populated — it is the id that
 * `interviewerIds`, `candidateId` and `auditLogs.actorClerkId` reference
 * throughout the database. It is no longer an *authentication* identifier, and
 * nothing here should read it again.
 */

/** The slice of a Convex ctx this needs, narrow enough for a test to supply. */
export type SubjectResolutionCtx<TUser> = {
  db: {
    /** Returns null for a string that is not an id for the table. */
    normalizeId: (table: "users", id: string) => string | null;
    get: (id: string) => Promise<TUser | null>;
  };
};

/**
 * `ctx` is `any` rather than `SubjectResolutionCtx` on purpose.
 *
 * Convex's real ctx is generic over the whole data model and its `db.get` takes
 * more arguments than the minimal shape above, so a structural parameter type
 * rejects the genuine article at every call site while accepting the fake. The
 * type above stays exported as the documented contract and as what a test types
 * its fake against; this signature is what the Convex call sites can actually
 * pass, and matches how the rest of convex/lib/authz.ts is written.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const resolveUserBySubject = async <TUser = any>(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ctx: any,
  subject: string,
): Promise<TUser | null> => {
  if (!subject) return null;

  /**
   * `normalizeId` rather than passing the string straight to `db.get`, which
   * throws on anything that is not a well-formed id for this table. A malformed
   * subject should resolve to "no such user" rather than to a 500 — the caller
   * turns the former into a sign-in prompt and the latter into an error page.
   */
  const documentId = ctx.db.normalizeId("users", subject);

  if (!documentId) return null;

  return await ctx.db.get(documentId);
};
