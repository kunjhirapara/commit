"use client";

import { ConvexReactClient, ConvexProviderWithAuth } from "convex/react";
import { SessionProvider, useSession } from "next-auth/react";
import { useCallback, useMemo, useRef } from "react";

import { getValidatedClientEnv } from "@/lib/env";

const clientEnv = getValidatedClientEnv();
const convex = new ConvexReactClient(clientEnv.NEXT_PUBLIC_CONVEX_URL);

/**
 * Refresh this long before the token actually expires.
 *
 * The token lives ten minutes (CONVEX_TOKEN_TTL_SECONDS). Handing Convex one
 * with two seconds left means a request that leaves valid and arrives expired,
 * which surfaces as an intermittent authentication error under no particular
 * load and is miserable to reproduce.
 */
const REFRESH_MARGIN_MS = 60_000;

type CachedToken = {
  token: string;
  /** Wall-clock ms after which this token should no longer be handed out. */
  usableUntilMs: number;
  /** Invalidates the cache when the session switches to a different account. */
  userId: string;
};

/**
 * Adapts an Auth.js session to the shape Convex expects.
 *
 * Convex does not know about the session cookie. It wants a bearer token it can
 * verify against our JWKS, so this hook trades one for the other through
 * /api/auth/convex-token and caches the result.
 */
const useConvexAuthBridge = () => {
  const { data: session, status } = useSession();
  const cache = useRef<CachedToken | null>(null);

  const userId = session?.user?.id ?? null;
  const isAuthenticated = status === "authenticated" && Boolean(userId);
  const isLoading = status === "loading";

  const fetchAccessToken = useCallback(
    async ({ forceRefreshToken }: { forceRefreshToken: boolean }) => {
      if (!userId) {
        // Signed out. Drop any cached token rather than leaving it for whoever
        // signs in next in this tab.
        cache.current = null;
        return null;
      }

      const cached = cache.current;

      /**
       * `forceRefreshToken` is not a hint.
       *
       * Convex sets it when the token it just used was rejected. Returning the
       * cached value here hands back the same rejected token, which is rejected
       * again, which sets the flag again -- an infinite retry loop that reads as
       * the app hanging rather than as an auth error.
       */
      const usable =
        !forceRefreshToken &&
        cached &&
        cached.userId === userId &&
        cached.usableUntilMs > Date.now();

      if (usable) return cached.token;

      cache.current = null;

      try {
        const response = await fetch("/api/auth/convex-token", {
          // The session cookie is the credential; without this the route sees
          // an anonymous request and answers 401.
          credentials: "same-origin",
          cache: "no-store",
        });

        if (!response.ok) return null;

        const payload = (await response.json()) as {
          token?: string;
          expiresInSeconds?: number;
        };

        if (!payload.token) return null;

        // Falls back to the margin itself when the route did not say, which
        // makes an unparseable response behave as "do not cache" rather than
        // "cache forever".
        const lifetimeMs = (payload.expiresInSeconds ?? 0) * 1000;

        cache.current = {
          token: payload.token,
          usableUntilMs: Date.now() + Math.max(lifetimeMs - REFRESH_MARGIN_MS, 0),
          userId,
        };

        return payload.token;
      } catch {
        // Offline, or the route is down. Returning null lets Convex treat this
        // as unauthenticated and retry, which is recoverable; throwing here
        // would surface as an unhandled rejection in the client.
        return null;
      }
    },
    [userId],
  );

  // Convex re-runs its auth setup whenever this object's identity changes, so
  // it must be stable across renders that did not change the session.
  return useMemo(
    () => ({ isLoading, isAuthenticated, fetchAccessToken }),
    [isLoading, isAuthenticated, fetchAccessToken],
  );
};

/**
 * The Auth.js replacement for ConvexClerkProvider.
 *
 * SessionProvider has to sit above ConvexProviderWithAuth, because the bridge
 * hook reads the session and Convex calls that hook.
 */
function ConvexAuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      {/*
        No UserSyncStatusProvider. It existed to gate queries until a webhook
        had copied the Clerk account into Convex; the adapter creates the row
        before the session exists, so there is nothing left to wait for.
      */}
      <ConvexProviderWithAuth client={convex} useAuth={useConvexAuthBridge}>
        {children}
      </ConvexProviderWithAuth>
    </SessionProvider>
  );
}

export default ConvexAuthProvider;
