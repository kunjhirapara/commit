import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  requireInterviewAccess,
  requireInterviewReviewAccess,
  requirePermission,
} from "./lib/authz";
import { createServerError } from "./lib/errorUtils";
import {
  isMonitored,
  resolveIntegrityMode,
} from "./lib/integrityModes";

/**
 * Interview integrity monitoring.
 *
 * Design: docs/superpowers/specs/2026-08-01-interview-proctoring-design.md
 *
 * Two rules govern everything in this file:
 *
 * 1. Only the candidate is monitored, and only on their own interview.
 *    Interviewers switch away constantly for notes and CVs; recording them would
 *    bury the signal and amount to surveilling staff.
 * 2. The candidate may write but never read. They generate these events, so the
 *    write path has to be open to them, but being able to read them back would
 *    let them probe for thresholds.
 */

/** Most events one batch may carry. Beyond this the client is misbehaving. */
const MAX_EVENTS_PER_BATCH = 100;

/**
 * Ceiling on events for a single interview.
 *
 * A busy but honest session lands in the low hundreds. This is high enough not
 * to truncate real evidence and low enough that a client stuck in a loop cannot
 * run up the deployment's function quota.
 */
const MAX_EVENTS_PER_SESSION = 2_000;

/** Silence longer than this, while the session is open, counts as a gap. */
const HEARTBEAT_GRACE_MS = 90_000;

/** Segments one authorship batch may carry. Beyond this the client is misbehaving. */
const MAX_SEGMENTS_PER_BATCH = 50;

/**
 * Ceiling on authorship segments for a single interview.
 *
 * A 45-minute coding round lands in the low hundreds once runs of editing are
 * coalesced. Three thousand is far enough above that to keep a real history
 * intact, and low enough that a client stuck in a loop cannot run up the
 * deployment quota.
 */
const MAX_AUTHORSHIP_SEGMENTS_PER_SESSION = 3_000;

const TIER_A_KINDS = new Set([
  "focus.lost",
  "tab.hidden",
  "fullscreen.exited",
  "editor.paste",
  "editor.bulkInsert",
  "display.extended",
  "monitor.gap",
  // Deterrent mode. All three describe a rule that was in force and what
  // happened to it, which is exactly the kind of thing a reader should see in
  // the summary rather than have to dig for in the timeline.
  "content.masked",
  "paste.blocked",
  "fullscreen.exempted",
]);

/**
 * Resolves the session row, asserting the caller is the candidate.
 *
 * `requireInterviewAccess` alone is not enough: it passes for interviewers and
 * admins too, and they must not be able to write events attributed to the
 * candidate.
 */
const requireCandidateSession = async (
  ctx: any,
  interviewId: any,
) => {
  const { user, interview } = await requireInterviewAccess(ctx, interviewId);

  if (interview.candidateId !== user.clerkId) {
    throw createServerError(
      new Error(
        `User ${user.clerkId} is not the candidate on interview ${String(interviewId)}`,
      ),
      "Only the candidate is monitored during an interview.",
    );
  }

  const session = await ctx.db
    .query("proctoringSessions")
    .withIndex("by_interview", (q: any) => q.eq("interviewId", interviewId))
    .first();

  return { user, interview, session };
};

/**
 * Opens the monitoring session, recording what *can* be checked on this browser.
 *
 * Called from the pre-join gate after the candidate acknowledges the disclosure.
 * Storing display support here — rather than inferring it from the absence of
 * events later — is what lets the report say "could not be checked" instead of
 * showing a clean result it has not earned.
 */
