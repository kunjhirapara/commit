import type { Id } from "../../../../convex/_generated/dataModel";
import type { BULK_ACTIONS } from "./constants";

export type BulkActionValue = (typeof BULK_ACTIONS)[number]["value"];

export type OverrideStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled"
  | "passed"
  | "rejected"
  | "upcoming"
  | "succeeded"
  | "failed";

export type DashboardInterview = {
  _id: Id<"interviews">;
  candidateName: string;
  normalizedStatus: string;
  templateLabel: string;
  title: string;
  interviewerNames: string;
  startTime: number;
  feedbackCompletion: number;
};

export type DashboardAnalytics = {
  throughput: number;
  timeToHireDays: number;
  cancellations: number;
  noShows: number;
  feedbackPending: number;
  funnel: Array<{
    status?: string;
    count: number;
  }>;
};

export type InterviewerOption = {
  clerkId: string;
  name: string;
};
