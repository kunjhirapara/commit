"use client";

import { useState } from "react";
import { MaximizeIcon } from "lucide-react";
import { Button } from "./button";
import { Textarea } from "./textarea";

/**
 * Shown to the candidate while the interview content is hidden.
 *
 * The tone matters as much as the mechanism. A candidate who left fullscreen by
 * accident — a notification, a misfired shortcut — should read this and
 * understand in one second what happened and how to undo it. If it reads as an
 * accusation, or worse as a crash, an honest candidate loses time and composure
 * over something the rules told them about before they joined.
 *
 * So: what happened, that nothing is lost, and the one button that fixes it.
 * The exemption sits underneath, quieter but not hidden — someone who genuinely
 * cannot use fullscreen must be able to find it without asking.
 */
function FullscreenGuardOverlay({
  onReturnToFullscreen,
  onTakeExemption,
}: {
  onReturnToFullscreen: () => void;
  onTakeExemption: (reason: string) => void;
}) {
  const [showingExemption, setShowingExemption] = useState(false);
  const [reason, setReason] = useState("");

  return (
    <div
      // Not a <dialog>: this must not be dismissible with Escape, which is the
      // very key that leaves fullscreen. Focus is held by the primary button.
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="fullscreen-guard-title"
      className="absolute inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-6 shadow-lg">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400">
            <MaximizeIcon className="size-4" aria-hidden="true" />
          </div>
          <div className="space-y-1.5">
            <h2 id="fullscreen-guard-title" className="text-base font-semibold">
              Return to fullscreen to continue
            </h2>
            <p className="text-sm text-muted-foreground">
              This interview runs in fullscreen, so the problem and your code are
              hidden until you go back.{" "}
              <strong className="font-medium text-foreground">
                Nothing has been lost
              </strong>{" "}
              — your work is exactly where you left it, and your interviewer can
              still see and hear you.
            </p>
          </div>
        </div>

        {showingExemption ? (
          <div className="space-y-3">
            <label
              className="block text-sm font-medium"
              htmlFor="fullscreen-exemption-reason">
              What makes fullscreen difficult?
            </label>
            <Textarea
              id="fullscreen-exemption-reason"
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              placeholder="A screen reader, a magnifier, a second window you need — anything. Optional."
              rows={3}
            />
            <p className="text-xs text-muted-foreground">
              The rule stops applying for the rest of this interview. Your
              interviewer is told you used this and what you said, so they can
              ask if they need to.
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                onClick={() => onTakeExemption(reason.trim())}>
                Turn off the fullscreen rule
              </Button>
              <Button
                variant="ghost"
                onClick={() => setShowingExemption(false)}>
                Back
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <Button
              className="w-full gap-2"
              size="lg"
              autoFocus
              onClick={onReturnToFullscreen}>
              <MaximizeIcon className="size-4" aria-hidden="true" />
              Return to fullscreen
            </Button>
            <button
              type="button"
              onClick={() => setShowingExemption(true)}
              className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:underline">
              I can&apos;t use fullscreen
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default FullscreenGuardOverlay;
