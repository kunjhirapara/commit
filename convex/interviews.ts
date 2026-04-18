import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  canAccessInterview,
  getCurrentUserRecord,
  logAuditEvent,
  requireInterviewAccess,
  requireInterviewReviewAccess,
  requirePermission,
} from "./authz";
import { createServerError } from "./errorUtils";

const INTERVIEW_STATUSES = [
  "draft",
  "scheduled",
  "live",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
  "passed",
  "rejected",
  "upcoming",
  "succeeded",
  "failed",
] as const;

const interviewStatusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("live"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
  v.literal("rescheduled"),
  v.literal("passed"),
  v.literal("rejected"),
  v.literal("upcoming"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const lifecycleEventValidator = v.object({
  type: v.string(),
  at: v.number(),
  actorClerkId: v.optional(v.string()),
  note: v.optional(v.string()),
});

type InterviewStatus = (typeof INTERVIEW_STATUSES)[number];
type CanonicalInterviewStatus =
  | "draft"
  | "scheduled"
  | "live"
  | "completed"
  | "cancelled"
  | "no_show"
  | "rescheduled"
  | "passed"
  | "rejected";

const TERMINAL_STATUSES: InterviewStatus[] = [
  "completed",
  "cancelled",
  "no_show",
  "passed",
  "rejected",
];

const REMINDER_WINDOW_MS = 30 * 60 * 1000;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_BUFFER_BEFORE_MINUTES = 15;
const DEFAULT_BUFFER_AFTER_MINUTES = 15;
const DEFAULT_TEMPLATE_ID = "technical";
const DEFAULT_TEMPLATE_LABEL = "Technical";

const normalizeStoredStatus = (
  status: InterviewStatus | string,
): CanonicalInterviewStatus => {
  switch (status) {
    case "upcoming":
      return "scheduled";
    case "succeeded":
      return "passed";
    case "failed":
      return "rejected";
    default:
      return status as CanonicalInterviewStatus;
  }
};

const normalizeInterview = (interview: any) => {
  const normalizedStatus = normalizeStoredStatus(interview.status);
  const scheduledStartTime = interview.scheduledStartTime ?? interview.startTime;
  const durationMinutes =
    interview.durationMinutes ??
    Math.max(
      DEFAULT_DURATION_MINUTES,
      Math.round(
        ((interview.endTime ?? scheduledStartTime + DEFAULT_DURATION_MINUTES * 60 * 1000) -
          scheduledStartTime) /
          (60 * 1000),
      ),
    );
  const scheduledEndTime =
    interview.scheduledEndTime ??
    interview.endTime ??
    scheduledStartTime + durationMinutes * 60 * 1000;

  return {
    ...interview,
    status: normalizedStatus,
    templateId: interview.templateId ?? DEFAULT_TEMPLATE_ID,
    templateLabel: interview.templateLabel ?? DEFAULT_TEMPLATE_LABEL,
    scheduledStartTime,
    scheduledEndTime,
    durationMinutes,
    timezone: interview.timezone ?? DEFAULT_TIMEZONE,
    bufferBeforeMinutes:
      interview.bufferBeforeMinutes ?? DEFAULT_BUFFER_BEFORE_MINUTES,
    bufferAfterMinutes:
      interview.bufferAfterMinutes ?? DEFAULT_BUFFER_AFTER_MINUTES,
    lifecycleEvents: interview.lifecycleEvents ?? [],
  };
};

const appendLifecycleEvent = (
  existingEvents: {
    type: string;
    at: number;
    actorClerkId?: string;
    note?: string;
  }[],
  event: {
    type: string;
    actorClerkId?: string;
    note?: string;
  },
) => [
  ...existingEvents,
  {
    type: event.type,
    at: Date.now(),
    actorClerkId: event.actorClerkId,
    note: event.note,
  },
];

const createNotificationPayload = ({
  recipientClerkId,
  interviewId,
  type,
  title,
  message,
  metadata,
  scheduledFor = Date.now(),
}: {
  recipientClerkId: string;
  interviewId?: string;
  type: string;
  title: string;
  message: string;
  metadata?: Record<string, unknown>;
  scheduledFor?: number;
}) => ({
  recipientClerkId,
  interviewId,
  type,
  title,
  message,
  status: "sent" as const,
  scheduledFor,
  sentAt: Date.now(),
  metadata: metadata ? JSON.stringify(metadata) : undefined,
});

const queueInterviewNotifications = async (
  ctx: any,
  args: {
    interviewId: string;
    candidateId: string;
    interviewerIds: string[];
    type: string;
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    scheduledFor?: number;
  },
) => {
  const recipients = [args.candidateId, ...args.interviewerIds];

  await Promise.all(
    recipients.map((recipientClerkId) =>
      ctx.db.insert(
        "notifications",
        createNotificationPayload({
          recipientClerkId,
          interviewId: args.interviewId,
          type: args.type,
          title: args.title,
          message: args.message,
          metadata: args.metadata,
          scheduledFor: args.scheduledFor,
        }),
      ),
    ),
  );
};

const validateInterviewStatus = (status: InterviewStatus) => {
  if (!INTERVIEW_STATUSES.includes(status)) {
    throw createServerError(
      new Error(`Unsupported interview status: ${status}`),
      "Invalid interview status.",
    );
  }
};

const ensureCandidate = async (ctx: any, candidateId: string) => {
  const candidate = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", candidateId))
    .first();

  if (!candidate || candidate.role !== "candidate") {
    throw createServerError(
      new Error(`Candidate not found or invalid: ${candidateId}`),
      "Please select a valid candidate.",
    );
  }

  return candidate;
};

const ensureInterviewers = async (ctx: any, interviewerIds: string[]) => {
  const interviewerUsers = await Promise.all(
    interviewerIds.map((interviewerId) =>
      ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", interviewerId))
        .first(),
    ),
  );

  if (
    interviewerUsers.some(
      (interviewer) =>
        !interviewer ||
        (interviewer.role !== "interviewer" &&
          interviewer.role !== "recruiter" &&
          interviewer.role !== "admin"),
    )
  ) {
    throw createServerError(
      new Error("One or more selected interviewers are invalid"),
      "Please select valid interviewers.",
    );
  }

  return interviewerUsers;
};

const assertNoConflicts = async (
  ctx: any,
  args: {
    interviewerIds: string[];
    scheduledStartTime: number;
    scheduledEndTime: number;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
    excludeInterviewId?: string;
  },
) => {
  const interviews = (await ctx.db.query("interviews").collect()).map(
    normalizeInterview,
  );

  const requestedStart =
    args.scheduledStartTime - args.bufferBeforeMinutes * 60 * 1000;
  const requestedEnd = args.scheduledEndTime + args.bufferAfterMinutes * 60 * 1000;

  const hasConflict = interviews.some((interview: any) => {
    if (args.excludeInterviewId && interview._id === args.excludeInterviewId) {
      return false;
    }

    if (TERMINAL_STATUSES.includes(interview.status)) return false;

    const sharesInterviewer = interview.interviewerIds.some((interviewerId: string) =>
      args.interviewerIds.includes(interviewerId),
    );

    if (!sharesInterviewer) return false;

    const interviewStart =
      interview.scheduledStartTime - interview.bufferBeforeMinutes * 60 * 1000;
    const interviewEnd =
      interview.scheduledEndTime + interview.bufferAfterMinutes * 60 * 1000;

    return requestedStart < interviewEnd && requestedEnd > interviewStart;
  });

  if (hasConflict) {
    throw createServerError(
      new Error("Conflicting interview detected for at least one interviewer"),
      "One or more interviewers already have a conflicting interview in that time window.",
    );
  }
};

const deriveLifecycleStatus = (
  interview: any,
  now = Date.now(),
): CanonicalInterviewStatus => {
  const normalizedInterview = normalizeInterview(interview);
  if (TERMINAL_STATUSES.includes(normalizedInterview.status)) {
    return normalizedInterview.status;
  }

  if (
    now >= normalizedInterview.scheduledStartTime &&
    now <= normalizedInterview.scheduledEndTime
  ) {
    return "live";
  }

  if (now > normalizedInterview.scheduledEndTime) {
    return normalizedInterview.status === "live" ? "completed" : "no_show";
  }

  return normalizedInterview.status === "rescheduled"
    ? "rescheduled"
    : "scheduled";
};

const syncInterviewLifecycle = async (ctx: any, interview: any) => {
  const normalizedInterview = normalizeInterview(interview);
  const nextStatus = deriveLifecycleStatus(normalizedInterview);

  if (nextStatus === normalizedInterview.status) {
    return normalizedInterview;
  }

  const patch: Record<string, unknown> = {
    status: nextStatus,
    lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
      type: `status.${nextStatus}`,
      note: "Automatically updated from lifecycle automation.",
    }),
  };

  if (nextStatus === "completed" || nextStatus === "no_show") {
    patch.endTime = Date.now();
  }

  await ctx.db.patch(normalizedInterview._id, patch);

  await logAuditEvent(ctx, {
    action: "interview.status_automated",
    targetType: "interview",
    targetId: normalizedInterview._id,
    metadata: {
      previousStatus: normalizedInterview.status,
      nextStatus,
    },
  });

  return {
    ...normalizedInterview,
    ...patch,
  };
};

