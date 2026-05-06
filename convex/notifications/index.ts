import { internalMutation, mutation, query } from "../_generated/server";
import { v } from "convex/values";
import { internal } from "../_generated/api";
import { getCurrentUserRecord, logAuditEvent, requirePermission } from "../lib/authz";
import { createServerError } from "../lib/errorUtils";

const notificationChannelValidator = v.union(
  v.literal("in_app"),
  v.literal("email"),
);

const notificationCategoryValidator = v.union(
  v.literal("interview_schedule"),
  v.literal("interview_update"),
  v.literal("interview_reminder"),
  v.literal("feedback_reminder"),
  v.literal("system"),
);

type NotificationChannel = "in_app" | "email";
type NotificationCategory =
  | "interview_schedule"
  | "interview_update"
  | "interview_reminder"
  | "feedback_reminder"
  | "system";

const defaultPreferencePayload = (userClerkId: string) => ({
  userClerkId,
  emailEnabled: true,
  inAppEnabled: true,
  interviewScheduleEmails: true,
  interviewReminderEmails: true,
  feedbackReminderEmails: true,
  optOutAll: false,
  updatedAt: Date.now(),
});

const parseMetadata = (metadata?: string) => {
  if (!metadata) return null;

  try {
    return JSON.parse(metadata);
  } catch {
    return null;
  }
};

const inferNotificationCategory = (notification: {
  category?: NotificationCategory;
  type?: string;
}): NotificationCategory => {
  if (notification.category) return notification.category;

  switch (notification.type) {
    case "interview.scheduled":
      return "interview_schedule";
    case "interview.reminder":
      return "interview_reminder";
    case "feedback.reminder":
      return "feedback_reminder";
    case "interview.rescheduled":
    case "interview.cancelled":
    case "interview.updated":
      return "interview_update";
    default:
      return "system";
  }
};

const inferNotificationChannel = (notification: {
  channel?: NotificationChannel;
  recipientEmail?: string;
  providerMessageId?: string;
  readAt?: number;
}): NotificationChannel => {
  if (notification.channel) return notification.channel;
  if (notification.readAt) return "in_app";
  if (notification.recipientEmail || notification.providerMessageId) return "email";
  return "in_app";
};

const isEmailAllowedForCategory = (
  prefs: ReturnType<typeof defaultPreferencePayload>,
  category: NotificationCategory,
) => {
  if (prefs.optOutAll || !prefs.emailEnabled) return false;
  if (category === "interview_schedule" || category === "interview_update") {
    return prefs.interviewScheduleEmails;
  }
  if (category === "interview_reminder") return prefs.interviewReminderEmails;
  if (category === "feedback_reminder") return prefs.feedbackReminderEmails;

  return true;
};

const isInAppAllowed = (prefs: ReturnType<typeof defaultPreferencePayload>) =>
  !prefs.optOutAll && prefs.inAppEnabled;

const computeNextRetryAt = (attempts: number) =>
  Date.now() + Math.min(15 * 60 * 1000, 60 * 1000 * 2 ** Math.max(0, attempts - 1));

const createNotificationFanout = async (
  ctx: any,
  args: {
    recipientClerkId: string;
    recipientEmail?: string;
    interviewId?: string;
    type: string;
    category:
      | "interview_schedule"
      | "interview_update"
      | "interview_reminder"
      | "feedback_reminder"
      | "system";
    title: string;
    message: string;
    scheduledFor: number;
    timezone?: string;
    metadata?: string;
  },
) => {
  const inAppId = await ctx.db.insert("notifications", {
    recipientClerkId: args.recipientClerkId,
    recipientEmail: args.recipientEmail,
    interviewId: args.interviewId,
    type: args.type,
    channel: "in_app",
    category: args.category,
    title: args.title,
    message: args.message,
    status: "pending",
    scheduledFor: args.scheduledFor,
    timezone: args.timezone,
    metadata: args.metadata,
    deliveryAttempts: 0,
  });

  const emailId = await ctx.db.insert("notifications", {
    recipientClerkId: args.recipientClerkId,
    recipientEmail: args.recipientEmail,
    interviewId: args.interviewId,
    type: args.type,
    channel: "email",
    category: args.category,
    title: args.title,
    message: args.message,
    status: "pending",
    scheduledFor: args.scheduledFor,
    timezone: args.timezone,
    metadata: args.metadata,
    deliveryAttempts: 0,
  });

  const delay = Math.max(0, args.scheduledFor - Date.now());
  await ctx.scheduler.runAfter(delay, internal.notifications.index.processNotificationDelivery, {
    notificationId: inAppId,
  });
  await ctx.scheduler.runAfter(delay, internal.notifications.index.processNotificationDelivery, {
    notificationId: emailId,
  });

  return { inAppId, emailId };
};

