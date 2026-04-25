"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import LoaderUI from "@/components/ui/LoaderUI";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { COMMON_TIMEZONES } from "@/constants";
import { getDisplayErrorMessage, logError } from "@/lib/errors";

export default function SettingsPage() {
  const preferences = useQuery(
    api.notifications.getMyNotificationPreferences,
    {},
  );
  const updatePreferences = useMutation(
    api.notifications.updateMyNotificationPreferences,
  );

  if (!preferences) return <LoaderUI />;

  const handlePreferenceToggle = async (next: Partial<typeof preferences>) => {
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

        optOutAll: next.optOutAll ?? preferences.optOutAll,
        timezone: next.timezone ?? preferences.timezone,
      });
      toast.success("Notification preferences updated.");
    } catch (error) {
      logError("SettingsPage.handlePreferenceToggle", error);
      toast.error(
        getDisplayErrorMessage(error, "Could not update preferences."),
      );
    }
  };

  return (
    <div className="container mx-auto max-w-5xl space-y-8 py-10">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Manage notification preferences.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>
            Choose which interview and reminder updates should
            reach you.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-2 py-4">
            <Label>Preferred timezone</Label>
            <Select
              value={preferences.timezone ?? "UTC"}
              onValueChange={(timezone) =>
                void handlePreferenceToggle({ timezone })
              }>
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
          <PreferenceRow
            label="Opt out of all notifications"
            description="Suppresses all email and in-app notifications."
            checked={preferences.optOutAll}
            onCheckedChange={(value) =>
              handlePreferenceToggle({ optOutAll: value })
            }
          />
          <PreferenceRow
            label="Email notifications"
            description="Enable simulated email delivery tracking for important updates."
            checked={preferences.emailEnabled}
            onCheckedChange={(value) =>
              handlePreferenceToggle({ emailEnabled: value })
            }
          />
          <PreferenceRow
            label="In-app notifications"
            description="Show interview updates inside the app."
            checked={preferences.inAppEnabled}
            onCheckedChange={(value) =>
              handlePreferenceToggle({ inAppEnabled: value })
            }
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
