/**
 * What the host-controls menu may offer, decided in one place.
 *
 * This exists because the menu and its handlers used to answer that question
 * separately and disagreed. The menu rendered on the Stream capabilities
 * (`MUTE_USERS`, `BLOCK_USERS`); the handlers additionally required an
 * `interviews` row, and returned silently without one:
 *
 *     if (!call || !interview) return;
 *
 * An instant meeting has no such row, so its creator — whom Stream makes the
 * call's host, and therefore grants both capabilities — was shown a full menu
 * in which every item was inert. No effect, no toast, no error in the console.
 *
 * The interview is needed to *log* a host action, never to perform one. A
 * missing audit row is not a reason to refuse the thing the button says it
 * does, so it is not an input here. Both the render gate and the handlers read
 * this one function, which is what stops the two from drifting apart again.
 *
 * Import-free on purpose so the test runner can reach it (see CLAUDE.md).
 */

export type HostControlsInput = {
  /** App-level: the call's creator, an admin/recruiter, or a listed interviewer. */
  isHost: boolean;
  /** Stream's `OwnCapability.MUTE_USERS` for this participant. */
  canMuteUsers: boolean;
  /** Stream's `OwnCapability.BLOCK_USERS` for this participant. */
  canBlockUsers: boolean;
  /** Participants other than the local one — the only people removal can target. */
  removableParticipantCount: number;
};

export type HostControlsAvailability = {
  muteAll: boolean;
  removeParticipants: boolean;
  /** Whether the menu is worth rendering at all. */
  anyAvailable: boolean;
};

export const getHostControlsAvailability = ({
  isHost,
  canMuteUsers,
  canBlockUsers,
  removableParticipantCount,
}: HostControlsInput): HostControlsAvailability => {
  const muteAll = isHost && canMuteUsers;

  /**
   * Removal needs somebody to remove. Without this the menu could open on a
   * heading with nothing beneath it, which is the same empty promise as an item
   * that does nothing — just quieter.
   */
  const removeParticipants =
    isHost && canBlockUsers && removableParticipantCount > 0;

  return {
    muteAll,
    removeParticipants,
    anyAvailable: muteAll || removeParticipants,
  };
};
