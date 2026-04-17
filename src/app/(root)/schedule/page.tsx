"use client";

import LoaderUI from "@/components/ui/LoaderUI";
import { useUserRole } from "@/hooks/useUserRole";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import InterviewScheduleUI from "./InterviewScheduleUI";

function SchedulePage() {
  const router = useRouter();

  const { isInterviewer, isLoading } = useUserRole();

  useEffect(() => {
    if (!isLoading && !isInterviewer) {
      router.replace("/");
    }
  }, [isInterviewer, isLoading, router]);

  if (isLoading) return <LoaderUI />;
  if (!isInterviewer) return <LoaderUI />;

  return <InterviewScheduleUI />;
}
export default SchedulePage;
