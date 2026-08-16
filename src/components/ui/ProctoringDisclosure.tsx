"use client";

import { EyeIcon, ShieldAlertIcon } from "lucide-react";
import { Switch } from "./switch";
import {
  INTEGRITY_DISCLOSURE,
  type MonitoredMode,
} from "@/lib/proctoring/disclosure";

/**
 * Pre-join notice for interview integrity monitoring.
 *
 * This is not decoration. Monitoring is silent during the interview by design —
 * nothing is shown to the candidate when a signal fires — and this notice is
 * what makes that defensible rather than covert. Shipping the detectors without
 * it would change the character of the feature, so the join button stays
 * disabled until it is acknowledged.
 *
 * In `deterrent` mode it carries a second job: stating the rules that are about
 * to be enforced. A candidate surprised mid-interview by the screen blurring
 * will assume something broke, and an integrity measure that reads as a bug is
 * worse than none. All the wording lives in `@/lib/proctoring/disclosure` so it
 * cannot drift from the mode the enforcement code branches on.
 */
function ProctoringDisclosure({
  mode,
  acknowledged,
  onAcknowledgedChange,
  fullscreen,
  onFullscreenChange,
}: {
  mode: MonitoredMode;
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  fullscreen: boolean;
  onFullscreenChange: (next: boolean) => void;
}) {
  const copy = INTEGRITY_DISCLOSURE[mode];
  const fullscreenRequired = copy.fullscreen.required;

  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          {fullscreenRequired ? (
            <ShieldAlertIcon className="size-4" aria-hidden="true" />
          ) : (
            <EyeIcon className="size-4" aria-hidden="true" />
          )}
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">{copy.heading}</h3>
          {copy.paragraphs.map((paragraph) => (
            <p key={paragraph} className="text-sm text-muted-foreground">
              {paragraph}
            </p>
          ))}
        </div>
      </div>

      {copy.rules.length > 0 && (
        <div className="space-y-2 rounded-xl border border-amber-500/40 bg-amber-500/5 px-4 py-3">
          <p className="text-sm font-medium">While you are in the interview</p>
          <ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-amber-600 dark:marker:text-amber-400">
            {copy.rules.map((rule) => (
              <li key={rule}>{rule}</li>
            ))}
          </ul>
        </div>
      )}

      <label
        className={`flex items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 px-4 py-3 ${
          fullscreenRequired ? "cursor-default" : "cursor-pointer"
        }`}>
        <span className="text-sm font-medium">
          {copy.fullscreen.label}
          <span className="block text-xs font-normal text-muted-foreground">
            {copy.fullscreen.hint}
          </span>
        </span>
        <Switch
          checked={fullscreenRequired ? true : fullscreen}
          onCheckedChange={onFullscreenChange}
          // Required means required: leaving it switchable would let a candidate
          // opt out of the one rule the mode exists to apply. The exemption path
          // inside the interview is the supported way out, and it is recorded.
          disabled={fullscreenRequired}
          aria-label="Start the interview in fullscreen"
        />
      </label>

      <label className="flex cursor-pointer items-start gap-3 text-sm">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => onAcknowledgedChange(event.target.checked)}
          className="mt-0.5 size-4 cursor-pointer rounded border-border accent-primary"
        />
        <span>{copy.acknowledgement}</span>
      </label>
    </div>
  );
}

export default ProctoringDisclosure;