const ensurePreferences = async (ctx: any, userClerkId: string) => {
  const existing = await ctx.db
    .query("notificationPreferences")
    .withIndex("by_user_clerk_id", (q: any) => q.eq("userClerkId", userClerkId))
    .first();

  if (existing) return existing;

  const payload = defaultPreferencePayload(userClerkId);
  const preferenceId = await ctx.db.insert("notificationPreferences", payload);
  return { _id: preferenceId, ...payload };
};

export const processNotificationDelivery = internalMutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (
      !notification ||
      notification.status === "read" ||
      notification.status === "sent" ||
      notification.status === "processing"
    ) {
      return null;
    }

    const channel = inferNotificationChannel(notification);
    const category = inferNotificationCategory(notification);

    const preferences = await ensurePreferences(ctx, notification.recipientClerkId);

    try {
      if (
        channel === "in_app" &&
        !isInAppAllowed(preferences)
      ) {
        await ctx.db.patch(args.notificationId, {
          status: "suppressed",
          lastError: "User disabled in-app notifications.",
          channel,
          category,
        });
        return { status: "suppressed" as const };
      }

      if (channel === "email") {
        if (!isEmailAllowedForCategory(preferences, category)) {
          await ctx.db.patch(args.notificationId, {
            status: "suppressed",
            lastError: "User opted out of this email category.",
            channel,
            category,
          });
          return { status: "suppressed" as const };
        }

        if (!notification.recipientEmail) {
          await ctx.db.patch(args.notificationId, {
            status: "failed",
            lastError: "Recipient email missing.",
            deliveryAttempts: (notification.deliveryAttempts ?? 0) + 1,
            nextRetryAt: computeNextRetryAt((notification.deliveryAttempts ?? 0) + 1),
            channel,
            category,
          });
          return { status: "failed" as const };
        }

        // Parse metadata for template data
        const meta = parseMetadata(notification.metadata);

        // Mark as in-flight before scheduling so concurrent retries skip this
        // notification. deliveryAttempts is incremented here; updateNotificationDelivery
        // must NOT add to it again. nextRetryAt serves as a recovery deadline: if
        // dispatchEmailNotification crashes before calling updateNotificationDelivery,
        // recoverStuckNotifications can reset this after 20 minutes.
        const nextAttempts = (notification.deliveryAttempts ?? 0) + 1;
        await ctx.db.patch(args.notificationId, {
          status: "processing",
          channel,
          category,
          deliveryAttempts: nextAttempts,
          nextRetryAt: Date.now() + 20 * 60 * 1000,
        });

        // Dispatch email via Convex action -> Next.js API
        await ctx.scheduler.runAfter(0, internal.notifications.emailActions.dispatchEmailNotification, {
          notificationId: args.notificationId,
          type: notification.type,
          recipientEmail: notification.recipientEmail,
          recipientName: meta?.recipientName,
          interviewTitle: notification.title,
          interviewDate:
            meta?.startTime ?? meta?.interviewDate ?? meta?.nextStartTime,
          previousDate: meta?.previousStartTime ?? meta?.previousDate,
          feedbackDueAt: meta?.dueAt ?? meta?.feedbackDueAt,
          timezone: notification.timezone,
          reason: meta?.reason,
          interviewUrl: meta?.interviewUrl,
          metadata: notification.metadata,
        });

        return { status: "processing" as const };
      }

      // In-app notifications are delivered immediately
      await ctx.db.patch(args.notificationId, {
        status: "sent",
        sentAt: Date.now(),
        deliveryAttempts: (notification.deliveryAttempts ?? 0) + 1,
        nextRetryAt: undefined,
        lastError: undefined,
        channel,
        category,
      });

      return { status: "sent" as const };
    } catch (error) {
      const attempts = (notification.deliveryAttempts ?? 0) + 1;
      const nextRetryAt = computeNextRetryAt(attempts);

      await ctx.db.patch(args.notificationId, {
        status: "failed",
        deliveryAttempts: attempts,
        nextRetryAt,
        channel,
        category,
        lastError: error instanceof Error ? error.message : "Unknown notification delivery error.",
      });

      // Only retry if under max attempts (5)
      if (attempts < 5) {
        await ctx.scheduler.runAfter(
          Math.max(0, nextRetryAt - Date.now()),
          internal.notifications.index.processNotificationDelivery,
          { notificationId: args.notificationId },
        );
      }

      return { status: "failed" as const };
    }
  },
});

