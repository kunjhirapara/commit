import { v } from "convex/values";
import { internalMutation, query } from "./_generated/server";
import { requirePermission } from "./lib/authz";
import { RETENTION_DAYS } from "./lib/retention";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Days of history the growth dashboard returns. */
const GROWTH_WINDOW_DAYS = 30;

/** Rows deleted per table per run, so a single cron tick stays well inside limits. */
const PRUNE_BATCH_SIZE = 500;

const toUtcDateKey = (timestamp: number) =>
  new Date(timestamp).toISOString().slice(0, 10);

const startOfUtcDay = (timestamp: number) => {
  const date = new Date(timestamp);
  return Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
  );
};

/**
 * Aggregates one UTC day into `dailyMetrics`.
 *
 * Defaults to the day before `now` so it runs after that day has closed. Safe to
 * re-run: the row for a date is replaced, not appended to.
 */
export const rollUpDailyMetrics = internalMutation({
  args: {
    /** Defaults to yesterday. Accepts a timestamp anywhere inside the target day. */
    forTimestamp: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const target = args.forTimestamp ?? Date.now() - DAY_MS;
    const dayStart = startOfUtcDay(target);
    const dayEnd = dayStart + DAY_MS;
    const date = toUtcDateKey(dayStart);

    const [newUsers, auditLogs, sessionEvents, operationalEvents] =
      await Promise.all([
        ctx.db
          .query("users")
          .withIndex("by_creation_time", (q) =>
            q.gte("_creationTime", dayStart).lt("_creationTime", dayEnd),
          )
          .collect(),
        ctx.db
          .query("auditLogs")
          .withIndex("by_created_at", (q) =>
            q.gte("createdAt", dayStart).lt("createdAt", dayEnd),
          )
          .collect(),
        ctx.db
          .query("interviewSessionEvents")
          .withIndex("by_created_at", (q) =>
            q.gte("createdAt", dayStart).lt("createdAt", dayEnd),
          )
          .collect(),
        ctx.db
          .query("operationalEvents")
          .withIndex("by_created_at", (q) =>
            q.gte("createdAt", dayStart).lt("createdAt", dayEnd),
          )
          .collect(),
      ]);

    // Distinct signed-in accounts, from the Clerk session webhook.
    const activeClerkIds = new Set(
      auditLogs
        .filter((log) => log.action === "clerk.session.created")
        .map((log) => log.actorClerkId)
        .filter((id): id is string => !!id),
    );

    // Distinct calls somebody actually joined, rather than raw join events.
    const meetingsStarted = new Set(
      sessionEvents
        .filter((event) => event.type === "session.joined")
        .map((event) => event.streamCallId),
    ).size;

    const codeRunEvents = operationalEvents.filter(
      (event) => event.scope === "code.run",
    );
    const codeRuns = codeRunEvents.filter(
      (event) => event.status !== "rejected",
    ).length;
    const codeRunFailures = codeRunEvents.filter(
      (event) => event.status === "failed",
    ).length;
    const codeRunQueueRejections = codeRunEvents.filter(
      (event) => event.status === "rejected",
    ).length;

    // Counted once a day here rather than on every developer-dashboard load.
    // This is an internal cron, so a full scan is affordable where it was not in
    // a user-facing query.
    const totalUsers = (await ctx.db.query("users").collect()).length;

    const row = {
      date,
      signups: newUsers.length,
      activeUsers: activeClerkIds.size,
      meetingsStarted,
      codeRuns,
      codeRunFailures,
      codeRunQueueRejections,
      totalUsers,
      computedAt: Date.now(),
    };

    const existing = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_date", (q) => q.eq("date", date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, row);
      return { date, updated: true };
    }

    await ctx.db.insert("dailyMetrics", row);
    return { date, updated: false };
  },
});

/**
 * Deletes rows past their retention window, a bounded batch per table per run.
 * If a table is over budget the next tick picks up where this one left off.
 */
