import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  canAccessInterview,
  logAuditEvent,
  requirePermission,
} from "./lib/authz";
import { createServerError } from "./lib/errorUtils";

const interviewStatusValidator = v.union(
  v.literal("draft"),
  v.literal("scheduled"),
  v.literal("live"),
  v.literal("completed"),
  v.literal("cancelled"),
  v.literal("no_show"),
  v.literal("rescheduled"),
  v.literal("passed"),
  v.literal("rejected"),
  v.literal("upcoming"),
  v.literal("succeeded"),
  v.literal("failed"),
);

const normalizeInterviewStatus = (status: string) => {
  if (status === "upcoming") return "scheduled";
  if (status === "succeeded") return "passed";
  if (status === "failed") return "rejected";
  return status;
};

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * How far back the dashboard looks.
 *
 * Matches GROWTH_WINDOW_DAYS in convex/metrics.ts so the codebase has one
 * convention for "recent". This is what bounds these queries: cost becomes
 * proportional to recent activity rather than to total history, which matters
 * now that public signup makes `users` and `interviews` grow without limit.
 */
const DASHBOARD_WINDOW_DAYS = 30;
const DASHBOARD_WINDOW_MS = DASHBOARD_WINDOW_DAYS * DAY_MS;

/** Rows the workspace table renders at most, unchanged from the fat query. */
const PIPELINE_LIMIT = 100;

const FUNNEL_STAGES = [
  "scheduled",
  "live",
  "completed",
  "passed",
  "rejected",
  "cancelled",
  "no_show",
] as const;

/**
 * Interviews starting inside the dashboard window, scoped to what the caller may
 * see.
 *
 * The scoping is why these figures cannot come from a precomputed daily rollup:
 * admin and recruiter see every interview, an interviewer sees only rounds they
 * are on, and a developer holds `viewDashboard` but passes `canAccessInterview`
 * for nothing. A global rollup would report the whole platform's numbers to an
 * interviewer and leak aggregate volume to a developer.
 */
const loadScopedWindowInterviews = async (
  ctx: any,
  user: { clerkId: string; role: string },
) => {
  const windowStart = Date.now() - DASHBOARD_WINDOW_MS;

  const interviews = await ctx.db
    .query("interviews")
    .withIndex("by_startTime", (q: any) => q.gte("startTime", windowStart))
    .collect();

  if (user.role === "admin" || user.role === "recruiter") return interviews;

  return interviews.filter((interview: any) =>
    canAccessInterview(user as any, interview),
  );
};

const toSearchableString = (value?: string | null) => (value ?? "").toLowerCase();

