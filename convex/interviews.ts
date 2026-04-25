import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import {
  canAccessInterview,
  getCurrentUserRecord,
  logAuditEvent,
  requireRecordingAccess,
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
const FEEDBACK_REMINDER_DELAY_MS = 60 * 60 * 1000;
const DEFAULT_DURATION_MINUTES = 60;
const DEFAULT_TIMEZONE = "UTC";
const DEFAULT_BUFFER_BEFORE_MINUTES = 15;
const DEFAULT_BUFFER_AFTER_MINUTES = 15;
const DEFAULT_TEMPLATE_ID = "technical";
const DEFAULT_TEMPLATE_LABEL = "Technical";
const DEFAULT_RECORDING_RETENTION_DAYS = 30;
const DEFAULT_NOTES_RETENTION_DAYS = 180;
const DEFAULT_CANDIDATE_DATA_RETENTION_DAYS = 365;
const DEFAULT_RECORDING_DISCLOSURE =
  "This interview may be recorded for hiring review, training, and compliance purposes.";

const formatDateTimeForTimezone = (timestamp: number, timezone: string) =>
  new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: timezone,
  }).format(new Date(timestamp));

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
    feedbackReminderSentAt: interview.feedbackReminderSentAt,
    recordingConsentRequired: interview.recordingConsentRequired ?? true,
    complianceJurisdiction: interview.complianceJurisdiction ?? "global",
    recordingDisclosure:
      interview.recordingDisclosure ?? DEFAULT_RECORDING_DISCLOSURE,
    recordingRetentionDays:
      interview.recordingRetentionDays ?? DEFAULT_RECORDING_RETENTION_DAYS,
    notesRetentionDays:
      interview.notesRetentionDays ?? DEFAULT_NOTES_RETENTION_DAYS,
    candidateDataRetentionDays:
      interview.candidateDataRetentionDays ??
      DEFAULT_CANDIDATE_DATA_RETENTION_DAYS,
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

const queueInterviewNotifications = async (
  ctx: any,
  args: {
    interviewId: string;
    candidateId: string;
    interviewerIds: string[];
    type: string;
    category:
      | "interview_schedule"
      | "interview_update"
      | "interview_reminder"
      | "feedback_reminder";
    title: string;
    message: string;
    metadata?: Record<string, unknown>;
    scheduledFor?: number;
    timezone?: string;
  },
) => {
  const recipients = [args.candidateId, ...args.interviewerIds];

  await ctx.runMutation(internal.notifications.queueInterviewNotifications, {
    interviewId: args.interviewId,
    recipientClerkIds: recipients,
    type: args.type,
    category: args.category,
    title: args.title,
    message: args.message,
    scheduledFor: args.scheduledFor ?? Date.now(),
    timezone: args.timezone,
    metadata: args.metadata ? JSON.stringify(args.metadata) : undefined,
  });
};

const scheduleInterviewBackgroundWork = async (
  ctx: any,
  args: {
    interviewId: string;
    scheduledStartTime: number;
    scheduledEndTime: number;
    retentionDays: number;
  },
) => {
  const reminderRunAt = args.scheduledStartTime - REMINDER_WINDOW_MS;
  if (reminderRunAt > Date.now()) {
    await ctx.runMutation(internal.reliability.enqueueJob, {
      kind: "interview_reminder",
      runAt: reminderRunAt,
      maxAttempts: 3,
      payload: JSON.stringify({ interviewId: args.interviewId }),
      relatedId: args.interviewId,
    });
  }

  await ctx.runMutation(internal.reliability.enqueueJob, {
    kind: "interview_cleanup",
    runAt:
      args.scheduledEndTime + args.retentionDays * 24 * 60 * 60 * 1000,
    maxAttempts: 2,
    payload: JSON.stringify({
      interviewId: args.interviewId,
      retentionDays: args.retentionDays,
    }),
    relatedId: args.interviewId,
  });
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
    category: "interview_reminder",
    title: `${normalizedInterview.title} starts soon`,
    message: `Your ${normalizedInterview.templateLabel.toLowerCase()} interview starts at ${formatDateTimeForTimezone(
      normalizedInterview.scheduledStartTime,
      normalizedInterview.timezone,
    )} (${normalizedInterview.timezone}).`,
    metadata: {
      startTime: normalizedInterview.scheduledStartTime,
      timezone: normalizedInterview.timezone,
    },
    timezone: normalizedInterview.timezone,
  });

  await ctx.db.patch(normalizedInterview._id, {
    reminderSentAt: Date.now(),
    lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
      type: "reminder.sent",
      note: "Automatic pre-interview reminder created.",
    }),
  });
};

