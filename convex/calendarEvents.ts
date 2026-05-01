import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserRecord, logAuditEvent, requirePermission } from "./authz";
import { createServerError } from "./errorUtils";

export const getCalendarEventsForUser = query({
  args: {
    userClerkId: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const targetClerkId = args.userClerkId || user.clerkId;

    if (targetClerkId !== user.clerkId) {
      await requirePermission(ctx, "viewUsers");
    }

    return await ctx.db
      .query("customCalendarEvents")
      .withIndex("by_user_clerk_id", (q) => q.eq("userClerkId", targetClerkId))
      .collect();
  },
});

export const createCalendarEvent = mutation({
  args: {
    title: v.string(),
    description: v.optional(v.string()),
    startTime: v.number(),
    endTime: v.number(),
    userClerkId: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);

    if (args.userClerkId !== user.clerkId) {
      await requirePermission(ctx, "viewUsers");
    }

    const title = args.title.trim();
    const description = args.description?.trim() || undefined;

    if (!title) {
      throw createServerError(
        new Error("Custom calendar event title is required."),
        "Please enter a title for the calendar event.",
      );
    }

    if (args.endTime <= args.startTime) {
      throw createServerError(
        new Error("Custom calendar event end time must be after start time."),
        "End time must be after start time.",
      );
    }

    const eventId = await ctx.db.insert("customCalendarEvents", {
      title,
      description,
      startTime: args.startTime,
      endTime: args.endTime,
      userClerkId: args.userClerkId,
      createdBy: user.clerkId,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      action: "calendar_event.created",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "customCalendarEvent",
      targetId: eventId,
      metadata: {
        userClerkId: args.userClerkId,
        startTime: args.startTime,
        endTime: args.endTime,
      },
    });

    return eventId;
  },
});
