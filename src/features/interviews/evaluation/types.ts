import type { Doc, Id } from "../../../../convex/_generated/dataModel";

export type FeedbackCompetencyForm = {
  key: string;
  label: string;
  weight: number;
  score: number;
  notes?: string;
};

export type NoteVisibility = "shared" | "private";

export type CommentEntry = Doc<"comments">;
export type UserEntry = Doc<"users">;

export type FeedbackEntry = {
  _id: Id<"feedback">;
  interviewerId: string;
  state: string;
  recommendation: string;
  summary: string;
  weightedScore: number;
  submittedAt?: number;
  hiddenUntilSubmit?: boolean;
};

export type MyFeedbackEntry = {
  state: "draft" | "submitted";
  recommendation: "pass" | "reject" | "hold" | "review";
  visibility: NoteVisibility;
  summary: string;
  sharedNotes?: string;
  privateNotes?: string;
  decisionSummary?: string;
  hideUntilSubmit: boolean;
  dueAt?: number;
  competencies: FeedbackCompetencyForm[];
};
