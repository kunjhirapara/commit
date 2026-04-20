import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./authz";

const telemetryLevelValidator = v.union(
  v.literal("info"),
  v.literal("warn"),
  v.literal("error"),
  v.literal("critical"),
);

const sourceValidator = v.union(
  v.literal("client"),
  v.literal("server"),
  v.literal("convex"),
  v.literal("webhook"),
);

const healthStatusValidator = v.union(
  v.literal("healthy"),
  v.literal("degraded"),
  v.literal("unhealthy"),
);

const serializeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;

  try {
    return JSON.stringify(metadata);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
};

export const recordOperationalEvent = internalMutation({
  args: {
    source: sourceValidator,
    scope: v.string(),
    level: telemetryLevelValidator,
    message: v.string(),
    requestId: v.optional(v.string()),
    correlationId: v.optional(v.string()),
    userId: v.optional(v.string()),
    interviewId: v.optional(v.string()),
    streamCallId: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("operationalEvents", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const ingestTelemetry = mutation({
  args: {
    source: sourceValidator,
    scope: v.string(),
    level: telemetryLevelValidator,
    message: v.string(),
    requestId: v.optional(v.string()),
    correlationId: v.optional(v.string()),
    interviewId: v.optional(v.string()),
    streamCallId: v.optional(v.string()),
    provider: v.optional(v.string()),
    status: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    await ctx.db.insert("operationalEvents", {
      ...args,
      userId: identity?.subject,
      createdAt: Date.now(),
    });
  },
});

export const recordHealthCheck = internalMutation({
  args: {
    provider: v.string(),
    status: healthStatusValidator,
    message: v.string(),
    latencyMs: v.optional(v.number()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("integrationHealthChecks", {
      ...args,
      checkedAt: Date.now(),
    });
  },
});

export const captureHealthSnapshot = mutation({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewObservability");

    const now = Date.now();
    const envChecks = [
      {
        provider: "clerk",
        status: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          ? "healthy"
          : "unhealthy",
        message: process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
          ? "Clerk publishable key configured."
          : "Missing Clerk publishable key.",
      },
      {
        provider: "convex",
        status: process.env.NEXT_PUBLIC_CONVEX_URL ? "healthy" : "unhealthy",
        message: process.env.NEXT_PUBLIC_CONVEX_URL
          ? "Convex deployment configured."
          : "Missing Convex URL.",
      },
      {
        provider: "stream",
        status:
          process.env.NEXT_PUBLIC_STREAM_API_KEY && process.env.STREAM_SECRET_KEY
            ? "healthy"
            : "unhealthy",
        message:
          process.env.NEXT_PUBLIC_STREAM_API_KEY && process.env.STREAM_SECRET_KEY
            ? "Stream video credentials configured."
            : "Missing Stream credentials.",
      },
      {
        provider: "webhooks",
        status: process.env.CLERK_WEBHOOK_SECRET ? "healthy" : "degraded",
        message: process.env.CLERK_WEBHOOK_SECRET
          ? "Webhook secret configured."
          : "Webhook secret missing. Clerk sync will fail.",
      },
    ] as const;

    await Promise.all(
      envChecks.map((check) =>
        ctx.db.insert("integrationHealthChecks", {
          ...check,
          metadata: serializeMetadata({ checkedAt: now }),
          checkedAt: now,
        }),
      ),
    );

    return { recordedAt: now, count: envChecks.length };
  },
});

export const getMonitoringDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewObservability");

    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;
    const recentEvents = await ctx.db
      .query("operationalEvents")
      .order("desc")
      .take(200);
    const recentHealthChecks = await ctx.db
      .query("integrationHealthChecks")
      .order("desc")
      .take(50);

    const eventsLastDay = recentEvents.filter((event) => event.createdAt >= oneDayAgo);
    const latestHealthByProvider = new Map<string, (typeof recentHealthChecks)[number]>();

    for (const healthCheck of recentHealthChecks) {
      if (!latestHealthByProvider.has(healthCheck.provider)) {
        latestHealthByProvider.set(healthCheck.provider, healthCheck);
      }
    }

    return {
      totals: {
        authFailures: eventsLastDay.filter((event) => event.scope.includes("auth")).length,
        schedulingFailures: eventsLastDay.filter((event) =>
          event.scope.includes("schedule") || event.scope.includes("interview"),
        ).length,
        webhookFailures: eventsLastDay.filter((event) =>
          event.scope.includes("webhook"),
        ).length,
        videoFailures: eventsLastDay.filter((event) =>
          event.provider === "stream" || event.scope.includes("video"),
        ).length,
        criticalEvents: eventsLastDay.filter((event) =>
          event.level === "critical" || event.level === "error",
        ).length,
      },
      recentEvents: recentEvents.slice(0, 12),
      healthChecks: Array.from(latestHealthByProvider.values()),
    };
  },
});
