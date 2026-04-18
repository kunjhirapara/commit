import { useUser } from "@clerk/nextjs";
import { api } from "../../convex/_generated/api";
import { useQuery } from "convex/react";

export const useUserRole = () => {
  const { user } = useUser();

  const userData = useQuery(api.users.getCurrentUser, user ? {} : "skip");

  const role = userData?.role;
  const isLoading = !!user && userData === undefined;
  const canAccessDashboard =
    role === "interviewer" || role === "recruiter" || role === "admin";
  const canScheduleInterviews = role === "recruiter" || role === "admin";
  const canManageInvitations = role === "recruiter" || role === "admin";
  const canManageRoles = role === "admin";
  const canViewRecordings = canAccessDashboard;

  return {
    role,
    user: userData,
    isLoading,
    isCandidate: role === "candidate",
    isInterviewer: role === "interviewer",
    isRecruiter: role === "recruiter",
    isAdmin: role === "admin",
    isPrivileged: canAccessDashboard,
    canAccessDashboard,
    canScheduleInterviews,
    canManageInvitations,
    canManageRoles,
    canViewRecordings,
  };
};
