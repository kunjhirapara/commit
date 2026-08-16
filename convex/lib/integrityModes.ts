/**
 * The single source of truth for interview integrity modes.
 *
 * Deliberately dependency-free, for the same reason `permissions.ts` is: the
 * Convex functions, the scheduling UI, and the meeting client all need to agree
 * on what a mode means, and a second copy would drift. It lives under `convex/`
 * rather than `src/` because Convex is the side that must be authoritative —
 * the server reads the mode off the interview row and the browser is told what
 * it decided.
 *
 * Design: docs/superpowers/specs/2026-08-15-interview-integrity-v2-design.md §1
 */

export const INTEGRITY_MODES = ["off", "observe", "deterrent"] as const;

export type IntegrityMode = (typeof INTEGRITY_MODES)[number];

/**
 * What an interview with no mode set means.
 *
 * `observe`, so that every interview scheduled before this feature existed keeps
 * behaving exactly as it did — v1's silent monitoring — and no migration is
 * needed. Defaulting to `off` would silently stop monitoring interviews that are
 * being monitored today; defaulting to `deterrent` would start enforcing rules
 * nobody agreed to.
 */
export const DEFAULT_INTEGRITY_MODE: IntegrityMode = "observe";

export const isIntegrityMode = (value: unknown): value is IntegrityMode =>
  typeof value === "string" &&
  (INTEGRITY_MODES as readonly string[]).includes(value);

/**
 * Normalises whatever is on the interview row into a mode.
 *
 * Unrecognised values fall back to the default rather than throwing. A row
 * written by an older or newer deployment must never be able to break joining an
 * interview, and the safe direction is the behaviour that already exists.
 */
export const resolveIntegrityMode = (value: unknown): IntegrityMode =>
  isIntegrityMode(value) ? value : DEFAULT_INTEGRITY_MODE;

/** Whether anything at all is recorded. `off` writes no session row and no events. */
export const isMonitored = (mode: IntegrityMode): boolean => mode !== "off";

/**
 * Whether rules are enforced against the candidate rather than merely recorded.
 *
 * This is the line between v1's silent monitoring and v2's visible deterrence,
 * and it is the only predicate any enforcement code should branch on. Comparing
 * against the string literal at call sites is how the two halves drift apart.
 */
export const isEnforcing = (mode: IntegrityMode): boolean =>
  mode === "deterrent";

/** Short label for the report header and the scheduling form. */
export const INTEGRITY_MODE_LABELS: Record<IntegrityMode, string> = {
  off: "Not monitored",
  observe: "Monitored quietly",
  deterrent: "Monitored with rules enforced",
};

/**
 * What each mode means, in the words shown to whoever is scheduling.
 *
 * Written for a recruiter choosing between them, not for an engineer.
 */
export const INTEGRITY_MODE_DESCRIPTIONS: Record<IntegrityMode, string> = {
  off: "Nothing is recorded. Use for conversations with nothing to solve.",
  observe:
    "Focus changes, pastes and second displays are recorded. The candidate is told before joining and never interrupted.",
  deterrent:
    "Everything above, plus fullscreen is required, the problem is hidden if they leave it, and pasting into the editor is blocked.",
};
