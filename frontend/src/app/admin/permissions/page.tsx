"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminSelect, StatCard, useToast } from "@/components/admin/AdminComponents";
import { useAdminRoles } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { ALL_PERMISSIONS, PERMISSION_GROUPS } from "@/constants/adminPermissions";
import { Check, Shield, Save, Search, Slash, Users } from "lucide-react";

type RoleRow = {
  id: string;
  name: string;
  permissions: string[];
  _count: { users: number };
};

type RoleDraft = {
  name: string;
  permissions: string[];
};

export default function PermissionsPage() {
  const { showToast, ToastComponent } = useToast();
  const { data: roles = [], isLoading, refetch } = useAdminRoles();
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, RoleDraft>>({});
  const [selectedRoleId, setSelectedRoleId] = useState("");

  useEffect(() => {
    const nextDrafts: Record<string, RoleDraft> = {};
    (roles as RoleRow[]).forEach((role) => {
      nextDrafts[role.id] = {
        name: role.name,
        permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
      };
    });
    setDrafts(nextDrafts);
  }, [roles]);

  const filteredRoles = useMemo(() => {
    const term = search.trim().toLowerCase();
    const source = roles as RoleRow[];
    if (!term) return source;
    return source.filter((role) => {
      const draft = drafts[role.id];
      const permissions = draft?.permissions ?? role.permissions ?? [];
      return role.name.toLowerCase().includes(term) || permissions.some((permission) => permission.toLowerCase().includes(term));
    });
  }, [roles, drafts, search]);

  useEffect(() => {
    if (!filteredRoles.length) {
      setSelectedRoleId("");
      return;
    }

    const currentExists = filteredRoles.some((role) => role.id === selectedRoleId);
    if (!currentExists) {
      setSelectedRoleId(filteredRoles[0].id);
    }
  }, [filteredRoles, selectedRoleId]);

  const stats = useMemo(() => {
    const source = roles as RoleRow[];
    const totalRoles = source.length;
    const fullAccessRoles = source.filter((role) => role.permissions.includes("*")).length;
    const totalAssignments = source.reduce((sum, role) => sum + (role.permissions.includes("*") ? ALL_PERMISSIONS.length : role.permissions.length), 0);
    const totalUsers = source.reduce((sum, role) => sum + (role._count?.users ?? 0), 0);
    return { totalRoles, fullAccessRoles, totalAssignments, totalUsers };
  }, [roles]);

  const updateDraft = (roleId: string, patch: Partial<RoleDraft>) => {
    setDrafts((current) => ({
      ...current,
      [roleId]: {
        name: patch.name ?? current[roleId]?.name ?? "",
        permissions: patch.permissions ?? current[roleId]?.permissions ?? [],
      },
    }));
  };

  const togglePermission = (roleId: string, permission: string) => {
    setDrafts((current) => {
      const draft = current[roleId];
      if (!draft) return current;

      if (permission === "*") {
        const isFullAccess = draft.permissions.includes("*");
        return {
          ...current,
          [roleId]: {
            ...draft,
            permissions: isFullAccess ? [] : ["*"],
          },
        };
      }

      const currentPermissions = draft.permissions.filter((item) => item !== "*");
      const nextPermissions = currentPermissions.includes(permission)
        ? currentPermissions.filter((item) => item !== permission)
        : [...currentPermissions, permission];

      return {
        ...current,
        [roleId]: {
          ...draft,
          permissions: nextPermissions,
        },
      };
    });
  };

  const resetRole = (role: RoleRow) => {
    setDrafts((current) => ({
      ...current,
      [role.id]: {
        name: role.name,
        permissions: Array.isArray(role.permissions) ? [...role.permissions] : [],
      },
    }));
  };

  const saveRole = async (role: RoleRow) => {
    const draft = drafts[role.id];
    if (!draft) return;

    try {
      await adminApi.put(`/roles/${role.id}`, {
        name: draft.name.trim() || role.name,
        permissions: draft.permissions,
      });
      showToast("Role permissions updated.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update role permissions."), "error");
    }
  };

  const selectedRole = useMemo(
    () => (filteredRoles as RoleRow[]).find((role) => role.id === selectedRoleId) ?? null,
    [filteredRoles, selectedRoleId],
  );

  return (
    <AdminLayout title="Permissions" breadcrumb={[{ label: "Roles", href: "/admin/roles" }, { label: "Permissions" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Roles" value={stats.totalRoles} subtitle="Role records" icon={<Shield size={18} />} />
          <StatCard title="Full Access" value={stats.fullAccessRoles} subtitle="Wildcard roles" icon={<Check size={18} />} color="bg-emerald-600" />
          <StatCard title="Assignments" value={stats.totalAssignments} subtitle="Permission bindings" icon={<Slash size={18} />} color="bg-[#0F6CBD]" />
          <StatCard title="Users" value={stats.totalUsers} subtitle="Assigned accounts" icon={<Users size={18} />} color="bg-[#111827]" />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)] lg:items-end">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles or permissions"
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>
          </div>
        </div>

        <div className="space-y-5">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.title} className="rounded-xl border border-[#E6E6E6] bg-white p-5">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#111]">{group.title}</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">These permissions are already enforced by backend route guards.</p>
                </div>
                <div className="text-[12px] font-medium uppercase tracking-wide text-[#9A9A9A]">
                  {group.permissions.length} permissions
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.permissions.map((permission) => (
                  <span key={permission} className="rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-1 text-[12px] font-mono text-[#333]">
                    {permission}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {isLoading ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
            <div className="animate-pulse space-y-3">
              <div className="h-10 rounded-lg bg-[#F2F2F2]" />
              <div className="h-28 rounded-lg bg-[#F2F2F2]" />
              <div className="h-28 rounded-lg bg-[#F2F2F2]" />
              <div className="h-28 rounded-lg bg-[#F2F2F2]" />
            </div>
          </div>
        ) : selectedRole ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="space-y-2">
                <div>
                  <h3 className="text-[15px] font-semibold text-[#111]">{drafts[selectedRole.id]?.name ?? selectedRole.name}</h3>
                  <div className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
                    {selectedRole._count?.users ?? 0} users assigned
                    {" · "}
                    {drafts[selectedRole.id]?.permissions.includes("*")
                      ? "Full access"
                      : `${drafts[selectedRole.id]?.permissions.length ?? 0} permissions`}
                  </div>
                </div>
                <p className="text-[12.5px] text-[#6B6B6B]">
                  Select a role above to edit its access rules. Changes are saved through the existing role API.
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => resetRole(selectedRole)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#E6E6E6] px-4 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={() => void saveRole(selectedRole)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Save size={14} />
                  Save
                </button>
              </div>
            </div>

            <div className="mt-4 grid gap-4">
              <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px_auto] lg:items-end">
                <AdminSelect
                  label="Role name"
                  value={selectedRole.id}
                  onChange={(event) => setSelectedRoleId(event.target.value)}
                  options={filteredRoles.map((role) => ({
                    value: role.id,
                    label: `${role.name} (${role._count?.users ?? 0} users)`,
                  }))}
                />
                <label className="flex items-center gap-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-3">
                  <input
                    type="checkbox"
                    checked={drafts[selectedRole.id]?.permissions.includes("*") ?? false}
                    onChange={() => togglePermission(selectedRole.id, "*")}
                    className="h-4 w-4 rounded border-[#D1D5DB]"
                  />
                  <span>
                    <span className="block text-[13px] font-semibold text-[#111]">Full access</span>
                    <span className="block text-[12px] text-[#6B6B6B]">Wildcard role access.</span>
                  </span>
                </label>
                <div className="flex h-10 items-center rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] px-3 text-[12.5px] font-medium text-[#555]">
                  Current role
                  <span className="ml-2 rounded-full bg-white px-2 py-0.5 text-[12px] text-[#111]">
                    {selectedRole?.name ?? "None"}
                  </span>
                </div>
              </div>

              {PERMISSION_GROUPS.map((group) => {
                const currentPermissions = drafts[selectedRole.id]?.permissions ?? [];
                const isFullAccess = currentPermissions.includes("*");
                return (
                  <div key={group.title} className="rounded-lg border border-[#E6E6E6] p-4">
                    <h4 className="mb-3 text-[12px] font-semibold uppercase tracking-wide text-[#6B6B6B]">{group.title}</h4>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {group.permissions.map((permission) => {
                        const checked = isFullAccess || currentPermissions.includes(permission);
                        return (
                          <label
                            key={permission}
                            className={`flex items-center gap-2 rounded-md border px-3 py-2 text-[12.5px] ${
                              isFullAccess ? "cursor-not-allowed border-[#EDEDED] bg-[#FCFCFC] text-[#9A9A9A]" : "cursor-pointer border-[#E6E6E6] hover:bg-[#FAFAFA]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isFullAccess}
                              onChange={() => togglePermission(selectedRole.id, permission)}
                              className="h-4 w-4 rounded border-[#D1D5DB]"
                            />
                            <span className="font-mono">{permission}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 text-[13px] text-[#6B6B6B]">
            No role matches the current search.
          </div>
        )}
      </div>

      {ToastComponent}
    </AdminLayout>
  );
}
