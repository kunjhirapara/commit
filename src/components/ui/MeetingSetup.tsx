import {
  DeviceSettings,
  OwnCapability,
  useCall,
  useCallStateHooks,
  VideoPreview,
} from "@stream-io/video-react-sdk";
import { useMutation } from "convex/react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Card } from "./card";
import {
  AlertTriangleIcon,
  CameraIcon,
  CheckCircle2Icon,
  GlobeIcon,
  LoaderIcon,
  LogInIcon,
  MicIcon,
  SettingsIcon,
  ShieldCheckIcon,
  WifiIcon,
} from "lucide-react";
import { Button } from "./button";
import { Switch } from "./switch";
import { Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import Link from "next/link";
import {
  getCalendarLinks,
  getInterviewTimezone,
  getInterviewStatusLabel,
  getMeetingStatus,
} from "@/lib/utils";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useCallEndHandler } from "@/hooks/useCallEndHandler";
import { cn } from "@/lib/utils";

function humanizePermission(state: string): string {
  switch (state) {
    case "granted":
      return "Allowed";
    case "denied":
      return "Blocked";
    case "prompt":
      return "Will prompt";
    case "checking":
      return "Checking…";
    case "unknown":
      return "Unknown";
    default:
      return state;
  }
}

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
  const [networkLabel, setNetworkLabel] = useState("Checking network…");
  const [joinError, setJoinError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);

  const call = useCall();
  const { useCallEndedAt, useHasPermissions } = useCallStateHooks();
  const endedAt = useCallEndedAt();
  const canJoinEndedCall = useHasPermissions(OwnCapability.JOIN_ENDED_CALL);
  const { hasCallEnded, isRedirecting } = useCallEndHandler();
  const logSessionEvent = useMutation(api.sessionEvents.logSessionEvent);

  const calendarLinks = useMemo(
    () => (interview ? getCalendarLinks(interview) : null),
    [interview],
  );

  useEffect(() => {
    if (!call) return;
    if (isCameraDisabled) call.camera.disable();
    else call.camera.enable();
  }, [call, isCameraDisabled]);

  useEffect(() => {
    if (!call) return;
    if (isMicDisabled) call.microphone.disable();
    else call.microphone.enable();
  }, [call, isMicDisabled]);

  useEffect(() => {
    let cameraStatus: PermissionStatus | null = null;
    let microphoneStatus: PermissionStatus | null = null;

    const checkEnvironment = async () => {
      setBrowserSupported(
        typeof navigator !== "undefined" &&
          !!navigator.mediaDevices &&
          !!window.isSecureContext,
      );

      if ("permissions" in navigator) {
        try {
          cameraStatus = await navigator.permissions.query({
            name: "camera" as PermissionName,
          });
          microphoneStatus = await navigator.permissions.query({
            name: "microphone" as PermissionName,
          });
          setCameraPermission(cameraStatus.state);
          setMicrophonePermission(microphoneStatus.state);

          cameraStatus.onchange = () =>
            setCameraPermission(cameraStatus!.state);
          microphoneStatus.onchange = () =>
            setMicrophonePermission(microphoneStatus!.state);
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
          connection?: { effectiveType?: string; downlink?: number };
        }
      ).connection;

      if (connection?.effectiveType) {
        setNetworkLabel(
          `${connection.effectiveType.toUpperCase()} · ${
            connection.downlink
              ? `${connection.downlink} Mbps`
              : "Bandwidth unknown"
          }`,
        );
      } else {
        setNetworkLabel("Stable network recommended");
      }
    };

    checkEnvironment();

    return () => {
      if (cameraStatus) cameraStatus.onchange = null;
      if (microphoneStatus) microphoneStatus.onchange = null;
    };
  }, []);

  if (!call) return <p>404 Call not Found</p>;

  if (hasCallEnded || isRedirecting || (endedAt && !canJoinEndedCall)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6">
        <Card className="w-full max-w-md p-8 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-muted/50">
            <AlertTriangleIcon
              className="size-5 text-muted-foreground"
              aria-hidden="true"
            />
          </div>
          <h1 className="text-xl font-semibold">Call has ended</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Redirecting you out of the meeting.
          </p>
          <div className="mt-6">
            <Link
              className="text-sm text-primary underline-offset-4 hover:underline"
              href="/call-ended">
              Go now
            </Link>
          </div>
        </Card>
      </div>
    );
  }

  const handleJoin = async () => {
    if (endedAt && !canJoinEndedCall) {
      toast.error("This meeting has already ended.");
      return;
    }

    if (hasBlockedPermissions) {
      const list = blockedDevices.join(" and ");
      toast.error(
        `${list.charAt(0).toUpperCase() + list.slice(1)} access is blocked`,
        {
          description:
            "Open your browser's site settings and set the blocked device(s) to Allow, then reload this page.",
          duration: 6000,
        },
      );
      return;
    }

    setJoinError(null);
    setIsJoining(true);

    const fallbackMessage =
      interview?.browserFallbackInstructions ||
      "We couldn't join the interview. Refresh once, confirm device permissions, and try again from a desktop Chrome browser.";

    const joinPromise = (async () => {
      await call.join();
      if (interview) {
        await logSessionEvent({
          interviewId: interview._id,
          streamCallId: interview.streamCallId,
          type: "session.joined",
          detail: "Participant joined from setup",
          metadata: JSON.stringify({ browserSupported, networkLabel }),
        });
      }
    })();

    toast.promise(joinPromise, {
      loading: "Joining your interview…",
      success: "Connected! Your session is ready.",
      error: (err) => getDisplayErrorMessage(err, fallbackMessage),
    });

    try {
      await joinPromise;
      onSetupComplete();
    } catch (error) {
      logError("MeetingSetup.handleJoin", error, {
        interviewId: interview?._id,
      });
      setJoinError(getDisplayErrorMessage(error, fallbackMessage));
    } finally {
      setIsJoining(false);
    }
  };

  const hasBlockedPermissions =
    cameraPermission === "denied" || microphonePermission === "denied";

  const blockedDevices = [
    cameraPermission === "denied" ? "camera" : null,
    microphonePermission === "denied" ? "microphone" : null,
  ].filter(Boolean);

  const readinessChecks = [
    {
      label: "Browser support",
      value: browserSupported ? "Ready" : "Needs attention",
      ok: browserSupported,
      blocked: false,
      checking: false,
      helper: browserSupported
        ? "Secure browser features are available."
        : "Use a secure Chrome, Edge, or Safari session with camera access enabled.",
      icon: GlobeIcon,
    },
    {
      label: "Camera access",
      value: humanizePermission(cameraPermission),
      ok: cameraPermission === "granted" || cameraPermission === "prompt",
      blocked: cameraPermission === "denied",
      checking: cameraPermission === "checking",
      helper:
        cameraPermission === "granted"
          ? "Camera permissions are available."
          : cameraPermission === "denied"
            ? "Camera is blocked — open browser site settings and set Camera to Allow."
            : "If prompted, allow camera access before joining.",
      icon: CameraIcon,
    },
    {
      label: "Microphone access",
      value: humanizePermission(microphonePermission),
      ok:
        microphonePermission === "granted" || microphonePermission === "prompt",
      blocked: microphonePermission === "denied",
      checking: microphonePermission === "checking",
      helper:
        microphonePermission === "granted"
          ? "Microphone permissions are available."
          : microphonePermission === "denied"
            ? "Microphone is blocked — open browser site settings and set Microphone to Allow."
            : "If prompted, allow microphone access before joining.",
      icon: MicIcon,
    },
    {
      label: "Network quality",
      value: networkLabel,
      ok: true,
      blocked: false,
      checking: networkLabel === "Checking network…",
      helper:
        "A wired or strong Wi-Fi connection is recommended for live coding and video.",
      icon: WifiIcon,
    },
  ];

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="mx-auto grid w-full max-w-6xl gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        {/* Left: video preview + device toggles */}
        <Card className="p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                {interview?.brandName || "Commit Interviews"}
              </p>
              <h1 className="mt-2 text-2xl font-semibold leading-tight">
                {interview?.title || "Interview Waiting Room"}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {interview?.templateLabel
                  ? `${interview.templateLabel} · ${getInterviewTimezone(interview)}`
                  : "Check your setup before you join."}
              </p>
            </div>
            {interview ? (
              <div className="shrink-0 rounded-full border border-border/70 bg-muted/40 px-3 py-1 text-xs font-medium text-muted-foreground">
                {getInterviewStatusLabel(getMeetingStatus(interview))}
              </div>
            ) : null}
          </div>

          {/* Video preview */}
          <div className="relative meeting-setup-preview min-h-81.25 w-full rounded-2xl border bg-muted/50 overflow-hidden transform-[translateZ(0)]">
            {isCameraDisabled && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted/60 backdrop-blur-sm rounded-2xl overflow-hidden">
                <div className="flex size-12 items-center justify-center rounded-2xl border border-border/70 bg-background/80">
                  <CameraIcon
                    className="size-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                </div>
                <p className="text-xs text-muted-foreground">Camera is off</p>
              </div>
            )}
            <VideoPreview
              className="h-full w-full"
              DisabledVideoPreview={() => null}
            />
          </div>

          {/* Camera / mic toggles */}
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div
              className={cn(
                "flex items-center justify-between rounded-xl border p-4 transition-colors duration-200",
                isCameraDisabled
                  ? "border-border/60 bg-muted/30"
                  : "border-primary/20 bg-primary/5",
              )}>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-colors duration-200",
                    isCameraDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary",
                  )}>
                  <CameraIcon className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">Camera</p>
                  <p className="text-xs text-muted-foreground">
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

            <div
              className={cn(
                "flex items-center justify-between rounded-xl border p-4 transition-colors duration-200",
                isMicDisabled
                  ? "border-border/60 bg-muted/30"
                  : "border-primary/20 bg-primary/5",
              )}>
              <div className="flex items-center gap-3">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full transition-colors duration-200",
                    isMicDisabled
                      ? "bg-muted text-muted-foreground"
                      : "bg-primary/10 text-primary",
                  )}>
                  <MicIcon className="size-4" aria-hidden="true" />
                </div>
                <div>
                  <p className="text-sm font-medium">Microphone</p>
                  <p className="text-xs text-muted-foreground">
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

        {/* Right: readiness checks + join */}
        <Card className="p-6">
          <div className="space-y-6">
            <div>
              <h2 className="text-lg font-semibold leading-none">
                Before You Join
              </h2>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Complete these checks to avoid last-minute issues.
              </p>
            </div>

            {/* Readiness checks */}
            <div className="space-y-2.5">
              {readinessChecks.map((item) => (
                <div
                  key={item.label}
                  aria-live="polite"
                  className={cn(
                    "rounded-xl border p-4 transition-colors duration-200",
                    item.blocked
                      ? "border-rose-300/60 bg-rose-50/50 dark:border-rose-800/40 dark:bg-rose-950/20"
                      : !item.ok && !item.checking
                        ? "border-amber-300/60 bg-amber-50/50 dark:border-amber-700/40 dark:bg-amber-950/20"
                        : "border-border/70 bg-background/60",
                  )}>
                  <div className="flex items-start gap-3">
                    <div
                      className={cn(
                        "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                        item.checking
                          ? "bg-muted"
                          : item.blocked
                            ? "bg-rose-500/10"
                            : item.ok
                              ? "bg-primary/10"
                              : "bg-amber-500/10",
                      )}>
                      {item.checking ? (
                        <LoaderIcon
                          className="size-4 animate-spin text-muted-foreground"
                          aria-label="Checking…"
                        />
                      ) : item.blocked ? (
                        <AlertTriangleIcon
                          className="size-4 text-rose-600 dark:text-rose-400"
                          aria-hidden="true"
                        />
                      ) : item.ok ? (
                        <item.icon
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      ) : (
                        <AlertTriangleIcon
                          className="size-4 text-amber-600"
                          aria-hidden="true"
                        />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium leading-none">
                          {item.label}
                        </p>
                        <span
                          className={cn(
                            "text-xs font-medium",
                            item.checking
                              ? "text-muted-foreground"
                              : item.blocked
                                ? "text-rose-600 dark:text-rose-400"
                                : item.ok
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-amber-600 dark:text-amber-400",
                          )}>
                          {item.value}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground leading-snug">
                        {item.helper}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Calendar links */}
            {calendarLinks ? (
              <div className="flex gap-2">
                <Button variant="outline" className="flex-1 text-sm" asChild>
                  <a
                    href={calendarLinks.google}
                    target="_blank"
                    rel="noreferrer">
                    Add to Google
                  </a>
                </Button>
                <Button variant="outline" className="flex-1 text-sm" asChild>
                  <a
                    href={calendarLinks.outlook}
                    target="_blank"
                    rel="noreferrer">
                    Add to Outlook
                  </a>
                </Button>
              </div>
            ) : null}

            {/* Device settings */}
            <div className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 p-4">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-primary/10">
                  <SettingsIcon
                    className="size-4 text-primary"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <p className="text-sm font-medium">Devices</p>
                  <p className="text-xs text-muted-foreground">
                    Configure camera, mic &amp; speaker.
                  </p>
                </div>
              </div>
              <DeviceSettings />
            </div>

            {/* Blocked permissions banner */}
            {hasBlockedPermissions && (
              <div
                role="alert"
                className="rounded-xl border border-rose-300/60 bg-rose-50/70 p-4 dark:border-rose-800/40 dark:bg-rose-950/25">
                <div className="flex gap-3">
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400"
                    aria-hidden="true"
                  />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-rose-800 dark:text-rose-300">
                      {blockedDevices
                        .map(
                          (d) => `${d!.charAt(0).toUpperCase()}${d!.slice(1)}`,
                        )
                        .join(" and ")}{" "}
                      access is blocked
                    </p>
                    <p className="text-xs text-rose-700/80 dark:text-rose-400/80 leading-relaxed">
                      You don't need to keep them on during the interview — but
                      the browser must have access. Click the lock icon in your
                      address bar, set the blocked device(s) to{" "}
                      <strong>Allow</strong>, then reload this page.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Join error */}
            {joinError && !hasBlockedPermissions ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-300/50 bg-rose-50/60 p-4 dark:border-rose-800/40 dark:bg-rose-950/20">
                <div className="flex gap-3">
                  <AlertTriangleIcon
                    className="mt-0.5 size-4 shrink-0 text-rose-600 dark:text-rose-400"
                    aria-hidden="true"
                  />
                  <p className="text-sm text-rose-800 dark:text-rose-300">
                    {joinError}
                  </p>
                </div>
              </div>
            ) : null}

            {/* Join button */}
            <div className="space-y-3">
              <Button
                className="w-full gap-2"
                size="lg"
                disabled={isJoining || hasBlockedPermissions}
                onClick={handleJoin}>
                {isJoining ? (
                  <>
                    <LoaderIcon
                      className="size-4 animate-spin"
                      aria-hidden="true"
                    />
                    Joining…
                  </>
                ) : (
                  <>
                    <LogInIcon className="size-4" aria-hidden="true" />
                    Join Interview
                  </>
                )}
              </Button>
              <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
                <CheckCircle2Icon className="size-3.5" aria-hidden="true" />
                <span>Fallback guidance is ready if joining fails.</span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}

export default MeetingSetup;
