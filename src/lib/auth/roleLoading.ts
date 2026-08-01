export type RoleStateInput = {
  /** Clerk has finished its own initialisation. */
  isClerkLoaded: boolean;
  /** Clerk resolved and produced a signed-in user. */
  hasUser: boolean;
  isConvexAuthLoading: boolean;
  /** The Clerk→Convex user record sync is still running. */
  isWaitingForSync: boolean;
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
 * so on a page refresh — when Clerk has not yet initialised and reports
 * `user: undefined` — the leading `!!user` made the whole expression false. The
 * role was unknown, the state claimed to be settled, and every guarded page
 * bounced to home before Clerk had said anything at all.
 *
 * The fix is to distinguish "Clerk says there is no user" from "Clerk has not
 * spoken yet". Only the first is a settled signed-out state.
 */
export const isRoleStateLoading = ({
  isClerkLoaded,
  hasUser,
  isConvexAuthLoading,
  isWaitingForSync,
  isQueryingCurrentUser,
  hasUserData,
}: RoleStateInput): boolean => {
  // Nothing is known until Clerk has initialised, regardless of the rest.
  if (!isClerkLoaded) return true;

  // Clerk has spoken and there is no user: settled, signed out. Middleware
  // redirects these to sign-in before a guard sees them, but the predicate must
  // terminate rather than spin.
  if (!hasUser) return false;

  if (isConvexAuthLoading) return true;
  if (isWaitingForSync) return true;

  // Only wait on the query if it was actually started; otherwise a skipped
  // query would hang the UI on a spinner forever.
  return isQueryingCurrentUser && !hasUserData;
};