const matchesFilters = (
  interview: any,
  args: {
    search?: string;
    interviewerId?: string;
    candidateId?: string;
    stage?: string;
    role?: string;
    startDate?: number;
    endDate?: number;
  },
  usersByClerkId: Map<string, any>,
) => {
  const search = toSearchableString(args.search);
  const candidate = usersByClerkId.get(interview.candidateId);
  const interviewerNames = interview.interviewerIds
    .map((id: string) => usersByClerkId.get(id)?.name ?? "")
    .join(" ");

  if (search) {
    const haystack = [
      interview.title,
      interview.templateLabel,
      interview.status,
      candidate?.name,
      interviewerNames,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    if (!haystack.includes(search)) return false;
  }

  if (args.candidateId && interview.candidateId !== args.candidateId) return false;
  if (args.interviewerId && !interview.interviewerIds.includes(args.interviewerId)) {
    return false;
  }
  if (args.stage && normalizeInterviewStatus(interview.status) !== args.stage) return false;
  if (args.role && interview.templateId !== args.role) return false;
  if (args.startDate && interview.startTime < args.startDate) return false;
  if (args.endDate && interview.startTime > args.endDate) return false;

  return true;
};

/**
 * The five metric cards on /dashboard.
 *
 * Split out of getAdminDashboard, which returned four unrelated slices and made
 * every caller pay for all of them — this screen was reading the entire users
 * and feedback tables to show five numbers.
 *
 * Figures cover the last DASHBOARD_WINDOW_DAYS days rather than all time. The
 * UI labels the window; changing what a number means without saying so would be
 * worse than the scan this replaces.
 */
export const getOperationsAnalytics = query({
  handler: async (ctx) => {
    const { user } = await requirePermission(ctx, "viewDashboard");
    const scopedInterviews = await loadScopedWindowInterviews(ctx, user);

    // Feedback for the windowed interviews only, via by_interview_id. The old
    // query read the whole feedback table to count drafts.
    const feedbackPerInterview = await Promise.all(
      scopedInterviews.map((interview: any) =>
        ctx.db
          .query("feedback")
          .withIndex("by_interview_id", (q: any) =>
            q.eq("interviewId", interview._id),
          )
          .collect(),
      ),
    );
    const feedback = feedbackPerInterview.flat();

    const countByStatus = (status: string) =>
      scopedInterviews.filter(
        (item: any) => normalizeInterviewStatus(item.status) === status,
      ).length;

    return {
      windowDays: DASHBOARD_WINDOW_DAYS,
      throughput: countByStatus("completed"),
      cancellations: countByStatus("cancelled"),
      noShows: countByStatus("no_show"),
      feedbackPending: feedback.filter((entry) => entry.state === "draft")
        .length,
      timeToHireDays:
        scopedInterviews.length === 0
          ? 0
          : Math.round(
              scopedInterviews.reduce((sum: number, interview: any) => {
                const createdAt = interview._creationTime ?? interview.startTime;
                return sum + Math.max(0, interview.startTime - createdAt);
              }, 0) /
                scopedInterviews.length /
                DAY_MS,
            ),
      funnel: FUNNEL_STAGES.map((status) => ({
        status,
        count: countByStatus(status),
      })),
    };
  },
});

/** Roles that can be assigned as an interviewer on a round. */
const STAFF_ROLES = ["interviewer", "recruiter", "admin"] as const;

/**
 * Staff directory for interviewer pickers.
 *
 * Three indexed reads via by_role rather than collecting the whole users table
 * and filtering. Bounded by headcount, which does not grow with public signup —
 * unlike the candidate list, which does.
 */
export const getInterviewerRoster = query({
  handler: async (ctx) => {
    const { user } = await requirePermission(ctx, "viewDashboard");

    // Contact details stay with the roles that need them. An interviewer or
    // developer holds viewDashboard but has no business reading everyone's email.
    const canViewContactDetails =
      user.role === "admin" || user.role === "recruiter";

    const byRole = await Promise.all(
      STAFF_ROLES.map((role) =>
        ctx.db
          .query("users")
          .withIndex("by_role", (q: any) => q.eq("role", role))
          .collect(),
      ),
    );

    return byRole.flat().map((staff: any) => ({
      clerkId: staff.clerkId,
      name: staff.name,
      email: canViewContactDetails ? staff.email : "",
      role: staff.role,
      skills: staff.skills ?? [],
      availabilitySummary: staff.availabilitySummary ?? "Availability not set",
      permissionTags: staff.permissionTags ?? [],
      isActive: staff.isActive ?? true,
    }));
  },
});

/**
 * The interview workspace table.
 *
 * Separate from the analytics query so that typing in the search box re-runs
 * only this, instead of recomputing the metric cards and the roster as the fat
 * query did on every keystroke.
 *
 * Resolves only the users these rows actually reference, rather than loading the
 * whole users table to build a lookup map.
 */
export const getInterviewPipeline = query({
  args: {
    search: v.optional(v.string()),
    interviewerId: v.optional(v.string()),
    candidateId: v.optional(v.string()),
    stage: v.optional(v.string()),
    role: v.optional(v.string()),
    startDate: v.optional(v.number()),
    endDate: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "viewDashboard");
    const scopedInterviews = await loadScopedWindowInterviews(ctx, user);

    // matchesFilters needs names, so resolve the users referenced by the
    // windowed set before filtering. Bounded by the window, not the table.
    const referencedClerkIds = new Set<string>();
    for (const interview of scopedInterviews) {
      referencedClerkIds.add(interview.candidateId);
      for (const id of interview.interviewerIds) referencedClerkIds.add(id);
    }

    const referencedUsers = await Promise.all(
      Array.from(referencedClerkIds).map((clerkId) =>
        ctx.db
          .query("users")
          .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
          .first(),
      ),
    );

    const usersByClerkId = new Map(
      referencedUsers
        .filter(Boolean)
        .map((referenced: any) => [referenced.clerkId, referenced]),
    );

    const feedbackByInterviewId = new Map<string, any[]>();

    const matching = scopedInterviews
      .filter((interview: any) => matchesFilters(interview, args, usersByClerkId))
      .sort((a: any, b: any) => b.startTime - a.startTime)
      .slice(0, PIPELINE_LIMIT);

    // Feedback only for the rows actually returned, not the whole table.
    await Promise.all(
      matching.map(async (interview: any) => {
        const entries = await ctx.db
          .query("feedback")
          .withIndex("by_interview_id", (q: any) =>
            q.eq("interviewId", interview._id),
          )
          .collect();
        feedbackByInterviewId.set(String(interview._id), entries);
      }),
    );

    return matching.map((interview: any) => {
      const candidate = usersByClerkId.get(interview.candidateId);
      const interviewFeedback =
        feedbackByInterviewId.get(String(interview._id)) ?? [];

      return {
        ...interview,
        normalizedStatus: normalizeInterviewStatus(interview.status),
        candidateName: candidate?.name ?? "Unknown Candidate",
        interviewerNames: interview.interviewerIds
          .map((id: string) => usersByClerkId.get(id)?.name ?? "Unknown")
          .join(", "),
        feedbackCompletion:
          interview.interviewerIds.length === 0
            ? 0
            : Math.round(
                (interviewFeedback.filter(
                  (entry: any) => entry.state === "submitted",
                ).length /
                  interview.interviewerIds.length) *
                  100,
              ),
      };
    });
  },
});

