import { PROCTORING_THRESHOLDS } from "./thresholds.ts";

/**
 * Turns a stream of editor changes into a compact edit history.
 *
 * This is the client half of authorship telemetry. Two things about it are
 * deliberate and load-bearing, and both are easy to undo by accident.
 *
 * **It records the history of the document, not the typing rhythm of a person.**
 * Keystroke biometrics — identifying or authenticating someone from how they
 * type — is GDPR Article 9 special-category data, and is exactly why the v1
 * design refused it. An edit history is a property of the document, of the same
 * family as a version control history, and identifies nobody.
 *
 * The line is enforced mechanically rather than by intention: raw inter-key
 * intervals are accumulated here, reduced to a mean and a standard deviation,
 * and then dropped. Only the two statistics leave the browser, and a mean and a
 * standard deviation cannot be inverted into an identification template.
 *
 * **Any change that transmits the raw interval vector reopens the Article 9
 * question and is a new design decision, not a refactor.** This sentence is here
 * so whoever considers it finds the reason already written down.
 *
 * Design: docs/superpowers/specs/2026-08-15-interview-integrity-v2-design.md §3
 */

export type AuthorshipOp = "insert" | "delete" | "replace";

/** One raw change, as reported by the editor. Never stored in this shape. */
export type EditorChange = {
  /** Client clock. Only ever used for deltas, never for ordering on the server. */
  at: number;
  op: AuthorshipOp;
  /** Character offset in the document where the change landed. */
  offset: number;
  charCount: number;
  /** Present for inserts. Deletes need only a length. */
  text?: string;
  viaPaste: boolean;
  language: string;
  questionId: string;
};

export type AuthorshipSegment = {
  /** Start, relative to the session. Server-anchored by the caller. */
  tOffsetMs: number;
  op: AuthorshipOp;
  charCount: number;
  keystrokeCount: number;
  backspaceCount: number;
  durationMs: number;
  /** Cadence summary. The raw intervals never leave the browser. */
  meanInterKeyMs: number;
  stdDevInterKeyMs: number;
  text?: string;
  viaPaste: boolean;
  language: string;
  questionId: string;
};

type OpenSegment = {
  startedAt: number;
  lastAt: number;
  op: AuthorshipOp;
  /** Where the next contiguous change is expected to land. */
  nextOffset: number;
  charCount: number;
  keystrokeCount: number;
  backspaceCount: number;
  intervals: number[];
  textParts: string[];
  viaPaste: boolean;
  language: string;
  questionId: string;
};

/**
 * How far a change may land from where the previous one ended and still count as
 * the same run of editing.
 *
 * Zero would be too strict: Monaco reports an auto-closed bracket, or a
 * selection replacement, an index either side of where a naive cursor model
 * expects. One character of slack keeps ordinary typing in a single segment
 * without letting a jump to another function join it.
 */
const CONTIGUITY_SLACK = 1;

const mean = (values: number[]) =>
  values.length === 0
    ? 0
    : values.reduce((total, value) => total + value, 0) / values.length;

/**
 * Population standard deviation, rounded.
 *
 * Population rather than sample because these intervals are the whole of the
 * segment, not a draw from something larger. Fewer than two intervals has no
 * spread to measure and returns zero rather than NaN — a detector comparing
 * against NaN would silently never fire, which is the worst way for a check to
 * be wrong.
 */
const stdDev = (values: number[]) => {
  if (values.length < 2) return 0;
  const average = mean(values);
  const variance = mean(values.map((value) => (value - average) ** 2));
  return Math.round(Math.sqrt(variance));
};

export class AuthorshipCoalescer {
  private readonly sessionStartedAt: number;
  private readonly idleMs: number;
  private readonly maxChars: number;
  private readonly maxText: number;

  private open: OpenSegment | null = null;
  private closed: AuthorshipSegment[] = [];

