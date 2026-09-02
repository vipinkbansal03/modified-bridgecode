"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Edit2, Filter, Plus, Search, Shield, Trash2, Users, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";
import { AdminInput, AdminSelect, AdminStatsGrid, ConfirmModal, DataTable, StatCard, StatusBadge, useToast, type Column, LoadingButton } from "@/components/admin/AdminComponents";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  useAdminCustomerRoles,
  useCreateCustomerRole,
  useDeleteCustomerRole,
  useUpdateCustomerRoleAdmin,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type CustomerRoleRow = {
  id: string;
  key: string;
  name: string;
  description?: string | null;
  status: "ACTIVE" | "INACTIVE";
  isSystem: boolean;
  sortOrder: number;
  _count?: { customers?: number };
};

type RoleFormState = {
  id: string;
  key: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: string;
};

const emptyForm: RoleFormState = {
  id: "",
  key: "",
  name: "",
  description: "",
  status: "ACTIVE",
  sortOrder: "0",
};

function formatKeyLabel(key: string) {
  return key.replace(/_/g, " ").toLowerCase();
}

export default function AdminCustomerRolesPage() {
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
  const { data: roles = [], isLoading } = useAdminCustomerRoles();
  const createRole = useCreateCustomerRole();
  const updateRole = useUpdateCustomerRoleAdmin();
  const deleteRole = useDeleteCustomerRole();

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"sortOrder" | "name" | "key" | "customers">("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<CustomerRoleRow | null>(null);

  const form = useAdminForm<RoleFormState>({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Customer role name is required.";
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const payload = {
        key: values.key.trim(),
        name: values.name.trim(),
        description: values.description.trim(),
        status: values.status,
        sortOrder: Number(values.sortOrder || 0),
      };

      try {
        if (values.id) {
          await updateRole.mutateAsync({ id: values.id, ...payload });
          showToast("Customer role updated.");
        } else {
          await createRole.mutateAsync(payload);
          showToast("Customer role created.");
        }
        resetForm();
        setShowForm(false);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save customer role."), "error");
      }
    }
  });

  const rows = useMemo(() => {
    const value = debouncedSearch.trim().toLowerCase();
    const filtered = [...(roles as CustomerRoleRow[])].filter((role) => {
      const matchesSearch =
        !value ||
        [role.name, role.key, role.description, formatKeyLabel(role.key)]
          .filter(Boolean)
          .some((field) => String(field).toLowerCase().includes(value));
      const matchesStatus = !statusFilter || role.status === statusFilter;
      return matchesSearch && matchesStatus;
    });

    filtered.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      const left =
        sortBy === "name"
          ? a.name
          : sortBy === "key"
            ? a.key
            : sortBy === "customers"
              ? a._count?.customers ?? 0
              : a.sortOrder;
      const right =
        sortBy === "name"
          ? b.name
          : sortBy === "key"
            ? b.key
            : sortBy === "customers"
              ? b._count?.customers ?? 0
              : b.sortOrder;
      if (typeof left === "number" && typeof right === "number") return (left - right) * direction;
      return String(left).localeCompare(String(right)) * direction;
    });

    return filtered;
  }, [roles, debouncedSearch, statusFilter, sortBy, sortDir]);

  const totals = useMemo(
    () => ({
      total: (roles as CustomerRoleRow[]).length,
      active: (roles as CustomerRoleRow[]).filter((role) => role.status === "ACTIVE").length,
      inactive: (roles as CustomerRoleRow[]).filter((role) => role.status === "INACTIVE").length,
      system: (roles as CustomerRoleRow[]).filter((role) => role.isSystem).length,
    }),
    [roles],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const resetForm = () => {
    form.reset();
    setShowForm(false);
  };

  const startCreate = () => {
    form.reset();
    setShowForm(true);
  };

  const startEdit = (role: CustomerRoleRow) => {
    form.setValues({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      status: role.status,
      sortOrder: String(role.sortOrder ?? 0),
    });
    setShowForm(true);
  };

  async function confirmDelete() {
    if (!deleting) return;
    try {
      await deleteRole.mutateAsync(deleting.id);
      showToast("Customer role deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete customer role."), "error");
    } finally {
      setDeleting(null);
    }
  }

  const toggleStatus = async (role: CustomerRoleRow) => {
    const nextStatus = role.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateRole.mutateAsync({ id: role.id, status: nextStatus });
      showToast(`Customer role marked ${nextStatus.toLowerCase()}.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update customer role status."), "error");
    }
  };

  const columns: Column<CustomerRoleRow>[] = [
    {
      key: "name",
      label: "Role",
      width: "320px",
      render: (row) => (
        <div className="min-w-[220px]">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#1A1A1A]">{row.name}</span>
            {row.isSystem ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                <Shield size={11} />
                System
              </span>
            ) : null}
          </div>
          {row.description ? <p className="mt-1 text-[12.5px] text-[#6B6B6B]">{row.description}</p> : null}
        </div>
      ),
    },
    { key: "key", label: "Key", width: "180px", render: (row) => <span className="font-mono text-[12px] text-[#6B6B6B]">{row.key}</span> },
    { key: "customers", label: "Customers", width: "120px", render: (row) => row._count?.customers ?? 0 },
    { key: "status", label: "Status", width: "120px" },
    { key: "sortOrder", label: "Sort", width: "80px", render: (row) => row.sortOrder },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            label: "Actions",
            width: "120px",
            render: (row: CustomerRoleRow) => (
              <div className="flex items-center gap-1.5">
                {canUpdate && (
                  <button type="button" onClick={() => startEdit(row)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]" title="Edit role">
                    <Edit2 size={13} />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    disabled={row.isSystem}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#F2C9C9] text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={row.isSystem ? "System roles cannot be deleted" : "Delete role"}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  if (authLoading || !hasPermission("roles.view")) {
    return null;
  }

  return (
    <AdminLayout title="Roles & Permissions" breadcrumb={[{ label: "Customer Roles" }]}>
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E6E6E6] mb-5">
          <Link
            href="/admin/roles"
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-transparent text-[#6B7280] hover:text-[#111827]"
          >
            System Roles
          </Link>
          <Link
            href="/admin/customer-roles"
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-[#E31E24] text-[#E31E24]"
          >
            Customer Roles
          </Link>
        </div>
        <AdminStatsGrid
          stats={[
            { title: "Total Roles", value: totals.total, subtitle: "Role catalog entries", icon: <Users size={18} /> },
            { title: "Active Roles", value: totals.active, subtitle: "Assignable now", icon: <Shield size={18} />, color: "bg-green-600" },
            { title: "Inactive Roles", value: totals.inactive, subtitle: "Hidden from active use", icon: <X size={18} />, color: "bg-gray-600" },
            { title: "System Roles", value: totals.system, subtitle: "Protected defaults", icon: <Shield size={18} />, color: "bg-[#0F6CBD]" }
          ]}
          isLoading={isLoading}
        />

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search roles..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
              >
                <Filter size={14} />
                {showFilters ? "Hide filters" : "Show filters"}
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={startCreate}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Plus size={14} />
                  New Customer Role
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 border-t border-[#F0F0F0] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#1A1A1A]">Filters & Sorting</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setSortBy("sortOrder");
                    setSortDir("asc");
                  }}
                  className="text-[12.5px] font-medium text-[#E31E24] hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <AdminSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  options={[
                    { value: "", label: "All status" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                <AdminSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as "sortOrder" | "name" | "key" | "customers")}
                  options={[
                    { value: "sortOrder", label: "Sort order" },
                    { value: "name", label: "Name" },
                    { value: "key", label: "Key" },
                    { value: "customers", label: "Customer count" },
                  ]}
                />
                <AdminSelect
                  label="Direction"
                  value={sortDir}
                  onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                  options={[
                    { value: "asc", label: "Ascending" },
                    { value: "desc", label: "Descending" },
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        <Modal
          open={showForm}
          onClose={resetForm}
          title={form.values.id ? "Edit Customer Role" : "Create Customer Role"}
          subtitle="System roles stay protected. New roles should use short unique keys."
          size="2xl"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                form="customer-role-form"
                loading={form.isSubmitting}
                loadingText="Processing..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
              >
                {form.values.id ? "Update Role" : "Create Role"}
              </LoadingButton>
            </div>
          }
        >
          <form id="customer-role-form" onSubmit={form.handleSubmit} className="p-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput
                label="Name"
                {...form.getFieldProps("name")}
                error={form.errors.name as string}
              />
              <AdminInput
                label="Key"
                {...form.getFieldProps("key")}
                error={form.errors.key as string}
                disabled={rows.find((role) => role.id === form.values.id)?.isSystem}
              />
              <AdminSelect
                label="Status"
                {...form.getFieldProps("status")}
                error={form.errors.status as string}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminInput
                label="Sort Order"
                type="number"
                {...form.getFieldProps("sortOrder")}
                error={form.errors.sortOrder as string}
              />
            </div>

            <AdminInput
              label="Description"
              {...form.getFieldProps("description")}
              error={form.errors.description as string}
            />
          </form>
        </Modal>

        <div className="rounded-xl border border-[#E6E6E6] bg-white">
          <DataTable<CustomerRoleRow>
            columns={columns}
            data={rows}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No customer roles found."
            onToggleStatus={canUpdate ? toggleStatus : undefined}
            statusLoadingId={updateRole.isPending ? ((updateRole.variables as any)?.id ?? null) : null}
            isStatusDisabled={() => !canUpdate}
          />
        </div>
      </div>

      <ConfirmModal
        open={!!deleting}
        title="Delete customer role?"
        message={deleting ? `Delete ${deleting.name}? Customers must be reassigned first.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteRole.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
