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

export default crons;
