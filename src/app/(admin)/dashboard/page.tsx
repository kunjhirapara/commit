"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  MetricCard,
  SectionIntro,
} from "@/components/dashboard/DashboardPrimitives";
import LoaderUI from "@/components/ui/LoaderUI";
import NotificationsPanel from "@/components/ui/NotificationsPanel";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../../convex/_generated/api";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";
import { useUserRole } from "@/hooks/useUserRole";

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
    api.notifications.getNotificationOperationsDashboard,
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
          <CardContent className="grid gap-3">
            {workspaceLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-2xl border border-border/70 bg-background/70 px-4 py-4 transition-colors hover:bg-muted/60"
              >
                <p className="font-medium">{item.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {item.description}
                </p>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="py-20 flex justify-center">
          <LoaderUI />
        </div>
      ) : (
        <>

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
            />
            <MetricCard
              label="Time to hire"
              value={`${operations.analytics.timeToHireDays}d`}
              hint="Average from creation to interview"
            />
            <MetricCard
              label="Cancellations"
              value={operations.analytics.cancellations}
              hint="Cancelled rounds"
            />
            <MetricCard
              label="No shows"
              value={operations.analytics.noShows}
              hint="Missed interview count"
            />
            <MetricCard
              label="Feedback pending"
              value={operations.analytics.feedbackPending}
              hint="Draft scorecards still open"
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
              accentClassName="text-amber-600"
              hint="Errors in the last 24 hours"
            />
            <MetricCard
              label="Open recoveries"
              value={reliability.totals.openRecoveries}
              hint="Incidents needing operator action"
            />
            <MetricCard
              label="Failed notifications"
              value={notificationOps.totals.failed}
              hint="Delivery retries available"
            />
            <MetricCard
              label="Deployments tracked"
              value={
                monitoring.healthChecks.filter((check) => check.status !== "healthy")
                  .length
              }
              hint="Providers needing attention"
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
                      className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3 text-sm"
                    >
                      <div>
                        <p className="font-medium capitalize">{check.provider}</p>
                        <p className="text-muted-foreground">{check.message}</p>
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
        </>
      )}
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
