import { Badge } from "./badge";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const s = status.toLowerCase();
  
  let colorClass = "bg-muted/50 text-muted-foreground border-border/50"; // default neutral

  if (["passed", "succeeded", "completed", "healthy", "available", "resolved", "deployed", "approved", "pass", "submitted", "sent", "accepted", "restored"].includes(s)) {
    colorClass = "bg-emerald-500/15 text-emerald-700 border-emerald-500/30 dark:text-emerald-400";
  } else if (["failed", "rejected", "cancelled", "no_show", "unhealthy", "error", "critical", "dead_letter", "rolled_back", "reject", "expired"].includes(s)) {
    colorClass = "bg-red-500/15 text-red-700 border-red-500/30 dark:text-red-400";
  } else if (["live", "running", "open", "shared"].includes(s)) {
    colorClass = "bg-sky-500/15 text-sky-700 border-sky-500/30 dark:text-sky-400";
  } else if (["scheduled", "upcoming", "rescheduled", "pending", "degraded", "warn", "queued", "proposed", "hold", "review", "draft", "private", "recruiter", "interviewer"].includes(s)) {
    colorClass = "bg-amber-500/15 text-amber-700 border-amber-500/30 dark:text-amber-400";
  } else if (["admin", "developer"].includes(s)) {
    colorClass = "bg-purple-500/15 text-purple-700 border-purple-500/30 dark:text-purple-400";
  }

  // Format the text: "no_show" -> "No Show"
  const formattedStatus = status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <Badge variant="outline" className={cn(colorClass, "font-medium capitalize", className)}>
      {formattedStatus}
    </Badge>
  );
}
