"use client";

import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  MetricCard,
  SectionIntro,
} from "@/components/dashboard/DashboardPrimitives";
import NotificationsPanel from "@/components/ui/NotificationsPanel";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { api } from "../../../../convex/_generated/api";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";
import { useUserRole } from "@/hooks/useUserRole";

function DashboardOverviewSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-6 shadow-sm">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-full max-w-2xl" />
          </div>
          <Skeleton className="h-10 w-40 rounded-md" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-border/70 bg-card/80 shadow-sm">
          <div className="flex flex-col gap-4 border-b px-6 py-5 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="h-6 w-20 rounded-full" />
              <Skeleton className="h-8 w-24 rounded-md" />
            </div>
          </div>
          <div className="space-y-3 p-6">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3"
              >
                <Skeleton className="mt-1 h-2.5 w-2.5 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-full max-w-md space-y-2">
                      <Skeleton className="h-4 w-2/3" />
                      <Skeleton className="h-4 w-full" />
                    </div>
                    <Skeleton className="h-3 w-16" />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-6 w-20 rounded-md" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </CardHeader>
          <CardContent className="grid gap-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4"
              >
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-4 w-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-full max-w-xl" />
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader className="pb-2">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardHeader>
              <CardContent className="pt-0">
                <Skeleton className="h-4 w-28" />
              </CardContent>
            </Card>
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-2">
          {[1, 2].map((i) => (
            <Card key={i} className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <Skeleton className="h-6 w-44" />
              </CardHeader>
              <CardContent className="space-y-3">
                {[1, 2, 3].map((item) => (
                  <div
                    key={item}
                    className="rounded-2xl border border-border/70 bg-background/70 px-4 py-3"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="w-full space-y-2">
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-4 w-full" />
                      </div>
                      <Skeleton className="h-6 w-20 rounded-full" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function DashboardOverviewPage() {
  useLifecycleAutomation();

  const {
    canAccessDeveloperTools,
    canManageInvitations,
    canManageRoleCatalog,
    canManageRoles,
    canScheduleInterviews,
    role,
  } = useUserRole();

  const operations =
    useQuery(
      api.admin.getAdminDashboard,
      role === "developer" ? "skip" : { stage: "scheduled" },
    ) ?? null;
  const monitoring = useQuery(
    api.observability.getMonitoringDashboard,
    canAccessDeveloperTools ? {} : "skip",
  );
  const reliability = useQuery(
    api.reliability.getReliabilityDashboard,
    canAccessDeveloperTools ? {} : "skip",
  );
  const notificationOps = useQuery(
    api.notifications.index.getNotificationOperationsDashboard,
    canAccessDeveloperTools ? {} : "skip",
  );

  const isLoading =
    (role !== "developer" && operations === undefined) ||
    (canAccessDeveloperTools &&
      (monitoring === undefined || reliability === undefined || notificationOps === undefined));

  const workspaceLinks = [
    {
      href: "/dashboard/interviews",
      title: "Interview operations",
      description: "Pipeline triage, bulk actions, and manual interventions.",
      visible: role === "interviewer" || role === "recruiter" || role === "admin",
    },
    {
      href: "/dashboard/team",
      title: "Team management",
      description: "Invitations, interviewer profiles, and candidate review trails.",
      visible: canManageInvitations || canManageRoles,
    },
    {
      href: "/dashboard/developer",
      title: "Developer console",
      description: "System health, reliability queues, and delivery operations.",
      visible: canAccessDeveloperTools,
    },

    {
      href: "/dashboard/roles",
      title: "Roles studio",
      description: "Create roles, assign permissions, and update user access.",
      visible: canManageRoleCatalog,
    },
  ].filter((item) => item.visible);

  if (isLoading) {
    return <DashboardOverviewSkeleton />;
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Workspace"
        title="Modern operations dashboard"
        description="A cleaner control center with focused pages for recruiting operations, engineering telemetry, and governance."
        action={
          canScheduleInterviews ? (
            <Button asChild>
              <Link href="/schedule">Schedule interview</Link>
            </Button>
          ) : null
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.6fr_1fr]">
        <NotificationsPanel />
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Workspace shortcuts</CardTitle>
            <CardDescription>
              Jump straight into the part of the system that matches your role.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2.5">
            {workspaceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex cursor-pointer items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3.5 transition-all duration-200 hover:border-primary/30 hover:bg-primary/5 hover:shadow-sm"
              >
                <div>
                  <p className="text-sm font-medium leading-none group-hover:text-primary transition-colors duration-200">
                    {item.title}
                  </p>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-snug">
                    {item.description}
                  </p>
                </div>
                <ArrowRightIcon className="size-4 shrink-0 text-muted-foreground/50 transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-primary" aria-hidden="true" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {operations ? (
        <section className="space-y-4">
          <SectionIntro
            title="Hiring snapshot"
            description="Keep the top recruiting metrics on the overview, then dive into the interview workspace for the full pipeline."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Throughput"
              value={operations.analytics.throughput}
              hint="Completed interview flow"
              accentClassName="text-emerald-600 dark:text-emerald-400"
            />
            <MetricCard
              label="Time to hire"
              value={`${operations.analytics.timeToHireDays}d`}
              hint="Avg from creation to interview"
            />
            <MetricCard
              label="Cancellations"
              value={operations.analytics.cancellations}
              hint="Cancelled rounds"
              accentClassName={operations.analytics.cancellations > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
            <MetricCard
              label="No shows"
              value={operations.analytics.noShows}
              hint="Missed interview count"
              accentClassName={operations.analytics.noShows > 0 ? "text-rose-500 dark:text-rose-400" : undefined}
            />
            <MetricCard
              label="Feedback pending"
              value={operations.analytics.feedbackPending}
              hint="Draft scorecards still open"
              accentClassName={operations.analytics.feedbackPending > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
            />
          </div>
        </section>
      ) : null}

      {canAccessDeveloperTools && monitoring && reliability && notificationOps ? (
        <section className="space-y-4">
          <SectionIntro
            title="Engineering snapshot"
            description="The new developer workspace owns observability, reliability, notification delivery, and deployment flow."
          />
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              label="Critical events"
              value={monitoring.totals.criticalEvents}
              accentClassName={monitoring.totals.criticalEvents > 0 ? "text-rose-500 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}
              hint="Errors in the last 24 hours"
            />
            <MetricCard
              label="Open recoveries"
              value={reliability.totals.openRecoveries}
              accentClassName={reliability.totals.openRecoveries > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              hint="Incidents needing operator action"
            />
            <MetricCard
              label="Failed notifications"
              value={notificationOps.totals.failed}
              accentClassName={notificationOps.totals.failed > 0 ? "text-amber-600 dark:text-amber-400" : undefined}
              hint="Delivery retries available"
            />
            <MetricCard
              label="Providers needing attention"
              value={
                monitoring.healthChecks.filter((check) => check.status !== "healthy")
                  .length
              }
              hint="Health check degradations"
            />
          </div>
          <div className="grid gap-4 xl:grid-cols-2">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle>Latest health checks</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {monitoring.healthChecks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border/70">
                    <p className="text-sm font-medium">No recent health checks found.</p>
                    <p className="text-xs opacity-80 mt-1">System monitoring will appear here.</p>
                  </div>
                ) : (
                  monitoring.healthChecks.map((check) => (
                    <div
                      key={`${check.provider}-${check.checkedAt}`}
                      className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm transition-colors duration-150 hover:bg-muted/30"
                    >
                      <div className="flex items-start gap-3 min-w-0">
                        <span
                          aria-hidden="true"
                          className={cn(
                            "mt-1.5 size-2 shrink-0 rounded-full",
                            check.status === "healthy"
                              ? "bg-emerald-500"
                              : check.status === "degraded"
                                ? "bg-amber-500"
                                : "bg-rose-500",
                          )}
                        />
                        <div className="min-w-0">
                          <p className="font-medium capitalize leading-none">{check.provider}</p>
                          <p className="mt-1 text-xs text-muted-foreground truncate">{check.message}</p>
                        </div>
                      </div>
                      <StatusBadge status={check.status} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle>Developer workspace focus</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm text-muted-foreground">
                <p>
                  Observability and recovery workflows now live on the developer page instead of crowding the main operations view.
                </p>
                <p>
                  Deployment changes stay alongside reliability and notification delivery so engineers can work from one focused surface.
                </p>
                <Button asChild variant="outline" className="mt-2">
                  <Link href="/dashboard/developer">Open developer workspace</Link>
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}
    </div>
  );
}

export default function ProtectedDashboardOverviewPage() {
  return (
    <RoleGuard
      allowedRoles={["interviewer", "recruiter", "developer", "admin"]}
      title="Dashboard restricted"
      message="Only interview staff and developers can access the dashboard."
    >
      <DashboardOverviewPage />
    </RoleGuard>
  );
}
