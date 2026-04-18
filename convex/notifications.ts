import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserRecord } from "./authz";
import { createServerError } from "./errorUtils";

export const getMyNotifications = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    return await ctx.db
      .query("notifications")
      .withIndex("by_recipient_scheduled_for", (q: any) =>
        q.eq("recipientClerkId", user.clerkId),
      )
      .order("desc")
      .take(50);
  },
});

export const markNotificationAsRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw createServerError(
        new Error(`Notification not found: ${args.notificationId}`),
        "Notification not found.",
      );
    }

    if (notification.recipientClerkId !== user.clerkId) {
      throw createServerError(
        new Error(
          `User ${user.clerkId} attempted to read notification ${args.notificationId}`,
        ),
        "You are not allowed to update this notification.",
      );
    }

    await ctx.db.patch(args.notificationId, {
      status: "read",
      readAt: Date.now(),
    });
  },
});
