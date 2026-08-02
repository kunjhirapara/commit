"use client";

import { EyeIcon } from "lucide-react";
import { Switch } from "./switch";

/**
 * Pre-join notice for interview integrity monitoring.
 *
 * This is not decoration. Monitoring is silent during the interview by design —
 * nothing is shown to the candidate when a signal fires — and this notice is
 * what makes that defensible rather than covert. Shipping the detectors without
 * it would change the character of the feature, so the join button stays
 * disabled until it is acknowledged.
 *
 * The copy states what is recorded, what is not, who can see it and for how
 * long, matching the tone already set on /recording-disclosure. The "what is
 * not" half matters as much as the rest: without it a candidate has no way to
 * know their camera is not being analysed.
 */
function ProctoringDisclosure({
  acknowledged,
  onAcknowledgedChange,
  fullscreen,
  onFullscreenChange,
}: {
  acknowledged: boolean;
  onAcknowledgedChange: (next: boolean) => void;
  fullscreen: boolean;
  onFullscreenChange: (next: boolean) => void;
}) {
  return (
    <div className="space-y-4 rounded-2xl border border-border/70 bg-muted/30 p-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <EyeIcon className="size-4" aria-hidden="true" />
        </div>
        <div className="space-y-2">
          <h3 className="text-sm font-semibold">
            This interview is monitored for integrity
          </h3>
          <p className="text-sm text-muted-foreground">
            While you are in the interview we record when the window loses
            focus, when the tab is hidden, when a large block of text is inserted
            into the editor, and whether a second display is connected.
          </p>
          <p className="text-sm text-muted-foreground">
            Integrity monitoring does <strong>not</strong> analyse your camera or
            microphone, capture your screen, record what you type, or look at
            anything outside this tab.
          </p>
          <p className="text-sm text-muted-foreground">
            Separately, your interviewer may <strong>record the call</strong>,
            including your camera and microphone. If they start recording you
            will see a red &ldquo;Recording&rdquo; indicator for as long as it
            runs. Recordings are available to the hiring team.
          </p>
          <p className="text-sm text-muted-foreground">
            Your interviewer and the hiring team can see this record. It is kept
            for 90 days and then deleted. These are signals rather than proof,
            and they are read alongside the interview itself, not instead of it.
          </p>
        </div>
      </div>

      <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-border/70 bg-background/70 px-4 py-3">
        <span className="text-sm font-medium">
          Start in fullscreen
          <span className="block text-xs font-normal text-muted-foreground">
            Optional. Browsers only allow this from a button, so it cannot be
            turned on later.
          </span>
        </span>
        <Switch
          checked={fullscreen}
          onCheckedChange={onFullscreenChange}
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
        <span>
          I understand this interview is monitored, and may be recorded, as
          described above.
        </span>
      </label>
    </div>
  );
}

export default ProctoringDisclosure;
