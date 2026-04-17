import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createServerError, requireIdentity } from "./errorUtils";
// get all interviews
export const getAllInterviews = query({
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const interviews = await ctx.db.query("interviews").collect();
    return interviews;
  },
});

// get interviews for a candidate
export const getMyInterviews = query({
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const interviews = await ctx.db
      .query("interviews")
      .withIndex("by_candidate_id", (q) =>
        q.eq("candidateId", identity.subject),
      )
      .collect();
    return interviews;
  },
});

// get interview by stream call id
export const getInterviewByStreamCallId = query({
  args: { streamCallId: v.string() },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const interview = await ctx.db
      .query("interviews")
      .withIndex("by_stream_call_id", (q) =>
        q.eq("streamCallId", args.streamCallId),
      )
      .first();

    return interview;
  },
});

export const createInterview = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    status: v.string(),
    streamCallId: v.string(),
    candidateId: v.string(),
    interviewerIds: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    return await ctx.db.insert("interviews", {
      ...args,
    });
  },
});

export const updateInterviewStatus = mutation({
  args: {
    interviewId: v.id("interviews"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);
    const interview = await ctx.db.get(args.interviewId);

    if (!interview) {
      throw createServerError(
        new Error(`Interview not found: ${args.interviewId}`),
        "Interview not found.",
      );
    }

    if (!interview.interviewerIds.includes(identity.subject)) {
      throw createServerError(
        new Error(
          `User ${identity.subject} is not allowed to update interview ${args.interviewId}`,
        ),
        "You are not allowed to update this interview.",
      );
    }

    return await ctx.db.patch(args.interviewId, {
      status: args.status,
      ...(args.status === "completed" ? { endTime: Date.now() } : {}),
    });
  },
});
