"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import RoleGuard from "@/components/auth/RoleGuard";
import {
  DashboardPageHeader,
  SectionIntro,
} from "@/components/dashboard/DashboardPrimitives";
import LoaderUI from "@/components/ui/LoaderUI";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { cn } from "@/lib/utils";
import { getDisplayErrorMessage, logError } from "@/lib/errors";
import { toast } from "sonner";

const BASE_ROLE_OPTIONS = [
  "candidate",
  "interviewer",
  "recruiter",
  "developer",
  "admin",
] as const;

function RolesWorkspacePage() {
  const data = useQuery(api.users.getRoleManagementDashboard, {});
  const createRoleDefinition = useMutation(api.users.createRoleDefinition);
  const updateRoleDefinition = useMutation(api.users.updateRoleDefinition);
  const updateUserRole = useMutation(api.users.updateUserRole);
  const assignUserCustomRole = useMutation(api.users.assignUserCustomRole);

  const [selectedRoleId, setSelectedRoleId] = useState<string>("new");
  const [roleName, setRoleName] = useState("");
  const [roleSlug, setRoleSlug] = useState("");
  const [roleDescription, setRoleDescription] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (!data) return;

    const selectedRole =
      selectedRoleId === "new"
        ? null
        : data.roles.find((role) => String(role._id) === selectedRoleId) ?? null;

    if (!selectedRole) {
      setRoleName("");
      setRoleSlug("");
      setRoleDescription("");
      setSelectedPermissions([]);
      return;
    }

    setRoleName(selectedRole.name);
    setRoleSlug(selectedRole.slug);
    setRoleDescription(selectedRole.description ?? "");
    setSelectedPermissions(selectedRole.permissions ?? []);
  }, [data, selectedRoleId]);

  const groupedPermissions = useMemo(() => {
    if (!data) return [];

    const groups = new Map<string, string[]>();

    for (const permission of data.permissionOptions) {
      const group = permission.startsWith("view")
        ? "Visibility"
        : permission.startsWith("manage")
          ? "Management"
          : "Operations";

      groups.set(group, [...(groups.get(group) ?? []), permission]);
    }

    return Array.from(groups.entries());
  }, [data]);

  if (!data) return <LoaderUI />;

  const handlePermissionToggle = (permission: string) => {
    setSelectedPermissions((current) =>
      current.includes(permission)
        ? current.filter((item) => item !== permission)
        : [...current, permission],
    );
  };

  const handleSaveRole = async () => {
    if (!roleName.trim()) {
      toast.error("Role name is required.");
      return;
    }

    try {
      if (selectedRoleId === "new") {
        const roleId = await createRoleDefinition({
          name: roleName.trim(),
          slug: roleSlug.trim() || roleName.trim(),
          description: roleDescription.trim() || undefined,
          permissions: selectedPermissions,
        });
        setSelectedRoleId(String(roleId));
        toast.success("Role created.");
      } else {
        await updateRoleDefinition({
          roleId: selectedRoleId as Id<"roleDefinitions">,
          name: roleName.trim(),
          description: roleDescription.trim() || undefined,
          permissions: selectedPermissions,
        });
        toast.success("Role updated.");
      }
    } catch (error) {
      logError("RolesWorkspacePage.handleSaveRole", error, {
        selectedRoleId,
      });
      toast.error(getDisplayErrorMessage(error, "Could not save role."));
    }
  };

  const handleBaseRoleChange = async (
    userId: Id<"users">,
    nextRole: (typeof BASE_ROLE_OPTIONS)[number],
  ) => {
    try {
      await updateUserRole({ userId, role: nextRole });
      toast.success("Base role updated.");
    } catch (error) {
      logError("RolesWorkspacePage.handleBaseRoleChange", error, {
        userId,
        nextRole,
      });
      toast.error(getDisplayErrorMessage(error, "Could not update base role."));
    }
  };

  const handleCustomRoleChange = async (
    userId: Id<"users">,
    nextCustomRoleId: string,
  ) => {
    try {
      await assignUserCustomRole({
        userId,
        customRoleId:
          nextCustomRoleId === "none"
            ? undefined
            : (nextCustomRoleId as Id<"roleDefinitions">),
      });
      toast.success("Custom role assignment updated.");
    } catch (error) {
      logError("RolesWorkspacePage.handleCustomRoleChange", error, {
        userId,
        nextCustomRoleId,
      });
      toast.error(
        getDisplayErrorMessage(error, "Could not update custom role assignment."),
      );
    }
  };

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        eyebrow="Roles"
        title="Role and permission studio"
        description="Create custom roles, attach permission bundles, and change a user's base role or assigned custom role from one developer/admin-only page."
      />

      <section className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>Custom roles</CardTitle>
            <CardDescription>
              Build permission bundles on top of the base system roles.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant={selectedRoleId === "new" ? "default" : "outline"}
              className="w-full"
              onClick={() => setSelectedRoleId("new")}
            >
              Create new role
            </Button>
            <ScrollArea className="h-[26rem] pr-3">
              <div className="space-y-3">
                {data.roles.map((role) => (
                  <button
                    key={String(role._id)}
                    type="button"
                    onClick={() => setSelectedRoleId(String(role._id))}
                    className={cn(
                      "w-full rounded-2xl border px-4 py-3 text-left transition-colors",
                      selectedRoleId === String(role._id)
                        ? "border-emerald-500/40 bg-emerald-500/10"
                        : "border-border/70 bg-background/70 hover:bg-muted/50",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-medium">{role.name}</span>
                      <Badge variant="outline">{role.permissions.length}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {role.slug}
                    </p>
                    {role.description ? (
                      <p className="mt-2 text-sm text-muted-foreground">
                        {role.description}
                      </p>
                    ) : null}
                  </button>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardHeader>
            <CardTitle>
              {selectedRoleId === "new" ? "Create role" : "Edit role"}
            </CardTitle>
            <CardDescription>
              Choose the permissions this custom role should grant.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Role name</Label>
                <Input
                  value={roleName}
                  onChange={(event) => setRoleName(event.target.value)}
                  placeholder="Platform operator"
                />
              </div>
              <div className="space-y-2">
                <Label>Role slug</Label>
                <Input
                  value={roleSlug}
                  onChange={(event) => setRoleSlug(event.target.value)}
                  placeholder="platform-operator"
                  disabled={selectedRoleId !== "new"}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea
                value={roleDescription}
                onChange={(event) => setRoleDescription(event.target.value)}
                placeholder="Explain what this role is for."
              />
            </div>

            <div className="space-y-4">
              <SectionIntro
                title="Permission matrix"
                description="Toggle the abilities this custom role should unlock."
              />
              {groupedPermissions.map(([group, permissions]) => (
                <div key={group} className="space-y-3">
                  <p className="text-sm font-medium">{group}</p>
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {permissions.map((permission) => {
                      const selected = selectedPermissions.includes(permission);

                      return (
                        <button
                          key={permission}
                          type="button"
                          onClick={() => handlePermissionToggle(permission)}
                          className={cn(
                            "rounded-2xl border px-4 py-3 text-left transition-colors",
                            selected
                              ? "border-emerald-500/40 bg-emerald-500/10"
                              : "border-border/70 bg-background/70 hover:bg-muted/50",
                          )}
                        >
                          <p className="text-sm font-medium">{permission}</p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {permission.replace(/([A-Z])/g, " $1")}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap gap-3">
              <Button onClick={handleSaveRole}>
                {selectedRoleId === "new" ? "Create role" : "Save role"}
              </Button>
              {selectedRoleId !== "new" ? (
                <Button variant="outline" onClick={() => setSelectedRoleId("new")}>
                  Start new role
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-4">
        <SectionIntro
          title="User assignments"
          description="Change a user's base system role and optionally attach one of the custom permission bundles."
        />
        <Card className="border-border/70 bg-card/80 shadow-sm">
          <CardContent className="pt-6">
            <ScrollArea className="h-[34rem] pr-3">
              <div className="space-y-3">
                {data.users.map((teamMember) => (
                  <div
                    key={String(teamMember._id)}
                    className="grid gap-4 rounded-2xl border border-border/70 bg-background/70 p-4 xl:grid-cols-[1.2fr_220px_260px]"
                  >
                    <div>
                      <p className="font-medium">{teamMember.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {teamMember.email || "Hidden email"}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Badge variant="outline">Base: {teamMember.role}</Badge>
                        {teamMember.customRole ? (
                          <Badge variant="secondary">
                            Custom: {teamMember.customRole.name}
                          </Badge>
                        ) : (
                          <Badge variant="secondary">No custom role</Badge>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label>Base role</Label>
                      <Select
                        value={teamMember.role}
                        onValueChange={(value) =>
                          handleBaseRoleChange(
                            teamMember._id,
                            value as (typeof BASE_ROLE_OPTIONS)[number],
                          )
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Base role" />
                        </SelectTrigger>
                        <SelectContent>
                          {BASE_ROLE_OPTIONS.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label>Custom role</Label>
                      <Select
                        value={teamMember.customRole ? String(teamMember.customRole._id) : "none"}
                        onValueChange={(value) =>
                          handleCustomRoleChange(teamMember._id, value)
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Custom role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No custom role</SelectItem>
                          {data.roles.map((role) => (
                            <SelectItem key={String(role._id)} value={String(role._id)}>
                              {role.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

export default function ProtectedRolesWorkspacePage() {
  return (
    <RoleGuard
      allowedRoles={["developer", "admin"]}
      title="Roles workspace restricted"
      message="Only developers and admins can manage custom roles and permissions."
    >
      <RolesWorkspacePage />
    </RoleGuard>
  );
}
