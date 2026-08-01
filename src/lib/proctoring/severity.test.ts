import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveSeverity } from "./severity.ts";
import type { ProctoringSummary } from "./types.ts";

/**
 * The band an interviewer reads is derived from these boundaries, and a wrong
 * comparison here has no visible symptom — it just quietly mislabels someone.
 * Both sides of every boundary are covered deliberately.
 */
const baseSummary: ProctoringSummary = {
  totalUnfocusedMs: 0,
  longestAbsenceMs: 0,
  tabSwitches: 0,
  windowSwitches: 0,
  fullscreenExits: 0,
  largestInsertChars: 0,
  totalPastedChars: 0,
  monitorGaps: 0,
  maxClockSkewMs: 0,
  displaySupport: "single",
  extendedAppearedMidSession: false,
  fullscreenUsed: true,
};

const summary = (overrides: Partial<ProctoringSummary>): ProctoringSummary => ({
  ...baseSummary,
  ...overrides,
});

describe("resolveSeverity", () => {
  it("is clear when nothing of note happened", () => {
    const result = resolveSeverity(baseSummary);
    assert.equal(result.band, "clear");
    assert.deepEqual(result.reasons, []);
  });

  it("stays clear just under the unfocused boundary and turns minor at it", () => {
    assert.equal(resolveSeverity(summary({ totalUnfocusedMs: 29_999 })).band, "clear");
    assert.equal(resolveSeverity(summary({ totalUnfocusedMs: 30_000 })).band, "minor");
  });

  it("turns notable only above two minutes unfocused", () => {
    assert.equal(resolveSeverity(summary({ totalUnfocusedMs: 120_000 })).band, "minor");
    assert.equal(resolveSeverity(summary({ totalUnfocusedMs: 120_001 })).band, "notable");
  });

  it("bands a bulk insert by size", () => {
    assert.equal(resolveSeverity(summary({ largestInsertChars: 120 })).band, "clear");
    assert.equal(resolveSeverity(summary({ largestInsertChars: 121 })).band, "minor");
    assert.equal(resolveSeverity(summary({ largestInsertChars: 400 })).band, "minor");
    assert.equal(resolveSeverity(summary({ largestInsertChars: 401 })).band, "notable");
  });

  it("treats any monitor gap as notable regardless of everything else", () => {
    const result = resolveSeverity(summary({ monitorGaps: 1 }));
    assert.equal(result.band, "notable");
    assert.ok(result.reasons.some((reason) => reason.includes("stopped reporting")));
  });

  it("treats clock skew over 30s as notable", () => {
    assert.equal(resolveSeverity(summary({ maxClockSkewMs: 30_000 })).band, "clear");
    assert.equal(resolveSeverity(summary({ maxClockSkewMs: 30_001 })).band, "notable");
  });

  it("treats a display appearing mid-session as notable", () => {
    assert.equal(
      resolveSeverity(summary({ extendedAppearedMidSession: true })).band,
      "notable",
    );
  });

  it("never reports unsupported display detection as a clean pass", () => {
    // The whole point of the three-state: a browser that cannot answer must not
    // read the same as a browser that answered "no second screen".
    const unsupported = resolveSeverity(summary({ displaySupport: "unsupported" }));
    assert.ok(
      unsupported.reasons.some((reason) => reason.includes("could not be checked")),
      "unsupported display support must be surfaced as a caveat",
    );
  });

  it("always returns the rule it applied so the UI can show it", () => {
    const result = resolveSeverity(summary({ totalUnfocusedMs: 45_000 }));
    assert.ok(result.rule.length > 0);
    assert.ok(result.reasons.length > 0);
  });
});
