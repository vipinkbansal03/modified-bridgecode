"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus, Shield, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, ConfirmModal, StatusBadge, useToast } from "@/components/admin/AdminComponents";
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

const emptyForm = {
  id: "",
  key: "",
  name: "",
  description: "",
  status: "ACTIVE",
  sortOrder: "0",
};

export default function AdminCustomerRolesPage() {
  const { showToast, ToastComponent } = useToast();
  const { data: roles = [], isLoading } = useAdminCustomerRoles();
  const createRole = useCreateCustomerRole();
  const updateRole = useUpdateCustomerRoleAdmin();
  const deleteRole = useDeleteCustomerRole();

  const [form, setForm] = useState(emptyForm);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<CustomerRoleRow | null>(null);

  const rows = useMemo(
    () => [...(roles as CustomerRoleRow[])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [roles],
  );

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const startEdit = (role: CustomerRoleRow) => {
    setForm({
      id: role.id,
      key: role.key,
      name: role.name,
      description: role.description ?? "",
      status: role.status,
      sortOrder: String(role.sortOrder ?? 0),
    });
    setShowForm(true);
  };

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();

    const payload = {
      key: form.key.trim(),
      name: form.name.trim(),
      description: form.description.trim(),
      status: form.status,
      sortOrder: Number(form.sortOrder || 0),
    };

    if (!payload.name) {
      showToast("Customer role name is required.", "error");
      return;
    }

    try {
      if (form.id) {
        await updateRole.mutateAsync({ id: form.id, ...payload });
        showToast("Customer role updated.");
      } else {
        await createRole.mutateAsync(payload);
        showToast("Customer role created.");
      }
      resetForm();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save customer role."), "error");
    }
  }

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

  return (
    <AdminLayout title="Customer Roles" breadcrumb={[{ label: "Customer Roles" }]}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#6B6B6B]">Manage the customer-facing role catalog used by registration, assignment, and pricing context.</p>
        <button
          type="button"
          onClick={() => {
            setForm(emptyForm);
            setShowForm(true);
          }}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
        >
          <Plus size={14} /> New Customer Role
        </button>
      </div>

      {showForm ? (
        <form onSubmit={handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{form.id ? "Edit customer role" : "Create customer role"}</h3>
            <button type="button" onClick={resetForm} className="text-[#9A9A9A] hover:text-[#1A1A1A]"><X size={16} /></button>
          </div>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <AdminInput label="Name *" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} />
            <AdminInput label="Key" value={form.key} onChange={(event) => setForm((current) => ({ ...current, key: event.target.value }))} disabled={rows.find((role) => role.id === form.id)?.isSystem} />
            <AdminSelect
              label="Status"
              value={form.status}
              onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <AdminInput label="Sort Order" type="number" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
          </div>
          <div className="mt-4">
            <AdminInput label="Description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
          </div>
          <button type="submit" className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
            {form.id ? "Update Role" : "Create Role"}
          </button>
        </form>
      ) : null}

      <div className="rounded-xl border border-[#E6E6E6] bg-white">
        <div className="hidden grid-cols-[1.2fr_0.9fr_110px_90px_110px] gap-3 border-b border-[#E6E6E6] px-5 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A] md:grid">
          <span>Role</span>
          <span>Key</span>
          <span>Customers</span>
          <span>Status</span>
          <span />
        </div>
        {isLoading ? (
          <div className="space-y-3 p-4">{[...Array(4)].map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-[#F2F2F2]" />)}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-12 text-center text-[13px] text-[#9A9A9A]">No customer roles found.</div>
        ) : (
          <div className="divide-y divide-[#E6E6E6]">
            {rows.map((role) => (
              <div key={role.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.2fr_0.9fr_110px_90px_110px] md:items-center">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-semibold text-[#1A1A1A]">{role.name}</span>
                    {role.isSystem ? (
                      <span className="inline-flex items-center gap-1 rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-2 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-[#6B6B6B]">
                        <Shield size={11} />
                        System
                      </span>
                    ) : null}
                  </div>
                  {role.description ? <p className="mt-1 text-[12.5px] text-[#6B6B6B]">{role.description}</p> : null}
                </div>
                <div className="font-mono text-[12px] text-[#6B6B6B]">{role.key}</div>
                <div className="text-[13px] text-[#1A1A1A]">{role._count?.customers ?? 0}</div>
                <StatusBadge status={role.status} />
                <div className="flex gap-1.5 md:justify-end">
                  <button type="button" onClick={() => startEdit(role)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Edit2 size={13} /></button>
                  <button type="button" onClick={() => setDeleting(role)} disabled={role.isSystem} className="flex h-7 w-7 items-center justify-center rounded border border-[#F2C9C9] text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={13} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
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
