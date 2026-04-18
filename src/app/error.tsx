"use client";

import { useEffect } from "react";
import ErrorState from "@/components/ui/ErrorState";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    logError("GlobalErrorBoundary", error);
  }, [error]);

  return (
    <ErrorState
      fullScreen
      title="Something went wrong"
      message={getDisplayErrorMessage(
        error,
        "We encountered an unexpected error. Please try again or contact support if the issue persists.",
      )}
      details={getErrorDetails(error)}
      actionLabel="Try again"
      onAction={() => reset()}
    />
  );
}
