"use client";

import Link from "next/link";
import { useMutation, useQuery, useConvexAuth } from "convex/react";
import { BellRingIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "./badge";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

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
  const { isAuthenticated } = useConvexAuth();
  const notifications = useQuery(api.notifications.index.getMyNotifications, isAuthenticated ? {} : "skip");
  const markAsRead = useMutation(api.notifications.index.markNotificationAsRead);

  if (!notifications || notifications.length === 0) return null;

  const unreadCount = notifications.filter(
    (notification) => notification.status !== "read",
  ).length;

  return (
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

          return (
            <div
              key={notification._id}
              className="flex items-start gap-3 rounded-2xl border border-border/60 bg-background/80 px-4 py-3"
            >
              <div
                className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${
                  unread ? "bg-primary" : "bg-muted-foreground/30"
                }`}
              />
              <div className="min-w-0 flex-1 space-y-1">
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
                    {formatTimestamp(notification.sentAt ?? notification.scheduledFor)}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs uppercase tracking-[0.18em] text-muted-foreground">
                    {formatNotificationLabel(notification.category)}
                  </p>
                  {unread ? (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() =>
                        markAsRead({ notificationId: notification._id })
                      }
                    >
                      Mark read
                    </Button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

export default NotificationsPanel;
