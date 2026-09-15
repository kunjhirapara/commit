import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getHostControlsAvailability } from "./hostControls.ts";

const host = {
  isHost: true,
  canMuteUsers: true,
  canBlockUsers: true,
  removableParticipantCount: 1,
};

describe("getHostControlsAvailability", () => {
  it("offers both controls to a host with both capabilities", () => {
    assert.deepEqual(getHostControlsAvailability(host), {
      muteAll: true,
      removeParticipants: true,
      anyAvailable: true,
    });
  });

  /**
   * The regression this module exists for.
   *
   * An instant meeting (`useMeetingActions.createInstantMeeting`) creates a
   * Stream call under a fresh UUID and writes no `interviews` row, so
   * `getInterviewByStreamCallId` resolves to null and MeetingRoom renders with
   * `interview === undefined`. The menu was gated on the Stream capabilities —
   * which the creator has, because Stream makes them the call's host — while
   * both handlers opened with `if (!call || !interview) return`. Every click
   * was silently discarded: no effect, no toast, no error.
   *
   * Availability therefore takes no interview at all. The interview is needed
   * to *log* a host action, never to perform one, and a missing audit row is
   * not a reason to refuse the thing the button says it does.
   */
  it("does not consider whether the call has an interview record", () => {
    // There is no interview input to pass. A host of an ad-hoc call with the
    // capabilities Stream granted them is offered — and can run — both actions.
    assert.equal(getHostControlsAvailability(host).anyAvailable, true);
  });

  it("offers nothing to a participant who is not a host", () => {
    assert.deepEqual(getHostControlsAvailability({ ...host, isHost: false }), {
      muteAll: false,
      removeParticipants: false,
      anyAvailable: false,
    });
  });

  describe("capabilities are per-action", () => {
    it("withholds mute-all without MUTE_USERS", () => {
      const result = getHostControlsAvailability({
        ...host,
        canMuteUsers: false,
      });

      assert.equal(result.muteAll, false);
      assert.equal(result.removeParticipants, true);
      assert.equal(result.anyAvailable, true);
    });

    it("withholds removal without BLOCK_USERS", () => {
      const result = getHostControlsAvailability({
        ...host,
        canBlockUsers: false,
      });

      assert.equal(result.muteAll, true);
      assert.equal(result.removeParticipants, false);
    });
  });

  describe("nobody to remove", () => {
    it("withholds the removal section when the host is alone", () => {
      // Listing a section with no entries under it is the same empty promise as
      // an item that does nothing.
      assert.equal(
        getHostControlsAvailability({ ...host, removableParticipantCount: 0 })
          .removeParticipants,
        false,
      );
    });

    it("hides the whole menu when removal was the only thing on offer", () => {
      // The trigger used to render on `canMuteUsers || canBlockUsers`, so a
      // host who could only block sat in an empty call looking at a menu whose
      // sole section was conditional on somebody being there to remove.
      const result = getHostControlsAvailability({
        isHost: true,
        canMuteUsers: false,
        canBlockUsers: true,
        removableParticipantCount: 0,
      });

      assert.equal(result.anyAvailable, false);
    });
  });
});
