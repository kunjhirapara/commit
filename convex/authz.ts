import { createServerError, requireIdentity } from "./errorUtils";

export const USER_ROLES = [
  "candidate",
  "interviewer",
  "recruiter",
  "admin",
] as const;

export const PRIVILEGED_INVITATION_ROLES = [
  "interviewer",
  "recruiter",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type PrivilegedInvitationRole =
  (typeof PRIVILEGED_INVITATION_ROLES)[number];

export type Permission =
  | "viewUsers"
  | "viewDashboard"
  | "viewRecordings"
  | "viewObservability"
  | "scheduleInterviews"
  | "editInterviews"
  | "cancelInterviews"
  | "manageRoles"
  | "manageInvitations";

type UserRecord = {
  _id: string;
  clerkId: string;
  email: string;
  role: UserRole;
};

type InterviewRecord = {
  _id: string;
  candidateId: string;
  interviewerIds: string[];
  status?: string;
};

const PERMISSIONS: Record<UserRole, Permission[]> = {
  candidate: [],
  interviewer: ["viewUsers", "viewDashboard", "viewRecordings"],
  recruiter: [
    "viewUsers",
    "viewDashboard",
    "viewRecordings",
    "viewObservability",
    "scheduleInterviews",
    "editInterviews",
    "cancelInterviews",
    "manageInvitations",
  ],
  admin: [
    "viewUsers",
    "viewDashboard",
    "viewRecordings",
    "viewObservability",
    "scheduleInterviews",
    "editInterviews",
    "cancelInterviews",
    "manageRoles",
    "manageInvitations",
  ],
};

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

export const getCurrentUserRecord = async (
  ctx: any,
) => {
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

export const requirePermission = async (
  ctx: any,
  permission: Permission,
) => {
  const { identity, user } = await getCurrentUserRecord(ctx);

  if (!hasPermission(user.role, permission)) {
    throw createServerError(
      new Error(`Role ${user.role} is missing permission ${permission}`),
      "You do not have permission to perform this action.",
    );
  }

  return { identity, user };
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

export const requireRecordingAccess = async (ctx: any, interviewId: unknown) => {
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
