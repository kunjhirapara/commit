import { useRouter } from "next/navigation";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { toast } from "sonner";

import { resolveJoinTarget } from "@/lib/meetingNavigation";

const useMeetingActions = () => {
  const router = useRouter();
  const client = useStreamVideoClient();

  const createInstantMeeting = async () => {
    if (!client) throw new Error("Meeting client is not available.");

    const id = crypto.randomUUID();
    const call = client.call("default", id, {});
    await call.getOrCreate({
      data: {
        starts_at: new Date().toISOString(),
        custom: {
          description: "Instant Meeting",
        },
        settings_override: {
          recording: {
            mode: "available",
            audio_only: false,
            quality: "1080p",
          },
        },
      },
    });

    router.push(`/meeting/${call.id}`);
  };

  /**
   * Navigation only, and deliberately not gated on `client`.
   *
   * The Stream client belongs to the page being left, not the one being opened:
   * /meeting/[id] mounts its own provider and waits for the connection there.
   * Requiring it here meant the button failed on the home page while pasting
   * the same link worked. See src/lib/meetingNavigation.ts.
   */
  const joinMeeting = (callId: string) => {
    const target = resolveJoinTarget(callId);

    if (!target.ok) return toast.error(target.message);

    router.push(target.href);
  };
  return { createInstantMeeting, joinMeeting };
};

export default useMeetingActions;
