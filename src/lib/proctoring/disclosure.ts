import type { IntegrityMode } from "../../../convex/lib/integrityModes.ts";

/**
 * The pre-join disclosure, per integrity mode.
 *
 * v1's disclosure described what is *recorded*. Deterrent mode also constrains
 * what the candidate may *do*, and a gate that omits the rules it is about to
 * enforce is not disclosure — it is a surprise. So the copy is keyed off the
 * same mode the enforcement code branches on.
 *
 * The anti-drift guarantee here is mechanical rather than a matter of care:
 * `Record<MonitoredMode, ...>` is exhaustive, so adding a mode to
 * `INTEGRITY_MODES` fails to compile until someone writes what that mode tells
 * the candidate. Proximity in a file would not have forced that.
 *
 * Design: docs/superpowers/specs/2026-08-15-interview-integrity-v2-design.md §7
 */

/** `off` shows no disclosure at all, because there is nothing to disclose. */
export type MonitoredMode = Exclude<IntegrityMode, "off">;

export type DisclosureCopy = {
  heading: string;
  /** What is recorded, what is not, and who reads it. Rendered in order. */
  paragraphs: string[];
  /** Rules enforced during the interview. Empty when nothing is enforced. */
  rules: string[];
  fullscreen: {
    required: boolean;
    label: string;
    hint: string;
  };
  acknowledgement: string;
};

const RECORDED_OBSERVE =
  "While you are in the interview we record when the window loses focus, when the tab is hidden, when a large block of text is inserted into the editor, and whether a second display is connected.";

const NOT_RECORDED =
  "We do not analyse your camera or microphone, capture your screen, record what you type, or look at anything outside this tab.";

const AUDIENCE =
  "Your interviewer and the hiring team can see this record. It is kept for 90 days and then deleted. These are signals rather than proof, and they are read alongside the interview itself, not instead of it.";

export const INTEGRITY_DISCLOSURE: Record<MonitoredMode, DisclosureCopy> = {
  observe: {
    heading: "This interview is monitored for integrity",
    paragraphs: [RECORDED_OBSERVE, NOT_RECORDED, AUDIENCE],
    rules: [],
    fullscreen: {
      required: false,
      label: "Start in fullscreen",
      hint: "Optional. Browsers only allow this from a button, so it cannot be turned on later.",
    },
    acknowledgement:
      "I understand this interview is monitored as described above.",
  },

  deterrent: {
    heading: "This interview is monitored, and has rules",
    paragraphs: [RECORDED_OBSERVE, NOT_RECORDED, AUDIENCE],
    // Stated as plainly as possible. A candidate who is surprised mid-interview
    // by the screen blurring will assume something broke, and an integrity
    // measure that reads as a bug is worse than none.
    rules: [
      "The interview runs in fullscreen. If you leave fullscreen, the problem and the editor are hidden until you return — nothing is deleted, and you can come back at any time.",
      "Pasting into the code editor is disabled. Type your solution.",
      "If fullscreen does not work for you — a screen reader, a magnifier, or anything else — there is a button to say so. The rule stops applying and your interviewer is told you used it.",
    ],
    fullscreen: {
      required: true,
      label: "Start in fullscreen",
      hint: "Required for this interview. Browsers only allow this from a button, so it happens when you join.",
    },
    acknowledgement:
      "I understand this interview is monitored and has the rules described above.",
  },
};