const processReminder = async (ctx: any, interview: any) => {
  const normalizedInterview = normalizeInterview(interview);
  if (
    normalizedInterview.reminderSentAt ||
    TERMINAL_STATUSES.includes(normalizedInterview.status) ||
    normalizedInterview.scheduledStartTime - Date.now() > REMINDER_WINDOW_MS ||
    normalizedInterview.scheduledStartTime <= Date.now()
  ) {
    return;
  }

  await queueInterviewNotifications(ctx, {
    interviewId: normalizedInterview._id,
    candidateId: normalizedInterview.candidateId,
    interviewerIds: normalizedInterview.interviewerIds,
    type: "interview.reminder",
    title: `${normalizedInterview.title} starts soon`,
    message: `Your ${normalizedInterview.templateLabel.toLowerCase()} interview starts in less than 30 minutes.`,
    metadata: {
      startTime: normalizedInterview.scheduledStartTime,
      timezone: normalizedInterview.timezone,
    },
  });

  await ctx.db.patch(normalizedInterview._id, {
    reminderSentAt: Date.now(),
    lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
      type: "reminder.sent",
      note: "Automatic pre-interview reminder created.",
    }),
  });
};

export const getAllInterviews = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    const interviews = (await ctx.db.query("interviews").collect()).map(
      normalizeInterview,
    );

    return interviews.filter((interview: any) =>
      canAccessInterview(user, interview),
    );
  },
});