const processFeedbackReminder = async (ctx: any, interview: any) => {
  const normalizedInterview = normalizeInterview(interview);
  const completedAt =
    normalizedInterview.scheduledEndTime ?? normalizedInterview.endTime ?? normalizedInterview.startTime;

  if (
    normalizedInterview.feedbackReminderSentAt ||
    completedAt + FEEDBACK_REMINDER_DELAY_MS > Date.now()
  ) {
    return;
  }

  const feedbackEntries = await ctx.db
    .query("feedback")
    .withIndex("by_interview_id", (q: any) => q.eq("interviewId", normalizedInterview._id))
    .collect();

  const submittedInterviewers = new Set(
    feedbackEntries
      .filter((entry: any) => entry.state === "submitted")
      .map((entry: any) => entry.interviewerId),
  );

  const pendingInterviewers = normalizedInterview.interviewerIds.filter(
    (interviewerId: string) => !submittedInterviewers.has(interviewerId),
  );

  if (pendingInterviewers.length === 0) {
    await ctx.db.patch(normalizedInterview._id, {
      feedbackReminderSentAt: Date.now(),
    });
    return;
  }

  await ctx.runMutation(internal.notifications.queueInterviewNotifications, {
    interviewId: normalizedInterview._id,
    recipientClerkIds: pendingInterviewers,
    type: "feedback.reminder",
    category: "feedback_reminder",
    title: `${normalizedInterview.title} feedback is due`,
    message: `Please submit your feedback for ${normalizedInterview.title}. All times are shown in ${normalizedInterview.timezone}.`,
    scheduledFor: Date.now(),
    timezone: normalizedInterview.timezone,
    metadata: JSON.stringify({
      dueAt: completedAt + 24 * 60 * 60 * 1000,
      timezone: normalizedInterview.timezone,
    }),
  });

  await ctx.db.patch(normalizedInterview._id, {
    feedbackReminderSentAt: Date.now(),
    lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
      type: "feedback.reminder_sent",
      note: "Automatic interviewer feedback reminder created.",
    }),
  });
};

const getRecordingRetentionExpiry = (interview: ReturnType<typeof normalizeInterview>) =>
  interview.scheduledEndTime + interview.recordingRetentionDays * 24 * 60 * 60 * 1000;

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

