"use client";

import { useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
} from "@/components/dashboard/DashboardPrimitives";
import LoaderUI from "@/components/ui/LoaderUI";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "../../../../../convex/_generated/api";

function ComplianceWorkspacePage() {
  const governance = useQuery(api.compliance.getGovernanceDashboard, {});


  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Compliance"
        title="Governance and data oversight"
        description="Sensitive data access and deployment visibility now sit on a dedicated admin-only page."
      />

      {!governance ? (
        <div className="py-20 flex justify-center">
          <LoaderUI />
        </div>
      ) : (
        <>
      <section className="grid gap-4 xl:grid-cols-2">
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
      </>
      )}
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
