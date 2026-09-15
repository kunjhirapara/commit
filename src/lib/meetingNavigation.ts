/**
 * Where "Join Meeting" goes, and the one condition that can stop it.
 *
 * This exists because joining was gated on the wrong thing. `joinMeeting` did:
 *
 *     if (!client) return toast.error("Failed to join meeting. Please try again.");
 *     router.push(`/meeting/${callId}`);
 *
 * `client` is the Stream video client for the *current* page. Navigating to the
 * meeting route does not use it — the route mounts its own StreamClientProvider
 * and waits for the connection there. On "/" that client arrives late or not at
 * all: StreamClientProvider pulls the SDK through a dynamic import, and only
 * after useUserRole has resolved and only for roles that might start a call. So
 * an interviewer pressing the button on their home page was told the interview
 * could not be joined, while pasting the identical link into the address bar
 * took them straight in — the paste skipped a check that was never about
 * whether joining was possible.
 *
 * A call id is the only genuine precondition, so it is the only input.
 *
 * Import-free on purpose so the test runner can reach it (see CLAUDE.md).
 */

export type JoinTarget =
  | { ok: true; href: string }
  | { ok: false; message: string };

export const resolveJoinTarget = (
  callId: string | null | undefined,
): JoinTarget => {
  const trimmed = callId?.trim();

  if (!trimmed) {
    /**
     * Routing to "/meeting/" would land on the route's own "this meeting is
     * unavailable" state, which reads as the meeting being broken rather than
     * never having been given a call id.
     */
    return {
      ok: false,
      message: "This interview has no meeting link yet.",
    };
  }

  /**
   * Stream ids are UUIDs in practice. Encoding is defence rather than a known
   * case: an id carrying a slash must not be able to steer the path somewhere
   * other than this meeting.
   */
  return { ok: true, href: `/meeting/${encodeURIComponent(trimmed)}` };
};