  constructor(options: {
    /** Client-clock instant the session began, so offsets are relative to it. */
    sessionStartedAt: number;
    idleMs?: number;
    maxChars?: number;
    maxText?: number;
  }) {
    this.sessionStartedAt = options.sessionStartedAt;
    this.idleMs = options.idleMs ?? PROCTORING_THRESHOLDS.SEGMENT_IDLE_MS;
    this.maxChars = options.maxChars ?? PROCTORING_THRESHOLDS.MAX_SEGMENT_CHARS;
    this.maxText = options.maxText ?? PROCTORING_THRESHOLDS.MAX_SEGMENT_TEXT;
  }

  /**
   * Whether this change continues the run in progress.
   *
   * Each condition marks a real break in the act of writing: a pause long enough
   * to have been thinking, a jump elsewhere in the file, a switch between adding
   * and removing, or a run long enough that lumping more into it would blur the
   * cadence measure it carries.
   */
  private continues(change: EditorChange, open: OpenSegment): boolean {
    if (change.op !== open.op) return false;
    if (change.at - open.lastAt > this.idleMs) return false;
    if (Math.abs(change.offset - open.nextOffset) > CONTIGUITY_SLACK) {
      return false;
    }
    if (open.charCount + change.charCount > this.maxChars) return false;
    // A paste is one discrete act. Letting typed characters accrete onto it
    // would produce a segment that is neither, whose cadence means nothing.
    if (change.viaPaste !== open.viaPaste) return false;
    if (change.language !== open.language) return false;
    if (change.questionId !== open.questionId) return false;
    return true;
  }

  /** Where the cursor ends up after this change. */
  private advance(change: EditorChange): number {
    return change.op === "insert" || change.op === "replace"
      ? change.offset + change.charCount
      : change.offset;
  }

  private begin(change: EditorChange): void {
    this.open = {
      startedAt: change.at,
      lastAt: change.at,
      op: change.op,
      nextOffset: this.advance(change),
      charCount: change.charCount,
      keystrokeCount: 1,
      backspaceCount: change.op === "delete" && change.charCount === 1 ? 1 : 0,
      intervals: [],
      textParts: change.text ? [change.text] : [],
      viaPaste: change.viaPaste,
      language: change.language,
      questionId: change.questionId,
    };
  }

  record(change: EditorChange): void {
    // A change that moved nothing carries no information, and would distort the
    // cadence statistics by contributing a zero-length interval.
    if (change.charCount <= 0) return;

    if (this.open && !this.continues(change, this.open)) this.closeOpen();

    if (!this.open) {
      this.begin(change);
      return;
    }

    this.open.intervals.push(change.at - this.open.lastAt);
    this.open.lastAt = change.at;
    this.open.nextOffset = this.advance(change);
    this.open.charCount += change.charCount;
    this.open.keystrokeCount += 1;
    if (change.op === "delete" && change.charCount === 1) {
      this.open.backspaceCount += 1;
    }
    if (change.text) this.open.textParts.push(change.text);
  }

  /** Closes the run in progress, if any. Safe to call when nothing is open. */
  closeOpen(): void {
    const open = this.open;
    if (!open) return;
    this.open = null;

    const joined =
      open.op === "delete" ? "" : open.textParts.join("").slice(0, this.maxText);

    this.closed.push({
      tOffsetMs: Math.max(0, open.startedAt - this.sessionStartedAt),
      op: open.op,
      charCount: open.charCount,
      keystrokeCount: open.keystrokeCount,
      backspaceCount: open.backspaceCount,
      durationMs: open.lastAt - open.startedAt,
      meanInterKeyMs: Math.round(mean(open.intervals)),
      stdDevInterKeyMs: stdDev(open.intervals),
      text: joined.length > 0 ? joined : undefined,
      viaPaste: open.viaPaste,
      language: open.language,
      questionId: open.questionId,
    });
  }

  /** Hands over everything closed so far, leaving any run in progress open. */
  drain(): AuthorshipSegment[] {
    const batch = this.closed;
    this.closed = [];
    return batch;
  }

  /** Closed segments waiting to be sent. Excludes the run in progress. */
  size(): number {
    return this.closed.length;
  }
}
