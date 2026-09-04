import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildTypingProfile,
  detectAuthorshipFlags,
} from "./detectors.ts";
import type { AuthorshipSegment } from "./authorship.ts";

/**
 * The negative cases are the point of this file.
 *
 * A detector that fires on honest work costs a candidate an accusation and
 * teaches interviewers to ignore the panel, which is strictly worse than having
 * no detector. So every test that asserts a flag fires has a sibling asserting
 * it stays quiet on ordinary work.
 */
const segment = (
  overrides: Partial<AuthorshipSegment> = {},
): AuthorshipSegment => ({
  tOffsetMs: 0,
  op: "insert",
  charCount: 300,
  keystrokeCount: 300,
  backspaceCount: 0,
  durationMs: 60_000,
  meanInterKeyMs: 200,
  stdDevInterKeyMs: 10,
  viaPaste: false,
  language: "javascript",
  questionId: "two-sum",
  ...overrides,
});

const kinds = (segments: AuthorshipSegment[]) =>
  detectAuthorshipFlags(segments).map((flag) => flag.kind);

describe("typing.transcription", () => {
  it("fires on a long, evenly paced run with no corrections", () => {
    assert.ok(
      kinds([segment({ meanInterKeyMs: 200, stdDevInterKeyMs: 10 })]).includes(
        "typing.transcription",
      ),
    );
  });

  it("stays quiet when the typing varies the way composing does", () => {
    // The same length and the same corrections — only the spread differs.
    assert.ok(
      !kinds([
        segment({ meanInterKeyMs: 200, stdDevInterKeyMs: 140 }),
      ]).includes("typing.transcription"),
    );
  });

  it("stays quiet on even typing that still gets corrected", () => {
    // A tidy programmer typing steadily but fixing things as they go.
    assert.ok(
      !kinds([
        segment({
          meanInterKeyMs: 200,
          stdDevInterKeyMs: 10,
          backspaceCount: 30,
        }),
      ]).includes("typing.transcription"),
    );
  });

  it("ignores runs too short to judge", () => {
    assert.ok(
      !kinds([segment({ charCount: 100, keystrokeCount: 100 })]).includes(
        "typing.transcription",
      ),
    );
  });

  it("never judges a paste as machine-like typing", () => {
    // A paste has no cadence. Judging it here would flag every paste, which is
    // both useless and unfair — pastes are measured by the insert thresholds.
    assert.ok(
      !kinds([
        segment({ viaPaste: true, meanInterKeyMs: 0, stdDevInterKeyMs: 0 }),
      ]).includes("typing.transcription"),
    );
  });
});

describe("typing.burstAfterIdle", () => {
  it("fires after a long silence followed by a clean block", () => {
    const flags = kinds([
      segment({ tOffsetMs: 0, charCount: 200, durationMs: 20_000 }),
      segment({
        tOffsetMs: 60_000,
        charCount: 400,
        keystrokeCount: 400,
        durationMs: 90_000,
        stdDevInterKeyMs: 150,
      }),
    ]);
    assert.ok(flags.includes("typing.burstAfterIdle"));
  });

  it("stays quiet when the pause is short", () => {
    const flags = kinds([
      segment({ tOffsetMs: 0, charCount: 200, durationMs: 20_000 }),
      segment({
        tOffsetMs: 25_000,
        charCount: 400,
        keystrokeCount: 400,
        durationMs: 90_000,
        stdDevInterKeyMs: 150,
      }),
    ]);
    assert.ok(!flags.includes("typing.burstAfterIdle"));
  });

  it("stays quiet when the block after the pause is full of corrections", () => {
    // Thinking then working through it messily is the honest pattern.
    const flags = kinds([
      segment({ tOffsetMs: 0, charCount: 200, durationMs: 20_000 }),
      segment({
        tOffsetMs: 90_000,
        charCount: 400,
        keystrokeCount: 400,
        backspaceCount: 60,
        durationMs: 90_000,
        stdDevInterKeyMs: 150,
      }),
    ]);
    assert.ok(!flags.includes("typing.burstAfterIdle"));
  });
});

describe("typing.impossibleSpeed", () => {
  it("fires above sustained human typing speed", () => {
    // 600 characters in 10 seconds is 3,600 a minute.
    assert.ok(
      kinds([
        segment({
          charCount: 600,
          keystrokeCount: 600,
          durationMs: 10_000,
          stdDevInterKeyMs: 200,
        }),
      ]).includes("typing.impossibleSpeed"),
    );
  });

  it("stays quiet for a genuinely fast typist", () => {
    // 600 characters in 75 seconds is 480 a minute — quick, and real.
    assert.ok(
      !kinds([
        segment({
          charCount: 600,
          keystrokeCount: 600,
          durationMs: 75_000,
          stdDevInterKeyMs: 200,
        }),
      ]).includes("typing.impossibleSpeed"),
    );
  });
});

