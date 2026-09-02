"use client";

import { useMemo, useState, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  ConfirmModal,
  useToast,
  LoadingButton,
  DataTable,
  AdminStatsGrid,
  AdminListToolbar,
  type Column,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { useAdminRoles } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import {
  ALL_PERMISSIONS,
  PERMISSION_GROUPS,
  PERMISSION_METADATA,
  ROLE_PRESETS,
  type RolePreset,
} from "@/constants/adminPermissions";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Users,
  Plus,
  Edit3,
  Trash2,
  Search,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

interface Role {
  id: string;
  name: string;
  permissions: string[];
  _count: { users: number };
}

export default function RolesPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("roles.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("roles.create");
  const canUpdate = hasPermission("roles.update");
  const canDelete = hasPermission("roles.delete");

  const { showToast, ToastComponent } = useToast();
  const { data: rolesData = [], isLoading, refetch, isFetching } = useAdminRoles();
  const roles = (rolesData || []) as Role[];

  // Table filtering & sorting states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [accessFilter, setAccessFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "users" | "permissions">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  // Modal / Editing state
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [permSearchQuery, setPermSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setDeletingLoading(true);
    try {
      await adminApi.delete(`/roles/${deletingId}`);
      showToast("Role deleted successfully.");
      refetch();
    } catch (err) {
      console.error("Delete failed", err);
      showToast("Cannot delete role with assigned users.", "error");
    } finally {
      setDeletingLoading(false);
      setDeletingId(null);
    }
  };

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Catalog: true,
    Operations: true,
    Content: true,
    Administration: true,
  });

  const totals = useMemo(() => {
    const totalRoles = roles.length;
    const fullAccessRoles = roles.filter((r) => r.permissions.includes("*")).length;
    const customRoles = totalRoles - fullAccessRoles;
    const totalUsers = roles.reduce((acc, r) => acc + (r._count?.users || 0), 0);
    return { totalRoles, fullAccessRoles, customRoles, totalUsers };
  }, [roles]);

  const rows = useMemo(() => {
    const value = debouncedSearch.trim().toLowerCase();
    const filtered = roles.filter((role) => {
      const isSuper = role.permissions.includes("*");
      const matchesSearch = !value || role.name.toLowerCase().includes(value);
      const matchesAccess =
        !accessFilter ||
        (accessFilter === "FULL" && isSuper) ||
        (accessFilter === "CUSTOM" && !isSuper);
      return matchesSearch && matchesAccess;
    });

    filtered.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      if (sortBy === "users") {
        const left = a._count?.users || 0;
        const right = b._count?.users || 0;
        return (left - right) * direction;
      }
      if (sortBy === "permissions") {
        const left = a.permissions.includes("*") ? ALL_PERMISSIONS.length : a.permissions.length;
        const right = b.permissions.includes("*") ? ALL_PERMISSIONS.length : b.permissions.length;
        return (left - right) * direction;
      }
      return a.name.localeCompare(b.name) * direction;
    });

    return filtered;
  }, [roles, debouncedSearch, accessFilter, sortBy, sortDir]);

  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setSelectedPerms([]);
    setIsFullAccess(false);
    setPermSearchQuery("");
    setEnabledModules({});
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    const fullAcc = role.permissions.includes("*");
    setIsFullAccess(fullAcc);
    const perms = fullAcc
      ? [...ALL_PERMISSIONS]
      : role.permissions.filter((p) => ALL_PERMISSIONS.includes(p));
    setSelectedPerms(perms);
    
    const initialEnabled: Record<string, boolean> = {};
    PERMISSION_GROUPS.forEach((g) => {
      initialEnabled[g.title] = fullAcc || g.permissions.some((p) => perms.includes(p));
    });
    setEnabledModules(initialEnabled);

    setPermSearchQuery("");
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingRole(null);
    setRoleName("");
    setSelectedPerms([]);
    setIsFullAccess(false);
    setEnabledModules({});
  };

  const togglePermission = (key: string) => {
    if (selectedPerms.includes(key)) {
      const next = selectedPerms.filter((p) => p !== key);
      setSelectedPerms(next);
      setIsFullAccess(false);
    } else {
      const next = [...selectedPerms, key];
      setSelectedPerms(next);
      if (next.length === ALL_PERMISSIONS.length) {
        setIsFullAccess(true);
      }
    }
  };

  const toggleGroupAll = (groupTitle: string, groupKeys: string[]) => {
    const allSelected = groupKeys.every((k) => selectedPerms.includes(k));
    if (allSelected) {
      const next = selectedPerms.filter((p) => !groupKeys.includes(p));
      setSelectedPerms(next);
      setIsFullAccess(false);
    } else {
      const union = new Set([...selectedPerms, ...groupKeys]);
      const next = Array.from(union);
      setSelectedPerms(next);
      if (next.length === ALL_PERMISSIONS.length) {
        setIsFullAccess(true);
      }
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      showToast("Please enter a role name.", "error");
      return;
    }

    setSaving(true);
    const finalPerms = isFullAccess ? ["*"] : selectedPerms;

    try {
      if (editingRole) {
        await adminApi.put(`/roles/${editingRole.id}`, {
          name: roleName.trim(),
          permissions: finalPerms,
        });
        showToast("Role permissions updated successfully.");
      } else {
        await adminApi.post("/roles", {
          name: roleName.trim(),
          permissions: finalPerms,
        });
        showToast("New role created successfully.");
      }
      refetch();
      closeModal();
    } catch (err) {
      console.error("Failed to save role", err);
      showToast("Failed to save role.", "error");
    } finally {
      setSaving(false);
    }
  };

  const toggleGroupAccordion = (groupTitle: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  const columns: Column<Role>[] = [
    {
      key: "name",
      label: "Role",
      width: "320px",
      align: "left",
      render: (row) => {
        const isSuper = row.permissions.includes("*");
        return (
          <div className="min-w-0 pr-3">
            <div className="flex items-center gap-2">
              <span className="text-[13.5px] font-semibold text-[#1A1A1A] truncate">{row.name}</span>
              {isSuper ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-green-700 shrink-0">
                  <ShieldCheck size={11} />
                  Full Access
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B] shrink-0">
                  <Shield size={11} />
                  Custom
                </span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "permissions",
      label: "Permissions",
      align: "left",
      render: (row) => {
        const isSuper = row.permissions.includes("*");
        const permCount = isSuper
          ? ALL_PERMISSIONS.length
          : row.permissions.filter((p) => ALL_PERMISSIONS.includes(p)).length;
        return (
          <span className="text-[12.5px] text-[#6B6B6B]">
            {isSuper ? "All Permissions (*)" : `${permCount} / ${ALL_PERMISSIONS.length} Permissions`}
          </span>
        );
      },
    },
    {
      key: "users",
      label: "Assigned Users",
      width: "160px",
      align: "left",
      render: (row) => {
        const count = row._count?.users || 0;
        return (
          <span className="text-[13px] text-[#1A1A1A] font-medium">
            {count} {count === 1 ? "User" : "Users"}
          </span>
        );
      },
    },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            label: "Actions",
            width: "120px",
            align: "left" as const,
            render: (row: Role) => {
              const isSuper = row.permissions.includes("*");
              const hasUsers = (row._count?.users || 0) > 0;
              return (
                <div className="flex items-center justify-start gap-1.5">
                  {canUpdate && (
                    <button
                      type="button"
                      onClick={() => openEditModal(row)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs cursor-pointer"
                      title="Edit Permissions"
                    >
                      <Edit3 size={13} />
                    </button>
                  )}
                  {canDelete && !isSuper && (
                    <button
                      type="button"
                      onClick={() => setDeletingId(row.id)}
                      disabled={hasUsers}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] transition-colors shadow-2xs disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
                      title={hasUsers ? "Cannot delete role with assigned users" : "Delete role"}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              );
            },
          },
        ]
      : []),
  ];

  if (authLoading || !hasPermission("roles.view")) {
    return null;
  }

  return (
    <AdminLayout title="Roles & Permissions" breadcrumb={[{ label: "System Roles" }]}>
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E6E6E6]">
          <Link
            href="/admin/roles"
            className="px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors border-[#E31E24] text-[#E31E24]"
          >
            System Roles
          </Link>
          <Link
            href="/admin/customer-roles"
            className="px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors border-transparent text-[#6B7280] hover:text-[#111827]"
          >
            Customer Roles
          </Link>
        </div>

        {/* Stat Cards */}
        <AdminStatsGrid
          stats={[
            { title: "Total Roles", value: totals.totalRoles, subtitle: "Configured system roles", icon: <Shield size={18} /> },
            { title: "Full Access", value: totals.fullAccessRoles, subtitle: "Super Admin privileges", icon: <ShieldCheck size={18} />, color: "bg-green-600" },
            { title: "Custom Roles", value: totals.customRoles, subtitle: "Scoped permissions", icon: <ShieldAlert size={18} />, color: "bg-amber-600" },
            { title: "Assigned Users", value: totals.totalUsers, subtitle: "Active staff assignments", icon: <Users size={18} />, color: "bg-gray-600" }
          ]}
          isLoading={isLoading}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search roles...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [accessFilter, sortBy !== "name" ? sortBy : "", sortDir !== "asc" ? sortDir : ""].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: () => void refetch(),
            isRefreshing: isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: openCreateModal,
                  label: "New System Role",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          onResetFilters={() => {
            setSearch("");
            setAccessFilter("");
            setSortBy("name");
            setSortDir("asc");
          }}
          filterPanel={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={accessFilter}
                onChange={(e) => setAccessFilter(e.target.value)}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[150px]"
              >
                <option value="">All Access Levels</option>
                <option value="FULL">Full Access</option>
                <option value="CUSTOM">Custom Defined</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as "name" | "users" | "permissions")}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[150px]"
              >
                <option value="name">Role Name</option>
                <option value="users">Assigned Users</option>
                <option value="permissions">Permission Count</option>
              </select>
              <select
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[120px]"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          }
        />

        {/* DataTable */}
        <DataTable<Role>
          title="System Roles List"
          columns={columns}
          data={rows}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage="No system roles found."
          totalItems={rows.length}
          currentPage={1}
          pageSize={rows.length || 10}
          totalPages={1}
        />
      </div>

      {/* Role Creation / Editing Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingRole ? `Edit Role: ${editingRole.name}` : "Create New System Role"}
        subtitle={editingRole ? "Configure system role permissions and access level." : "Add a new system role and configure granular permissions across modules."}
        size="4xl"
        panelClassName="max-w-4xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="text-[12.5px] font-semibold text-[#1A1A1A]">
              Selected:{" "}
              <span className="text-[#E31E24]">
                {isFullAccess || selectedPerms.length === ALL_PERMISSIONS.length
                  ? `ALL PERMISSIONS (${ALL_PERMISSIONS.length} / ${ALL_PERMISSIONS.length})`
                  : `${selectedPerms.length} / ${ALL_PERMISSIONS.length} Permissions`}
              </span>
            </div>

            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                onClick={handleSave}
                loading={saving}
                loadingText="Saving..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
              >
                {editingRole ? "Update Role" : "Create Role"}
              </LoadingButton>
            </div>
          </div>
        }
      >
        <div className="p-6 space-y-4">
          {/* Role Name & Full Access Switch */}
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] items-center bg-[#F9FAFB] p-3.5 rounded-xl border border-[#E5E7EB]">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151] mb-1">
                Role Name <span className="text-[#E31E24]">*</span>
              </label>
              <input
                type="text"
                value={roleName}
                onChange={(e) => setRoleName(e.target.value)}
                placeholder="e.g. Catalog Manager, Sales Executive"
                className="w-full h-9 px-3 text-xs border border-[#E5E7EB] rounded-lg bg-white outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex items-center sm:justify-end pt-2 sm:pt-0">
              <label className="flex items-center gap-2 cursor-pointer bg-white px-3 py-1.5 rounded-lg border border-[#E5E7EB] shadow-2xs hover:bg-[#F9FAFB] transition-colors">
                <input
                  type="checkbox"
                  checked={isFullAccess}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setIsFullAccess(checked);
                    if (checked) {
                      setSelectedPerms([...ALL_PERMISSIONS]);
                      const allEnabled: Record<string, boolean> = {};
                      PERMISSION_GROUPS.forEach((g) => {
                        allEnabled[g.title] = true;
                      });
                      setEnabledModules(allEnabled);
                    } else {
                      setSelectedPerms([]);
                      setEnabledModules({});
                    }
                  }}
                  className="h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24] cursor-pointer"
                />
                <div>
                  <span className="text-xs font-bold text-[#111827] block">👑 Grant Full Access (* Wildcard)</span>
                  <span className="text-[10.5px] text-[#6B7280]">Bypasses all permission checks (Super Admin)</span>
                </div>
              </label>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
            <input
              type="text"
              value={permSearchQuery}
              onChange={(e) => setPermSearchQuery(e.target.value)}
              placeholder="Search permissions by keyword (e.g. product, order, view, manage)..."
              className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg bg-white outline-none focus:border-[#E31E24]"
            />
          </div>

          {/* Permission Group Cards */}
          <div className="space-y-4">
            {PERMISSION_GROUPS.map((group) => {
              const groupMeta = group.permissions
                .map((k) => PERMISSION_METADATA[k])
                .filter(Boolean)
                .filter((meta) => {
                  if (!permSearchQuery.trim()) return true;
                  const q = permSearchQuery.toLowerCase();
                  return (
                    meta.label.toLowerCase().includes(q) ||
                    meta.description.toLowerCase().includes(q) ||
                    meta.key.toLowerCase().includes(q)
                  );
                });

              if (groupMeta.length === 0) return null;

              const groupKeys = groupMeta.map((m) => m.key);
              const allSelected = groupKeys.every((k) => selectedPerms.includes(k));
              const isExpanded = expandedGroups[group.title] ?? true;

              return (
                <div key={group.title} className="rounded-xl border border-[#E5E7EB] bg-white overflow-hidden shadow-2xs">
                  {/* Group Header */}
                  <div className="bg-[#F9FAFB] px-3.5 py-2.5 border-b border-[#E5E7EB] flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={enabledModules[group.title] ?? false}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setEnabledModules((prev) => ({ ...prev, [group.title]: checked }));
                          if (!checked) {
                            setSelectedPerms((current) => current.filter((p) => !groupKeys.includes(p)));
                            setIsFullAccess(false);
                          }
                        }}
                        className="h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24] cursor-pointer"
                      />
                      <button
                        type="button"
                        onClick={() => toggleGroupAccordion(group.title)}
                        className="text-[#6B7280] hover:text-[#111827] flex items-center"
                      >
                        {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                      </button>
                      <h4 className="text-xs font-bold text-[#111827]">{group.title} Module</h4>
                      {enabledModules[group.title] && (
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#E5E7EB] text-[#374151]">
                          {groupKeys.filter((k) => selectedPerms.includes(k)).length} / {groupKeys.length} Selected
                        </span>
                      )}
                    </div>

                    {enabledModules[group.title] && (
                      <button
                        type="button"
                        onClick={() => toggleGroupAll(group.title, groupKeys)}
                        className="text-[11.5px] font-bold text-[#E31E24] hover:underline"
                      >
                        {allSelected ? "Deselect All" : "Select All Module"}
                      </button>
                    )}
                  </div>

                  {/* Group Permission Switches Grid */}
                  {isExpanded && (
                    <div className="p-3">
                      {enabledModules[group.title] ? (
                        <div className="grid gap-2.5 sm:grid-cols-2">
                          {groupMeta.map((meta) => {
                            const checked = selectedPerms.includes(meta.key);
                            return (
                              <label
                                key={meta.key}
                                className={`flex items-start gap-2.5 p-2.5 rounded-lg border transition-all cursor-pointer ${
                                  checked
                                    ? "border-[#E5E7EB] bg-[#FFF5F5] ring-1 ring-[#E31E24]/30 shadow-2xs"
                                    : "border-[#E5E7EB] bg-white hover:border-[#D1D5DB]"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => togglePermission(meta.key)}
                                  className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24] cursor-pointer"
                                />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between gap-1">
                                    <span className="text-xs font-bold text-[#111827]">{meta.label}</span>
                                    <span className="font-mono text-[9.5px] text-[#6B7280] bg-[#F3F4F6] px-1.5 py-0.5 rounded">
                                      {meta.key}
                                    </span>
                                  </div>
                                  <p className="text-[11px] text-[#6B6B6B] mt-0.5 leading-normal">{meta.description}</p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="py-3 text-center text-xs text-[#9CA3AF] italic">
                          Module disabled. Check the box in the header to configure granular permissions.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletingId}
        title="Delete Role?"
        message="Are you sure you want to delete this system role? Make sure no active admins or staff members are assigned to this role before deleting."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingId(null)}
        isLoading={deletingLoading}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
