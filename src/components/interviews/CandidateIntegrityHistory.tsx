"use client";

import { useQuery } from "convex/react";
import { format } from "date-fns";
import { api } from "../../../convex/_generated/api";
import { Skeleton } from "@/components/ui/skeleton";

const DISPLAY_LABEL: Record<string, string> = {
  extended: "Second display",
  single: "Single display",
  // Never "no second display" — the browser could not answer, and rendering
  // that as a clean result is the mistake this whole three-state exists to stop.
  unsupported: "Displays not checkable",
};

/**
 * A candidate's monitoring record across interviews.
 *
 * Shown per interview rather than as a running total, deliberately. A flag from
 * one session becoming a number that follows someone into every future
 * application is prejudicial, especially given how ordinary a stray focus event
 * is — the reader should judge each interview in its own context, which is hard
 * to do against an aggregate.
 *
 * Access is admin and recruiter only, enforced server-side in
 * `getCandidateProctoringHistory` rather than by rendering alone.
 */
function CandidateIntegrityHistory({
  candidateClerkId,
}: {
  candidateClerkId: string;
}) {
  const history = useQuery(api.proctoring.getCandidateProctoringHistory, {
    candidateClerkId,
  });

  if (history === undefined) {
    return <Skeleton className="h-20 w-full rounded-2xl" />;
  }

  if (history.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/70 bg-muted/20 px-4 py-3">
        <p className="text-sm text-muted-foreground">
          No monitored interviews on record for this candidate. Monitoring only
          covers interviews since it was introduced, and records are deleted
          after 90 days.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-sm font-semibold">Integrity history</h4>
        <span className="text-xs text-muted-foreground">
          {history.length} monitored {history.length === 1 ? "interview" : "interviews"}
        </span>
      </div>

      <div className="space-y-2">
        {history.map((session) => (
          <div
            key={String(session.interviewId)}
            className="rounded-xl border border-border/70 bg-background/70 px-3 py-2 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-medium">
                {format(new Date(session.startedAt), "d MMM yyyy, h:mm a")}
              </span>
              <span className="text-xs text-muted-foreground">
                {DISPLAY_LABEL[session.displaySupport] ?? session.displaySupport}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {session.eventsRecorded} signal
              {session.eventsRecorded === 1 ? "" : "s"} recorded
              {session.monitorGaps > 0
                ? ` · monitoring stopped reporting ${session.monitorGaps} time${session.monitorGaps === 1 ? "" : "s"}`
                : ""}
              {session.disclosureAcknowledged ? "" : " · disclosure not acknowledged"}
            </p>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Counts are not comparable between interviews of different lengths, and a
        signal is not an accusation. Open an interview to see what was actually
        recorded.
      </p>
    </div>
  );
}

export default CandidateIntegrityHistory;
