"use client";

import { useState, useLayoutEffect, useMemo, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";
import {
  DataTable,
  type Column,
  StatusBadge,
  AdminInput,
  AdminSelect,
  AdminMultiSelect,
  ConfirmModal,
  useToast,
  AdminListToolbar,
  LoadingButton,
  AdminStatsGrid,
  Pagination,
} from "@/components/admin/AdminComponents";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import {
  useAdminUsers,
  useAdminRoles,
  useAdminWarehouses,
  useAdminCustomerCounts,
} from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, Users, Shield, ShieldCheck, UserCog } from "lucide-react";

interface User {
  id: string;
  name: string;
  email: string;
  roleId: string;
  role: { name: string };
  status: string;
  lastLoginAt: string;
  warehouses?: { warehouseId: string }[];
}

const visibleColumnsDefault = {
  name: true,
  role: true,
  status: true,
  lastLoginAt: true,
  warehouses: true,
  actions: true,
};

export default function UsersPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("users.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canDelete = hasPermission("users.delete");

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  const { data: users = [], isLoading, refetch } = useAdminUsers();
  const { data: customerCounts } = useAdminCustomerCounts();
  const { data: roles = [] } = useAdminRoles();
  const { data: warehousesData } = useAdminWarehouses({ limit: 30 });
  const warehouses = warehousesData?.data || [];

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, roleFilter, statusFilter, limit]);

  const roleOptions = useMemo(
    () => [{ value: "", label: "Select role…" }, ...roles.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))],
    [roles]
  );

  const form = useAdminForm({
    enableReinitialize: true,
    initialValues: {
      name: editingUser?.name || "",
      email: editingUser?.email || "",
      password: "",
      roleId: editingUser?.roleId || "",
      status: editingUser?.status || "ACTIVE",
      warehouseIds: editingUser?.warehouses?.map((uw: any) => uw.warehouseId) || ([] as string[]),
    },
    validationSchema: Yup.object({
      name: Yup.string().required("Name is required"),
      email: Yup.string().email("Invalid email").required("Email is required"),
      password: editingUser
        ? Yup.string().min(8, "Password must be at least 8 characters")
        : Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
      roleId: Yup.string().required("Role is required"),
      status: Yup.string().required("Status is required"),
    }),
    onSubmit: async (values) => {
      try {
        if (editingUser) {
          const payload: any = { ...values };
          if (!payload.password) delete payload.password;
          await adminApi.put(`/users/${editingUser.id}`, payload);
          showToast("User updated.");
        } else {
          await adminApi.post("/users", values);
          showToast("User created.");
        }
        refetch();
        setShowForm(false);
        setEditingUser(null);
        form.reset();
      } catch {
        showToast("Failed to save user.", "error");
      }
    },
  });

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(null);
    form.reset();
  };

  const [deletingLoading, setDeletingLoading] = useState(false);
  const [togglingUserId, setTogglingUserId] = useState<string | null>(null);

  const handleToggleStatus = async (user: User) => {
    const nextStatus = user.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setTogglingUserId(user.id);
    try {
      await adminApi.put(`/users/${user.id}`, { status: nextStatus });
      showToast(`Status updated to ${nextStatus.toLowerCase()}.`);
      refetch();
    } catch {
      showToast("Failed to update status.", "error");
    } finally {
      setTogglingUserId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    try {
      await adminApi.delete(`/users/${deleting}`);
      showToast("User removed.");
      refetch();
    } catch {
      showToast("Failed.", "error");
    } finally {
      setDeletingLoading(false);
      setDeleting(null);
    }
  };

  const filteredUsers = useMemo(() => {
    return (users as User[]).filter((u) => {
      if (debouncedSearch.trim()) {
        const q = debouncedSearch.toLowerCase().trim();
        const matchesName = u.name?.toLowerCase().includes(q);
        const matchesEmail = u.email?.toLowerCase().includes(q);
        const matchesRole = u.role?.name?.toLowerCase().includes(q);
        if (!matchesName && !matchesEmail && !matchesRole) return false;
      }
      if (roleFilter && u.roleId !== roleFilter) return false;
      if (statusFilter && u.status !== statusFilter) return false;
      return true;
    });
  }, [users, debouncedSearch, roleFilter, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / limit));
  const paginatedUsers = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredUsers.slice(start, start + limit);
  }, [filteredUsers, page, limit]);

  const activeFilterCount = [debouncedSearch, roleFilter, statusFilter].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("");
    setStatusFilter("");
    setPage(1);
  };

  const columns: Column<User>[] = [
    {
      key: "name",
      label: "Name",
      width: "250px",
      render: (r) => (
        <div>
          <div className="font-semibold text-[13px] text-[#1A1A1A]">{r.name}</div>
          <div className="text-[11.5px] text-[#6B6B6B]">{r.email}</div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Role",
      width: "180px",
      render: (r) => (
        <span className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-2.5 py-1 text-[11.5px] font-medium text-[#1A1A1A]">
          <Shield size={12} className="text-[#E31E24]" />
          {r.role?.name || "No Role"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "120px",
    },
    {
      key: "lastLoginAt",
      label: "Last Login",
      width: "150px",
      render: (r) => (
        <span className="text-[12.5px] text-[#6B6B6B]">
          {r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : "Never"}
        </span>
      ),
    },
    {
      key: "warehouses",
      label: "Warehouses",
      width: "160px",
      render: (r) => {
        const count = r.warehouses?.length ?? 0;
        if (count === 0) return <span className="text-[11.5px] text-[#9A9A9A]">All Warehouses</span>;
        return (
          <span className="text-[12px] font-medium text-[#1A1A1A]">
            {count} {count === 1 ? "warehouse" : "warehouses"}
          </span>
        );
      },
    },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            label: "Actions",
            width: "110px",
            align: "left" as const,
            render: (r: User) => (
              <AdminRowActions
                edit={
                  canUpdate
                    ? {
                        onClick: () => {
                          setEditingUser(r);
                          setShowForm(true);
                        },
                        title: "Edit staff user",
                      }
                    : undefined
                }
                delete={
                  canDelete
                    ? {
                        onClick: () => setDeleting(r.id),
                        title: "Deactivate user",
                      }
                    : undefined
                }
              />
            ),
          },
        ]
      : []),
  ];

  const filteredColumns = columns.filter((col) => {
    if (col.key === "name") return visibleColumns.name;
    if (col.key === "role") return visibleColumns.role;
    if (col.key === "status") return visibleColumns.status;
    if (col.key === "lastLoginAt") return visibleColumns.lastLoginAt;
    if (col.key === "warehouses") return visibleColumns.warehouses;
    if (col.key === "actions") return visibleColumns.actions;
    return true;
  });

  if (authLoading || !hasPermission("users.view")) {
    return null;
  }

  const activeUsersCount = users.filter((u: User) => u.status === "ACTIVE").length;
  const inactiveUsersCount = users.filter((u: User) => u.status !== "ACTIVE").length;

  return (
    <AdminLayout title="Users & Customers" breadcrumb={[{ label: "Users" }]}>
      <div className="space-y-5">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {hasPermission("customers.view") && (
            <Link
              href="/admin/customers"
              className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
            >
              <Users size={15} />
              <span>Customers</span>
              {customerCounts?.total != null && (
                <span className="ml-1 rounded-full bg-neutral-100 text-neutral-600 px-2 py-0.5 text-[11px] font-semibold">
                  {customerCounts.total}
                </span>
              )}
            </Link>
          )}
          <Link
            href="/admin/users"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <UserCog size={15} />
            <span>Staff (Users)</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {users.length}
            </span>
          </Link>
        </div>

        {/* KPI Stats Grid */}
        <AdminStatsGrid
          stats={[
            { title: "Total Staff", value: users.length, subtitle: "Registered team members", icon: <Users size={18} />, isLoading },
            { title: "Active Accounts", value: activeUsersCount, subtitle: "Currently enabled", icon: <Shield size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Inactive Accounts", value: inactiveUsersCount, subtitle: "Disabled access", icon: <UserCog size={18} />, color: "bg-amber-600", isLoading },
            { title: "System Roles", value: roles.length, subtitle: "Assigned security roles", icon: <ShieldCheck size={18} />, color: "bg-sky-600", isLoading },
          ]}
        />

        {/* List Toolbar */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search staff name, email, role...",
            widthClassName: "w-[280px]",
          }}
          filters={{
            showFilters: showAdvancedFilters,
            onToggle: () => setShowAdvancedFilters(!showAdvancedFilters),
            activeCount: activeFilterCount,
            label: "Filters",
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
            options: [
              { key: "name", label: "Name" },
              { key: "role", label: "Role" },
              { key: "status", label: "Status" },
              { key: "lastLoginAt", label: "Last Login" },
              { key: "warehouses", label: "Warehouses" },
              { key: "actions", label: "Actions" },
            ],
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Staff list refreshed."));
            },
          }}
          primaryAction={
            canCreate
              ? {
                  label: "Add User",
                  onClick: () => {
                    setEditingUser(null);
                    form.reset();
                    setShowForm(true);
                  },
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          filterPanel={
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 pt-2">
              <AdminSelect
                label="Role"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                options={[{ value: "", label: "All Roles" }, ...roleOptions.filter((r) => r.value)]}
              />
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <div className="flex items-end">
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-[38px] items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 text-xs font-semibold text-[#666] hover:bg-[#F2F2F2] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                >
                  Reset Filters
                </button>
              </div>
            </div>
          }
        />

        {/* FULL-WIDTH DATA TABLE */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<User>
            title="Staff List"
            columns={filteredColumns}
            data={paginatedUsers}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No staff users found."
            totalItems={filteredUsers.length}
            currentPage={page}
            pageSize={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            pageSizeOptions={[10, 25, 50]}
            onToggleStatus={canUpdate ? handleToggleStatus : undefined}
            statusLoadingId={togglingUserId}
            isStatusDisabled={() => !canUpdate}
          />

          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>

        {/* Create / Edit Modal */}
        <Modal
          open={showForm}
          onClose={handleCloseForm}
          title={editingUser ? "Edit Staff User" : "Create New Staff User"}
          subtitle={editingUser ? "Modify user credentials, role, and system status." : "Add a new member to the admin team and assign them a system role."}
          size="2xl"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={handleCloseForm}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                form="user-form"
                loading={form.isSubmitting}
                loadingText="Saving..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
              >
                {editingUser ? "Update User" : "Create User"}
              </LoadingButton>
            </div>
          }
        >
          <form id="user-form" onSubmit={form.handleSubmit} className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput label="Full Name" {...form.getFieldProps("name")} error={form.errors.name as string} />
              <AdminInput label="Email" type="email" {...form.getFieldProps("email")} error={form.errors.email as string} />
              <AdminInput
                label={editingUser ? "Password" : "Password *"}
                type="password"
                placeholder={editingUser ? "Leave blank to keep current" : "Min 8 characters"}
                {...form.getFieldProps("password")}
                error={form.errors.password as string}
              />
              <AdminSelect label="Role" options={roleOptions} {...form.getFieldProps("roleId")} error={form.errors.roleId as string} />
              <AdminSelect
                label="Status"
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
                {...form.getFieldProps("status")}
                error={form.errors.status as string}
              />
              <div className="md:col-span-2 border-t border-[#E6E6E6] pt-4 mt-2">
                <AdminMultiSelect
                  label="Assigned Warehouses"
                  placeholder="Select assigned warehouses..."
                  options={warehouses.map((w: any) => ({
                    value: w.id,
                    label: `${w.name} ${w.state ? `(${w.state})` : ""}`,
                  }))}
                  selectedValues={form.values.warehouseIds}
                  onChange={(nextIds) => form.setFieldValue("warehouseIds", nextIds)}
                  error={form.errors.warehouseIds as string}
                />
                <p className="mt-1.5 text-[11px] text-[#9A9A9A]">
                  Leave all unchecked if this staff member should have access to all warehouses.
                </p>
              </div>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          open={!!deleting}
          title="Remove user?"
          message="This will deactivate the user account."
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          isLoading={deletingLoading}
        />
        {ToastComponent}
      </div>
    </AdminLayout>
  );
}
