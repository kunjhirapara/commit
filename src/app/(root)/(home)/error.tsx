"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

export default function HomeError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("HomeRouteError", error);
  }, [error]);

  return (
    <ErrorState
      title="We couldn't load your dashboard"
      message={getDisplayErrorMessage(
        error,
        "This is usually a transient issue. Try again in a moment.",
      )}
      details={getErrorDetails(error)}
      actionLabel="Try again"
      onAction={() => reset()}
    />
  );
}
