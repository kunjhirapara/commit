import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildMeetingHref,
  describeNotificationMetadata,
  parseNotificationMetadata,
  resolveNotificationActions,
} from "./notificationLinks.ts";

const START = Date.UTC(2026, 8, 15, 12, 0, 0);
const END = START + 60 * 60 * 1000;

const scheduledInterview = {
  streamCallId: "call-abc",
  status: "scheduled",
  startTime: START,
  endTime: END,
};

describe("buildMeetingHref", () => {
  it("builds a meeting path for a usable call id", () => {
    assert.equal(buildMeetingHref("abc-123"), "/meeting/abc-123");
  });

  it("trims surrounding whitespace before building the path", () => {
    assert.equal(buildMeetingHref("  abc-123  "), "/meeting/abc-123");
  });

  it("encodes a call id so it cannot escape the route", () => {
    // A raw "a/../b" resolves to "/b" and quietly navigates somewhere the
    // notification never referred to.
    assert.equal(buildMeetingHref("a/../b"), "/meeting/a%2F..%2Fb");
  });

  it("returns null rather than '/meeting/' for a missing id", () => {
    // "/meeting/" renders the route's own "meeting unavailable" state, which
    // reads as a broken interview rather than a notification with no call
    // attached. Better to render no button at all.
    assert.equal(buildMeetingHref(""), null);
    assert.equal(buildMeetingHref("   "), null);
    assert.equal(buildMeetingHref(null), null);
    assert.equal(buildMeetingHref(undefined), null);
  });
});

describe("resolveNotificationActions", () => {
  it("offers Join as the primary action once the join window is open", () => {
    const actions = resolveNotificationActions({
      type: "interview.reminder",
      role: "candidate",
      interview: scheduledInterview,
      now: START + 5 * 60 * 1000,
    });

    assert.equal(actions[0].href, "/meeting/call-abc");
    assert.equal(actions[0].intent, "primary");
    assert.equal(actions[0].label, "Join interview");
  });

  it("opens the join window shortly before the scheduled start", () => {
    const actions = resolveNotificationActions({
      type: "interview.reminder",
      role: "candidate",
      interview: scheduledInterview,
      now: START - 5 * 60 * 1000,
    });

    assert.equal(actions[0].href, "/meeting/call-abc");
  });

  it("does not offer Join long before the interview starts", () => {
    const actions = resolveNotificationActions({
      type: "interview.scheduled",
      role: "candidate",
      interview: scheduledInterview,
      now: START - 6 * 60 * 60 * 1000,
    });

    assert.ok(!actions.some((action) => action.href.startsWith("/meeting/")));
    assert.equal(actions[0].href, "/calendar");
    assert.equal(actions[0].intent, "primary");
  });

  it("does not offer Join after the interview has ended", () => {
    const actions = resolveNotificationActions({
      type: "interview.reminder",
      role: "candidate",
      interview: scheduledInterview,
      now: END + 60 * 60 * 1000,
    });

    assert.ok(!actions.some((action) => action.href.startsWith("/meeting/")));
  });

  it("never offers Join for a cancelled interview inside its old window", () => {
    const actions = resolveNotificationActions({
      type: "interview.cancelled",
      role: "candidate",
      interview: { ...scheduledInterview, status: "cancelled" },
      now: START + 5 * 60 * 1000,
    });

    assert.ok(!actions.some((action) => action.href.startsWith("/meeting/")));
    assert.equal(actions[0].href, "/calendar");
  });

  it("keeps a candidate away from routes their role cannot open", () => {
    // candidate holds no permissions at all, so /dashboard/interviews renders
    // RoleGuard's denial panel. A quick link that lands there is worse than no
    // quick link.
    const actions = resolveNotificationActions({
      type: "feedback.reminder",
      role: "candidate",
      interview: scheduledInterview,
      now: END + 60 * 60 * 1000,
    });

    assert.ok(!actions.some((action) => action.href.startsWith("/dashboard")));
  });

  it("sends an interviewer to the interviews workspace for feedback", () => {
    const actions = resolveNotificationActions({
      type: "feedback.reminder",
      role: "interviewer",
      interview: scheduledInterview,
      now: END + 60 * 60 * 1000,
    });

    assert.equal(actions[0].href, "/dashboard/interviews");
    assert.equal(actions[0].label, "Submit feedback");
  });

  it("withholds protected routes while the role is still unknown", () => {
    // useUserRole reports undefined until the Convex query settles. Emitting a
    // dashboard link during that window flashes a button that turns into a
    // denial page if the viewer is a candidate.
    const actions = resolveNotificationActions({
      type: "feedback.reminder",
      role: null,
      interview: scheduledInterview,
      now: END + 60 * 60 * 1000,
    });

    assert.ok(!actions.some((action) => action.href.startsWith("/dashboard")));
  });

  it("still offers the calendar when no interview is attached", () => {
    const actions = resolveNotificationActions({
      type: "interview.scheduled",
      role: "candidate",
      interview: null,
      now: START,
    });

    assert.equal(actions[0].href, "/calendar");
  });

  it("returns no actions for a system notification", () => {
    const actions = resolveNotificationActions({
      type: "system.announcement",
      role: "admin",
      interview: null,
      now: START,
    });

    assert.deepEqual(actions, []);
  });

  it("falls back to the category when the type is unrecognised", () => {
    // Rows written before a type existed are classified by category on read,
    // which is what inferNotificationCategory does on the server.
    const actions = resolveNotificationActions({
      type: "interview.something_new",
      category: "interview_reminder",
      role: "candidate",
      interview: scheduledInterview,
      now: START + 5 * 60 * 1000,
    });

    assert.equal(actions[0].href, "/meeting/call-abc");
  });

  it("does not emit duplicate destinations", () => {
    const actions = resolveNotificationActions({
      type: "interview.reminder",
      role: "admin",
      interview: scheduledInterview,
      now: START + 5 * 60 * 1000,
    });

    const hrefs = actions.map((action) => action.href);
    assert.equal(new Set(hrefs).size, hrefs.length);
  });

  it("marks exactly one action as primary", () => {
    const actions = resolveNotificationActions({
      type: "interview.reminder",
      role: "admin",
      interview: scheduledInterview,
      now: START + 5 * 60 * 1000,
    });

    assert.equal(
      actions.filter((action) => action.intent === "primary").length,
      1,
    );
  });

  it("treats an interview with no end time as an hour long", () => {
    const actions = resolveNotificationActions({
      type: "interview.reminder",
      role: "candidate",
      interview: { ...scheduledInterview, endTime: null },
      now: START + 30 * 60 * 1000,
    });

    assert.equal(actions[0].href, "/meeting/call-abc");
  });
});

