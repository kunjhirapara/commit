import { format } from "date-fns";
import { StarIcon } from "lucide-react";
import { DEFAULT_COMPETENCIES } from "./constants";
import type { FeedbackCompetencyForm, MyFeedbackEntry } from "./types";

export const buildFeedbackFormValues = (myFeedback: MyFeedbackEntry | null) => {
  if (!myFeedback) {
    return {
      recommendation: "review" as const,
      feedbackVisibility: "shared" as const,
      summary: "",
      sharedNotes: "",
      privateNotes: "",
      decisionSummary: "",
      hideUntilSubmit: true,
      competencies: DEFAULT_COMPETENCIES.map((competency) => ({
        ...competency,
        score: 3,
        notes: "",
      })),
    };
  }

  return {
    recommendation: myFeedback.recommendation,
    feedbackVisibility: myFeedback.visibility,
    summary: myFeedback.summary,
    sharedNotes: myFeedback.sharedNotes ?? "",
    privateNotes: myFeedback.privateNotes ?? "",
    decisionSummary: myFeedback.decisionSummary ?? "",
    hideUntilSubmit: myFeedback.hideUntilSubmit,
    competencies: myFeedback.competencies.length
      ? myFeedback.competencies.map((competency) => ({
          key: competency.key,
          label: competency.label,
          weight: competency.weight,
          score: competency.score,
          notes: competency.notes ?? "",
        }))
      : DEFAULT_COMPETENCIES.map((competency) => ({
          ...competency,
          score: 3,
          notes: "",
        })),
  };
};

export const calculateAverageScore = (
  competencies?: FeedbackCompetencyForm[],
) => {
  if (!competencies?.length) return "0.00";

  const weightedTotal = competencies.reduce(
    (sum, competency) => sum + competency.score * competency.weight,
    0,
  );
  const totalWeight = competencies.reduce(
    (sum, competency) => sum + competency.weight,
    0,
  );

  return totalWeight ? (weightedTotal / totalWeight).toFixed(2) : "0.00";
};

export const formatInterviewTimestamp = (timestamp: number) =>
  format(timestamp, "MMM d, yyyy • h:mm a");

export const getCommentTimestampDetails = (
  updatedAt?: number,
  createdAt?: number,
) => {
  const commentTimestamp = updatedAt ?? createdAt ?? Date.now();
  const wasEdited = !!updatedAt && !!createdAt && updatedAt > createdAt;

  return { commentTimestamp, wasEdited };
};

export const renderStars = (value: number) => (
  <div className="flex gap-0.5">
    {[1, 2, 3, 4, 5].map((starValue) => (
      <StarIcon
        key={starValue}
        className={`h-4 w-4 ${starValue <= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
      />
    ))}
  </div>
);
