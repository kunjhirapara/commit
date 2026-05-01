"use client";

import { toast } from "sonner";
import { format } from "date-fns";
import { calculateRecordingDuration } from "@/lib/utils";
import { CalendarIcon, ClockIcon, CopyIcon, PlayIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "./button";
import { Card, CardContent, CardFooter, CardHeader } from "./card";
import { AuthorizedRecording } from "@/actions/stream.actions";
import { Skeleton } from "./skeleton";

function RecordingCard({ recording }: { recording: AuthorizedRecording }) {
  const [isPlaying, setIsPlaying] = useState(false);

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(recording.url);
      toast.success("Recording link copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy link to clipboard");
    }
  };

  const formattedStartTime = recording.startTime
    ? format(new Date(recording.startTime), "MMM d, yyyy, hh:mm a")
    : "Unknown";

  const duration =
    recording.startTime && recording.endTime
      ? calculateRecordingDuration(recording.startTime, recording.endTime)
      : "Unknown duration";
  const recordingTitle =
    recording.title?.trim() || recording.filename || recording.streamCallId;

  return (
    <Card className="group hover:shadow-md transition-all">
      <CardHeader className="space-y-1">
        <div className="space-y-2">
          <p className="font-medium">{recordingTitle}</p>
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center text-sm text-muted-foreground gap-2">
              <CalendarIcon className="h-3.5 w-3.5" />
              <span>{formattedStartTime}</span>
            </div>
            <div className="flex items-center text-sm text-muted-foreground gap-2">
              <ClockIcon className="h-3.5 w-3.5" />
              <span>{duration}</span>
            </div>
            {recording.retentionExpiresAt ? (
              <p className="text-xs text-muted-foreground">
                Retained until{" "}
                {format(new Date(recording.retentionExpiresAt), "MMM d, yyyy")}
              </p>
            ) : null}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        <div
          className="w-full aspect-video bg-muted/50 rounded-lg flex items-center justify-center cursor-pointer group relative overflow-hidden"
          onClick={() => !isPlaying && setIsPlaying(true)}>
          {isPlaying ? (
            <video
              src={recording.url}
              controls
              autoPlay
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="size-12 rounded-full bg-background/90 flex items-center justify-center group-hover:bg-primary transition-colors">
              <PlayIcon className="size-6 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
            </div>
          )}
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Button className="flex-1" onClick={() => setIsPlaying(!isPlaying)}>
          <PlayIcon className="size-4 mr-2" />
          {isPlaying ? "Stop Playing" : "Play Recording"}
        </Button>
        <Button variant="secondary" onClick={handleCopyLink}>
          <CopyIcon className="size-4" />
        </Button>
      </CardFooter>
    </Card>
  );
}

export function RecordingCardSkeleton() {
  return (
    <Card className="group hover:shadow-md transition-all">
      <CardHeader className="space-y-1">
        <div className="space-y-2">
          <Skeleton className="h-5 w-3/4" />
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <Skeleton className="h-4 w-36" />
            </div>
            <div className="flex items-center gap-2">
              <ClockIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <Skeleton className="h-4 w-24" />
            </div>
            <Skeleton className="mt-1 h-3 w-28" />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-lg border bg-muted/30">
          <Skeleton className="absolute inset-0 h-full w-full rounded-none" />
          <Skeleton className="relative z-10 size-12 rounded-full bg-background/90" />
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <Skeleton className="h-9 flex-1 rounded-md" />
        <Skeleton className="h-9 w-9 rounded-md" />
      </CardFooter>
    </Card>
  );
}

export default RecordingCard;
