"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { logError, sanitizeErrorMessage } from "@/lib/errors";
import { retryAsync } from "@/lib/retry";

const DUPLICATE_ACCOUNT_PREFIX = "An account with this email already exists";

export type UserSyncStatus =
  | "loading"
  | "signedOut"
  | "syncing"
  | "ready"
  | "error";

export type UserSyncState = {
  status: UserSyncStatus;
  clerkId?: string;
  errorMessage?: string;
};

/**
 * Hook to sync the currently signed-in Clerk user to Convex.
 * Call this in a top-level component so it runs on every auth state change.
 *
 * IMPORTANT: this hook must not call any Convex `useQuery` — it renders inside
 * the root layout (above app/error.tsx's reach), so a throwing query here would
 * bubble straight to global-error.tsx and crash the whole signed-in shell.
 * Reliability comes from the retry below plus the Clerk webhook in convex/http.ts.
 */
export function useSyncUser() {
  const { user, isSignedIn, isLoaded } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useClerk();
  const syncUser = useMutation(api.users.syncUser);
  const [syncState, setSyncState] = useState<UserSyncState>({
    status: "loading",
  });

  const inFlightForClerkIdRef = useRef<string | null>(null);
  const syncedForClerkIdRef = useRef<string | null>(null);
  const fatalToastShownRef = useRef(false);

  const setNextSyncState = useCallback((next: UserSyncState) => {
    setSyncState((current) =>
      current.status === next.status &&
      current.clerkId === next.clerkId &&
      current.errorMessage === next.errorMessage
        ? current
        : next,
    );
  }, []);

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
      if (syncedForClerkIdRef.current === clerkId) {
        setNextSyncState({ status: "ready", clerkId });
        return;
      }

      if (inFlightForClerkIdRef.current === clerkId) return;
      inFlightForClerkIdRef.current = clerkId;
      setNextSyncState({ status: "syncing", clerkId });

      try {
        await retryAsync(() => syncUser(payload), {
          retries: 2,
          shouldRetry: (error) => {
            const message = sanitizeErrorMessage(error, "");
            return !message.startsWith(DUPLICATE_ACCOUNT_PREFIX);
          },
        });
        syncedForClerkIdRef.current = clerkId;
        fatalToastShownRef.current = false;
        setNextSyncState({ status: "ready", clerkId });
      } catch (error) {
        logError("useSyncUser", error, { userId: clerkId });

        const message = sanitizeErrorMessage(error, "");
        setNextSyncState({
          status: "error",
          clerkId,
          errorMessage: message || "Unable to sync the signed-in user.",
        });

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
    [setNextSyncState, syncUser, signOut],
  );

  useEffect(() => {
    const clerkId = user?.id;

    if (!isLoaded || isLoading || (isSignedIn && !isAuthenticated)) {
      setNextSyncState({ status: "loading", clerkId });
      return;
    }

    if (!isSignedIn || !user) {
      inFlightForClerkIdRef.current = null;
      syncedForClerkIdRef.current = null;
      fatalToastShownRef.current = false;
      setNextSyncState({ status: "signedOut" });
      return;
    }

    if (
      syncedForClerkIdRef.current &&
      syncedForClerkIdRef.current !== user.id
    ) {
      syncedForClerkIdRef.current = null;
    }

    void runSync(user.id, {
      clerkId: user.id,
      email: user.primaryEmailAddress?.emailAddress ?? "",
      name: user.fullName ?? user.firstName ?? "",
      image: user.imageUrl ?? undefined,
    });
  }, [
    isAuthenticated,
    isLoaded,
    isLoading,
    isSignedIn,
    user,
    runSync,
    setNextSyncState,
  ]);

  return syncState;
}
