import {
  DeviceSettings,
  useCall,
  VideoPreview,
} from "@stream-io/video-react-sdk";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { Card } from "./card";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircle2Icon,
  GlobeIcon,
  MicIcon,
  SettingsIcon,
  ShieldCheckIcon,
  WifiIcon,
} from "lucide-react";
import { Button } from "./button";
import { Switch } from "./switch";
import { Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  getCalendarLinks,
  getInterviewTimezone,
  getInterviewStatusLabel,
  getMeetingStatus,
} from "@/lib/utils";
import { getDisplayErrorMessage, logError } from "@/lib/errors";

function MeetingSetup({
  interview,
  onSetupComplete,
}: {
  interview?: Doc<"interviews">;
  onSetupComplete: () => void;
}) {
  const [isCameraDisabled, setIsCameraDisabled] = useState(true);
  const [isMicDisabled, setIsMicDisabled] = useState(false);
  const [cameraPermission, setCameraPermission] = useState("checking");
  const [microphonePermission, setMicrophonePermission] = useState("checking");
  const [browserSupported, setBrowserSupported] = useState(true);
  const [networkLabel, setNetworkLabel] = useState("Checking network");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [hasRecordingConsent, setHasRecordingConsent] = useState(false);

  const call = useCall();
  const logSessionEvent = useMutation(api.sessionEvents.logSessionEvent);
  const captureRecordingConsent = useMutation(
    api.interviews.captureRecordingConsent,
  );

  const calendarLinks = useMemo(
    () => (interview ? getCalendarLinks(interview) : null),
    [interview],
  );

  if (!call) return <p>404 Call not Found</p>;

  useEffect(() => {
    if (isCameraDisabled) call.camera.disable();
    else call.camera.enable();
  }, [isCameraDisabled, call.camera]);

  useEffect(() => {
    if (isMicDisabled) call.microphone.disable();
    else call.microphone.enable();
  }, [isMicDisabled, call.microphone]);

  useEffect(() => {
    const checkEnvironment = async () => {
      setBrowserSupported(
        typeof navigator !== "undefined" &&
        !!navigator.mediaDevices &&
        !!window.isSecureContext,
      );

      if ("permissions" in navigator) {
        try {
          const cameraStatus = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          const microphoneStatus = await navigator.permissions.query({
            name: "microphone" as PermissionName,
          });

          setCameraPermission(cameraStatus.state);
          setMicrophonePermission(microphoneStatus.state);
        } catch {
          setCameraPermission("unknown");
          setMicrophonePermission("unknown");
        }
      } else {
        setCameraPermission("unknown");
        setMicrophonePermission("unknown");
      }

      const connection = (
        navigator as Navigator & {
          connection?: {
            effectiveType?: string;
            downlink?: number;
          };
        }
      ).connection;

      if (connection?.effectiveType) {
        setNetworkLabel(
          `${connection.effectiveType.toUpperCase()} · ${connection.downlink ? `${connection.downlink} Mbps` : "Bandwidth unknown"
          }`,
        );
      } else {
        setNetworkLabel("Stable network recommended");
      }
    };

    checkEnvironment();
  }, []);

  const handleJoin = async () => {
    if (interview && !hasRecordingConsent) {
      setJoinError(
        "Please confirm recording consent before joining the session.",
      );
      return;
    }

    try {
      setJoinError(null);
      if (interview) {
        await captureRecordingConsent({
          interviewId: interview._id,
        });
      }
      await call.join();
      if (interview) {
        await logSessionEvent({
          interviewId: interview._id,
          streamCallId: interview.streamCallId,
          type: "recording.consent_granted",
          detail: "Participant confirmed consent before joining",
          metadata: JSON.stringify({
            browserSupported,
            networkLabel,
            hasRecordingConsent: true,
          }),
        });
      }
      onSetupComplete();
    } catch (error) {
      logError("MeetingSetup.handleJoin", error, {
        interviewId: interview?._id,
      });
      setJoinError(
        getDisplayErrorMessage(
          error,
          interview?.browserFallbackInstructions ||
          "We couldn't join the interview. Refresh once, confirm device permissions, and try again from a desktop Chrome browser.",
        ),
      );
    }
  };

  const readinessChecks = [
    {
      label: "Browser support",
      value: browserSupported ? "Ready" : "Needs attention",
      ok: browserSupported,
      helper: browserSupported
        ? "Secure browser features are available."
        : "Use a secure Chrome, Edge, or Safari session with camera access enabled.",
      icon: GlobeIcon,
    },
    {
      label: "Camera access",
      value: cameraPermission,
      ok: cameraPermission === "granted" || cameraPermission === "prompt",
      helper:
        cameraPermission === "granted"
          ? "Camera permissions are available."
          : "If prompted, allow camera access before joining.",
      icon: CameraIcon,
    },
    {
      label: "Microphone access",
      value: microphonePermission,
      ok: microphonePermission === "granted" || microphonePermission === "prompt",
      helper:
        microphonePermission === "granted"
          ? "Microphone permissions are available."
          : "If prompted, allow microphone access before joining.",
      icon: MicIcon,
    },
    {
      label: "Network quality",
      value: networkLabel,
      ok: true,
      helper: "A wired or strong Wi-Fi connection is recommended for live coding and video.",
      icon: WifiIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Card className="p-6">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm uppercase tracking-[0.2em] text-primary">
                {interview?.brandName || "Commit Interviews"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold">
                {interview?.title || "Interview Waiting Room"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {interview?.templateLabel
                  ? `${interview.templateLabel} · ${getInterviewTimezone(interview)}`
                  : "Check your setup before you join."}
              </p>
            </div>
            {interview ? (
              <div className="rounded-full border px-3 py-1 text-xs font-medium text-muted-foreground">
                {getInterviewStatusLabel(getMeetingStatus(interview))}
              </div>
            ) : null}
          </div>

          <div className="relative min-h-[380px] overflow-hidden rounded-2xl border bg-muted/50">
            <VideoPreview className="h-full w-full" />
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <CameraIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Camera</p>
                  <p className="text-sm text-muted-foreground">
                    {isCameraDisabled ? "Off" : "On"}
                  </p>
                </div>
              </div>
              <Switch
                checked={!isCameraDisabled}
                onCheckedChange={(checked) => setIsCameraDisabled(!checked)}
                aria-label="Toggle camera"
              />
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <MicIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Microphone</p>
                  <p className="text-sm text-muted-foreground">
                    {isMicDisabled ? "Off" : "On"}
                  </p>
                </div>
              </div>
              <Switch
                checked={!isMicDisabled}
                onCheckedChange={(checked) => setIsMicDisabled(!checked)}
                aria-label="Toggle microphone"
              />
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold">Before You Join</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Complete these checks to avoid last-minute issues.
              </p>
            </div>

            <div className="space-y-3">
              {readinessChecks.map((item) => (
                <div
                  key={item.label}
                  className="rounded-xl border p-4"
                  aria-live="polite">
                  <div className="flex items-start gap-3">
                    <div
                      className={`mt-0.5 flex h-9 w-9 items-center justify-center rounded-full ${item.ok ? "bg-primary/10" : "bg-amber-500/10"
                        }`}>
                      <item.icon
                        className={`h-4 w-4 ${item.ok ? "text-primary" : "text-amber-600"
                          }`}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-medium">{item.label}</p>
                        <span className="text-xs text-muted-foreground">
                          {item.value}
                        </span>
                      </div>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {item.helper}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="rounded-xl border border-dashed p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10">
                  <ShieldCheckIcon className="h-4 w-4 text-primary" />
                </div>
                <div className="space-y-2">
                  <p className="font-medium">Join instructions</p>
                  <p className="text-sm text-muted-foreground">
                    {interview?.meetingInstructions ||
                      "Join a few minutes early, test your setup, and keep a backup browser tab ready."}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    If something goes wrong, rejoin from a desktop Chrome or Edge
                    browser and confirm camera and microphone permissions.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between rounded-xl border p-4">
              <div className="space-y-1">
                <p className="font-medium">Recording and session consent</p>
                <p className="text-sm text-muted-foreground">
                  {interview?.recordingDisclosure ||
                    "Confirm that you understand this session may be recorded for interview review and hiring decisions."}
                </p>
              </div>
              <Switch
                checked={hasRecordingConsent}
                onCheckedChange={setHasRecordingConsent}
                aria-label="Confirm recording consent"
              />
            </div>

            {calendarLinks ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" asChild>
                  <a href={calendarLinks.google} target="_blank" rel="noreferrer">
                    Add to Google
                  </a>
                </Button>
                <Button variant="outline" className="flex-1" asChild>
                  <a href={calendarLinks.outlook} target="_blank" rel="noreferrer">
                    Add to Outlook
                  </a>
                </Button>
              </div>
            ) : null}

            <div className="flex items-center justify-between rounded-xl bg-muted/50 p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
                  <SettingsIcon className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="font-medium">Devices</p>
                  <p className="text-sm text-muted-foreground">
                    Configure microphone, speaker, and camera preferences.
                  </p>
                </div>
              </div>
              <DeviceSettings />
            </div>

            {joinError ? (
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-900">
                <div className="flex gap-3">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4" />
                  <p>{joinError}</p>
                </div>
              </div>
            ) : null}

            <div className="space-y-3">
              <Button
                className="w-full"
                size="lg"
                onClick={handleJoin}
                disabled={!!interview && !hasRecordingConsent}>
                Join Interview
              </Button>
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2Icon className="h-4 w-4" />
                <span>Candidate-friendly fallback guidance is ready if joining fails.</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default MeetingSetup;
