import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { MANUAL_OVERRIDE_STATUSES } from "./constants";
import type { DashboardInterview, OverrideStatus } from "./types";

type ManualOverrideCardProps = {
  interviews: DashboardInterview[];
  overrideInterviewId: string;
  overrideReason: string;
  overrideStatus: OverrideStatus;
  onApply: () => void;
  onInterviewChange: (value: string) => void;
  onReasonChange: (value: string) => void;
  onStatusChange: (value: OverrideStatus) => void;
};

export function ManualOverrideCard({
  interviews,
  overrideInterviewId,
  overrideReason,
  overrideStatus,
  onApply,
  onInterviewChange,
  onReasonChange,
  onStatusChange,
}: ManualOverrideCardProps) {
  return (
    <Card className="border-border/70 bg-card/80 shadow-sm">
      <CardHeader>
        <CardTitle>Manual override</CardTitle>
        <CardDescription>
          Repair stuck interview states when the workflow needs operator help.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {interviews.length > 0 && (
          <Select value={overrideInterviewId} onValueChange={onInterviewChange}>
            <SelectTrigger>
              <SelectValue placeholder="Choose interview" />
            </SelectTrigger>
            <SelectContent>
              {interviews.map((interview) => (
                <SelectItem key={String(interview._id)} value={String(interview._id)}>
                  {interview.candidateName} · {interview.title}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Select
          value={overrideStatus}
          onValueChange={(value) => onStatusChange(value as OverrideStatus)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Target status" />
          </SelectTrigger>
          <SelectContent>
            {MANUAL_OVERRIDE_STATUSES.map((status) => (
              <SelectItem key={status.value} value={status.value}>
                {status.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Textarea
          value={overrideReason}
          onChange={(event) => onReasonChange(event.target.value)}
          placeholder="Reason for override"
        />
        <Button onClick={onApply}>Apply override</Button>
      </CardContent>
    </Card>
  );
}
