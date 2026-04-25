import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { getCurrentUserRecord, logAuditEvent, requirePermission } from "./authz";
import { createServerError } from "./errorUtils";

const policyDocumentValidator = v.union(
  v.literal("terms"),
  v.literal("privacy"),
  v.literal("recording"),
);

const gdprRequestTypeValidator = v.union(
  v.literal("export"),
  v.literal("delete"),
);

const deploymentStatusValidator = v.union(
  v.literal("proposed"),
  v.literal("approved"),
  v.literal("deployed"),
  v.literal("rolled_back"),
);

export const CURRENT_POLICY_VERSIONS = {
  terms: "2026-04-22",
  privacy: "2026-04-22",
  recording: "2026-04-22",
} as const;

const serialize = (value?: Record<string, unknown>) =>
  value ? JSON.stringify(value) : undefined;

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

export const acknowledgePolicy = mutation({
  args: {
    documentType: policyDocumentValidator,
    version: v.string(),
    jurisdiction: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);

    const existing = await ctx.db
      .query("policyAcknowledgements")
      .withIndex("by_user_document", (q) =>
        q.eq("userClerkId", user.clerkId).eq("documentType", args.documentType),
      )
      .collect();

    const latest = existing.find((item) => item.version === args.version);
    if (latest) return latest._id;

    const acknowledgementId = await ctx.db.insert("policyAcknowledgements", {
      userClerkId: user.clerkId,
      documentType: args.documentType,
      version: args.version,
      jurisdiction: args.jurisdiction,
      acceptedAt: Date.now(),
      metadata: serialize({ role: user.role }),
    });

    await logAuditEvent(ctx, {
      action: "compliance.policy_acknowledged",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "policyAcknowledgement",
      targetId: acknowledgementId,
      metadata: {
        documentType: args.documentType,
        version: args.version,
      },
    });

    return acknowledgementId;
  },
});

export const getMyComplianceStatus = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    const acknowledgements = await ctx.db
      .query("policyAcknowledgements")
      .withIndex("by_user_document", (q) => q.eq("userClerkId", user.clerkId))
      .collect();
    const gdprRequests = (await ctx.db
      .query("gdprRequests")
      .withIndex("by_requester_created_at", (q) => q.eq("requesterClerkId", user.clerkId))
      .order("desc")
      .take(20)).map((request) => ({
      ...request,
      exportPayload: undefined,
      hasExportPayload: !!request.exportPayload,
    }));

    return {
      currentVersions: CURRENT_POLICY_VERSIONS,
      acknowledgements,
      gdprRequests,
    };
  },
});

export const requestDataOperation = mutation({
  args: {
    type: gdprRequestTypeValidator,
    reason: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const now = Date.now();

    const requestId = await ctx.db.insert("gdprRequests", {
      requesterClerkId: user.clerkId,
      type: args.type,
      status: "requested",
      reason: args.reason,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(ctx, {
      action: "compliance.gdpr_request_created",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "gdprRequest",
      targetId: requestId,
      metadata: {
        type: args.type,
      },
    });

    return requestId;
  },
});

export const getMyDataExport = query({
  args: {
    requestId: v.id("gdprRequests"),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const request = await ctx.db.get(args.requestId);

    if (!request || request.requesterClerkId !== user.clerkId) {
      throw createServerError(
        new Error(`GDPR request not found: ${args.requestId}`),
        "Data export request not found.",
      );
    }

    return request.exportPayload ? JSON.parse(request.exportPayload) : null;
  },
});

export const resolveGdprRequest = mutation({
  args: {
    requestId: v.id("gdprRequests"),
    status: v.union(
      v.literal("in_review"),
      v.literal("completed"),
      v.literal("rejected"),
    ),
    resolution: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageCompliance");
    const request = await ctx.db.get(args.requestId);

    if (!request) {
      throw createServerError(
        new Error(`GDPR request not found: ${args.requestId}`),
        "GDPR request not found.",
      );
    }

    let exportPayload = request.exportPayload;
    if (args.status === "completed" && request.type === "export" && !exportPayload) {
      const requester = await ctx.db
        .query("users")
        .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", request.requesterClerkId))
        .first();
      const interviews = await ctx.db.query("interviews").collect();
      const feedback = await ctx.db.query("feedback").collect();
      const comments = await ctx.db.query("comments").collect();
      const notifications = await ctx.db
        .query("notifications")
        .withIndex("by_recipient_channel", (q: any) =>
          q.eq("recipientClerkId", request.requesterClerkId).eq("channel", "in_app"),
        )
        .collect();

      exportPayload = JSON.stringify({
        requestedAt: request.createdAt,
        profile: requester,
        interviews: interviews.filter((item) => item.candidateId === request.requesterClerkId),
        feedback: feedback.filter((item) => item.interviewerId === request.requesterClerkId),
        comments: comments.filter((item) => item.interviewerId === request.requesterClerkId),
        notifications,
      });
    }

    await ctx.db.patch(args.requestId, {
      status: args.status,
      resolution: args.resolution,
      exportPayload,
      updatedAt: Date.now(),
      completedAt: args.status === "completed" ? Date.now() : undefined,
    });

    await logAuditEvent(ctx, {
      action: "compliance.gdpr_request_resolved",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "gdprRequest",
      targetId: args.requestId,
      metadata: {
        status: args.status,
      },
    });
  },
});

export const getGovernanceDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "manageCompliance");
    const gdprRequests = await ctx.db
      .query("gdprRequests")
      .withIndex("by_status_created_at", (q) => q.eq("status", "requested"))
      .order("desc")
      .take(20);
    const accessLogs = await ctx.db.query("dataAccessLogs").order("desc").take(25);
    const deployments = await ctx.db.query("deploymentChanges").order("desc").take(20);
    const policyAcknowledgements = await ctx.db
      .query("policyAcknowledgements")
      .order("desc")
      .take(100);

    return {
      gdprRequests,
      accessLogs,
      deployments,
      policySummary: {
        terms: policyAcknowledgements.filter((item) => item.documentType === "terms").length,
        privacy: policyAcknowledgements.filter((item) => item.documentType === "privacy").length,
        recording: policyAcknowledgements.filter((item) => item.documentType === "recording").length,
      },
      currentVersions: CURRENT_POLICY_VERSIONS,
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
