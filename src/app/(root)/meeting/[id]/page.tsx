"use client";

import LoaderUI from "@/components/ui/LoaderUI";
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

  const { call, isCallLoading } = useGetCallById(id ?? "");

  const [isSetUpComplete, setIsSetUpComplete] = useState(false);

  if (!isLoaded || isCallLoading) return <LoaderUI />;

  if (!call) return null;

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
