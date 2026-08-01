import { v } from "convex/values";
import { internalMutation, mutation, query } from "./_generated/server";
import {
  PERMISSION_VALUES,
  Permission,
  UserRole,
  hasPermission,
  isOwnerUser,
  logAuditEvent,
  normalizeEmail,
  requirePermission,
  getCurrentUserRecord,
} from "./lib/authz";
import {
  createServerError,
  logServerError,
  requireIdentity,
} from "./lib/errorUtils";
import { isOwnerConfigured } from "./lib/owner";

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

type SyncUserArgs = {
  clerkId: string;
  email: string;
  name: string;
  image?: string;
};

/**
 * Shared upsert used by both the Clerk webhook (trusted, no identity) and the
 * signed-in client hook. Callers are responsible for authorizing `args.clerkId`
 * before calling — this helper does no auth of its own.
 *
 * `role` is never taken from args: a new row is always `candidate` and an existing
 * row keeps whatever role it already has, so sync can never escalate.
 */
const applySyncUser = async (ctx: any, args: SyncUserArgs) => {
  const normalizedEmail = normalizeEmail(args.email);

  const existingUser = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", args.clerkId))
    .first();

  // Enforced on both create and update. Previously update skipped this, which let a
  // row's email be repointed at an address someone else owned — and invitations are
  // authorized by email match, so that was an invitation-hijack path.
  if (normalizedEmail) {
    const emailOwner = await ctx.db
      .query("users")
      .withIndex("by_email", (q: any) => q.eq("email", normalizedEmail))
      .first();

    if (emailOwner && emailOwner.clerkId !== args.clerkId) {
      throw createServerError(
        new Error(
          `Email ${normalizedEmail} already owned by ${emailOwner.clerkId}; ` +
            `tried to sync ${args.clerkId}`,
        ),
        "An account with this email already exists. Please sign in with the provider you used the first time.",
      );
    }
  }

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
};

/**
 * Webhook entry point. Internal-only: Clerk httpActions carry no user identity, so
 * this cannot go through the authenticated mutation below.
 */
export const syncUserFromWebhook = internalMutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => applySyncUser(ctx, args),
});

/**
 * Client entry point, called by useSyncUser on auth state change. The Clerk id comes
 * from the verified token, never from the argument list.
 */
export const syncUser = mutation({
  args: {
    email: v.string(),
    name: v.string(),
    image: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const identity = await requireIdentity(ctx);

    return applySyncUser(ctx, {
      ...args,
      clerkId: identity.subject,
    });
  },
});

/**
 * Marks the first-run welcome as seen. Self-scoped: the row is resolved from the
 * caller's identity, so there is no user id to tamper with.
 */
export const completeOnboarding = mutation({
  handler: async (ctx) => {
    const { user } = await getCurrentUserRecord(ctx);

    if (user.hasCompletedOnboarding) return;

    await ctx.db.patch(user._id, { hasCompletedOnboarding: true });
  },
});

