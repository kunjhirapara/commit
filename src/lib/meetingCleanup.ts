import type { Call } from "@stream-io/video-react-sdk";

type CleanupMeetingMediaOptions = {
  message?: string;
};

export async function cleanupMeetingMedia(
  call?: Call | null,
  options: CleanupMeetingMediaOptions = {},
) {
  if (!call) return;

  const { message = "Leaving meeting page" } = options;

  await Promise.allSettled([
    call.camera.disable(true),
    call.microphone.disable(true),
  ]);

  await call.leave({ message }).catch(() => undefined);
}
