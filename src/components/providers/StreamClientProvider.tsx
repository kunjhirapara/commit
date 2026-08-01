"use client";

import { ReactNode } from "react";
import dynamic from "next/dynamic";
import { useUser } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import { useUserRole } from "@/hooks/useUserRole";

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
  const { user, isLoaded } = useUser();
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

  if (!shouldInitializeClient || !user) return <>{children}</>;

  return (
    <StreamVideoRuntime
      user={{
        id: user.id,
        name:
          [user.firstName, user.lastName].filter(Boolean).join(" ") ||
          user.fullName ||
          user.id,
        image: user.imageUrl,
      }}>
      {children}
    </StreamVideoRuntime>
  );
};

export default StreamClientProvider;