export const startProctoringSession = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    displaySupport: v.string(),
    fullscreenUsed: v.boolean(),
    disclosureAcknowledged: v.boolean(),
    userAgent: v.optional(v.string()),
    /** Whether the client's enforcement kill switch was on. See the schema comment. */
    enforcementActive: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { user, interview, session } = await requireCandidateSession(
      ctx,
      args.interviewId,
    );

    /**
     * The mode comes off the interview row, never from the client.
     *
     * The candidate is the one party with an interest in being monitored less,
     * and they control the browser. If the mode arrived as an argument, opening
     * a session in "observe" on a "deterrent" interview would be a one-line
     * tamper that produced a report claiming rules were never enforced.
     */
    const mode = resolveIntegrityMode(interview.integrityMode);

    // Nothing is recorded for an unmonitored interview — no session row, so the
    // report reads "not monitored" rather than "monitored and found nothing".
    if (!isMonitored(mode)) return null;

    const now = Date.now();
    const fields = {
      integrityMode: mode,
      enforcementActive: args.enforcementActive ?? false,
      displaySupport: args.displaySupport,
      fullscreenUsed: args.fullscreenUsed,
      userAgent: args.userAgent,
      lastHeartbeatAt: now,
      disclosureAcknowledgedAt: args.disclosureAcknowledged
        ? now
        : session?.disclosureAcknowledgedAt,
    };

    // Rejoining after a refresh updates the existing row rather than starting a
    // second session, so the report stays one session per interview.
    if (session) {
      await ctx.db.patch(session._id, fields);
      return session._id;
    }

    return await ctx.db.insert("proctoringSessions", {
      interviewId: args.interviewId,
      streamCallId: args.streamCallId,
      candidateClerkId: user.clerkId,
      startedAt: now,
      monitorGaps: 0,
      maxClockSkewMs: 0,
      eventsRecorded: 0,
      maskedMs: 0,
      extendedAppearedMidSession: false,
      ...fields,
    });
  },
});

/**
 * Records a batch of signals.
 *
 * Server time is authoritative throughout. The client's own timestamp is stored
 * only so the two can be compared: a clock that disagrees by a wide margin is
 * itself a signal, and using client time for ordering would let it be forged.
 */
export const recordProctoringBatch = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    clientNow: v.number(),
    events: v.array(
      v.object({
        kind: v.string(),
        startedAt: v.number(),
        durationMs: v.optional(v.number()),
        magnitude: v.optional(v.number()),
        metadata: v.optional(v.string()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireCandidateSession(
      ctx,
      args.interviewId,
    );

    if (!session) {
      throw createServerError(
        new Error(`No proctoring session for interview ${String(args.interviewId)}`),
        "Monitoring was not started for this interview.",
      );
    }

    const now = Date.now();
    const clockSkewMs = Math.abs(now - args.clientNow);
    const alreadyRecorded = session.eventsRecorded ?? 0;

    // Hard ceiling. Recording that it was hit matters more than the events lost:
    // a client that floods is itself worth knowing about.
    if (alreadyRecorded >= MAX_EVENTS_PER_SESSION) {
      if (!session.throttledAt) {
        await ctx.db.patch(session._id, { throttledAt: now });
        await ctx.db.insert("proctoringEvents", {
          interviewId: args.interviewId,
          streamCallId: args.streamCallId,
          candidateClerkId: user.clerkId,
          kind: "batch.throttled",
          tier: "b",
          startedAt: now,
          metadata: JSON.stringify({ cap: MAX_EVENTS_PER_SESSION }),
        });
      }
      return { recorded: 0, throttled: true };
    }

    const accepted = args.events.slice(
      0,
      Math.min(
        MAX_EVENTS_PER_BATCH,
        MAX_EVENTS_PER_SESSION - alreadyRecorded,
      ),
    );

    for (const event of accepted) {
      await ctx.db.insert("proctoringEvents", {
        interviewId: args.interviewId,
        streamCallId: args.streamCallId,
        candidateClerkId: user.clerkId,
        kind: event.kind,
        tier: TIER_A_KINDS.has(event.kind) ? "a" : "b",
        // Server-anchored: the client's offset within the batch is preserved by
        // its own timestamp, but the row's ordering key is ours.
        startedAt: now,
        durationMs: event.durationMs,
        magnitude: event.magnitude,
        clientReportedAt: event.startedAt,
        clockSkewMs,
        metadata: event.metadata,
      });
    }

    // Masked time is accumulated on the session as it arrives rather than summed
    // over events at read time, so the report stays correct once the event list
    // outgrows the 500-row window `getProctoringReport` reads.
    const maskedInBatch = accepted.reduce(
      (total, event) =>
        event.kind === "content.masked" ? total + (event.durationMs ?? 0) : total,
      0,
    );

    await ctx.db.patch(session._id, {
      eventsRecorded: alreadyRecorded + accepted.length,
      lastHeartbeatAt: now,
      maxClockSkewMs: Math.max(session.maxClockSkewMs ?? 0, clockSkewMs),
      maskedMs: (session.maskedMs ?? 0) + maskedInBatch,
    });

    return { recorded: accepted.length, throttled: false };
  },
});

/**
 * Keeps the session alive and records a gap if reporting stopped.
 *
 * This is what stops "disable the monitor" being the winning move. Without it,
 * a candidate who blocks the mutation produces the cleanest report in the
 * system; with it, the silence is on the record.
 */
export const recordHeartbeat = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireCandidateSession(
      ctx,
      args.interviewId,
    );
    if (!session) return { gapDetected: false };

    const now = Date.now();
    const since = now - (session.lastHeartbeatAt ?? session.startedAt);
    const gapDetected = since > HEARTBEAT_GRACE_MS;

    if (gapDetected) {
      await ctx.db.insert("proctoringEvents", {
        interviewId: args.interviewId,
        streamCallId: args.streamCallId,
        candidateClerkId: user.clerkId,
        kind: "monitor.gap",
        tier: "a",
        startedAt: now,
        durationMs: since,
        magnitude: since,
      });
    }

    await ctx.db.patch(session._id, {
      lastHeartbeatAt: now,
      monitorGaps: (session.monitorGaps ?? 0) + (gapDetected ? 1 : 0),
    });

    return { gapDetected };
  },
});