export const getMyInterviews = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    const interviews = (await ctx.db.query("interviews").collect()).map(
      normalizeInterview,
    );

    return interviews.filter((interview: any) =>
      canAccessInterview(user, interview),
    );
  },
});

export const getInterviewByStreamCallId = query({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const interview = await ctx.db
      .query("interviews")
      .withIndex("by_stream_call_id", (q: any) =>
        q.eq("streamCallId", args.streamCallId),
      )
      .first();
    const normalizedInterview = interview ? normalizeInterview(interview) : null;

    if (normalizedInterview && !canAccessInterview(user, normalizedInterview)) {
      throw createServerError(
        new Error(
          `User ${user.clerkId} cannot access interview ${normalizedInterview._id} by stream call id`,
        ),
        "You are not allowed to access this interview.",
      );
    }

    return normalizedInterview;
  },
});

export const createInterview = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    templateId: v.string(),
    templateLabel: v.string(),
    scheduledStartTime: v.number(),
    durationMinutes: v.number(),
    timezone: v.string(),
    status: interviewStatusValidator,
    streamCallId: v.string(),
    candidateId: v.string(),
    interviewerIds: v.array(v.string()),
    meetingInstructions: v.optional(v.string()),
    brandName: v.optional(v.string()),
    browserFallbackInstructions: v.optional(v.string()),
    bufferBeforeMinutes: v.number(),
    bufferAfterMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "scheduleInterviews");
    validateInterviewStatus(args.status);
    await ensureCandidate(ctx, args.candidateId);
    await ensureInterviewers(ctx, args.interviewerIds);

    const scheduledEndTime =
      args.scheduledStartTime + args.durationMinutes * 60 * 1000;

    await assertNoConflicts(ctx, {
      interviewerIds: args.interviewerIds,
      scheduledStartTime: args.scheduledStartTime,
      scheduledEndTime,
      bufferBeforeMinutes: args.bufferBeforeMinutes,
      bufferAfterMinutes: args.bufferAfterMinutes,
    });

    const interviewId = await ctx.db.insert("interviews", {
      ...args,
      startTime: args.scheduledStartTime,
      scheduledEndTime,
      reminderSentAt: undefined,
      lifecycleEvents: [
        {
          type: "created",
          at: Date.now(),
          actorClerkId: user.clerkId,
          note: "Interview created.",
        },
      ],
    });

    await queueInterviewNotifications(ctx, {
      interviewId,
      candidateId: args.candidateId,
      interviewerIds: args.interviewerIds,
      type: "interview.scheduled",
      title: `${args.templateLabel} interview scheduled`,
      message: `${args.title} has been scheduled.`,
      metadata: {
        startTime: args.scheduledStartTime,
        timezone: args.timezone,
      },
    });

    await logAuditEvent(ctx, {
      action: "interview.created",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: interviewId,
      metadata: {
        candidateId: args.candidateId,
        interviewerIds: args.interviewerIds,
        status: args.status,
        timezone: args.timezone,
      },
    });

    return interviewId;
  },
});

