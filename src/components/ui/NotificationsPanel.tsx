"use client";

import { useMutation, useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { BellIcon } from "lucide-react";
import { Button } from "./button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";

function NotificationsPanel() {
  const notifications = useQuery(api.notifications.getMyNotifications, {});
  const markAsRead = useMutation(api.notifications.markNotificationAsRead);

  if (!notifications || notifications.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BellIcon className="h-5 w-5" />
          Interview Updates
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {notifications.slice(0, 5).map((notification) => (
          <div
            key={notification._id}
            className="rounded-lg border p-3 space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">{notification.title}</p>
                <p className="text-sm text-muted-foreground">
                  {notification.message}
                </p>
              </div>
              {notification.status !== "read" ? (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    markAsRead({ notificationId: notification._id })
                  }>
                  Mark read
                </Button>
              ) : null}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default NotificationsPanel;
