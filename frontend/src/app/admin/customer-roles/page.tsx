"use client";

import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, Shield, Users, CheckCircle2, XCircle, ShieldAlert } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";
import {
  AdminInput,
  AdminSelect,
  AdminStatsGrid,
  AdminListToolbar,
  AdminDeleteModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  type Column,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  useAdminRoles,
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
  const { data: roles = [], isLoading, refetch, isFetching } = useAdminCustomerRoles();
  const { data: systemRoles = [] } = useAdminRoles();
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

  // Pagination states
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const paginatedRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, page, pageSize]);

  const totals = useMemo(
    () => ({
      total: (roles as CustomerRoleRow[]).length,
      active: (roles as CustomerRoleRow[]).filter((role) => role.status === "ACTIVE").length,
      inactive: (roles as CustomerRoleRow[]).filter((role) => role.status === "INACTIVE").length,
      system: (roles as CustomerRoleRow[]).filter((role) => role.isSystem).length,
      systemRolesCount: (systemRoles as any[]).length,
    }),
    [roles, systemRoles],
  );

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
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
      width: "300px",
      render: (row) => (
        <div className="min-w-[200px]">
          <div className="flex items-center gap-2">
            <span className="text-[13.5px] font-semibold text-[#1A1A1A]">{row.name}</span>
            {row.isSystem ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                <Shield size={11} />
                System
              </span>
            ) : null}
          </div>
          {row.description ? <p className="mt-1 text-[12px] text-[#6B6B6B] line-clamp-1">{row.description}</p> : null}
        </div>
      ),
    },
    { key: "key", label: "Key", width: "160px", render: (row) => <span className="font-mono text-[12px] text-[#6B6B6B]">{row.key}</span> },
    { key: "customers", label: "Customers", width: "110px", render: (row) => row._count?.customers ?? 0 },
    { key: "status", label: "Status", width: "110px" },
    { key: "sortOrder", label: "Sort", width: "70px", render: (row) => row.sortOrder },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            label: "Actions",
            width: "100px",
            render: (row: CustomerRoleRow) => {
              const hasCustomers = (row._count?.customers ?? 0) > 0;
              return (
                <AdminRowActions
                  edit={
                    canUpdate
                      ? {
                          onClick: () => startEdit(row),
                          title: "Edit customer role",
                        }
                      : undefined
                  }
                  delete={
                    canDelete && !row.isSystem
                      ? {
                          onClick: () => setDeleting(row),
                          disabled: hasCustomers,
                          title: hasCustomers
                            ? "Cannot delete role with assigned customers"
                            : "Delete customer role",
                        }
                      : undefined
                  }
                />
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
    <AdminLayout title="Roles & Permissions" breadcrumb={[{ label: "Roles & Permissions", href: "/admin/roles" }, { label: "Customer Roles" }]}>
      <div className="space-y-5">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/roles"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Shield size={15} />
            <span>System Roles</span>
            {totals.systemRolesCount > 0 && (
              <span className="ml-1 rounded-full bg-[#F0F0F0] text-[#666] px-2 py-0.5 text-[11px] font-semibold">
                {totals.systemRolesCount}
              </span>
            )}
          </Link>
          <Link
            href="/admin/customer-roles"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Users size={15} />
            <span>Customer Roles</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {totals.total}
            </span>
          </Link>
        </div>

        {/* KPI Stats Grid */}
        <AdminStatsGrid
          stats={[
            { title: "Total Roles", value: totals.total, subtitle: "Role catalog entries", icon: <Users size={18} />, isLoading },
            { title: "Active Roles", value: totals.active, subtitle: "Assignable now", icon: <CheckCircle2 size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Inactive Roles", value: totals.inactive, subtitle: "Hidden from active use", icon: <XCircle size={18} />, color: "bg-gray-600", isLoading },
            { title: "System Roles", value: totals.system, subtitle: "Protected defaults", icon: <ShieldAlert size={18} />, color: "bg-sky-600", isLoading }
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
            placeholder: "Search roles...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [statusFilter, sortBy !== "sortOrder" ? sortBy : "", sortDir !== "asc" ? sortDir : ""].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: () => void refetch(),
            isRefreshing: isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: startCreate,
                  label: "New Customer Role",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setSortBy("sortOrder");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value as "sortOrder" | "name" | "key" | "customers");
                  setPage(1);
                }}
                options={[
                  { value: "sortOrder", label: "Sort Order" },
                  { value: "name", label: "Name" },
                  { value: "key", label: "Key" },
                  { value: "customers", label: "Customer Count" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(event) => {
                  setSortDir(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
              />
            </div>
          }
        />

        {/* FULL-WIDTH DATA TABLE WITH PAGINATION */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<CustomerRoleRow>
            columns={columns}
            data={paginatedRows}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No customer roles found."
            onToggleStatus={canUpdate ? toggleStatus : undefined}
            statusLoadingId={updateRole.isPending ? ((updateRole.variables as any)?.id ?? null) : null}
            isStatusDisabled={() => !canUpdate}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={Math.ceil(rows.length / pageSize) || 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>

      {/* Create / Edit Modal */}
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

      <AdminDeleteModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        itemName={deleting?.name}
        itemType="Customer Role"
        warningMessage="Choose the deletion method for this customer role. Customers assigned to this role must be reassigned."
        softDeleteDescription={`Removes "${deleting?.name}" role from customer assignments.`}
        onSoftDelete={confirmDelete}
        isSoftDeleting={deleteRole.isPending}
        initialDeleteType="soft"
      />

      {ToastComponent}
    </AdminLayout>
  );
}

