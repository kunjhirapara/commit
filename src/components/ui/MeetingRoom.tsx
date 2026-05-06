"use client";

import {
  CancelCallButton,
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
  Clock3Icon,
  LayoutListIcon,
  LoaderIcon,
  UsersIcon,
  VideoOffIcon,
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

type Interview = Doc<"interviews">;

const CONNECTION_STATE_COPY: Partial<Record<CallingState, string>> = {
  [CallingState.RECONNECTING]: "Reconnecting to the call",
  [CallingState.RECONNECTING_FAILED]: "Reconnection failed",
  [CallingState.OFFLINE]: "Network offline",
  [CallingState.MIGRATING]: "Moving you to a healthier connection",
};

function MeetingRoom({ interview }: { interview?: Interview }) {
  const router = useRouter();
  const call = useCall();

  const [layout, setLayout] = useState<"grid" | "speaker">("speaker");
  const [showParticipants, setShowParticipants] = useState(false);
  const [isOnline, setIsOnline] = useState(
    typeof navigator === "undefined" ? true : navigator.onLine,
  );
  const [hostActionLoading, setHostActionLoading] = useState<
    "mute" | "record" | "remove" | null
  >(null);
  const [recordingNoticeVisible, setRecordingNoticeVisible] = useState(() => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem("commit-recording-notice-dismissed") !== "1";
  });

  const logSessionEvent = useMutation(api.sessionEvents.logSessionEvent);

  const {
    useCallCallingState,
    useCallEndedAt,
    useCallStatsReport,
    useParticipants,
    useLocalParticipant,
    useIsCallRecordingInProgress,
    useHasPermissions,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const endedAt = useCallEndedAt();
  const canJoinEndedCall = useHasPermissions(OwnCapability.JOIN_ENDED_CALL);
  const { hasCallEnded, isRedirecting } = useCallEndHandler();
  const statsReport = useCallStatsReport();
  const participants = useParticipants();
  const isRecording = useIsCallRecordingInProgress();
  const localParticipant = useLocalParticipant();
  const { user: currentUser, isAdmin, isRecruiter } = useUserRole();

  const previousParticipantIdsRef = useRef<string[]>([]);
  const previousCallingStateRef = useRef<CallingState | null>(null);

  const scheduledEndTime = interview ? getInterviewEndTimeMs(interview) : null;
  const isPastScheduledEnd =
    scheduledEndTime !== null ? Date.now() > scheduledEndTime : false;
  const isHost =
    !!interview &&
    !!currentUser &&
    (isAdmin ||
      isRecruiter ||
      interview.interviewerIds.includes(currentUser.clerkId) ||
      interview.interviewerIds.includes(localParticipant?.userId ?? ""));
  const canSendAudio = useHasPermissions(OwnCapability.SEND_AUDIO);
  const canSendVideo = useHasPermissions(OwnCapability.SEND_VIDEO);
  const canCreateReaction = useHasPermissions(OwnCapability.CREATE_REACTION);
  const canScreenshare = useHasPermissions(OwnCapability.SCREENSHARE);
  const canRecordCall = useHasPermissions(
    OwnCapability.START_RECORD_CALL,
    OwnCapability.STOP_RECORD_CALL,
  );

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

  /* ── network event ── */
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

  if (callingState !== CallingState.JOINED)
    return (
      <div className="h-96 flex items-center justify-center">
        <LoaderIcon className="size-6 animate-spin" />
      </div>
    );

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

  /* ── host actions (fixed API calls) ── */
  const handleMuteAll = async () => {
    if (!call || !interview) return;
    setHostActionLoading("mute");
    try {
      // Correct Stream SDK API — no casting needed
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

  const handleToggleRecording = async () => {
    if (!call || !interview) return;
    setHostActionLoading("record");
    try {
      if (isRecording) {
        await call.stopRecording();
      } else {
        await call.startRecording();
      }
      await logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: isRecording ? "recording.stopped" : "recording.started",
        detail: isRecording
          ? "Host stopped recording"
          : "Host started recording",
      });
      toast.success(isRecording ? "Recording stopped." : "Recording started.");
    } catch (error) {
      logError("MeetingRoom.handleToggleRecording", error, {
        interviewId: interview._id,
        recording: isRecording,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to update recording right now."),
      );
    } finally {
      setHostActionLoading(null);
    }
  };

  const handleRemoveParticipant = async (userId: string) => {
    if (!call || !interview) return;
    setHostActionLoading("remove");
    try {
      // Correct Stream SDK call to block a user from re-joining mid-session
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

  const dismissRecordingNotice = () => {
    localStorage.setItem("commit-recording-notice-dismissed", "1");
    setRecordingNoticeVisible(false);
  };

  /* ── render ── */
  return (
    <div className="flex h-[calc(100vh-4rem-1px)] flex-col overflow-hidden bg-background lg:flex-row">
      {recordingNoticeVisible && (
        <div className="flex shrink-0 items-center gap-3 border-b bg-amber-50 px-4 py-2.5 text-sm text-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
          <span className="flex-1">This interview session may be recorded for evaluation purposes.</span>
          <button
            type="button"
            onClick={dismissRecordingNotice}
            className="shrink-0 text-xs underline underline-offset-2 hover:no-underline">
            Got it
          </button>
        </div>
      )}
      <ResizablePanelGroup orientation="horizontal" className="flex-1">
        {/* ── Video panel ── */}
        <ResizablePanel defaultSize={25} minSize={10} className="relative">
          <div className="absolute inset-0">
            {/* Status banners */}
            <div className="absolute left-3 right-3 top-3 z-20 space-y-2">
              {(!isOnline || networkHealth.isDegraded) && (
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-950 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="font-medium text-sm">
                        {isOnline
                          ? "Call quality is degraded"
                          : "You are offline"}
                      </p>
                      <p className="text-xs text-amber-900/80 hidden sm:block">
                        Switch to speaker view and reduce video quality if
                        needed.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="shrink-0 text-xs"
                      onClick={() => setLayout("speaker")}>
                      Fix
                    </Button>
                  </div>
                </div>
              )}

              {isPastScheduledEnd && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-blue-950 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Clock3Icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm">
                        Past scheduled end time
                      </p>
                      <p className="text-xs text-blue-900/80 hidden sm:block">
                        Wrap up or end the session.
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
              <div className="absolute right-0 top-0 h-full w-72 border-l border-border/70 bg-background/95 p-5 backdrop-blur-sm">
                <CallParticipantsList
                  onClose={() => setShowParticipants(false)}
                />
              </div>
            )}
          </div>

          {/* Bottom call controls */}
          <div className="absolute bottom-0 left-0 right-0 z-10">
            {/* Network stats bar */}
            <div className="flex justify-center gap-4 px-4 pb-1 text-xs text-foreground/75 drop-shadow-sm dark:text-white/70">
              <span>{Math.round(networkHealth.publisherLatency)}ms up</span>
              <span>{Math.round(networkHealth.subscriberLatency)}ms down</span>
              {networkHealth.packetLoss > 0 && (
                <span className="text-amber-600 dark:text-amber-400">
                  {networkHealth.packetLoss} lost
                </span>
              )}
            </div>

            <div className="bg-gradient-to-t from-background/95 via-background/55 to-transparent pb-4 pt-6 dark:from-black/70 dark:via-black/35">
              <div className="flex items-center justify-center gap-2 flex-wrap px-4">
                {canSendAudio ? (
                  <SpeakingWhileMutedNotification>
                    <ToggleAudioPublishingButton />
                  </SpeakingWhileMutedNotification>
                ) : null}
                {canSendVideo ? <ToggleVideoPublishingButton /> : null}
                {canCreateReaction ? <ReactionsButton /> : null}
                {canScreenshare ? <ScreenShareButton /> : null}
                {isHost && canRecordCall ? <RecordCallButton /> : null}
                <CancelCallButton onLeave={() => router.push("/")} />

                {/* Layout picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-10 rounded-full border-slate-200 bg-white text-slate-800 shadow-sm backdrop-blur hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20">
                      <LayoutListIcon className="size-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setLayout("grid")}>
                      Grid View
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setLayout("speaker")}>
                      Speaker View
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* Participants */}
                <Button
                  variant="outline"
                  size="icon"
                  className="size-10 rounded-full border-slate-200 bg-white text-slate-800 shadow-sm backdrop-blur hover:bg-slate-100 dark:border-white/15 dark:bg-white/10 dark:text-white dark:hover:bg-white/20"
                  onClick={() => setShowParticipants((p) => !p)}>
                  <UsersIcon className="size-4" />
                </Button>

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
