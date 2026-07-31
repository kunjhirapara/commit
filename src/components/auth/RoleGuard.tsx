"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import ErrorState from "@/components/ui/ErrorState";
import type { AppPermission } from "@/hooks/useUserRole";
import { useUserRole } from "@/hooks/useUserRole";

type AllowedRole =
  | "candidate"
  | "interviewer"
  | "recruiter"
  | "developer"
  | "admin";

function RoleGuard({
  allowedRoles,
  requiredPermissions,
  requireAllPermissions = false,
  children,
  title = "Access restricted",
  message = "You do not have permission to view this page.",
}: {
  allowedRoles?: AllowedRole[];
  requiredPermissions?: AppPermission[];
  requireAllPermissions?: boolean;
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { hasPermission, isLoading, role } = useUserRole();

  if (isLoading) return null;

  const passesRoleCheck =
    !allowedRoles || (role ? allowedRoles.includes(role) : false);
  const passesPermissionCheck =
    !requiredPermissions ||
    requiredPermissions.length === 0 ||
    (requireAllPermissions
      ? requiredPermissions.every((permission) => hasPermission(permission))
      : requiredPermissions.some((permission) => hasPermission(permission)));

  // Both checks must pass. This was an OR, and `passesPermissionCheck` defaults
  // to true when no permissions are supplied — so on the call sites that pass
  // only `allowedRoles`, the condition collapsed to "any user with a role", and
  // e.g. <RoleGuard allowedRoles={["recruiter","admin"]}> rendered for a
  // candidate. Middleware and the Convex checks were the real gates; this makes
  // the component match what it claims to do.
  if (!role || !passesRoleCheck || !passesPermissionCheck) {
    return (
      <ErrorState
        title={title}
        message={message}
        secondaryAction={
          <Link
            href="/"
            className="text-sm text-primary underline-offset-4 hover:underline">
            Back to home
          </Link>
        }
      />
    );
  }

  return <>{children}</>;
}

export default RoleGuard;
