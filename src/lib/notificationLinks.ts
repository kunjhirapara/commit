import { getRequiredRolesForPath, type AppRole } from "./routeAccess.ts";

/**
 * Turns a notification row into the places its recipient can actually go.
 *
 * The in-app notifications were text with no destination: a candidate told
 * "your interview starts soon" had to work out for themselves that the join
 * button lives on the home page. Everything here exists to answer "and then
 * what?" for a given row.
 *
 * Two rules shape the output, and both are load-bearing:
 *
 *  1. **Never emit a route the viewer's role cannot open.** Destinations are
 *     filtered through `getRequiredRolesForPath`, the same table middleware and
 *     RoleGuard read, rather than a second hand-maintained list that would
 *     drift from it. `candidate` holds no permissions at all, so a
 *     /dashboard/interviews link would land them on a denial panel — worse than
 *     offering nothing.
 *  2. **Exactly one action is primary.** The leading surviving action is
 *     promoted after filtering, so a list that loses its primary to a role
 *     check still reads as a call to action instead of a row of grey links.
 *
 * Imports use explicit `.ts` extensions because this module is covered by
 * `node --test`, which has no bundler and no path mapping. See CLAUDE.md.
 */

/** How early the join link appears, relative to the scheduled start. */
const JOIN_WINDOW_LEAD_MS = 15 * 60 * 1000;

/** How long the join link survives past the scheduled end, for overruns. */
const JOIN_WINDOW_TRAIL_MS = 15 * 60 * 1000;

/** Assumed length of an interview whose row carries no end time. */
const DEFAULT_INTERVIEW_DURATION_MS = 60 * 60 * 1000;

/**
 * Statuses that mean "there is nothing to join", regardless of the clock.
 *
 * A cancelled interview still has a start time, so a window check alone would
 * hand someone a join button for a call that is not happening.
 */
const NON_JOINABLE_STATUSES = new Set([
  "draft",
  "completed",
  "cancelled",
  "no_show",
  "passed",
  "rejected",
  "failed",
  "succeeded",
]);

export type NotificationActionIntent = "primary" | "secondary";

export type NotificationAction = {
  href: string;
  label: string;
  intent: NotificationActionIntent;
};

export type NotificationInterviewRef = {
  streamCallId?: string | null;
  status?: string | null;
  startTime?: number | null;
  endTime?: number | null;
};

export type NotificationActionInput = {
  type?: string | null;
  category?: string | null;
  role?: AppRole | null;
  interview?: NotificationInterviewRef | null;
  now?: number;
};

/**
 * Builds `/meeting/<id>`, or null when there is no usable id.
 *
 * Returning null rather than "/meeting/" matters: that path renders the route's
 * own "meeting unavailable" state, which reads as a broken interview rather
 * than a notification that simply has no call attached.
 *
 * Duplicated deliberately for now — `resolveJoinTarget` in
 * src/lib/meetingNavigation.ts does the same job but lives on the unmerged
 * PR #28 branch, so importing it would not build on main. Collapse the two once
 * that lands.
 */
export const buildMeetingHref = (
  callId: string | null | undefined,
): string | null => {
  const trimmed = callId?.trim();
  if (!trimmed) return null;

  return `/meeting/${encodeURIComponent(trimmed)}`;
};

type NotificationKind =
  | "interview_join"
  | "interview_cancelled"
  | "feedback"
  | "system";

/**
 * Classifies a row by `type`, falling back to `category`.
 *
 * Rows predating a given type carry only a category, which is why the server's
 * `inferNotificationCategory` exists; this mirrors that leniency so an older
 * notification still gets links.
 */
const classifyNotification = (
  type: string | null | undefined,
  category: string | null | undefined,
): NotificationKind => {
  switch (type) {
    case "interview.scheduled":
    case "interview.rescheduled":
    case "interview.updated":
    case "interview.reminder":
      return "interview_join";
    case "interview.cancelled":
      return "interview_cancelled";
    case "feedback.reminder":
      return "feedback";
    default:
      break;
  }

  switch (category) {
    case "interview_schedule":
    case "interview_update":
    case "interview_reminder":
      return "interview_join";
    case "feedback_reminder":
      return "feedback";
    default:
      return "system";
  }
};

const isJoinable = (
  interview: NotificationInterviewRef | null | undefined,
  now: number,
): boolean => {
  if (!interview) return false;
  if (!interview.streamCallId?.trim()) return false;

  const status = interview.status ?? undefined;
  if (status && NON_JOINABLE_STATUSES.has(status)) return false;

  const startTime = interview.startTime;
  if (typeof startTime !== "number" || !Number.isFinite(startTime)) return false;

  const endTime =
    typeof interview.endTime === "number" && Number.isFinite(interview.endTime)
      ? interview.endTime
      : startTime + DEFAULT_INTERVIEW_DURATION_MS;

  return (
    now >= startTime - JOIN_WINDOW_LEAD_MS && now <= endTime + JOIN_WINDOW_TRAIL_MS
  );
};

/**
 * Whether `role` may load `href`, per the route table middleware enforces.
 *
 * An unknown role withholds protected routes: `useUserRole` reports undefined
 * until the Convex query settles, and flashing a dashboard button that becomes
 * a denial page for a candidate is the exact bad experience this module exists
 * to remove.
 */
