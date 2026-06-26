"use client";

import { useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { AdminInput, AdminSelect, ConfirmModal, DataTable, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  useAdminCountries,
  useAdminTaxRules,
  useCreateTaxRule,
  useDeleteTaxRule,
  useUpdateTaxRule,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type TaxRule = {
  id: string;
  name: string;
  type: "CGST" | "SGST" | "VAT" | "SALES_TAX";
  percentage: string | number;
  countryId: string;
  country?: { name: string; code: string };
  status: string;
  sortOrder: number;
};

const emptyForm = { id: "", name: "", type: "VAT", percentage: "", countryId: "", status: "ACTIVE", sortOrder: "0" };

export default function AdminTaxPage() {
  const { showToast, ToastComponent } = useToast();
  const [countryId, setCountryId] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TaxRule | null>(null);
  const { data: countries = [] } = useAdminCountries();
  const { data, isLoading } = useAdminTaxRules({ page: 1, limit: 100, countryId: countryId || undefined });
  const createRule = useCreateTaxRule();
  const updateRule = useUpdateTaxRule();
  const deleteRule = useDeleteTaxRule();
  const rules = (data?.data ?? []) as TaxRule[];

  const countryOptions = [
    { value: "", label: "All countries" },
    ...countries.map((country: { id: string; name: string; code: string }) => ({ value: country.id, label: `${country.name} (${country.code})` })),
  ];

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = {
        name: form.name,
        type: form.type,
        percentage: form.percentage,
        countryId: form.countryId,
        status: form.status,
        sortOrder: form.sortOrder,
      };
      if (form.id) {
        await updateRule.mutateAsync({ id: form.id, ...payload });
        showToast("Tax rule updated.", "success");
      } else {
        await createRule.mutateAsync(payload);
        showToast("Tax rule created.", "success");
      }
      setForm(emptyForm);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not save tax rule."), "error");
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      showToast("Tax rule deleted.", "success");
      setDeleteTarget(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not delete tax rule."), "error");
    }
  }

  const columns: Column<TaxRule>[] = [
    { key: "name", label: "Rule", render: (row) => <div><div className="font-medium">{row.name}</div><div className="text-[11.5px] text-[#9A9A9A]">{row.country?.name} ({row.country?.code})</div></div> },
    { key: "type", label: "Type", render: (row) => row.type.replace("_", " ") },
    { key: "percentage", label: "Rate", render: (row) => `${Number(row.percentage).toFixed(2)}%` },
    { key: "sortOrder", label: "Order" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "",
      width: "110px",
      render: (row) => (
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setForm({ id: row.id, name: row.name, type: row.type, percentage: String(row.percentage), countryId: row.countryId, status: row.status, sortOrder: String(row.sortOrder) })} className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#E31E24]">
            <Pencil size={15} />
          </button>
          <button type="button" onClick={() => setDeleteTarget(row)} className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#E31E24]">
            <Trash2 size={15} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Tax Configuration" breadcrumb={[{ label: "Tax Configuration" }]}>
      <div className="mb-5 rounded-lg border border-[#E6E6E6] bg-white p-5">
        <div className="mb-4 flex items-center gap-2">
          <Plus size={17} className="text-[#E31E24]" />
          <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{form.id ? "Edit tax rule" : "Add tax rule"}</h2>
        </div>
        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          <AdminSelect label="Country" value={form.countryId} onChange={(event) => setForm((current) => ({ ...current, countryId: event.target.value }))} options={countryOptions} />
          <AdminInput label="Name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="GST / CGST / VAT" />
          <AdminSelect
            label="Type"
            value={form.type}
            onChange={(event) => setForm((current) => ({ ...current, type: event.target.value }))}
            options={[
              { value: "CGST", label: "CGST" },
              { value: "SGST", label: "SGST" },
              { value: "VAT", label: "VAT" },
              { value: "SALES_TAX", label: "Sales Tax" },
            ]}
          />
          <AdminInput label="Percentage" type="number" min="0" max="100" step="0.01" value={form.percentage} onChange={(event) => setForm((current) => ({ ...current, percentage: event.target.value }))} />
          <AdminSelect label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
          <div className="flex items-end gap-2">
            <AdminInput label="Order" type="number" min="0" value={form.sortOrder} onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))} />
            <button type="submit" disabled={createRule.isPending || updateRule.isPending} className="h-10 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#C91920] disabled:opacity-60">
              {form.id ? "Save" : "Add"}
            </button>
          </div>
        </form>
      </div>

      <div className="mb-4 w-[280px]">
        <AdminSelect label="Filter by country" value={countryId} onChange={(event) => setCountryId(event.target.value)} options={countryOptions} />
      </div>

      <DataTable columns={columns} data={rules} isLoading={isLoading} rowKey="id" emptyMessage="No tax rules configured." />
      <ConfirmModal open={!!deleteTarget} title="Delete tax rule?" message={`Delete ${deleteTarget?.name ?? "this tax rule"}?`} onConfirm={confirmDelete} onCancel={() => setDeleteTarget(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
