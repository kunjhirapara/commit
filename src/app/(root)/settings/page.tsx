"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";
import LoaderUI from "@/components/ui/LoaderUI";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { COMMON_TIMEZONES } from "@/constants";
import { getDisplayErrorMessage, logError } from "@/lib/errors";

const RECORDING_JURISDICTIONS = [
  { value: "global", label: "Global baseline" },
  { value: "eu-eea", label: "EU / EEA" },
  { value: "uk", label: "United Kingdom" },
  { value: "us-ca", label: "California / United States" },
  { value: "india", label: "India" },
] as const;

export default function SettingsPage() {
  const preferences = useQuery(api.notifications.getMyNotificationPreferences, {});
  const compliance = useQuery(api.compliance.getMyComplianceStatus, {});
  const updatePreferences = useMutation(api.notifications.updateMyNotificationPreferences);
  const acknowledgePolicy = useMutation(api.compliance.acknowledgePolicy);
  const requestDataOperation = useMutation(api.compliance.requestDataOperation);
  const logSensitiveAccess = useMutation(api.compliance.logSensitiveAccess);
  const [gdprReason, setGdprReason] = useState("");
  const [recordingJurisdiction, setRecordingJurisdiction] = useState("global");
  const [selectedExportRequestId, setSelectedExportRequestId] =
    useState<Id<"gdprRequests"> | null>(null);
  const selectedExportPayload = useQuery(
    api.compliance.getMyDataExport,
    selectedExportRequestId ? { requestId: selectedExportRequestId } : "skip",
  );

  if (!preferences || !compliance) return <LoaderUI />;

  const acknowledgementsByDocument = new Map(
    compliance.acknowledgements.map((acknowledgement) => [
      acknowledgement.documentType,
      acknowledgement,
    ]),
  );

  const handlePreferenceToggle = async (
    next: Partial<typeof preferences>,
  ) => {
    try {
      await updatePreferences({
        emailEnabled: next.emailEnabled ?? preferences.emailEnabled,
        inAppEnabled: next.inAppEnabled ?? preferences.inAppEnabled,
        interviewScheduleEmails:
          next.interviewScheduleEmails ?? preferences.interviewScheduleEmails,
        interviewReminderEmails:
          next.interviewReminderEmails ?? preferences.interviewReminderEmails,
        feedbackReminderEmails:
          next.feedbackReminderEmails ?? preferences.feedbackReminderEmails,
        complianceEmails: next.complianceEmails ?? preferences.complianceEmails,
        optOutAll: next.optOutAll ?? preferences.optOutAll,
        timezone: next.timezone ?? preferences.timezone,
      });
      toast.success("Notification preferences updated.");
    } catch (error) {
      logError("SettingsPage.handlePreferenceToggle", error);
      toast.error(getDisplayErrorMessage(error, "Could not update preferences."));
    }
  };

  const handleAcknowledge = async (documentType: "terms" | "privacy" | "recording") => {
    try {
      await acknowledgePolicy({
        documentType,
        version: compliance.currentVersions[documentType],
        jurisdiction: documentType === "recording" ? recordingJurisdiction : "global",
      });
      toast.success(`${documentType} acknowledged.`);
    } catch (error) {
      logError("SettingsPage.handleAcknowledge", error, { documentType });
      toast.error(getDisplayErrorMessage(error, "Could not save acknowledgement."));
    }
  };

  const handleDataRequest = async (type: "export" | "delete") => {
    try {
      await requestDataOperation({
        type,
        reason: gdprReason.trim() || undefined,
      });
      setGdprReason("");
      toast.success(`Data ${type} request submitted.`);
    } catch (error) {
      logError("SettingsPage.handleDataRequest", error, { type });
      toast.error(getDisplayErrorMessage(error, "Could not submit data request."));
    }
  };

  const handleViewExport = async (requestId: Id<"gdprRequests">) => {
    try {
      await logSensitiveAccess({
        accessType: "candidate_data_export.view",
        targetType: "gdprRequest",
        targetId: String(requestId),
        justification: "Candidate reviewed their completed export package from settings.",
      });
      setSelectedExportRequestId(requestId);
    } catch (error) {
      logError("SettingsPage.handleViewExport", error, { requestId });
      toast.error(getDisplayErrorMessage(error, "Could not open the export package."));
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold">Settings and Compliance</h1>
        <p className="mt-1 text-muted-foreground">
          Manage notification preferences, policy acknowledgements, and personal data requests.
        </p>
      </div>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Notification Preferences</CardTitle>
            <CardDescription>
              Choose which interview, reminder, and compliance updates should reach you.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PreferenceRow
              label="Opt out of all notifications"
              description="Suppresses all email and in-app notifications."
              checked={preferences.optOutAll}
              onCheckedChange={(value) => handlePreferenceToggle({ optOutAll: value })}
            />
            <PreferenceRow
              label="Email notifications"
              description="Enable simulated email delivery tracking for important updates."
              checked={preferences.emailEnabled}
              onCheckedChange={(value) => handlePreferenceToggle({ emailEnabled: value })}
            />
            <PreferenceRow
              label="In-app notifications"
              description="Show interview and compliance updates inside the app."
              checked={preferences.inAppEnabled}
              onCheckedChange={(value) => handlePreferenceToggle({ inAppEnabled: value })}
            />
            <PreferenceRow
              label="Schedule and change emails"
              description="Scheduling, rescheduling, and cancellation notices."
              checked={preferences.interviewScheduleEmails}
              onCheckedChange={(value) =>
                handlePreferenceToggle({ interviewScheduleEmails: value })
              }
            />
            <PreferenceRow
              label="Interview reminder emails"
              description="Timezone-aware reminders before the interview starts."
              checked={preferences.interviewReminderEmails}
              onCheckedChange={(value) =>
                handlePreferenceToggle({ interviewReminderEmails: value })
              }
            />
            <PreferenceRow
              label="Feedback reminder emails"
              description="Pending scorecard reminders for interviewers."
              checked={preferences.feedbackReminderEmails}
              onCheckedChange={(value) =>
                handlePreferenceToggle({ feedbackReminderEmails: value })
              }
            />
            <PreferenceRow
              label="Compliance emails"
              description="Policy, privacy, and data-rights communications."
              checked={preferences.complianceEmails}
              onCheckedChange={(value) =>
                handlePreferenceToggle({ complianceEmails: value })
              }
            />
            <div className="space-y-2">
              <Label>Preferred timezone</Label>
              <Select
                value={preferences.timezone ?? "UTC"}
                onValueChange={(timezone) =>
                  void handlePreferenceToggle({ timezone })
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select timezone" />
                </SelectTrigger>
                <SelectContent>
                  {COMMON_TIMEZONES.map((timezone) => (
                    <SelectItem key={timezone} value={timezone}>
                      {timezone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Policies and Consent</CardTitle>
            <CardDescription>
              Review the current policy versions and record your acknowledgement.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <PolicyRow
              label="Terms of Service"
              version={compliance.currentVersions.terms}
              href="/terms"
              acknowledgement={acknowledgementsByDocument.get("terms")}
              onAcknowledge={() => handleAcknowledge("terms")}
            />
            <PolicyRow
              label="Privacy Policy"
              version={compliance.currentVersions.privacy}
              href="/privacy"
              acknowledgement={acknowledgementsByDocument.get("privacy")}
              onAcknowledge={() => handleAcknowledge("privacy")}
            />
            <PolicyRow
              label="Recording Disclosure"
              version={compliance.currentVersions.recording}
              href="/recording-disclosure"
              acknowledgement={acknowledgementsByDocument.get("recording")}
              onAcknowledge={() => handleAcknowledge("recording")}
            />
            <div className="space-y-2 rounded-xl border p-4">
              <Label>Recording jurisdiction</Label>
              <Select
                value={recordingJurisdiction}
                onValueChange={setRecordingJurisdiction}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select jurisdiction" />
                </SelectTrigger>
                <SelectContent>
                  {RECORDING_JURISDICTIONS.map((item) => (
                    <SelectItem key={item.value} value={item.value}>
                      {item.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-sm text-muted-foreground">
                This stores which disclosure context the acknowledgement was captured under. It is
                product support, not legal advice.
              </p>
            </div>
            <div className="rounded-lg border border-dashed p-4 text-sm text-muted-foreground">
              Current acknowledgements: {compliance.acknowledgements.length}
            </div>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>Data Rights</CardTitle>
          <CardDescription>
            Submit export or deletion requests for your personal data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Textarea
            value={gdprReason}
            onChange={(event) => setGdprReason(event.target.value)}
            placeholder="Optional reason or extra details"
          />
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => handleDataRequest("export")}>Request Data Export</Button>
            <Button variant="destructive" onClick={() => handleDataRequest("delete")}>
              Request Data Deletion
            </Button>
          </div>
          <div className="space-y-3">
            {compliance.gdprRequests.map((request: any) => (
              <div key={String(request._id)} className="rounded-lg border p-4 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <span className="font-medium capitalize">{request.type} request</span>
                  <span className="text-muted-foreground">{request.status}</span>
                </div>
                <p className="mt-1 text-muted-foreground">
                  Submitted {new Date(request.createdAt).toLocaleString()}
                </p>
                {request.type === "export" && request.hasExportPayload ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3"
                    onClick={() => handleViewExport(request._id)}
                  >
                    View export package
                  </Button>
                ) : null}
              </div>
            ))}
            {selectedExportRequestId && selectedExportPayload ? (
              <div className="rounded-lg border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-medium">Export package</p>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedExportRequestId(null)}
                  >
                    Hide
                  </Button>
                </div>
                <pre className="mt-3 overflow-x-auto rounded-lg bg-background p-3 text-xs">
                  {JSON.stringify(selectedExportPayload, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function PreferenceRow({
  label,
  description,
  checked,
  onCheckedChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-border/70 bg-card/60 px-5 py-4">
      <div className="min-w-0 flex-1 space-y-1">
        <p className="font-medium">{label}</p>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch
        checked={checked}
        onCheckedChange={onCheckedChange}
        className="ml-2 flex-none"
      />
    </div>
  );
}

function PolicyRow({
  label,
  version,
  href,
  acknowledgement,
  onAcknowledge,
}: {
  label: string;
  version: string;
  href: string;
  acknowledgement?: {
    acceptedAt: number;
    jurisdiction?: string;
    version: string;
  };
  onAcknowledge: () => void;
}) {
  return (
    <div className="rounded-xl border p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-sm text-muted-foreground">Current version: {version}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {acknowledgement
              ? `Acknowledged ${new Date(acknowledgement.acceptedAt).toLocaleString()}${acknowledgement.jurisdiction ? ` · ${acknowledgement.jurisdiction}` : ""}`
              : "Not yet acknowledged"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={href}>Review</Link>
          </Button>
          <Button onClick={onAcknowledge}>Acknowledge</Button>
        </div>
      </div>
    </div>
  );
}
