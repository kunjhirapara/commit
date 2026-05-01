"use client";

import { api } from "@/../convex/_generated/api";
import { Doc } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/status-badge";
import { Textarea } from "@/components/ui/textarea";
import { useUserRole } from "@/hooks/useUserRole";
import {
  cn,
  formatInterviewDateTime,
  getCalendarLinks,
  getCandidateInfo,
  getInterviewEndTimeMs,
  getInterviewStartTimeMs,
  getInterviewTimezone,
  getInterviewerInfo,
  getMeetingStatus,
} from "@/lib/utils";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { useMutation, useQuery } from "convex/react";
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
  subMonths,
} from "date-fns";
import {
  CalendarDaysIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  Clock3Icon,
  ExternalLinkIcon,
  UsersIcon,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

type Interview = Doc<"interviews">;
type User = Doc<"users">;
type CustomCalendarEvent = Doc<"customCalendarEvents">;
type SelectedCalendarItem =
  | { kind: "interview"; item: Interview }
  | { kind: "custom"; item: CustomCalendarEvent };
type CalendarEntry =
  | {
      kind: "interview";
      id: string;
      startTime: number;
      title: string;
      interview: Interview;
    }
  | {
      kind: "custom";
      id: string;
      startTime: number;
      title: string;
      customEvent: CustomCalendarEvent;
    };

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const statusPillClasses: Record<string, string> = {
  draft:
    "border-slate-300 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-300",
  scheduled:
    "border-blue-300 bg-blue-50 text-blue-700 dark:border-blue-500/40 dark:bg-blue-500/15 dark:text-blue-300",
  rescheduled:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300",
  live: "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  completed:
    "border-zinc-300 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300",
  passed:
    "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-300",
  rejected:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
  cancelled:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
  no_show:
    "border-red-300 bg-red-50 text-red-700 dark:border-red-500/40 dark:bg-red-500/15 dark:text-red-300",
};

function CalendarPageSkeleton() {
  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6 animate-in fade-in duration-300">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-72" />
          <Skeleton className="h-3 w-80" />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Skeleton className="h-10 w-full rounded-md sm:w-64" />
          <Skeleton className="h-10 w-24 rounded-md" />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-card p-4">
            <Skeleton className="h-4 w-28" />
            <Skeleton className="mt-2 h-8 w-20" />
          </div>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <Skeleton className="h-7 w-40" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-10 w-10 rounded-md" />
          </div>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground"
            >
              <Skeleton className="mx-auto h-3 w-8" />
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7">
          {Array.from({ length: 35 }).map((_, index) => (
            <div
              key={index}
              className="min-h-36 border-b border-r p-2 sm:min-h-40"
            >
              <div className="mb-2 flex items-center justify-between">
                <Skeleton className="h-7 w-7 rounded-full" />
                {index % 3 === 0 ? (
                  <Skeleton className="h-5 w-8 rounded-full" />
                ) : null}
              </div>
              <div className="space-y-1.5">
                {Array.from({ length: index % 4 === 0 ? 2 : 1 }).map((__, item) => (
                  <Skeleton key={item} className="h-12 w-full rounded-md" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function InterviewCalendarPage() {
  const { user, isLoading, hasPermission } = useUserRole();
  const canChooseUser = hasPermission("viewUsers");
  const users = useQuery(api.users.getUsers, canChooseUser ? {} : "skip") as
    | (User & { customRole?: unknown })[]
    | undefined;
  const [selectedUserId, setSelectedUserId] = useState<string | undefined>();
  const activeUserId = selectedUserId || user?.clerkId;
  const interviews = useQuery(
    api.interviews.getCalendarInterviewsForUser,
    activeUserId ? { userClerkId: activeUserId } : "skip",
  );
  const customEvents = useQuery(
    api.calendarEvents.getCalendarEventsForUser,
    activeUserId ? { userClerkId: activeUserId } : "skip",
  ) as CustomCalendarEvent[] | undefined;
  const createCalendarEvent = useMutation(
    api.calendarEvents.createCalendarEvent,
  );
  const [visibleMonth, setVisibleMonth] = useState(() =>
    startOfMonth(new Date()),
  );
  const [selectedItem, setSelectedItem] = useState<SelectedCalendarItem | null>(
    null,
  );
  const [createDialogDate, setCreateDialogDate] = useState<Date | null>(null);
  const [isCreatingEvent, setIsCreatingEvent] = useState(false);
  const [eventForm, setEventForm] = useState({
    title: "",
    description: "",
    date: "",
    startTime: "09:00",
    endTime: "10:00",
  });

  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(visibleMonth);
    const monthEnd = endOfMonth(visibleMonth);

    return eachDayOfInterval({
      start: startOfWeek(monthStart),
      end: endOfWeek(monthEnd),
    });
  }, [visibleMonth]);

  const eventsByDay = useMemo(() => {
    const grouped = new Map<string, CalendarEntry[]>();

    (interviews ?? []).forEach((interview) => {
      const key = format(
        new Date(getInterviewStartTimeMs(interview)),
        "yyyy-MM-dd",
      );
      const dayEvents = grouped.get(key) ?? [];
      grouped.set(key, [
        ...dayEvents,
        {
          kind: "interview",
          id: interview._id,
          startTime: getInterviewStartTimeMs(interview),
          title: interview.title,
          interview,
        },
      ]);
    });

    (customEvents ?? []).forEach((customEvent) => {
      const key = format(new Date(customEvent.startTime), "yyyy-MM-dd");
      const dayEvents = grouped.get(key) ?? [];
      grouped.set(key, [
        ...dayEvents,
        {
          kind: "custom",
          id: customEvent._id,
          startTime: customEvent.startTime,
          title: customEvent.title,
          customEvent,
        },
      ]);
    });

    grouped.forEach((dayEvents, key) => {
      grouped.set(
        key,
        [...dayEvents].sort((a, b) => a.startTime - b.startTime),
      );
    });

    return grouped;
  }, [customEvents, interviews]);

  const selectedUser = useMemo(
    () => users?.find((item) => item.clerkId === activeUserId),
    [activeUserId, users],
  );
  const userDirectory = useMemo(
    () => users ?? (user ? [user as User] : []),
    [user, users],
  );

  if (isLoading || !user) return <CalendarPageSkeleton />;

  const isLoadingInterviews = interviews === undefined;
  const isLoadingCustomEvents = customEvents === undefined;
  const monthLabel = format(visibleMonth, "MMMM yyyy");
  const totalEvents = (interviews?.length ?? 0) + (customEvents?.length ?? 0);
  const visibleMonthEvents = [
    ...(interviews ?? []).map(
      (interview) => new Date(getInterviewStartTimeMs(interview)),
    ),
    ...(customEvents ?? []).map(
      (customEvent) => new Date(customEvent.startTime),
    ),
  ].filter((eventDate) => isSameMonth(eventDate, visibleMonth)).length;
  const upcomingEvents = [
    ...(interviews ?? []).filter(
      (interview) => getInterviewStartTimeMs(interview) >= Date.now(),
    ),
    ...(customEvents ?? []).filter(
      (customEvent) => customEvent.startTime >= Date.now(),
    ),
  ].length;
  const selectedInterview =
    selectedItem?.kind === "interview" ? selectedItem.item : null;
  const selectedCustomEvent =
    selectedItem?.kind === "custom" ? selectedItem.item : null;
  const dialogCalendarLinks = selectedInterview
    ? getCalendarLinks(selectedInterview)
    : null;

  const openCreateDialog = (day: Date) => {
    setCreateDialogDate(day);
    setEventForm({
      title: "",
      description: "",
      date: format(day, "yyyy-MM-dd"),
      startTime: "09:00",
      endTime: "10:00",
    });
  };

  const buildLocalDate = (dateValue: string, timeValue: string) => {
    const [year, month, day] = dateValue.split("-").map(Number);
    const [hours, minutes] = timeValue.split(":").map(Number);
    return new Date(
      year,
      (month ?? 1) - 1,
      day ?? 1,
      hours ?? 0,
      minutes ?? 0,
      0,
      0,
    );
  };

  const handleCreateEvent = async () => {
    if (!activeUserId) return;

    try {
      setIsCreatingEvent(true);
      const start = buildLocalDate(eventForm.date, eventForm.startTime);
      const end = buildLocalDate(eventForm.date, eventForm.endTime);

      await createCalendarEvent({
        userClerkId: activeUserId,
        title: eventForm.title,
        description: eventForm.description || undefined,
        startTime: start.getTime(),
        endTime: end.getTime(),
      });

      toast.success("Custom event created.");
      setCreateDialogDate(null);
    } catch (error) {
      logError("InterviewCalendarPage.handleCreateEvent", error, {
        activeUserId,
        date: eventForm.date,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to create calendar event."),
      );
    } finally {
      setIsCreatingEvent(false);
    }
  };

  return (
    <div className="container mx-auto max-w-7xl space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <CalendarDaysIcon className="h-4 w-4" />
            Calendar
          </div>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            Interview calendar
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {canChooseUser
              ? `Showing events for ${selectedUser?.name ?? "selected user"}.`
              : "Showing your scheduled interview events."}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Double-click any day cell to add a custom calendar event.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {canChooseUser && users ? (
            <Select
              value={activeUserId}
              onValueChange={(value) => setSelectedUserId(value)}>
              <SelectTrigger className="w-full sm:w-64">
                <SelectValue placeholder="Select user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((item) => (
                  <SelectItem key={item.clerkId} value={item.clerkId}>
                    {item.name} - {item.role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : null}

          <Button
            variant="outline"
            onClick={() => setVisibleMonth(startOfMonth(new Date()))}>
            Today
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Events this month</p>
          <p className="mt-2 text-2xl font-semibold">{visibleMonthEvents}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Upcoming</p>
          <p className="mt-2 text-2xl font-semibold">{upcomingEvents}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <p className="text-sm text-muted-foreground">Current month</p>
          <p className="mt-2 text-2xl font-semibold">{monthLabel}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border bg-card">
        <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-semibold">{monthLabel}</h2>
            <p className="text-sm text-muted-foreground">
              {isLoadingInterviews || isLoadingCustomEvents
                ? "Loading events..."
                : `${totalEvents} user events`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setVisibleMonth((month) => subMonths(month, 1))}>
              <ChevronLeftIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              onClick={() => setVisibleMonth((month) => addMonths(month, 1))}>
              <ChevronRightIcon className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-7 border-b bg-muted/40">
          {WEEKDAYS.map((day) => (
            <div
              key={day}
              className="px-2 py-3 text-center text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-7">
          {calendarDays.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayEvents = eventsByDay.get(key) ?? [];
            const visibleEvents = dayEvents.slice(0, 3);
            const hiddenCount = dayEvents.length - visibleEvents.length;

            return (
              <div
                key={key}
                onDoubleClick={() => openCreateDialog(day)}
                className={cn(
                  "min-h-36 cursor-cell border-b border-r p-2 sm:min-h-40",
                  !isSameMonth(day, visibleMonth) &&
                    "bg-muted/25 text-muted-foreground",
                  createDialogDate &&
                    isSameDay(createDialogDate, day) &&
                    "bg-muted/40",
                )}>
                <div className="mb-2 flex items-center justify-between">
                  <span
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-full text-sm font-medium",
                      isToday(day) && "bg-primary text-primary-foreground",
                    )}>
                    {format(day, "d")}
                  </span>
                  {dayEvents.length ? (
                    <Badge variant="secondary">{dayEvents.length}</Badge>
                  ) : null}
                </div>

                <div className="space-y-1.5">
                  {visibleEvents.map((entry) => {
                    const status =
                      entry.kind === "interview"
                        ? getMeetingStatus(entry.interview)
                        : "custom";

                    return (
                      <button
                        key={entry.id}
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation();
                          setSelectedItem(
                            entry.kind === "interview"
                              ? { kind: "interview", item: entry.interview }
                              : { kind: "custom", item: entry.customEvent },
                          );
                        }}
                        className={cn(
                          "w-full rounded-md border px-2 py-1.5 text-left text-xs transition hover:shadow-sm",
                          entry.kind === "interview"
                            ? (statusPillClasses[status] ??
                                statusPillClasses.draft)
                            : "border-teal-300 bg-teal-50 text-teal-700 dark:border-teal-500/40 dark:bg-teal-500/15 dark:text-teal-200",
                        )}>
                        <span className="block truncate font-semibold">
                          {entry.title}
                        </span>
                        <span className="mt-0.5 block truncate opacity-80">
                          {format(new Date(entry.startTime), "h:mm a")}
                        </span>
                      </button>
                    );
                  })}
                  {hiddenCount > 0 ? (
                    <div className="w-full rounded-md border border-dashed px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/60">
                      +{hiddenCount} more
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <Dialog
        open={!!selectedItem}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedItem(null);
        }}>
        <DialogContent className="sm:max-w-lg pt-10">
          {selectedItem ? (
            <>
              <DialogHeader>
                <div className="flex items-center justify-between gap-3">
                  <DialogTitle>
                    {selectedInterview?.title ?? selectedCustomEvent?.title}
                  </DialogTitle>
                  {selectedInterview ? (
                    <StatusBadge status={getMeetingStatus(selectedInterview)} />
                  ) : (
                    <Badge variant="secondary">Custom</Badge>
                  )}
                </div>
                <DialogDescription>
                  {selectedInterview
                    ? formatInterviewDateTime(selectedInterview)
                    : selectedCustomEvent
                      ? format(
                          new Date(selectedCustomEvent.startTime),
                          "EEEE, MMMM d · h:mm a",
                        )
                      : ""}
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 text-sm">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-lg border p-3">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock3Icon className="h-4 w-4" />
                      Time
                    </div>
                    <p className="mt-2 font-medium">
                      {selectedInterview ? (
                        <>
                          {format(
                            new Date(
                              getInterviewStartTimeMs(selectedInterview),
                            ),
                            "h:mm a",
                          )}{" "}
                          -{" "}
                          {format(
                            new Date(getInterviewEndTimeMs(selectedInterview)),
                            "h:mm a",
                          )}
                        </>
                      ) : selectedCustomEvent ? (
                        <>
                          {format(
                            new Date(selectedCustomEvent.startTime),
                            "h:mm a",
                          )}{" "}
                          -{" "}
                          {format(
                            new Date(selectedCustomEvent.endTime),
                            "h:mm a",
                          )}
                        </>
                      ) : null}
                    </p>
                    <p className="text-muted-foreground">
                      {selectedInterview
                        ? getInterviewTimezone(selectedInterview)
                        : Intl.DateTimeFormat().resolvedOptions().timeZone}
                    </p>
                  </div>
                  {selectedInterview ? (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-4 w-4" />
                        Participants
                      </div>
                      <p className="mt-2 font-medium">
                        Candidate:{" "}
                        {
                          getCandidateInfo(
                            userDirectory,
                            selectedInterview.candidateId,
                          ).name
                        }
                      </p>
                      <p className="text-muted-foreground">
                        {selectedInterview.interviewerIds
                          .map(
                            (id) => getInterviewerInfo(userDirectory, id).name,
                          )
                          .join(", ")}
                      </p>
                    </div>
                  ) : (
                    <div className="rounded-lg border p-3">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <UsersIcon className="h-4 w-4" />
                        Event owner
                      </div>
                      <p className="mt-2 font-medium">
                        {selectedUser?.name ?? user.name}
                      </p>
                      <p className="text-muted-foreground">
                        Custom calendar event
                      </p>
                    </div>
                  )}
                </div>

                {selectedInterview?.description ||
                selectedCustomEvent?.description ? (
                  <p className="rounded-lg border bg-muted/30 p-3 text-muted-foreground">
                    {selectedInterview?.description ??
                      selectedCustomEvent?.description}
                  </p>
                ) : null}

                <div className="flex gap-2">
                  {dialogCalendarLinks ? (
                    <>
                      <Button variant="outline" className="flex-1" asChild>
                        <a
                          href={dialogCalendarLinks.google}
                          target="_blank"
                          rel="noreferrer">
                          Google
                          <ExternalLinkIcon className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                      <Button variant="outline" className="flex-1" asChild>
                        <a
                          href={dialogCalendarLinks.outlook}
                          target="_blank"
                          rel="noreferrer">
                          Outlook
                          <ExternalLinkIcon className="ml-2 h-4 w-4" />
                        </a>
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!createDialogDate}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setCreateDialogDate(null);
        }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Create custom event</DialogTitle>
            <DialogDescription>
              Add a custom event for {selectedUser?.name ?? user.name}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="custom-event-title">Title</Label>
              <Input
                id="custom-event-title"
                value={eventForm.title}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="Focus block, onsite, debrief..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2 sm:col-span-1">
                <Label htmlFor="custom-event-date">Date</Label>
                <Input
                  id="custom-event-date"
                  type="date"
                  value={eventForm.date}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      date: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-event-start-time">Start</Label>
                <Input
                  id="custom-event-start-time"
                  type="time"
                  value={eventForm.startTime}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      startTime: event.target.value,
                    }))
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="custom-event-end-time">End</Label>
                <Input
                  id="custom-event-end-time"
                  type="time"
                  value={eventForm.endTime}
                  onChange={(event) =>
                    setEventForm((current) => ({
                      ...current,
                      endTime: event.target.value,
                    }))
                  }
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="custom-event-description">Notes</Label>
              <Textarea
                id="custom-event-description"
                value={eventForm.description}
                onChange={(event) =>
                  setEventForm((current) => ({
                    ...current,
                    description: event.target.value,
                  }))
                }
                placeholder="Optional context for this event"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogDate(null)}
                disabled={isCreatingEvent}>
                Cancel
              </Button>
              <Button onClick={handleCreateEvent} disabled={isCreatingEvent}>
                {isCreatingEvent ? "Saving..." : "Create event"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default InterviewCalendarPage;