export const updateInterview = mutation({
  args: {
    interviewId: v.id("interviews"),
    title: v.string(),
    description: v.optional(v.string()),
    templateId: v.string(),
    templateLabel: v.string(),
    scheduledStartTime: v.number(),
    durationMinutes: v.number(),
    timezone: v.string(),
    candidateId: v.string(),
    interviewerIds: v.array(v.string()),
    meetingInstructions: v.optional(v.string()),
    brandName: v.optional(v.string()),
    browserFallbackInstructions: v.optional(v.string()),
    bufferBeforeMinutes: v.number(),
    bufferAfterMinutes: v.number(),
  },
  handler: async (ctx, args) => {
    const { user, interview } = await requireInterviewAccess(
      ctx,
      args.interviewId,
    );
    const normalizedInterview = normalizeInterview(interview);

    if (user.role !== "admin" && user.role !== "recruiter") {
      throw createServerError(
        new Error(`Role ${user.role} cannot edit interviews`),
        "You are not allowed to edit interviews.",
      );
    }

    await ensureCandidate(ctx, args.candidateId);
    await ensureInterviewers(ctx, args.interviewerIds);

    const scheduledEndTime =
      args.scheduledStartTime + args.durationMinutes * 60 * 1000;

    await assertNoConflicts(ctx, {
      interviewerIds: args.interviewerIds,
      scheduledStartTime: args.scheduledStartTime,
      scheduledEndTime,
      bufferBeforeMinutes: args.bufferBeforeMinutes,
      bufferAfterMinutes: args.bufferAfterMinutes,
      excludeInterviewId: args.interviewId,
    });

    await ctx.db.patch(args.interviewId, {
      ...args,
      startTime: args.scheduledStartTime,
      scheduledEndTime,
      lifecycleEvents: appendLifecycleEvent(interview.lifecycleEvents, {
        type: "updated",
        actorClerkId: user.clerkId,
        note: "Interview details updated.",
      }),
    });

    await logAuditEvent(ctx, {
      action: "interview.updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: args.interviewId,
      metadata: {
        previousCandidateId: normalizedInterview.candidateId,
        nextCandidateId: args.candidateId,
        timezone: args.timezone,
      },
    });
  },
});

