import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { resolveJoinTarget } from "./meetingNavigation.ts";

describe("resolveJoinTarget", () => {
  it("resolves a call id to its meeting route", () => {
    assert.deepEqual(resolveJoinTarget("abc-123"), {
      ok: true,
      href: "/meeting/abc-123",
    });
  });

  /**
   * The regression.
   *
   * "Join Meeting" on the home page reported "Failed to join meeting. Please
   * try again." while pasting the same link into the address bar worked. The
   * button was gated on a connected Stream video client:
   *
   *     if (!client) return toast.error("Failed to join meeting...");
   *     router.push(`/meeting/${callId}`);
   *
   * Navigating needs no such client. StreamClientProvider loads the SDK through
   * a dynamic import and only once useUserRole has resolved, so on "/" the
   * client is null for as long as that chunk takes to fetch and connect — and
   * never at all if the viewer's role does not qualify. The destination route
   * mounts its own provider and waits for it properly, which is precisely why
   * the pasted link succeeded where the button failed.
   *
   * So resolution depends on the call id and nothing else. There is no client
   * parameter to pass.
   */
  it("does not depend on a connected video client", () => {
    assert.deepEqual(resolveJoinTarget("abc-123"), {
      ok: true,
      href: "/meeting/abc-123",
    });
  });

  describe("refuses only what navigation genuinely cannot do", () => {
    for (const [label, value] of [
      ["empty", ""],
      ["whitespace", "   "],
      ["null", null],
      ["undefined", undefined],
    ] as const) {
      it(`reports a missing call id (${label}) instead of routing to /meeting/`, () => {
        // Pushing "/meeting/" would render the route's own "unavailable" state,
        // which reads as the meeting being broken rather than never scheduled.
        const result = resolveJoinTarget(value);

        assert.equal(result.ok, false);
        assert.match(
          result.ok === false ? result.message : "",
          /no meeting link/i,
        );
      });
    }
  });

  it("escapes a call id that would otherwise change the path", () => {
    // Stream ids are UUIDs in practice, so this is defence rather than a known
    // case — but an id carrying a slash must not be able to steer the route.
    assert.deepEqual(resolveJoinTarget("a/../b"), {
      ok: true,
      href: "/meeting/a%2F..%2Fb",
    });
  });

  it("trims surrounding whitespace from a pasted id", () => {
    // MeetingModal derives the id from a pasted URL, which routinely arrives
    // with a trailing newline.
    assert.deepEqual(resolveJoinTarget("  abc-123\n"), {
      ok: true,
      href: "/meeting/abc-123",
    });
  });
});
