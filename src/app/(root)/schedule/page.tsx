"use client";

import RoleGuard from "@/components/auth/RoleGuard";
import InterviewScheduleUI from "./InterviewScheduleUI";

function SchedulePage() {
  return (
    <RoleGuard
      allowedRoles={["recruiter", "admin"]}
      title="Scheduling restricted"
      message="Only recruiters and admins can schedule interviews.">
      <InterviewScheduleUI />
    </RoleGuard>
  );
}
export default SchedulePage;