export const rescheduleInterview = mutation({
  args: {
    interviewId: v.id("interviews"),
    scheduledStartTime: v.number(),
    timezone: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, interview } = await requireInterviewAccess(
      ctx,
      args.interviewId,
    );
    const normalizedInterview = normalizeInterview(interview);

    if (user.role !== "admin" && user.role !== "recruiter") {
      throw createServerError(
        new Error(`Role ${user.role} cannot reschedule interviews`),
        "You are not allowed to reschedule interviews.",
      );
    }

    const scheduledEndTime =
      args.scheduledStartTime + normalizedInterview.durationMinutes * 60 * 1000;

    await assertNoConflicts(ctx, {
      interviewerIds: normalizedInterview.interviewerIds,
      scheduledStartTime: args.scheduledStartTime,
      scheduledEndTime,
      bufferBeforeMinutes: normalizedInterview.bufferBeforeMinutes,
      bufferAfterMinutes: normalizedInterview.bufferAfterMinutes,
      excludeInterviewId: normalizedInterview._id,
    });

    await ctx.db.patch(args.interviewId, {
      status: "rescheduled",
      startTime: args.scheduledStartTime,
      scheduledStartTime: args.scheduledStartTime,
      scheduledEndTime,
      timezone: args.timezone,
      rescheduleReason: args.reason,
      reminderSentAt: undefined,
      lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
        type: "rescheduled",
        actorClerkId: user.clerkId,
        note: args.reason,
      }),
    });

    await queueInterviewNotifications(ctx, {
      interviewId: args.interviewId,
      candidateId: normalizedInterview.candidateId,
      interviewerIds: normalizedInterview.interviewerIds,
      type: "interview.rescheduled",
      title: `${normalizedInterview.title} was rescheduled`,
      message: `The interview has been moved to a new time in ${args.timezone}.`,
      metadata: {
        previousStartTime: normalizedInterview.scheduledStartTime,
        nextStartTime: args.scheduledStartTime,
        reason: args.reason,
      },
    });

    await logAuditEvent(ctx, {
      action: "interview.rescheduled",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: args.interviewId,
      metadata: {
        previousStartTime: normalizedInterview.scheduledStartTime,
        nextStartTime: args.scheduledStartTime,
        reason: args.reason,
      },
    });
  },
});

export const cancelInterview = mutation({
  args: {
    interviewId: v.id("interviews"),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "cancelInterviews");
    const interview = await ctx.db.get(args.interviewId);

    if (!interview) {
      throw createServerError(
        new Error(`Interview not found: ${args.interviewId}`),
        "Interview not found.",
      );
    }

    const normalizedInterview = normalizeInterview(interview);

    await ctx.db.patch(args.interviewId, {
      status: "cancelled",
      endTime: Date.now(),
      cancellationReason: args.reason,
      lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
        type: "cancelled",
        actorClerkId: user.clerkId,
        note: args.reason,
      }),
    });

    await queueInterviewNotifications(ctx, {
      interviewId: args.interviewId,
      candidateId: normalizedInterview.candidateId,
      interviewerIds: normalizedInterview.interviewerIds,
      type: "interview.cancelled",
      title: `${normalizedInterview.title} was cancelled`,
      message: args.reason
        ? `Interview cancelled: ${args.reason}`
        : "The interview has been cancelled.",
      metadata: {
        reason: args.reason,
      },
    });

    await logAuditEvent(ctx, {
      action: "interview.cancelled",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: args.interviewId,
      metadata: {
        previousStatus: normalizedInterview.status,
        reason: args.reason,
      },
    });
  },
});

export const updateInterviewStatus = mutation({
  args: {
    interviewId: v.id("interviews"),
    status: interviewStatusValidator,
  },
  handler: async (ctx, args) => {
    const { user, interview } = await requireInterviewReviewAccess(
      ctx,
      args.interviewId,
    );
    const normalizedInterview = normalizeInterview(interview);

    const result = await ctx.db.patch(args.interviewId, {
      status: normalizeStoredStatus(args.status),
      ...(TERMINAL_STATUSES.includes(normalizeStoredStatus(args.status))
        ? { endTime: Date.now() }
        : {}),
      lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
        type: `status.${normalizeStoredStatus(args.status)}`,
        actorClerkId: user.clerkId,
      }),
    });

    await logAuditEvent(ctx, {
      action: "interview.status_updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: args.interviewId,
      metadata: {
        previousStatus: normalizedInterview.status,
        nextStatus: normalizeStoredStatus(args.status),
      },
    });

    return result;
  },
});

export const runLifecycleAutomation = mutation({
  handler: async (ctx) => {
    await getCurrentUserRecord(ctx);
    const interviews = await ctx.db.query("interviews").collect();
    let updatedCount = 0;

    for (const interview of interviews) {
      const syncedInterview = await syncInterviewLifecycle(ctx, interview);
      await processReminder(ctx, syncedInterview);
      updatedCount += syncedInterview.status !== interview.status ? 1 : 0;
    }

    return { updatedCount };
  },
});
