import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { internal } from "./_generated/api";
import { v } from "convex/values";
import { getCurrentUserRecord, logAuditEvent, requirePermission } from "./lib/authz";
import { createServerError } from "./lib/errorUtils";

const jobKindValidator = v.union(
  v.literal("interview_reminder"),
  v.literal("interview_cleanup"),
  v.literal("interview_reconcile"),
  v.literal("webhook_retry"),
  v.literal("delayed_processing"),
);

const jobStatusValidator = v.union(
  v.literal("queued"),
  v.literal("running"),
  v.literal("completed"),
  v.literal("failed"),
  v.literal("dead_letter"),
  v.literal("cancelled"),
);

const serialize = (value?: Record<string, unknown>) =>
  value ? JSON.stringify(value) : undefined;

const parsePayload = (payload?: string | null) => {
  if (!payload) return null;

  try {
    return JSON.parse(payload);
  } catch {
    return null;
  }
};

const computeNextRetryAt = (attemptCount: number) =>
  Date.now() + Math.min(15 * 60 * 1000, 30 * 1000 * 2 ** Math.max(0, attemptCount - 1));

export const getWebhookEventByProviderEventId = internalQuery({
  args: {
    provider: v.string(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_event_id", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .first();
  },
});

export const recordWebhookReceipt = internalMutation({
  args: {
    provider: v.string(),
    eventId: v.string(),
    eventType: v.string(),
    payload: v.optional(v.string()),
    correlationId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_event_id", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        status: existing.status === "processed" ? "duplicate" : existing.status,
        attemptCount: existing.attemptCount + 1,
        correlationId: args.correlationId ?? existing.correlationId,
      });

      return existing._id;
    }

    return await ctx.db.insert("webhookEvents", {
      provider: args.provider,
      eventId: args.eventId,
      eventType: args.eventType,
      status: "received",
      attemptCount: 1,
      payload: args.payload,
      createdAt: Date.now(),
      correlationId: args.correlationId,
    });
  },
});

