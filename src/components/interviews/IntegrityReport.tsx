"use client";

import { useQuery } from "convex/react";
import { ShieldCheckIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { resolveSeverity } from "@/lib/proctoring/severity";
import { PROCTORING_CAVEAT } from "@/lib/proctoring/thresholds";
import type { ProctoringSummary, SeverityBand } from "@/lib/proctoring/types";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

const BAND_STYLES: Record<SeverityBand, string> = {
  clear:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  minor:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  notable:
    "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-300",
};

const BAND_LABEL: Record<SeverityBand, string> = {
  clear: "Nothing of note",
  minor: "Worth a look",
  notable: "Worth asking about",
};

const formatDuration = (ms: number) => {
  if (ms <= 0) return "none";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
};

/**
 * How the rules are described on the report.
 *
 * Not reusing `INTEGRITY_MODE_LABELS`, which is written for the person choosing
 * a mode while scheduling. This reader is looking backwards at what happened.
 */
const MODE_LABEL: Record<string, string> = {
  off: "Not monitored",
  observe: "Observed",
  deterrent: "Rules enforced",
};

const DISPLAY_LABEL: Record<string, string> = {
  extended: "Second display connected",
  single: "Single display",
  // Never "no second display": the browser could not answer, and saying
  // otherwise would present an unanswered question as a passed check.
  unsupported: "Could not be checked on this browser",
};

/**
 * States what happened to the fullscreen rule.
 *
 * Presented as a fact with its reason, never as a mark against the candidate.
 * The exemption exists so someone using a screen reader or a magnifier can sit
 * the interview at all; a reader who treats it as evasion turns an
 * accessibility accommodation into a penalty, which is precisely what the
 * escape hatch was added to avoid. The wording here is doing that work.
 */
function FullscreenRuleNote({
  exempted,
  enforcementActive,
  exemptedAt,
  reason,
}: {
  exempted: boolean;
  enforcementActive: boolean;
  exemptedAt?: number;
  reason?: string;
}) {
  if (!enforcementActive) {
    return (
      <p className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        This interview was set to enforce rules, but enforcement was switched off
        at the time, so none were applied. Read this as an observed session.
      </p>
    );
  }

  if (!exempted) return null;

  return (
    <div className="rounded-xl border border-border/70 bg-muted/30 px-3 py-2">
      <p className="text-xs font-medium">Fullscreen was not required</p>
      <p className="mt-1 text-xs text-muted-foreground">
        The candidate said fullscreen was unusable
        {exemptedAt ? ` at ${new Date(exemptedAt).toLocaleTimeString()}` : ""}
        {reason && reason !== "browser-refused" ? `: “${reason}”` : ""}
        {reason === "browser-refused"
          ? ", because their browser refused the request"
          : ""}
        . This is a supported option, offered for screen readers, magnifiers and
        similar. It is shown so you know the rule stopped applying — not as
        something to hold against them.
      </p>
    </div>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-background/70 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 text-sm font-medium">{value}</p>
    </div>
  );
}

/**
 * Interview integrity report.
 *
 * Deliberately shows measures and a band rather than a score. A single number
 * reads as a verdict and invites a decision on "73/100" without anyone reading
 * why; the band carries its reasons and the rule that produced it, so it can be
 * argued with.
 *
 * Read access is enforced server-side by `requireInterviewReviewAccess`, which
 * already excludes candidates — this component is never rendered for them, but
 * the query would refuse regardless.
 */
function IntegrityReport({ interviewId }: { interviewId: string }) {
  const report = useQuery(api.proctoring.getProctoringReport, {
    interviewId: interviewId as never,
  });

  if (report === undefined) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
      </div>
    );
  }

  // Not monitored is a genuinely different statement from monitored-and-clean,
  // and conflating them would be the single most misleading thing this
  // component could do.
  if (!report.monitored || !report.summary) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 p-4">
        <p className="text-sm font-medium">Integrity monitoring did not run</p>
        <p className="mt-1 text-sm text-muted-foreground">
          No monitoring session was recorded for this interview, so there is
          nothing to report. This is not the same as a clean result.
        </p>
      </div>
    );
  }

  const summary = report.summary as ProctoringSummary;
  const severity = resolveSeverity(summary);
  // Tier B counts live alongside the summary rather than inside it, so they
  // cannot accidentally be fed into severity banding.
  const offPrimaryHints = report.summary.offPrimaryHints ?? 0;
  const reloads = report.summary.reloads ?? 0;

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-card/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ShieldCheckIcon className="size-4 text-muted-foreground" aria-hidden="true" />
          <h3 className="text-sm font-semibold">Interview integrity</h3>
        </div>
        <div className="flex items-center gap-2">
          {/* The mode sits next to the band deliberately. "Nothing of note"
              under observe and under deterrent are different findings, and a
              reader who cannot see which rules applied cannot tell them apart. */}
          <span className="rounded-full border border-border/70 px-2.5 py-1 text-xs text-muted-foreground">
            {MODE_LABEL[summary.integrityMode] ?? summary.integrityMode}
          </span>
          <span
            className={cn(
              "rounded-full border px-2.5 py-1 text-xs font-medium",
              BAND_STYLES[severity.band],
            )}>
            {BAND_LABEL[severity.band]}
          </span>
        </div>
      </div>

      {severity.reasons.length > 0 ? (
        <ul className="space-y-1.5 text-sm text-muted-foreground">
          {severity.reasons.map((reason) => (
            <li key={reason} className="flex gap-2">
              <span aria-hidden="true">•</span>
              <span>{reason}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">
          No signals were recorded during this interview.
        </p>
      )}

      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        <Measure
          label="Time away"
          value={formatDuration(summary.totalUnfocusedMs)}
        />
        <Measure
          label="Longest single absence"
          value={formatDuration(summary.longestAbsenceMs)}
        />
        <Measure
          label="Tab / window switches"
          value={`${summary.tabSwitches} / ${summary.windowSwitches}`}
        />
        <Measure
          label="Largest single insert"
          value={
            summary.largestInsertChars > 0
              ? `${summary.largestInsertChars} chars`
              : "none"
          }
        />
        <Measure
          label="Displays"
          value={DISPLAY_LABEL[summary.displaySupport] ?? summary.displaySupport}
        />
        <Measure
          label="Fullscreen"
          value={summary.fullscreenUsed ? "In use" : "Not in use"}
        />
        {/* Only meaningful where isExtended was unavailable — elsewhere the
            real answer is already shown above and this would double-count. */}
        {summary.displaySupport === "unsupported" ? (
          <Measure
            label="Window off primary screen"
            value={
              offPrimaryHints > 0
                ? `Seen ${offPrimaryHints}×`
                : "Not seen"
            }
          />
        ) : null}
        <Measure
          label="Page reloads"
          value={reloads > 0 ? String(reloads) : "none"}
        />
        {/* Deterrent-only measures. Shown only when rules were actually in
            force, because "0 blocked pastes" under observe would imply pasting
            had been prevented when nothing was ever blocked. */}
        {summary.integrityMode === "deterrent" ? (
          <>
            <Measure
              label="Problem hidden"
              value={formatDuration(summary.maskedMs)}
            />
            <Measure
              label="Pastes blocked"
              value={
                summary.blockedPastes > 0
                  ? String(summary.blockedPastes)
                  : "none"
              }
            />
          </>
        ) : null}
      </div>

      {summary.integrityMode === "deterrent" && report.session ? (
        <FullscreenRuleNote
          exempted={summary.fullscreenExempted}
          enforcementActive={summary.enforcementActive}
          exemptedAt={report.session.fullscreenExemptedAt}
          reason={report.session.fullscreenExemptionReason}
        />
      ) : null}

      {/* The rule is shown so a reader can disagree with it rather than with an
          unexplained band. */}
      <details className="rounded-xl border border-border/70 bg-background/60 px-3 py-2">
        <summary className="cursor-pointer text-xs font-medium text-muted-foreground">
          How this was judged
        </summary>
        <p className="mt-2 text-xs text-muted-foreground">{severity.rule}</p>
      </details>

      <p className="text-xs text-muted-foreground">{PROCTORING_CAVEAT}</p>
    </div>
  );
}

export default IntegrityReport;