/** Marks a display appearing after the interview began, which is the telling case. */
export const recordDisplayChange = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    displaySupport: v.string(),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireCandidateSession(
      ctx,
      args.interviewId,
    );
    if (!session) return null;

    const becameExtended =
      args.displaySupport === "extended" && session.displaySupport !== "extended";

    await ctx.db.patch(session._id, {
      displaySupport: args.displaySupport,
      extendedAppearedMidSession:
        session.extendedAppearedMidSession || becameExtended,
    });

    if (becameExtended) {
      await ctx.db.insert("proctoringEvents", {
        interviewId: args.interviewId,
        streamCallId: args.streamCallId,
        candidateClerkId: user.clerkId,
        kind: "display.extended",
        tier: "a",
        startedAt: Date.now(),
        metadata: JSON.stringify({ appearedMidSession: true }),
      });
    }

    return null;
  },
});

/**
 * Records a batch of authorship segments.
 *
 * Append-only and candidate-only, like every other write here. The cap uses the
 * same durable counter on the session row that events use, for the same reason:
 * the in-memory limiter cannot bound anything across Convex isolates.
 *
 * Hitting the cap stops recording but is not silent — `throttledAt` is set and a
 * Tier B event is written, so a report can say the history is incomplete rather
 * than presenting a truncated one as whole.
 */
