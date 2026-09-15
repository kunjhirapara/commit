"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BellRingIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveNotificationActions } from "@/lib/notificationLinks";
import type { AppRole } from "@/lib/routeAccess";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import NotificationDetailDialog, {
  type NotificationDetail,
} from "./NotificationDetailDialog";

const formatNotificationLabel = (value?: string) =>
  value ? value.replace(/_/g, " ") : "update";

const formatTimestamp = (timestamp: number) =>
  new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(timestamp));

function NotificationsPanel() {
  const { isLoading, user, role } = useUserRole();
  const notifications = useQuery(
    api.notifications.index.getMyNotifications,
    isLoading || !user ? "skip" : {},
  );
  const markAsRead = useMutation(api.notifications.index.markNotificationAsRead);

  const [selected, setSelected] = useState<NotificationDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const viewerRole = (role ?? null) as AppRole | null;

  const handleMarkRead = (notificationId: string) => {
    void markAsRead({
      notificationId: notificationId as Id<"notifications">,
    });
  };

  if (!notifications || notifications.length === 0) return null;

  const unreadCount = notifications.filter(
    (notification) => notification.status !== "read",
  ).length;

  return (
    <>
      <Card className="border-border/70 bg-card/80 shadow-sm backdrop-blur">
        <CardHeader className="pb-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-lg">
                <BellRingIcon className="h-5 w-5 text-primary" />
                Recent notifications
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Your latest interview and workflow updates.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={unreadCount > 0 ? "default" : "secondary"}>
                {unreadCount} unread
              </Badge>
              <Button variant="ghost" size="sm" asChild>
                <Link href="/settings">Preferences</Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
          {notifications.map((notification) => {
            const unread = notification.status !== "read";
            // Two at most in the list. A row already carries a category, a
            // timestamp and "Mark read"; the full set lives in the dialog.
            const actions = resolveNotificationActions({
              type: notification.type,
              category: notification.category,
              role: viewerRole,
              interview: notification.interview,
            }).slice(0, 2);

            return (
              <div
                key={notification._id}
                className="rounded-2xl border border-border/60 bg-background/80 px-4 py-3"
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                      unread ? "bg-primary" : "bg-muted-foreground/30"
                    }`}
                  />
                  {/*
                    The summary is a button so the whole row opens the full
                    message. It used to be inert text with the message clamped
                    to two lines and no way to read the rest.
                  */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelected(notification);
                      setDetailOpen(true);
                    }}
                    className="min-w-0 flex-1 space-y-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`Open notification: ${notification.title}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="line-clamp-1 text-sm font-semibold">
                          {notification.title}
                        </p>
                        <p className="line-clamp-2 text-sm text-muted-foreground">
                          {notification.message}
                        </p>
                      </div>
                      <p className="shrink-0 text-xs text-muted-foreground">
                        {formatTimestamp(
                          notification.sentAt ?? notification.scheduledFor,
                        )}
                      </p>
                    </div>
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pl-[1.375rem]">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                      {formatNotificationLabel(notification.category)}
                    </p>
                    {actions.map((action) => (
                      <Button
                        key={action.href}
                        size="xs"
                        variant={
                          action.intent === "primary" ? "default" : "outline"
                        }
                        asChild
                      >
                        <Link
                          href={action.href}
                          onClick={() => {
                            if (unread) handleMarkRead(notification._id);
                          }}
                        >
                          {action.label}
                        </Link>
                      </Button>
                    ))}
                  </div>
                  {unread ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => handleMarkRead(notification._id)}
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <NotificationDetailDialog
        notification={selected}
        role={viewerRole}
        open={detailOpen}
        onOpenChange={setDetailOpen}
        onMarkRead={handleMarkRead}
      />
    </>
  );
}

export default NotificationsPanel;
