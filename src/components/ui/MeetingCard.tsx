import useMeetingActions from "@/hooks/useMeetingActions";
import { Doc } from "../../../convex/_generated/dataModel";
import {
  formatInterviewDateTime,
  getCalendarLinks,
  getInterviewStatusBadgeVariant,
  getInterviewStatusLabel,
  getMeetingStatus,
} from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { CalendarIcon, ExternalLinkIcon } from "lucide-react";
import { Badge } from "./badge";
import { Button } from "./button";

type Interview = Doc<"interviews">;

function MeetingCard({ interview }: { interview: Interview }) {
  const { joinMeeting } = useMeetingActions();

  const status = getMeetingStatus(interview);
  const formattedDate = formatInterviewDateTime(interview);
  const calendarLinks = getCalendarLinks(interview);
  const canJoin = status === "live";
  const showCalendarLinks =
    status === "scheduled" || status === "rescheduled" || status === "draft";

  return (
    <Card>
      <CardHeader className="space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <CalendarIcon className="h-4 w-4" />
            {formattedDate}
          </div>

          <Badge
            variant={getInterviewStatusBadgeVariant(status)}>
            {getInterviewStatusLabel(status)}
          </Badge>
        </div>

        <CardTitle>{interview.title}</CardTitle>

        <div className="space-y-1 text-sm text-muted-foreground">
          <p>
            {interview.templateLabel} · {interview.durationMinutes} minutes
          </p>
          <p>
            {interview.timezone}
            {interview.brandName ? ` · ${interview.brandName}` : ""}
          </p>
        </div>

        {interview.description && (
          <CardDescription className="line-clamp-2">
            {interview.description}
          </CardDescription>
        )}
      </CardHeader>

      <CardContent>
        {canJoin && (
          <Button
            className="w-full"
            onClick={() => joinMeeting(interview.streamCallId)}>
            Join Meeting
          </Button>
        )}

        {(status === "scheduled" || status === "rescheduled" || status === "draft") && (
          <Button variant="outline" className="w-full" disabled>
            {status === "draft" ? "Draft Interview" : "Waiting to Start"}
          </Button>
        )}

        {showCalendarLinks ? (
          <div className="mt-3 flex gap-2">
            <Button variant="outline" className="flex-1" asChild>
              <a
                href={calendarLinks.google}
                target="_blank"
                rel="noreferrer">
                Google Calendar
              </a>
            </Button>
            <Button variant="outline" className="flex-1" asChild>
              <a
                href={calendarLinks.outlook}
                target="_blank"
                rel="noreferrer">
                Outlook
                <ExternalLinkIcon className="ml-2 h-4 w-4" />
              </a>
            </Button>
          </div>
        ) : null}

        {interview.cancellationReason ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Cancellation reason: {interview.cancellationReason}
          </p>
        ) : null}

        {interview.rescheduleReason ? (
          <p className="mt-3 text-sm text-muted-foreground">
            Reschedule note: {interview.rescheduleReason}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
export default MeetingCard;
