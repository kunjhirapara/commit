/**
 * Retention windows for the append-only tables.
 *
 * None of these had any pruning originally, so every one grew without bound. On
 * a public deployment that is the fastest route into Convex's storage and
 * bandwidth limits, and it also slows the dashboards that scan them.
 *
 * Kept in convex/lib rather than inside convex/metrics.ts so a test can import
 * it without pulling in the Convex server runtime — the same reason
 * convex/lib/owner.ts sits here and is exercised by src/lib/ownerEmails.test.ts.
 * These numbers are published to candidates, so they are worth asserting on.
 */
export const RETENTION_DAYS = {
  operationalEvents: 90,
  interviewSessionEvents: 90,
  auditLogs: 180,
  backgroundJobs: 30,
  webhookEvents: 30,
  /**
   * Integrity signals age out with the session events they sit alongside.
   * Keeping them longer would mean a stray focus event from a year ago could
   * still surface against a candidate.
   *
   * This number is also a promise: the pre-join notice a candidate must
   * acknowledge tells them monitoring is kept for 90 days and then deleted, and
   * the privacy policy repeats it. Changing it here without changing both of
   * those turns a published commitment into a false one.
   */
  proctoringEvents: 90,
  /**
   * Must match proctoringEvents.
   *
   * The session row is the summary of those events — which candidate, which
   * browser, how far their clock drifted, whether a second display was found.
   * Pruning the events but not the session left a per-candidate fingerprint
   * behind after the data it summarised had expired.
   */
  proctoringSessions: 90,
} as const;

export type RetentionTable = keyof typeof RETENTION_DAYS;
