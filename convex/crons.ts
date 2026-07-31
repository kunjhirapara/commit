import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

/**
 * Interview lifecycle transitions plus reminder and feedback-chase notifications.
 *
 * Runs server-side on a schedule rather than being triggered by page loads, so that
 * transitions happen for interviews nobody is currently looking at, and so the
 * whole-table scan is not reachable from the public API.
 */
crons.interval(
  "advance interview lifecycle",
  { minutes: 15 },
  internal.interviews.runLifecycleAutomation,
);

/**
 * Aggregate the previous UTC day. Runs shortly after midnight UTC so the day is
 * closed; re-running is safe because the rollup replaces the row for a date.
 */
crons.cron(
  "roll up daily metrics",
  "10 0 * * *",
  internal.metrics.rollUpDailyMetrics,
  {},
);

/**
 * Age out the append-only tables. Hourly rather than daily so a backlog drains
 * over time instead of needing one oversized batch.
 */
crons.interval(
  "prune expired records",
  { hours: 1 },
  internal.metrics.pruneExpiredRecords,
);

export default crons;
