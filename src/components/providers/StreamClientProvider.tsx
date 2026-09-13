"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";

import { useCurrentUser } from "@/hooks/useCurrentUser";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveStreamUserId } from "@/lib/auth/streamIdentity";

// Deliberately not a static import: this is the whole point of the split. The
// Stream SDK chunk is fetched only once a route that actually needs video
// mounts, instead of sitting in every signed-in route's bundle graph.
const StreamVideoRuntime = dynamic(() => import("./StreamVideoRuntime"), {
  ssr: false,
});

const streamRequiredForPath = (pathname: string | null) =>
  !!pathname &&
  (pathname.startsWith("/meeting") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/recordings"));

const StreamClientProvider = ({ children }: { children: ReactNode }) => {
  const { user, isLoaded } = useCurrentUser();
  const pathname = usePathname();
  const {
    canScheduleInterviews,
    canViewRecordings,
    isInterviewer,
    isLoading: isRoleLoading,
  } = useUserRole();

  const homeCanStartMeeting =
    pathname === "/" &&
    !isRoleLoading &&
    (isInterviewer || canScheduleInterviews || canViewRecordings);
  const shouldInitializeClient =
    isLoaded &&
    !!user &&
    (streamRequiredForPath(pathname) || homeCanStartMeeting);

  /**
   * The id Stream knows them by, which is no longer the id the session carries.
   *
   * Stream keys calls and recordings by the user_id it was given, and that has
   * always been the Clerk id. Initialising the client with the Convex document
   * id instead would connect a user Stream has never seen -- their own past
   * calls would simply not be there.
   *
   * Null means we cannot identify them to Stream at all, which is a reason not
   * to start the client rather than a reason to invent an id: an invented one
   * silently creates a second Stream identity for the same person.
   */
  const streamUserId = resolveStreamUserId(user);

  if (!shouldInitializeClient || !user || !streamUserId) return <>{children}</>;

  return (
    <StreamVideoRuntime
      user={{
        id: streamUserId,
        name: user.name || user.email || streamUserId,
        image: user.image ?? undefined,
      }}>
      {children}
    </StreamVideoRuntime>
  );
};

export default StreamClientProvider;
