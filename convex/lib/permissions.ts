/**
 * The single source of truth for roles and permissions.
 *
 * Deliberately dependency-free so both the Convex functions (via lib/authz.ts)
 * and the browser (via src/hooks/useUserRole.ts) can import it. The client used
 * to keep its own copy of this table, which had drifted: it granted
 * `viewDataAccessLogs` and `manageDeployments`, neither of which exists on the
 * server, so the UI and the actual authorization disagreed.
 *
 * The server always re-checks. This table exists so the UI can avoid offering
 * actions that would be rejected — it is not itself a security boundary.
 */

export const USER_ROLES = [
  "candidate",
  "interviewer",
  "recruiter",
  "developer",
  "admin",
] as const;

export const PRIVILEGED_INVITATION_ROLES = [
  "interviewer",
  "recruiter",
  "developer",
  "admin",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
export type PrivilegedInvitationRole =
  (typeof PRIVILEGED_INVITATION_ROLES)[number];

export const PERMISSION_VALUES = [
  "viewUsers",
  "viewDashboard",
  "viewRecordings",
  "viewObservability",

  "scheduleInterviews",
  "editInterviews",
  "cancelInterviews",
  "manageRoles",
  "manageRoleCatalog",
  "manageInvitations",

  "manageReliability",
] as const;

export type Permission = (typeof PERMISSION_VALUES)[number];

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
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
  developer: [
    "viewDashboard",
    "viewObservability",
    "manageRoleCatalog",
    "manageReliability",
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
    "manageRoleCatalog",
    "manageInvitations",
    "manageReliability",
  ],
};

export const roleHasPermission = (role: UserRole, permission: Permission) =>
  ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
