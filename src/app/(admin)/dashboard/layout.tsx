import { ReactNode } from "react";
import DashboardShell from "@/components/dashboard/DashboardShell";
import AppShell from "@/components/layout/AppShell";

export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <AppShell>
      <DashboardShell>{children}</DashboardShell>
    </AppShell>
  );
}
