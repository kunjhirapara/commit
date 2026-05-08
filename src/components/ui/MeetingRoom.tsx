"use client";

import {
  CallingState,
  CallParticipantsList,
  OwnCapability,
  PaginatedGridLayout,
  ReactionsButton,
  RecordCallButton,
  ScreenShareButton,
  SpeakerLayout,
  SpeakingWhileMutedNotification,
  ToggleAudioPublishingButton,
  ToggleVideoPublishingButton,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { useMutation } from "convex/react";
import {
  AlertTriangleIcon,
  CheckIcon,
  Clock3Icon,
  GridIcon,
  LayoutListIcon,
  LoaderIcon,
  MicOffIcon,
  PhoneIcon,
  ShieldIcon,
  UsersIcon,
  UserXIcon,
  VideoIcon,
  WifiIcon,
  XIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Doc } from "../../../convex/_generated/dataModel";
import { api } from "../../../convex/_generated/api";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "./resizable";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Button } from "./button";
import ErrorState from "./ErrorState";
import EndCallButton from "./EndCallButton";
import CodeEditor from "./CodeEditor";
import { cn, getInterviewEndTimeMs } from "@/lib/utils";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useCallEndHandler } from "@/hooks/useCallEndHandler";
import { useUserRole } from "@/hooks/useUserRole";
import { cleanupMeetingMedia } from "@/lib/meetingCleanup";

type Interview = Doc<"interviews">;

const CONNECTION_STATE_COPY: Partial<Record<CallingState, string>> = {
  [CallingState.RECONNECTING]: "Reconnecting to the call",
  [CallingState.RECONNECTING_FAILED]: "Reconnection failed",
  [CallingState.OFFLINE]: "Network offline",
  [CallingState.MIGRATING]: "Moving you to a healthier connection",
};

