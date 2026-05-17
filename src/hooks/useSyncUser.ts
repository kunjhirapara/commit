"use client";

import { useClerk, useUser } from "@clerk/nextjs";
import { useConvexAuth, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useCallback, useEffect, useRef } from "react";
import { toast } from "sonner";
import { logError, sanitizeErrorMessage } from "@/lib/errors";
import { retryAsync } from "@/lib/retry";

const DUPLICATE_ACCOUNT_PREFIX = "An account with this email already exists";

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
  const { user, isSignedIn } = useUser();
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signOut } = useClerk();
  const syncUser = useMutation(api.users.syncUser);

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
}
