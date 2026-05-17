"use client";

import { useEffect, useState } from "react";
import ErrorState from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

export const HOME_RETRY_STORAGE_KEY = "home-error-auto-retry";
const RETRY_TTL_MS = 60_000;
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

type StoredRetry = { count: number; at: number };

const readRetryCount = (): number => {
  if (typeof window === "undefined") return 0;
  try {
    const raw = window.sessionStorage.getItem(HOME_RETRY_STORAGE_KEY);
    if (!raw) return 0;
    const parsed = JSON.parse(raw) as StoredRetry;
    if (!parsed?.at || Date.now() - parsed.at > RETRY_TTL_MS) {
      window.sessionStorage.removeItem(HOME_RETRY_STORAGE_KEY);
      return 0;
    }
    return parsed.count ?? 0;
  } catch {
    return 0;
  }
};

const bumpRetryCount = (): void => {
  if (typeof window === "undefined") return;
  const next = readRetryCount() + 1;
  window.sessionStorage.setItem(
    HOME_RETRY_STORAGE_KEY,
    JSON.stringify({ count: next, at: Date.now() } satisfies StoredRetry),
  );
};

const clearRetryCount = (): void => {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(HOME_RETRY_STORAGE_KEY);
};

function HomeLoadingFallback() {
  return (
    <div className="container mx-auto max-w-7xl space-y-8 p-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 rounded-lg border bg-card p-6 shadow-xs sm:flex-row sm:items-center sm:justify-between">
        <div className="w-full max-w-xl space-y-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-4 w-full max-w-md" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-6 shadow-xs">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="mt-4 space-y-2">
              <Skeleton className="h-6 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-4/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const [retriesExhausted, setRetriesExhausted] = useState(false);

  useEffect(() => {
    logError("HomeRouteError", error);
  }, [error]);

  useEffect(() => {
    if (readRetryCount() >= MAX_AUTO_RETRIES) {
      setRetriesExhausted(true);
      return;
    }

    const timer = setTimeout(() => {
      bumpRetryCount();
      reset();
    }, RETRY_DELAY_MS);

    return () => clearTimeout(timer);
  }, [reset]);

  if (!retriesExhausted) {
    return <HomeLoadingFallback />;
  }

  return (
    <ErrorState
      title="We couldn't load your dashboard"
      message={getDisplayErrorMessage(
        error,
        "Please refresh the page. If this keeps happening, contact support.",
      )}
      details={getErrorDetails(error)}
      actionLabel="Try again"
      onAction={() => {
        clearRetryCount();
        reset();
      }}
    />
  );
}