export const getCurrentUser = query({
  handler: async (ctx) => {
    try {
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
        // Drives UI affordances only. Every owner-gated mutation re-checks
        // against OWNER_EMAILS server-side.
        isOwner: isOwnerUser(user),
      };
    } catch (error) {
      logServerError("users.getCurrentUser", error);
      return null;
    }
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

/**
 * Permissions that can be used to escalate: anyone holding "manageRoles" can hand
 * out any role, including admin. A caller may only grant a permission they hold
 * themselves, otherwise `manageRoleCatalog` (held by `developer`) becomes an
 * indirect route to admin — mint a custom role carrying "manageRoles", assign it.
 */
const ESCALATION_PERMISSIONS: Permission[] = ["manageRoles"];

const filterValidPermissions = (
  permissions: string[],
  grantor: { role: UserRole },
) => {
  const uniquePermissions = Array.from(new Set(permissions));

  return uniquePermissions.filter((permission): permission is Permission => {
    if (!isValidPermission(permission)) return false;

    if (
      ESCALATION_PERMISSIONS.includes(permission) &&
      !hasPermission(grantor.role, permission)
    ) {
      return false;
    }

    return true;
  });
};

export const getRoleManagementDashboard = query({
  handler: async (ctx) => {
    const { user: viewer } = await requirePermission(ctx, "manageRoleCatalog");
    const [roles, users] = await Promise.all([
      ctx.db.query("roleDefinitions").order("desc").collect(),
      ctx.db.query("users").collect(),
    ]);

    const rolesById = new Map(roles.map((role) => [String(role._id), role]));

    return {
      permissionOptions: [...PERMISSION_VALUES],
      roles,
      // Was spreading the raw row, so this leaked every account's email to
      // `developer`, which holds manageRoleCatalog but is not a people-data role.
      users: users
        .sort((a, b) => a.name.localeCompare(b.name))
        .map((user) => ({
          ...sanitizeUserForViewer(viewer, user),
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

    if (
      user.role !== "admin" &&
      args.role !== "interviewer" &&
      !isOwnerUser(user)
    ) {
      throw createServerError(
        new Error(`Role ${user.role} cannot invite ${args.role}`),
        "Only admins can invite recruiters, developers, or admins.",
      );
    }

    // Same rule as updateUserRole: admin membership is the owner's to hand out,
    // otherwise an invitation is just a slower route to the same escalation.
    // Inert until OWNER_EMAILS is set.
    if (args.role === "admin" && isOwnerConfigured() && !isOwnerUser(user)) {
      throw createServerError(
        new Error(`Role ${user.role} attempted to invite an admin`),
        "Only the deployment owner can invite an admin.",
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
    // "manageRoles" only. This previously also accepted "manageRoleCatalog", which
    // the `developer` role holds — letting any developer promote themselves to admin.
    const { user } = await requirePermission(ctx, "manageRoles");
    const targetUser = await ctx.db.get(args.userId);

    if (!targetUser) {
      throw createServerError(
        new Error(`User not found: ${args.userId}`),
        "User not found.",
      );
    }

    const actorIsOwner = isOwnerUser(user);

    // The owner is exempt: ownership comes from OWNER_EMAILS on the deployment,
    // so self-promotion grants nothing the environment has not already granted,
    // and this is how a fresh owner turns their `candidate` signup into `admin`
    // without hand-editing the database.
    if (targetUser.clerkId === user.clerkId && !actorIsOwner) {
      throw createServerError(
        new Error(`User ${user.clerkId} attempted to change their own role`),
        "You cannot change your own role. Ask another admin to do it.",
      );
    }

    // Nobody but the owner may touch an owner's account. Without this, admin is
    // a flat peer group: a second admin could demote the person whose
    // deployment this is.
    if (isOwnerUser(targetUser) && !actorIsOwner) {
      throw createServerError(
        new Error(
          `User ${user.clerkId} attempted to change the role of owner ${targetUser.clerkId}`,
        ),
        "This account belongs to the deployment owner and cannot be changed here.",
      );
    }

    // Granting or revoking admin is owner-only, so admin cannot self-replicate.
    // Admins keep full control of every non-admin role.
    //
    // Inert until OWNER_EMAILS is set, otherwise deploying this would leave a
    // running deployment with nobody able to manage admins at all.
    if (
      isOwnerConfigured() &&
      (args.role === "admin" || targetUser.role === "admin") &&
      !actorIsOwner
    ) {
      throw createServerError(
        new Error(
          `Role ${user.role} attempted to change admin membership for ${targetUser.clerkId}`,
        ),
        "Only the deployment owner can grant or revoke the admin role.",
      );
    }

    // Refuse to remove the last admin, which would leave the deployment with no way
    // to grant roles at all short of editing the database by hand.
    if (targetUser.role === "admin" && args.role !== "admin") {
      const admins = await ctx.db
        .query("users")
        .filter((q) => q.eq(q.field("role"), "admin"))
        .collect();

      if (admins.length <= 1) {
        throw createServerError(
          new Error("Attempted to demote the last remaining admin"),
          "This is the only admin account. Promote another admin first.",
        );
      }
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

    const actorIsOwner = isOwnerUser(user);

    // This mutation only needs "manageRoleCatalog", which `developer` holds, and
    // it used to inspect neither the target nor the permissions being handed
    // over. `filterValidPermissions` stops a developer *creating* a role that
    // carries an escalation permission, but nothing stopped them *assigning* one
    // an admin had already created — to themselves — and thereby gaining
    // manageRoles. Both halves of that are closed here.
    if (targetUser.clerkId === user.clerkId && !actorIsOwner) {
      throw createServerError(
        new Error(
          `User ${user.clerkId} attempted to assign a custom role to themselves`,
        ),
        "You cannot assign a custom role to your own account.",
      );
    }

    if (isOwnerUser(targetUser) && !actorIsOwner) {
      throw createServerError(
        new Error(
          `User ${user.clerkId} attempted to assign a custom role to owner ${targetUser.clerkId}`,
        ),
        "This account belongs to the deployment owner and cannot be changed here.",
      );
    }

    const escalationGranted = (customRole?.permissions ?? []).filter(
      (permission: string) =>
        ESCALATION_PERMISSIONS.includes(permission as Permission),
    );

    if (escalationGranted.length > 0 && !actorIsOwner) {
      throw createServerError(
        new Error(
          `Role ${user.role} attempted to grant escalation permissions ${escalationGranted.join(", ")}`,
        ),
        "Only the deployment owner can assign a role that manages other roles.",
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

    const permissions = filterValidPermissions(args.permissions, user);
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

    const permissions = filterValidPermissions(args.permissions, user);

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
