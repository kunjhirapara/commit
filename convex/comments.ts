import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  logAuditEvent,
  requireInterviewAccess,
  requireInterviewReviewAccess,
} from "./authz";
import { createServerError } from "./errorUtils";

export const addComment = mutation({
  args: {
    content: v.string(),
    rating: v.number(),
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInterviewReviewAccess(ctx, args.interviewId);

    if (args.rating < 1 || args.rating > 5) {
      throw createServerError(
        new Error(`Invalid rating received: ${args.rating}`),
        "Rating must be between 1 and 5.",
      );
    }

    const commentId = await ctx.db.insert("comments", {
      interviewId: args.interviewId,
      content: args.content,
      rating: args.rating,
      interviewerId: user.clerkId,
    });

    await logAuditEvent(ctx, {
      action: "comment.created",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "comment",
      targetId: commentId,
      metadata: {
        interviewId: args.interviewId,
        rating: args.rating,
      },
    });

    return commentId;
  },
});

// get all comments for an interview
export const getComments = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    await requireInterviewAccess(ctx, args.interviewId);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_interview_id", (q) =>
        q.eq("interviewId", args.interviewId),
      )
      .collect();
    return comments;
  },
});
