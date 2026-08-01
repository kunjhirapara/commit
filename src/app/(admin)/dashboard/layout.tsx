"use client";

import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import DashboardShell from "@/components/dashboard/DashboardShell";
import AppShell from "@/components/layout/AppShell";
import RoleGuard from "@/components/auth/RoleGuard";

/**
 * The dashboard segment used to be gated by middleware, which queried Convex for
 * the caller's role on every navigation. The guard now runs here instead, so a
 * disallowed role never sees the dashboard chrome — the four pages inside keep
 * their own RoleGuards as well, since each allows a different set of roles.
 *
 * `export const dynamic = "force-dynamic"` was dropped along with this change.
 * A client component cannot export route config, and the directive was not
 * earning its keep: the dashboard's data all arrives through client-side Convex
 * subscriptions, which are live regardless of how the shell is rendered.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <AppShell>
      <RoleGuard fromPathname={pathname} redirectTo="/">
        <DashboardShell>{children}</DashboardShell>
      </RoleGuard>
    </AppShell>
  );
}
