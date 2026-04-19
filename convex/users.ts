import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  UserRole,
  logAuditEvent,
  normalizeEmail,
  requirePermission,
  getCurrentUserRecord,
} from "./authz";
import { createServerError } from "./errorUtils";

const INVITATION_LIST_LIMIT = 12;

export const syncUser = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmail(args.email);
    const identity = await ctx.auth.getUserIdentity();

    if (identity && identity.subject !== args.clerkId) {
      throw createServerError(
        new Error(
          `Authenticated user ${identity.subject} attempted to sync ${args.clerkId}`,
        ),
        "You are not allowed to sync another user.",
      );
    }

    const existingUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    const pendingInvitation = normalizedEmail
      ? await ctx.db
          .query("invitations")
          .withIndex("by_email_status", (q) =>
            q.eq("email", normalizedEmail).eq("status", "pending"),
          )
          .first()
      : null;

    const nextRole = pendingInvitation?.role ?? existingUser?.role ?? "candidate";

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        ...args,
        email: normalizedEmail,
        role: nextRole,
      });

      if (pendingInvitation) {
        await ctx.db.patch(pendingInvitation._id, {
          status: "accepted",
          acceptedAt: Date.now(),
          acceptedBy: args.clerkId,
        });

        await logAuditEvent(ctx, {
          action: "invitation.accepted",
          actorClerkId: args.clerkId,
          actorEmail: normalizedEmail,
          targetType: "invitation",
          targetId: pendingInvitation._id,
          metadata: {
            role: pendingInvitation.role,
          },
        });
      }

      return existingUser._id;
    }

    const userId = await ctx.db.insert("users", {
      ...args,
      email: normalizedEmail,
      role: nextRole,
    });

    await logAuditEvent(ctx, {
      action: "user.created",
      actorClerkId: args.clerkId,
      actorEmail: normalizedEmail,
      targetType: "user",
      targetId: userId,
      metadata: {
        role: nextRole,
        invited: !!pendingInvitation,
      },
    });

    if (pendingInvitation) {
      await ctx.db.patch(pendingInvitation._id, {
        status: "accepted",
        acceptedAt: Date.now(),
        acceptedBy: args.clerkId,
      });

      await logAuditEvent(ctx, {
        action: "invitation.accepted",
        actorClerkId: args.clerkId,
        actorEmail: normalizedEmail,
        targetType: "invitation",
        targetId: pendingInvitation._id,
        metadata: {
          role: pendingInvitation.role,
        },
      });
    }

    return userId;
  },
});

export const getCurrentUser = query({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);
    return user;
  },
});

export const getUsers = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "viewUsers");
    const users = await ctx.db.query("users").collect();
    return users;
  },
});
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    return user;
  },
});

export const listInvitations = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "manageInvitations");
    return await ctx.db.query("invitations").order("desc").take(INVITATION_LIST_LIMIT);
  },
});

export const inviteUser = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("interviewer"),
      v.literal("recruiter"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageInvitations");
    const normalizedEmail = normalizeEmail(args.email);

    if (!normalizedEmail) {
      throw createServerError(
        new Error("Invitation email was empty"),
        "A valid email address is required.",
      );
    }

    if (user.role !== "admin" && args.role !== "interviewer") {
      throw createServerError(
        new Error(`Role ${user.role} cannot invite ${args.role}`),
        "Only admins can invite recruiters or admins.",
      );
    }

    const existingPendingInvitation = await ctx.db
      .query("invitations")
      .withIndex("by_email_status", (q) =>
        q.eq("email", normalizedEmail).eq("status", "pending"),
      )
      .first();

    if (existingPendingInvitation) {
      throw createServerError(
        new Error(`Pending invitation already exists for ${normalizedEmail}`),
        "There is already a pending invitation for this email.",
      );
    }

    const invitationId = await ctx.db.insert("invitations", {
      email: normalizedEmail,
      role: args.role,
      invitedBy: user.clerkId,
      status: "pending",
      createdAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      action: "invitation.created",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "invitation",
      targetId: invitationId,
      metadata: {
        email: normalizedEmail,
        role: args.role,
      },
    });

    return invitationId;
  },
});

export const revokeInvitation = mutation({
  args: {
    invitationId: v.id("invitations"),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageInvitations");
    const invitation = await ctx.db.get(args.invitationId);

    if (!invitation) {
      throw createServerError(
        new Error(`Invitation not found: ${args.invitationId}`),
        "Invitation not found.",
      );
    }

    if (user.role !== "admin" && invitation.role !== "interviewer") {
      throw createServerError(
        new Error(`Role ${user.role} cannot revoke ${invitation.role}`),
        "Only admins can revoke recruiter or admin invitations.",
      );
    }

    await ctx.db.patch(args.invitationId, {
      status: "revoked",
      revokedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      action: "invitation.revoked",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "invitation",
      targetId: args.invitationId,
      metadata: {
        email: invitation.email,
        role: invitation.role,
      },
    });
  },
});

export const updateUserRole = mutation({
  args: {
    userId: v.id("users"),
    role: v.union(
      v.literal("candidate"),
      v.literal("interviewer"),
      v.literal("recruiter"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageRoles");
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw createServerError(
        new Error(`User not found: ${args.userId}`),
        "User not found.",
      );
    }

    await ctx.db.patch(args.userId, {
      role: args.role as UserRole,
    });

    await logAuditEvent(ctx, {
      action: "user.role_updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "user",
      targetId: args.userId,
      metadata: {
        previousRole: targetUser.role,
        nextRole: args.role,
        targetEmail: targetUser.email,
      },
    });
  },
});
