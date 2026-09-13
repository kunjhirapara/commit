"use client";

import { useSession } from "next-auth/react";

/**
 * Local replacements for Clerk's `SignedIn` and `SignedOut`.
 *
 * Deliberately named after the components they replace so each call site
 * changes by import line only. A rename here would turn a mechanical edit into
 * one opportunity per file to get it wrong, for no benefit — these names are
 * good names regardless of who invented them.
 *
 * Both require a `SessionProvider` above them, which ConvexAuthProvider
 * supplies. Until the layout swap they will throw, which is the correct
 * behaviour: it is far better than silently rendering as signed-out.
 */

/**
 * There are three session states, not two, and conflating the third with
 * "signed out" is the bug worth avoiding here.
 *
 * While the session is resolving, neither component renders. Rendering
 * `SignedOut` children during loading flashes a sign-in prompt at someone who
 * is signed in; rendering `SignedIn` children during loading flashes
 * authenticated content at someone who is not. Both are visible on every hard
 * refresh, and the second one leaks.
 */
export function SignedIn({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  return status === "authenticated" ? <>{children}</> : null;
}

export function SignedOut({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  return status === "unauthenticated" ? <>{children}</> : null;
}

/**
 * Renders only while the session is still resolving.
 *
 * Clerk had no equivalent, which is why the app currently has no way to say
 * "we do not know yet" and several places treat it as signed out. Exported so a
 * skeleton can fill the gap the two components above deliberately leave.
 */
export function SessionLoading({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  return status === "loading" ? <>{children}</> : null;
}