export const getAuthorizedRecordingInterviews = query({
  handler: async (ctx) => {
    const { user } = await requirePermission(ctx, "viewRecordings");
    const interviews = (await ctx.db.query("interviews").collect()).map(
      normalizeInterview,
    );

    return interviews
      .filter((interview: any) => requireRecordingManifest(user, interview))
      .map((interview: any) => ({
        interviewId: interview._id,
        title: interview.title,
        streamCallId: interview.streamCallId,
        scheduledStartTime: interview.scheduledStartTime,
        retentionExpiresAt: getRecordingRetentionExpiry(interview),
      }));
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
      feedbackReminderSentAt: undefined,
      recordingConsentRequired: true,
      complianceJurisdiction: "global",
      recordingDisclosure: DEFAULT_RECORDING_DISCLOSURE,
      recordingRetentionDays: DEFAULT_RECORDING_RETENTION_DAYS,
      notesRetentionDays: DEFAULT_NOTES_RETENTION_DAYS,
      candidateDataRetentionDays: DEFAULT_CANDIDATE_DATA_RETENTION_DAYS,
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
      category: "interview_schedule",
      title: `${args.templateLabel} interview scheduled`,
      message: `${args.title} is scheduled for ${formatDateTimeForTimezone(
        args.scheduledStartTime,
        args.timezone,
      )} (${args.timezone}).`,
      metadata: {
        startTime: args.scheduledStartTime,
        timezone: args.timezone,
      },
      timezone: args.timezone,
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

    await ctx.runMutation(internal.observability.recordOperationalEvent, {
      source: "convex",
      scope: "interviews.create",
      level: "info",
      message: "Interview scheduled.",
      userId: user.clerkId,
      interviewId,
      streamCallId: args.streamCallId,
      provider: "stream",
      status: args.status,
      metadata: JSON.stringify({
        candidateId: args.candidateId,
        interviewerCount: args.interviewerIds.length,
      }),
    });

    await scheduleInterviewBackgroundWork(ctx, {
      interviewId,
      scheduledStartTime: args.scheduledStartTime,
      scheduledEndTime,
      retentionDays: DEFAULT_RECORDING_RETENTION_DAYS,
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
      feedbackReminderSentAt: undefined,
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
      category: "interview_update",
      title: `${normalizedInterview.title} was rescheduled`,
      message: `The interview has been moved to ${formatDateTimeForTimezone(
        args.scheduledStartTime,
        args.timezone,
      )} (${args.timezone}).`,
      metadata: {
        previousStartTime: normalizedInterview.scheduledStartTime,
        nextStartTime: args.scheduledStartTime,
        reason: args.reason,
      },
      timezone: args.timezone,
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

    await scheduleInterviewBackgroundWork(ctx, {
      interviewId: args.interviewId,
      scheduledStartTime: args.scheduledStartTime,
      scheduledEndTime,
      retentionDays: normalizedInterview.recordingRetentionDays,
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
      category: "interview_update",
      title: `${normalizedInterview.title} was cancelled`,
      message: args.reason
        ? `Interview cancelled: ${args.reason}`
        : "The interview has been cancelled.",
      metadata: {
        reason: args.reason,
      },
      timezone: normalizedInterview.timezone,
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

export const captureRecordingConsent = mutation({
  args: {
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    const { user, interview } = await requireInterviewAccess(ctx, args.interviewId);
    const normalizedInterview = normalizeInterview(interview);

    if (user.role !== "candidate") {
      return {
        capturedAt: normalizedInterview.recordingConsentCapturedAt ?? Date.now(),
      };
    }

    const capturedAt = normalizedInterview.recordingConsentCapturedAt ?? Date.now();

    await ctx.db.patch(args.interviewId, {
      recordingConsentCapturedAt: capturedAt,
      recordingConsentCapturedBy:
        normalizedInterview.recordingConsentCapturedBy ?? user.clerkId,
      lifecycleEvents: appendLifecycleEvent(normalizedInterview.lifecycleEvents, {
        type: "recording.consent_captured",
        actorClerkId: user.clerkId,
      }),
    });

    await logAuditEvent(ctx, {
      action: "interview.recording_consent_captured",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: args.interviewId,
      metadata: {
        recordedAt: capturedAt,
      },
    });

    return { capturedAt };
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
      await processFeedbackReminder(ctx, syncedInterview);
      updatedCount += syncedInterview.status !== interview.status ? 1 : 0;
    }

    return { updatedCount };
  },
});

const requireRecordingManifest = (
  user: { clerkId: string; role: string },
  interview: ReturnType<typeof normalizeInterview>,
) => {
  if (Date.now() > getRecordingRetentionExpiry(interview)) return false;

  return (
    (user.role === "admin" || user.role === "recruiter") ||
    (user.role === "interviewer" &&
      interview.interviewerIds.includes(user.clerkId))
  );
};