export const markWebhookProcessed = internalMutation({
  args: {
    provider: v.string(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_event_id", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .first();

    if (!event) return null;

    await ctx.db.patch(event._id, {
      status: "processed",
      processedAt: Date.now(),
      lastError: undefined,
      nextRetryAt: undefined,
    });

    return event._id;
  },
});

export const markWebhookFailed = internalMutation({
  args: {
    provider: v.string(),
    eventId: v.string(),
    errorMessage: v.string(),
    payload: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const event = await ctx.db
      .query("webhookEvents")
      .withIndex("by_provider_event_id", (q) =>
        q.eq("provider", args.provider).eq("eventId", args.eventId),
      )
      .first();

    if (!event) return null;

    const nextRetryAt = computeNextRetryAt(event.attemptCount + 1);

    await ctx.db.patch(event._id, {
      status: "failed",
      attemptCount: event.attemptCount + 1,
      lastError: args.errorMessage,
      nextRetryAt,
      payload: args.payload ?? event.payload,
    });

    await ctx.db.insert("backgroundJobs", {
      kind: "webhook_retry",
      status: "queued",
      runAt: nextRetryAt,
      attemptCount: 0,
      maxAttempts: 5,
      payload: serialize({
        provider: args.provider,
        eventId: args.eventId,
      }),
      createdAt: Date.now(),
      relatedId: event._id,
    });

    return event._id;
  },
});

export const enqueueJob = internalMutation({
  args: {
    kind: jobKindValidator,
    runAt: v.number(),
    maxAttempts: v.number(),
    payload: v.optional(v.string()),
    relatedId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const jobId = await ctx.db.insert("backgroundJobs", {
      kind: args.kind,
      status: "queued",
      runAt: args.runAt,
      attemptCount: 0,
      maxAttempts: args.maxAttempts,
      payload: args.payload,
      createdAt: Date.now(),
      relatedId: args.relatedId,
    });

    await ctx.scheduler.runAfter(
      Math.max(0, args.runAt - Date.now()),
      internal.reliability.executeJob,
      { jobId },
    );

    return jobId;
  },
});

export const cancelQueuedJobsForInterview = internalMutation({
  args: { interviewId: v.string() },
  handler: async (ctx, args) => {
    const jobs = await ctx.db.query("backgroundJobs").collect();
    for (const job of jobs) {
      if (
        job.relatedId === args.interviewId &&
        (job.status === "queued" || job.status === "running")
      ) {
        await ctx.db.patch(job._id, { status: "cancelled" });
      }
    }
  },
});

export const executeJob = internalMutation({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    const job = await ctx.db.get(args.jobId);

    if (!job || job.status === "completed" || job.status === "cancelled") {
      return null;
    }

    const nextAttempt = job.attemptCount + 1;
    const now = Date.now();

    await ctx.db.patch(job._id, {
      status: "running",
      attemptCount: nextAttempt,
      lastAttemptAt: now,
    });

    try {
      const payload = parsePayload(job.payload) ?? {};

      if (job.kind === "interview_reconcile" && typeof payload.interviewId === "string") {
        await ctx.runMutation(internal.observability.recordOperationalEvent, {
          source: "convex",
          scope: "background.interview_reconcile",
          level: "warn",
          message: "Interview reconciliation queued for manual review.",
          interviewId: payload.interviewId,
          status: "manual-review",
          metadata: JSON.stringify(payload),
        });
      }

      if (job.kind === "interview_cleanup" && typeof payload.interviewId === "string") {
        await ctx.runMutation(internal.observability.recordOperationalEvent, {
          source: "convex",
          scope: "background.interview_cleanup",
          level: "info",
          message: "Retention cleanup checkpoint recorded.",
          interviewId: payload.interviewId,
          status: "checkpoint",
          metadata: JSON.stringify(payload),
        });
      }

      if (job.kind === "interview_reminder" && typeof payload.interviewId === "string") {
        await ctx.runMutation(internal.observability.recordOperationalEvent, {
          source: "convex",
          scope: "background.interview_reminder",
          level: "info",
          message: "Interview reminder job executed.",
          interviewId: payload.interviewId,
          status: "sent",
          metadata: JSON.stringify(payload),
        });
      }

      if (job.kind === "webhook_retry") {
        await ctx.runMutation(internal.observability.recordOperationalEvent, {
          source: "convex",
          scope: "background.webhook_retry",
          level: "warn",
          message: "Webhook retry requires provider replay or operator review.",
          status: "manual-review",
          metadata: JSON.stringify(payload),
        });
      }

      if (job.kind === "delayed_processing") {
        await ctx.runMutation(internal.observability.recordOperationalEvent, {
          source: "convex",
          scope: "background.delayed_processing",
          level: "info",
          message: "Delayed processing checkpoint executed.",
          status: "completed",
          metadata: JSON.stringify(payload),
        });
      }

      await ctx.db.patch(job._id, {
        status: "completed",
        completedAt: now,
        lastError: undefined,
        deadLetterReason: undefined,
      });

      return { status: "completed" as const };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown background job failure.";

      if (nextAttempt >= job.maxAttempts) {
        await ctx.db.patch(job._id, {
          status: "dead_letter",
          lastError: message,
          deadLetterReason: "Max retry attempts exhausted.",
        });

        await ctx.db.insert("recoveryOperations", {
          status: "open",
          mode: "manual",
          scope: "background_job",
          summary: `Dead-lettered job: ${job.kind}`,
          detail: message,
          referenceId: job._id,
          attempts: nextAttempt,
          createdAt: now,
        });
      } else {
        const runAt = computeNextRetryAt(nextAttempt);
        await ctx.db.patch(job._id, {
          status: "queued",
          runAt,
          lastError: message,
        });

        await ctx.scheduler.runAfter(
          Math.max(0, runAt - Date.now()),
          internal.reliability.executeJob,
          { jobId: job._id },
        );
      }

      return { status: "retrying" as const };
    }
  },
});

export const reportProviderProvisioningFailure = mutation({
  args: {
    scope: v.string(),
    summary: v.string(),
    detail: v.optional(v.string()),
    externalId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const now = Date.now();

    const operationId = await ctx.db.insert("recoveryOperations", {
      status: "open",
      mode: "automatic",
      scope: args.scope,
      summary: args.summary,
      detail: args.detail,
      externalId: args.externalId,
      attempts: 1,
      createdAt: now,
    });

    await ctx.runMutation(internal.reliability.enqueueJob, {
      kind: "interview_reconcile",
      runAt: now + 60 * 1000,
      maxAttempts: 3,
      payload: serialize({
        operationId,
        externalId: args.externalId,
        scope: args.scope,
      }),
      relatedId: operationId,
    });

    await logAuditEvent(ctx, {
      action: "reliability.provisioning_failure_reported",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "recoveryOperation",
      targetId: operationId,
      metadata: {
        scope: args.scope,
        externalId: args.externalId,
      },
    });

    return operationId;
  },
});

