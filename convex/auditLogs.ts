import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logAuditEvent, requirePermission } from "./authz";

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
    await requirePermission(ctx, "manageRoles");
    return await ctx.db.query("auditLogs").order("desc").take(25);
  },
});
