"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  KeyRoundIcon,
  LayoutDashboardIcon,
  UsersIcon,
  WorkflowIcon,
} from "lucide-react";
import { StatusBadge } from "@/components/ui/status-badge";
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
      {/* Skip to main content for keyboard accessibility */}
      <a
        href="#dashboard-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-white focus:outline-none"
      >
        Skip to main content
      </a>

      <div className="container mx-auto grid gap-6 px-4 py-8 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-4 lg:sticky lg:top-24 lg:h-fit" aria-label="Dashboard navigation">
          <div className="rounded-[28px] border border-border/70 bg-card/85 p-5 shadow-sm backdrop-blur">
            <div className="space-y-2">
              <StatusBadge status={role ?? "guest"} className="rounded-full px-3" />
            </div>
            <nav className="mt-5 space-y-1.5" aria-label="Main">
              {visibleItems.map((item) => {
                const active =
                  pathname === item.href ||
                  (item.href !== "/dashboard" &&
                    pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group block cursor-pointer rounded-[18px] border py-2.5 ps-3 pe-4 transition-all duration-200",
                      active
                        ? "border-primary/25 bg-primary/10 shadow-sm"
                        : "border-transparent bg-muted/30 hover:border-border/60 hover:bg-card hover:shadow-sm",
                    )}>
                    <div className="flex items-center gap-3">
                      <span
                        className={cn(
                          "flex size-9 shrink-0 items-center justify-center rounded-full transition-all duration-200",
                          active
                            ? "bg-primary text-primary-foreground shadow-sm"
                            : "bg-background text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary",
                        )}>
                        {item.icon}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className={cn("text-sm font-medium leading-none mb-1", active ? "text-foreground" : "text-foreground/80 group-hover:text-foreground")}>
                          {item.label}
                        </p>
                        <p className="text-xs text-muted-foreground leading-snug">
                          {item.description}
                        </p>
                      </div>
                      {active && (
                        <span className="size-1.5 rounded-full bg-primary shrink-0" aria-hidden="true" />
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        <div className="space-y-6">
          {/* Mobile tab bar */}
          <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden scrollbar-none" role="tablist" aria-label="Dashboard sections">
            {visibleItems.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/dashboard" && pathname?.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="tab"
                  aria-selected={active}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "inline-flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all duration-200",
                    active
                      ? "border-primary/40 bg-primary/10 text-foreground shadow-sm"
                      : "border-border/60 bg-card/80 text-muted-foreground hover:border-border hover:bg-card hover:text-foreground",
                  )}>
                  <span className="size-3.5 shrink-0">{item.icon}</span>
                  {item.label}
                </Link>
              );
            })}
          </div>
          <main id="dashboard-main">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}

export default DashboardShell;
