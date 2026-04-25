import { Badge } from "@/components/ui/badge";
import { StatusBadge } from "@/components/ui/status-badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getInterviewerInfo } from "@/lib/utils";
import { formatInterviewTimestamp } from "./utils";
import type { FeedbackEntry, UserEntry } from "./types";

type FeedbackEntriesPanelProps = {
  feedbackEntries: FeedbackEntry[];
  users: UserEntry[];
};

export function FeedbackEntriesPanel({
  feedbackEntries,
  users,
}: FeedbackEntriesPanelProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium">Submitted Feedback</h4>
        <Badge variant="outline">{feedbackEntries.length} entries</Badge>
      </div>

      <ScrollArea className="h-[250px] rounded-lg border">
        <div className="space-y-3 p-3">
          {feedbackEntries.length ? (
            feedbackEntries.map((entry) => {
              const interviewer = getInterviewerInfo(users, entry.interviewerId);

              return (
                <div key={entry._id} className="rounded-lg border p-4 space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={interviewer.image} />
                        <AvatarFallback>{interviewer.initials}</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium">{interviewer.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {entry.submittedAt
                            ? formatInterviewTimestamp(entry.submittedAt)
                            : "Draft in progress"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <StatusBadge status={entry.state} />
                      <StatusBadge status={entry.recommendation} />
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Weighted score</span>
                    <span className="font-medium">{entry.weightedScore}</span>
                  </div>

                  <p className="text-sm text-muted-foreground">{entry.summary}</p>

                  {entry.hiddenUntilSubmit ? (
                    <p className="text-xs text-amber-700">
                      Full details will unlock after you submit your own feedback.
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
  );
}
