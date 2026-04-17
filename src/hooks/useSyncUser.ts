"use client";

import { useUser } from "@clerk/nextjs";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { logError } from "@/lib/errors";

/**
 * Hook to sync the currently signed-in Clerk user to Convex.
 * Call this in a top-level component so it runs on every auth state change.
 */
export function useSyncUser() {
  const { user, isSignedIn } = useUser();
  const syncUser = useMutation(api.users.syncUser);

  useEffect(() => {
    if (!isSignedIn || !user) return;

    const sync = async () => {
      try {
        await syncUser({
          clerkId: user.id,
          email: user.primaryEmailAddress?.emailAddress ?? "",
          name: user.fullName ?? user.firstName ?? "",
          image: user.imageUrl ?? undefined,
        });
      } catch (error) {
        logError("useSyncUser", error, { userId: user.id });
      }
    };

    sync();
  }, [isSignedIn, user, syncUser]);
}
