/**
 * Shared vocabulary for interview integrity monitoring.
 *
 * Design and rationale live in
 * docs/superpowers/specs/2026-08-01-interview-proctoring-design.md. The one
 * thing worth repeating here, because it constrains every type below: these
 * signals are client-reported and the candidate controls the browser. They are
 * evidence, not proof, and the absence of an event is not the absence of
 * cheating.
 */

/**
 * Tier A signals are surfaced in the summary an interviewer reads. Tier B are
 * recorded and shown in the detailed timeline only — they have benign
 * explanations often enough that they should never drive a conclusion alone.
 */
export type ProctoringTier = "a" | "b";

export const PROCTORING_EVENT_KINDS = [
  // Tier A
  "focus.lost",
  "tab.hidden",
  "fullscreen.exited",
  "editor.paste",
  "editor.bulkInsert",
  "display.extended",
  "monitor.gap",
  // Tier B
  "window.geometry",
  "page.reload",
  "input.idle",
  "clock.skew",
  "batch.throttled",
] as const;

export type ProctoringEventKind = (typeof PROCTORING_EVENT_KINDS)[number];

/** Absence-style signals, which are recorded as intervals rather than edges. */
export type ProctoringAbsenceKind = Extract<
  ProctoringEventKind,
  "focus.lost" | "tab.hidden"
>;

/**
 * Whether the browser could answer the multi-screen question at all.
 *
 * `screen.isExtended` is Chromium-only, and a `window-management`
 * Permissions-Policy makes it return false rather than throwing. Collapsing
 * either case into `single` would make an unanswerable check look like a passed
 * one, so the unknown is carried explicitly all the way to the UI.
 */
export type DisplaySupport = "extended" | "single" | "unsupported";

export type ProctoringEvent = {
  kind: ProctoringEventKind;
  tier: ProctoringTier;
  /** Client clock. The server records its own and stores the skew separately. */
  startedAt: number;
  durationMs?: number;
  /** Characters inserted, milliseconds absent — whatever the kind measures. */
  magnitude?: number;
  metadata?: Record<string, unknown>;
};

export type ProctoringSummary = {
  totalUnfocusedMs: number;
  longestAbsenceMs: number;
  tabSwitches: number;
  windowSwitches: number;
  fullscreenExits: number;
  largestInsertChars: number;
  totalPastedChars: number;
  /** Heartbeats missing while the call was still connected. */
  monitorGaps: number;
  maxClockSkewMs: number;
  displaySupport: DisplaySupport;
  /** A display appearing after the interview started is more telling than one present at join. */
  extendedAppearedMidSession: boolean;
  /** False means fullscreen was never entered, so exits mean nothing. */
  fullscreenUsed: boolean;
};

export type SeverityBand = "clear" | "minor" | "notable";

export type SeverityResult = {
  band: SeverityBand;
  /** The rule actually applied, so the UI can show it and be argued with. */
  rule: string;
  /** Human-readable reasons, including caveats that do not affect the band. */
  reasons: string[];
};
