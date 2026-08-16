import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { ProctoringBuffer } from "./buffer.ts";
import type { ProctoringEvent } from "./types.ts";

/**
 * A fake clock rather than real time: these tests assert on durations, and
 * sleeping to produce them would make them slow and flaky at once.
 */
const makeClock = (start = 1_000_000) => {
  let current = start;
  return {
    now: () => current,
    advance: (ms: number) => {
      current += ms;
    },
  };
};

const makeBuffer = () => {
  const clock = makeClock();
  const flushed: ProctoringEvent[][] = [];
  const buffer = new ProctoringBuffer({
    now: clock.now,
    onFlush: (events) => flushed.push(events),
  });
  return { clock, flushed, buffer };
};

describe("ProctoringBuffer absence collapsing", () => {
  it("turns a blur/focus pair into one event carrying a duration", () => {
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("focus.lost");
    clock.advance(5_000);
    buffer.endAbsence("focus.lost");

    const events = buffer.drain();
    assert.equal(events.length, 1, "expected one interval event, not two edges");
    assert.equal(events[0].kind, "focus.lost");
    assert.equal(events[0].durationMs, 5_000);
  });

  it("drops flickers shorter than the debounce threshold", () => {
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("focus.lost");
    clock.advance(300);
    buffer.endAbsence("focus.lost");

    assert.deepEqual(buffer.drain(), [], "a 300ms flicker is window-manager noise");
  });

  it("keeps an absence exactly at the threshold", () => {
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("tab.hidden");
    clock.advance(1_000);
    buffer.endAbsence("tab.hidden");

    assert.equal(buffer.drain().length, 1);
  });

  it("tracks tab and window absences independently", () => {
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("focus.lost");
    buffer.beginAbsence("tab.hidden");
    clock.advance(4_000);
    buffer.endAbsence("tab.hidden");
    clock.advance(3_000);
    buffer.endAbsence("focus.lost");

    const events = buffer.drain();
    assert.equal(events.length, 2);
    const byKind = Object.fromEntries(events.map((e) => [e.kind, e.durationMs]));
    assert.equal(byKind["tab.hidden"], 4_000);
    assert.equal(byKind["focus.lost"], 7_000);
  });

  it("ignores an end without a matching begin", () => {
    const { buffer } = makeBuffer();
    buffer.endAbsence("focus.lost");
    assert.deepEqual(buffer.drain(), []);
  });

  it("closes an open absence when the session ends", () => {
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("focus.lost");
    clock.advance(9_000);
    const events = buffer.closeOpenAbsences();

    assert.equal(events.length, 1);
    assert.equal(events[0].durationMs, 9_000);
  });
});

describe("ProctoringBuffer flushing", () => {
  it("hands buffered events to onFlush and empties itself", () => {
    const { flushed, buffer } = makeBuffer();

    buffer.push({ kind: "editor.bulkInsert", tier: "a", startedAt: 1, magnitude: 500 });
    buffer.flush();

    assert.equal(flushed.length, 1);
    assert.equal(flushed[0].length, 1);
    assert.equal(buffer.size(), 0);
  });

  it("does not call onFlush when there is nothing to send", () => {
    const { flushed, buffer } = makeBuffer();
    buffer.flush();
    assert.equal(flushed.length, 0, "an empty flush must not cost a mutation");
  });

  it("flushes automatically once the buffer is full", () => {
    const { flushed, buffer } = makeBuffer();

    for (let index = 0; index < 60; index += 1) {
      buffer.push({ kind: "window.geometry", tier: "b", startedAt: index });
    }

    assert.ok(flushed.length >= 1, "a full buffer must not grow without bound");
  });
});

describe("ProctoringBuffer masking intervals", () => {
  it("collapses a mask/unmask pair into one event with a duration", () => {
    // Masking reuses the absence machinery precisely so it inherits this. What
    // an interviewer needs is how long the problem was hidden, not how many
    // times the candidate bounced out of fullscreen.
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("content.masked");
    clock.advance(12_000);
    buffer.endAbsence("content.masked");

    const events = buffer.drain();
    assert.equal(events.length, 1);
    assert.equal(events[0].kind, "content.masked");
    assert.equal(events[0].durationMs, 12_000);
  });

  it("drops a mask shorter than the debounce", () => {
    // Alt-tabbing through the window, or a window manager repaint, can drop and
    // restore fullscreen within a few hundred milliseconds. Recording those
    // would bury the real signal in noise.
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("content.masked");
    clock.advance(400);
    buffer.endAbsence("content.masked");

    assert.equal(buffer.drain().length, 0);
  });

  it("closes an open mask when the page goes away", () => {
    // A candidate who closes the tab while masked must not have that time
    // silently vanish from the record.
    const { clock, buffer } = makeBuffer();

    buffer.beginAbsence("content.masked");
    clock.advance(30_000);

    const closed = buffer.closeOpenAbsences();
    assert.equal(closed.length, 1);
    assert.equal(closed[0].kind, "content.masked");
    assert.equal(closed[0].durationMs, 30_000);
  });
});
