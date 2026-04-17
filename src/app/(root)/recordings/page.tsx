"use client";

import ErrorState from "@/components/ui/ErrorState";
import LoaderUI from "@/components/ui/LoaderUI";
import RecordingCard from "@/components/ui/RecordingCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import useGetCalls from "@/hooks/useGetCalls";
import { CallRecording } from "@stream-io/video-react-sdk";
import { useEffect, useState } from "react";
import { getDisplayErrorMessage, getErrorDetails, logError } from "@/lib/errors";

function RecordingsPage() {
  const { calls, isLoading, error, errorDetails } = useGetCalls();
  const [recordings, setRecordings] = useState<CallRecording[]>([]);
  const [recordingsError, setRecordingsError] = useState<string | null>(null);
  const [recordingsErrorDetails, setRecordingsErrorDetails] = useState<
    string | undefined
  >();

  useEffect(() => {
    const fetchRecordings = async () => {
      if (!calls) return;

      setRecordingsError(null);
      setRecordingsErrorDetails(undefined);

      try {
        const callData = await Promise.all(
          calls.map(async (call) => {
            const { recordings } = await call.listRecordings();
            return recordings;
          }),
        );
        const allRecordings = callData.flat();
        setRecordings(allRecordings);
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
      }
    };
    fetchRecordings();
  }, [calls]);

  if (isLoading) return <LoaderUI />;

  if (error || recordingsError) {
    return (
      <ErrorState
        title="Unable to load recordings"
        message={recordingsError ?? error ?? "Recordings are unavailable."}
        details={recordingsErrorDetails ?? errorDetails}
      />
    );
  }

  return (
    <div className="container max-w-7xl mx-auto p-6">
      <h1 className="text-3xl font-bold">Recordings</h1>
      <p className="text-muted-foreground my-1">
        {recordings.length}{" "}
        {recordings.length === 1 ? "recording" : "recordings"} available
      </p>

      {/* RECORDINGS RID */}

      <ScrollArea className="h-[calc(100vh-12rem)] mt-3">
        {recordings.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-6">
            {recordings.map((r) => (
              <RecordingCard key={r.end_time} recording={r} />
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
    </div>
  );
}

export default RecordingsPage;
