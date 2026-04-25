"use client";

import { useMutation, useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  MetricCard,
} from "@/components/dashboard/DashboardPrimitives";
import LoaderUI from "@/components/ui/LoaderUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../../../convex/_generated/api";
import { toast } from "sonner";

function ComplianceWorkspacePage() {
  const governance = useQuery(api.compliance.getGovernanceDashboard, {});
  const resolveGdprRequest = useMutation(api.compliance.resolveGdprRequest);

  if (!governance) return <LoaderUI />;

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Compliance"
        title="Governance and data oversight"
        description="Sensitive data access, GDPR resolution, and policy acknowledgements now sit on a dedicated admin-only page."
      />

      <div className="grid gap-4 md:grid-cols-3">
        <MetricCard label="Terms acknowledgements" value={governance.policySummary.terms} />
        <MetricCard label="Privacy acknowledgements" value={governance.policySummary.privacy} />
        <MetricCard label="Recording acknowledgements" value={governance.policySummary.recording} />
      </div>

      <section className="grid gap-4 xl:grid-cols-2">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>GDPR requests</CardTitle>
            <CardDescription>
              Review incoming data requests and move them through resolution.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {governance.gdprRequests.map((request) => (
              <div
                key={String(request._id)}
                className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">{request.type}</span>
                  <Badge>{request.status}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {request.reason || "No extra detail provided."}
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={async () => {
                      await resolveGdprRequest({
                        requestId: request._id,
                        status: "in_review",
                      });
                      toast.success("Request moved to review.");
                    }}
                  >
                    Mark in review
                  </Button>
                  <Button
                    size="sm"
                    onClick={async () => {
                      await resolveGdprRequest({
                        requestId: request._id,
                        status: "completed",
                        resolution: "Resolved from compliance workspace.",
                      });
                      toast.success("Request completed.");
                    }}
                  >
                    Complete
                  </Button>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Sensitive access logs</CardTitle>
            <CardDescription>
              Audit who accessed which sensitive records and why.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {governance.accessLogs.map((log) => (
              <div
                key={String(log._id)}
                className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium">{log.accessType}</span>
                  <Badge variant="outline">{log.actorRole}</Badge>
                </div>
                <p className="mt-2 text-muted-foreground">
                  {log.targetType} {log.targetId ? `· ${log.targetId}` : ""}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {log.justification || "No justification recorded."}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      </section>

      <Card className="border-border/70 bg-card/80 shadow-sm">
        <CardHeader>
          <CardTitle>Deployment change log</CardTitle>
          <CardDescription>
            Governance visibility into proposed, approved, and deployed production changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {governance.deployments.map((deployment) => (
            <div
              key={String(deployment._id)}
              className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
            >
              <div className="flex items-center justify-between gap-3">
                <span className="font-medium">{deployment.title}</span>
                <Badge variant="outline">{deployment.status}</Badge>
              </div>
              <p className="mt-2 text-muted-foreground">{deployment.summary}</p>
              <p className="mt-1 text-muted-foreground">
                {deployment.environment} · {new Date(deployment.updatedAt).toLocaleString()}
              </p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

export default function ProtectedComplianceWorkspacePage() {
  return (
    <RoleGuard
      requiredPermissions={["manageCompliance"]}
      title="Compliance workspace restricted"
      message="You need compliance management access to review governance controls."
    >
      <ComplianceWorkspacePage />
    </RoleGuard>
  );
}
