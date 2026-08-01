import {
  PROCTORING_THRESHOLDS,
  SEVERITY_RULE_TEXT,
} from "./thresholds.ts";
import type {
  ProctoringSummary,
  SeverityBand,
  SeverityResult,
} from "./types.ts";

const { severity } = PROCTORING_THRESHOLDS;

const formatSeconds = (ms: number) => `${Math.round(ms / 1000)}s`;

/**
 * Turns a session summary into a band, the rule that produced it, and the
 * reasons behind it.
 *
 * There is deliberately no composite score. A single number reads as a verdict
 * and invites a rejection on "73/100" without anyone reading why; a band plus
 * its reasons forces the reader to look at what actually happened.
 *
 * Caveats — an unsupported display check, fullscreen never entered — are
 * returned in `reasons` without moving the band. They are things the reader
 * needs to know in order not to over-read a clean result, not evidence against
 * the candidate.
 */
export const resolveSeverity = (summary: ProctoringSummary): SeverityResult => {
  const notable: string[] = [];
  const minor: string[] = [];
  const caveats: string[] = [];

  if (summary.totalUnfocusedMs > severity.notableUnfocusedMs) {
    notable.push(
      `Away from the interview for ${formatSeconds(summary.totalUnfocusedMs)} in total.`,
    );
  } else if (summary.totalUnfocusedMs >= severity.minorUnfocusedMs) {
    minor.push(
      `Away from the interview for ${formatSeconds(summary.totalUnfocusedMs)} in total.`,
    );
  }

  if (summary.largestInsertChars > severity.notableInsertChars) {
    notable.push(
      `A single insert of ${summary.largestInsertChars} characters appeared in the editor.`,
    );
  } else if (summary.largestInsertChars > severity.minorInsertChars) {
    minor.push(
      `A single insert of ${summary.largestInsertChars} characters appeared in the editor.`,
    );
  }

  // Any gap is notable on its own. Without this, the cleanest possible report is
  // produced by disabling the monitor entirely, which would reward tampering.
  if (summary.monitorGaps > 0) {
    notable.push(
      summary.monitorGaps === 1
        ? "Monitoring stopped reporting once while the call was still connected."
        : `Monitoring stopped reporting ${summary.monitorGaps} times while the call was still connected.`,
    );
  }

  if (summary.maxClockSkewMs > severity.notableClockSkewMs) {
    notable.push(
      `The candidate's clock disagreed with the server by ${formatSeconds(summary.maxClockSkewMs)}.`,
    );
  }

  if (summary.extendedAppearedMidSession) {
    notable.push("A second display was connected after the interview started.");
  } else if (summary.displaySupport === "extended") {
    minor.push("A second display was connected for the interview.");
  }

  // Caveats: they change how a clean result should be read, without themselves
  // being evidence of anything.
  if (summary.displaySupport === "unsupported") {
    caveats.push(
      "Displays could not be checked on this browser, so a second screen would not have been detected.",
    );
  }

  if (!summary.fullscreenUsed) {
    caveats.push(
      "Fullscreen was not in use, so leaving fullscreen was not something that could be detected.",
    );
  }

  const band: SeverityBand =
    notable.length > 0 ? "notable" : minor.length > 0 ? "minor" : "clear";

  return {
    band,
    rule: SEVERITY_RULE_TEXT,
    reasons: [...notable, ...minor, ...caveats],
  };
};
