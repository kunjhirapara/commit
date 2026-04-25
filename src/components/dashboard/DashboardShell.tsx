"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  ShieldCheckIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useUserRole } from "@/hooks/useUserRole";

type NavItem = {
  href: string;
  label: string;
  description: string;
  icon: ReactNode;
  visible: boolean;
};

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const {
    role,
    canAccessDeveloperTools,
    canManageInvitations,
    canManageCompliance,
    canManageRoleCatalog,
    canManageRoles,
  } = useUserRole();

  const navItems: NavItem[] = [
    {
      href: "/dashboard",
      label: "Overview",
      description: "Live summary and quick jumps",
      icon: <LayoutDashboardIcon className="size-4" />,
      visible: true,
    },
    {
      href: "/dashboard/interviews",
      label: "Interviews",
      description: "Pipeline, funnel, and manual review",
      icon: <WorkflowIcon className="size-4" />,
      visible:
        role === "interviewer" || role === "recruiter" || role === "admin",
    },
    {
      href: "/dashboard/team",
      label: "Team",
      description: "Access, interviewer profiles, candidates",
      icon: <UsersIcon className="size-4" />,
      visible: canManageInvitations || canManageRoles,
    },
    {
      href: "/dashboard/developer",
      label: "Developer",
      description: "Observability, reliability, deployments",
      icon: <ActivityIcon className="size-4" />,
      visible: canAccessDeveloperTools,
    },
    {
      href: "/dashboard/compliance",
      label: "Compliance",
      description: "Governance and data access oversight",
      icon: <ShieldCheckIcon className="size-4" />,
      visible: canManageCompliance,
    },
    {
      href: "/dashboard/roles",
      label: "Roles",
      description: "Create roles and assign permissions",
      icon: <KeyRoundIcon className="size-4" />,
      visible: canManageRoleCatalog,
    },
  ];

  const visibleItems = navItems.filter((item) => item.visible);

  return (
    <div className="min-h-screen">
      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit">
          <div className="rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur">
            <div className="space-y-2">
              <Badge variant="secondary" className="rounded-full px-3">
                {role ?? "guest"}
              </Badge>
            </div>
            <nav className="mt-5 space-y-2">
              {visibleItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "block rounded-full border ps-3 py-3 transition-all",
                      active
                        ? "border-emerald-500/30 bg-emerald-500/10 shadow-sm"
                        : "border-transparent bg-muted/40 hover:border-border hover:bg-card",
                    )}>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-10 shrink-0 items-center justify-center rounded-full",
                          active
                            ? "bg-emerald-500 text-white"
                            : "bg-background text-muted-foreground",
                        )}>
                        {item.icon}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium">{item.label}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.description}
                        </p>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="space-y-6">
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
            {visibleItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "whitespace-nowrap rounded-full border px-4 py-2 text-sm transition-colors",
                    active
                      ? "border-emerald-500/40 bg-emerald-500/10 text-foreground"
                      : "border-border/70 bg-card/80 text-muted-foreground",
                  )}>
                  {item.label}
                </Link>
              );
            })}
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
