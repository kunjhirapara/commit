"use client";

import { useDeferredValue, useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  MetricCard,
} from "@/components/dashboard/DashboardPrimitives";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";
import { useUserRole } from "@/hooks/useUserRole";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { HiringFunnelCard } from "./HiringFunnelCard";
import { ManualOverrideCard } from "./ManualOverrideCard";
import { PipelineFilters } from "./PipelineFilters";
import { PipelineInterviewList } from "./PipelineInterviewList";
import type {
  BulkActionValue,
  DashboardAnalytics,
  DashboardInterview,
  InterviewerOption,
  OverrideStatus,
} from "./types";

function WorkspaceSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
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

      <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-4 w-full max-w-md" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 md:grid-cols-3">
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-10 w-full rounded-md" />
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <Skeleton className="h-10 w-32 rounded-md" />
              <Skeleton className="h-4 w-20" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <Skeleton className="h-4 w-4 rounded-sm" />
                        <Skeleton className="h-4 w-32" />
                        <Skeleton className="h-6 w-20 rounded-full" />
                        <Skeleton className="h-6 w-28 rounded-full" />
                      </div>
                      <Skeleton className="h-4 w-44" />
                      <Skeleton className="h-4 w-full max-w-md" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      {i % 3 === 0 ? (
                        <>
                          <Skeleton className="h-9 w-16 rounded-md" />
                          <Skeleton className="h-9 w-20 rounded-md" />
                        </>
                      ) : null}
                      <Skeleton className="h-9 w-36 rounded-md" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-2xl border border-border/70 bg-background/70 px-4 py-3">
                  <Skeleton
                    className={`h-4 ${i % 2 === 0 ? "w-28" : "w-36"}`}
                  />
                  <Skeleton className="h-6 w-10 rounded-full" />
                </div>
              ))}
            </CardContent>
          </Card>

          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </CardHeader>
            <CardContent className="space-y-3">
              <Skeleton className="h-10 w-full rounded-md" />
              <Skeleton className="h-10 w-full rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-3 w-28" />
                <Skeleton className="h-24 w-full rounded-md" />
              </div>
              <Skeleton className="h-10 w-32 rounded-md" />
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
}

