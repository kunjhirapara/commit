"use client";

import Link from "next/link";
import { ReactNode } from "react";
import ErrorState from "@/components/ui/ErrorState";
import LoaderUI from "@/components/ui/LoaderUI";
import { useUserRole } from "@/hooks/useUserRole";

type AllowedRole = "candidate" | "interviewer" | "recruiter" | "admin";

function RoleGuard({
  allowedRoles,
  children,
  title = "Access restricted",
  message = "You do not have permission to view this page.",
}: {
  allowedRoles: AllowedRole[];
  children: ReactNode;
  title?: string;
  message?: string;
}) {
  const { isLoading, role } = useUserRole();

  if (isLoading) return <LoaderUI />;

  if (!role || !allowedRoles.includes(role)) {
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
