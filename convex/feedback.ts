import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  logAuditEvent,
  requireInterviewReviewAccess,
} from "./authz";
import { createServerError } from "./errorUtils";

const feedbackVisibilityValidator = v.union(
  v.literal("shared"),
  v.literal("private"),
);

const feedbackStateValidator = v.union(
  v.literal("draft"),
  v.literal("submitted"),
);

const decisionOutcomeValidator = v.union(
  v.literal("pass"),
  v.literal("reject"),
  v.literal("hold"),
  v.literal("review"),
);

const competencyValidator = v.object({
  key: v.string(),
  label: v.string(),
  score: v.number(),
  weight: v.number(),
  notes: v.optional(v.string()),
});

const FEEDBACK_REQUIRED_COMPETENCIES = 3;
const DEFAULT_FEEDBACK_DEADLINE_MS = 24 * 60 * 60 * 1000;

const clampScore = (score: number) => Math.max(1, Math.min(5, score));

const normalizeCompetencies = (
  competencies: {
    key: string;
    label: string;
    score: number;
    weight: number;
    notes?: string;
  }[],
) =>
  competencies.map((competency) => ({
    ...competency,
    score: clampScore(competency.score),
    weight: competency.weight > 0 ? competency.weight : 1,
  }));

const calculateScores = (
  competencies: {
    score: number;
    weight: number;
  }[],
) => {
  const totalWeight = competencies.reduce(
    (sum, competency) => sum + competency.weight,
    0,
  );

  const weightedScore = totalWeight
    ? Number(
        (
          competencies.reduce(
            (sum, competency) => sum + competency.score * competency.weight,
            0,
          ) / totalWeight
        ).toFixed(2),
      )
    : 0;

  const overallScore = competencies.length
    ? Number(
        (
          competencies.reduce((sum, competency) => sum + competency.score, 0) /
          competencies.length
        ).toFixed(2),
      )
    : 0;

  return { weightedScore, overallScore };
};

const buildFeedbackPayload = (
  interview: {
    templateLabel?: string;
    scheduledEndTime?: number;
    endTime?: number;
    startTime: number;
  },
  args: {
    state: "draft" | "submitted";
    visibility: "shared" | "private";
    recommendation: "pass" | "reject" | "hold" | "review";
    summary: string;
    sharedNotes?: string;
    privateNotes?: string;
    decisionSummary?: string;
    competencies: {
      key: string;
      label: string;
      score: number;
      weight: number;
      notes?: string;
    }[];
    hideUntilSubmit: boolean;
  },
) => {
  const competencies = normalizeCompetencies(args.competencies);
  const { weightedScore, overallScore } = calculateScores(competencies);
  const dueAt =
    (interview.scheduledEndTime ?? interview.endTime ?? interview.startTime) +
    DEFAULT_FEEDBACK_DEADLINE_MS;

  return {
    state: args.state,
    visibility: args.visibility,
    recommendation: args.recommendation,
    summary: args.summary.trim(),
    sharedNotes: args.sharedNotes?.trim() || undefined,
    privateNotes: args.privateNotes?.trim() || undefined,
    decisionSummary: args.decisionSummary?.trim() || undefined,
    weightedScore,
    overallScore,
    roundType: interview.templateLabel,
    competencies,
    hideUntilSubmit: args.hideUntilSubmit,
    dueAt,
    updatedAt: Date.now(),
  };
};

const assertValidSubmission = (
  feedback: ReturnType<typeof buildFeedbackPayload>,
) => {
  if (!feedback.summary) {
    throw createServerError(
      new Error("Feedback summary missing"),
      "A summary is required before submission.",
    );
  }

  if (feedback.competencies.length < FEEDBACK_REQUIRED_COMPETENCIES) {
    throw createServerError(
      new Error("Insufficient competencies supplied"),
      "Please score at least three competencies before submitting.",
    );
  }

  if (feedback.visibility === "shared" && !feedback.sharedNotes) {
    throw createServerError(
      new Error("Shared notes missing for shared feedback"),
      "Shared feedback requires interview notes.",
    );
  }
};

