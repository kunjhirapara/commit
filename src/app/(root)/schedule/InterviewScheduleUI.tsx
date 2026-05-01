import { useStreamVideoClient } from "@stream-io/video-react-sdk";
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { api } from "../../../../convex/_generated/api";
import { Doc } from "../../../../convex/_generated/dataModel";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import UserInfo from "@/components/ui/UserInfo";
import { Loader2Icon, XIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  COMMON_TIMEZONES,
  DEFAULT_BUFFER_MINUTES,
  INTERVIEW_TEMPLATES,
  TIME_SLOTS,
} from "@/constants";
import MeetingCard from "@/components/ui/MeetingCard";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useLifecycleAutomation } from "@/hooks/useLifecycleAutomation";
import { getInterviewStartTimeMs, getInterviewTimezone } from "@/lib/utils";

type Interview = Doc<"interviews">;

const getDefaultTimezone = () =>
  Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";

function InterviewScheduleUI() {
  const client = useStreamVideoClient();
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [isManaging, setIsManaging] = useState(false);
  const [selectedInterview, setSelectedInterview] = useState<Interview | null>(
    null,
  );

  useLifecycleAutomation();

  const interviews = useQuery(api.interviews.getAllInterviews, {});
  const users = useQuery(api.users.getUsers, {});
  const createInterview = useMutation(api.interviews.createInterview);
  const reportProvisioningFailure = useMutation(
    api.reliability.reportProviderProvisioningFailure,
  );
  const rescheduleInterview = useMutation(api.interviews.rescheduleInterview);
  const cancelInterview = useMutation(api.interviews.cancelInterview);

  const candidates = users?.filter((u) => u.role === "candidate") ?? [];
  const interviewers =
    users?.filter(
      (u) =>
        u.role === "interviewer" ||
        u.role === "recruiter" ||
        u.role === "admin",
    ) ?? [];

  const defaultTemplate = INTERVIEW_TEMPLATES[0];
  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    templateId: string;
    durationMinutes: number;
    timezone: string;
    date: Date;
    time: string;
    candidateId: string;
    interviewerIds: string[];
    meetingInstructions: string;
    brandName: string;
    browserFallbackInstructions: string;
    bufferBeforeMinutes: number;
    bufferAfterMinutes: number;
  }>({
    title: "",
    description: "",
    templateId: defaultTemplate.id,
    durationMinutes: defaultTemplate.durationMinutes,
    timezone: getDefaultTimezone(),
    date: new Date(),
    time: "09:00",
    candidateId: "",
    interviewerIds: [] as string[],
    meetingInstructions: defaultTemplate.instructions,
    brandName: "Commit",
    browserFallbackInstructions:
      "If video fails, refresh once and rejoin from a laptop or desktop Chrome browser.",
    bufferBeforeMinutes: DEFAULT_BUFFER_MINUTES.before,
    bufferAfterMinutes: DEFAULT_BUFFER_MINUTES.after,
  });
  const [manageData, setManageData] = useState<{
    date: Date;
    time: string;
    timezone: string;
    reason: string;
    cancellationReason: string;
  }>({
    date: new Date(),
    time: "09:00",
    timezone: getDefaultTimezone(),
    reason: "",
    cancellationReason: "",
  });

  const selectedTemplate =
    INTERVIEW_TEMPLATES.find(
      (template) => template.id === formData.templateId,
    ) ?? defaultTemplate;

  const scheduleMeeting = async () => {
    if (!client) return;
    if (!formData.candidateId || formData.interviewerIds.length === 0) {
      toast.error(
        "Please select both a candidate and at least one interviewer.",
      );
      return;
    }

    setIsCreating(true);

    try {
      const {
        title,
        description,
        date,
        time,
        candidateId,
        interviewerIds,
        durationMinutes,
        timezone,
        meetingInstructions,
        brandName,
        browserFallbackInstructions,
        bufferBeforeMinutes,
        bufferAfterMinutes,
      } = formData;
      const [hours, minutes] = time.split(":");
      const meetingDate = new Date(date);
      meetingDate.setHours(parseInt(hours), parseInt(minutes, 0));

      const id = crypto.randomUUID();
      let streamCallId = id;
      let nextStatus: "scheduled" | "draft" = "scheduled";

      try {
        const call = client.call("default", id);

        await call.getOrCreate({
          data: {
            starts_at: meetingDate.toISOString(),
            custom: {
              description: title,
              additionalDetails: description,
            },
          },
        });
      } catch (providerError) {
        logError(
          "InterviewScheduleUI.scheduleMeeting.provider",
          providerError,
          {
            candidateId,
            interviewerCount: interviewerIds.length,
          },
        );
        nextStatus = "draft";
        streamCallId = `pending-${id}`;
        await reportProvisioningFailure({
          scope: "interview_provider_provisioning",
          summary:
            "Interview created in draft mode because Stream call provisioning failed.",
          detail:
            providerError instanceof Error
              ? providerError.message
              : "Unknown provider provisioning failure.",
          externalId: id,
        });
      }

      try {
        await createInterview({
          title,
          description,
          templateId: selectedTemplate.id,
          templateLabel: selectedTemplate.label,
          scheduledStartTime: meetingDate.getTime(),
          durationMinutes,
          timezone,
          status: nextStatus,
          streamCallId,
          candidateId,
          interviewerIds,
          meetingInstructions,
          brandName,
          browserFallbackInstructions,
          bufferBeforeMinutes,
          bufferAfterMinutes,
        });
      } catch (dbError) {
        await reportProvisioningFailure({
          scope: "interview_database_write",
          summary:
            "Interview call was provisioned but the database write failed.",
          detail:
            dbError instanceof Error
              ? dbError.message
              : "Unknown interview persistence failure.",
          externalId: id,
        });
        throw dbError;
      }
      setOpen(false);
      toast.success(
        nextStatus === "scheduled"
          ? "Interview scheduled successfully!"
          : "Provider was unavailable, so the interview was saved as a draft for recovery.",
      );

      setFormData({
        title: "",
        description: "",
        templateId: defaultTemplate.id,
        durationMinutes: defaultTemplate.durationMinutes,
        timezone: getDefaultTimezone(),
        date: new Date(),
        time: "09:00",
        candidateId: "",
        interviewerIds: [],
        meetingInstructions: defaultTemplate.instructions,
        brandName: "Commit",
        browserFallbackInstructions:
          "If video fails, refresh once and rejoin from a laptop or desktop Chrome browser.",
        bufferBeforeMinutes: DEFAULT_BUFFER_MINUTES.before,
        bufferAfterMinutes: DEFAULT_BUFFER_MINUTES.after,
      });
    } catch (error) {
      logError("InterviewScheduleUI.scheduleMeeting", error, {
        candidateId: formData.candidateId,
        interviewerCount: formData.interviewerIds.length,
      });
      toast.error(
        getDisplayErrorMessage(
          error,
          "Failed to schedule the interview. Please try again.",
        ),
      );
    } finally {
      setIsCreating(false);
    }
  };

  const openManageDialog = (interview: Interview) => {
    const interviewDate = new Date(getInterviewStartTimeMs(interview));

    setSelectedInterview(interview);
    setManageData({
      date: interviewDate,
      time: `${String(interviewDate.getHours()).padStart(2, "0")}:${String(
        interviewDate.getMinutes(),
      ).padStart(2, "0")}`,
      timezone: getInterviewTimezone(interview),
      reason: "",
      cancellationReason: "",
    });
    setManageOpen(true);
  };

  const handleReschedule = async () => {
    if (!selectedInterview) return;

    setIsManaging(true);

    try {
      const [hours, minutes] = manageData.time.split(":");
      const nextDate = new Date(manageData.date);
      nextDate.setHours(parseInt(hours), parseInt(minutes, 0));

      await rescheduleInterview({
        interviewId: selectedInterview._id,
        scheduledStartTime: nextDate.getTime(),
        timezone: manageData.timezone,
        reason: manageData.reason || undefined,
      });

      toast.success("Interview rescheduled.");
      setManageOpen(false);
      setSelectedInterview(null);
    } catch (error) {
      logError("InterviewScheduleUI.handleReschedule", error, {
        interviewId: selectedInterview._id,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to reschedule interview."),
      );
    } finally {
      setIsManaging(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedInterview) return;

    setIsManaging(true);

    try {
      await cancelInterview({
        interviewId: selectedInterview._id,
        reason: manageData.cancellationReason || undefined,
      });
      toast.success("Interview cancelled.");
      setManageOpen(false);
      setSelectedInterview(null);
    } catch (error) {
      logError("InterviewScheduleUI.handleCancel", error, {
        interviewId: selectedInterview._id,
      });
      toast.error(getDisplayErrorMessage(error, "Unable to cancel interview."));
    } finally {
      setIsManaging(false);
    }
  };

  const addInterviewer = (interviewerId: string) => {
    if (!formData.interviewerIds.includes(interviewerId)) {
      setFormData((prev) => ({
        ...prev,
        interviewerIds: [...prev.interviewerIds, interviewerId],
      }));
    }
  };

  const removeInterviewer = (interviewerId: string) => {
    setFormData((prev) => ({
      ...prev,
      interviewerIds: prev.interviewerIds.filter((id) => id !== interviewerId),
    }));
  };

  const selectedInterviewers = interviewers.filter((i) =>
    formData.interviewerIds.includes(i.clerkId),
  );

  const availableInterviewers = interviewers.filter(
    (i) => !formData.interviewerIds.includes(i.clerkId),
  );

  return (
    <div className="container max-w-7xl mx-auto p-6 space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Interviews</h1>
          <p className="text-muted-foreground mt-1">
            Schedule and manage interviews
          </p>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="lg">Schedule Interview</Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px] h-[calc(100vh-200px)] overflow-auto">
            <DialogHeader>
              <DialogTitle>Schedule Interview</DialogTitle>
              <DialogDescription>
                Choose a template, timezone, and instructions so the candidate
                gets a clear and reliable interview experience.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Interview Template
                </label>
                <Select
                  value={formData.templateId}
                  onValueChange={(templateId) => {
                    const template =
                      INTERVIEW_TEMPLATES.find(
                        (item) => item.id === templateId,
                      ) ?? defaultTemplate;

                    setFormData((prev) => ({
                      ...prev,
                      templateId: template.id,
                      title: prev.title || `${template.label} Interview`,
                      description: prev.description || template.description,
                      durationMinutes: template.durationMinutes,
                      meetingInstructions: template.instructions,
                    }));
                  }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select template" />
                  </SelectTrigger>
                  <SelectContent>
                    {INTERVIEW_TEMPLATES.map((template) => (
                      <SelectItem key={template.id} value={template.id}>
                        {template.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Title</label>
                <Input
                  placeholder="Interview title"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Description</label>
                <Textarea
                  placeholder="Interview description"
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <Select
                    value={formData.timezone}
                    onValueChange={(timezone) =>
                      setFormData({ ...formData, timezone })
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">Duration</label>
                  <Select
                    value={String(formData.durationMinutes)}
                    onValueChange={(durationMinutes) =>
                      setFormData({
                        ...formData,
                        durationMinutes: parseInt(durationMinutes, 10),
                      })
                    }>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Duration" />
                    </SelectTrigger>
                    <SelectContent>
                      {[30, 45, 60, 75, 90].map((duration) => (
                        <SelectItem key={duration} value={String(duration)}>
                          {duration} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {candidates.length > 0 && (
                <div className="space-y-2">
                  <label className="text-sm font-medium">Candidate</label>
                  <Select
                    value={formData.candidateId}
                    onValueChange={(candidateId) =>
                      setFormData({ ...formData, candidateId })
                    }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select candidate" />
                    </SelectTrigger>
                    <SelectContent>
                      {candidates.map((candidate) => (
                        <SelectItem
                          key={candidate.clerkId}
                          value={candidate.clerkId}>
                          <UserInfo user={candidate} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-sm font-medium">Interviewers</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {selectedInterviewers.map((interviewer) => (
                    <div
                      key={interviewer.clerkId}
                      className="inline-flex items-center gap-2 bg-secondary px-2 py-1 rounded-md text-sm">
                      <UserInfo user={interviewer} />
                      <button
                        onClick={() => removeInterviewer(interviewer.clerkId)}
                        className="hover:text-destructive transition-colors">
                        <XIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
                {availableInterviewers.length > 0 && (
                  <Select onValueChange={addInterviewer}>
                    <SelectTrigger>
                      <SelectValue placeholder="Add interviewer" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableInterviewers.map((interviewer) => (
                        <SelectItem
                          key={interviewer.clerkId}
                          value={interviewer.clerkId}>
                          <UserInfo user={interviewer} />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buffer Before</label>
                  <Select
                    value={String(formData.bufferBeforeMinutes)}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        bufferBeforeMinutes: parseInt(value, 10),
                      })
                    }>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Buffer before" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 10, 15, 20, 30].map((minutes) => (
                        <SelectItem key={minutes} value={String(minutes)}>
                          {minutes} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buffer After</label>
                  <Select
                    value={String(formData.bufferAfterMinutes)}
                    onValueChange={(value) =>
                      setFormData({
                        ...formData,
                        bufferAfterMinutes: parseInt(value, 10),
                      })
                    }>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Buffer after" />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 10, 15, 20, 30].map((minutes) => (
                        <SelectItem key={minutes} value={String(minutes)}>
                          {minutes} minutes
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Date</label>
                  <Calendar
                    mode="single"
                    selected={formData.date}
                    onSelect={(date) =>
                      date && setFormData({ ...formData, date })
                    }
                    disabled={(date) => date < new Date()}
                    className="rounded-md border"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Time</label>
                  <Select
                    value={formData.time}
                    onValueChange={(time) =>
                      setFormData({ ...formData, time })
                    }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Brand Name</label>
                <Input
                  placeholder="Company or team name"
                  value={formData.brandName}
                  onChange={(event) =>
                    setFormData({ ...formData, brandName: event.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Meeting Instructions
                </label>
                <Textarea
                  value={formData.meetingInstructions}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      meetingInstructions: event.target.value,
                    })
                  }
                  rows={3}
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">
                  Browser Fallback Guidance
                </label>
                <Textarea
                  value={formData.browserFallbackInstructions}
                  onChange={(event) =>
                    setFormData({
                      ...formData,
                      browserFallbackInstructions: event.target.value,
                    })
                  }
                  rows={2}
                />
              </div>
              <div className="flex justify-end gap-3 pt-4">
                <Button variant="outline" onClick={() => setOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={scheduleMeeting} disabled={isCreating}>
                  {isCreating ? (
                    <>
                      <Loader2Icon className="mr-2 size-4 animate-spin" />
                      Scheduling...
                    </>
                  ) : (
                    "Schedule Interview"
                  )}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {interviews === undefined ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 p-4">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="space-y-3">
              <div className="rounded-xl border bg-card p-4 space-y-3 animate-pulse">
                {/* Header row */}
                <div className="flex items-center justify-between">
                  <div className="h-4 w-1/2 rounded bg-muted" />
                  <div className="h-5 w-16 rounded-full bg-muted" />
                </div>
                {/* Meta lines */}
                <div className="space-y-2">
                  <div className="h-3 w-3/4 rounded bg-muted" />
                  <div className="h-3 w-1/2 rounded bg-muted" />
                </div>
                {/* Avatar row */}
                <div className="flex gap-2 pt-1">
                  <div className="h-8 w-8 rounded-full bg-muted" />
                  <div className="h-8 w-8 rounded-full bg-muted" />
                </div>
              </div>
              {/* Skeleton for the Manage Lifecycle button */}
              <div className="h-9 w-full rounded-md bg-muted animate-pulse" />
            </div>
          ))}
        </div>
      ) : interviews.length > 0 ? (
        <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 p-4">
            {interviews.map((interview) => (
              <div key={interview._id} className="space-y-3">
                <MeetingCard interview={interview} />
                {["draft", "scheduled", "rescheduled", "live"].includes(
                  interview.status,
                ) ? (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => openManageDialog(interview)}>
                    Manage Lifecycle
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          No interviews scheduled
        </div>
      )}

      <Dialog open={manageOpen} onOpenChange={setManageOpen}>
        <DialogContent className="sm:max-w-[520px]">
          <DialogHeader>
            <DialogTitle>Manage Interview Lifecycle</DialogTitle>
            <DialogDescription>
              Reschedule this interview or cancel it with a clear reason for the
              candidate and interview team.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <label className="text-sm font-medium">New Date</label>
                <Calendar
                  mode="single"
                  selected={manageData.date}
                  onSelect={(date) =>
                    date && setManageData({ ...manageData, date })
                  }
                  disabled={(date) => date < new Date()}
                  className="rounded-md border"
                />
              </div>
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">New Time</label>
                  <Select
                    value={manageData.time}
                    onValueChange={(time) =>
                      setManageData({ ...manageData, time })
                    }>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select time" />
                    </SelectTrigger>
                    <SelectContent>
                      {TIME_SLOTS.map((time) => (
                        <SelectItem key={time} value={time}>
                          {time}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Timezone</label>
                  <Select
                    value={manageData.timezone}
                    onValueChange={(timezone) =>
                      setManageData({ ...manageData, timezone })
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
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    Reschedule Reason
                  </label>
                  <Textarea
                    value={manageData.reason}
                    onChange={(event) =>
                      setManageData({
                        ...manageData,
                        reason: event.target.value,
                      })
                    }
                    placeholder="Explain the reschedule for attendees."
                    rows={3}
                  />
                </div>
              </div>
            </div>
            <div className="space-y-2 border-t pt-4">
              <label className="text-sm font-medium">Cancellation Reason</label>
              <Textarea
                value={manageData.cancellationReason}
                onChange={(event) =>
                  setManageData({
                    ...manageData,
                    cancellationReason: event.target.value,
                  })
                }
                placeholder="Only fill this in if you need to cancel the interview."
                rows={2}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              <Button variant="outline" onClick={() => setManageOpen(false)}>
                Close
              </Button>
              <Button
                variant="outline"
                onClick={handleReschedule}
                disabled={isManaging}>
                Reschedule
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancel}
                disabled={isManaging}>
                Cancel Interview
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InterviewScheduleUI;
