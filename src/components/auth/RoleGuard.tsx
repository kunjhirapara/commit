"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import ErrorState from "@/components/ui/ErrorState";
import type { AppPermission } from "@/hooks/useUserRole";
import { useUserRole } from "@/hooks/useUserRole";
import { getRequiredRolesForPath, type AppRole } from "@/lib/routeAccess";

function RoleGuard({
  allowedRoles,
  fromPathname,
  requiredPermissions,
  requireAllPermissions = false,
  redirectTo,
  children,
  title = "Access restricted",
  message = "You do not have permission to view this page.",
}: {
  allowedRoles?: AppRole[];
  /** Derive allowed roles from PROTECTED_ROUTES instead of repeating them. */
  fromPathname?: string;
  requiredPermissions?: AppPermission[];
  requireAllPermissions?: boolean;
  /** Redirect instead of rendering a denial panel. Matches what middleware did. */
  redirectTo?: string;
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { hasPermission, isLoading, role } = useUserRole();
  const router = useRouter();

  const effectiveRoles =
    allowedRoles ??
    (fromPathname ? getRequiredRolesForPath(fromPathname) : undefined);

  const passesRoleCheck =
    !effectiveRoles || (role ? effectiveRoles.includes(role) : false);
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
  // candidate. The Convex checks are the real gate; this makes the component
  // match what it claims to do.
  const denied =
    !isLoading && (!role || !passesRoleCheck || !passesPermissionCheck);

  // Middleware used to redirect a disallowed role to "/". It no longer queries
  // Convex to learn the role, so the routes that relied on that redirect ask
  // for it here instead.
  useEffect(() => {
    if (denied && redirectTo) router.replace(redirectTo);
  }, [denied, redirectTo, router]);

  if (isLoading) return null;
  if (denied && redirectTo) return null;

  if (denied) {
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
