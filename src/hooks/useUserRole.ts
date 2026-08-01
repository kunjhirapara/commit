import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { useConvexAuth, useQuery } from "convex/react";
import { useUserSyncStatus } from "@/components/providers/UserSyncStatusProvider";
import { isRoleStateLoading } from "@/lib/auth/roleLoading";

import {
  PERMISSION_VALUES,
  ROLE_PERMISSIONS,
  type Permission,
} from "../../convex/lib/permissions";

/**
 * Shared with the server rather than duplicated. The local copy this replaces had
 * drifted — it granted `viewDataAccessLogs` and `manageDeployments`, which do not
 * exist in the server's PERMISSION_VALUES and were silently discarded, so the UI
 * and the real authorization disagreed.
 */
const BASE_PERMISSIONS = ROLE_PERMISSIONS;

export type AppPermission = Permission;

export const useUserRole = () => {
  // `isLoaded` matters as much as `user`: Clerk reports `user: undefined` both
  // when nobody is signed in and while it is still initialising, and treating
  // those the same is what made every refresh look like a denial.
  const { user, isLoaded: isClerkLoaded } = useUser();
  const { isAuthenticated, isLoading: isConvexAuthLoading } = useConvexAuth();
  const { status: syncStatus, clerkId: syncedClerkId } = useUserSyncStatus();
  const isSyncedCurrentUser =
    syncStatus === "ready" && syncedClerkId === user?.id;
  const shouldWaitForSync =
    !!user && (syncStatus === "loading" || syncStatus === "syncing");
  const canQueryCurrentUser = !!user && isAuthenticated && isSyncedCurrentUser;

  const userData = useQuery(
    api.users.getCurrentUser,
    canQueryCurrentUser ? {} : "skip",
  );

  const role = userData?.role as keyof typeof BASE_PERMISSIONS | undefined;
  const customRole = userData?.customRole ?? null;
  /**
   * Owner is decided by OWNER_EMAILS on the Convex deployment, not by a column,
   * so it cannot be granted from inside the app. This flag is for hiding
   * affordances the server would reject anyway — never treat it as the gate.
   */
  const isOwner = userData?.isOwner === true;
  const isLoading = isRoleStateLoading({
    isClerkLoaded,
    hasUser: !!user,
    isConvexAuthLoading,
    isWaitingForSync: shouldWaitForSync,
    isQueryingCurrentUser: canQueryCurrentUser,
    hasUserData: userData !== undefined,
  });
  const permissions = new Set<AppPermission>([
    ...((role ? BASE_PERMISSIONS[role] : []) as AppPermission[]),
    ...((customRole?.permissions ?? []) as AppPermission[]),
    // Mirrors requirePermission on the server, which short-circuits for the
    // owner. Without this the owner signs in as `candidate` and sees none of
    // the admin surfaces they are in fact allowed to use.
    ...(isOwner ? (PERMISSION_VALUES as readonly AppPermission[]) : []),
  ]);
  const hasPermission = (permission: AppPermission) => permissions.has(permission);
  const canAccessDashboard = hasPermission("viewDashboard");
  const canScheduleInterviews = hasPermission("scheduleInterviews");
  const canManageInvitations = hasPermission("manageInvitations");
  const canManageRoles = hasPermission("manageRoles");
  const canManageRoleCatalog = hasPermission("manageRoleCatalog");

  const canEditInterviews = hasPermission("editInterviews");
  const canAccessDeveloperTools =
    hasPermission("viewObservability") || hasPermission("manageReliability");
  const canViewRecordings = hasPermission("viewRecordings");
  const canManageReliability = hasPermission("manageReliability");

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
    isOwner,
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
  };
};
