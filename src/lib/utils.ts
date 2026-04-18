import { clsx, type ClassValue } from "clsx";
import {
  addHours,
  format,
  intervalToDuration,
  isBefore,
  isWithinInterval,
} from "date-fns";
import { twMerge } from "tailwind-merge";
import { Doc } from "../../convex/_generated/dataModel";
import { INTERVIEW_STATUS_LABELS } from "@/constants";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

type Interview = Doc<"interviews">;
type User = Doc<"users">;
export type DisplayInterviewStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled"
  | "passed"
  | "rejected";

const DEFAULT_INTERVIEW_DURATION_MS = 60 * 60 * 1000;

export const getInterviewStartTimeMs = (interview: Interview) =>
  interview.scheduledStartTime ?? interview.startTime;

export const getInterviewEndTimeMs = (interview: Interview) =>
  interview.scheduledEndTime ??
  interview.endTime ??
  getInterviewStartTimeMs(interview) + DEFAULT_INTERVIEW_DURATION_MS;

export const getInterviewTimezone = (interview: Interview) =>
  interview.timezone ?? "UTC";

export const normalizeInterviewStatus = (
  status: Interview["status"],
): DisplayInterviewStatus => {
  if (status === "upcoming") return "scheduled";
  if (status === "succeeded") return "passed";
  if (status === "failed") return "rejected";

  return status;
};

export const groupInterviews = (interviews: Interview[]) => {
  if (!interviews) return {};

  return interviews.reduce(
    (acc: { [key: string]: Interview[] }, interview: Interview) => {
      acc.draft = acc.draft || [];
      acc.scheduled = acc.scheduled || [];
      acc.rescheduled = acc.rescheduled || [];
      acc.live = acc.live || [];
      acc.completed = acc.completed || [];
      acc.passed = acc.passed || [];
      acc.rejected = acc.rejected || [];
      acc.cancelled = acc.cancelled || [];
      acc.no_show = acc.no_show || [];

      acc[interview.status] = acc[interview.status] || [];
      acc[interview.status].push(interview);

      return acc;
    },
    {},
  );
};

export const getCandidateInfo = (users: User[], candidateId: string) => {
  const candidate = users?.find((user) => user.clerkId === candidateId);
  return {
    name: candidate?.name || "Unknown Candidate",
    image: candidate?.image || "",
    initials:
      candidate?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("") || "UC",
  };
};

export const getInterviewerInfo = (users: User[], interviewerId: string) => {
  const interviewer = users?.find((user) => user.clerkId === interviewerId);
  return {
    name: interviewer?.name || "Unknown Interviewer",
    image: interviewer?.image,
    initials:
      interviewer?.name
        ?.split(" ")
        .map((n) => n[0])
        .join("") || "UI",
  };
};

export const calculateRecordingDuration = (
  startTime: string,
  endTime: string,
) => {
  const start = new Date(startTime);
  const end = new Date(endTime);

  const duration = intervalToDuration({ start, end });

  if (duration.hours && duration.hours > 0) {
    return `${duration.hours}:${String(duration.minutes).padStart(2, "0")}:${String(
      duration.seconds,
    ).padStart(2, "0")}`;
  }

  if (duration.minutes && duration.minutes > 0) {
    return `${duration.minutes}:${String(duration.seconds).padStart(2, "0")}`;
  }

  return `${duration.seconds} seconds`;
};

export const getMeetingStatus = (interview: Interview): DisplayInterviewStatus => {
  const now = new Date();
  const startTime = getInterviewStartTimeMs(interview);
  const endTime = getInterviewEndTimeMs(interview);
  const normalizedStatus = normalizeInterviewStatus(interview.status);

  if (normalizedStatus === "draft") {
    return "draft";
  }

  if (
    normalizedStatus === "completed" ||
    normalizedStatus === "cancelled" ||
    normalizedStatus === "no_show" ||
    normalizedStatus === "passed" ||
    normalizedStatus === "rejected"
  ) {
    return normalizedStatus;
  }

  if (
    isWithinInterval(now, {
      start: new Date(startTime),
      end: new Date(endTime),
    })
  ) {
    return "live";
  }

  if (isBefore(now, new Date(startTime))) {
    return normalizedStatus === "rescheduled" ? "rescheduled" : "scheduled";
  }

  return "no_show";
};

export const getInterviewStatusBadgeVariant = (
  status: DisplayInterviewStatus,
) => {
  if (status === "live" || status === "passed") return "default";
  if (status === "scheduled" || status === "draft") return "outline";
  if (status === "rescheduled" || status === "completed") return "secondary";
  if (status === "cancelled") return "outline";

  return "destructive";
};

export const getInterviewStatusLabel = (
  status: DisplayInterviewStatus,
) => INTERVIEW_STATUS_LABELS[status] ?? status;

export const formatInterviewDateTime = (interview: Interview) =>
  format(new Date(getInterviewStartTimeMs(interview)), "EEEE, MMMM d · h:mm a");

const formatCalendarDate = (timestamp: number) =>
  new Date(timestamp).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

export const getCalendarLinks = (interview: Interview) => {
  const title = encodeURIComponent(interview.title);
  const description = encodeURIComponent(
    [interview.description, interview.meetingInstructions]
      .filter(Boolean)
      .join("\n\n"),
  );
  const startTime = getInterviewStartTimeMs(interview);
  const endTime = getInterviewEndTimeMs(interview);
  const start = formatCalendarDate(startTime);
  const end = formatCalendarDate(endTime);
  const details = `${start}/${end}`;

  return {
    google: `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${details}&details=${description}`,
    outlook: `https://outlook.office.com/calendar/0/deeplink/compose?subject=${title}&startdt=${encodeURIComponent(
      new Date(startTime).toISOString(),
    )}&enddt=${encodeURIComponent(
      new Date(endTime).toISOString(),
    )}&body=${description}`,
  };
};
