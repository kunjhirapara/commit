/**
 * Every tunable for interview integrity monitoring, in one place.
 *
 * Kept together deliberately: the UI renders the severity rule next to the band
 * it produced, so an interviewer can disagree with the rule rather than with an
 * unexplained number. That only works if there is exactly one definition of the
 * rule to render.
 *
 * These values are a forgiving starting point, not a calibrated model. They
 * should be revisited once there is real data behind them.
 */
export const PROCTORING_THRESHOLDS = {
  /**
   * Absences shorter than this are dropped. Clicking a notification, a transient
   * OS dialog, or a window manager repaint all produce sub-second blur/focus
   * pairs, and recording them would bury the real signal.
   */
  MIN_ABSENCE_MS: 1_000,

  /**
   * A single editor change larger than this is treated as a bulk insert.
   *
   * This is the sharpest signal available for a coding interview, because it
   * catches pasted code even when the DOM paste event is suppressed — the change
   * still arrives through the model. 120 characters is a few lines: comfortably
   * above autocomplete and snippet expansion, comfortably below a solution.
   */
  BULK_INSERT_CHARS: 120,

  /** How often buffered events are sent. One mutation carries a whole batch. */
  FLUSH_INTERVAL_MS: 15_000,

  /** Buffer size that forces an early flush, so memory cannot grow unbounded. */
  MAX_BUFFER_EVENTS: 50,

  /** Heartbeat cadence while the call is connected. */
  HEARTBEAT_MS: 30_000,

  /**
   * Idle gap that ends a run of editing.
   *
   * Two seconds is long enough to survive looking at the problem statement
   * mid-line, short enough that a genuine pause to think starts a new segment —
   * which is the boundary the burst-after-idle detector reads.
   */
  SEGMENT_IDLE_MS: 2_000,

  /**
   * Longest run of editing kept as one segment.
   *
   * A cap exists because cadence statistics over a very long run average away
   * the thing they are meant to expose: 500 characters of metronomic typing
   * inside 5,000 characters of normal work would vanish into the mean.
   */
  MAX_SEGMENT_CHARS: 500,

  /** Inserted text kept per segment. Enough to reconstruct, bounded for cost. */
  MAX_SEGMENT_TEXT: 2_000,

  /** Segments per mutation. One row carries a batch, as events do. */
  AUTHORSHIP_BATCH_SEGMENTS: 50,

  /** How often closed segments are sent. */
  AUTHORSHIP_FLUSH_INTERVAL_MS: 20_000,

  /**
   * Silence longer than this, while the call is still connected, is recorded as
   * a monitor gap. Generous enough to survive a slow network or a backgrounded
   * tab throttling timers, tight enough that disabling the monitor shows up.
   */
  HEARTBEAT_GRACE_MS: 90_000,

  severity: {
    /** At or above this much total unfocused time, the session is no longer clear. */
    minorUnfocusedMs: 30_000,
    /** Above this, notable. */
    notableUnfocusedMs: 120_000,
    /** Above this many characters in one insert, minor. */
    minorInsertChars: 120,
    /** Above this many characters in one insert, notable. */
    notableInsertChars: 400,
    /** Client/server clock disagreement above this is notable. */
    notableClockSkewMs: 30_000,
    /**
     * Time with the problem and editor hidden before the session stops being
     * clear, and the point beyond which it is notable.
     *
     * Deliberately more forgiving than the unfocused thresholds. Masking is a
     * consequence of a rule this application imposed, and a candidate whose
     * window manager dropped them out of fullscreen once should not be marked
     * for it. Sustained masking is different: the problem was on screen and then
     * it was not, for minutes, while they were meant to be solving it.
     */
    minorMaskedMs: 20_000,
    notableMaskedMs: 90_000,
  },
} as const;

/**
 * The rule, in the words the UI shows. Written out rather than generated from
 * the numbers so it reads like a sentence a person wrote.
 */
export const SEVERITY_RULE_TEXT =
  "Clear: under 30s away, no bulk paste, and under 20s with the problem hidden. " +
  "Minor: up to 2 minutes away, or one paste of 121–400 characters, or up to 90s hidden. " +
  "Notable: more than any of those, or the monitor stopped reporting, or the clock was off, " +
  "or a second display appeared mid-interview.";

/**
 * Shown alongside every report. The feature is worth nothing if it is read as
 * proof, and a determined candidate with a phone produces a spotless record.
 */
export const PROCTORING_CAVEAT =
  "These are signals, not proof. They are reported by the candidate's browser, " +
  "so they can be incomplete, and someone using a second device would leave no " +
  "trace here at all. Read them as context for a conversation, not a verdict.";