function NetworkPill({
  publisherLatency,
  subscriberLatency,
  packetLoss,
  isDegraded,
}: {
  publisherLatency: number;
  subscriberLatency: number;
  packetLoss: number;
  isDegraded: boolean;
}) {
  return (
    <div
      aria-label={`Network: ${isDegraded ? "degraded" : "good"}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium backdrop-blur-sm transition-colors duration-300",
        isDegraded
          ? "border-amber-400/40 bg-amber-950/60 text-amber-300"
          : "border-white/10 bg-black/40 text-white/70",
      )}>
      <WifiIcon
        className={cn(
          "size-3",
          isDegraded ? "text-amber-400" : "text-emerald-400",
        )}
        aria-hidden="true"
      />
      <span>{Math.round(publisherLatency)}↑</span>
      <span className="opacity-50">·</span>
      <span>{Math.round(subscriberLatency)}↓</span>
      {packetLoss > 0 && (
        <>
          <span className="opacity-50">·</span>
          <span className="text-amber-300">{packetLoss} lost</span>
        </>
      )}
    </div>
  );
}

function MeetingRoom({ interview }: { interview?: Interview }) {
  const router = useRouter();
  const call = useCall();

  const [layout, setLayout] = useState<"grid" | "speaker">("speaker");
  const [showParticipants, setShowParticipants] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [hostActionLoading, setHostActionLoading] = useState<
    "mute" | "remove" | null
  >(null);

  const logSessionEvent = useMutation(api.sessionEvents.logSessionEvent);

  const {
    useCallCallingState,
    useCallEndedAt,
    useCallStatsReport,
    useParticipants,
    useLocalParticipant,
    useHasPermissions,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const endedAt = useCallEndedAt();
  const canJoinEndedCall = useHasPermissions(OwnCapability.JOIN_ENDED_CALL);
  const { hasCallEnded, isRedirecting } = useCallEndHandler();
  const statsReport = useCallStatsReport();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const {
    user: currentUser,
    isAdmin,
    isRecruiter,
    isLoading: isUserLoading,
  } = useUserRole();

  const previousParticipantIdsRef = useRef<string[]>([]);
  const previousCallingStateRef = useRef<CallingState | null>(null);

  const scheduledEndTime = interview ? getInterviewEndTimeMs(interview) : null;
  const isPastScheduledEnd =
    scheduledEndTime !== null ? Date.now() > scheduledEndTime : false;
  const isHost =
    (!!call?.state.createdBy?.id &&
      call.state.createdBy.id === localParticipant?.userId) ||
    // App-level: admin/recruiter role or listed as interviewer for this interview
    (!isUserLoading &&
      !!interview &&
      !!currentUser &&
      (isAdmin ||
        isRecruiter ||
        interview.interviewerIds.includes(currentUser.clerkId) ||
        interview.interviewerIds.includes(localParticipant?.userId ?? "")));
  const canSendAudio = useHasPermissions(OwnCapability.SEND_AUDIO);
  const canSendVideo = useHasPermissions(OwnCapability.SEND_VIDEO);
  const canCreateReaction = useHasPermissions(OwnCapability.CREATE_REACTION);
  const canScreenshare = useHasPermissions(OwnCapability.SCREENSHARE);

  const networkHealth = useMemo(() => {
    const publisherLatency =
      statsReport?.publisherStats.averageRoundTripTimeInMs ?? 0;
    const subscriberLatency =
      statsReport?.subscriberStats.averageRoundTripTimeInMs ?? 0;
    const packetLoss =
      (statsReport?.publisherAudioStats.totalPacketsLost ?? 0) +
      (statsReport?.subscriberAudioStats.totalPacketsLost ?? 0);
    const jitter =
      Math.max(
        statsReport?.publisherStats.averageJitterInMs ?? 0,
        statsReport?.subscriberStats.averageJitterInMs ?? 0,
      ) || 0;

    const isDegraded =
      !isOnline ||
      callingState === CallingState.RECONNECTING ||
      callingState === CallingState.RECONNECTING_FAILED ||
      publisherLatency > 450 ||
      subscriberLatency > 450 ||
      packetLoss > 15;

    return {
      publisherLatency,
      subscriberLatency,
      packetLoss,
      jitter,
      isDegraded,
    };
  }, [callingState, isOnline, statsReport]);

  /* ── network events ── */
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  /* ── log network changes ── */
  useEffect(() => {
    if (!interview) return;
    void logSessionEvent({
      interviewId: interview._id,
      streamCallId: interview.streamCallId,
      type: isOnline ? "session.online" : "session.offline",
      detail: isOnline ? "Browser network restored" : "Browser network lost",
      metadata: JSON.stringify({ online: isOnline }),
    }).catch((e) =>
      logError("MeetingRoom.networkEvent", e, {
        interviewId: interview._id,
        online: isOnline,
      }),
    );
  }, [interview, isOnline, logSessionEvent]);

  /* ── log calling state changes ── */
  useEffect(() => {
    if (!interview) return;
    if (previousCallingStateRef.current === callingState) return;
    previousCallingStateRef.current = callingState;
    const detail = CONNECTION_STATE_COPY[callingState];
    if (!detail) return;
    void logSessionEvent({
      interviewId: interview._id,
      streamCallId: interview.streamCallId,
      type: `session.${String(callingState).toLowerCase()}`,
      detail,
      metadata: JSON.stringify({ state: callingState }),
    }).catch((e) =>
      logError("MeetingRoom.callingStateEvent", e, {
        interviewId: interview._id,
        callingState,
      }),
    );
  }, [callingState, interview, logSessionEvent]);

  /* ── log participant join/leave ── */
  useEffect(() => {
    if (!interview) return;
    const current = participants
      .map((p) => p.userId)
      .filter(Boolean) as string[];
    const prev = previousParticipantIdsRef.current;
    const joined = current.filter((id) => !prev.includes(id));
    const left = prev.filter((id) => !current.includes(id));
    previousParticipantIdsRef.current = current;
    joined.forEach(
      (id) =>
        void logSessionEvent({
          interviewId: interview._id,
          streamCallId: interview.streamCallId,
          type: "participant.joined",
          detail: id,
          metadata: JSON.stringify({ participantId: id }),
        }).catch(() => undefined),
    );
    left.forEach(
      (id) =>
        void logSessionEvent({
          interviewId: interview._id,
          streamCallId: interview.streamCallId,
          type: "participant.left",
          detail: id,
          metadata: JSON.stringify({ participantId: id }),
        }).catch(() => undefined),
    );
  }, [interview, logSessionEvent, participants]);

  /* ── connecting state ── */
  if (callingState !== CallingState.JOINED) {
    return (
      <div className="flex h-[calc(100vh-4rem-1px)] items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex size-14 items-center justify-center rounded-2xl border border-border/70 bg-card/80 shadow-sm backdrop-blur">
            <LoaderIcon className="size-6 animate-spin text-primary" />
          </div>
          <div>
            <p className="text-sm font-medium">Connecting to your interview</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {CONNECTION_STATE_COPY[callingState] ?? "Preparing your session…"}
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (hasCallEnded || isRedirecting || (endedAt && !canJoinEndedCall)) {
    return (
      <ErrorState
        title="Call has ended"
        message="Redirecting you out of the meeting."
        secondaryAction={
          <Button onClick={() => router.replace("/call-ended")}>Go now</Button>
        }
      />
    );
  }

  /* ── host actions ── */
  const handleMuteAll = async () => {
    if (!call || !interview) return;
    setHostActionLoading("mute");
    try {
      await call.muteAllUsers("audio");
      await logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: "host.muted_all",
        detail: "Muted all participants",
      });
      toast.success("Muted all participants.");
    } catch (error) {
      logError("MeetingRoom.handleMuteAll", error, {
        interviewId: interview._id,
      });
      toast.error(getDisplayErrorMessage(error, "Unable to mute everyone."));
    } finally {
      setHostActionLoading(null);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!call || !interview) return;
    setHostActionLoading("remove");
    try {
      await call.blockUser(userId);
      await logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: "host.removed_participant",
        detail: userId,
        metadata: JSON.stringify({ participantId: userId }),
      });
      toast.success("Participant removed from the session.");
    } catch (error) {
      logError("MeetingRoom.handleRemoveParticipant", error, {
        interviewId: interview._id,
        participantId: userId,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to remove participant."),
      );
    } finally {
      setHostActionLoading(null);
    }
  };

  const handleLeave = () => {
    if (!call) return;

    const leavePromise = cleanupMeetingMedia(call, {
      message: "Participant left",
    });

    toast.promise(leavePromise, {
      loading: "Leaving the meeting…",
      success: "You've left the meeting.",
      error: "Something went wrong while leaving.",
    });

    leavePromise.finally(() => router.push("/"));
  };

  /* ── render ── */
  return (
    <div className="flex h-[calc(100vh-4rem-1px)] flex-col overflow-hidden bg-background lg:flex-row">
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* ── Video panel ── */}
        <ResizablePanel defaultSize={25} minSize={10} className="relative">
          <div className="absolute inset-0">
            {/* Status banners */}
            <div className="absolute left-3 right-3 top-3 z-20 space-y-2">
              {(!isOnline || networkHealth.isDegraded) && (
                <div
                  role="alert"
                  className="rounded-xl border border-amber-300/60 bg-amber-950/80 px-4 py-3 text-amber-100 shadow-lg backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon
                      className="mt-0.5 size-4 shrink-0 text-amber-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-sm font-medium">
                        {isOnline ? "Call quality degraded" : "You are offline"}
                      </p>
                      <p className="hidden text-xs text-amber-200/80 sm:block">
                        Switch to speaker view and reduce video quality if
                        needed.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 border-amber-500/40 bg-amber-900/50 text-xs text-amber-100 hover:bg-amber-800/60"
                      onClick={() => setLayout("speaker")}>
                      Speaker view
                    </Button>
                  </div>
                </div>
              )}

              {isPastScheduledEnd && (
                <div
                  role="status"
                  className="rounded-xl border border-blue-300/30 bg-blue-950/80 px-4 py-3 text-blue-100 shadow-lg backdrop-blur-sm">
                  <div className="flex items-start gap-3">
                    <Clock3Icon
                      className="mt-0.5 size-4 shrink-0 text-blue-400"
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        Past scheduled end time
                      </p>
                      <p className="hidden text-xs text-blue-200/80 sm:block">
                        Wrap up or end the session when ready.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Video layout */}
            {layout === "grid" ? <PaginatedGridLayout /> : <SpeakerLayout />}

            {/* Participants sidebar */}
            {showParticipants && (
              <div className="absolute right-0 top-0 z-10 p-4 h-full w-72 border-l border-border/70 bg-background/95 backdrop-blur-sm">
                <CallParticipantsList
                  onClose={() => setShowParticipants(false)}
                />
              </div>
            )}
          </div>

          {/* Bottom call controls */}
          <div className="absolute bottom-0 left-0 right-0 z-1">
            {/* Network stats pill */}
            <div className="flex justify-center pb-1 pt-0">
              <NetworkPill
                publisherLatency={networkHealth.publisherLatency}
                subscriberLatency={networkHealth.subscriberLatency}
                packetLoss={networkHealth.packetLoss}
                isDegraded={networkHealth.isDegraded}
              />
            </div>

            <div className="bg-gradient-to-t from-background/95 via-background/55 to-transparent pb-4 pt-5 dark:from-black/80 dark:via-black/40">
              <div className="flex flex-wrap items-center justify-center gap-2 px-4">
                {canSendAudio ? (
                  <SpeakingWhileMutedNotification>
                    <ToggleAudioPublishingButton />
                  </SpeakingWhileMutedNotification>
                ) : null}
                {canSendVideo ? <ToggleVideoPublishingButton /> : null}
                {canCreateReaction ? <ReactionsButton /> : null}
                {canScreenshare ? <ScreenShareButton /> : null}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Leave meeting"
                  title="Leave meeting"
                  onClick={handleLeave}
                  className="size-10 cursor-pointer rounded-full border-rose-300/60 bg-rose-50 text-rose-600 shadow-sm backdrop-blur hover:bg-rose-100 hover:text-rose-700 dark:border-rose-800/40 dark:bg-rose-950/40 dark:text-rose-400 dark:hover:bg-rose-900/60">
                  <PhoneIcon className="size-4" aria-hidden="true" />
                </Button>

                {/* Layout picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      aria-label={`Switch layout — currently ${layout === "grid" ? "grid" : "speaker"} view`}
                      className="size-10 cursor-pointer rounded-full border-slate-200 bg-white text-slate-800 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
                      <LayoutListIcon className="size-4" aria-hidden="true" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="center" className="min-w-[160px]">
                    <DropdownMenuItem
                      onClick={() => setLayout("speaker")}
                      className="flex cursor-pointer items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <LayoutListIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Speaker view
                      </div>
                      {layout === "speaker" && (
                        <CheckIcon
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => setLayout("grid")}
                      className="flex cursor-pointer items-center justify-between gap-3">
                      <div className="flex items-center gap-2">
                        <GridIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Grid view
                      </div>
                      {layout === "grid" && (
                        <CheckIcon
                          className="size-4 text-primary"
                          aria-hidden="true"
                        />
                      )}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Participants toggle */}
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={
                    showParticipants
                      ? "Hide participants"
                      : `Show participants (${participants.length})`
                  }
                  aria-pressed={showParticipants}
                  onClick={() => setShowParticipants((p) => !p)}
                  className={cn(
                    "relative size-10 p-5 cursor-pointer rounded-full border-slate-200 bg-white text-slate-800 shadow-sm backdrop-blur transition-colors hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20",
                    showParticipants &&
                      "border-primary/40 bg-primary/10 text-primary dark:border-primary/30 dark:bg-primary/20 dark:text-primary",
                  )}>
                  <UsersIcon className="size-4" aria-hidden="true" />
                  {participants.length > 0 && (
                    <span
                      aria-hidden="true"
                      className="absolute -right-1 -top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                      {participants.length > 9 ? "9+" : participants.length}
                    </span>
                  )}
                </Button>

                {/* Recording — Stream SDK button, host only */}
                {isHost && <RecordCallButton />}

                {/* Host controls — only visible to interviewers, recruiters, and admins */}
                {isHost && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="outline"
                        size="icon"
                        aria-label="Host controls"
                        title="Host controls"
                        className="size-10 cursor-pointer rounded-full border-violet-200 bg-violet-50 text-violet-700 shadow-sm backdrop-blur hover:bg-violet-100 dark:border-violet-800/40 dark:bg-violet-950/40 dark:text-violet-300 dark:hover:bg-violet-900/60">
                        {hostActionLoading ? (
                          <LoaderIcon
                            className="size-4 animate-spin"
                            aria-hidden="true"
                          />
                        ) : (
                          <ShieldIcon className="size-4" aria-hidden="true" />
                        )}
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="center" className="min-w-52.5">
                      <DropdownMenuLabel className="text-xs text-muted-foreground">
                        Host Controls
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />

                      <DropdownMenuItem
                        onClick={handleMuteAll}
                        disabled={!!hostActionLoading}
                        className="flex cursor-pointer items-center gap-2">
                        <MicOffIcon
                          className="size-4 text-muted-foreground"
                          aria-hidden="true"
                        />
                        Mute all participants
                      </DropdownMenuItem>

                      {participants.filter((p) => !p.isLocalParticipant)
                        .length > 0 && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-xs text-muted-foreground">
                            Remove participant
                          </DropdownMenuLabel>
                          {participants
                            .filter((p) => !p.isLocalParticipant && p.userId)
                            .map((p) => (
                              <DropdownMenuItem
                                key={p.sessionId}
                                onClick={() =>
                                  handleRemoveParticipant(p.userId)
                                }
                                disabled={!!hostActionLoading}
                                className="flex cursor-pointer items-center gap-2 text-rose-600 focus:text-rose-600 dark:text-rose-400 dark:focus:text-rose-400">
                                <UserXIcon
                                  className="size-4 shrink-0"
                                  aria-hidden="true"
                                />
                                <span className="truncate">
                                  {p.name || p.userId}
                                </span>
                              </DropdownMenuItem>
                            ))}
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}

                <EndCallButton interview={interview} />
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ── Code editor panel ── */}
        <ResizablePanel defaultSize={70} minSize={10}>
          <div className="h-full rounded-none border-l">
            <CodeEditor streamCallId={interview?.streamCallId} />
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default MeetingRoom;
