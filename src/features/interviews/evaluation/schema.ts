import { z } from "zod";
import {
  DEFAULT_COMPETENCIES,
  FEEDBACK_DECISIONS,
  NOTE_VISIBILITY,
} from "./constants";

export const feedbackSchema = z.object({
  recommendation: z.enum(FEEDBACK_DECISIONS),
  feedbackVisibility: z.enum(NOTE_VISIBILITY),
  summary: z.string().min(5, "Summary must be at least 5 characters"),
  sharedNotes: z.string().optional(),
  privateNotes: z.string().optional(),
  decisionSummary: z.string().optional(),
  hideUntilSubmit: z.boolean(),
  competencies: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      weight: z.number(),
      score: z
        .number()
        .min(1, "Score must be between 1 and 5")
        .max(5, "Score must be between 1 and 5"),
      notes: z.string().optional(),
    }),
  ),
});

export type FeedbackFormValues = z.infer<typeof feedbackSchema>;

export const getDefaultFeedbackValues = (): FeedbackFormValues => ({
  recommendation: "review",
  feedbackVisibility: "shared",
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
});
