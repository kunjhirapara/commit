import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logAuditEvent, requireInterviewAccess, requireInterviewReviewAccess } from "./lib/authz";

export const logSessionEvent = mutation({
  args: {
    interviewId: v.id("interviews"),
    streamCallId: v.string(),
    type: v.string(),
    detail: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInterviewAccess(ctx, args.interviewId);

    const eventId = await ctx.db.insert("interviewSessionEvents", {
      interviewId: args.interviewId,
      streamCallId: args.streamCallId,
      type: args.type,
      actorClerkId: user.clerkId,
      actorRole: user.role,
      detail: args.detail,
      metadata: args.metadata,
      createdAt: Date.now(),
    });

    if (
      args.type.startsWith("host.") ||
      args.type.startsWith("recording.") ||
      args.type.startsWith("session.")
    ) {
      await logAuditEvent(ctx, {
        action: args.type,
        actorClerkId: user.clerkId,
        actorEmail: user.email,
        targetType: "interviewSessionEvent",
        targetId: eventId,
        metadata: {
          interviewId: args.interviewId,
          streamCallId: args.streamCallId,
          detail: args.detail,
        },
      });
    }

    return eventId;
  },
});

export const getSessionEvents = query({
  args: {
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    await requireInterviewReviewAccess(ctx, args.interviewId);
    return await ctx.db
      .query("interviewSessionEvents")
      .withIndex("by_interview_id", (q) => q.eq("interviewId", args.interviewId))
      .order("desc")
      .take(50);
  },
});
