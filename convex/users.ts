import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  PERMISSION_VALUES,
  Permission,
  UserRole,
  logAuditEvent,
  normalizeEmail,
  requireAnyPermission,
  requirePermission,
  getCurrentUserRecord,
} from "./lib/authz";
import { createServerError } from "./lib/errorUtils";

const INVITATION_LIST_LIMIT = 12;
const INVITATION_EXPIRY_MS = 24 * 60 * 60 * 1000;

const encodeHex = (buffer: ArrayBuffer) =>
  Array.from(new Uint8Array(buffer))
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("");

const hashInvitationToken = async (token: string) => {
  const encoded = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return encodeHex(digest);
};

const generateInvitationToken = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes, (value) => value.toString(16).padStart(2, "0")).join("");
};

const resolveInvitationStatus = <
  T extends {
    status: "pending" | "accepted" | "revoked" | "expired";
    expiresAt?: number;
    createdAt: number;
  },
>(
  invitation: T,
) =>
  invitation.status === "pending" &&
  (invitation.expiresAt ?? invitation.createdAt + INVITATION_EXPIRY_MS) <=
    Date.now()
    ? "expired"
    : invitation.status;

const expireInvitation = async (
  ctx: any,
  invitation: any,
) => {
  const expiresAt =
    invitation.expiresAt ?? invitation.createdAt + INVITATION_EXPIRY_MS;

  if (invitation.status !== "pending" || expiresAt > Date.now()) {
    return invitation.status;
  }

  await ctx.db.patch(invitation._id, {
    status: "expired",
  });

  return "expired" as const;
};

const expireStalePendingInvitations = async (
  ctx: any,
  email: string,
) => {
  const pendingInvitations = await ctx.db
    .query("invitations")
    .withIndex("by_email_status", (q: any) =>
      q.eq("email", email).eq("status", "pending"),
    )
    .collect();

  const activeInvitations = [];

  for (const invitation of pendingInvitations) {
    const status = await expireInvitation(ctx, invitation);
    if (status === "pending") {
      activeInvitations.push(invitation);
    }
  }

  return activeInvitations;
};

const sanitizeUserForViewer = <
  T extends {
    clerkId: string;
    email: string;
    role: UserRole;
  },
>(
  viewer: { clerkId: string; role: UserRole },
  user: T,
) => {
  const canViewEmail =
    viewer.role === "admin" ||
    viewer.role === "recruiter" ||
    viewer.clerkId === user.clerkId;

  return {
    ...user,
    email: canViewEmail ? user.email : "",
  };
};

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

    if (normalizedEmail) {
      await expireStalePendingInvitations(ctx, normalizedEmail);
    }

    const nextRole = existingUser?.role ?? "candidate";

    if (existingUser) {
      await ctx.db.patch(existingUser._id, {
        ...args,
        email: normalizedEmail,
        role: nextRole,
      });

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
      },
    });

    return userId;
  },
});

export const getCurrentUser = query({
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .first();
    if (!user) return null;
    const customRole = user.customRoleId
      ? await ctx.db.get(user.customRoleId)
      : null;
    return {
      ...sanitizeUserForViewer(user, user),
      customRole,
    };
  },
});

export const getUsers = query({
  handler: async (ctx) => {
    const { user } = await requirePermission(ctx, "viewUsers");
    const users = await ctx.db.query("users").collect();
    return await Promise.all(
      users.map(async (record) => ({
        ...sanitizeUserForViewer(user, record),
        customRole: record.customRoleId
          ? await ctx.db.get(record.customRoleId)
          : null,
      })),
    );
  },
});
export const getUserByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, args) => {
    if (!args.clerkId) return null;
    const { user: viewer } = await getCurrentUserRecord(ctx);

    const targetUser = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .first();

    if (!targetUser) return null;

    if (
      viewer.clerkId !== args.clerkId &&
      viewerCannotInspectUser(viewer.role)
    ) {
      throw createServerError(
        new Error(
          `User ${viewer.clerkId} attempted to inspect ${args.clerkId}`,
        ),
        "You are not allowed to view this user.",
      );
    }

    return sanitizeUserForViewer(viewer, targetUser);
  },
});

const viewerCannotInspectUser = (role: UserRole) =>
  role !== "admin" && role !== "recruiter" && role !== "interviewer";

const isValidPermission = (value: string): value is Permission =>
  PERMISSION_VALUES.includes(value as Permission);

const normalizeRoleSlug = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const filterValidPermissions = (permissions: string[]) => {
  const uniquePermissions = Array.from(new Set(permissions));
  return uniquePermissions.filter(isValidPermission) as Permission[];
};

