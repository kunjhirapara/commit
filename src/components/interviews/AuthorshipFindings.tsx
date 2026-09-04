"use client";

import { useQuery } from "convex/react";
import { useMemo, useState } from "react";
import { PenLineIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import {
  buildTypingProfile,
  detectAuthorshipFlags,
  AUTHORSHIP_FLAG_LABELS,
} from "@/lib/proctoring/detectors";
import type { AuthorshipSegment } from "@/lib/proctoring/authorship";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * What the edit history suggests, and what to ask about it.
 *
 * The detectors are computed here rather than on the server for the same reason
 * severity is: the thresholds live in one file next to the words that describe
 * them, so the rule shown to a reader is provably the rule that ran.
 *
 * Every element of this component is shaped by one decision from the design: a
 * flag is a question for an interviewer, never a verdict. So each one shows what
 * was observed, the rule that fired, and something to actually do — and there is
 * no count, no score, and no colour coding by severity. A red badge would do the
 * work of a verdict without having to argue for one.
 */
function AuthorshipFindings({ interviewId }: { interviewId: string }) {
  const history = useQuery(api.proctoring.getAuthorshipHistory, {
    interviewId: interviewId as never,
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const segments = useMemo(
    () => (history?.segments ?? []) as AuthorshipSegment[],
    [history],
  );
  const flags = useMemo(() => detectAuthorshipFlags(segments), [segments]);
  const profile = useMemo(() => buildTypingProfile(segments), [segments]);

  if (history === undefined) {
    return <Skeleton className="h-20 w-full rounded-xl" />;
  }

  // No history is not a clean history. A candidate on an older build, or one
  // whose reporting was blocked, produces exactly this — and the monitor gap in
  // the report above is where that shows up, not here.
  if (segments.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-border/70 px-3 py-2">
        <p className="text-xs text-muted-foreground">
          No edit history was recorded for this interview, so how the solution
          was written cannot be shown. This is not the same as nothing being
          found.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-background/60 p-3">
      <div className="flex items-center gap-2">
        <PenLineIcon
          className="size-3.5 text-muted-foreground"
          aria-hidden="true"
        />
        <h4 className="text-xs font-semibold">How the code was written</h4>
      </div>

      <div className="grid gap-2 text-xs sm:grid-cols-3">
        <div>
          <p className="text-muted-foreground">Typed</p>
          <p className="font-medium">{profile.typedChars} chars</p>
        </div>
        <div>
          <p className="text-muted-foreground">Pasted</p>
          <p className="font-medium">{profile.pastedChars} chars</p>
        </div>
        <div>
          <p className="text-muted-foreground">Deleted while working</p>
          <p className="font-medium">{profile.deletedChars} chars</p>
        </div>
      </div>

      {flags.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          Nothing in the edit history stood out. Bear in mind this only sees this
          editor — someone working from a second device leaves no trace here.
        </p>
      ) : (
        <ul className="space-y-2">
          {flags.map((flag, index) => {
            const key = `${flag.kind}-${index}`;
            const isOpen = expanded === key;
            return (
              <li
                key={key}
                className="rounded-lg border border-border/70 bg-muted/20 px-3 py-2">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <p className="text-xs font-medium">
                    {AUTHORSHIP_FLAG_LABELS[flag.kind]}
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    at {Math.round(flag.tOffsetMs / 1000)}s
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {flag.detail}
                </p>
                <p className="mt-1.5 text-xs">
                  <span className="font-medium">Worth asking: </span>
                  <span className="text-muted-foreground">{flag.probe}</span>
                </p>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : key)}
                  className="mt-1.5 text-[11px] text-muted-foreground underline-offset-4 hover:underline">
                  {isOpen ? "Hide the rule" : "What made this fire?"}
                </button>
                {isOpen ? (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {flag.rule}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-[11px] text-muted-foreground">
        These read the rhythm of editing, which is suggestive and not conclusive.
        Someone copying from their own notes looks the same as someone copying
        from anywhere else. Treat each as a question to ask, not an answer.
      </p>
    </div>
  );
}

export default AuthorshipFindings;
