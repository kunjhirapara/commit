"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import ErrorState from "@/components/ui/ErrorState";
import LoaderUI from "@/components/ui/LoaderUI";
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

  if (isLoading) return <LoaderUI />;

  const passesRoleCheck =
    !allowedRoles || (role ? allowedRoles.includes(role) : false);
  const passesPermissionCheck =
    !requiredPermissions ||
    requiredPermissions.length === 0 ||
    (requireAllPermissions
      ? requiredPermissions.every((permission) => hasPermission(permission))
      : requiredPermissions.some((permission) => hasPermission(permission)));

  if (!role || (!passesRoleCheck && !passesPermissionCheck)) {
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