describe("edit.noRefinement", () => {
  it("fires on a large solution that was never revised", () => {
    assert.ok(
      kinds([
        segment({ charCount: 500, keystrokeCount: 500, stdDevInterKeyMs: 150 }),
      ]).includes("edit.noRefinement"),
    );
  });

  it("stays quiet once there is real editing", () => {
    const flags = kinds([
      segment({ charCount: 500, keystrokeCount: 500, stdDevInterKeyMs: 150 }),
      segment({
        tOffsetMs: 70_000,
        op: "delete",
        charCount: 60,
        keystrokeCount: 60,
        backspaceCount: 60,
      }),
    ]);
    assert.ok(!flags.includes("edit.noRefinement"));
  });

  it("stays quiet on a short solution, where iteration says nothing", () => {
    assert.ok(
      !kinds([
        segment({ charCount: 200, keystrokeCount: 200, stdDevInterKeyMs: 150 }),
      ]).includes("edit.noRefinement"),
    );
  });
});

describe("flags as a whole", () => {
  it("finds nothing in an ordinary working session", () => {
    // Varied cadence, regular corrections, steady progress. This must come back
    // completely clean or the feature is unusable.
    const session: AuthorshipSegment[] = [
      segment({
        tOffsetMs: 0,
        charCount: 180,
        keystrokeCount: 190,
        backspaceCount: 14,
        durationMs: 40_000,
        meanInterKeyMs: 210,
        stdDevInterKeyMs: 160,
      }),
      segment({
        tOffsetMs: 45_000,
        op: "delete",
        charCount: 25,
        keystrokeCount: 25,
        backspaceCount: 25,
        durationMs: 4_000,
      }),
      segment({
        tOffsetMs: 55_000,
        charCount: 240,
        keystrokeCount: 260,
        backspaceCount: 22,
        durationMs: 55_000,
        meanInterKeyMs: 210,
        stdDevInterKeyMs: 180,
      }),
    ];

    assert.deepEqual(detectAuthorshipFlags(session), []);
  });

  it("returns flags in the order they happened", () => {
    const flags = detectAuthorshipFlags([
      segment({ tOffsetMs: 120_000 }),
      segment({ tOffsetMs: 5_000 }),
    ]);
    const offsets = flags.map((flag) => flag.tOffsetMs);
    assert.deepEqual(offsets, [...offsets].sort((a, b) => a - b));
  });

  it("carries the rule and a probe on every flag, never a verdict", () => {
    // The whole posture of the feature: a question for an interviewer, with the
    // rule attached so they can disagree with it.
    for (const flag of detectAuthorshipFlags([segment()])) {
      assert.ok(flag.rule.length > 0, `${flag.kind} has no rule`);
      assert.ok(flag.probe.length > 0, `${flag.kind} has no probe`);
      assert.ok(!/reject|fail|cheat/i.test(flag.probe));
    }
  });

  it("handles an empty history without inventing anything", () => {
    assert.deepEqual(detectAuthorshipFlags([]), []);
  });
});

describe("buildTypingProfile", () => {
  it("separates typed, pasted and deleted characters", () => {
    const profile = buildTypingProfile([
      segment({ charCount: 300 }),
      segment({ charCount: 500, viaPaste: true }),
      segment({ op: "delete", charCount: 40 }),
    ]);

    assert.equal(profile.typedChars, 300);
    assert.equal(profile.pastedChars, 500);
    assert.equal(profile.deletedChars, 40);
    assert.equal(profile.refinementRatio, 40 / 800);
  });

  it("weights cadence by run length rather than by run count", () => {
    // Otherwise one short burst would count as much as ten minutes of work.
    const profile = buildTypingProfile([
      segment({ charCount: 900, meanInterKeyMs: 100 }),
      segment({ charCount: 100, meanInterKeyMs: 1_100 }),
    ]);
    assert.equal(profile.meanInterKeyMs, 200);
  });

  it("reports zeroes for an empty history rather than NaN", () => {
    // A NaN comparison silently never fires, which is the worst way to be wrong.
    const profile = buildTypingProfile([]);
    assert.equal(profile.refinementRatio, 0);
    assert.equal(profile.meanInterKeyMs, 0);
  });
});