export const pruneExpiredRecords = internalMutation({
  handler: async (ctx) => {
    const now = Date.now();
    const deleted: Record<string, number> = {};

    const pruneByCreatedAt = async (
      table:
        | "operationalEvents"
        | "interviewSessionEvents"
        | "auditLogs",
      retentionDays: number,
    ) => {
      const cutoff = now - retentionDays * DAY_MS;
      const expired = await ctx.db
        .query(table)
        .withIndex("by_created_at", (q) => q.lt("createdAt", cutoff))
        .take(PRUNE_BATCH_SIZE);

      for (const row of expired) {
        await ctx.db.delete(row._id);
      }

      deleted[table] = expired.length;
    };

    await pruneByCreatedAt(
      "operationalEvents",
      RETENTION_DAYS.operationalEvents,
    );
    await pruneByCreatedAt(
      "interviewSessionEvents",
      RETENTION_DAYS.interviewSessionEvents,
    );
    await pruneByCreatedAt("auditLogs", RETENTION_DAYS.auditLogs);

    // Separate block because proctoringEvents keys its index on `startedAt`
    // rather than `createdAt` — the server-anchored moment the signal began,
    // which is what the report orders by.
    const proctoringCutoff = now - RETENTION_DAYS.proctoringEvents * DAY_MS;
    const expiredProctoring = await ctx.db
      .query("proctoringEvents")
      .withIndex("by_created_at", (q) => q.lt("startedAt", proctoringCutoff))
      .take(PRUNE_BATCH_SIZE);

    for (const row of expiredProctoring) {
      await ctx.db.delete(row._id);
    }
    deleted.proctoringEvents = expiredProctoring.length;

    // Same window as the events, keyed on the same server-anchored field.
    const sessionCutoff = now - RETENTION_DAYS.proctoringSessions * DAY_MS;
    const expiredSessions = await ctx.db
      .query("proctoringSessions")
      .withIndex("by_started_at", (q) => q.lt("startedAt", sessionCutoff))
      .take(PRUNE_BATCH_SIZE);

    for (const row of expiredSessions) {
      await ctx.db.delete(row._id);
    }
    deleted.proctoringSessions = expiredSessions.length;

    // Only terminal jobs are pruned; anything still pending or retrying stays.
    const jobCutoff = now - RETENTION_DAYS.backgroundJobs * DAY_MS;
    const staleJobs = await ctx.db
      .query("backgroundJobs")
      .withIndex("by_kind_created_at", (q) => q)
      .filter((q) => q.lt(q.field("createdAt"), jobCutoff))
      .take(PRUNE_BATCH_SIZE);

    let removedJobs = 0;
    for (const job of staleJobs) {
      if (job.status === "completed" || job.status === "dead_letter") {
        await ctx.db.delete(job._id);
        removedJobs += 1;
      }
    }
    deleted.backgroundJobs = removedJobs;

    // Webhook rows carry the full Clerk payload, so they are the most valuable
    // to age out once they are no longer needed for replay protection.
    const webhookCutoff = now - RETENTION_DAYS.webhookEvents * DAY_MS;
    const staleWebhooks = await ctx.db
      .query("webhookEvents")
      .withIndex("by_status_created_at", (q) => q.eq("status", "processed"))
      .filter((q) => q.lt(q.field("createdAt"), webhookCutoff))
      .take(PRUNE_BATCH_SIZE);

    for (const webhook of staleWebhooks) {
      await ctx.db.delete(webhook._id);
    }
    deleted.webhookEvents = staleWebhooks.length;

    return deleted;
  },
});

/**
 * Growth and capacity view for the developer dashboard.
 *
 * Reads pre-aggregated rows plus today's live counts, so cost is bounded by the
 * window rather than by total table size.
 */
export const getGrowthDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewObservability");

    const now = Date.now();
    const todayStart = startOfUtcDay(now);
    const windowStart = todayStart - (GROWTH_WINDOW_DAYS - 1) * DAY_MS;

    const history = await ctx.db
      .query("dailyMetrics")
      .withIndex("by_date", (q) =>
        q.gte("date", toUtcDateKey(windowStart)),
      )
      .collect();

    // Today has not been rolled up yet, so count signups live. Bounded by one
    // day of new users.
    const todaysSignups = await ctx.db
      .query("users")
      .withIndex("by_creation_time", (q) =>
        q.gte("_creationTime", todayStart),
      )
      .collect();

    // Read from the most recent rollup, plus today's signups, instead of the
    // full table scan this used to do — directly contradicting the docstring
    // above about being bounded by the window.
    const latestWithTotal = [...history]
      .sort((a, b) => b.date.localeCompare(a.date))
      .find((row) => typeof row.totalUsers === "number");
    const totalUsers =
      (latestWithTotal?.totalUsers ?? 0) + todaysSignups.length;

    const sumOverDays = (
      days: number,
      pick: (row: (typeof history)[number]) => number,
    ) => {
      const cutoff = toUtcDateKey(todayStart - (days - 1) * DAY_MS);
      return history
        .filter((row) => row.date >= cutoff)
        .reduce((total, row) => total + pick(row), 0);
    };

    return {
      totalUsers,
      signupsToday: todaysSignups.length,
      signups7d: sumOverDays(7, (row) => row.signups) + todaysSignups.length,
      signups30d: sumOverDays(30, (row) => row.signups) + todaysSignups.length,
      activeUsers7d: sumOverDays(7, (row) => row.activeUsers),
      meetings7d: sumOverDays(7, (row) => row.meetingsStarted),
      codeRuns7d: sumOverDays(7, (row) => row.codeRuns),
      codeRunFailures7d: sumOverDays(7, (row) => row.codeRunFailures),
      queueRejections7d: sumOverDays(7, (row) => row.codeRunQueueRejections),
      history: history.sort((a, b) => a.date.localeCompare(b.date)),
    };
  },
});
