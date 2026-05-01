"use client";

import { OwnCapability, useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { cleanupMeetingMedia } from "@/lib/meetingCleanup";

type UseCallEndHandlerOptions = {
  delayMs?: number;
  fallbackHref?: string;
  redirectTo?: string;
};

export function useCallEndHandler(
  options: UseCallEndHandlerOptions = {},
) {
  const {
    delayMs = 1000,
    fallbackHref = "/",
    redirectTo = "/call-ended",
  } = options;

  const call = useCall();
  const router = useRouter();
  const { useCallEndedAt, useHasPermissions } = useCallStateHooks();
  const endedAt = useCallEndedAt();
  const canJoinEndedCall = useHasPermissions(OwnCapability.JOIN_ENDED_CALL);
  const [isRedirecting, setIsRedirecting] = useState(false);
  const redirectStartedRef = useRef(false);
  const timeoutRef = useRef<number | null>(null);

  const clearPendingRedirect = useCallback(() => {
    if (timeoutRef.current !== null && typeof window !== "undefined") {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const redirectToEndedPage = useCallback(() => {
    if (redirectStartedRef.current) return;
    redirectStartedRef.current = true;
    setIsRedirecting(true);
    toast.info("Call has ended");

    if (typeof window === "undefined") return;

    timeoutRef.current = window.setTimeout(() => {
      void cleanupMeetingMedia(call, {
        message: "Call ended redirect",
      }).finally(() => {
        router.replace(redirectTo);

        // Defensive fallback in case client navigation is interrupted.
        timeoutRef.current = window.setTimeout(() => {
          if (window.location.pathname !== redirectTo) {
            window.location.assign(fallbackHref);
          }
        }, 300);
      });
    }, delayMs);
  }, [call, delayMs, fallbackHref, redirectTo, router]);

  useEffect(() => {
    if (!call) return;

    const unsubscribeSessionEnded = call.on("call.session_ended", () => {
      redirectToEndedPage();
    });
    const unsubscribeCallEnded = call.on("call.ended", () => {
      redirectToEndedPage();
    });

    return () => {
      unsubscribeSessionEnded?.();
      unsubscribeCallEnded?.();
    };
  }, [call, redirectToEndedPage]);

  useEffect(() => {
    if (endedAt && !canJoinEndedCall) {
      redirectToEndedPage();
    }
  }, [canJoinEndedCall, endedAt, redirectToEndedPage]);

  useEffect(() => {
    return () => {
      clearPendingRedirect();
    };
  }, [clearPendingRedirect]);

  return {
    hasCallEnded: !!endedAt && !canJoinEndedCall,
    isRedirecting,
  };
}
