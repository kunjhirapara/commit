import { PencilIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInterviewerInfo } from "@/lib/utils";
import { getCommentTimestampDetails, formatInterviewTimestamp, renderStars } from "./utils";
import type { CommentEntry, NoteVisibility, UserEntry } from "./types";

type CommentHistoryPanelProps = {
  comments: CommentEntry[];
  users: UserEntry[];
  onEdit: (entry: CommentEntry) => void;
};

export function CommentHistoryPanel({
  comments,
  users,
  onEdit,
}: CommentHistoryPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Comment History</h4>
        <Badge variant="outline">
          {comments.length} note{comments.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <ScrollArea className="h-[250px] rounded-lg border">
        <div className="space-y-3 p-3">
          {comments.length ? (
            comments.map((entry) => {
              const interviewer = getInterviewerInfo(users, entry.interviewerId);
              const { commentTimestamp, wasEdited } = getCommentTimestampDetails(
                entry.updatedAt,
                entry._creationTime,
              );

              return (
                <div key={entry._id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={interviewer.image} />
                        <AvatarFallback>{interviewer.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{interviewer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatInterviewTimestamp(commentTimestamp)}
                          {wasEdited ? " • edited" : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {(entry.visibility ?? "shared") as NoteVisibility}
                      </Badge>
                      {renderStars(entry.rating)}
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground">{entry.content}</p>
                  <Button variant="ghost" size="sm" onClick={() => onEdit(entry)}>
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
  );
}
