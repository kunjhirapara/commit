import { PROCTORING_THRESHOLDS } from "./thresholds.ts";
import type { AuthorshipSegment } from "./authorship.ts";

/**
 * Reads the edit history and says what looks worth asking about.
 *
 * The framing matters and is not decoration. Every function here produces a
 * *question for an interviewer*, never a verdict. Nothing in this file decides
 * anything, nothing feeds a score, and every flag carries the rule that produced
 * it so a reader can disagree with the rule rather than with an unexplained
 * output.
 *
 * What these detectors can and cannot do, stated once, plainly:
 *
 * - A slow, deliberate typist copying from **their own legitimate notes** is
 *   indistinguishable from one copying from an AI overlay. This cannot tell them
 *   apart and must never claim to.
 * - Someone using a **second device** produces a flawless history. Nothing here
 *   reaches them.
 * - The strongest available check remains a human asking the candidate to
 *   explain and change their own code, which is why every flag ships with a
 *   probe rather than a conclusion.
 *
 * Design: docs/superpowers/specs/2026-08-15-interview-integrity-v2-design.md §3.4
 */

const { authorship } = PROCTORING_THRESHOLDS;

export const AUTHORSHIP_FLAG_KINDS = [
  "typing.transcription",
  "typing.burstAfterIdle",
  "typing.impossibleSpeed",
  "edit.noRefinement",
] as const;

export type AuthorshipFlagKind = (typeof AUTHORSHIP_FLAG_KINDS)[number];

export type AuthorshipFlag = {
  kind: AuthorshipFlagKind;
  /** Where in the session this happened, so the replay can jump to it. */
  tOffsetMs: number;
  /** Index into the segment list, for the same reason. */
  segmentIndex: number;
  /** What was observed, in plain words. */
  detail: string;
  /** The rule that fired, so it can be argued with. */
  rule: string;
  /** What to actually do about it. Never "reject". */
  probe: string;
};

export type TypingProfile = {
  typedChars: number;
  pastedChars: number;
  deletedChars: number;
  /** Deletions as a fraction of insertions. Iteration, roughly measured. */
  refinementRatio: number;
  /** Mean cadence across typed runs, weighted by how long each run was. */
  meanInterKeyMs: number;
  segments: number;
};

const backspaceRate = (segment: AuthorshipSegment) =>
  segment.keystrokeCount === 0
    ? 0
    : segment.backspaceCount / segment.keystrokeCount;

const charsPerMinute = (segment: AuthorshipSegment) =>
  segment.durationMs <= 0
    ? 0
    : (segment.charCount / segment.durationMs) * 60_000;

/**
 * Typed runs only.
 *
 * A pasted segment arrives in one event and has no cadence to speak of — judging
 * it as though it were typed would flag every paste as machine-like, which is
 * both useless and unfair. Pastes are already covered by the insert thresholds
 * in severity banding.
 */
const isJudgeable = (segment: AuthorshipSegment) =>
  !segment.viaPaste &&
  segment.op !== "delete" &&
  segment.charCount >= authorship.minJudgeableChars;

export const buildTypingProfile = (
  segments: AuthorshipSegment[],
): TypingProfile => {
  let typedChars = 0;
  let pastedChars = 0;
  let deletedChars = 0;
  let cadenceWeight = 0;
  let cadenceTotal = 0;

  for (const segment of segments) {
    if (segment.op === "delete") {
      deletedChars += segment.charCount;
      continue;
    }
    if (segment.viaPaste) {
      pastedChars += segment.charCount;
      continue;
    }
    typedChars += segment.charCount;
    if (segment.meanInterKeyMs > 0) {
      cadenceTotal += segment.meanInterKeyMs * segment.charCount;
      cadenceWeight += segment.charCount;
    }
  }

  const inserted = typedChars + pastedChars;

  return {
    typedChars,
    pastedChars,
    deletedChars,
    refinementRatio: inserted === 0 ? 0 : deletedChars / inserted,
    meanInterKeyMs:
      cadenceWeight === 0 ? 0 : Math.round(cadenceTotal / cadenceWeight),
    segments: segments.length,
  };
};

/**
 * Typing so evenly spaced it does not look composed.
 *
 * Someone reading an answer and typing it out settles into a rhythm, because
 * they are transcribing rather than deciding. Someone writing their own code
 * pauses mid-identifier, backtracks, and rethinks — the spread in their timing
 * is the visible residue of thinking.
 *
 * Requires a low correction rate as well as low spread. Even, careful typing
 * with normal corrections is just a tidy programmer.
 */
const detectTranscription = (
  segment: AuthorshipSegment,
  index: number,
): AuthorshipFlag | null => {
  if (!isJudgeable(segment)) return null;
  if (segment.meanInterKeyMs <= 0) return null;

  const spread = segment.stdDevInterKeyMs / segment.meanInterKeyMs;
  if (spread >= authorship.transcriptionSpreadRatio) return null;
  if (backspaceRate(segment) >= authorship.lowBackspaceRate) return null;

  return {
    kind: "typing.transcription",
    tOffsetMs: segment.tOffsetMs,
    segmentIndex: index,
    detail: `${segment.charCount} characters typed at an unusually even pace (about ${segment.meanInterKeyMs}ms between keystrokes, varying by ${segment.stdDevInterKeyMs}ms) with almost no corrections.`,
    rule: `Fires on a typed run of ${authorship.minJudgeableChars}+ characters where timing varies by less than ${Math.round(authorship.transcriptionSpreadRatio * 100)}% of the average gap and under ${Math.round(authorship.lowBackspaceRate * 100)}% of keystrokes are corrections.`,
    probe:
      "Ask them to talk through this section and change something structural in it — a data structure, an edge case. Someone who wrote it will restructure it easily.",
  };
};