export const recordAuthorshipBatch = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    segments: v.array(
      v.object({
        tOffsetMs: v.number(),
        op: v.string(),
        charCount: v.number(),
        keystrokeCount: v.number(),
        backspaceCount: v.number(),
        durationMs: v.number(),
        meanInterKeyMs: v.number(),
        stdDevInterKeyMs: v.number(),
        text: v.optional(v.string()),
        viaPaste: v.boolean(),
        language: v.string(),
        questionId: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireCandidateSession(
      ctx,
      args.interviewId,
    );

    if (!session || args.segments.length === 0) {
      return { recorded: 0, throttled: false };
    }

    const now = Date.now();
    const alreadyRecorded = session.authorshipSegmentsRecorded ?? 0;

    if (alreadyRecorded >= MAX_AUTHORSHIP_SEGMENTS_PER_SESSION) {
      if (!session.throttledAt) {
        await ctx.db.patch(session._id, { throttledAt: now });
        await ctx.db.insert("proctoringEvents", {
          interviewId: args.interviewId,
          streamCallId: args.streamCallId,
          candidateClerkId: user.clerkId,
          kind: "batch.throttled",
          tier: "b",
          startedAt: now,
          metadata: JSON.stringify({
            cap: MAX_AUTHORSHIP_SEGMENTS_PER_SESSION,
            of: "authorship",
          }),
        });
      }
      return { recorded: 0, throttled: true };
    }

    const accepted = args.segments.slice(
      0,
      Math.min(
        MAX_SEGMENTS_PER_BATCH,
        MAX_AUTHORSHIP_SEGMENTS_PER_SESSION - alreadyRecorded,
      ),
    );

    // Derived from the durable counter rather than sent by the client, so the
    // order of the history is ours and cannot be rewritten by replaying a batch.
    const sequence = Math.floor(alreadyRecorded / MAX_SEGMENTS_PER_BATCH);

    await ctx.db.insert("proctoringAuthorship", {
      interviewId: args.interviewId,
      streamCallId: args.streamCallId,
      candidateClerkId: user.clerkId,
      sequence,
      recordedAt: now,
      segments: accepted,
    });

    await ctx.db.patch(session._id, {
      authorshipSegmentsRecorded: alreadyRecorded + accepted.length,
      lastHeartbeatAt: now,
    });

    return { recorded: accepted.length, throttled: false };
  },
});

/**
 * Records that the candidate declared fullscreen unusable.
 *
 * This is the escape hatch deterrent mode needs in order to be defensible. A
 * hard fullscreen rule with no way out does not produce compliance, it produces
 * candidates using a screen reader or a magnifier who cannot sit the interview
 * at all.
 *
 * What makes it safe to offer is that it is not free and not hidden: the
 * exemption, its timestamp and its stated reason all land on the report, the
 * interviewer can see it while the call is still running, and they can simply
 * ask about it. That is a better outcome than either blocking the candidate or
 * letting the rule be disabled silently.
 *
 * Idempotent — the first exemption stands, so a second call cannot overwrite the
 * originally stated reason with a blank one.
 */
export const recordFullscreenExemption = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user, session } = await requireCandidateSession(
      ctx,
      args.interviewId,
    );
    if (!session || session.fullscreenExemptedAt) return null;

    const now = Date.now();
    const reason = args.reason?.trim().slice(0, 500) || undefined;

    await ctx.db.patch(session._id, {
      fullscreenExemptedAt: now,
      fullscreenExemptionReason: reason,
    });

    await ctx.db.insert("proctoringEvents", {
      interviewId: args.interviewId,
      streamCallId: args.streamCallId,
      candidateClerkId: user.clerkId,
      kind: "fullscreen.exempted",
      tier: "a",
      startedAt: now,
      metadata: reason ? JSON.stringify({ reason }) : undefined,
    });

    return null;
  },
});

/**
 * The integrity report.
 *
 * `requireInterviewReviewAccess` already excludes candidates and covers the
 * interviewer on this interview plus recruiters and admins, so the read gate is
 * the existing one rather than a new rule to keep in sync.
 */
