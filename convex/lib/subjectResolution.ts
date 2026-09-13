/**
 * Finding the signed-in user from `identity.subject`, while two auth providers
 * are registered at once.
 *
 * Kept import-free and in convex/lib for the same reason as ./retention.ts and
 * ./owner.ts: a test can then import it without pulling in the Convex server
 * runtime. That matters more here than usual, because getting this wrong does
 * not throw — it silently reports that a signed-in user has no account, and
 * tells them to sign out and try again, which does not help.
 *
 * During the Clerk migration `subject` means one of two different things, since
 * convex/auth.config.ts registers both providers and either can have minted the
 * token on any given request:
 *
 *   - Auth.js — the Convex document id of the user.
 *   - Clerk   — the Clerk user id, stored in `users.clerkId`.
 *
 * Three cases have to resolve, and only the first two are obvious:
 *
 *   1. A user Auth.js created. convex/authAdapter.ts sets their `clerkId` to
 *      their own document id, so either lookup finds them.
 *   2. A legacy user presenting a Clerk token, before the backfill. Subject is
 *      the Clerk id, so `by_clerk_id` finds them and the id lookup cannot.
 *   3. A legacy user presenting an Auth.js token — the case that appears the
 *      moment anyone migrates, and the reason this is not simply the old query.
 *      Subject is their document id while `clerkId` is still `user_2...`, so
 *      only the id lookup finds them.
 *   4. A Clerk subject that is only present as `legacyClerkId`.
 *
 * Case 4 is defence rather than a live requirement, and the distinction is
 * worth stating plainly because an earlier version of this comment got it
 * wrong. The backfill (Task 14) copies `clerkId` into `legacyClerkId` and
 * `streamUserId`; it does *not* rewrite `clerkId`, precisely because
 * `interviewerIds`, `candidateId` and `auditLogs.actorClerkId` all reference
 * that value across the database. So after the backfill, case 2 still resolves
 * through `by_clerk_id` on its own.
 *
 * The third lookup earns its place at the other end of the migration: Task 16
 * makes `clerkId` optional and then drops it, at which point `legacyClerkId` is
 * the only remaining record of a Clerk id. It costs one indexed read on a path
 * that has already missed twice, and it means the order of those two steps
 * cannot strand anyone.
 *
 * Both fallbacks are removed with the `clerkId` column in the final task of the
 * migration.
 */

/**
 * The slice of a Convex ctx this needs, narrow enough for a test to supply.
 *
 * Generic over the user row so the Convex call sites keep inferring whatever
 * they inferred before — authz.ts passes `ctx: any` and reads `user.role` off
 * the result, which a hardcoded `unknown` here would break at every call site.
 */
export type SubjectResolutionCtx<TUser> = {
  db: {
    /** Returns null for a string that is not an id for the table. */
    normalizeId: (table: "users", id: string) => string | null;
    get: (id: string) => Promise<TUser | null>;
    query: (table: "users") => {
      withIndex: (
        index: "by_clerk_id" | "by_legacy_clerk_id",
        builder: (q: {
          eq: (field: "clerkId" | "legacyClerkId", value: string) => unknown;
        }) => unknown,
      ) => { first: () => Promise<TUser | null> };
    };
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
  // An empty subject would otherwise reach the index and match any row whose
  // clerkId was somehow empty. Nothing should produce one, which is exactly why
  // it must not resolve to a user if something does.
  if (!subject) return null;

  /**
   * `normalizeId` is what makes trying the id first safe: it returns null for a
   * string that is not an id for this table, where `db.get` would throw. A
   * Clerk subject simply falls through to the index below.
   */
  const documentId = ctx.db.normalizeId("users", subject);

  if (documentId) {
    const user = await ctx.db.get(documentId);
    // A well-formed id for a row that no longer exists still falls through: a
    // deleted-and-recreated account should be found by its clerkId rather than
    // reported as missing.
    if (user) return user;
  }

  const byClerkId = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: { eq: (field: "clerkId", value: string) => unknown }) =>
      q.eq("clerkId", subject),
    )
    .first();

  if (byClerkId) return byClerkId;

  // Case 4: a Clerk token after the backfill has moved the Clerk id here.
  return await ctx.db
    .query("users")
    .withIndex(
      "by_legacy_clerk_id",
      (q: { eq: (field: "legacyClerkId", value: string) => unknown }) =>
        q.eq("legacyClerkId", subject),
    )
    .first();
};
