"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import AccessManagementPanel from "@/components/ui/AccessManagementPanel";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Doc, Id } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import LoaderUI from "@/components/ui/LoaderUI";
import {
  getCandidateInfo,
  getInterviewStartTimeMs,
  groupInterviews,
} from "@/lib/utils";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { INTERVIEW_CATEGORY } from "@/constants";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  CalendarIcon,
  CheckCircle2Icon,
  ClockIcon,
  XCircleIcon,
} from "lucide-react";
import { format } from "date-fns";
import { useEffect } from "react";
import CommentDialog from "@/components/ui/CommentDialog";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useUserRole } from "@/hooks/useUserRole";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";
import NotificationsPanel from "@/components/ui/NotificationsPanel";

type Interview = Doc<"interviews">;
type ReviewStatus = "completed" | "passed" | "rejected";

function DashboardPage() {
  useLifecycleAutomation();
  const { canScheduleInterviews, canManageInvitations } = useUserRole();
  const users = useQuery(api.users.getUsers, {});
  const interviews = useQuery(api.interviews.getAllInterviews, {});
  const monitoring = useQuery(api.observability.getMonitoringDashboard, {});
  const updateStatus = useMutation(api.interviews.updateInterviewStatus);
  const captureHealthSnapshot = useMutation(
    api.observability.captureHealthSnapshot,
  );

  useEffect(() => {
    if (!canManageInvitations) return;
    void captureHealthSnapshot().catch(() => undefined);
  }, [canManageInvitations, captureHealthSnapshot]);

  const handleStatusUpdate = async (
    interviewId: Id<"interviews">,
    status: ReviewStatus,
  ) => {
    try {
      await updateStatus({ interviewId, status });
      toast.success(`Interview marked as ${status}`);
    } catch (error) {
      logError("DashboardPage.handleStatusUpdate", error, {
        interviewId,
        status,
      });
      toast.error(
        getDisplayErrorMessage(error, "Failed to update interview status."),
      );
    }
  };

  if (!interviews || !users) return <LoaderUI />;

  const groupedInterviews = groupInterviews(interviews);

  return (
    <div className="container mx-auto py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Interview Dashboard</h1>
          <p className="text-muted-foreground mt-1">
            Review interviews, manage outcomes, and control team access.
          </p>
        </div>
        {canScheduleInterviews ? (
          <Link href="/schedule">
            <Button>Schedule New Interview</Button>
          </Link>
        ) : null}
      </div>

      <div className="mb-8">
        <NotificationsPanel />
      </div>

      {canManageInvitations ? (
        <section className="mb-10 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Access Management</h2>
            <p className="text-sm text-muted-foreground">
              Invite privileged users, update roles, and review recent audit
              events.
            </p>
          </div>
          <AccessManagementPanel />
        </section>
      ) : null}

      {canManageInvitations && monitoring ? (
        <section className="mb-10 space-y-4">
          <div>
            <h2 className="text-xl font-semibold">Observability</h2>
            <p className="text-sm text-muted-foreground">
              Track production failures, dependency health, and recent incident
              context.
            </p>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard label="Auth Failures" value={monitoring.totals.authFailures} />
            <MetricCard
              label="Scheduling Failures"
              value={monitoring.totals.schedulingFailures}
            />
            <MetricCard
              label="Webhook Failures"
              value={monitoring.totals.webhookFailures}
            />
            <MetricCard label="Video Failures" value={monitoring.totals.videoFailures} />
            <MetricCard
              label="Critical Events"
              value={monitoring.totals.criticalEvents}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Integration Health</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {monitoring.healthChecks.map((check) => (
                  <div
                    key={`${check.provider}-${check.checkedAt}`}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm">
                    <span className="font-medium capitalize">{check.provider}</span>
                    <Badge
                      variant={
                        check.status === "healthy"
                          ? "default"
                          : check.status === "degraded"
                            ? "secondary"
                            : "destructive"
                      }>
                      {check.status}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Operational Events</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {monitoring.recentEvents.map((event) => (
                  <div
                    key={`${event.scope}-${event.createdAt}`}
                    className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{event.scope}</span>
                      <Badge
                        variant={
                          event.level === "error" || event.level === "critical"
                            ? "destructive"
                            : event.level === "warn"
                              ? "secondary"
                              : "outline"
                        }>
                        {event.level}
                      </Badge>
                    </div>
                    <p className="mt-1 text-muted-foreground">{event.message}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </section>
      ) : null}

      <div className="space-y-8">
        {INTERVIEW_CATEGORY.map(
          (category) =>
            groupedInterviews[category.id]?.length > 0 && (
              <section key={category.id}>
                <div className="flex items-center gap-2 mb-4">
                  <h2 className="text-xl font-semibold">{category.title}</h2>
                  <Badge variant={category.variant}>
                    {groupedInterviews[category.id].length}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {groupedInterviews[category.id].map(
                    (interview: Interview) => {
                      const candidateInfo = getCandidateInfo(
                        users,
                        interview.candidateId,
                      );
                      const startTime = new Date(
                        getInterviewStartTimeMs(interview),
                      );

                      return (
                        <Card
                          className="hover:shadow-md transition-all"
                          key={interview._id}>
                          <CardHeader className="p-4">
                            <div className="flex items-center gap-3">
                              <Avatar className="h-10 w-10">
                                <AvatarImage src={candidateInfo.image} />
                                <AvatarFallback>
                                  {candidateInfo.initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <CardTitle className="text-base">
                                  {candidateInfo.name}
                                </CardTitle>
                                <p className="text-sm text-muted-foreground">
                                  {interview.title}
                                </p>
                              </div>
                            </div>
                          </CardHeader>

                          <CardContent className="p-4">
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <CalendarIcon className="h-4 w-4" />
                                {format(startTime, "MMM dd")}
                              </div>
                              <div className="flex items-center gap-1">
                                <ClockIcon className="h-4 w-4" />
                                {format(startTime, "hh:mm a")}
                              </div>
                            </div>
                          </CardContent>

                          <CardFooter className="p-4 pt-0 flex flex-col gap-3">
                            {interview.status === "completed" && (
                              <div className="flex gap-2 w-full">
                                <Button
                                  className="flex-1"
                                  onClick={() =>
                                    handleStatusUpdate(
                                      interview._id,
                                      "passed",
                                    )
                                  }>
                                  <CheckCircle2Icon className="h-4 w-4 mr-2" />
                                  Pass
                                </Button>
                                <Button
                                  variant="destructive"
                                  className="flex-1"
                                  onClick={() =>
                                    handleStatusUpdate(interview._id, "rejected")
                                  }>
                                  <XCircleIcon className="h-4 w-4 mr-2" />
                                  Reject
                                </Button>
                              </div>
                            )}
                            <CommentDialog interviewId={interview._id} />
                          </CardFooter>
                        </Card>
                      );
                    },
                  )}
                </div>
              </section>
            ),
        )}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{label}</CardTitle>
      </CardHeader>
      <CardContent className="text-2xl font-semibold">{value}</CardContent>
    </Card>
  );
}

export default function ProtectedDashboardPage() {
  return (
    <RoleGuard
      allowedRoles={["interviewer", "recruiter", "admin"]}
      title="Dashboard restricted"
      message="Only interview staff can access the dashboard.">
      <DashboardPage />
    </RoleGuard>
  );
}
