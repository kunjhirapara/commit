"use client";

import Link from "next/link";
import LoaderUI from "@/components/ui/LoaderUI";
import ErrorState from "@/components/ui/ErrorState";
import MeetingRoom from "@/components/ui/MeetingRoom";
import MeetingSetup from "@/components/ui/MeetingSetup";
import useGetCallById from "@/hooks/useGetCallByUd";
import { useUser } from "@clerk/nextjs";
import { StreamCall, StreamTheme } from "@stream-io/video-react-sdk";
import { useParams } from "next/navigation";
import { useState } from "react";

function MeetingPage() {
  const { id } = useParams();
  const { isLoaded } = useUser();

  const { call, isCallLoading, error, errorDetails } = useGetCallById(id ?? "");

  const [isSetUpComplete, setIsSetUpComplete] = useState(false);

  if (!isLoaded || isCallLoading) return <LoaderUI />;

  if (!call) {
    return (
      <ErrorState
        title="Unable to open meeting"
        message={error ?? "This meeting is unavailable right now."}
        details={errorDetails}
        secondaryAction={
          <Link className="text-sm text-primary underline-offset-4 hover:underline" href="/">
            Back to dashboard
          </Link>
        }
      />
    );
  }

  return (
    <StreamCall call={call}>
      <StreamTheme>
        {!isSetUpComplete ? (
          <MeetingSetup onSetupComplete={() => setIsSetUpComplete(true)} />
        ) : (
          <MeetingRoom />
        )}
      </StreamTheme>
    </StreamCall>
  );
}

export default MeetingPage;
