"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import ErrorState from "@/components/ui/ErrorState";
import RecordingCard, {
  RecordingCardSkeleton,
} from "@/components/ui/RecordingCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useEffect, useState } from "react";
import {
  getDisplayErrorMessage,
  getErrorDetails,
  logError,
} from "@/lib/errors";
import useGetCalls from "@/hooks/useGetCalls";
import {
  AuthorizedRecording,
  listAuthorizedRecordings,
} from "@/actions/stream.actions";

function RecordingsPage() {
  const { calls, isLoading: callsLoading, error, errorDetails } = useGetCalls();
  const [recordings, setRecordings] = useState<AuthorizedRecording[]>([]);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);
  const [recordingsErrorDetails, setRecordingsErrorDetails] = useState<
    string | undefined
  >();
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchRecordings = async () => {
      if (callsLoading) return;

      setIsLoading(true);
      setRecordingsError(null);
      setRecordingsErrorDetails(undefined);

      try {
        const [authorizedRecordings, callRecordings] = await Promise.all([
          listAuthorizedRecordings(),
          Promise.all(
            (calls ?? []).map(async (call) => {
              try {
                const { recordings } = await call.listRecordings();

                return (recordings ?? []).map((recording) => ({
                  streamCallId: call.id,
                  title:
                    typeof call.state.custom?.description === "string"
                      ? call.state.custom.description
                      : undefined,
                  scheduledStartTime: recording.start_time
                    ? new Date(recording.start_time).getTime()
                    : 0,
                  url: recording.url,
                  filename: recording.filename,
                  startTime: recording.start_time,
                  endTime: recording.end_time,
                }));
              } catch (error) {
                logError("RecordingsPage.call.listRecordings", error, {
                  callId: call.id,
                });
                return [];
              }
            }),
          ),
        ]);

        const mergedRecordings = new Map<string, AuthorizedRecording>();

        callRecordings
          .flat()
          .forEach((recording) =>
            mergedRecordings.set(recording.url, recording),
          );

        authorizedRecordings.forEach((recording) =>
          mergedRecordings.set(recording.url, recording),
        );

        setRecordings(
          Array.from(mergedRecordings.values()).sort((a, b) => {
            const aTime = a.startTime
              ? new Date(a.startTime).getTime()
              : a.scheduledStartTime;
            const bTime = b.startTime
              ? new Date(b.startTime).getTime()
              : b.scheduledStartTime;

            return bTime - aTime;
          }),
        );
      } catch (error) {
        logError("RecordingsPage.fetchRecordings", error);
        setRecordings([]);
        setRecordingsError(
          getDisplayErrorMessage(
            error,
            "We couldn't load recordings right now.",
          ),
        );
        setRecordingsErrorDetails(getErrorDetails(error));
      } finally {
        setIsLoading(false);
      }
    };
    fetchRecordings();
  }, [calls, callsLoading]);

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold">Recordings</h1>
      <p className="text-muted-foreground my-1">
        {isLoading || callsLoading ? (
          "Loading recordings..."
        ) : (
          <>
            {recordings.length}{" "}
            {recordings.length === 1 ? "recording" : "recordings"} available
          </>
        )}
      </p>

      {/* RECORDINGS GRID */}

      {error || recordingsError ? (
        <ErrorState
          title="Unable to load recordings"
          message={recordingsError ?? error ?? "Recordings are unavailable."}
          details={recordingsErrorDetails ?? errorDetails}
        />
      ) : isLoading || callsLoading ? (
        <ScrollArea className="h-[calc(100vh-12rem)] mt-3">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
            {[...Array(6)].map((_, i) => (
              <RecordingCardSkeleton key={i} />
            ))}
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="h-[calc(100vh-12rem)] mt-3">
          {recordings.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 p-6">
              {recordings.map((r) => (
                <RecordingCard
                  key={`${r.streamCallId}-${r.url}`}
                  recording={r}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[400px] gap-4">
              <p className="text-xl font-medium text-muted-foreground">
                No recordings available
              </p>
            </div>
          )}
        </ScrollArea>
      )}
    </div>
  );
}

export default function ProtectedRecordingsPage() {
  return (
    <RoleGuard
      allowedRoles={["interviewer", "recruiter", "admin"]}
      title="Recordings restricted"
      message="Only interview staff can access recordings.">
      <RecordingsPage />
    </RoleGuard>
  );
}
