"use client";

import { Controller, type UseFormReturn } from "react-hook-form";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_DECISIONS, NOTE_VISIBILITY } from "./constants";
import type { FeedbackFormValues } from "./schema";
import type { MyFeedbackEntry } from "./types";

type StructuredScorecardSectionProps = {
  averageScore: string;
  feedbackState: "draft" | "submitted";
  form: UseFormReturn<FeedbackFormValues>;
  formCompetencies: FeedbackFormValues["competencies"];
  myFeedback: MyFeedbackEntry | null;
  onSaveDraft: () => void;
  onSubmitEvaluation: () => void;
};

export function StructuredScorecardSection({
  averageScore,
  feedbackState,
  form,
  formCompetencies,
  myFeedback,
  onSaveDraft,
  onSubmitEvaluation,
}: StructuredScorecardSectionProps) {
  return (
    <div className="rounded-lg border p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-medium">Structured Scorecard</h4>
          <p className="text-sm text-muted-foreground">
            Draft privately, then submit when your evaluation is complete.
          </p>
        </div>
        <StatusBadge status={feedbackState} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Recommendation</Label>
          <Controller
            control={form.control}
            name="recommendation"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FEEDBACK_DECISIONS.map((decision) => (
                    <SelectItem key={decision} value={decision}>
                      {decision}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.recommendation && (
            <p className="text-xs text-red-500">
              {form.formState.errors.recommendation.message}
            </p>
          )}
        </div>

        <div className="space-y-2">
          <Label>Visibility</Label>
          <Controller
            control={form.control}
            name="feedbackVisibility"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {NOTE_VISIBILITY.map((visibility) => (
                    <SelectItem key={visibility} value={visibility}>
                      {visibility}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {form.formState.errors.feedbackVisibility && (
            <p className="text-xs text-red-500">
              {form.formState.errors.feedbackVisibility.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Summary</Label>
        <Textarea
          {...form.register("summary")}
          placeholder="Summarize the interview outcome, strengths, and risks."
          className="min-h-24"
        />
        {form.formState.errors.summary && (
          <p className="text-xs text-red-500">
            {form.formState.errors.summary.message}
          </p>
        )}
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Competencies</Label>
          <Badge variant="outline">Weighted score: {averageScore}</Badge>
        </div>
        {formCompetencies?.map((competency, index) => (
          <div key={competency.key} className="rounded-lg border p-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">{competency.label}</p>
                <p className="text-xs text-muted-foreground">
                  Weight {competency.weight}
                </p>
              </div>
              <Input
                className="w-20"
                min={1}
                max={5}
                type="number"
                {...form.register(`competencies.${index}.score`, {
                  valueAsNumber: true,
                })}
              />
            </div>
            {form.formState.errors.competencies?.[index]?.score && (
              <p className="text-xs text-red-500">
                {form.formState.errors.competencies[index]?.score?.message}
              </p>
            )}
            <Textarea
              {...form.register(`competencies.${index}.notes`)}
              placeholder={`Evidence for ${competency.label.toLowerCase()}`}
              className="min-h-20"
            />
          </div>
        ))}
      </div>

      <div className="space-y-2">
        <Label>Shared Notes</Label>
        <Textarea
          {...form.register("sharedNotes")}
          placeholder="Visible to the hiring team once access rules allow it."
          className="min-h-20"
        />
      </div>

      <div className="space-y-2">
        <Label>Private Notes</Label>
        <Textarea
          {...form.register("privateNotes")}
          placeholder="Private notes for recruiter/admin review."
          className="min-h-20"
        />
      </div>

      <div className="space-y-2">
        <Label>Decision Summary</Label>
        <Textarea
          {...form.register("decisionSummary")}
          placeholder="Explain the pass/reject/hold/review recommendation."
          className="min-h-20"
        />
      </div>

      <Controller
        control={form.control}
        name="hideUntilSubmit"
        render={({ field }) => (
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Hide others until I submit</p>
              <p className="text-xs text-muted-foreground">
                Prevent other submitted interviewer feedback from appearing before
                you submit your own.
              </p>
            </div>
            <Button
              variant={field.value ? "default" : "outline"}
              size="sm"
              onClick={() => field.onChange(!field.value)}
            >
              {field.value ? "Enabled" : "Disabled"}
            </Button>
          </div>
        )}
      />

      {myFeedback?.dueAt ? (
        <p className="text-xs text-muted-foreground">
          Feedback due by {format(myFeedback.dueAt, "MMM d, yyyy • h:mm a")}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={onSaveDraft}>
          Save Draft
        </Button>
        <Button onClick={onSubmitEvaluation}>Submit Evaluation</Button>
      </div>
    </div>
  );
}
