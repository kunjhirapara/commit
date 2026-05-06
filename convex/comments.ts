import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  logAuditEvent,
  requirePermission,
  requireInterviewAccess,
  requireInterviewReviewAccess,
} from "./lib/authz";
import { createServerError } from "./lib/errorUtils";

export const addComment = mutation({
  args: {
    content: v.string(),
    rating: v.number(),
    interviewId: v.id("interviews"),
    visibility: v.optional(v.union(v.literal("shared"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const { user } = await requireInterviewReviewAccess(ctx, args.interviewId);
    const now = Date.now();

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
      visibility: args.visibility ?? "shared",
      updatedAt: now,
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
        visibility: args.visibility ?? "shared",
      },
    });

    return commentId;
  },
});

// get all comments for an interview
export const getComments = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    const { user } = await requireInterviewReviewAccess(ctx, args.interviewId);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_interview_id", (q) =>
        q.eq("interviewId", args.interviewId),
      )
      .order("desc")
      .take(100);

    return comments.filter((comment) => {
      if ((comment.visibility ?? "shared") === "shared") return true;
      if (comment.interviewerId === user.clerkId) return true;

      return user.role === "admin" || user.role === "recruiter";
    });
  },
});

export const editComment = mutation({
  args: {
    commentId: v.id("comments"),
    content: v.string(),
    rating: v.number(),
    visibility: v.optional(v.union(v.literal("shared"), v.literal("private"))),
  },
  handler: async (ctx, args) => {
    const comment = await ctx.db.get(args.commentId);
    const now = Date.now();

    if (!comment) {
      throw createServerError(
        new Error(`Comment not found: ${args.commentId}`),
        "Comment not found.",
      );
    }

    const { user } = await requireInterviewReviewAccess(
      ctx,
      comment.interviewId,
    );

    if (
      comment.interviewerId !== user.clerkId &&
      user.role !== "admin" &&
      user.role !== "recruiter"
    ) {
      throw createServerError(
        new Error(`User ${user.clerkId} cannot edit comment ${args.commentId}`),
        "You can only edit your own notes.",
      );
    }

    await ctx.db.patch(args.commentId, {
      content: args.content.trim(),
      rating: args.rating,
      visibility: args.visibility ?? comment.visibility ?? "shared",
      updatedAt: now,
    });

    await logAuditEvent(ctx, {
      action: "comment.edited",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "comment",
      targetId: args.commentId,
      metadata: {
        interviewId: comment.interviewId,
      },
    });
  },
});
