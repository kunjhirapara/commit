/**
 * Which id Stream knows a user by.
 *
 * Stream keys calls and recordings by the `user_id` it was handed when the call
 * was created, and it has been handed the Clerk id for the life of this app.
 * That id is not going anywhere just because our sessions stopped coming from
 * Clerk — Stream's copy of history is immutable from our side.
 *
 * So this is the line that decides whether a migrated user can still open their
 * own past recordings. Passing the new Convex document id instead would mint a
 * token for a user Stream has never seen: no error, no missing-permission
 * message, just an empty list where their interviews used to be.
 *
 * The order is the whole point:
 *
 *   1. `streamUserId` — written by the backfill, which copies the Clerk id here
 *      before `clerkId` is repurposed. Once set, it is the authority.
 *   2. `clerkId` — correct both before the backfill (where it still holds the
 *      Clerk id) and for accounts Auth.js created (where authAdapter sets it to
 *      the user's own document id, and Stream has no prior history to lose).
 *
 * There is deliberately no fallback to `_id` past those two. `clerkId` is
 * required by the schema and is never empty, so a third branch would be
 * unreachable code pretending to be a safety net.
 */

export type StreamIdentityUser = {
  streamUserId?: string | null;
  clerkId?: string | null;
};

export const resolveStreamUserId = (
  user: StreamIdentityUser | null | undefined,
): string | null => {
  const explicit = user?.streamUserId?.trim();
  if (explicit) return explicit;

  const legacy = user?.clerkId?.trim();
  if (legacy) return legacy;

  // Nothing usable. The caller must treat this as "cannot join video" rather
  // than inventing an id, because an invented one silently creates a second
  // Stream identity for the same person.
  return null;
};
