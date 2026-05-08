import { OwnCapability, useCall, useCallStateHooks } from "@stream-io/video-react-sdk";
import { PhoneOffIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { Doc } from "../../../convex/_generated/dataModel";
import { Button } from "./button";
import { toast } from "sonner";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useUserRole } from "@/hooks/useUserRole";
import { endInterviewMeeting } from "@/actions/stream.actions";
import { useState } from "react";
import { cleanupMeetingMedia } from "@/lib/meetingCleanup";

export default function EndCallButton({
  interview,
}: {
  interview?: Doc<"interviews">;
}) {
  const call = useCall();
  const router = useRouter();
  const [isEnding, setIsEnding] = useState(false);

  const { useHasPermissions } = useCallStateHooks();
  const canEndCall = useHasPermissions(OwnCapability.END_CALL);
  const { user, isAdmin, isInterviewer } = useUserRole();

  if (!call || !canEndCall || !user) return null;

  const isKnownAppHost =
    isAdmin ||
    isInterviewer ||
    !!interview?.interviewerIds.includes(user.clerkId);

  if (!isKnownAppHost && interview) return null;

  const endCall = async () => {
    setIsEnding(true);

    const endPromise = (async () => {
      await endInterviewMeeting({
        streamCallId: interview?.streamCallId ?? call.id,
      });
      await cleanupMeetingMedia(call, { message: "Host ended meeting" });
    })();

    toast.promise(endPromise, {
      loading: "Ending the meeting for everyone…",
      success: "Meeting ended for everyone.",
      error: (err) => getDisplayErrorMessage(err, "Failed to end meeting."),
    });

    try {
      await endPromise;
      router.replace("/");
    } catch (error) {
      logError("EndCallButton.endCall", error, {
        interviewId: interview?._id,
        streamCallId: interview?.streamCallId ?? call.id,
      });
    } finally {
      setIsEnding(false);
    }
  };

  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      className="shrink-0 rounded-full px-3"
      onClick={endCall}
      disabled={isEnding}
      aria-label="End meeting for everyone"
      title="End meeting for everyone">
      <PhoneOffIcon className="size-3.5" />
      <span>{isEnding ? "Ending..." : "End"}</span>
    </Button>
  );
}