/**
 * Internal mutation for emailActions to report delivery status back.
 */
export const updateNotificationDelivery = internalMutation({
  args: {
    notificationId: v.id("notifications"),
    status: v.union(v.literal("sent"), v.literal("failed")),
    providerMessageId: v.optional(v.string()),
    lastError: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const notification = await ctx.db.get(args.notificationId);
    if (!notification) return;

    // deliveryAttempts was already incremented by processNotificationDelivery
    // when it set status to "processing". Do not add to it here.
    const attempts = notification.deliveryAttempts ?? 1;

    if (args.status === "sent") {
      await ctx.db.patch(args.notificationId, {
        status: "sent",
        sentAt: Date.now(),
        providerMessageId: args.providerMessageId,
        nextRetryAt: undefined,
        lastError: undefined,
      });
    } else {
      const nextRetryAt = computeNextRetryAt(attempts);

      await ctx.db.patch(args.notificationId, {
        status: "failed",
        lastError: args.lastError ?? "Email delivery failed.",
        nextRetryAt,
      });

      // Schedule retry if under max attempts (5)
      if (attempts < 5) {
        await ctx.scheduler.runAfter(
          Math.max(0, nextRetryAt - Date.now()),
          internal.notifications.index.processNotificationDelivery,
          { notificationId: args.notificationId },
        );
      }
    }
  },
});

export const queueNotification = internalMutation({
  args: {
    recipientClerkId: v.string(),
    recipientEmail: v.optional(v.string()),
    interviewId: v.optional(v.id("interviews")),
    type: v.string(),
    category: notificationCategoryValidator,
    title: v.string(),
    message: v.string(),
    scheduledFor: v.number(),
    timezone: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await createNotificationFanout(ctx, args);
  },
});

export const queueInterviewNotifications = internalMutation({
  args: {
    interviewId: v.optional(v.id("interviews")),
    recipientClerkIds: v.array(v.string()),
    type: v.string(),
    category: notificationCategoryValidator,
    title: v.string(),
    message: v.string(),
    scheduledFor: v.number(),
    timezone: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    for (const clerkId of args.recipientClerkIds) {
      const user = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", clerkId))
        .first();

      await createNotificationFanout(ctx, {
        recipientClerkId: clerkId,
        recipientEmail: user?.email,
        interviewId: args.interviewId,
        type: args.type,
        category: args.category,
        title: args.title,
        message: args.message,
        scheduledFor: args.scheduledFor,
        timezone: args.timezone,
        metadata: args.metadata,
      });
    }
  },
});

export const getMyNotifications = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_scheduled_for", (q: any) =>
        q.eq("recipientClerkId", user.clerkId),
      )
      .order("desc")
      .take(75);

    return notifications.filter(
      (notification) =>
        notification.channel === undefined || notification.channel === "in_app",
    );
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

export const markAllNotificationsAsRead = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_status", (q: any) =>
        q.eq("recipientClerkId", user.clerkId).eq("status", "sent"),
      )
      .collect();

    const inAppNotifications = notifications.filter(
      (n) => n.channel === undefined || n.channel === "in_app",
    );

    const now = Date.now();
    let updatedCount = 0;
    for (const notification of inAppNotifications) {
      await ctx.db.patch(notification._id, {
        status: "read",
        readAt: now,
      });
      updatedCount += 1;
    }

    return { updatedCount };
  },
});

export const getMyNotificationPreferences = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    return await ensurePreferences(ctx, user.clerkId);
  },
});

export const getLegacyNotificationBackfillStatus = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewDashboard");
    const notifications = await ctx.db.query("notifications").collect();
    const missing = notifications.filter(
      (notification) => !notification.category || !notification.channel,
    );

    return {
      total: notifications.length,
      missingCount: missing.length,
      samples: missing.slice(0, 10).map((notification) => ({
        _id: notification._id,
        type: notification.type,
        status: notification.status,
        inferredCategory: inferNotificationCategory(notification),
        inferredChannel: inferNotificationChannel(notification),
      })),
    };
  },
});

