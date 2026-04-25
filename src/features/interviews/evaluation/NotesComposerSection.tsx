import { MessageSquareIcon } from "lucide-react";
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
import { NOTE_VISIBILITY } from "./constants";
import type { NoteVisibility } from "./types";

type NotesComposerSectionProps = {
  comment: string;
  commentVisibility: NoteVisibility;
  editingCommentId: string | null;
  rating: number;
  onCancelEdit: () => void;
  onCommentChange: (value: string) => void;
  onRatingChange: (value: number) => void;
  onSubmit: () => void;
  onVisibilityChange: (value: NoteVisibility) => void;
};

export function NotesComposerSection({
  comment,
  commentVisibility,
  editingCommentId,
  rating,
  onCancelEdit,
  onCommentChange,
  onRatingChange,
  onSubmit,
  onVisibilityChange,
}: NotesComposerSectionProps) {
  return (
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
          <Select value={commentVisibility} onValueChange={onVisibilityChange}>
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
            onChange={(event) => onRatingChange(Number(event.target.value || 1))}
            className="w-24"
          />
        </div>
      </div>

      <Textarea
        value={comment}
        onChange={(event) => onCommentChange(event.target.value)}
        placeholder="Capture evidence, candidate signals, or follow-up points."
        className="min-h-28"
      />

      <div className="flex gap-2">
        <Button onClick={onSubmit}>
          <MessageSquareIcon className="mr-2 h-4 w-4" />
          {editingCommentId ? "Update Note" : "Add Note"}
        </Button>
        {editingCommentId ? (
          <Button variant="outline" onClick={onCancelEdit}>
            Cancel Edit
          </Button>
        ) : null}
      </div>
    </div>
  );
}
