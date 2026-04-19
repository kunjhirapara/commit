import {
  CallControls,
  CallingState,
  CallParticipantsList,
  PaginatedGridLayout,
  SpeakerLayout,
  useCall,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import {
  AlertTriangleIcon,
  Clock3Icon,
  LayoutListIcon,
  LoaderIcon,
  MicOffIcon,
  RadioIcon,
  ShieldAlertIcon,
  Speaker,
  UsersIcon,
  VideoOffIcon,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
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
import EndCallButton from "./EndCallButton";
import CodeEditor from "./CodeEditor";
import { Badge } from "./badge";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { ScrollArea, ScrollBar } from "./scroll-area";
import { cn, getInterviewEndTimeMs } from "@/lib/utils";
import { getDisplayErrorMessage, logError } from "@/lib/errors";

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

  const logSessionEvent = useMutation(api.sessionEvents.logSessionEvent);
  const sessionEvents = useQuery(
    api.sessionEvents.getSessionEvents,
    interview ? { interviewId: interview._id } : "skip",
  );

  const {
    useCallCallingState,
    useCallStatsReport,
    useCallMembers,
    useParticipants,
    useLocalParticipant,
    useIsCallRecordingInProgress,
  } = useCallStateHooks();

  const callingState = useCallCallingState();
  const statsReport = useCallStatsReport();
  const members = useCallMembers();
  const participants = useParticipants();
  const localParticipant = useLocalParticipant();
  const isRecording = useIsCallRecordingInProgress();

  const previousParticipantIdsRef = useRef<string[]>([]);
  const previousCallingStateRef = useRef<CallingState | null>(null);

  const remoteParticipants = participants.filter(
    (participant) => !participant.isLocalParticipant,
  );

  const isMeetingOwner = localParticipant?.userId === call?.state.createdBy?.id;
  const scheduledEndTime = interview ? getInterviewEndTimeMs(interview) : null;
  const isPastScheduledEnd =
    scheduledEndTime !== null ? Date.now() > scheduledEndTime : false;

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

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (!interview) return;

    const nextEventType = isOnline ? "session.online" : "session.offline";
    void logSessionEvent({
      interviewId: interview._id,
      streamCallId: interview.streamCallId,
      type: nextEventType,
      detail: isOnline ? "Browser network restored" : "Browser network lost",
      metadata: JSON.stringify({ online: isOnline }),
    }).catch((error) => {
      logError("MeetingRoom.networkEvent", error, {
        interviewId: interview._id,
        online: isOnline,
      });
    });
  }, [interview, isOnline, logSessionEvent]);

  useEffect(() => {
    if (!interview) return;
    if (previousCallingStateRef.current === callingState) return;
    previousCallingStateRef.current = callingState;

    const mappedDetail = CONNECTION_STATE_COPY[callingState];
    if (!mappedDetail) return;

    void logSessionEvent({
      interviewId: interview._id,
      streamCallId: interview.streamCallId,
      type: `session.${String(callingState).toLowerCase()}`,
      detail: mappedDetail,
      metadata: JSON.stringify({
        state: callingState,
      }),
    }).catch((error) => {
      logError("MeetingRoom.callingStateEvent", error, {
        interviewId: interview._id,
        callingState,
      });
    });
  }, [callingState, interview, logSessionEvent]);

  useEffect(() => {
    if (!interview) return;

    const currentParticipantIds = participants
      .map((participant) => participant.userId)
      .filter(Boolean) as string[];
    const previousParticipantIds = previousParticipantIdsRef.current;

    const joined = currentParticipantIds.filter(
      (participantId) => !previousParticipantIds.includes(participantId),
    );
    const left = previousParticipantIds.filter(
      (participantId) => !currentParticipantIds.includes(participantId),
    );

    previousParticipantIdsRef.current = currentParticipantIds;

    joined.forEach((participantId) => {
      void logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: "participant.joined",
        detail: participantId,
        metadata: JSON.stringify({ participantId }),
      }).catch(() => undefined);
    });

    left.forEach((participantId) => {
      void logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: "participant.left",
        detail: participantId,
        metadata: JSON.stringify({ participantId }),
      }).catch(() => undefined);
    });
  }, [interview, logSessionEvent, participants]);

  if (callingState !== CallingState.JOINED)
    return (
      <div className="h-96 flex items-center justify-center">
        <LoaderIcon className="size-6 animate-spin" />
      </div>
    );

  const handleMuteAll = async () => {
    if (!call || !interview) return;

    setHostActionLoading("mute");

    try {
      await (call as any).muteAllUsers?.("audio");
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
        await (call as any).stopRecording?.();
      } else {
        await (call as any).startRecording?.();
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

  const handleRemoveParticipant = async (participantId: string) => {
    if (!call || !interview) return;

    setHostActionLoading("remove");

    try {
      await (call as any).blockUser?.(participantId);
      await logSessionEvent({
        interviewId: interview._id,
        streamCallId: interview.streamCallId,
        type: "host.removed_participant",
        detail: participantId,
        metadata: JSON.stringify({ participantId }),
      });
      toast.success("Participant removed from the session.");
    } catch (error) {
      logError("MeetingRoom.handleRemoveParticipant", error, {
        interviewId: interview._id,
        participantId,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to remove participant."),
      );
    } finally {
      setHostActionLoading(null);
    }
  };

  return (
    <div className="h-[calc(100vh-4rem-1px)]">
      <ResizablePanelGroup orientation="horizontal">
        <ResizablePanel defaultSize={62} minSize={40} className="relative">
          <div className="absolute inset-0">
            <div className="absolute left-4 right-4 top-4 z-20 space-y-3">
              {!isOnline || networkHealth.isDegraded ? (
                <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-950 shadow-sm">
                  <div className="flex items-start gap-3">
                    <AlertTriangleIcon className="mt-0.5 h-5 w-5" />
                    <div className="space-y-1">
                      <p className="font-medium">
                        {isOnline
                          ? "Call quality is degraded"
                          : "You are offline right now"}
                      </p>
                      <p className="text-sm text-amber-900/80">
                        Switch to speaker view, turn off video if needed, and keep the coding panel active while connection stabilizes.
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      className="ml-auto"
                      onClick={() => setLayout("speaker")}>
                      Degraded Mode
                    </Button>
                  </div>
                </div>
              ) : null}

              {isPastScheduledEnd ? (
                <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-950 shadow-sm">
                  <div className="flex items-start gap-3">
                    <Clock3Icon className="mt-0.5 h-5 w-5" />
                    <div>
                      <p className="font-medium">Session has passed its scheduled end time</p>
                      <p className="text-sm text-blue-900/80">
                        Wrap up, extend deliberately, or end the session to keep interview status accurate.
                      </p>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {layout === "grid" ? <PaginatedGridLayout /> : <SpeakerLayout />}
            {showParticipants && (
              <div className="absolute right-0 top-0 h-full w-[300px] bg-background/95 backdrop-blur-sm supports-backdrop-filter:bg-background/60">
                <CallParticipantsList onClose={() => setShowParticipants(false)} />
              </div>
            )}
          </div>

          <div className="absolute bottom-4 left-0 right-0">
            <div className="flex flex-col items-center gap-4">
              <div className="flex items-center gap-2 flex-wrap justify-center px-4">
                <CallControls onLeave={() => router.push("/")} />
                <div className="flex items-center gap-2">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="icon" className="size-10">
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
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10"
                    onClick={() => setShowParticipants((prev) => !prev)}>
                    <UsersIcon className="size-4" />
                  </Button>
                  <EndCallButton interview={interview} />
                </div>
              </div>
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={38} minSize={25}>
          <div className="grid h-full gap-4 p-4 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="min-h-0 rounded-xl border">
              <CodeEditor />
            </div>

            <div className="grid min-h-0 gap-4">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Call Reliability</span>
                    <Badge
                      variant={networkHealth.isDegraded ? "destructive" : "secondary"}>
                      {networkHealth.isDegraded ? "Degraded" : "Healthy"}
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Publisher RTT</p>
                    <p className="mt-1 text-lg font-semibold">
                      {Math.round(networkHealth.publisherLatency)} ms
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Subscriber RTT</p>
                    <p className="mt-1 text-lg font-semibold">
                      {Math.round(networkHealth.subscriberLatency)} ms
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Packet loss</p>
                    <p className="mt-1 text-lg font-semibold">
                      {networkHealth.packetLoss}
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-muted-foreground">Jitter</p>
                    <p className="mt-1 text-lg font-semibold">
                      {Math.round(networkHealth.jitter)} ms
                    </p>
                  </div>
                </CardContent>
              </Card>

              {isMeetingOwner ? (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ShieldAlertIcon className="h-4 w-4" />
                      Host Controls
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        variant="outline"
                        onClick={handleMuteAll}
                        disabled={hostActionLoading !== null}>
                        <MicOffIcon className="mr-2 h-4 w-4" />
                        Mute All
                      </Button>
                      <Button
                        variant="outline"
                        onClick={handleToggleRecording}
                        disabled={hostActionLoading !== null}>
                        <RadioIcon className="mr-2 h-4 w-4" />
                        {isRecording ? "Stop Recording" : "Start Recording"}
                      </Button>
                    </div>

                    <div className="space-y-2">
                      <p className="text-sm font-medium">Participants</p>
                      <ScrollArea className="h-32 rounded-lg border">
                        <div className="space-y-2 p-3">
                          {remoteParticipants.length ? (
                            remoteParticipants.map((participant) => (
                              <div
                                key={participant.sessionId}
                                className="flex items-center justify-between gap-3 rounded-lg border p-2">
                                <div>
                                  <p className="text-sm font-medium">
                                    {participant.name || participant.userId}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {participant.userId}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() =>
                                    participant.userId &&
                                    handleRemoveParticipant(participant.userId)
                                  }
                                  disabled={
                                    hostActionLoading !== null || !participant.userId
                                  }>
                                  <VideoOffIcon className="mr-2 h-4 w-4" />
                                  Remove
                                </Button>
                              </div>
                            ))
                          ) : (
                            <p className="text-sm text-muted-foreground">
                              No remote participants in the room.
                            </p>
                          )}
                        </div>
                        <ScrollBar orientation="vertical" />
                      </ScrollArea>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              <Card className="min-h-0">
                <CardHeader className="pb-3">
                  <CardTitle className="flex items-center justify-between text-base">
                    <span>Recent Session Events</span>
                    <Badge variant="outline">{members.length} members</Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="min-h-0">
                  <ScrollArea className="h-56 rounded-lg border">
                    <div className="space-y-2 p-3">
                      {sessionEvents?.length ? (
                        sessionEvents.map((event) => (
                          <div
                            key={event._id}
                            className={cn(
                              "rounded-lg border p-3 text-sm",
                              event.type.startsWith("session.offline") &&
                                "border-amber-300 bg-amber-50/70",
                            )}>
                            <div className="flex items-center justify-between gap-3">
                              <p className="font-medium">{event.type}</p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(event.createdAt).toLocaleTimeString()}
                              </p>
                            </div>
                            <p className="mt-1 text-muted-foreground">
                              {event.detail ?? "No additional details"}
                            </p>
                          </div>
                        ))
                      ) : (
                        <p className="p-3 text-sm text-muted-foreground">
                          Session activity will appear here as participants join, reconnect, or host actions are taken.
                        </p>
                      )}
                    </div>
                    <ScrollBar orientation="vertical" />
                  </ScrollArea>
                </CardContent>
              </Card>
            </div>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}

export default MeetingRoom;
