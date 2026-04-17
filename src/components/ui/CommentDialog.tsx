import { useState } from "react";
import { Id } from "../../../convex/_generated/dataModel";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import toast from "react-hot-toast";
import { MessageSquareIcon, StarIcon } from "lucide-react";
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

function CommentDialog({ interviewId }: { interviewId: Id<"interviews"> }) {
  const [isOpen, setIsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);

  const addComment = useMutation(api.comments.addComment);
  const users = useQuery(api.users.getUsers, {});
  const existingComments = useQuery(api.comments.getComments, { interviewId });

  const handleSubmit = async () => {
    if (!comment.trim()) return toast.error("Please enter comment");
    if (rating === 0) return toast.error("Please select a rating");

    try {
      await addComment({
        interviewId,
        content: comment.trim(),
        rating,
      });

      toast.success("Comment submitted");
      setComment("");
      setRating(0);
      setIsOpen(false);
    } catch (error) {
      logError("CommentDialog.handleSubmit", error, { interviewId });
      toast.error(
        getDisplayErrorMessage(error, "Failed to submit comment."),
      );
    }
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((starValue) => (
        <StarIcon
          key={starValue}
          className={`h-4 w-4 ${starValue <= rating ? "fill-primary text-primary" : "text-muted-foreground"}`}
        />
      ))}
    </div>
  );

  if (existingComments === undefined || users === undefined) return null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="secondary" className="w-full">
          <MessageSquareIcon className="h-4 w-4 mr-2" />
          Add Comment
          {existingComments && existingComments.length > 0 && (
            <p>({existingComments.length})</p>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Interview Comment</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {existingComments.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">Previous Comments</h4>
                <Badge variant="outline">
                  {existingComments.length} Comment
                  {existingComments.length !== 1 ? "s" : ""}
                </Badge>
              </div>

              <ScrollArea className="h-[240px]">
                <div className="space-y-4">
                  {existingComments.map((comment, index) => {
                    const interviewer = getInterviewerInfo(
                      users,
                      comment.interviewerId,
                    );
                    return (
                      <div
                        key={index}
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
                                {format(
                                  comment._creationTime,
                                  "MMM d, yyyy • h:mm a",
                                )}
                              </p>
                            </div>
                          </div>
                          {renderStars(comment.rating)}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {comment.content}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </ScrollArea>
            </div>
          )}

          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((starValue) => (
                  <StarIcon
                    key={starValue}
                    className={`h-6 w-6 cursor-pointer transition-colors ${
                      starValue <= (hoveredStar || rating)
                        ? "fill-primary text-primary"
                        : "text-muted-foreground"
                    }`}
                    onMouseEnter={() => setHoveredStar(starValue)}
                    onMouseLeave={() => setHoveredStar(0)}
                    onClick={() => setRating(starValue)}
                  />
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Your Comment</Label>
              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Share your detailed comment about the candidate..."
                className="h-32"
              />
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setIsOpen(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit}>Submit</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
export default CommentDialog;