describe("parseNotificationMetadata", () => {
  it("reads the fields the interview mutations write", () => {
    const parsed = parseNotificationMetadata(
      JSON.stringify({ startTime: START, timezone: "Asia/Kolkata" }),
    );

    assert.equal(parsed.startTime, START);
    assert.equal(parsed.timezone, "Asia/Kolkata");
  });

  it("survives malformed JSON instead of throwing at render time", () => {
    assert.deepEqual(parseNotificationMetadata("{not json"), {});
    assert.deepEqual(parseNotificationMetadata(undefined), {});
    assert.deepEqual(parseNotificationMetadata(null), {});
  });

  it("ignores values of the wrong type", () => {
    const parsed = parseNotificationMetadata(
      JSON.stringify({ startTime: "soon", reason: 42, timezone: "UTC" }),
    );

    assert.equal(parsed.startTime, undefined);
    assert.equal(parsed.reason, undefined);
    assert.equal(parsed.timezone, "UTC");
  });

  it("ignores a JSON payload that is not an object", () => {
    assert.deepEqual(parseNotificationMetadata("[1,2,3]"), {});
    assert.deepEqual(parseNotificationMetadata('"hello"'), {});
    assert.deepEqual(parseNotificationMetadata("null"), {});
  });
});

describe("describeNotificationMetadata", () => {
  it("labels a reschedule with both times in order", () => {
    const fields = describeNotificationMetadata(
      JSON.stringify({
        previousStartTime: START,
        nextStartTime: START + 86_400_000,
        reason: "Interviewer conflict",
      }),
    );

    assert.deepEqual(fields, [
      { kind: "time", label: "Previously", value: START },
      { kind: "time", label: "Now starts", value: START + 86_400_000 },
      { kind: "text", label: "Reason", value: "Interviewer conflict" },
    ]);
  });

  it("describes a feedback reminder due date", () => {
    const fields = describeNotificationMetadata(
      JSON.stringify({ dueAt: END, timezone: "UTC" }),
    );

    assert.deepEqual(fields, [
      { kind: "time", label: "Due", value: END },
      { kind: "text", label: "Timezone", value: "UTC" },
    ]);
  });

  it("returns nothing to render for empty metadata", () => {
    assert.deepEqual(describeNotificationMetadata(undefined), []);
    assert.deepEqual(describeNotificationMetadata("{}"), []);
  });

  it("drops a blank reason rather than rendering an empty row", () => {
    assert.deepEqual(
      describeNotificationMetadata(JSON.stringify({ reason: "   " })),
      [],
    );
  });
});
