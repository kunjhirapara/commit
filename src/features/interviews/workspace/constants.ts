export const BULK_ACTIONS = [
  { value: "mark_scheduled", label: "Mark scheduled" },
  { value: "mark_completed", label: "Mark completed" },
  { value: "mark_cancelled", label: "Mark cancelled" },
  { value: "assign_interviewer", label: "Assign interviewer" },
] as const;

export const STAGE_FILTERS = [
  "all",
  "draft",
  "scheduled",
  "live",
  "completed",
  "cancelled",
  "no_show",
  "rescheduled",
  "passed",
  "rejected",
] as const;

export const MANUAL_OVERRIDE_STATUSES = [
  { value: "draft", label: "Draft" },
  { value: "scheduled", label: "Scheduled" },
  { value: "live", label: "Live" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
  { value: "no_show", label: "No Show" },
  { value: "rescheduled", label: "Rescheduled" },
  { value: "passed", label: "Passed" },
  { value: "rejected", label: "Rejected" },
  { value: "upcoming", label: "Upcoming" },
  { value: "succeeded", label: "Succeeded" },
  { value: "failed", label: "Failed" },
] as const;
