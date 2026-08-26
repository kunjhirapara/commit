import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { AuthorshipCoalescer, type EditorChange } from "./authorship.ts";

/**
 * The coalescer decides what an interviewer is shown about how a solution was
 * written. Every boundary here is a place where being one off changes the story
 * without anything failing: a run that should have split stays merged and its
 * cadence averages away, or a run that should have merged splits and the
 * transcription detector never sees a long enough segment to fire.
 */
const SESSION_START = 1_000_000;

const make = (overrides: Partial<EditorChange> = {}): EditorChange => ({
  at: SESSION_START,
  op: "insert",
  offset: 0,
  charCount: 1,
  text: "a",
  viaPaste: false,
  language: "javascript",
  questionId: "two-sum",
  ...overrides,
});

/** Types `count` characters, one at a time, `gapMs` apart. */
const type = (
  coalescer: AuthorshipCoalescer,
  count: number,
  gapMs: number,
  start = SESSION_START,
  startOffset = 0,
) => {
  for (let i = 0; i < count; i += 1) {
    coalescer.record(
      make({ at: start + i * gapMs, offset: startOffset + i, charCount: 1 }),
    );
  }
};

const fresh = () => new AuthorshipCoalescer({ sessionStartedAt: SESSION_START });

describe("AuthorshipCoalescer segmentation", () => {
  it("merges contiguous typing into one segment", () => {
    const coalescer = fresh();
    type(coalescer, 10, 100);
    coalescer.closeOpen();

    const segments = coalescer.drain();
    assert.equal(segments.length, 1);
    assert.equal(segments[0].charCount, 10);
    assert.equal(segments[0].keystrokeCount, 10);
    assert.equal(segments[0].text, "aaaaaaaaaa");
  });

  it("splits on an idle gap, and not just under it", () => {
    const under = fresh();
    under.record(make({ at: SESSION_START, offset: 0 }));
    under.record(make({ at: SESSION_START + 2_000, offset: 1 }));
    under.closeOpen();
    assert.equal(under.drain().length, 1, "2000ms is not yet a break");

    const over = fresh();
    over.record(make({ at: SESSION_START, offset: 0 }));
    over.record(make({ at: SESSION_START + 2_001, offset: 1 }));
    over.closeOpen();
    assert.equal(over.drain().length, 2, "past 2000ms starts a new run");
  });

  it("splits when the edit jumps elsewhere in the file", () => {
    const coalescer = fresh();
    coalescer.record(make({ at: SESSION_START, offset: 0 }));
    // Cursor moved to a different function entirely.
    coalescer.record(make({ at: SESSION_START + 100, offset: 400 }));
    coalescer.closeOpen();

    assert.equal(coalescer.drain().length, 2);
  });

  it("tolerates a character of slack so auto-closed brackets do not split a run", () => {
    const coalescer = fresh();
    coalescer.record(make({ at: SESSION_START, offset: 0 }));
    coalescer.record(make({ at: SESSION_START + 100, offset: 2 }));
    coalescer.closeOpen();

    assert.equal(coalescer.drain().length, 1);
  });

  it("splits when the candidate switches from adding to deleting", () => {
    const coalescer = fresh();
    coalescer.record(make({ at: SESSION_START, offset: 0 }));
    coalescer.record(
      make({ at: SESSION_START + 100, offset: 1, op: "delete", text: undefined }),
    );
    coalescer.closeOpen();

    const segments = coalescer.drain();
    assert.equal(segments.length, 2);
    assert.equal(segments[0].op, "insert");
    assert.equal(segments[1].op, "delete");
  });

  it("splits once a run reaches the character cap", () => {
    const coalescer = fresh();
    type(coalescer, 501, 10);
    coalescer.closeOpen();

    const segments = coalescer.drain();
    assert.equal(segments.length, 2);
    assert.equal(segments[0].charCount, 500);
    assert.equal(segments[1].charCount, 1);
  });

  it("never merges a paste with typing around it", () => {
    // A paste is one discrete act; a segment that is half pasted and half typed
    // would carry a cadence that describes neither.
    const coalescer = fresh();
    coalescer.record(make({ at: SESSION_START, offset: 0 }));
    coalescer.record(
      make({
        at: SESSION_START + 100,
        offset: 1,
        charCount: 200,
        text: "x".repeat(200),
        viaPaste: true,
      }),
    );
    coalescer.record(make({ at: SESSION_START + 200, offset: 201 }));
    coalescer.closeOpen();

    const segments = coalescer.drain();
    assert.equal(segments.length, 3);
    assert.equal(segments[1].viaPaste, true);
    assert.equal(segments[0].viaPaste, false);
    assert.equal(segments[2].viaPaste, false);
  });

  it("splits when the question or language changes", () => {
    const coalescer = fresh();
    coalescer.record(make({ at: SESSION_START, offset: 0 }));
    coalescer.record(
      make({ at: SESSION_START + 100, offset: 1, language: "python" }),
    );
    coalescer.closeOpen();

    assert.equal(coalescer.drain().length, 2);
  });

  it("ignores a change that moved nothing", () => {
    // A zero-length change carries no information and would contribute a
    // zero-length interval, dragging the cadence statistics toward metronomic.
    const coalescer = fresh();
    coalescer.record(make({ charCount: 0, text: "" }));
    coalescer.closeOpen();

    assert.equal(coalescer.drain().length, 0);
  });
});

