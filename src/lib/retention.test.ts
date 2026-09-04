import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { RETENTION_DAYS } from "../../convex/lib/retention.ts";

/**
 * These are not arbitrary configuration. The 90-day figure is stated to
 * candidates in the pre-join monitoring notice they have to acknowledge before
 * they can join, and repeated in the privacy policy. A silent change here turns
 * a published promise into a false one, which is exactly the kind of drift a
 * test should catch rather than a reviewer.
 */
describe("retention windows", () => {
  it("keeps integrity monitoring at the 90 days candidates are promised", () => {
    assert.equal(RETENTION_DAYS.proctoringEvents, 90);
  });

  it("ages session summaries out with the events they summarise", () => {
    // These drifted once: the events were pruned and the session row was not,
    // so a per-candidate record of browser, clock skew and display support
    // outlived the data it described and then stayed forever.
    assert.equal(
      RETENTION_DAYS.proctoringSessions,
      RETENTION_DAYS.proctoringEvents,
      "proctoringSessions must expire with proctoringEvents",
    );
  });

  it("keeps every window a positive whole number of days", () => {
    for (const [table, days] of Object.entries(RETENTION_DAYS)) {
      assert.ok(
        Number.isInteger(days) && days > 0,
        `${table} has an unusable retention window: ${days}`,
      );
    }
  });

  it("retains audit logs at least as long as the events they explain", () => {
    // An audit trail that expires before the records it accounts for cannot
    // answer who did what.
    assert.ok(RETENTION_DAYS.auditLogs >= RETENTION_DAYS.operationalEvents);
  });
});
