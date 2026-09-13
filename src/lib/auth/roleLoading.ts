export type RoleStateInput = {
  /** The session has resolved to either authenticated or unauthenticated. */
  isSessionLoaded: boolean;
  /** That resolution produced a signed-in user. */
  hasUser: boolean;
  isConvexAuthLoading: boolean;
  /** The current-user query was actually started. */
  isQueryingCurrentUser: boolean;
  /** That query has returned. */
  hasUserData: boolean;
};

/**
 * Whether the caller's role is still unknown.
 *
 * Extracted from useUserRole and given its own tests because getting it wrong is
 * not a cosmetic flicker: RoleGuard treats "settled with no role" as a denial
 * and redirects. Any moment this reports "settled" while the role is genuinely
 * unknown becomes a redirect the user never asked for.
 *
 * That is precisely the bug this replaces. The previous form was
 *
 *   const isLoading = !!user && (convexLoading || waitingForSync || ...)
 *
 * so on a page refresh — when the auth client had not yet initialised and
 * reported `user: undefined` — the leading `!!user` made the whole expression
 * false. The role was unknown, the state claimed to be settled, and every
 * guarded page bounced to home before auth had said anything at all.
 *
 * The fix is to distinguish "there is no user" from "we have not been told
 * yet". Only the first is a settled signed-out state.
 *
 * The sync wait this used to carry is gone with Clerk. Clerk created the
 * account on its side and a webhook copied it into Convex afterwards, leaving a
 * window where a signed-in user had no row; the Auth.js adapter creates the row
 * before the session exists, so there is no window to wait out.
 */
export const isRoleStateLoading = ({
  isSessionLoaded,
  hasUser,
  isConvexAuthLoading,
  isQueryingCurrentUser,
  hasUserData,
}: RoleStateInput): boolean => {
  // Nothing is known until the session has resolved, regardless of the rest.
  if (!isSessionLoaded) return true;

  // The session resolved and there is no user: settled, signed out. Middleware
  // redirects these to sign-in before a guard sees them, but the predicate must
  // terminate rather than spin.
  if (!hasUser) return false;

  if (isConvexAuthLoading) return true;

  // Only wait on the query if it was actually started; otherwise a skipped
  // query would hang the UI on a spinner forever.
  return isQueryingCurrentUser && !hasUserData;
};
