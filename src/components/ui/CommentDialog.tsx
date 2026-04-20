import { useEffect, useMemo, useState } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { toast } from "sonner";
import {
  DownloadIcon,
  FileTextIcon,
  MessageSquareIcon,
  PencilIcon,
  StarIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./dialog";
import { Button } from "./button";
import { Badge } from "./badge";
import { ScrollArea } from "./scroll-area";
import { getInterviewerInfo } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "./avatar";
import { format } from "date-fns";
import { Label } from "./label";
import { Textarea } from "./textarea";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";
import { Input } from "./input";

const DEFAULT_COMPETENCIES = [
  { key: "communication", label: "Communication", weight: 1.2 },
  { key: "problem_solving", label: "Problem Solving", weight: 1.5 },
  { key: "technical_depth", label: "Technical Depth", weight: 1.8 },
  { key: "collaboration", label: "Collaboration", weight: 1 },
] as const;

type FeedbackCompetencyForm = {
  key: string;
  label: string;
  weight: number;
  score: number;
  notes: string;
};

const FEEDBACK_DECISIONS = ["pass", "reject", "hold", "review"] as const;
const NOTE_VISIBILITY = ["shared", "private"] as const;

const feedbackSchema = z.object({
  recommendation: z.enum(FEEDBACK_DECISIONS),
  feedbackVisibility: z.enum(NOTE_VISIBILITY),
  summary: z.string().min(5, "Summary must be at least 5 characters"),
  sharedNotes: z.string().optional(),
  privateNotes: z.string().optional(),
  decisionSummary: z.string().optional(),
  hideUntilSubmit: z.boolean(),
  competencies: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      weight: z.number(),
      score: z
        .number()
        .min(1, "Score must be between 1 and 5")
        .max(5, "Score must be between 1 and 5"),
      notes: z.string().optional(),
    }),
  ),
});

type FeedbackFormValues = z.infer<typeof feedbackSchema>;

