import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requirePermission } from "./authz";

const AUDIT_LOG_LIMIT = 20;

export const recordSystemAuditLog = internalMutation({
  args: {
    action: v.string(),
    actorClerkId: v.optional(v.string()),
    actorEmail: v.optional(v.string()),
    targetType: v.string(),
    targetId: v.optional(v.string()),
    metadata: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("auditLogs", {
      ...args,
      createdAt: Date.now(),
    });
  },
});

export const getRecentAuditLogs = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewObservability");
    return await ctx.db.query("auditLogs").order("desc").take(AUDIT_LOG_LIMIT);
  },
});