export const getProctoringReport = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    await requireInterviewReviewAccess(ctx, args.interviewId);

    const [session, events] = await Promise.all([
      ctx.db
        .query("proctoringSessions")
        .withIndex("by_interview", (q) => q.eq("interviewId", args.interviewId))
        .first(),
      ctx.db
        .query("proctoringEvents")
        .withIndex("by_interview", (q) => q.eq("interviewId", args.interviewId))
        .order("desc")
        .take(500),
    ]);

    // No session row means monitoring never ran — a different thing entirely
    // from running and finding nothing, and the UI must say so.
    if (!session) {
      return { monitored: false, session: null, summary: null, events: [] };
    }

    const absence = (kind: string) =>
      events.filter((event) => event.kind === kind);

    const focusEvents = absence("focus.lost");
    const tabEvents = absence("tab.hidden");
    const inserts = events.filter((event) => event.kind === "editor.bulkInsert");
    const pastes = events.filter((event) => event.kind === "editor.paste");

    const sumDuration = (rows: typeof events) =>
      rows.reduce((total, row) => total + (row.durationMs ?? 0), 0);

    const summary = {
      // Focus and tab absences overlap — alt-tabbing hides the tab and blurs the
      // window — so the larger of the two is used rather than their sum, which
      // would double-count a single absence.
      totalUnfocusedMs: Math.max(sumDuration(focusEvents), sumDuration(tabEvents)),
      longestAbsenceMs: Math.max(
        0,
        ...[...focusEvents, ...tabEvents].map((row) => row.durationMs ?? 0),
      ),
      tabSwitches: tabEvents.length,
      windowSwitches: focusEvents.length,
      fullscreenExits: absence("fullscreen.exited").length,
      largestInsertChars: Math.max(
        0,
        ...inserts.map((row) => row.magnitude ?? 0),
      ),
      totalPastedChars: pastes.reduce(
        (total, row) => total + (row.magnitude ?? 0),
        0,
      ),
      monitorGaps: session.monitorGaps ?? 0,
      maxClockSkewMs: session.maxClockSkewMs ?? 0,
      displaySupport: session.displaySupport,
      // Tier B, from the positional fallback used where screen.isExtended is
      // unavailable. Reported so a browser that cannot be checked properly is
      // not left with nothing at all, but deliberately kept out of the severity
      // band — it is an inference from window position, not an answer.
      offPrimaryHints: absence("window.geometry").length,
      reloads: absence("page.reload").length,
      extendedAppearedMidSession: session.extendedAppearedMidSession ?? false,
      fullscreenUsed: session.fullscreenUsed ?? false,
      // Which rules were actually in force. A clean report means something
      // different under each mode, so the band must never be read without it.
      integrityMode: resolveIntegrityMode(session.integrityMode),
      enforcementActive: session.enforcementActive ?? false,
      maskedMs: session.maskedMs ?? 0,
      blockedPastes: absence("paste.blocked").length,
      fullscreenExempted: !!session.fullscreenExemptedAt,
    };

    return {
      monitored: true,
      session: {
        startedAt: session.startedAt,
        disclosureAcknowledgedAt: session.disclosureAcknowledgedAt,
        userAgent: session.userAgent,
        throttled: !!session.throttledAt,
        integrityMode: resolveIntegrityMode(session.integrityMode),
        fullscreenExemptedAt: session.fullscreenExemptedAt,
        fullscreenExemptionReason: session.fullscreenExemptionReason,
      },
      summary,
      events: events.map((event) => ({
        _id: event._id,
        kind: event.kind,
        tier: event.tier,
        startedAt: event.startedAt,
        durationMs: event.durationMs,
        magnitude: event.magnitude,
      })),
    };
  },
});

/**
 * A candidate's monitoring history across interviews.
 *
 * Admin and recruiter only, and returned per interview rather than as a running
 * total. A flag from one session following someone into every future
 * application is prejudicial, particularly given how ordinary a stray focus
 * event is — the reader should see each interview in its own context.
 */
export const getCandidateProctoringHistory = query({
  args: { candidateClerkId: v.string() },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "viewUsers");

    if (user.role !== "admin" && user.role !== "recruiter") {
      throw createServerError(
        new Error(`Role ${user.role} may not read candidate proctoring history`),
        "You do not have permission to view this.",
      );
    }

    const sessions = await ctx.db
      .query("proctoringSessions")
      .withIndex("by_candidate", (q) =>
        q.eq("candidateClerkId", args.candidateClerkId),
      )
      .order("desc")
      .take(50);

    return sessions.map((session) => ({
      interviewId: session.interviewId,
      startedAt: session.startedAt,
      displaySupport: session.displaySupport,
      monitorGaps: session.monitorGaps ?? 0,
      eventsRecorded: session.eventsRecorded ?? 0,
      disclosureAcknowledged: !!session.disclosureAcknowledgedAt,
    }));
  },
});
