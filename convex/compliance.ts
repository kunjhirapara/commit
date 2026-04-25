import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserRecord, logAuditEvent, requirePermission } from "./authz";
import { createServerError } from "./errorUtils";

const deploymentStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("deployed"),
  v.literal("rolled_back"),
);

export const recordDataAccessLog = internalMutation({
  args: {
    actorClerkId: v.string(),
    actorRole: v.union(
      v.literal("candidate"),
      v.literal("interviewer"),
      v.literal("recruiter"),
      v.literal("developer"),
      v.literal("admin"),
    ),
    accessType: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    justification: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("dataAccessLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const logSensitiveAccess = mutation({
  args: {
    accessType: v.string(),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    justification: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    await ctx.db.insert("dataAccessLogs", {
      actorClerkId: user.clerkId,
      actorRole: user.role,
      accessType: args.accessType,
      targetType: args.targetType,
      targetId: args.targetId,
      justification: args.justification,
      metadata: args.metadata,
      createdAt: Date.now(),
    });
  },
});

export const getGovernanceDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "manageCompliance");
    const accessLogs = await ctx.db.query("dataAccessLogs").order("desc").take(25);
    const deployments = await ctx.db.query("deploymentChanges").order("desc").take(20);

    return {
      accessLogs,
      deployments,
    };
  },
});

export const getDeploymentDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "manageDeployments");
    const deployments = await ctx.db.query("deploymentChanges").order("desc").take(20);

    return {
      deployments,
    };
  },
});

export const proposeDeploymentChange = mutation({
  args: {
    title: v.string(),
    summary: v.string(),
    environment: v.string(),
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageDeployments");
    return await ctx.db.insert("deploymentChanges", {
      title: args.title,
      summary: args.summary,
      environment: args.environment,
      notes: args.notes,
      status: "proposed",
      proposedBy: user.clerkId,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateDeploymentChange = mutation({
  args: {
    deploymentId: v.id("deploymentChanges"),
    status: deploymentStatusValidator,
    notes: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageDeployments");
    const deployment = await ctx.db.get(args.deploymentId);

    if (!deployment) {
      throw createServerError(
        new Error(`Deployment change not found: ${args.deploymentId}`),
        "Deployment change not found.",
      );
    }

    await ctx.db.patch(args.deploymentId, {
      status: args.status,
      approvedBy:
        args.status === "approved" || args.status === "deployed"
          ? user.clerkId
          : deployment.approvedBy,
      notes: args.notes ?? deployment.notes,
      updatedAt: Date.now(),
      deployedAt: args.status === "deployed" ? Date.now() : deployment.deployedAt,
    });
  },
});
