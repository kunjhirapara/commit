"use client";

import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { toast } from "sonner";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { useUserRole } from "@/hooks/useUserRole";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./card";
import { Input } from "./input";
import { Label } from "./label";
import { ScrollArea } from "./scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./select";

const ADMIN_ROLE_OPTIONS = [
  "interviewer",
  "recruiter",
  "developer",
  "admin",
] as const;
const RECRUITER_ROLE_OPTIONS = ["interviewer"] as const;
const USER_ROLE_OPTIONS = [
  "candidate",
  "interviewer",
  "recruiter",
  "developer",
  "admin",
] as const;
const ACCESS_PANEL_LIST_HEIGHT = "h-[320px]";

function AccessManagementPanel() {
  const { canManageInvitations, canManageRoles, isAdmin, role } = useUserRole();
  const [email, setEmail] = useState("");
  const inviteRoleOptions = isAdmin
    ? ADMIN_ROLE_OPTIONS
    : RECRUITER_ROLE_OPTIONS;
  const [inviteRole, setInviteRole] = useState<
    "interviewer" | "recruiter" | "developer" | "admin"
  >("interviewer");

  const users = useQuery(
    api.users.getUsers,
    canManageInvitations ? {} : "skip",
  );
  const invitations = useQuery(
    api.users.listInvitations,
    canManageInvitations ? {} : "skip",
  );
  const auditLogs = useQuery(
    api.auditLogs.getRecentAuditLogs,
    canManageRoles ? {} : "skip",
  );

  const revokeInvitation = useMutation(api.users.revokeInvitation);
  const updateUserRole = useMutation(api.users.updateUserRole);

  if (!canManageInvitations && !canManageRoles) return null;

  const handleInvite = async () => {
    if (!email.trim()) {
      toast.error("Please enter an email address.");
      return;
    }

    try {
      const response = await fetch("/api/invitations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: email.trim(),
          role: inviteRole,
        }),
      });

      const result = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(
          result?.detail || result?.error || "Unable to create invitation.",
        );
      }

      toast.success("Invitation created and email sent.");
      setEmail("");
    } catch (error) {
      logError("AccessManagementPanel.handleInvite", error, {
        email,
        inviteRole,
        role,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to create invitation."),
      );
    }
  };

  const handleRevoke = async (invitationId: Id<"invitations">) => {
    try {
      await revokeInvitation({ invitationId });
      toast.success("Invitation revoked.");
    } catch (error) {
      logError("AccessManagementPanel.handleRevoke", error, {
        invitationId,
      });
      toast.error(
        getDisplayErrorMessage(error, "Unable to revoke invitation."),
      );
    }
  };

  const handleRoleChange = async (
    userId: Id<"users">,
    nextRole: (typeof USER_ROLE_OPTIONS)[number],
  ) => {
    try {
      await updateUserRole({
        userId,
        role: nextRole,
      });
      toast.success("Role updated.");
    } catch (error) {
      logError("AccessManagementPanel.handleRoleChange", error, {
        userId,
        nextRole,
      });
      toast.error(getDisplayErrorMessage(error, "Unable to update role."));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Invite Team Member</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Sends an email invitation with a secure acceptance link. Invitations
            expire 24 hours after they are created.
          </p>
          <div className="space-y-2">
            <Label>Email</Label>
            <Input
              placeholder="team.member@company.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Role</Label>
            <Select
              value={inviteRole}
              onValueChange={(value) =>
                setInviteRole(value as typeof inviteRole)
              }>
              <SelectTrigger>
                <SelectValue placeholder="Select role" />
              </SelectTrigger>
              <SelectContent>
                {inviteRoleOptions.map((availableRole) => (
                  <SelectItem key={availableRole} value={availableRole}>
                    {availableRole}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button className="w-full" onClick={handleInvite}>
            Create Invitation
          </Button>
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Invitations</CardTitle>
        </CardHeader>
        <CardContent>
          {invitations?.length ? (
            <ScrollArea className={ACCESS_PANEL_LIST_HEIGHT}>
              <div className="space-y-3 pr-4">
                {invitations.map((invitation) => (
                  <div
                    key={invitation._id}
                    className="space-y-2 rounded-lg border p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium">
                          {invitation.email}
                        </p>
                        <div className="mt-1">
                          <StatusBadge status={invitation.role} />
                        </div>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Expires{" "}
                          {typeof invitation.expiresAt === "number"
                            ? new Date(invitation.expiresAt).toLocaleString()
                            : "24 hours after creation"}
                        </p>
                      </div>
                      <StatusBadge status={invitation.status} />
                    </div>
                    {invitation.status === "pending" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRevoke(invitation._id)}>
                        Revoke
                      </Button>
                    ) : null}
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">No invitations yet.</p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>Recent Audit Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {canManageRoles && auditLogs?.length ? (
            <ScrollArea className={ACCESS_PANEL_LIST_HEIGHT}>
              <div className="space-y-3 pr-4">
                {auditLogs.map((log) => (
                  <div key={log._id} className="space-y-1 rounded-lg border p-3">
                    <p className="text-sm font-medium">{log.action}</p>
                    <p className="text-xs text-muted-foreground">
                      {log.actorEmail ?? log.actorClerkId ?? "system"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(log.createdAt).toLocaleString()}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <p className="text-sm text-muted-foreground">
              {canManageRoles
                ? "No audit activity yet."
                : "Admins can review audit activity here."}
            </p>
          )}
        </CardContent>
      </Card>

      {canManageRoles ? (
        <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>Team Roles</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3">
            {users?.map((teamMember) => (
              <div
                key={teamMember._id}
                className="flex flex-col gap-3 rounded-lg border p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="font-medium">{teamMember.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {teamMember.email}
                  </p>
                </div>
                <Select
                  value={teamMember.role}
                  onValueChange={(value) =>
                    handleRoleChange(
                      teamMember._id,
                      value as (typeof USER_ROLE_OPTIONS)[number],
                    )
                  }>
                  <SelectTrigger className="w-full md:w-[180px]">
                    <SelectValue placeholder="Role" />
                  </SelectTrigger>
                  <SelectContent>
                    {USER_ROLE_OPTIONS.map((availableRole) => (
                      <SelectItem key={availableRole} value={availableRole}>
                        {availableRole}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

export default AccessManagementPanel;
