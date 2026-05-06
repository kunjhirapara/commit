import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  canAccessInterview,
  getCurrentUserRecord,
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

export const getAdminDashboard = query({
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
    await requirePermission(ctx, "viewDashboard");
    const { user } = await getCurrentUserRecord(ctx);
    const interviews = await ctx.db.query("interviews").collect();
    const users = await ctx.db.query("users").collect();
    const feedback = await ctx.db.query("feedback").collect();
    const usersByClerkId = new Map(users.map((user) => [user.clerkId, user]));
    const scopedInterviews =
      user.role === "admin" || user.role === "recruiter"
        ? interviews
        : interviews.filter((interview) => canAccessInterview(user, interview));

    const pipeline = scopedInterviews
      .filter((interview) => matchesFilters(interview, args, usersByClerkId))
      .sort((a, b) => b.startTime - a.startTime)
      .slice(0, 100)
      .map((interview) => {
        const candidate = usersByClerkId.get(interview.candidateId);
        const interviewers = interview.interviewerIds.map((id: string) => usersByClerkId.get(id));
        const interviewFeedback = feedback.filter(
          (entry) => String(entry.interviewId) === String(interview._id),
        );

        return {
          ...interview,
          normalizedStatus: normalizeInterviewStatus(interview.status),
          candidateName: candidate?.name ?? "Unknown Candidate",
          interviewerNames: interviewers.map((user: any) => user?.name ?? "Unknown").join(", "),
          feedbackCompletion:
            interview.interviewerIds.length === 0
              ? 0
              : Math.round((interviewFeedback.filter((entry) => entry.state === "submitted").length /
                  interview.interviewerIds.length) *
                  100),
        };
      });

    const analytics = {
      throughput: scopedInterviews.filter((item) => normalizeInterviewStatus(item.status) === "completed").length,
      cancellations: scopedInterviews.filter((item) => normalizeInterviewStatus(item.status) === "cancelled").length,
      noShows: scopedInterviews.filter((item) => normalizeInterviewStatus(item.status) === "no_show").length,
      feedbackPending: feedback.filter(
        (entry) =>
          entry.state === "draft" &&
          scopedInterviews.some(
            (interview) => String(interview._id) === String(entry.interviewId),
          ),
      ).length,
      timeToHireDays:
        scopedInterviews.length === 0
          ? 0
          : Math.round(
              scopedInterviews.reduce((sum, interview) => {
                const createdAt = interview._creationTime ?? interview.startTime;
                return sum + Math.max(0, interview.startTime - createdAt);
              }, 0) /
                scopedInterviews.length /
                (24 * 60 * 60 * 1000),
            ),
      funnel: ["scheduled", "live", "completed", "passed", "rejected", "cancelled", "no_show"].map(
        (status) => ({
          status,
          count: scopedInterviews.filter(
            (item) => normalizeInterviewStatus(item.status) === status,
          ).length,
        }),
      ),
    };

    const candidates = users
      .filter((user) => user.role === "candidate")
      .map((candidate) => {
        const candidateInterviews = interviews
          .filter((interview) => interview.candidateId === candidate.clerkId)
          .sort((a, b) => b.startTime - a.startTime);

        return {
          clerkId: candidate.clerkId,
          name: candidate.name,
          email: candidate.email,
          image: candidate.image,
          rounds: candidateInterviews.map((interview) => ({
            id: interview._id,
            title: interview.title,
            templateLabel: interview.templateLabel,
            status: normalizeInterviewStatus(interview.status),
            startTime: interview.startTime,
          })),
        };
      });

    const interviewerRoster = users
      .filter(
        (user) =>
          user.role === "interviewer" || user.role === "recruiter" || user.role === "admin",
      )
      .map((user) => ({
        clerkId: user.clerkId,
        name: user.name,
        email: user.email,
        role: user.role,
        skills: user.skills ?? [],
        availabilitySummary: user.availabilitySummary ?? "Availability not set",
        permissionTags: user.permissionTags ?? [],
        isActive: user.isActive ?? true,
      }));

    return {
      pipeline,
      analytics,
      candidates,
      interviewerRoster,
    };
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
    await requirePermission(ctx, "viewDashboard");
    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_candidate_id", (q) => q.eq("candidateId", args.candidateId))
      .collect();
    const feedback = await ctx.db.query("feedback").collect();

    return interviews
      .sort((a, b) => b.startTime - a.startTime)
      .map((interview) => ({
        ...interview,
        normalizedStatus: normalizeInterviewStatus(interview.status),
        feedback: feedback.filter((entry) => String(entry.interviewId) === String(interview._id)),
      }));
  },
});