/**
 * A long silence, then a large clean block.
 *
 * The shape of reading an answer somewhere else and then typing it. The silence
 * is doing as much work as the burst: thinking usually shows up *inside* the
 * writing as pauses and corrections, not as one gap followed by fluency.
 */
const detectBurstAfterIdle = (
  segment: AuthorshipSegment,
  index: number,
  previous: AuthorshipSegment | undefined,
): AuthorshipFlag | null => {
  if (segment.viaPaste || segment.op === "delete") return null;
  if (segment.charCount < authorship.burstChars) return null;
  if (backspaceRate(segment) >= authorship.lowBackspaceRate) return null;

  const previousEnd = previous
    ? previous.tOffsetMs + previous.durationMs
    : null;
  const idleMs =
    previousEnd === null ? segment.tOffsetMs : segment.tOffsetMs - previousEnd;
  if (idleMs < authorship.burstIdleMs) return null;

  return {
    kind: "typing.burstAfterIdle",
    tOffsetMs: segment.tOffsetMs,
    segmentIndex: index,
    detail: `${Math.round(idleMs / 1000)}s with no editing, then ${segment.charCount} characters written with almost no corrections.`,
    rule: `Fires after ${Math.round(authorship.burstIdleMs / 1000)}s or more of no editing, when the next run is ${authorship.burstChars}+ characters with under ${Math.round(authorship.lowBackspaceRate * 100)}% corrections.`,
    probe:
      "Ask what they worked out during the pause. A candidate who was thinking can usually describe the dead ends they rejected.",
  };
};

/** Insertion faster than hands go. Rare, and unambiguous when it happens. */
const detectImpossibleSpeed = (
  segment: AuthorshipSegment,
  index: number,
): AuthorshipFlag | null => {
  if (segment.viaPaste || segment.op === "delete") return null;
  if (segment.charCount < authorship.burstChars) return null;

  const rate = charsPerMinute(segment);
  if (rate < authorship.impossibleCharsPerMinute) return null;

  return {
    kind: "typing.impossibleSpeed",
    tOffsetMs: segment.tOffsetMs,
    segmentIndex: index,
    detail: `${segment.charCount} characters appeared at about ${Math.round(rate)} characters per minute, which is faster than sustained typing.`,
    rule: `Fires on a typed run of ${authorship.burstChars}+ characters sustained above ${authorship.impossibleCharsPerMinute} characters per minute. A fast typist reaches roughly 600.`,
    probe:
      "Worth checking directly — this is more likely an editor macro, a snippet expansion, or a paste that avoided the clipboard than fast hands.",
  };
};

/**
 * A solution that arrived finished.
 *
 * Session-level rather than per-segment. Writing code is iterative: names get
 * changed, a loop becomes a map, an off-by-one gets fixed. A large solution with
 * essentially no deletions was composed somewhere that is not this editor.
 *
 * The weakest detector here, and the one most likely to be wrong about a strong
 * candidate solving a problem they have seen before. Tier A only because the
 * question it raises is a reasonable one to ask out loud.
 */
const detectNoRefinement = (
  segments: AuthorshipSegment[],
  profile: TypingProfile,
): AuthorshipFlag | null => {
  const inserted = profile.typedChars + profile.pastedChars;
  if (inserted < authorship.refinementMinChars) return null;
  if (profile.refinementRatio >= authorship.refinementDeleteRatio) return null;

  return {
    kind: "edit.noRefinement",
    tOffsetMs: segments[0]?.tOffsetMs ?? 0,
    segmentIndex: 0,
    detail: `${inserted} characters were written and only ${profile.deletedChars} deleted — the solution was barely revised.`,
    rule: `Fires when a solution reaches ${authorship.refinementMinChars}+ characters with deletions under ${Math.round(authorship.refinementDeleteRatio * 100)}% of what was written.`,
    probe:
      "Ask them to change a requirement — different input shape, an added constraint — and watch whether they edit fluently or start over.",
  };
};

/**
 * Every flag for a session, in the order they happened.
 *
 * Deliberately returns a list rather than a count or a score. The reader is
 * meant to look at each one next to the replay and decide; collapsing them into
 * a number is the thing this whole design refuses to do.
 */
export const detectAuthorshipFlags = (
  segments: AuthorshipSegment[],
): AuthorshipFlag[] => {
  const ordered = [...segments].sort((a, b) => a.tOffsetMs - b.tOffsetMs);
  const profile = buildTypingProfile(ordered);
  const flags: AuthorshipFlag[] = [];

  ordered.forEach((segment, index) => {
    const transcription = detectTranscription(segment, index);
    if (transcription) flags.push(transcription);

    const burst = detectBurstAfterIdle(segment, index, ordered[index - 1]);
    if (burst) flags.push(burst);

    const speed = detectImpossibleSpeed(segment, index);
    if (speed) flags.push(speed);
  });

  const refinement = detectNoRefinement(ordered, profile);
  if (refinement) flags.push(refinement);

  return flags.sort((a, b) => a.tOffsetMs - b.tOffsetMs);
};

/** Short label per flag kind, for badges and the dashboard. */
export const AUTHORSHIP_FLAG_LABELS: Record<AuthorshipFlagKind, string> = {
  "typing.transcription": "Evenly paced typing",
  "typing.burstAfterIdle": "Long pause, then a clean block",
  "typing.impossibleSpeed": "Faster than typing",
  "edit.noRefinement": "Barely revised",
};
