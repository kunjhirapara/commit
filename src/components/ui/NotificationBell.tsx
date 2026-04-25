"use client";

import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { BellIcon, CheckIcon, CheckCheckIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { ScrollArea } from "./scroll-area";

const formatNotificationLabel = (value?: string) =>
  value ? value.replace(/_/g, " ") : "update";

const formatRelativeTime = (timestamp: number) => {
  const diffMs = timestamp - Date.now();
  const diffMinutes = Math.round(diffMs / (1000 * 60));
  const formatter = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (Math.abs(diffMinutes) < 60) {
    return formatter.format(diffMinutes, "minute");
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return formatter.format(diffHours, "hour");
  }

  const diffDays = Math.round(diffHours / 24);
  return formatter.format(diffDays, "day");
};

function NotificationBell() {
  const notifications = useQuery(api.notifications.getMyNotifications, {});
  const markAsRead = useMutation(api.notifications.markNotificationAsRead);
  const markAllAsRead = useMutation(api.notifications.markAllNotificationsAsRead);

  const unreadNotifications =
    notifications?.filter((notification) => notification.status !== "read") ??
    [];
  const readNotifications =
    notifications?.filter((notification) => notification.status === "read") ??
    [];
  const dropdownNotifications = [
    ...unreadNotifications,
    ...readNotifications.slice(0, Math.max(0, 6 - unreadNotifications.length)),
  ];
  const unreadCount = unreadNotifications.length;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-full border border-transparent hover:border-border"
          aria-label="Open notifications"
        >
          <BellIcon className="size-5" />
          {unreadCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={12}
        className="w-[22rem] rounded-3xl border-border/70 p-0 shadow-2xl"
      >
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0 ? `${unreadCount} unread` : "You're all caught up"}
            </p>
          </div>
          <div className="flex items-center gap-1">
            {unreadCount > 0 ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-full px-2 text-xs"
                onClick={() => markAllAsRead({})}
              >
                <CheckCheckIcon className="mr-1 size-3.5" />
                Read all
              </Button>
            ) : null}
            <Button variant="ghost" size="sm" asChild>
              <Link href="/settings">Settings</Link>
            </Button>
          </div>
        </div>
        <DropdownMenuSeparator />
        {dropdownNotifications.length > 0 ? (
          <ScrollArea className="max-h-[26rem]">
            <div className="space-y-1 p-2">
              {dropdownNotifications.map((notification) => {
                const unread = notification.status !== "read";
                const timestamp =
                  notification.sentAt ?? notification.scheduledFor;

                return (
                  <div
                    key={notification._id}
                    className="rounded-2xl px-3 py-3 transition-colors hover:bg-muted/70"
                  >
                    <div className="flex items-start gap-3">
                      <div className="relative mt-1 shrink-0">
                        <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
                          <BellIcon className="size-4" />
                        </span>
                        {unread ? (
                          <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-sky-500" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="line-clamp-1 text-sm font-medium">
                              {notification.title}
                            </p>
                            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                              {notification.message}
                            </p>
                          </div>
                          <p className="shrink-0 text-[11px] text-muted-foreground">
                            {formatRelativeTime(timestamp)}
                          </p>
                        </div>
                        <div className="mt-2 flex items-center justify-between gap-3">
                          <Badge
                            variant={unread ? "default" : "secondary"}
                            className="h-6 rounded-full px-2.5 text-[10px] uppercase tracking-[0.18em]"
                          >
                            {formatNotificationLabel(notification.category)}
                          </Badge>
                          {unread ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 rounded-full px-2 text-xs"
                              onClick={() =>
                                markAsRead({
                                  notificationId: notification._id,
                                })
                              }
                            >
                              <CheckIcon className="size-3.5" />
                              Mark read
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              Read
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        ) : (
          <div className="px-4 py-8 text-center">
            <p className="text-sm font-medium">No notifications yet</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Interview updates will appear here when they arrive.
            </p>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default NotificationBell;
