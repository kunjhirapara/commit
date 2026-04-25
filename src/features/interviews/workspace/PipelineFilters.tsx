import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { BULK_ACTIONS, STAGE_FILTERS } from "./constants";
import type { BulkActionValue, InterviewerOption } from "./types";

type PipelineFiltersProps = {
  bulkAction: BulkActionValue;
  bulkInterviewerId: string;
  canEditInterviews: boolean;
  interviewerOptions: InterviewerOption[];
  search: string;
  selectedInterviewCount: number;
  stage: string;
  onBulkActionChange: (value: BulkActionValue) => void;
  onBulkInterviewerChange: (value: string) => void;
  onRunBulkAction: () => void;
  onSearchChange: (value: string) => void;
  onStageChange: (value: string) => void;
};

export function PipelineFilters({
  bulkAction,
  bulkInterviewerId,
  canEditInterviews,
  interviewerOptions,
  search,
  selectedInterviewCount,
  stage,
  onBulkActionChange,
  onBulkInterviewerChange,
  onRunBulkAction,
  onSearchChange,
  onStageChange,
}: PipelineFiltersProps) {
  return (
    <>
      <div className="grid gap-3 md:grid-cols-3">
        <Input
          value={search}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Search candidate, interviewer, role"
        />
        <Select value={stage} onValueChange={onStageChange}>
          <SelectTrigger>
            <SelectValue placeholder="Stage" />
          </SelectTrigger>
          <SelectContent>
            {STAGE_FILTERS.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={bulkAction}
          onValueChange={(value) => onBulkActionChange(value as BulkActionValue)}
          disabled={!canEditInterviews}
        >
          <SelectTrigger>
            <SelectValue placeholder="Bulk action" />
          </SelectTrigger>
          <SelectContent>
            {BULK_ACTIONS.map((action) => (
              <SelectItem key={action.value} value={action.value}>
                {action.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {canEditInterviews && bulkAction === "assign_interviewer" ? (
        <Select value={bulkInterviewerId} onValueChange={onBulkInterviewerChange}>
          <SelectTrigger>
            <SelectValue placeholder="Assign interviewer" />
          </SelectTrigger>
          <SelectContent>
            {interviewerOptions.map((interviewer) => (
              <SelectItem key={interviewer.clerkId} value={interviewer.clerkId}>
                {interviewer.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : null}

      {canEditInterviews ? (
        <div className="flex flex-wrap items-center gap-3">
          <Button onClick={onRunBulkAction}>Run bulk action</Button>
          <span className="text-sm text-muted-foreground">
            {selectedInterviewCount} selected
          </span>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Interviewers can review and comment here, while recruiters and admins can
          apply bulk actions.
        </p>
      )}
    </>
  );
}