export const getRoleManagementDashboard = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "manageRoleCatalog");
    const [roles, users] = await Promise.all([
      ctx.db.query("roleDefinitions").order("desc").collect(),
      ctx.db.query("users").collect(),
    ]);

    const rolesById = new Map(roles.map((role) => [String(role._id), role]));

    return {
      permissionOptions: [...PERMISSION_VALUES],
      roles,
      users: users
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({
          ...user,
          customRole: user.customRoleId
            ? (rolesById.get(String(user.customRoleId)) ?? null)
            : null,
        })),
    };
  },
});

export const listInvitations = query({
  handler: async (ctx) => {
    await requirePermission(ctx, "manageInvitations");
    const invitations = await ctx.db
      .query("invitations")
      .order("desc")
      .take(INVITATION_LIST_LIMIT);

    return invitations.map((invitation) => ({
      ...invitation,
      expiresAt: invitation.expiresAt ?? invitation.createdAt + INVITATION_EXPIRY_MS,
      status: resolveInvitationStatus(invitation),
    }));
  },
});

export const inviteUser = mutation({
  args: {
    email: v.string(),
    role: v.union(
      v.literal("interviewer"),
      v.literal("recruiter"),
      v.literal("developer"),
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
        "Only admins can invite recruiters, developers, or admins.",
      );
    }

    const existingPendingInvitation = (
      await expireStalePendingInvitations(ctx, normalizedEmail)
    ).find((invitation) => invitation.expiresAt > Date.now());

    if (existingPendingInvitation) {
      throw createServerError(
        new Error(`Pending invitation already exists for ${normalizedEmail}`),
        "There is already a pending invitation for this email.",
      );
    }

    const invitationToken = generateInvitationToken();
    const tokenHash = await hashInvitationToken(invitationToken);
    const createdAt = Date.now();
    const expiresAt = createdAt + INVITATION_EXPIRY_MS;

    const invitationId = await ctx.db.insert("invitations", {
      email: normalizedEmail,
      role: args.role,
      tokenHash,
      invitedBy: user.clerkId,
      status: "pending",
      createdAt,
      expiresAt,
      lastSentAt: createdAt,
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
        expiresAt,
      },
    });

    return {
      invitationId,
      invitationToken,
      expiresAt,
      email: normalizedEmail,
      role: args.role,
    };
  },
});

