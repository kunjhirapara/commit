"use client";

import Link from "next/link";
import { CheckIcon } from "lucide-react";

import {
  describeNotificationMetadata,
  resolveNotificationActions,
  type NotificationInterviewRef,
} from "@/lib/notificationLinks";
import type { AppRole } from "@/lib/routeAccess";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "./dialog";

/**
 * The full text of one notification, plus somewhere to go next.
 *
 * The bell and the home panel both clamp the message to two lines, so anything
 * longer than a sentence was unreadable and unrecoverable — there was no
 * expanded view anywhere. This is that view, and it is also where the quick
 * links live for rows whose action does not fit on a list item.
 */

export type NotificationDetail = {
  _id: string;
  type?: string;
  category?: string;
  title: string;
  message: string;
  status: string;
  scheduledFor: number;
  sentAt?: number;
  readAt?: number;
  metadata?: string;
  interview?: (NotificationInterviewRef & { title?: string }) | null;
};

const formatNotificationLabel = (value?: string) =>
  value ? value.replace(/_/g, " ") : "update";

const formatAbsoluteTime = (timestamp: number) =>
  new Intl.DateTimeFormat("en", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

function NotificationDetailDialog({
  notification,
  role,
  open,
  onOpenChange,
  onMarkRead,
}: {
  notification: NotificationDetail | null;
  role: AppRole | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMarkRead: (notificationId: string) => void;
}) {
  // The caller never clears its selection, so a notification is still present
  // throughout the closing transition; null only means "nothing opened yet".
  if (!notification) return null;

  const unread = notification.status !== "read";
  const timestamp = notification.sentAt ?? notification.scheduledFor;
  const fields = describeNotificationMetadata(notification.metadata);
  const actions = resolveNotificationActions({
    type: notification.type,
    category: notification.category,
    role,
    interview: notification.interview,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={unread ? "default" : "secondary"}
              className="h-6 rounded-full px-2.5 text-[10px] uppercase tracking-[0.18em]"
            >
              {formatNotificationLabel(notification.category)}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatAbsoluteTime(timestamp)}
            </span>
          </div>
          <DialogTitle className="text-left">{notification.title}</DialogTitle>
          <DialogDescription className="sr-only">
            Full details for this notification.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* whitespace-pre-line, because a message composed server-side may
              carry its own line breaks that the clamped list view swallowed. */}
          <p className="whitespace-pre-line text-sm leading-relaxed text-foreground">
            {notification.message}
          </p>

          {notification.interview?.title ? (
            <p className="text-sm text-muted-foreground">
              Interview:{" "}
              <span className="font-medium text-foreground">
                {notification.interview.title}
              </span>
            </p>
          ) : null}

          {fields.length > 0 ? (
            <dl className="grid gap-2 rounded-2xl border border-border/60 bg-muted/40 px-4 py-3 text-sm">
              {fields.map((field) => (
                <div
                  key={`${field.label}-${field.value}`}
                  className="flex items-start justify-between gap-4"
                >
                  <dt className="text-muted-foreground">{field.label}</dt>
                  <dd className="text-right font-medium">
                    {field.kind === "time"
                      ? formatAbsoluteTime(field.value)
                      : field.value}
                  </dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          {unread ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onMarkRead(notification._id)}
            >
              <CheckIcon className="size-3.5" />
              Mark read
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Read
              {notification.readAt
                ? ` · ${formatAbsoluteTime(notification.readAt)}`
                : ""}
            </span>
          )}

          {actions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {actions.map((action) => (
                <Button
                  key={action.href}
                  size="sm"
                  variant={action.intent === "primary" ? "default" : "outline"}
                  asChild
                >
                  <Link
                    href={action.href}
                    onClick={() => {
                      // Reading the detail and navigating away is as clear an
                      // acknowledgement as pressing "Mark read".
                      if (unread) onMarkRead(notification._id);
                      onOpenChange(false);
                    }}
                  >
                    {action.label}
                  </Link>
                </Button>
              ))}
            </div>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default NotificationDetailDialog;