/** Candidates returned when the picker is idle, and the cap on search results. */
const CANDIDATE_LIMIT = 50;

/**
 * Candidates for the team page picker.
 *
 * This is the read that public signup breaks: candidates are the bulk of the
 * users table, and the fat query returned every one of them — each with a
 * `rounds` array built from the full interview list that the UI never rendered,
 * since it loads the selected candidate's history through getCandidateHistory.
 *
 * Idle, it returns candidates seen in the dashboard window. Searching goes
 * through the users search index. Either way the result is bounded.
 */
export const getCandidateDirectory = query({
  args: { search: v.optional(v.string()) },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "viewDashboard");

    const canViewContactDetails =
      user.role === "admin" || user.role === "recruiter";
    const scopedInterviews = await loadScopedWindowInterviews(ctx, user);
    const visibleCandidateIds = new Set<string>(
      scopedInterviews.map((interview: any) => interview.candidateId),
    );

    const search = args.search?.trim();
    let candidates: any[];

    if (search) {
      const matches = await ctx.db
        .query("users")
        .withSearchIndex("search_by_name", (q: any) =>
          q.search("name", search).eq("role", "candidate"),
        )
        .take(CANDIDATE_LIMIT);

      // Admins and recruiters may search the whole candidate base — the picker
      // has to reach someone with no recent rounds. Everyone else stays scoped
      // to candidates they actually interview, so an interviewer cannot use the
      // search box to enumerate the user base.
      candidates = canViewContactDetails
        ? matches
        : matches.filter((match: any) => visibleCandidateIds.has(match.clerkId));
    } else {
      const recent = await Promise.all(
        Array.from(visibleCandidateIds)
          .slice(0, CANDIDATE_LIMIT)
          .map((clerkId) =>
            ctx.db
              .query("users")
              .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
              .first(),
          ),
      );
      candidates = recent.filter(Boolean);
    }

    return candidates
      .map((candidate: any) => ({
        clerkId: candidate.clerkId,
        name: candidate.name,
        email: canViewContactDetails ? candidate.email : "",
        image: candidate.image,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  },
});

export const bulkUpdateInterviews = mutation({
  args: {
    interviewIds: v.array(v.id("interviews")),
    action: v.union(
      v.literal("mark_scheduled"),
      v.literal("mark_completed"),
      v.literal("mark_cancelled"),
      v.literal("assign_interviewer"),
    ),
    interviewerId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "editInterviews");
    let updatedCount = 0;

    for (const interviewId of args.interviewIds) {
      const interview = await ctx.db.get(interviewId);
      if (!interview) continue;

      if (args.action === "assign_interviewer") {
        if (!args.interviewerId) {
          throw createServerError(
            new Error("Missing interviewerId for assign_interviewer"),
            "Choose an interviewer to assign.",
          );
        }

        const nextIds = Array.from(new Set([...interview.interviewerIds, args.interviewerId]));
        await ctx.db.patch(interviewId, { interviewerIds: nextIds });
      } else {
        const status =
          args.action === "mark_scheduled"
            ? "scheduled"
            : args.action === "mark_completed"
              ? "completed"
              : "cancelled";

        await ctx.db.patch(interviewId, {
          status,
          ...(status === "completed" || status === "cancelled"
            ? { endTime: Date.now() }
            : {}),
        });
      }

      updatedCount += 1;
    }

    await logAuditEvent(ctx, {
      action: "admin.bulk_update_interviews",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      metadata: {
        action: args.action,
        count: updatedCount,
      },
    });

    return { updatedCount };
  },
});