function InterviewsWorkspacePage() {
  useLifecycleAutomation();

  const { canEditInterviews, canScheduleInterviews, role } = useUserRole();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [selectedInterviewIds, setSelectedInterviewIds] = useState<string[]>(
    [],
  );
  const [bulkAction, setBulkAction] =
    useState<BulkActionValue>("mark_completed");
  const [bulkInterviewerId, setBulkInterviewerId] = useState("");
  const [overrideInterviewId, setOverrideInterviewId] = useState("");
  const [overrideStatus, setOverrideStatus] =
    useState<OverrideStatus>("scheduled");
  const [overrideReason, setOverrideReason] = useState("");
  const deferredSearch = useDeferredValue(search);

  const adminDashboardRaw = useQuery(api.admin.getAdminDashboard, {
    search: deferredSearch || undefined,
    stage: stage === "all" ? undefined : stage,
  }) as
    | {
        analytics: DashboardAnalytics;
        interviewerRoster: InterviewerOption[];
        pipeline: DashboardInterview[];
      }
    | undefined;

  const [adminDashboard, setAdminDashboard] = useState(adminDashboardRaw);

  useEffect(() => {
    if (adminDashboardRaw) {
      setAdminDashboard(adminDashboardRaw);
    }
  }, [adminDashboardRaw]);

  const isFetching = adminDashboardRaw === undefined;

  const bulkUpdateInterviews = useMutation(api.admin.bulkUpdateInterviews);
  const manualOverrideInterview = useMutation(
    api.admin.manualOverrideInterview,
  );
  const updateStatus = useMutation(api.interviews.updateInterviewStatus);

  const interviewerOptions = adminDashboard?.interviewerRoster ?? [];

  const handleBulkAction = async () => {
    if (!canEditInterviews) {
      toast.error("Only recruiters and admins can run bulk interview updates.");
      return;
    }

    if (selectedInterviewIds.length === 0) {
      toast.error("Select at least one interview first.");
      return;
    }

    try {
      await bulkUpdateInterviews({
        interviewIds: selectedInterviewIds as Id<"interviews">[],
        action: bulkAction,
        interviewerId:
          bulkAction === "assign_interviewer"
            ? bulkInterviewerId || undefined
            : undefined,
      });
      setSelectedInterviewIds([]);
      toast.success("Bulk update applied.");
    } catch (error) {
      logError("InterviewsWorkspacePage.handleBulkAction", error, {
        bulkAction,
        count: selectedInterviewIds.length,
      });
      toast.error(getDisplayErrorMessage(error, "Bulk update failed."));
    }
  };

  const handleManualOverride = async () => {
    if (!canEditInterviews) {
      toast.error("Only recruiters and admins can apply manual overrides.");
      return;
    }

    if (!overrideInterviewId || !overrideReason.trim()) {
      toast.error("Choose an interview and provide a reason.");
      return;
    }

    try {
      await manualOverrideInterview({
        interviewId: overrideInterviewId as Id<"interviews">,
        status: overrideStatus,
        reason: overrideReason.trim(),
      });
      setOverrideReason("");
      toast.success("Interview state overridden.");
    } catch (error) {
      logError("InterviewsWorkspacePage.handleManualOverride", error, {
        overrideInterviewId,
      });
      toast.error(getDisplayErrorMessage(error, "Manual override failed."));
    }
  };

  const handleStatusUpdate = async (
    interviewId: Id<"interviews">,
    status: "passed" | "rejected",
  ) => {
    try {
      await updateStatus({ interviewId, status });
      toast.success(`Interview marked as ${status}.`);
    } catch (error) {
      logError("InterviewsWorkspacePage.handleStatusUpdate", error, {
        interviewId,
        status,
      });
      toast.error(
        getDisplayErrorMessage(error, "Failed to update interview status."),
      );
    }
  };

  const handleSelectionChange = (interviewId: string, checked: boolean) => {
    setSelectedInterviewIds((current) =>
      checked
        ? current.filter((item) => item !== interviewId)
        : [...current, interviewId],
    );
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Interviews"
        title="Interview operations"
        description="Recruiting workflow, funnel visibility, bulk edits, and manual intervention all live here instead of being buried in one giant dashboard."
        action={
          canScheduleInterviews ? (
            <Button asChild>
              <a href="/schedule">Schedule interview</a>
            </Button>
          ) : null
        }
      />

      {!adminDashboard ? (
        <WorkspaceSkeleton />
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            <MetricCard
              label="Throughput"
              value={adminDashboard.analytics.throughput}
            />
            <MetricCard
              label="Time to hire"
              value={`${adminDashboard.analytics.timeToHireDays}d`}
            />
            <MetricCard
              label="Cancellations"
              value={adminDashboard.analytics.cancellations}
            />
            <MetricCard
              label="No shows"
              value={adminDashboard.analytics.noShows}
            />
            <MetricCard
              label="Feedback pending"
              value={adminDashboard.analytics.feedbackPending}
            />
          </div>

          <section className="grid gap-4 xl:grid-cols-[1.8fr_1fr]">
            <Card className="border-border/70 bg-card/80 shadow-sm">
              <CardHeader>
                <CardTitle>Pipeline workspace</CardTitle>
                <CardDescription>
                  Filter the pipeline, queue bulk actions, and move completed
                  interviews to pass or reject.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <PipelineFilters
                  bulkAction={bulkAction}
                  bulkInterviewerId={bulkInterviewerId}
                  canEditInterviews={canEditInterviews}
                  interviewerOptions={interviewerOptions}
                  search={search}
                  selectedInterviewCount={selectedInterviewIds.length}
                  stage={stage}
                  onBulkActionChange={setBulkAction}
                  onBulkInterviewerChange={setBulkInterviewerId}
                  onRunBulkAction={handleBulkAction}
                  onSearchChange={setSearch}
                  onStageChange={setStage}
                />
                {isFetching ? (
                  <div className="space-y-3 py-2">
                    {Array.from({ length: 4 }).map((_, i) => (
                      <div
                        key={i}
                        className="rounded-2xl border border-border/70 bg-background/70 p-4">
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="min-w-0 flex-1 space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <Skeleton className="h-4 w-4 rounded-sm" />
                              <Skeleton className="h-4 w-28" />
                              <Skeleton className="h-6 w-20 rounded-full" />
                              <Skeleton className="h-6 w-24 rounded-full" />
                            </div>
                            <Skeleton className="h-4 w-40" />
                            <Skeleton className="h-4 w-full max-w-md" />
                            <Skeleton className="h-4 w-36" />
                          </div>
                          <div className="flex shrink-0 flex-wrap gap-2">
                            <Skeleton className="h-9 w-36 rounded-md" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <PipelineInterviewList
                    canEditInterviews={canEditInterviews}
                    interviews={adminDashboard.pipeline}
                    role={role}
                    selectedInterviewIds={selectedInterviewIds}
                    onSelectionChange={handleSelectionChange}
                    onStatusUpdate={handleStatusUpdate}
                  />
                )}
              </CardContent>
            </Card>

            <div className="space-y-4">
              <HiringFunnelCard analytics={adminDashboard.analytics} />

              {canEditInterviews ? (
                <ManualOverrideCard
                  interviews={adminDashboard.pipeline}
                  overrideInterviewId={overrideInterviewId}
                  overrideReason={overrideReason}
                  overrideStatus={overrideStatus}
                  onApply={handleManualOverride}
                  onInterviewChange={setOverrideInterviewId}
                  onReasonChange={setOverrideReason}
                  onStatusChange={setOverrideStatus}
                />
              ) : null}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

export default function ProtectedInterviewsWorkspacePage() {
  return (
    <RoleGuard
      allowedRoles={["interviewer", "recruiter", "admin"]}
      title="Interview workspace restricted"
      message="Only interview staff can access interview operations.">
      <InterviewsWorkspacePage />
    </RoleGuard>
  );
}