export const acceptInvitation = mutation({
  args: {
    token: v.string(),
  },
  handler: async (ctx, args) => {
    const { user } = await getCurrentUserRecord(ctx);
    const token = args.token.trim();

    if (!token) {
      throw createServerError(
        new Error("Invitation token was empty"),
        "Invitation token is required.",
      );
    }

    const tokenHash = await hashInvitationToken(token);
    const invitation = await ctx.db
      .query("invitations")
      .withIndex("by_token_hash", (q) => q.eq("tokenHash", tokenHash))
      .first();

    if (!invitation) {
      throw createServerError(
        new Error("Invitation token not found"),
        "This invitation is invalid.",
      );
    }

    const effectiveStatus = await expireInvitation(ctx, invitation);

    if (effectiveStatus === "expired") {
      throw createServerError(
        new Error(`Invitation expired for ${invitation.email}`),
        "This invitation has expired. Ask an admin to send a new one.",
      );
    }

    if (effectiveStatus !== "pending") {
      throw createServerError(
        new Error(
          `Invitation is not pending: ${String(invitation._id)} (${effectiveStatus})`,
        ),
        "This invitation is no longer available.",
      );
    }

    const normalizedUserEmail = normalizeEmail(user.email);

    if (normalizedUserEmail !== invitation.email) {
      throw createServerError(
        new Error(
          `Invitation email mismatch. Invitation=${invitation.email} user=${normalizedUserEmail}`,
        ),
        "Sign in with the invited email address to accept this invitation.",
      );
    }

    await ctx.db.patch(user._id, {
      role: invitation.role,
    });

    await ctx.db.patch(invitation._id, {
      status: "accepted",
      acceptedAt: Date.now(),
      acceptedBy: user.clerkId,
    });

    await logAuditEvent(ctx, {
      action: "invitation.accepted",
      actorClerkId: user.clerkId,
      actorEmail: normalizedUserEmail,
      targetType: "invitation",
      targetId: invitation._id,
      metadata: {
        role: invitation.role,
        previousRole: user.role,
      },
    });

    await logAuditEvent(ctx, {
      action: "user.role_updated",
      actorClerkId: user.clerkId,
      actorEmail: normalizedUserEmail,
      targetType: "user",
      targetId: user._id,
      metadata: {
        previousRole: user.role,
        nextRole: invitation.role,
        source: "invitation_acceptance",
      },
    });

    return {
      role: invitation.role,
      email: invitation.email,
      expiresAt: invitation.expiresAt,
    };
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
        "Only admins can revoke recruiter, developer, or admin invitations.",
      );
    }

    const effectiveStatus = await expireInvitation(ctx, invitation);

    if (effectiveStatus !== "pending") {
      throw createServerError(
        new Error(
          `Invitation is not revokable: ${String(args.invitationId)} (${effectiveStatus})`,
        ),
        "Only pending invitations can be revoked.",
      );
    }

    await ctx.db.patch(args.invitationId, {
      status: "revoked",
      revokedAt: Date.now(),
      revokedBy: user.clerkId,
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
      v.literal("developer"),
      v.literal("admin"),
    ),
  },
  handler: async (ctx, args) => {
    const { user } = await requireAnyPermission(ctx, [
      "manageRoles",
      "manageRoleCatalog",
    ]);
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

export const assignUserCustomRole = mutation({
  args: {
    userId: v.id("users"),
    customRoleId: v.optional(v.id("roleDefinitions")),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageRoleCatalog");
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw createServerError(
        new Error(`User not found: ${args.userId}`),
        "User not found.",
      );
    }

    const customRole = args.customRoleId
      ? await ctx.db.get(args.customRoleId)
      : null;

    if (args.customRoleId && !customRole) {
      throw createServerError(
        new Error(`Custom role not found: ${args.customRoleId}`),
        "Custom role not found.",
      );
    }

    await ctx.db.patch(args.userId, {
      customRoleId: args.customRoleId,
    });

    await logAuditEvent(ctx, {
      action: "user.custom_role_updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "user",
      targetId: args.userId,
      metadata: {
        previousCustomRoleId: targetUser.customRoleId,
        nextCustomRoleId: args.customRoleId,
        nextCustomRoleName: customRole?.name,
      },
    });
  },
});

export const createRoleDefinition = mutation({
  args: {
    name: v.string(),
    slug: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageRoleCatalog");
    const slug = normalizeRoleSlug(args.slug || args.name);

    if (!slug) {
      throw createServerError(
        new Error("Role slug was empty"),
        "A valid role slug is required.",
      );
    }

    const existing = await ctx.db
      .query("roleDefinitions")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();

    if (existing) {
      throw createServerError(
        new Error(`Role slug already exists: ${slug}`),
        "A role with this slug already exists.",
      );
    }

    const permissions = filterValidPermissions(args.permissions);
    const now = Date.now();

    const roleId = await ctx.db.insert("roleDefinitions", {
      name: args.name.trim(),
      slug,
      description: args.description?.trim() || undefined,
      permissions,
      createdBy: user.clerkId,
      updatedBy: user.clerkId,
      createdAt: now,
      updatedAt: now,
    });

    await logAuditEvent(ctx, {
      action: "role_definition.created",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "roleDefinition",
      targetId: roleId,
      metadata: {
        slug,
        permissions,
      },
    });

    return roleId;
  },
});

export const updateRoleDefinition = mutation({
  args: {
    roleId: v.id("roleDefinitions"),
    name: v.string(),
    description: v.optional(v.string()),
    permissions: v.array(v.string()),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageRoleCatalog");
    const role = await ctx.db.get(args.roleId);

    if (!role) {
      throw createServerError(
        new Error(`Role not found: ${args.roleId}`),
        "Role not found.",
      );
    }

    const permissions = filterValidPermissions(args.permissions);

    await ctx.db.patch(args.roleId, {
      name: args.name.trim(),
      description: args.description?.trim() || undefined,
      permissions,
      updatedBy: user.clerkId,
      updatedAt: Date.now(),
    });

    await logAuditEvent(ctx, {
      action: "role_definition.updated",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "roleDefinition",
      targetId: args.roleId,
      metadata: {
        permissions,
      },
    });
  },
});

export const deleteRoleDefinition = mutation({
  args: {
    roleId: v.id("roleDefinitions"),
  },
  handler: async (ctx, args) => {
    const { user } = await requirePermission(ctx, "manageRoleCatalog");

    const role = await ctx.db.get(args.roleId);
    if (!role) {
      throw createServerError(
        new Error(`Role not found: ${args.roleId}`),
        "Role not found.",
      );
    }

    // Check if any users are currently assigned to this role
    const usersWithRole = await ctx.db
      .query("users")
      .filter((q) => q.eq(q.field("customRoleId"), args.roleId))
      .collect();

    // Remove the custom role from any users that have it assigned
    for (const userRecord of usersWithRole) {
      await ctx.db.patch(userRecord._id, {
        customRoleId: undefined,
      });
    }

    await ctx.db.delete(args.roleId);

    await logAuditEvent(ctx, {
      action: "role_definition.deleted",
      actorClerkId: user.clerkId,
      actorEmail: user.email,
      targetType: "roleDefinition",
      targetId: args.roleId,
      metadata: {
        slug: role.slug,
        usersAffected: usersWithRole.length,
      },
    });
  },
});
