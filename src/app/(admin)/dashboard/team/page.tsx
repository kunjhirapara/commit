"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { useMutation, useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  SectionIntro,
} from "@/components/dashboard/DashboardPrimitives";
import AccessManagementPanel from "@/components/ui/AccessManagementPanel";
import LoaderUI from "@/components/ui/LoaderUI";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../../../../convex/_generated/api";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useUserRole } from "@/hooks/useUserRole";
import { toast } from "sonner";

const splitCsv = (value: string) =>
  value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

function TeamWorkspacePage() {
  const { canManageRoles } = useUserRole();
  const [selectedCandidateId, setSelectedCandidateId] = useState("");
  const [selectedInterviewerId, setSelectedInterviewerId] = useState("");
  const [skillDraft, setSkillDraft] = useState("");
  const [availabilityDraft, setAvailabilityDraft] = useState("");
  const [permissionDraft, setPermissionDraft] = useState("");

  const adminDashboard = useQuery(api.admin.getAdminDashboard, {});
  const candidateHistory = useQuery(
    api.admin.getCandidateHistory,
    selectedCandidateId ? { candidateId: selectedCandidateId } : "skip",
  );
  const updateInterviewerProfile = useMutation(api.admin.updateInterviewerProfile);


  useEffect(() => {
    if (!selectedInterviewerId || !adminDashboard?.interviewerRoster) return;
    const interviewer = adminDashboard.interviewerRoster.find(
      (item) => item.clerkId === selectedInterviewerId,
    );
    if (!interviewer) return;
    setSkillDraft(interviewer.skills.join(", "));
    setAvailabilityDraft(interviewer.availabilitySummary);
    setPermissionDraft(interviewer.permissionTags.join(", "));
  }, [adminDashboard?.interviewerRoster, selectedInterviewerId]);

  const candidateOptions = useMemo(
    () => adminDashboard?.candidates ?? [],
    [adminDashboard?.candidates],
  );
  const interviewerOptions = useMemo(
    () => adminDashboard?.interviewerRoster ?? [],
    [adminDashboard?.interviewerRoster],
  );


  const handleInterviewerUpdate = async () => {
    if (!selectedInterviewerId) {
      toast.error("Choose an interviewer first.");
      return;
    }

    try {
      await updateInterviewerProfile({
        clerkId: selectedInterviewerId,
        skills: splitCsv(skillDraft),
        availabilitySummary: availabilityDraft.trim(),
        permissionTags: splitCsv(permissionDraft),
        isActive: true,
      });
      toast.success("Interviewer profile updated.");
    } catch (error) {
      logError("TeamWorkspacePage.handleInterviewerUpdate", error, {
        selectedInterviewerId,
      });
      toast.error(getDisplayErrorMessage(error, "Could not update interviewer."));
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Team"
        title="People and access"
        description="This workspace separates team administration from the interview and developer surfaces, keeping access control and hiring support easier to manage."
      />

      <section className="space-y-4">
        <SectionIntro
          title="Access management"
          description="Create invitations, review pending access, and update team roles without crowding the rest of the dashboard."
        />
        <AccessManagementPanel />
      </section>

      {!adminDashboard ? (
        <div className="py-20 flex justify-center">
          <LoaderUI />
        </div>
      ) : (
        <section className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Candidate history</CardTitle>
            <CardDescription>
              Review interview rounds and feedback footprints for each candidate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {candidateOptions.length > 0 && (
              <Select value={selectedCandidateId} onValueChange={setSelectedCandidateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Choose a candidate" />
                </SelectTrigger>
                <SelectContent>
                  {candidateOptions.map((candidate) => (
                    <SelectItem key={candidate.clerkId} value={candidate.clerkId}>
                      {candidate.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <div className="grid gap-3 max-h-[600px] overflow-y-auto pr-2">
              {(candidateHistory ?? []).map((round) => (
                <div
                  key={String(round._id)}
                  className="rounded-2xl border border-border/70 bg-background/70 p-4 text-sm"
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-medium">{round.title}</span>
                    <StatusBadge status={round.normalizedStatus} />
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    {round.templateLabel} · {format(new Date(round.startTime), "PPp")}
                  </p>
                  <p className="mt-1 text-muted-foreground">
                    Feedback entries: {round.feedback.length}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {canManageRoles ? (
          <Card className="border-border/70 bg-card/80 shadow-sm">
            <CardHeader>
              <CardTitle>Interviewer management</CardTitle>
              <CardDescription>
                Keep interviewer skills, availability, and permission tags current.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {interviewerOptions.length > 0 && (
                <Select value={selectedInterviewerId} onValueChange={setSelectedInterviewerId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Choose interviewer" />
                  </SelectTrigger>
                  <SelectContent>
                    {interviewerOptions.map((interviewer) => (
                      <SelectItem key={interviewer.clerkId} value={interviewer.clerkId}>
                        {interviewer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Input
                value={skillDraft}
                onChange={(event) => setSkillDraft(event.target.value)}
                placeholder="Skills, comma separated"
              />
              <Textarea
                value={availabilityDraft}
                onChange={(event) => setAvailabilityDraft(event.target.value)}
                placeholder="Availability summary"
              />
              <Input
                value={permissionDraft}
                onChange={(event) => setPermissionDraft(event.target.value)}
                placeholder="Permission tags, comma separated"
              />
              <Button onClick={handleInterviewerUpdate}>Save interviewer profile</Button>
            </CardContent>
          </Card>
        ) : null}
      </section>
      )}
    </div>
  );
}

export default function ProtectedTeamWorkspacePage() {
  return (
    <RoleGuard
      allowedRoles={["recruiter", "admin"]}
      title="Team workspace restricted"
      message="Only recruiters and admins can access team management."
    >
      <TeamWorkspacePage />
    </RoleGuard>
  );
}
