"use client";

import { useDeferredValue, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  MetricCard,
} from "@/components/dashboard/DashboardPrimitives";
import LoaderUI from "@/components/ui/LoaderUI";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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

function InterviewsWorkspacePage() {
  useLifecycleAutomation();

  const { canEditInterviews, canScheduleInterviews, role } = useUserRole();
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState<string>("all");
  const [selectedInterviewIds, setSelectedInterviewIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkActionValue>("mark_completed");
  const [bulkInterviewerId, setBulkInterviewerId] = useState("");
  const [overrideInterviewId, setOverrideInterviewId] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<OverrideStatus>("scheduled");
  const [overrideReason, setOverrideReason] = useState("");
  const deferredSearch = useDeferredValue(search);

  const adminDashboard = useQuery(api.admin.getAdminDashboard, {
    search: deferredSearch || undefined,
    stage: stage === "all" ? undefined : stage,
  }) as
    | {
        analytics: DashboardAnalytics;
        interviewerRoster: InterviewerOption[];
        pipeline: DashboardInterview[];
      }
    | undefined;
  const bulkUpdateInterviews = useMutation(api.admin.bulkUpdateInterviews);
  const manualOverrideInterview = useMutation(api.admin.manualOverrideInterview);
  const updateStatus = useMutation(api.interviews.updateInterviewStatus);

  if (!adminDashboard) return <LoaderUI />;

  const interviewerOptions = adminDashboard.interviewerRoster ?? [];

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
          bulkAction === "assign_interviewer" ? bulkInterviewerId || undefined : undefined,
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

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <MetricCard label="Throughput" value={adminDashboard.analytics.throughput} />
        <MetricCard
          label="Time to hire"
          value={`${adminDashboard.analytics.timeToHireDays}d`}
        />
        <MetricCard
          label="Cancellations"
          value={adminDashboard.analytics.cancellations}
        />
        <MetricCard label="No shows" value={adminDashboard.analytics.noShows} />
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
              Filter the pipeline, queue bulk actions, and move completed interviews
              to pass or reject.
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
            <PipelineInterviewList
              canEditInterviews={canEditInterviews}
              interviews={adminDashboard.pipeline}
              role={role}
              selectedInterviewIds={selectedInterviewIds}
              onSelectionChange={handleSelectionChange}
              onStatusUpdate={handleStatusUpdate}
            />
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
    </div>
  );
}

export default function ProtectedInterviewsWorkspacePage() {
  return (
    <RoleGuard
      allowedRoles={["interviewer", "recruiter", "admin"]}
      title="Interview workspace restricted"
      message="Only interview staff can access interview operations."
    >
      <InterviewsWorkspacePage />
    </RoleGuard>
  );
}