const isRouteOpenToRole = (
  href: string,
  role: AppRole | null | undefined,
): boolean => {
  const pathname = href.split(/[?#]/)[0];
  const requiredRoles = getRequiredRolesForPath(pathname);

  if (!requiredRoles) return true;
  if (!role) return false;

  return requiredRoles.includes(role);
};

/**
 * The destinations offered for a notification, most useful first.
 *
 * Returns an empty array when there is nowhere sensible to go — a system
 * announcement has no page of its own, and the detail dialog still shows its
 * full text.
 */
export const resolveNotificationActions = (
  input: NotificationActionInput,
): NotificationAction[] => {
  const now = input.now ?? Date.now();
  const kind = classifyNotification(input.type, input.category);

  if (kind === "system") return [];

  const candidates: NotificationAction[] = [];

  if (kind === "interview_join") {
    const meetingHref = isJoinable(input.interview, now)
      ? buildMeetingHref(input.interview?.streamCallId)
      : null;

    if (meetingHref) {
      candidates.push({
        href: meetingHref,
        label: "Join interview",
        intent: "primary",
      });
    }
  }

  if (kind === "feedback") {
    candidates.push({
      href: "/dashboard/interviews",
      label: "Submit feedback",
      intent: "primary",
    });
  }

  candidates.push({
    href: "/calendar",
    label: "View in calendar",
    intent: "secondary",
  });

  if (kind === "interview_join" || kind === "interview_cancelled") {
    candidates.push({
      href: "/dashboard/interviews",
      label: "Open in interviews",
      intent: "secondary",
    });
  }

  const seen = new Set<string>();
  const allowed = candidates.filter((action) => {
    if (seen.has(action.href)) return false;
    if (!isRouteOpenToRole(action.href, input.role)) return false;

    seen.add(action.href);
    return true;
  });

  // Promote whatever survived the role filter, so the list always leads with a
  // real call to action rather than a row of equally quiet links.
  return allowed.map((action, index) => ({
    ...action,
    intent: index === 0 ? "primary" : "secondary",
  }));
};

export type NotificationMetadata = {
  startTime?: number;
  previousStartTime?: number;
  nextStartTime?: number;
  dueAt?: number;
  reason?: string;
  timezone?: string;
};

const readNumber = (value: unknown): number | undefined =>
  typeof value === "number" && Number.isFinite(value) ? value : undefined;

const readText = (value: unknown): string | undefined => {
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed ? trimmed : undefined;
};

/**
 * Reads the JSON blob the interview mutations stash on a notification.
 *
 * `metadata` is a free-form string column written by several call sites, so it
 * is treated as untrusted: bad JSON, a non-object payload, or a field of the
 * wrong type yields no field rather than throwing inside a render.
 *
 * Keys are assigned only when present, because `assert.deepStrictEqual` — and
 * `Object.keys` in the dialog — distinguish `{}` from `{ reason: undefined }`.
 */
export const parseNotificationMetadata = (
  raw: string | null | undefined,
): NotificationMetadata => {
  if (!raw) return {};

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return {};
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return {};
  }

  const source = parsed as Record<string, unknown>;
  const metadata: NotificationMetadata = {};

  const startTime = readNumber(source.startTime);
  if (startTime !== undefined) metadata.startTime = startTime;

  const previousStartTime = readNumber(source.previousStartTime);
  if (previousStartTime !== undefined) {
    metadata.previousStartTime = previousStartTime;
  }

  const nextStartTime = readNumber(source.nextStartTime);
  if (nextStartTime !== undefined) metadata.nextStartTime = nextStartTime;

  const dueAt = readNumber(source.dueAt);
  if (dueAt !== undefined) metadata.dueAt = dueAt;

  const reason = readText(source.reason);
  if (reason !== undefined) metadata.reason = reason;

  const timezone = readText(source.timezone);
  if (timezone !== undefined) metadata.timezone = timezone;

  return metadata;
};

export type NotificationDetailField =
  | { kind: "time"; label: string; value: number }
  | { kind: "text"; label: string; value: string };

/**
 * The metadata rows worth showing in the detail dialog, in reading order.
 *
 * Timestamps come back as numbers rather than formatted strings so the caller
 * owns locale and timezone — and so this stays testable without depending on
 * the machine's Intl data.
 */
export const describeNotificationMetadata = (
  raw: string | null | undefined,
): NotificationDetailField[] => {
  const metadata = parseNotificationMetadata(raw);
  const fields: NotificationDetailField[] = [];

  if (metadata.startTime !== undefined) {
    fields.push({ kind: "time", label: "Starts", value: metadata.startTime });
  }

  if (metadata.previousStartTime !== undefined) {
    fields.push({
      kind: "time",
      label: "Previously",
      value: metadata.previousStartTime,
    });
  }

  if (metadata.nextStartTime !== undefined) {
    fields.push({
      kind: "time",
      label: "Now starts",
      value: metadata.nextStartTime,
    });
  }

  if (metadata.dueAt !== undefined) {
    fields.push({ kind: "time", label: "Due", value: metadata.dueAt });
  }

  if (metadata.reason !== undefined) {
    fields.push({ kind: "text", label: "Reason", value: metadata.reason });
  }

  if (metadata.timezone !== undefined) {
    fields.push({ kind: "text", label: "Timezone", value: metadata.timezone });
  }

  return fields;
};
