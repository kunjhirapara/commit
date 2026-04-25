import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { useQuery } from "convex/react";

const BASE_PERMISSIONS = {
  candidate: [],
  interviewer: ["viewUsers", "viewDashboard", "viewRecordings"],
  recruiter: [
    "viewUsers",
    "viewDashboard",
    "viewRecordings",
    "viewObservability",
    "viewDataAccessLogs",
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
    "manageDeployments",
  ],
  admin: [
    "viewUsers",
    "viewDashboard",
    "viewRecordings",
    "viewObservability",
    "viewDataAccessLogs",
    "scheduleInterviews",
    "editInterviews",
    "cancelInterviews",
    "manageRoles",
    "manageRoleCatalog",
    "manageInvitations",

    "manageReliability",
    "manageDeployments",
  ],
} as const;

export type AppPermission =
  | "viewUsers"
  | "viewDashboard"
  | "viewRecordings"
  | "viewObservability"
  | "viewDataAccessLogs"
  | "scheduleInterviews"
  | "editInterviews"
  | "cancelInterviews"
  | "manageRoles"
  | "manageRoleCatalog"
  | "manageInvitations"

  | "manageReliability"
  | "manageDeployments";

export const useUserRole = () => {
  const { user } = useUser();

  const userData = useQuery(api.users.getCurrentUser, user ? {} : "skip");

  const role = userData?.role as keyof typeof BASE_PERMISSIONS | undefined;
  const customRole = userData?.customRole ?? null;
  const isLoading = !!user && userData === undefined;
  const permissions = new Set<AppPermission>([
    ...((role ? BASE_PERMISSIONS[role] : []) as AppPermission[]),
    ...((customRole?.permissions ?? []) as AppPermission[]),
  ]);
  const hasPermission = (permission: AppPermission) => permissions.has(permission);
  const canAccessDashboard = hasPermission("viewDashboard");
  const canScheduleInterviews = hasPermission("scheduleInterviews");
  const canManageInvitations = hasPermission("manageInvitations");
  const canManageRoles = hasPermission("manageRoles");
  const canManageRoleCatalog = hasPermission("manageRoleCatalog");

  const canEditInterviews = hasPermission("editInterviews");
  const canAccessDeveloperTools =
    hasPermission("viewObservability") ||
    hasPermission("manageReliability") ||
    hasPermission("manageDeployments");
  const canViewRecordings = hasPermission("viewRecordings");
  const canManageReliability = hasPermission("manageReliability");
  const canManageDeployments = hasPermission("manageDeployments");
  const canViewDataAccessLogs = hasPermission("viewDataAccessLogs");

  return {
    role,
    customRole,
    permissions: Array.from(permissions),
    hasPermission,
    user: userData,
    isLoading,
    isCandidate: role === "candidate",
    isInterviewer: role === "interviewer",
    isRecruiter: role === "recruiter",
    isDeveloper: role === "developer",
    isAdmin: role === "admin",
    isPrivileged: canAccessDashboard,
    canAccessDashboard,
    canScheduleInterviews,
    canManageInvitations,
    canManageRoles,
    canManageRoleCatalog,

    canEditInterviews,
    canAccessDeveloperTools,
    canViewRecordings,
    canManageReliability,
    canManageDeployments,
    canViewDataAccessLogs,
  };
};
