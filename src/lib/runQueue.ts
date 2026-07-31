/**
 * A small FIFO semaphore for the code-execution route.
 *
 * The runner spawns sibling Docker containers on the host, each capped at 0.5 CPU
 * and 128 MB. On a 4-core box the concurrency ceiling is what actually protects the
 * app tier from user code, so requests past the ceiling wait briefly instead of
 * failing immediately — a short queue converts a burst into latency rather than a
 * wall of 503s, while still shedding load once the queue itself is full.
 *
 * State is per-process and deliberately in-memory: it guards *this* container's
 * share of the host, so it must not be shared across replicas.
 */

export type RunQueueOptions = {
  maxConcurrent: number;
  maxQueueDepth: number;
  waitTimeoutMs: number;
};

export const DEFAULT_RUN_QUEUE_OPTIONS: RunQueueOptions = {
  // 3 × 0.5 CPU = 1.5 cores for user code, leaving headroom for Next.js, the
  // backup sidecar and the metrics exporters on a 4-core host.
  maxConcurrent: 3,
  maxQueueDepth: 12,
  waitTimeoutMs: 15_000,
};

export type RunQueueRejectionReason = "queue_full" | "wait_timeout";

export class RunQueueRejection extends Error {
  readonly reason: RunQueueRejectionReason;

  constructor(reason: RunQueueRejectionReason, message: string) {
    super(message);
    this.name = "RunQueueRejection";
    this.reason = reason;
  }
}

type Waiter = {
  resolve: () => void;
  reject: (error: RunQueueRejection) => void;
  timer: ReturnType<typeof setTimeout>;
};

type RunQueueState = {
  active: number;
  waiters: Waiter[];
};

const RUN_QUEUE_STATE_KEY = "__commit_run_queue_state__";

const getState = (): RunQueueState => {
  const globalState = globalThis as typeof globalThis & {
    [RUN_QUEUE_STATE_KEY]?: RunQueueState;
  };

  globalState[RUN_QUEUE_STATE_KEY] ??= { active: 0, waiters: [] };
  return globalState[RUN_QUEUE_STATE_KEY];
};

/** Snapshot for the metrics rollup and the developer dashboard. */
export const getRunQueueStats = () => {
  const state = getState();
  return { active: state.active, queued: state.waiters.length };
};

/**
 * Waits for a free execution slot.
 *
 * Resolves with a release function that MUST be called in a `finally` block —
 * failing to release leaks a slot permanently.
 *
 * Throws {@link RunQueueRejection} with reason `queue_full` when the queue is
 * saturated, or `wait_timeout` when a slot did not free up in time.
 */
export const acquireRunSlot = async (
  options: RunQueueOptions = DEFAULT_RUN_QUEUE_OPTIONS,
): Promise<() => void> => {
  const state = getState();

  if (state.active < options.maxConcurrent) {
    state.active += 1;
    return createRelease(options);
  }

  if (state.waiters.length >= options.maxQueueDepth) {
    throw new RunQueueRejection(
      "queue_full",
      "The code runner is at capacity. Please try again in a moment.",
    );
  }

  await new Promise<void>((resolve, reject) => {
    const waiter: Waiter = {
      resolve,
      reject,
      timer: setTimeout(() => {
        // Drop this waiter so a later release does not hand it a slot it can no
        // longer use, which would strand that slot until the next release.
        const index = state.waiters.indexOf(waiter);
        if (index !== -1) state.waiters.splice(index, 1);

        reject(
          new RunQueueRejection(
            "wait_timeout",
            "Timed out waiting for a code runner slot. Please try again.",
          ),
        );
      }, options.waitTimeoutMs),
    };

    state.waiters.push(waiter);
  });

  // A waiter is only resolved by `release`, which transfers its slot directly —
  // `state.active` already accounts for this run.
  return createRelease(options);
};

const createRelease = (options: RunQueueOptions) => {
  let released = false;

  return () => {
    if (released) return;
    released = true;

    const state = getState();
    const next = state.waiters.shift();

    if (next) {
      // Hand the slot straight over rather than decrementing and re-incrementing,
      // so a concurrent acquire cannot slip in ahead of a queued caller.
      clearTimeout(next.timer);
      next.resolve();
      return;
    }

    state.active = Math.max(0, state.active - 1);
    void options;
  };
};

/** Test-only: clears queue state between cases. */
export const resetRunQueue = () => {
  const state = getState();
  for (const waiter of state.waiters) {
    clearTimeout(waiter.timer);
    waiter.reject(new RunQueueRejection("queue_full", "Run queue was reset."));
  }
  state.waiters = [];
  state.active = 0;
};