export const saveFeedback = mutation({
  args: {
    interviewId: v.id("interviews"),
    state: feedbackStateValidator,
    visibility: feedbackVisibilityValidator,
    recommendation: decisionOutcomeValidator,
    summary: v.string(),
    sharedNotes: v.optional(v.string()),
    privateNotes: v.optional(v.string()),
    decisionSummary: v.optional(v.string()),
    competencies: v.array(competencyValidator),
    hideUntilSubmit: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user, interview } = await requireInterviewReviewAccess(
      ctx,
      args.interviewId,
    );

    const existingFeedback = await ctx.db
      .query("feedback")
      .withIndex("by_interview_id_interviewer_id", (q) =>
        q.eq("interviewId", args.interviewId).eq("interviewerId", user.clerkId),
      )
      .first();

    const feedbackPayload = buildFeedbackPayload(interview, args);

    if (args.state === "submitted") {
      assertValidSubmission(feedbackPayload);
    }

    const nextPayload = {
      interviewId: args.interviewId,
      interviewerId: user.clerkId,
      ...feedbackPayload,
      submittedAt:
        args.state === "submitted"
          ? existingFeedback?.submittedAt ?? Date.now()
          : existingFeedback?.submittedAt,
      editedAt: existingFeedback ? Date.now() : undefined,
    };

    let feedbackId = existingFeedback?._id;

    if (existingFeedback) {
      await ctx.db.patch(existingFeedback._id, nextPayload);
    } else {
      feedbackId = await ctx.db.insert("feedback", nextPayload);
    }

    await logAuditEvent(ctx, {
      action:
        args.state === "submitted"
          ? "feedback.submitted"
          : "feedback.saved_draft",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "feedback",
      targetId: feedbackId,
      metadata: {
        interviewId: args.interviewId,
        visibility: args.visibility,
        recommendation: args.recommendation,
        weightedScore: feedbackPayload.weightedScore,
      },
    });

    return feedbackId;
  },
});

export const getInterviewFeedback = query({
  args: {
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInterviewReviewAccess(ctx, args.interviewId);
    const feedbackEntries = await ctx.db
      .query("feedback")
      .withIndex("by_interview_id", (q) => q.eq("interviewId", args.interviewId))
      .collect();

    const myFeedback = feedbackEntries.find(
      (entry) => entry.interviewerId === user.clerkId,
    );
    const canSeeSubmittedFeedback =
      user.role === "admin" ||
      user.role === "recruiter" ||
      myFeedback?.state === "submitted";

    return feedbackEntries
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((entry) => {
        const isOwnFeedback = entry.interviewerId === user.clerkId;
        const isHidden =
          !isOwnFeedback &&
          entry.state === "submitted" &&
          entry.hideUntilSubmit &&
          !canSeeSubmittedFeedback;

        if (!isHidden) return entry;

        return {
          _id: entry._id,
          _creationTime: entry._creationTime,
          interviewId: entry.interviewId,
          interviewerId: entry.interviewerId,
          state: entry.state,
          visibility: entry.visibility,
          roundType: entry.roundType,
          recommendation: entry.recommendation,
          summary: "Hidden until you submit your own feedback.",
          sharedNotes: undefined,
          privateNotes: undefined,
          decisionSummary: undefined,
          weightedScore: entry.weightedScore,
          overallScore: entry.overallScore,
          hideUntilSubmit: entry.hideUntilSubmit,
          competencies: [],
          dueAt: entry.dueAt,
          submittedAt: entry.submittedAt,
          updatedAt: entry.updatedAt,
          editedAt: entry.editedAt,
          hiddenUntilSubmit: true,
        };
      });
  },
});

export const getMyFeedback = query({
  args: {
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInterviewReviewAccess(ctx, args.interviewId);
    return await ctx.db
      .query("feedback")
      .withIndex("by_interview_id_interviewer_id", (q) =>
        q.eq("interviewId", args.interviewId).eq("interviewerId", user.clerkId),
      )
      .first();
  },
});

export const exportHiringPacket = query({
  args: {
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    const { interview } = await requireInterviewReviewAccess(ctx, args.interviewId);
    const feedbackEntries = await ctx.db
      .query("feedback")
      .withIndex("by_interview_id", (q) => q.eq("interviewId", args.interviewId))
      .collect();
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_interview_id", (q) => q.eq("interviewId", args.interviewId))
      .collect();
    const sessionEvents = await ctx.db
      .query("interviewSessionEvents")
      .withIndex("by_interview_id", (q) => q.eq("interviewId", args.interviewId))
      .order("desc")
      .take(50);

    return {
      interview,
      feedback: feedbackEntries,
      notes: comments,
      sessionEvents,
      exportedAt: Date.now(),
    };
  },
});
