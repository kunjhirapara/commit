"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  MetricCard,
  SectionIntro,
} from "@/components/dashboard/DashboardPrimitives";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../../../../convex/_generated/api";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { toast } from "sonner";

function DeveloperWorkspaceSkeleton() {
  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="rounded-[28px] border border-border/70 bg-card/80 p-6 shadow-sm">
        <div className="space-y-3">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-8 w-72" />
          <Skeleton className="h-4 w-full max-w-2xl" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i} className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader className="pb-2">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-8 w-16" />
            </CardHeader>
          </Card>
        ))}
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        {[1, 2].map((i) => (
          <Card key={i} className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader>
              <Skeleton className="h-6 w-44" />
              <Skeleton className="h-4 w-full max-w-xs" />
            </CardHeader>
            <CardContent className="space-y-3">
              {Array.from({ length: 5 }).map((__, item) => (
                <div
                  key={item}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4"
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
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-44" />
            <Skeleton className="h-4 w-full max-w-sm" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-6 w-36" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="w-full space-y-2">
                      <Skeleton className="h-4 w-24" />
                      <Skeleton className="h-4 w-28" />
                    </div>
                    <Skeleton className="h-6 w-20 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Skeleton className="h-6 w-32" />
              <Skeleton className="h-4 w-full max-w-md" />
            </div>
            <div className="space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4"
                >
                  <Skeleton className="h-4 w-40" />
                  <Skeleton className="mt-2 h-4 w-full" />
                  <Skeleton className="mt-3 h-8 w-28 rounded-md" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-full max-w-xs" />
          </CardHeader>
          <CardContent className="space-y-3">
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-full rounded-md" />
            <Skeleton className="h-10 w-32 rounded-md" />
            {Array.from({ length: 3 }).map((_, i) => (
              <div
                key={i}
                className="rounded-2xl border border-border/70 bg-background/70 p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="w-full space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                  <Skeleton className="h-6 w-20 rounded-full" />
                </div>
                <Skeleton className="mt-3 h-8 w-28 rounded-md" />
              </div>
            ))}
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function DeveloperWorkspacePage() {
  const [backupSummary, setBackupSummary] = useState("");
  const [backupLocation, setBackupLocation] = useState("");


  const monitoring = useQuery(api.observability.getMonitoringDashboard, {});
  const reliability = useQuery(api.reliability.getReliabilityDashboard, {});
  const notificationOps = useQuery(api.notifications.getNotificationOperationsDashboard, {});


  const captureHealthSnapshot = useMutation(api.observability.captureHealthSnapshot);
  const retryJob = useMutation(api.reliability.retryJob);
  const resolveRecoveryOperation = useMutation(api.reliability.resolveRecoveryOperation);
  const recordBackupSnapshot = useMutation(api.reliability.recordBackupSnapshot);
  const markBackupRestored = useMutation(api.reliability.markBackupRestored);
  const retryNotification = useMutation(api.notifications.retryNotification);


  useEffect(() => {
    void captureHealthSnapshot().catch(() => undefined);
  }, [captureHealthSnapshot]);

  const isLoading = !monitoring || !reliability || !notificationOps;

  const handleBackupRecord = async () => {
    if (!backupSummary.trim()) {
      toast.error("Add a backup summary first.");
      return;
    }

    try {
      await recordBackupSnapshot({
        kind: "manual",
        summary: backupSummary.trim(),
        scope: "interview-data",
        storageLocation: backupLocation.trim() || undefined,
      });
      setBackupSummary("");
      setBackupLocation("");
      toast.success("Backup record added.");
    } catch (error) {
      logError("DeveloperWorkspacePage.handleBackupRecord", error);
      toast.error(getDisplayErrorMessage(error, "Backup record failed."));
    }
  };


  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Developer"
        title="Engineering workspace"
        description="Observability, reliability, notification delivery, backups, and deployment changes now live in one role-specific area for developers and admins."
      />

      {isLoading ? (
        <DeveloperWorkspaceSkeleton />
      ) : (
        <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Critical events" value={monitoring.totals.criticalEvents} />
        <MetricCard label="Open recoveries" value={reliability.totals.openRecoveries} />
        <MetricCard label="Dead letters" value={reliability.totals.deadLetters} />
        <MetricCard label="Failed notifications" value={notificationOps.totals.failed} />
      </div>

      <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Observability</CardTitle>
            <CardDescription>
              Dependency health, recent telemetry, and operational alerts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[34rem] pr-3">
              <div className="space-y-4">
                <div className="grid gap-3 md:grid-cols-2">
                  {monitoring.healthChecks.map((check) => (
                    <div
                      key={`${check.provider}-${check.checkedAt}`}
                      className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium capitalize">{check.provider}</span>
                        <StatusBadge status={check.status} />
                      </div>
                      <p className="mt-2 text-muted-foreground">{check.message}</p>
                    </div>
                  ))}
                </div>
                <div className="space-y-3">
                  {monitoring.recentEvents.map((event) => (
                    <div
                      key={String(event._id)}
                      className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium">{event.scope}</span>
                        <StatusBadge status={event.level} />
                      </div>
                      <p className="mt-2 text-muted-foreground">{event.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Delivery operations</CardTitle>
            <CardDescription>
              Retry failed notification deliveries and review recent status.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[34rem] pr-3">
              <div className="space-y-3">
                {notificationOps.recentNotifications.slice(0, 10).map((notification) => (
                  <div
                    key={String(notification._id)}
                    className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{notification.title}</span>
                      <StatusBadge status={notification.status} />
                    </div>
                    <p className="mt-2 text-muted-foreground">{notification.message}</p>
                    {notification.status === "failed" ? (
                      <Button
                        size="sm"
                        className="mt-3"
                        onClick={async () => {
                          await retryNotification({ notificationId: notification._id });
                          toast.success("Notification delivery retried.");
                        }}
                      >
                        Retry delivery
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>

      <section className="grid gap-4 xl:grid-cols-[1.5fr_1fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Reliability and recovery</CardTitle>
            <CardDescription>
              Retry queues, background jobs, open recoveries, and backup tracking.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <SectionIntro
              title="Background jobs"
              description="Dead letters and queued tasks are grouped here for faster operator action."
            />
            <div className="grid gap-3 md:grid-cols-2">
              {reliability.jobs.slice(0, 8).map((job) => (
                <div
                  key={String(job._id)}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{job.kind}</span>
                    <StatusBadge status={job.status} />
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    Attempts {job.attemptCount}/{job.maxAttempts}
                  </p>
                  {job.status === "dead_letter" ? (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={async () => {
                        await retryJob({ jobId: job._id });
                        toast.success("Background job re-queued.");
                      }}
                    >
                      Retry job
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>

            <SectionIntro
              title="Open recoveries"
              description="Track manual incidents and close them from the same engineering surface."
            />
            <div className="grid gap-3">
              {reliability.recoveryOperations.length === 0 ? (
                <div className="rounded-2xl border border-dashed p-4 text-sm text-muted-foreground">
                  No open recovery operations.
                </div>
              ) : (
                reliability.recoveryOperations.map((operation) => (
                  <div
                    key={String(operation._id)}
                    className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{operation.summary}</span>
                      <StatusBadge status={operation.mode} />
                    </div>
                    <p className="mt-2 text-muted-foreground">{operation.detail}</p>
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={async () => {
                        await resolveRecoveryOperation({
                          operationId: operation._id,
                          resolution: "Resolved from developer workspace.",
                        });
                        toast.success("Recovery operation resolved.");
                      }}
                    >
                      Mark resolved
                    </Button>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Backup tracking</CardTitle>
            <CardDescription>
              Record snapshots and restore drills for disaster recovery.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              value={backupSummary}
              onChange={(event) => setBackupSummary(event.target.value)}
              placeholder="Backup summary"
            />
            <Input
              value={backupLocation}
              onChange={(event) => setBackupLocation(event.target.value)}
              placeholder="Storage location"
            />
            <Button onClick={handleBackupRecord}>Record backup</Button>
            <div className="space-y-3 pt-2">
              {reliability.backups.map((backup) => (
                <div
                  key={String(backup._id)}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{backup.summary}</span>
                    <StatusBadge status={backup.status} />
                  </div>
                  <p className="mt-2 text-muted-foreground">
                    {backup.storageLocation || "Location not documented"}
                  </p>
                  {backup.status === "available" ? (
                    <Button
                      size="sm"
                      className="mt-3"
                      onClick={async () => {
                        await markBackupRestored({
                          snapshotId: backup._id,
                          notes: "Restore drill completed from developer workspace.",
                        });
                        toast.success("Backup marked as restored.");
                      }}
                    >
                      Mark restored
                    </Button>
                  ) : null}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>


      </>
      )}
    </div>
  );
}

export default function ProtectedDeveloperWorkspacePage() {
  return (
    <RoleGuard
      allowedRoles={["developer", "admin"]}
      requiredPermissions={["viewObservability", "manageReliability"]}
      requireAllPermissions
      title="Developer workspace restricted"
      message="You need engineering operations permissions to access this workspace."
    >
      <DeveloperWorkspacePage />
    </RoleGuard>
  );
}
