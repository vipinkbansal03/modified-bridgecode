"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ConfirmModal, useToast } from "@/components/admin/AdminComponents";
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
  const { showToast, ToastComponent } = useToast();
  const { data: rolesData = [], isLoading, refetch } = useAdminRoles();
  const roles = (rolesData || []) as Role[];

  // Modal / Editing state
  const [showModal, setShowModal] = useState(false);
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [roleName, setRoleName] = useState("");
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);
  const [isFullAccess, setIsFullAccess] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({
    Catalog: true,
    Operations: true,
    Content: true,
    Administration: true,
  });

  // Calculate summary totals
  const totals = useMemo(() => {
    const totalRoles = roles.length;
    const fullAccessRoles = roles.filter((r) => r.permissions.includes("*")).length;
    const customRoles = totalRoles - fullAccessRoles;
    const totalUsers = roles.reduce((acc, r) => acc + (r._count?.users || 0), 0);
    return { totalRoles, fullAccessRoles, customRoles, totalUsers };
  }, [roles]);

  const [enabledModules, setEnabledModules] = useState<Record<string, boolean>>({});

  const openCreateModal = () => {
    setEditingRole(null);
    setRoleName("");
    setSelectedPerms([]);
    setIsFullAccess(false);
    setSearchQuery("");
    setEnabledModules({});
    setShowModal(true);
  };

  const openEditModal = (role: Role) => {
    setEditingRole(role);
    setRoleName(role.name);
    const fullAcc = role.permissions.includes("*");
    setIsFullAccess(fullAcc);
    const perms = (fullAcc ? ["*"] : [...role.permissions]).filter((p) => p === "*" || ALL_PERMISSIONS.includes(p));
    setSelectedPerms(perms);
    
    const initialEnabled: Record<string, boolean> = {};
    PERMISSION_GROUPS.forEach((g) => {
      initialEnabled[g.title] = g.permissions.some((p) => perms.includes(p));
    });
    setEnabledModules(initialEnabled);

    setSearchQuery("");
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

  const applyPreset = (preset: RolePreset) => {
    const perms = [...preset.permissions];
    if (preset.permissions.includes("*")) {
      setIsFullAccess(true);
      setSelectedPerms(["*"]);
    } else {
      setIsFullAccess(false);
      setSelectedPerms(perms);
    }

    const initialEnabled: Record<string, boolean> = {};
    PERMISSION_GROUPS.forEach((g) => {
      initialEnabled[g.title] = g.permissions.some((p) => perms.includes(p));
    });
    setEnabledModules(initialEnabled);

    if (!roleName) {
      setRoleName(preset.name);
    }
    showToast(`Loaded "${preset.name}" preset.`);
  };

  const togglePermission = (key: string) => {
    if (isFullAccess) return;
    if (selectedPerms.includes(key)) {
      setSelectedPerms(selectedPerms.filter((p) => p !== key));
    } else {
      setSelectedPerms([...selectedPerms, key]);
    }
  };

  const toggleGroupAll = (groupTitle: string, groupKeys: string[]) => {
    if (isFullAccess) return;
    const allSelected = groupKeys.every((k) => selectedPerms.includes(k));
    if (allSelected) {
      setSelectedPerms(selectedPerms.filter((p) => !groupKeys.includes(p)));
    } else {
      const union = new Set([...selectedPerms, ...groupKeys]);
      setSelectedPerms(Array.from(union));
    }
  };

  const handleSave = async () => {
    if (!roleName.trim()) {
      alert("Please enter a role name.");
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

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    try {
      await adminApi.delete(`/roles/${deletingId}`);
      showToast("Role deleted successfully.");
      refetch();
    } catch (err) {
      console.error("Delete failed", err);
      showToast("Cannot delete role with assigned users.", "error");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleGroupAccordion = (groupTitle: string) => {
    setExpandedGroups((prev) => ({ ...prev, [groupTitle]: !prev[groupTitle] }));
  };

  return (
    <AdminLayout title="Roles & Permissions" breadcrumb={[{ label: "Roles" }]}>
      <div className="space-y-6 p-4 md:p-6">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E6E6E6] mb-5">
          <Link
            href="/admin/roles"
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-[#E31E24] text-[#E31E24]"
          >
            System Roles
          </Link>
          <Link
            href="/admin/customer-roles"
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-transparent text-[#6B7280] hover:text-[#111827]"
          >
            Customer Roles
          </Link>
        </div>
        {/* Header Banner */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Role-Based Access Control (RBAC)</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Configure system roles and define precise permissions for admins, managers, and staff members.
            </p>
          </div>
          <button
            onClick={openCreateModal}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs shrink-0"
          >
            <Plus size={16} /> Create New Role
          </button>
        </div>

        {/* Stat Cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-[#6B7280]">Total Roles</span>
              <div className="text-2xl font-extrabold text-[#111827] mt-0.5">{totals.totalRoles}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#374151]">
              <Shield size={20} />
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-[#6B7280]">Full Access (Super Admin)</span>
              <div className="text-2xl font-extrabold text-[#15803D] mt-0.5">{totals.fullAccessRoles}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#DCFCE7] text-[#15803D]">
              <ShieldCheck size={20} />
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-[#6B7280]">Custom Defined Roles</span>
              <div className="text-2xl font-extrabold text-[#2563EB] mt-0.5">{totals.customRoles}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#EFF6FF] text-[#2563EB]">
              <ShieldAlert size={20} />
            </div>
          </div>

          <div className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-2xs flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase text-[#6B7280]">Assigned Users</span>
              <div className="text-2xl font-extrabold text-[#111827] mt-0.5">{totals.totalUsers}</div>
            </div>
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#F3F4F6] text-[#374151]">
              <Users size={20} />
            </div>
          </div>
        </div>

        {/* Roles Grid */}
        <div className="space-y-3">
          <h2 className="text-base font-bold text-[#111827]">Active System Roles</h2>
          {isLoading ? (
            <div className="p-8 text-center text-sm text-[#6B7280]">Loading roles...</div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {roles.map((role) => {
                const isSuper = role.permissions.includes("*");
                const permCount = isSuper ? ALL_PERMISSIONS.length : role.permissions.filter((p) => ALL_PERMISSIONS.includes(p)).length;
                const userCount = role._count?.users || 0;

                return (
                  <div
                    key={role.id}
                    className="rounded-xl border border-[#E5E7EB] bg-white p-5 shadow-2xs flex flex-col justify-between hover:border-[#D1D5DB] transition-all"
                  >
                    <div>
                      {/* Top Row: Name & Access Badge */}
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-base font-bold text-[#111827]">{role.name}</h3>
                        {isSuper ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2.5 py-0.5 text-[11px] font-bold text-[#15803D]">
                            <ShieldCheck size={12} /> Full Access
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#F3F4F6] px-2.5 py-0.5 text-[11px] font-semibold text-[#374151]">
                            {permCount} / {ALL_PERMISSIONS.length} Perms
                          </span>
                        )}
                      </div>

                      {/* Description & User Count */}
                      <div className="mt-3 flex items-center gap-3 text-[12.5px] text-[#6B7280]">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#374151]">
                          <Users size={14} className="text-[#9CA3AF]" />
                          {userCount} {userCount === 1 ? "User Assigned" : "Users Assigned"}
                        </span>
                      </div>
                    </div>

                    {/* Bottom Action Footer */}
                    <div className="mt-5 pt-3 border-t border-[#F3F4F6] flex items-center justify-between">
                      <button
                        onClick={() => openEditModal(role)}
                        className="inline-flex items-center gap-1.5 text-xs font-bold text-[#2563EB] hover:text-[#1D4ED8] hover:underline"
                      >
                        <Edit3 size={13} /> Edit Permissions
                      </button>

                      {!isSuper && (
                        <button
                          onClick={() => setDeletingId(role.id)}
                          className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded-md transition-colors"
                          title="Delete Role"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Role Creation / Editing Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={editingRole ? `Edit Role: ${editingRole.name}` : "Create New System Role"}
        panelClassName="max-w-4xl max-h-[85vh] flex flex-col overflow-hidden"
      >
        <div className="p-5 space-y-4 overflow-y-auto max-h-[calc(85vh-120px)]">
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
                    setIsFullAccess(e.target.checked);
                    if (e.target.checked) setSelectedPerms(["*"]);
                    else setSelectedPerms([]);
                  }}
                  className="h-4 w-4 rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24]"
                />
                <div>
                  <span className="text-xs font-bold text-[#111827] block">👑 Grant Full Access (* Wildcard)</span>
                  <span className="text-[10.5px] text-[#6B7280]">Bypasses all permission checks (Super Admin)</span>
                </div>
              </label>
            </div>
          </div>



          {/* Search Bar */}
          {!isFullAccess && (
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search permissions by keyword (e.g. product, order, view, manage)..."
                className="w-full pl-9 pr-3 py-1.5 text-xs border border-[#E5E7EB] rounded-lg bg-white outline-none focus:border-[#E31E24]"
              />
            </div>
          )}

          {/* Permission Group Cards */}
          {!isFullAccess ? (
            <div className="space-y-4">
              {PERMISSION_GROUPS.map((group) => {
                const groupMeta = group.permissions
                  .map((k) => PERMISSION_METADATA[k])
                  .filter(Boolean)
                  .filter((meta) => {
                    if (!searchQuery.trim()) return true;
                    const q = searchQuery.toLowerCase();
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
                            }
                          }}
                          className="h-4 w-4 rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
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
                                    className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24]"
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
          ) : (
            <div className="py-10 px-6 text-center bg-[#DCFCE7]/40 rounded-xl border border-[#DCFCE7]">
              <ShieldCheck size={40} className="mx-auto mb-2 text-[#15803D]" />
              <h3 className="text-base font-extrabold text-[#15803D]">Full Access Mode Enabled</h3>
              <p className="text-xs text-[#166534] mt-1 max-w-md mx-auto leading-relaxed">
                This role automatically bypasses all individual permission checks across the entire system (Super Admin access).
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer Bar */}
        <div className="bg-[#F9FAFB] px-5 py-3 border-t border-[#E5E7EB] flex items-center justify-between">
          <div className="text-xs font-bold text-[#374151]">
            Selected:{" "}
            <span className="text-[#E31E24]">
              {isFullAccess ? "FULL ACCESS (*)" : `${selectedPerms.length} / ${ALL_PERMISSIONS.length} Permissions`}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={closeModal}
              className="px-3.5 py-1.5 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] hover:bg-[#F3F4F6]"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="px-4 py-1.5 rounded-lg bg-[#E31E24] text-xs font-bold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
            >
              {saving ? "Saving..." : editingRole ? "Update Role" : "Create Role"}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletingId}
        title="Delete Role?"
        message="Are you sure you want to delete this system role? Make sure no active admins or staff members are assigned to this role before deleting."
        onConfirm={handleDeleteConfirm}
        onCancel={() => setDeletingId(null)}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
