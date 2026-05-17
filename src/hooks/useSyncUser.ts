"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { logError, sanitizeErrorMessage } from "@/lib/errors";
import { retryAsync } from "@/lib/retry";

const DUPLICATE_ACCOUNT_PREFIX = "An account with this email already exists";
const MISSING_ROW_RESYNC_COOLDOWN_MS = 2_000;

/**
 * Hook to sync the currently signed-in Clerk user to Convex.
 * Call this in a top-level component so it runs on every auth state change.
 */
export function useSyncUser() {
  const { user, isSignedIn } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useClerk();
  const syncUser = useMutation(api.users.syncUser);
  const currentUser = useQuery(
    api.users.getCurrentUser,
    isAuthenticated ? {} : "skip",
  );

  const lastSyncAtRef = useRef<number>(0);
  const inFlightForClerkIdRef = useRef<string | null>(null);
  const fatalToastShownRef = useRef(false);

  const runSync = useCallback(
    async (
      clerkId: string,
      payload: {
        clerkId: string;
        email: string;
        name: string;
        image?: string;
      },
    ) => {
      if (inFlightForClerkIdRef.current === clerkId) return;
      inFlightForClerkIdRef.current = clerkId;
      lastSyncAtRef.current = Date.now();

      try {
        await retryAsync(() => syncUser(payload), {
          retries: 2,
          shouldRetry: (error) => {
            const message = sanitizeErrorMessage(error, "");
            return !message.startsWith(DUPLICATE_ACCOUNT_PREFIX);
          },
        });
        fatalToastShownRef.current = false;
      } catch (error) {
        logError("useSyncUser", error, { userId: clerkId });

        const message = sanitizeErrorMessage(error, "");
        if (message.startsWith(DUPLICATE_ACCOUNT_PREFIX)) {
          toast.error(message);
          await signOut({ redirectUrl: "/" });
          return;
        }

        if (!fatalToastShownRef.current) {
          fatalToastShownRef.current = true;
          toast.error(
            "We couldn't finish setting up your account. Please refresh the page.",
          );
        }
      } finally {
        if (inFlightForClerkIdRef.current === clerkId) {
          inFlightForClerkIdRef.current = null;
        }
      }
    },
    [syncUser, signOut],
  );

  useEffect(() => {
    if (isLoading || !isAuthenticated || !isSignedIn || !user) return;

    void runSync(user.id, {
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? user.firstName ?? "",
      image: user.imageUrl ?? undefined,
    });
  }, [isAuthenticated, isLoading, isSignedIn, user, runSync]);

  useEffect(() => {
    if (isLoading || !isAuthenticated || !isSignedIn || !user) return;
    if (currentUser !== null) return;
    if (inFlightForClerkIdRef.current === user.id) return;

    const elapsed = Date.now() - lastSyncAtRef.current;
    if (elapsed < MISSING_ROW_RESYNC_COOLDOWN_MS) return;

    void runSync(user.id, {
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? user.firstName ?? "",
      image: user.imageUrl ?? undefined,
    });
  }, [isAuthenticated, isLoading, isSignedIn, user, currentUser, runSync]);
}
