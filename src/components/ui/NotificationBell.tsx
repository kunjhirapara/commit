"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { BellIcon, CheckIcon, CheckCheckIcon } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { useUserRole } from "@/hooks/useUserRole";
import { resolveNotificationActions } from "@/lib/notificationLinks";
import type { AppRole } from "@/lib/routeAccess";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import NotificationDetailDialog, {
  type NotificationDetail,
} from "./NotificationDetailDialog";

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
  const { isLoading, user, role } = useUserRole();
  const notifications = useQuery(
    api.notifications.index.getMyNotifications,
    isLoading || !user ? "skip" : {},
  );
  const markAsRead = useMutation(api.notifications.index.markNotificationAsRead);
  const markAllAsRead = useMutation(api.notifications.index.markAllNotificationsAsRead);

  /*
   * The dropdown and the dialog are controlled together on purpose. Radix
   * unmounts DropdownMenuContent when the menu closes, so a Dialog rendered
   * inside it would be torn down the moment it opened. The dialog therefore
   * lives outside the menu, and selecting a row closes the menu and hands the
   * row over.
   */
  const [menuOpen, setMenuOpen] = useState(false);
  const [selected, setSelected] = useState<NotificationDetail | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const viewerRole = (role ?? null) as AppRole | null;

  const openDetail = (notification: NotificationDetail) => {
    setSelected(notification);
    setDetailOpen(true);
    setMenuOpen(false);
  };

  const handleMarkRead = (notificationId: string) => {
    void markAsRead({
      notificationId: notificationId as Id<"notifications">,
    });
  };

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
    <>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
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
              <Button size="sm" asChild>
                <Link href="/settings" onClick={() => setMenuOpen(false)}>
                  Settings
                </Link>
              </Button>
            </div>
          </div>
          <DropdownMenuSeparator />
          {dropdownNotifications.length > 0 ? (
            <div className="max-h-[26rem] overflow-y-auto pr-1">
              <div className="space-y-1 p-2">
                {dropdownNotifications.map((notification) => {
                  const unread = notification.status !== "read";
                  const timestamp =
                    notification.sentAt ?? notification.scheduledFor;
                  // Only the leading action is offered in the list. The rest
                  // are in the dialog, so a 22rem dropdown stays scannable.
                  const [primaryAction] = resolveNotificationActions({
                    type: notification.type,
                    category: notification.category,
                    role: viewerRole,
                    interview: notification.interview,
                  });

                  return (
                    <div
                      key={notification._id}
                      className="rounded-2xl transition-colors hover:bg-muted/70"
                    >
                      <div className="flex items-start gap-3 px-3 pt-3">
                        <div className="relative mt-1 shrink-0">
                          <span className="flex size-9 items-center justify-center rounded-full bg-muted text-foreground">
                            <BellIcon className="size-4" />
                          </span>
                          {unread ? (
                            <span className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-background bg-sky-500" />
                          ) : null}
                        </div>
                        {/*
                          A real button, so the whole summary is reachable by
                          keyboard and announced as activatable — the previous
                          div had no affordance at all.
                        */}
                        <button
                          type="button"
                          onClick={() => openDetail(notification)}
                          className="min-w-0 flex-1 rounded-xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          aria-label={`Open notification: ${notification.title}`}
                        >
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
                        </button>
                      </div>
                      <div className="flex items-center justify-between gap-2 px-3 pb-3 pl-[3.75rem] pt-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Badge
                            variant={unread ? "default" : "secondary"}
                            className="h-6 shrink-0 rounded-full px-2.5 text-[10px] uppercase tracking-[0.18em]"
                          >
                            {formatNotificationLabel(notification.category)}
                          </Badge>
                          {primaryAction ? (
                            <Button
                              size="xs"
                              variant="outline"
                              className="shrink-0"
                              asChild
                            >
                              <Link
                                href={primaryAction.href}
                                onClick={() => {
                                  if (unread) handleMarkRead(notification._id);
                                  setMenuOpen(false);
                                }}
                              >
                                {primaryAction.label}
                              </Link>
                            </Button>
                          ) : null}
                        </div>
                        {unread ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 shrink-0 rounded-full px-2 text-xs"
                            onClick={() => handleMarkRead(notification._id)}
                          >
                            <CheckIcon className="size-3.5" />
                            Mark read
                          </Button>
                        ) : (
                          <span className="shrink-0 text-xs text-muted-foreground">
                            Read
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
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

export default NotificationBell;