export const retryJob = mutation({
  args: {
    jobId: v.id("backgroundJobs"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "manageReliability");
    const job = await ctx.db.get(args.jobId);

    if (!job) {
      throw createServerError(new Error(`Job not found: ${args.jobId}`), "Job not found.");
    }

    const runAt = Date.now();

    await ctx.db.patch(args.jobId, {
      status: "queued",
      runAt,
      deadLetterReason: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.reliability.executeJob, {
      jobId: args.jobId,
    });

    return { queuedAt: runAt };
  },
});

export const resolveRecoveryOperation = mutation({
  args: {
    operationId: v.id("recoveryOperations"),
    resolution: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageReliability");
    const operation = await ctx.db.get(args.operationId);

    if (!operation) {
      throw createServerError(
        new Error(`Recovery operation not found: ${args.operationId}`),
        "Recovery operation not found.",
      );
    }

    await ctx.db.patch(args.operationId, {
      status: "resolved",
      resolution: args.resolution,
      resolvedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      action: "reliability.recovery_resolved",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "recoveryOperation",
      targetId: args.operationId,
      metadata: {
        scope: operation.scope,
      },
    });

    return { resolvedAt: Date.now() };
  },
});

export const getReliabilityDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewObservability");

    const jobs = await ctx.db.query("backgroundJobs").order("desc").take(50);
    const recoveryOperations = await ctx.db
      .query("recoveryOperations")
      .withIndex("by_status_created_at", (q) => q.eq("status", "open"))
      .order("desc")
      .take(20);
    const webhookEvents = await ctx.db
      .query("webhookEvents")
      .order("desc")
      .take(20);
    const backups = await ctx.db.query("backupSnapshots").order("desc").take(12);

    return {
      totals: {
        queuedJobs: jobs.filter((job) => job.status === "queued").length,
        deadLetters: jobs.filter((job) => job.status === "dead_letter").length,
        openRecoveries: recoveryOperations.length,
        failedWebhooks: webhookEvents.filter((event) => event.status === "failed").length,
      },
      jobs,
      recoveryOperations,
      webhookEvents,
      backups,
      disasterRecoveryPlan: [
        "Restore latest Convex export or snapshot before replaying provider events.",
        "Re-run dead-lettered jobs and resolve open recovery operations after dependencies recover.",
        "Reconcile Stream calls against interviews, then validate candidate/interviewer notifications.",
        "Document incident owner, blast radius, and timestamps in audit logs before closing the incident.",
      ],
    };
  },
});

export const recordBackupSnapshot = mutation({
  args: {
    kind: v.union(
      v.literal("automatic"),
      v.literal("manual"),
      v.literal("restore_drill"),
    ),
    summary: v.string(),
    scope: v.string(),
    storageLocation: v.optional(v.string()),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageReliability");
    return await ctx.db.insert("backupSnapshots", {
      ...args,
      status: "available",
      createdBy: user.clerkId,
      createdAt: Date.now(),
    });
  },
});

export const markBackupRestored = mutation({
  args: {
    snapshotId: v.id("backupSnapshots"),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "manageReliability");
    const snapshot = await ctx.db.get(args.snapshotId);

    if (!snapshot) {
      throw createServerError(
        new Error(`Backup snapshot not found: ${args.snapshotId}`),
        "Backup snapshot not found.",
      );
    }

    await ctx.db.patch(args.snapshotId, {
      status: "restored",
      restoredAt: Date.now(),
      notes: args.notes ?? snapshot.notes,
    });

    return { restoredAt: Date.now() };
  },
});

export const getJobByStatus = query({
  args: {
    status: jobStatusValidator,
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "viewDashboard");
    return await ctx.db
      .query("backgroundJobs")
      .withIndex("by_status_run_at", (q) => q.eq("status", args.status))
      .order("asc")
      .take(50);
  },
});