export const backfillLegacyNotificationFields = mutation({
  args: {},
  handler: async (ctx) => {
    const { user } = await requirePermission(ctx, "manageReliability");
    const notifications = await ctx.db.query("notifications").collect();
    let updatedCount = 0;

    for (const notification of notifications) {
      if (notification.category && notification.channel) continue;

      await ctx.db.patch(notification._id, {
        category: inferNotificationCategory(notification),
        channel: inferNotificationChannel(notification),
      });
      updatedCount += 1;
    }

    await logAuditEvent(ctx, {
      action: "notifications.legacy_backfill",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "notifications",
      metadata: {
        updatedCount,
      },
    });

    return {
      updatedCount,
      completedAt: Date.now(),
    };
  },
});

export const updateMyNotificationPreferences = mutation({
  args: {
    emailEnabled: v.boolean(),
    inAppEnabled: v.boolean(),
    interviewScheduleEmails: v.boolean(),
    interviewReminderEmails: v.boolean(),
    feedbackReminderEmails: v.boolean(),
    optOutAll: v.boolean(),
    timezone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const existing = await ensurePreferences(ctx, user.clerkId);

    await ctx.db.patch(existing._id, {
      ...args,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      action: "notifications.preferences_updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "notificationPreferences",
      targetId: existing._id,
      metadata: {
        optOutAll: args.optOutAll,
        timezone: args.timezone,
      },
    });

    return { updatedAt: Date.now() };
  },
});

export const retryNotification = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    await requirePermission(ctx, "manageReliability");
    const notification = await ctx.db.get(args.notificationId);

    if (!notification) {
      throw createServerError(
        new Error(`Notification not found: ${args.notificationId}`),
        "Notification not found.",
      );
    }

    await ctx.db.patch(args.notificationId, {
      status: "pending",
      nextRetryAt: undefined,
    });

    await ctx.scheduler.runAfter(0, internal.notifications.index.processNotificationDelivery, {
      notificationId: args.notificationId,
    });

    return { queuedAt: Date.now() };
  },
});

export const getUnreadNotificationCount = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_recipient_channel", (q: any) =>
        q.eq("recipientClerkId", user.clerkId).eq("channel", "in_app"),
      )
      .collect();

    return notifications.filter(
      (n) => n.status === "sent" || n.status === "pending",
    ).length;
  },
});

export const recoverStuckNotifications = mutation({
  handler: async (ctx) => {
    const { user } = await requirePermission(ctx, "manageReliability");
    const cutoff = Date.now() - 20 * 60 * 1000;

    const stuck = await ctx.db
      .query("notifications")
      .withIndex("by_status", (q: any) => q.eq("status", "processing"))
      .collect();

    let recoveredCount = 0;
    for (const n of stuck) {
      if ((n.nextRetryAt ?? 0) < cutoff) {
        const attempts = n.deliveryAttempts ?? 1;
        const nextRetryAt = computeNextRetryAt(attempts);
        await ctx.db.patch(n._id, {
          status: "failed",
          lastError: "Recovered from stuck processing state.",
          nextRetryAt,
        });
        if (attempts < 5) {
          await ctx.scheduler.runAfter(
            Math.max(0, nextRetryAt - Date.now()),
            internal.notifications.index.processNotificationDelivery,
            { notificationId: n._id },
          );
        }
        recoveredCount++;
      }
    }

    await logAuditEvent(ctx, {
      action: "notifications.recovered",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "notification",
      targetId: "batch",
      metadata: { recoveredCount },
    });

    return { recoveredCount };
  },
});

export const getNotificationOperationsDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewObservability");
    const notifications = await ctx.db.query("notifications").order("desc").take(200);

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentNotifications = notifications.filter((n) => (n.sentAt ?? n.scheduledFor) >= oneDayAgo);

    return {
      totals: {
        pending: notifications.filter((item) => item.status === "pending").length,
        failed: notifications.filter((item) => item.status === "failed").length,
        suppressed: notifications.filter((item) => item.status === "suppressed").length,
        deliveredEmails: notifications.filter(
          (item) => item.channel === "email" && item.status === "sent",
        ).length,
        deliveredInApp: notifications.filter(
          (item) => item.channel === "in_app" && item.status === "sent",
        ).length,
        totalSent: notifications.filter((item) => item.status === "sent").length,
        readCount: notifications.filter((item) => item.status === "read").length,
      },
      recentNotifications: recentNotifications.slice(0, 30),
      failedNotifications: notifications
        .filter((item) => item.status === "failed")
        .slice(0, 20),
    };
  },
});
