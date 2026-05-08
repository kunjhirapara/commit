import { useRouter } from "next/navigation";
import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { toast } from "sonner";

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

  const joinMeeting = (callId: string) => {
    if (!client)
      return toast.error("Failed to join meeting. Please try again.");
    router.push(`/meeting/${callId}`);
  };
  return { createInstantMeeting, joinMeeting };
};

export default useMeetingActions;
