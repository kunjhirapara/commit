"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "convex/react";
import { FileTextIcon } from "lucide-react";
import { toast } from "sonner";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { CommentHistoryPanel } from "./CommentHistoryPanel";
import { FeedbackEntriesPanel } from "./FeedbackEntriesPanel";
import { NotesComposerSection } from "./NotesComposerSection";
import {
  feedbackSchema,
  getDefaultFeedbackValues,
  type FeedbackFormValues,
} from "./schema";
import { StructuredScorecardSection } from "./StructuredScorecardSection";
import type {
  CommentEntry,
  FeedbackEntry,
  MyFeedbackEntry,
  NoteVisibility,
  UserEntry,
} from "./types";
import { buildFeedbackFormValues, calculateAverageScore } from "./utils";

function CommentDialog({ interviewId }: { interviewId: Id<"interviews"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(4);
  const [commentVisibility, setCommentVisibility] =
    useState<NoteVisibility>("shared");
  const [editingCommentId, setEditingCommentId] =
    useState<Id<"comments"> | null>(null);
  const [feedbackState, setFeedbackState] = useState<"draft" | "submitted">(
    "draft",
  );

  const form = useForm<FeedbackFormValues>({
    resolver: zodResolver(feedbackSchema),
    defaultValues: getDefaultFeedbackValues(),
  });

  const addComment = useMutation(api.comments.addComment);
  const editComment = useMutation(api.comments.editComment);
  const saveFeedback = useMutation(api.feedback.saveFeedback);

  const users = useQuery(api.users.getUsers, {}) as UserEntry[] | undefined;
  const existingComments = useQuery(api.comments.getComments, {
    interviewId,
  }) as CommentEntry[] | undefined;
  const feedbackEntries = useQuery(api.feedback.getInterviewFeedback, {
    interviewId,
  }) as FeedbackEntry[] | undefined;
  const myFeedback = useQuery(api.feedback.getMyFeedback, {
    interviewId,
  }) as MyFeedbackEntry | null | undefined;

  useQuery(api.feedback.exportHiringPacket, isOpen ? { interviewId } : "skip");

  useEffect(() => {
    if (!myFeedback) return;

    setFeedbackState(myFeedback.state);
    form.reset(buildFeedbackFormValues(myFeedback));
  }, [form, myFeedback]);

  const formCompetencies = form.watch("competencies");
  const averageScore = useMemo(
    () => calculateAverageScore(formCompetencies),
    [formCompetencies],
  );

  const resetNoteComposer = () => {
    setEditingCommentId(null);
    setComment("");
    setRating(4);
    setCommentVisibility("shared");
  };

  const handleOpenChange = (open: boolean) => {
    if (!open && form.formState.isDirty) {
      if (
        !window.confirm(
          "You have unsaved changes. Are you sure you want to close?",
        )
      ) {
        return;
      }
      form.reset();
    }
    setIsOpen(open);
  };

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

      resetNoteComposer();
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

  const handleEditComment = (entry: CommentEntry) => {
    setEditingCommentId(entry._id);
    setComment(entry.content);
    setRating(entry.rating);
    setCommentVisibility((entry.visibility ?? "shared") as NoteVisibility);
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <FileTextIcon className="h-4 w-4 mr-2" />
          Evaluation & Notes
          {feedbackEntries && existingComments ? (
            <p>({feedbackEntries.length + existingComments.length})</p>
          ) : (
            <span className="w-4 h-4 ml-1 rounded-full animate-pulse bg-muted-foreground/20" />
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92vh] flex flex-col overflow-hidden sm:max-w-[1000px]">
        <DialogHeader>
          <DialogTitle>Evaluation Workflow</DialogTitle>
        </DialogHeader>

        {!existingComments || !users || !feedbackEntries ? (
          <div className="flex-1 flex gap-6 p-4">
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-[300px] w-full" />
            </div>
            <div className="flex-1 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-[300px] w-full" />
            </div>
          </div>
        ) : (
          <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr] flex-1 overflow-hidden">
            <div className="space-y-6 flex flex-col h-full overflow-y-auto pr-2 pb-4 self-start">
              <FeedbackEntriesPanel
                feedbackEntries={feedbackEntries}
                users={users}
              />
              <CommentHistoryPanel
                comments={existingComments}
                users={users}
                onEdit={handleEditComment}
              />
            </div>

            <div className="space-y-6 h-full overflow-y-auto pr-2 pb-4">
              <StructuredScorecardSection
                averageScore={averageScore}
                feedbackState={feedbackState}
                form={form}
                formCompetencies={formCompetencies}
                myFeedback={myFeedback ?? null}
                onSaveDraft={form.handleSubmit((data) =>
                  handleFeedbackSubmit(data, "draft"),
                )}
                onSubmitEvaluation={form.handleSubmit((data) =>
                  handleFeedbackSubmit(data, "submitted"),
                )}
              />
              <NotesComposerSection
                comment={comment}
                commentVisibility={commentVisibility}
                editingCommentId={editingCommentId}
                rating={rating}
                onCancelEdit={resetNoteComposer}
                onCommentChange={setComment}
                onRatingChange={setRating}
                onSubmit={handleNoteSubmit}
                onVisibilityChange={setCommentVisibility}
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default CommentDialog;
