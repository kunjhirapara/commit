import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import {
  RunQueueRejection,
  acquireRunSlot,
  getRunQueueStats,
  resetRunQueue,
} from "./runQueue.ts";

const options = {
  maxConcurrent: 2,
  maxQueueDepth: 2,
  waitTimeoutMs: 50,
};

beforeEach(() => {
  resetRunQueue();
});

test("grants slots up to the concurrency ceiling", async () => {
  const first = await acquireRunSlot(options);
  const second = await acquireRunSlot(options);

  assert.equal(getRunQueueStats().active, 2);
  assert.equal(getRunQueueStats().queued, 0);

  first();
  second();
  assert.equal(getRunQueueStats().active, 0);
});

test("queues past the ceiling and hands the slot to the waiter on release", async () => {
  const first = await acquireRunSlot(options);
  await acquireRunSlot(options);

  let granted = false;
  const pending = acquireRunSlot(options).then((release) => {
    granted = true;
    return release;
  });

  // Still waiting: both slots are held.
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(granted, false);
  assert.equal(getRunQueueStats().queued, 1);

  first();
  const release = await pending;

  assert.equal(granted, true);
  // The released slot transferred straight to the waiter, so active stays at 2.
  assert.equal(getRunQueueStats().active, 2);
  assert.equal(getRunQueueStats().queued, 0);
  release();
});

test("rejects with queue_full once the queue is saturated", async () => {
  await acquireRunSlot(options);
  await acquireRunSlot(options);

  // Fill the queue to maxQueueDepth. These stay pending; swallow their eventual
  // timeout rejections so they do not surface as unhandled.
  void acquireRunSlot(options).catch(() => {});
  void acquireRunSlot(options).catch(() => {});

  await assert.rejects(
    () => acquireRunSlot(options),
    (error: unknown) => {
      assert.ok(error instanceof RunQueueRejection);
      assert.equal(error.reason, "queue_full");
      return true;
    },
  );
});

test("rejects with wait_timeout when no slot frees up in time", async () => {
  await acquireRunSlot(options);
  await acquireRunSlot(options);

  await assert.rejects(
    () => acquireRunSlot(options),
    (error: unknown) => {
      assert.ok(error instanceof RunQueueRejection);
      assert.equal(error.reason, "wait_timeout");
      return true;
    },
  );

  // The timed-out waiter must be removed, otherwise a later release would hand it
  // a slot nobody is waiting on and strand that slot.
  assert.equal(getRunQueueStats().queued, 0);
});

test("release is idempotent", async () => {
  const release = await acquireRunSlot(options);
  assert.equal(getRunQueueStats().active, 1);

  release();
  release();

  assert.equal(getRunQueueStats().active, 0);
});
