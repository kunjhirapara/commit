"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { ProctoringBuffer } from "@/lib/proctoring/buffer";
import {
  getDisplayChangeTarget,
  readDisplayState,
} from "@/lib/proctoring/displays";
import { PROCTORING_THRESHOLDS } from "@/lib/proctoring/thresholds";
import type { ProctoringEvent } from "@/lib/proctoring/types";
import { logError } from "@/lib/errors";

type UseProctoringArgs = {
  interviewId: string | undefined;
  streamCallId: string | undefined;
  /**
   * Only the candidate is monitored. Passed in rather than derived here so the
   * caller owns the identity comparison and this hook stays testable.
   */
  enabled: boolean;
};

/**
 * Client half of interview integrity monitoring.
 *
 * Everything here is best-effort and silent: per the design the candidate is
 * told before joining that the session is monitored, and nothing surfaces to
 * them during it. Failures are swallowed rather than shown — a proctoring
 * outage must never interrupt an interview.
 *
 * The heartbeat is the load-bearing piece. Without it, a candidate who blocks
 * these mutations produces the cleanest possible report, which would make
 * tampering the winning move. With it, the silence is recorded.
 */
export const useProctoring = ({
  interviewId,
  streamCallId,
  enabled,
}: UseProctoringArgs) => {
  const recordBatch = useMutation(api.proctoring.recordProctoringBatch);
  const recordHeartbeat = useMutation(api.proctoring.recordHeartbeat);
  const recordDisplayChange = useMutation(api.proctoring.recordDisplayChange);

  // Kept in refs so the listener effect does not re-subscribe on every render,
  // which would drop in-flight absences.
  const idsRef = useRef({ interviewId, streamCallId });
  idsRef.current = { interviewId, streamCallId };

  // Last known "window sits off the primary display" reading, so the fallback
  // reports transitions rather than firing on every resize event.
  const offPrimaryRef = useRef(false);

  const active = enabled && !!interviewId && !!streamCallId;

  const send = useCallback(
    (events: ProctoringEvent[]) => {
      const { interviewId: id, streamCallId: callId } = idsRef.current;
      if (!id || !callId || events.length === 0) return;

      void recordBatch({
        interviewId: id as never,
        streamCallId: callId,
        clientNow: Date.now(),
        events: events.map((event) => ({
          kind: event.kind,
          startedAt: event.startedAt,
          durationMs: event.durationMs,
          magnitude: event.magnitude,
          metadata: event.metadata
            ? JSON.stringify(event.metadata)
            : undefined,
        })),
      }).catch((error) => {
        // Deliberately swallowed. A failed report is itself covered by the
        // heartbeat gap, and surfacing it would break the silent-monitoring
        // decision recorded in the spec.
        logError("useProctoring.send", error, { interviewId: id });
      });
    },
    [recordBatch],
  );

  const buffer = useMemo(
    () => new ProctoringBuffer({ now: () => Date.now(), onFlush: send }),
    [send],
  );

  useEffect(() => {
    if (!active) return;

    const onVisibility = () => {
      if (document.hidden) buffer.beginAbsence("tab.hidden");
      else buffer.endAbsence("tab.hidden");
    };
    const onBlur = () => buffer.beginAbsence("focus.lost");
    const onFocus = () => buffer.endAbsence("focus.lost");

    const onFullscreenChange = () => {
      // Only meaningful if fullscreen was entered in the first place; the
      // session row records whether it ever was, so the report can say
      // "not in use" rather than showing an unearned clean result.
      if (!document.fullscreenElement) {
        buffer.push({
          kind: "fullscreen.exited",
          tier: "a",
          startedAt: Date.now(),
        });
      }
    };

    const onDisplayChange = () => {
      const { interviewId: id, streamCallId: callId } = idsRef.current;
      if (!id || !callId) return;
      const { support } = readDisplayState();
      void recordDisplayChange({
        interviewId: id as never,
        streamCallId: callId,
        displaySupport: support,
      }).catch(() => {});
    };

    /**
     * Cross-browser fallback for the multi-display check.
     *
     * `screen.isExtended` is Chromium-only, so without this a Firefox or Safari
     * candidate is simply never checked — and the design commits to those
     * sessions getting something rather than nothing. A window positioned
     * outside the primary display's bounds is the only permission-free hint
     * available, and it is noisier, hence Tier B.
     *
     * Skipped entirely where `isExtended` works, because a real answer beats an
     * inference and reporting both would double-count.
     */
    const sampleGeometry = () => {
      const { support, offPrimary } = readDisplayState();
      if (support !== "unsupported") return;
      if (offPrimary === offPrimaryRef.current) return;

      offPrimaryRef.current = offPrimary;
      if (!offPrimary) return;

      buffer.push({
        kind: "window.geometry",
        tier: "b",
        startedAt: Date.now(),
        metadata: { offPrimary: true },
      });
    };

    /**
     * A reload mid-interview is worth noting — it resets editor state and is one
     * way to clear something you would rather not be seen. Tier B: refreshing
     * after a network wobble is at least as common.
     */
    const navigation = performance.getEntriesByType(
      "navigation",
    )[0] as PerformanceNavigationTiming | undefined;
    if (navigation?.type === "reload") {
      buffer.push({
        kind: "page.reload",
        tier: "b",
        startedAt: Date.now(),
      });
    }

    sampleGeometry();
    window.addEventListener("resize", sampleGeometry);

    const displayTarget = getDisplayChangeTarget();

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    document.addEventListener("fullscreenchange", onFullscreenChange);
    displayTarget?.addEventListener?.("change", onDisplayChange);

    const flushTimer = setInterval(
      () => buffer.flush(),
      PROCTORING_THRESHOLDS.FLUSH_INTERVAL_MS,
    );

    const heartbeatTimer = setInterval(() => {
      const { interviewId: id, streamCallId: callId } = idsRef.current;
      if (!id || !callId) return;
      void recordHeartbeat({
        interviewId: id as never,
        streamCallId: callId,
      }).catch(() => {});
    }, PROCTORING_THRESHOLDS.HEARTBEAT_MS);

    // pagehide rather than unload: it fires for bfcache navigations too, which
    // unload does not, and a closed tab is exactly when the last absence would
    // otherwise be lost.
    const onPageHide = () => {
      buffer.closeOpenAbsences();
      buffer.flush();
    };
    window.addEventListener("pagehide", onPageHide);

    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("fullscreenchange", onFullscreenChange);
      displayTarget?.removeEventListener?.("change", onDisplayChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("resize", sampleGeometry);
      clearInterval(flushTimer);
      clearInterval(heartbeatTimer);
      buffer.closeOpenAbsences();
      buffer.flush();
    };
  }, [active, buffer, recordDisplayChange, recordHeartbeat]);

  /**
   * Reports an editing signal. Called by CodeEditor, which stays unaware of
   * proctoring — it reports what happened and the caller decides what it means.
   */
  const reportEditorSignal = useCallback(
    (signal: { kind: "editor.paste" | "editor.bulkInsert"; chars: number }) => {
      if (!active) return;
      if (
        signal.kind === "editor.bulkInsert" &&
        signal.chars <= PROCTORING_THRESHOLDS.BULK_INSERT_CHARS
      ) {
        return;
      }
      buffer.push({
        kind: signal.kind,
        tier: "a",
        startedAt: Date.now(),
        magnitude: signal.chars,
      });
    },
    [active, buffer],
  );

  return { reportEditorSignal };
};
