import { format } from "date-fns";
import CommentDialog from "@/components/ui/CommentDialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DashboardInterview } from "./types";

type PipelineInterviewListProps = {
  canEditInterviews: boolean;
  interviews: DashboardInterview[];
  role?: string;
  selectedInterviewIds: string[];
  onSelectionChange: (interviewId: string, checked: boolean) => void;
  onStatusUpdate: (
    interviewId: DashboardInterview["_id"],
    status: "passed" | "rejected",
  ) => void;
};

export function PipelineInterviewList({
  canEditInterviews,
  interviews,
  role,
  selectedInterviewIds,
  onSelectionChange,
  onStatusUpdate,
}: PipelineInterviewListProps) {
  return (
    <div className="space-y-3">
      {interviews.map((interview) => {
        const checked = selectedInterviewIds.includes(String(interview._id));

        return (
          <div
            key={String(interview._id)}
            className="rounded-2xl border border-border/70 bg-background/70 p-4"
          >
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  {canEditInterviews ? (
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        onSelectionChange(String(interview._id), checked)
                      }
                    />
                  ) : null}
                  <p className="font-medium">{interview.candidateName}</p>
                  <Badge variant="outline">{interview.normalizedStatus}</Badge>
                  <Badge variant="secondary">{interview.templateLabel}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{interview.title}</p>
                <p className="text-sm text-muted-foreground">
                  {interview.interviewerNames} ·{" "}
                  {format(new Date(interview.startTime), "PPp")}
                </p>
                <p className="text-sm text-muted-foreground">
                  Feedback completion: {interview.feedbackCompletion}%
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {interview.normalizedStatus === "completed" ? (
                  <>
                    <Button size="sm" onClick={() => onStatusUpdate(interview._id, "passed")}>
                      Pass
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => onStatusUpdate(interview._id, "rejected")}
                    >
                      Reject
                    </Button>
                  </>
                ) : null}
                {role === "interviewer" || role === "recruiter" || role === "admin" ? (
                  <CommentDialog interviewId={interview._id} />
                ) : null}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
