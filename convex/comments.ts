import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { createServerError, requireIdentity } from "./errorUtils";

export const addComment = mutation({
  args: {
    content: v.string(),
    rating: v.number(),
    interviewId: v.id("interviews"),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    if (args.rating < 1 || args.rating > 5) {
      throw createServerError(
        new Error(`Invalid rating received: ${args.rating}`),
        "Rating must be between 1 and 5.",
      );
    }

    return await ctx.db.insert("comments", {
      interviewId: args.interviewId,
      content: args.content,
      rating: args.rating,
      interviewerId: identity.subject,
    });
  },
});

// get all comments for an interview
export const getComments = query({
  args: { interviewId: v.id("interviews") },
  handler: async (ctx, args) => {
    await requireIdentity(ctx);
    const comments = await ctx.db
      .query("comments")
      .withIndex("by_interview_id", (q) =>
        q.eq("interviewId", args.interviewId),
      )
      .collect();
    return comments;
  },
});
