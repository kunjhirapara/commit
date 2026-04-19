import { useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import { useMutation } from "convex/react";
import { useRouter } from "next/navigation";
import { api } from "../../../convex/_generated/api";
import { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "./button";
import toast from "react-hot-toast";
import { getDisplayErrorMessage, logError } from "@/lib/errors";

export default function EndCallButton({
  interview,
}: {
  interview?: Doc<"interviews">;
}) {
  const call = useCall();
  const router = useRouter();

  const { useLocalParticipant } = useCallStateHooks();
  const localParticipant = useLocalParticipant();
  const updateInterviewStatus = useMutation(
    api.interviews.updateInterviewStatus,
  );
  const logSessionEvent = useMutation(api.sessionEvents.logSessionEvent);

  if (!call || !interview) return null;

  const isMeetingOwner = localParticipant?.userId === call.state.createdBy?.id;

  if (!isMeetingOwner) return null;

  const endCall = async () => {
    try {
      await call.endCall();
      await logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: "host.ended_session",
        detail: "Host ended the session for everyone",
      });
      await updateInterviewStatus({
        interviewId: interview._id,
        status: "completed",
      });
      router.push("/");
      toast.success("Meeting ended for everyone");
    } catch (error) {
      logError("EndCallButton.endCall", error, {
        interviewId: interview._id,
      });
      toast.error(getDisplayErrorMessage(error, "Failed to end meeting."));
    }
  };

  return (
    <Button variant={"destructive"} onClick={endCall}>
      End Meeting
    </Button>
  );
}