describe("AuthorshipCoalescer measures", () => {
  it("records offsets relative to the session, never absolute time", () => {
    const coalescer = fresh();
    type(coalescer, 3, 100, SESSION_START + 45_000, 0);
    coalescer.closeOpen();

    const [segment] = coalescer.drain();
    assert.equal(segment.tOffsetMs, 45_000);
    assert.equal(segment.durationMs, 200);
  });

  it("clamps an offset before the session start rather than going negative", () => {
    // Happens when the client clock steps backwards mid-session.
    const coalescer = new AuthorshipCoalescer({
      sessionStartedAt: SESSION_START,
    });
    coalescer.record(make({ at: SESSION_START - 5_000 }));
    coalescer.closeOpen();

    assert.equal(coalescer.drain()[0].tOffsetMs, 0);
  });

  it("reports steady typing as near-zero spread", () => {
    // The transcription detector reads exactly this: someone copying from an
    // overlay types like a metronome, and original composition does not.
    const coalescer = fresh();
    type(coalescer, 20, 100);
    coalescer.closeOpen();

    const [segment] = coalescer.drain();
    assert.equal(segment.meanInterKeyMs, 100);
    assert.equal(segment.stdDevInterKeyMs, 0);
  });

  it("reports uneven typing as real spread", () => {
    const coalescer = fresh();
    let at = SESSION_START;
    [50, 400, 90, 700, 120, 60].forEach((gap, index) => {
      at += gap;
      coalescer.record(make({ at, offset: index }));
    });
    coalescer.closeOpen();

    const [segment] = coalescer.drain();
    assert.ok(
      segment.stdDevInterKeyMs > 100,
      `expected real spread, got ${segment.stdDevInterKeyMs}`,
    );
  });

  it("counts single-character deletions as backspaces", () => {
    const coalescer = fresh();
    for (let i = 0; i < 4; i += 1) {
      coalescer.record(
        make({
          at: SESSION_START + i * 100,
          offset: 10 - i,
          op: "delete",
          charCount: 1,
          text: undefined,
        }),
      );
    }
    coalescer.closeOpen();

    const [segment] = coalescer.drain();
    assert.equal(segment.backspaceCount, 4);
    assert.equal(segment.text, undefined, "deletes need only a length");
  });

  it("caps stored text without misreporting the character count", () => {
    // The count must stay truthful even though the text is truncated, otherwise
    // the size of what was written no longer matches what is shown.
    const coalescer = new AuthorshipCoalescer({
      sessionStartedAt: SESSION_START,
      maxChars: 10_000,
      maxText: 50,
    });
    coalescer.record(
      make({ charCount: 400, text: "y".repeat(400), viaPaste: true }),
    );
    coalescer.closeOpen();

    const [segment] = coalescer.drain();
    assert.equal(segment.text?.length, 50);
    assert.equal(segment.charCount, 400);
  });
});

describe("AuthorshipCoalescer draining", () => {
  it("leaves the run in progress open so it can still grow", () => {
    const coalescer = fresh();
    type(coalescer, 3, 100);

    assert.equal(coalescer.size(), 0, "an open run is not yet drainable");
    assert.deepEqual(coalescer.drain(), []);

    coalescer.closeOpen();
    assert.equal(coalescer.size(), 1);
  });

  it("hands each segment over exactly once", () => {
    const coalescer = fresh();
    type(coalescer, 3, 100);
    coalescer.closeOpen();

    assert.equal(coalescer.drain().length, 1);
    assert.equal(coalescer.drain().length, 0, "a drained segment must not repeat");
  });

  it("is safe to close when nothing is open", () => {
    const coalescer = fresh();
    coalescer.closeOpen();
    coalescer.closeOpen();
    assert.equal(coalescer.drain().length, 0);
  });
});
