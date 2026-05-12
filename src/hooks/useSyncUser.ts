"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect } from "react";
import { toast } from "sonner";
import { logError, sanitizeErrorMessage } from "@/lib/errors";

const DUPLICATE_ACCOUNT_PREFIX = "An account with this email already exists";

/**
 * Hook to sync the currently signed-in Clerk user to Convex.
 * Call this in a top-level component so it runs on every auth state change.
 */
export function useSyncUser() {
  const { user, isSignedIn } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useClerk();
  const syncUser = useMutation(api.users.syncUser);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !isSignedIn || !user) return;

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

        const message = sanitizeErrorMessage(error, "");
        if (message.startsWith(DUPLICATE_ACCOUNT_PREFIX)) {
          toast.error(message);
          await signOut({ redirectUrl: "/" });
        }
      }
    };

    sync();
  }, [isAuthenticated, isLoading, isSignedIn, user, syncUser, signOut]);
}
