import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./dialog";
import { Input } from "./input";
import { Button } from "./button";
import { LoaderIcon } from "lucide-react";
import { toast } from "sonner";
import useMeetingActions from "@/hooks/useMeetingActions";
import { getDisplayErrorMessage } from "@/lib/errors";

interface MeetingModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  isJoinMeeting: boolean;
}

function MeetingModal({
  isOpen,
  onClose,
  title,
  isJoinMeeting,
}: MeetingModalProps) {
  const [meetingUrl, setMeetingUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const { createInstantMeeting: createMeeting, joinMeeting } =
    useMeetingActions();

  const handleStart = async () => {
    if (isJoinMeeting) {
      const meetingId = meetingUrl.split("/").pop();
      if (meetingId) joinMeeting(meetingId);
      setMeetingUrl("");
      onClose();
      return;
    }

    setIsLoading(true);
    const promise = createMeeting();
    toast.promise(promise, {
      loading: "Starting your meeting…",
      success: "Meeting created! Redirecting…",
      error: (err) => getDisplayErrorMessage(err, "Failed to create meeting."),
    });
    try {
      await promise;
      setMeetingUrl("");
      onClose();
    } catch {
      // error handled by toast.promise
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[425px">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription className="sr-only">
            {isJoinMeeting ? "Enter a meeting URL to join" : "Start a new instant meeting"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-4">
          {isJoinMeeting && (
            <Input
              placeholder="Paste meeting URL here..."
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
            />
          )}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleStart}
              disabled={(isJoinMeeting && !meetingUrl.trim()) || isLoading}>
              {isLoading ? (
                <>
                  <LoaderIcon className="size-4 animate-spin" aria-hidden="true" />
                  Starting…
                </>
              ) : isJoinMeeting ? (
                "Join Meeting"
              ) : (
                "Start Meeting"
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default MeetingModal;
