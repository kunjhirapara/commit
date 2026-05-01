"use client";

import Link from "next/link";
import ErrorState from "@/components/ui/ErrorState";
import MeetingRoom from "@/components/ui/MeetingRoom";
import MeetingSetup from "@/components/ui/MeetingSetup";
import useGetCallById from "@/hooks/useGetCallByUd";
import { api } from "../../../../../convex/_generated/api";
import { useUser } from "@clerk/nextjs";
import { useQuery } from "convex/react";
import {
  OwnCapability,
  StreamCall,
  StreamTheme,
} from "@stream-io/video-react-sdk";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { normalizeInterviewStatus } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import { cleanupMeetingMedia } from "@/lib/meetingCleanup";

function MeetingLoadingSkeleton() {
  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border bg-card p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-8 w-64" />
              <Skeleton className="h-4 w-56" />
            </div>
            <Skeleton className="h-7 w-24 rounded-full" />
          </div>

          <div className="relative min-h-[325px] w-full overflow-hidden rounded-2xl border bg-muted/40">
            <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="flex items-center justify-between rounded-xl border p-4"
              >
                <div className="flex items-center gap-3">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-28" />
                  </div>
                </div>
                <Skeleton className="h-6 w-11 rounded-full" />
              </div>
            ))}
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <Skeleton className="h-10 w-40 rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
          </div>
        </div>

        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border bg-card p-4">
              <div className="flex items-start gap-3">
                <Skeleton className="h-10 w-10 rounded-full" />
                <div className="w-full space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-full" />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function MeetingPage() {
  const { id } = useParams();
  const router = useRouter();
  const { isLoaded } = useUser();
  const { resolvedTheme } = useTheme();
  const meetingId = typeof id === "string" ? id : "";

  const { call, isCallLoading, error, errorDetails } =
    useGetCallById(meetingId);
  const interview = useQuery(
    api.interviews.getInterviewByStreamCallId,
    meetingId ? { streamCallId: meetingId } : "skip",
  );

  const [isSetUpComplete, setIsSetUpComplete] = useState(false);
  const interviewStatus = interview
    ? normalizeInterviewStatus(interview.status)
    : null;
  const callEndedAt = call?.state.endedAt;
  const canJoinEndedCall =
    call?.state.ownCapabilities.includes(OwnCapability.JOIN_ENDED_CALL) ??
    false;
  const isMeetingClosed =
    interviewStatus === "completed" ||
    interviewStatus === "cancelled" ||
    interviewStatus === "no_show" ||
    interviewStatus === "passed" ||
    interviewStatus === "rejected";
  const isEndedCall = !!callEndedAt && !canJoinEndedCall;

  useEffect(() => {
    if (isEndedCall) {
      router.replace("/call-ended");
    }
  }, [isEndedCall, router]);

  useEffect(() => {
    if (!call || (!isMeetingClosed && !isEndedCall)) return;

    void cleanupMeetingMedia(call, {
      message: "Meeting became unavailable",
    });
  }, [call, isEndedCall, isMeetingClosed]);

  useEffect(() => {
    return () => {
      void cleanupMeetingMedia(call, {
        message: "Navigated away from meeting page",
      });
    };
  }, [call]);

  if (!isLoaded || isCallLoading) return <MeetingLoadingSkeleton />;

  if (!call) {
    return (
      <ErrorState
        title="Unable to open meeting"
        message={error ?? "This meeting is unavailable right now."}
        details={errorDetails}
        secondaryAction={
          <Link
            className="text-sm text-primary underline-offset-4 hover:underline"
            href="/">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  if (isMeetingClosed) {
    return (
      <ErrorState
        title="This meeting has ended"
        message="The host has closed this meeting, so it can’t be joined again from this link."
        secondaryAction={
          <Link
            className="text-sm text-primary underline-offset-4 hover:underline"
            href="/">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  if (isEndedCall) {
    return (
      <ErrorState
        title="Call has ended"
        message="Redirecting you out of the meeting."
      />
    );
  }

  return (
    <StreamCall call={call}>
      <StreamTheme
        className="meeting-stream-theme"
        data-theme={resolvedTheme === "light" ? "light" : "dark"}>
        {!isSetUpComplete ? (
          <MeetingSetup
            interview={interview ?? undefined}
            onSetupComplete={() => setIsSetUpComplete(true)}
          />
        ) : (
          <MeetingRoom interview={interview ?? undefined} />
        )}
      </StreamTheme>
    </StreamCall>
  );
}

export default MeetingPage;
