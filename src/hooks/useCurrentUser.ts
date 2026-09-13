"use client";

import { useConvexAuth, useQuery } from "convex/react";
import { useSession } from "next-auth/react";

import { api } from "../../convex/_generated/api";

/**
 * The signed-in user, from Auth.js for the session and Convex for the record.
 *
 * Replaces Clerk's `useUser()`, and deliberately does not reproduce its shape.
 * Clerk's user object is a Clerk-shaped thing — `primaryEmailAddress.emailAddress`,
 * `fullName`, `imageUrl` — and carrying that forward would keep every call site
 * reading a provider's data model long after the provider is gone. The Convex
 * row is the authoritative record anyway: it is what permissions, roles and
 * every server check are decided from.
 *
 * The important difference is `user.id`.
 *
 * Under Clerk it was the Clerk id, and several things were keyed on it that
 * outlive Clerk — Stream keys call and recording history by the user_id it was
 * given. Under Auth.js the session subject is the Convex document id instead,
 * so a call site that reads "the current user's id" and passes it to Stream is
 * now asking a different question than it used to. Anything talking to Stream
 * must read `streamUserId` off the record, which the schema carries precisely
 * so migrating identity does not cost every migrated user their own
 * recordings.
 *
 * No sync gating, unlike the Clerk path. Clerk created the account on its side
 * and a webhook or `useSyncUser` copied it into Convex afterwards, so there was
 * a window where a signed-in user had no row and every query had to wait it
 * out. Auth.js creates the row through the adapter before the session exists,
 * so the window is gone.
 */
export const useCurrentUser = () => {
  const { data: session, status } = useSession();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();

  const isSignedIn = status === "authenticated";

  // Convex has to have accepted the minted token before the query will resolve
  // as anything but null. Skipping until then avoids a query that is certain to
  // come back empty and then immediately re-run.
  const canQuery = isSignedIn && isAuthenticated;
  const user = useQuery(api.users.getCurrentUser, canQuery ? {} : "skip");

  /**
   * "Loaded" means we can answer the question, not that there is a user.
   *
   * Three things have to settle: the Auth.js session, the Convex auth
   * handshake, and — only when we are actually going to run it — the query.
   * Reporting loaded early is what makes a refresh briefly look like a denial.
   */
  const isLoaded =
    status !== "loading" &&
    !isConvexAuthLoading &&
    (!canQuery || user !== undefined);

  return {
    /** The Convex user record, or null. Undefined is never returned. */
    user: user ?? null,
    /**
     * The session subject: the Convex document id of the user.
     *
     * Available before the record query resolves, so it is the right thing to
     * key a render on. It is *not* the Stream user id — see above.
     */
    userId: session?.user?.id ?? null,
    isSignedIn,
    isLoaded,
  };
};