function CommentDialog({ interviewId }: { interviewId: Id<"interviews"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(4);
  const [commentVisibility, setCommentVisibility] = useState<
    "shared" | "private"
  >("shared");
  const [editingCommentId, setEditingCommentId] =
    useState<Id<"comments"> | null>(null);
  const [feedbackState, setFeedbackState] = useState<"draft" | "submitted">(
    "draft",
  );

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: {
      recommendation: "review",
      feedbackVisibility: "shared",
      summary: "",
      sharedNotes: "",
      privateNotes: "",
      decisionSummary: "",
      hideUntilSubmit: true,
      competencies: DEFAULT_COMPETENCIES.map((competency) => ({
        ...competency,
        score: 3,
        notes: "",
      })),
    },
  });

  const addComment = useMutation(api.comments.addComment);
  const editComment = useMutation(api.comments.editComment);
  const saveFeedback = useMutation(api.feedback.saveFeedback);

  const users = useQuery(api.users.getUsers, {});
  const existingComments = useQuery(api.comments.getComments, { interviewId });
  const feedbackEntries = useQuery(api.feedback.getInterviewFeedback, {
    interviewId,
  });
  const myFeedback = useQuery(api.feedback.getMyFeedback, { interviewId });
  const hiringPacket = useQuery(
    api.feedback.exportHiringPacket,
    isOpen ? { interviewId } : "skip",
  );

  useEffect(() => {
    if (!myFeedback) return;

    setFeedbackState(myFeedback.state);

    form.reset({
      recommendation: myFeedback.recommendation,
      feedbackVisibility: myFeedback.visibility,
      summary: myFeedback.summary,
      sharedNotes: myFeedback.sharedNotes ?? "",
      privateNotes: myFeedback.privateNotes ?? "",
      decisionSummary: myFeedback.decisionSummary ?? "",
      hideUntilSubmit: myFeedback.hideUntilSubmit,
      competencies: myFeedback.competencies.length
        ? myFeedback.competencies.map((competency) => ({
            key: competency.key,
            label: competency.label,
            weight: competency.weight,
            score: competency.score,
            notes: competency.notes ?? "",
          }))
        : DEFAULT_COMPETENCIES.map((competency) => ({
            ...competency,
            score: 3,
            notes: "",
          })),
    });
  }, [myFeedback, form]);

  const formCompetencies = form.watch("competencies");

  const averageScore = useMemo(() => {
    if (!formCompetencies?.length) return 0;
    const weightedTotal = formCompetencies.reduce(
      (sum, competency) => sum + competency.score * competency.weight,
      0,
    );
    const totalWeight = formCompetencies.reduce(
      (sum, competency) => sum + competency.weight,
      0,
    );

    return totalWeight ? (weightedTotal / totalWeight).toFixed(2) : "0.00";
  }, [formCompetencies]);

  const handleNoteSubmit = async () => {
    if (!comment.trim()) return toast.error("Please enter a note.");

    try {
      if (editingCommentId) {
        await editComment({
          commentId: editingCommentId,
          content: comment.trim(),
          rating,
          visibility: commentVisibility,
        });
        toast.success("Note updated.");
      } else {
        await addComment({
          interviewId,
          content: comment.trim(),
          rating,
          visibility: commentVisibility,
        });
        toast.success("Note added.");
      }

      setComment("");
      setRating(4);
      setCommentVisibility("shared");
      setEditingCommentId(null);
    } catch (error) {
      logError("CommentDialog.handleNoteSubmit", error, { interviewId });
      toast.error(getDisplayErrorMessage(error, "Failed to save note."));
    }
  };

  const handleFeedbackSubmit = async (
    values: FeedbackFormValues,
    state: "draft" | "submitted",
  ) => {
    try {
      await saveFeedback({
        interviewId,
        state,
        visibility: values.feedbackVisibility,
        recommendation: values.recommendation,
        summary: values.summary,
        sharedNotes: values.sharedNotes || undefined,
        privateNotes: values.privateNotes || undefined,
        decisionSummary: values.decisionSummary || undefined,
        competencies: values.competencies.map((competency) => ({
          key: competency.key,
          label: competency.label,
          score: competency.score,
          weight: competency.weight,
          notes: competency.notes || undefined,
        })),
        hideUntilSubmit: values.hideUntilSubmit,
      });

      setFeedbackState(state);
      toast.success(
        state === "submitted" ? "Feedback submitted." : "Draft saved.",
      );
    } catch (error) {
      logError("CommentDialog.handleFeedbackSubmit", error, {
        interviewId,
        state,
      });
      toast.error(getDisplayErrorMessage(error, "Failed to save evaluation."));
    }
  };

  const renderStars = (value: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((starValue) => (
        <StarIcon
          key={starValue}
          className={`h-4 w-4 ${starValue <= value ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );

  if (
    existingComments === undefined ||
    users === undefined ||
    feedbackEntries === undefined
  )
    return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <FileTextIcon className="h-4 w-4 mr-2" />
          Evaluation & Notes
          <p>({feedbackEntries.length + existingComments.length})</p>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] flex flex-col overflow-hidden sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Evaluation Workflow</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] flex-1 overflow-hidden">
          <div className="space-y-6 flex flex-col h-full overflow-y-auto pr-2 pb-4 self-start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Submitted Feedback</h4>
                <Badge variant="outline">
                  {feedbackEntries.length} entries
                </Badge>
              </div>

              <ScrollArea className="h-[250px] rounded-lg border">
                <div className="space-y-3 p-3">
                  {feedbackEntries.length ? (
                    feedbackEntries.map((entry) => {
                      const interviewer = getInterviewerInfo(
                        users,
                        entry.interviewerId,
                      );

                      return (
                        <div
                          key={entry._id}
                          className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={interviewer.image} />
                                <AvatarFallback>
                                  {interviewer.initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {interviewer.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {entry.submittedAt
                                    ? format(
                                        entry.submittedAt,
                                        "MMM d, yyyy • h:mm a",
                                      )
                                    : "Draft in progress"}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{entry.state}</Badge>
                              <Badge variant="outline">
                                {entry.recommendation}
                              </Badge>
                            </div>
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">
                              Weighted score
                            </span>
                            <span className="font-medium">
                              {entry.weightedScore}
                            </span>
                          </div>

                          <p className="text-sm text-muted-foreground">
                            {entry.summary}
                          </p>

                          {"hiddenUntilSubmit" in entry &&
                          entry.hiddenUntilSubmit ? (
                            <p className="text-xs text-amber-700">
                              Full details will unlock after you submit your own
                              feedback.
                            </p>
                          ) : null}
                        </div>
                      );
                    })
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">
                      No feedback has been saved yet.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Comment History</h4>
                <Badge variant="outline">
                  {existingComments.length} note
                  {existingComments.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <ScrollArea className="h-[250px] rounded-lg border">
                <div className="space-y-3 p-3">
                  {existingComments.length ? (
                    existingComments.map((entry) => {
                      const interviewer = getInterviewerInfo(
                        users,
                        entry.interviewerId,
                      );
                      const commentTimestamp =
                        entry.updatedAt ?? entry._creationTime;
                      const wasEdited =
                        !!entry.updatedAt && entry.updatedAt > entry._creationTime;
                      return (
                        <div
                          key={entry._id}
                          className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Avatar className="h-8 w-8">
                                <AvatarImage src={interviewer.image} />
                                <AvatarFallback>
                                  {interviewer.initials}
                                </AvatarFallback>
                              </Avatar>
                              <div>
                                <p className="text-sm font-medium">
                                  {interviewer.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {format(commentTimestamp, "MMM d, yyyy • h:mm a")}
                                  {wasEdited ? " • edited" : ""}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">
                                {entry.visibility ?? "shared"}
                              </Badge>
                              {renderStars(entry.rating)}
                            </div>
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {entry.content}
                          </p>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingCommentId(entry._id);
                              setComment(entry.content);
                              setRating(entry.rating);
                              setCommentVisibility(
                                (entry.visibility ?? "shared") as
                                  | "shared"
                                  | "private",
                              );
                            }}>
                            <PencilIcon className="mr-2 h-4 w-4" />
                            Edit Note
                          </Button>
                        </div>
                      );
                    })
                  ) : (
                    <p className="p-3 text-sm text-muted-foreground">
                      Notes and feedback comments will appear here.
                    </p>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          <div className="space-y-6 h-full overflow-y-auto pr-2 pb-4">
            <div className="rounded-lg border p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-medium">Structured Scorecard</h4>
                  <p className="text-sm text-muted-foreground">
                    Draft privately, then submit when your evaluation is
                    complete.
                  </p>
                </div>
                <Badge
                  variant={
                    feedbackState === "submitted" ? "default" : "outline"
                  }>
                  {feedbackState}
                </Badge>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Recommendation</Label>
                  <Controller
                    control={form.control}
                    name="recommendation"
                    render={({ field }) => (
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}>
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
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}>
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
                  <Badge variant="outline">
                    Weighted score: {averageScore}
                  </Badge>
                </div>
                {formCompetencies?.map((competency, index) => (
                  <div
                    key={competency.key}
                    className="rounded-lg border p-3 space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {competency.label}
                        </p>
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
                        {
                          form.formState.errors.competencies[index]?.score
                            ?.message
                        }
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
                      <p className="text-sm font-medium">
                        Hide others until I submit
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Prevent other submitted interviewer feedback from
                        appearing before you submit your own.
                      </p>
                    </div>
                    <Button
                      variant={field.value ? "default" : "outline"}
                      size="sm"
                      onClick={() => field.onChange(!field.value)}>
                      {field.value ? "Enabled" : "Disabled"}
                    </Button>
                  </div>
                )}
              />

              {myFeedback?.dueAt ? (
                <p className="text-xs text-muted-foreground">
                  Feedback due by{" "}
                  {format(myFeedback.dueAt, "MMM d, yyyy • h:mm a")}
                </p>
              ) : null}

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={form.handleSubmit((data) =>
                    handleFeedbackSubmit(data, "draft"),
                  )}>
                  Save Draft
                </Button>
                <Button
                  onClick={form.handleSubmit((data) =>
                    handleFeedbackSubmit(data, "submitted"),
                  )}>
                  Submit Evaluation
                </Button>
              </div>
            </div>

            <div className="rounded-lg border p-4 space-y-4">
              <div>
                <h4 className="font-medium">Interview Notes</h4>
                <p className="text-sm text-muted-foreground">
                  Capture note history with author, timestamps, and visibility.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
                <div className="space-y-2">
                  <Label>Visibility</Label>
                  <Select
                    value={commentVisibility}
                    onValueChange={(value) =>
                      setCommentVisibility(value as typeof commentVisibility)
                    }>
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
                </div>
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <Input
                    type="number"
                    min={1}
                    max={5}
                    value={rating}
                    onChange={(event) =>
                      setRating(Number(event.target.value || 1))
                    }
                    className="w-24"
                  />
                </div>
              </div>

              <Textarea
                value={comment}
                onChange={(event) => setComment(event.target.value)}
                placeholder="Capture evidence, candidate signals, or follow-up points."
                className="min-h-28"
              />

              <div className="flex gap-2">
                <Button onClick={handleNoteSubmit}>
                  <MessageSquareIcon className="mr-2 h-4 w-4" />
                  {editingCommentId ? "Update Note" : "Add Note"}
                </Button>
                {editingCommentId ? (
                  <Button
                    variant="outline"
                    onClick={() => {
                      setEditingCommentId(null);
                      setComment("");
                      setRating(4);
                      setCommentVisibility("shared");
                    }}>
                    Cancel Edit
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CommentDialog;
