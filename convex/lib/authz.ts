import { createServerError, requireIdentity } from "./errorUtils";
import { isOwnerEmail } from "./owner";
import {
  PERMISSION_VALUES,
  PRIVILEGED_INVITATION_ROLES,
  ROLE_PERMISSIONS,
  USER_ROLES,
  type Permission,
  type PrivilegedInvitationRole,
  type UserRole,
} from "./permissions";

// Re-exported so existing imports from "./lib/authz" keep working; the table
// itself now lives in ./permissions so the client can share it.
export {
  PERMISSION_VALUES,
  PRIVILEGED_INVITATION_ROLES,
  ROLE_PERMISSIONS,
  USER_ROLES,
};
export type { Permission, PrivilegedInvitationRole, UserRole };

type UserRecord = {
  _id: string;
  clerkId: string;
  email: string;
  role: UserRole;
  customRoleId?: string;
};

type InterviewRecord = {
  _id: string;
  candidateId: string;
  interviewerIds: string[];
  status?: string;
};

const PERMISSIONS = ROLE_PERMISSIONS;

export const normalizeEmail = (email: string) => email.trim().toLowerCase();

const serializeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;

  try {
    return JSON.stringify(metadata);
  } catch {
    return JSON.stringify({ serializationError: true });
  }
};

export const logAuditEvent = async (
  ctx: any,
  entry: {
    action: string;
    actorClerkId?: string;
    actorEmail?: string;
    targetType: string;
    targetId?: string;
    metadata?: Record<string, unknown>;
  },
) => {
  await ctx.db.insert("auditLogs", {
    action: entry.action,
    actorClerkId: entry.actorClerkId,
    actorEmail: entry.actorEmail,
    targetType: entry.targetType,
    targetId: entry.targetId,
    metadata: serializeMetadata(entry.metadata),
    createdAt: Date.now(),
  });
};

export const getCurrentUserRecord = async (ctx: any) => {
  const identity = await requireIdentity(ctx);
  const user = await ctx.db
    .query("users")
    .withIndex("by_clerk_id", (q: any) => q.eq("clerkId", identity.subject))
    .first();

  if (!user) {
    throw createServerError(
      new Error(`User record not found for ${identity.subject}`),
      "Your account is not ready yet. Please sign out and try again.",
    );
  }

  return { identity, user };
};

export const hasPermission = (role: UserRole, permission: Permission) =>
  PERMISSIONS[role].includes(permission);

/**
 * Ownership is decided by OWNER_EMAILS on the Convex deployment, never by a
 * column an admin can patch. See ./owner.ts for why this is not a sixth role.
 */
export const isOwnerUser = (user: Pick<UserRecord, "email">) =>
  isOwnerEmail(user.email);

/**
 * The owner implicitly holds every permission. This is what makes the variable
 * a working bootstrap: set OWNER_EMAILS, sign in, and the deployment is yours
 * without hand-editing the database, even though signup still lands on
 * `candidate` like everyone else.
 */
export const requireOwner = async (ctx: any) => {
  const { identity, user } = await getCurrentUserRecord(ctx);

  if (!isOwnerUser(user)) {
    throw createServerError(
      new Error(`User ${user.clerkId} is not an owner of this deployment`),
      "Only the deployment owner can do this.",
    );
  }

  return { identity, user };
};

const hasCustomPermission = async (
  ctx: any,
  user: { customRoleId?: string },
  permission: Permission,
) => {
  if (!user.customRoleId) return false;

  const customRole = await ctx.db.get(user.customRoleId);
  if (!customRole || !Array.isArray(customRole.permissions)) return false;

  return customRole.permissions.includes(permission);
};

export const requirePermission = async (ctx: any, permission: Permission) => {
  const { identity, user } = await getCurrentUserRecord(ctx);

  const allowed =
    isOwnerUser(user) ||
    hasPermission(user.role, permission) ||
    (await hasCustomPermission(ctx, user, permission));

  if (!allowed) {
    throw createServerError(
      new Error(`Role ${user.role} is missing permission ${permission}`),
      "You do not have permission to perform this action.",
    );
  }

  return { identity, user };
};

export const requireAnyPermission = async (
  ctx: any,
  permissions: Permission[],
) => {
  const { identity, user } = await getCurrentUserRecord(ctx);

  if (isOwnerUser(user)) return { identity, user };

  for (const permission of permissions) {
    if (
      hasPermission(user.role, permission) ||
      (await hasCustomPermission(ctx, user, permission))
    ) {
      return { identity, user };
    }
  }

  throw createServerError(
    new Error(
      `Role ${user.role} is missing required permissions ${permissions.join(", ")}`,
    ),
    "You do not have permission to perform this action.",
  );
};

export const canAccessInterview = (
  user: Pick<UserRecord, "clerkId" | "role">,
  interview: InterviewRecord,
) => {
  if (user.role === "admin" || user.role === "recruiter") return true;
  if (user.role === "candidate") return interview.candidateId === user.clerkId;

  return interview.interviewerIds.includes(user.clerkId);
};

export const canReviewInterview = (
  user: Pick<UserRecord, "clerkId" | "role">,
  interview: InterviewRecord,
) => {
  if (user.role === "admin" || user.role === "recruiter") return true;

  return (
    user.role === "interviewer" &&
    interview.interviewerIds.includes(user.clerkId)
  );
};

export const canAccessRecording = (
  user: Pick<UserRecord, "clerkId" | "role">,
  interview: InterviewRecord,
) => {
  if (user.role === "admin" || user.role === "recruiter") return true;

  return (
    user.role === "interviewer" &&
    interview.interviewerIds.includes(user.clerkId)
  );
};

export const requireInterviewAccess = async (
  ctx: any,
  interviewId: unknown,
) => {
  const { identity, user } = await getCurrentUserRecord(ctx);
  const interview = await ctx.db.get(interviewId);

  if (!interview) {
    throw createServerError(
      new Error(`Interview not found: ${String(interviewId)}`),
      "Interview not found.",
    );
  }

  if (!canAccessInterview(user, interview)) {
    throw createServerError(
      new Error(
        `User ${identity.subject} is not allowed to access interview ${String(interviewId)}`,
      ),
      "You are not allowed to access this interview.",
    );
  }

  return { identity, user, interview };
};

export const requireInterviewReviewAccess = async (
  ctx: any,
  interviewId: unknown,
) => {
  const { identity, user, interview } = await requireInterviewAccess(
    ctx,
    interviewId,
  );

  if (!canReviewInterview(user, interview)) {
    throw createServerError(
      new Error(
        `User ${identity.subject} is not allowed to review interview ${String(interviewId)}`,
      ),
      "You are not allowed to review this interview.",
    );
  }

  return { identity, user, interview };
};

export const requireRecordingAccess = async (
  ctx: any,
  interviewId: unknown,
) => {
  const { identity, user, interview } = await requireInterviewAccess(
    ctx,
    interviewId,
  );

  if (!canAccessRecording(user, interview)) {
    throw createServerError(
      new Error(
        `User ${identity.subject} is not allowed to access recordings for interview ${String(interviewId)}`,
      ),
      "You are not allowed to access these recordings.",
    );
  }

  return { identity, user, interview };
};
