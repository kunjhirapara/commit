import { PROCTORING_THRESHOLDS } from "./thresholds.ts";
import type {
  ProctoringAbsenceKind,
  ProctoringEvent,
} from "./types.ts";

type BufferOptions = {
  /** Injected so tests can advance time without sleeping. */
  now: () => number;
  onFlush: (events: ProctoringEvent[]) => void;
  minAbsenceMs?: number;
  maxEvents?: number;
};

/**
 * Collects proctoring signals on the client and hands them over in batches.
 *
 * This exists for cost as much as correctness. A candidate glancing at a second
 * monitor can produce hundreds of raw blur/focus edges an hour, and every one of
 * them would otherwise be a Convex mutation on a deployment already watched for
 * quota. Three things keep the volume sane:
 *
 * - absences are recorded as one interval with a duration, not two edges;
 * - anything shorter than `minAbsenceMs` is dropped as window-manager noise;
 * - events are batched, so one mutation carries many.
 */
export class ProctoringBuffer {
  private readonly now: () => number;
  private readonly onFlush: (events: ProctoringEvent[]) => void;
  private readonly minAbsenceMs: number;
  private readonly maxEvents: number;

  private pending: ProctoringEvent[] = [];
  private openAbsences = new Map<ProctoringAbsenceKind, number>();

  constructor(options: BufferOptions) {
    this.now = options.now;
    this.onFlush = options.onFlush;
    this.minAbsenceMs =
      options.minAbsenceMs ?? PROCTORING_THRESHOLDS.MIN_ABSENCE_MS;
    this.maxEvents = options.maxEvents ?? PROCTORING_THRESHOLDS.MAX_BUFFER_EVENTS;
  }

  /** Marks the start of an absence. A second call for the same kind is ignored. */
  beginAbsence(kind: ProctoringAbsenceKind, at: number = this.now()): void {
    if (this.openAbsences.has(kind)) return;
    this.openAbsences.set(kind, at);
  }

  /**
   * Closes an absence, emitting one event if it lasted long enough. An end
   * without a matching begin is ignored rather than guessed at — it happens on
   * page load if the tab starts hidden.
   */
  endAbsence(kind: ProctoringAbsenceKind, at: number = this.now()): void {
    const startedAt = this.openAbsences.get(kind);
    if (startedAt === undefined) return;

    this.openAbsences.delete(kind);
    const durationMs = at - startedAt;
    if (durationMs < this.minAbsenceMs) return;

    this.push({
      kind,
      tier: "a",
      startedAt,
      durationMs,
      magnitude: durationMs,
    });
  }

  /**
   * Closes anything still open, for when the call ends or the page unloads.
   * Returns the events so a caller can send them synchronously via sendBeacon.
   */
  closeOpenAbsences(at: number = this.now()): ProctoringEvent[] {
    const closed: ProctoringEvent[] = [];

    for (const [kind, startedAt] of this.openAbsences) {
      const durationMs = at - startedAt;
      if (durationMs < this.minAbsenceMs) continue;
      closed.push({
        kind,
        tier: "a",
        startedAt,
        durationMs,
        magnitude: durationMs,
      });
    }

    this.openAbsences.clear();
    for (const event of closed) this.pending.push(event);
    return closed;
  }

  push(event: ProctoringEvent): void {
    this.pending.push(event);
    if (this.pending.length >= this.maxEvents) this.flush();
  }

  /** Sends what is buffered. A no-op when empty, so idle calls cost nothing. */
  flush(): void {
    if (this.pending.length === 0) return;
    const batch = this.pending;
    this.pending = [];
    this.onFlush(batch);
  }

  /** Empties the buffer and returns its contents without invoking onFlush. */
  drain(): ProctoringEvent[] {
    const batch = this.pending;
    this.pending = [];
    return batch;
  }

  size(): number {
    return this.pending.length;
  }
}
