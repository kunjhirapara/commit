"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type UseFullscreenGuardArgs = {
  /**
   * Deterrent mode, kill switch on, and this user is the candidate. Passed in
   * rather than derived so the caller owns the identity comparison — the same
   * arrangement `useProctoring` uses.
   */
  enabled: boolean;
  onMaskStart: () => void;
  onMaskEnd: () => void;
  onExempt: (reason: string) => void;
};

/**
 * Enforces the fullscreen rule in deterrent mode.
 *
 * Masking is the part that does real work. A candidate who leaves fullscreen to
 * read the problem on a second screen finds the problem is no longer on the
 * screen they left; a warning banner would not have achieved that. What is
 * hidden is only ever hidden — nothing is submitted, ended or deleted, and
 * returning to fullscreen restores everything.
 *
 * Two deliberate constraints:
 *
 * - **Re-entering fullscreen needs a user gesture.** The page cannot put itself
 *   back, which is why the overlay carries a button rather than doing it
 *   automatically on a timer.
 * - **The exemption is one-way and permanent for the session.** Someone using a
 *   magnifier should not have to re-declare that every time focus moves, and a
 *   rule that can be re-armed is a rule they have to keep fighting.
 *
 * Design: docs/superpowers/specs/2026-08-15-interview-integrity-v2-design.md §2
 */
export const useFullscreenGuard = ({
  enabled,
  onMaskStart,
  onMaskEnd,
  onExempt,
}: UseFullscreenGuardArgs) => {
  const [isMasked, setIsMasked] = useState(false);
  const [exempted, setExempted] = useState(false);

  // Held in refs so the listener effect does not re-subscribe whenever the
  // parent re-renders, which would drop an in-flight masking interval.
  const callbacks = useRef({ onMaskStart, onMaskEnd, onExempt });
  callbacks.current = { onMaskStart, onMaskEnd, onExempt };

  const maskedRef = useRef(false);

  const setMasked = useCallback((next: boolean) => {
    if (maskedRef.current === next) return;
    maskedRef.current = next;
    setIsMasked(next);
    if (next) callbacks.current.onMaskStart();
    else callbacks.current.onMaskEnd();
  }, []);

  useEffect(() => {
    if (!enabled || exempted) {
      // Leaving deterrent mode, or taking the exemption, must close any interval
      // that is currently open — otherwise the duration runs until the page
      // unloads and the report shows the problem hidden for the rest of the call.
      setMasked(false);
      return;
    }

    const sync = () => setMasked(!document.fullscreenElement);

    // Sync immediately: the candidate may already be out of fullscreen by the
    // time this mounts, for instance after a mid-interview reload.
    sync();
    document.addEventListener("fullscreenchange", sync);

    return () => {
      document.removeEventListener("fullscreenchange", sync);
      setMasked(false);
    };
  }, [enabled, exempted, setMasked]);

  /** Must be called from a click. Browsers refuse fullscreen without a gesture. */
  const returnToFullscreen = useCallback(async () => {
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      // Swallowed deliberately. A refusal here is not an error the candidate can
      // act on, and the honest next step is the exemption button beside it —
      // which is already on screen.
    }
  }, []);

  const takeExemption = useCallback(
    (reason: string) => {
      if (exempted) return;
      setExempted(true);
      setMasked(false);
      callbacks.current.onExempt(reason);
    },
    [exempted, setMasked],
  );

  return { isMasked, exempted, returnToFullscreen, takeExemption };
};