export const manualOverrideInterview = mutation({
  args: {
    interviewId: v.id("interviews"),
    status: interviewStatusValidator,
    reason: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "editInterviews");
    const interview = await ctx.db.get(args.interviewId);

    if (!interview) {
      throw createServerError(
        new Error(`Interview not found: ${args.interviewId}`),
        "Interview not found.",
      );
    }

    await ctx.db.patch(args.interviewId, {
      status: args.status,
      lifecycleEvents: [
        ...(interview.lifecycleEvents ?? []),
        {
          type: "manual_override",
          at: Date.now(),
          actorClerkId: user.clerkId,
          note: args.reason,
        },
      ],
    });

    await logAuditEvent(ctx, {
      action: "admin.manual_override_interview",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "interview",
      targetId: args.interviewId,
      metadata: {
        status: args.status,
        reason: args.reason,
      },
    });

    return { updatedAt: Date.now() };
  },
});

export const updateInterviewerProfile = mutation({
  args: {
    clerkId: v.string(),
    skills: v.array(v.string()),
    availabilitySummary: v.string(),
    permissionTags: v.array(v.string()),
    isActive: v.boolean(),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageRoles");
    const target = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!target) {
      throw createServerError(new Error(`User not found: ${args.clerkId}`), "User not found.");
    }

    await ctx.db.patch(target._id, {
      skills: args.skills,
      availabilitySummary: args.availabilitySummary,
      permissionTags: args.permissionTags,
      isActive: args.isActive,
    });

    await logAuditEvent(ctx, {
      action: "admin.interviewer_profile_updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "user",
      targetId: target._id,
      metadata: {
        role: target.role,
      },
    });

    return target._id;
  },
});

export const getCandidateHistory = query({
  args: {
    candidateId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "viewDashboard");

    const allCandidateInterviews = await ctx.db
      .query("interviews")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .collect();

    // candidateId is a caller-supplied string with no relationship to the viewer,
    // so scope to the interviews this viewer can actually access. Without this,
    // any interviewer or developer could pull a full dossier — private notes
    // included — for any candidate whose clerkId they had.
    const interviews = allCandidateInterviews.filter((interview) =>
      canAccessInterview(user, interview),
    );

    if (interviews.length === 0) return [];

    // Feedback for this candidate's accessible interviews only. This read the
    // entire feedback table and then discarded all but a handful of rows.
    const feedbackPerInterview = await Promise.all(
      interviews.map((interview) =>
        ctx.db
          .query("feedback")
          .withIndex("by_interview_id", (q) =>
            q.eq("interviewId", interview._id),
          )
          .collect(),
      ),
    );
    const visibleFeedback = feedbackPerInterview.flat();

    // Private notes are the author's alone; admins and recruiters see everything.
    const canReadPrivateNotes =
      user.role === "admin" || user.role === "recruiter";

    return interviews
      .sort((a, b) => b.startTime - a.startTime)
      .map((interview) => ({
        ...interview,
        normalizedStatus: normalizeInterviewStatus(interview.status),
        feedback: visibleFeedback
          .filter((entry) => String(entry.interviewId) === String(interview._id))
          .map((entry) =>
            canReadPrivateNotes || entry.interviewerId === user.clerkId
              ? entry
              : { ...entry, privateNotes: undefined },
          ),
      }));
  },
});
