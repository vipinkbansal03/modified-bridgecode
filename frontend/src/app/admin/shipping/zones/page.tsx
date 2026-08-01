"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminMultiSelect, AdminSelect, ConfirmModal, DataTable, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { getAdminErrorMessage } from "@/services/adminApi";
import {
  useAdminShippingProviders,
  useAdminShippingZones,
  useCreateShippingZone,
  useUpdateShippingZone,
  useDeleteShippingZone,
} from "@/hooks/admin/useAdminHooks";
import { useAdminCountries } from "@/hooks/admin/useAdminHooks";

interface Provider {
  id: string;
  name: string;
  displayName: string;
  isEnabled: boolean;
}

interface Country {
  id: string;
  name: string;
  code: string;
}

interface ShippingZone {
  id: string;
  providerId: string;
  charge: string | number;
  freeAbove: string | number | null;
  estimatedDays: string | null;
  status: string;
  provider: Provider;
  countries: { country: Country }[];
}

interface ZoneForm {
  providerId: string;
  countryIds: string[];
  charge: string;
  freeAbove: string;
  estimatedDays: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm: ZoneForm = {
  providerId: "",
  countryIds: [],
  charge: "",
  freeAbove: "",
  estimatedDays: "",
  status: "ACTIVE",
};

function money(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toFixed(2);
}

export default function ShippingZonesPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("shipping.manage");
  const canUpdate = hasPermission("shipping.manage");
  const canDelete = hasPermission("shipping.delete");

  const { showToast, ToastComponent } = useToast();
  const [formOpen, setFormOpen] = useState(false);
  const [editingZone, setEditingZone] = useState<ShippingZone | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ShippingZone | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm);

  const { data: zones, isLoading: zonesLoading } = useAdminShippingZones();
  const { data: providers = [] } = useAdminShippingProviders();
  const { data: countries = [] } = useAdminCountries();
  const createMutation = useCreateShippingZone();
  const updateMutation = useUpdateShippingZone();
  const deleteMutation = useDeleteShippingZone();

  const zoneList: ShippingZone[] = zones ?? [];
  const providerList: Provider[] = providers ?? [];
  const countryList: Country[] = countries ?? [];

  const providerOptions = useMemo(
    () => [{ value: "", label: "Select provider" }, ...providerList.map((p) => ({ value: p.id, label: `${p.displayName}${p.isEnabled ? "" : " (disabled)"}` }))],
    [providerList],
  );

  const countryMultiOptions = useMemo(
    () => countryList.map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
    [countryList],
  );

  function openCreate() {
    setEditingZone(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(zone: ShippingZone) {
    setEditingZone(zone);
    setForm({
      providerId: zone.providerId,
      countryIds: (zone.countries ?? []).map((entry) => entry.country.id),
      charge: String(zone.charge ?? ""),
      freeAbove: zone.freeAbove === null || zone.freeAbove === undefined ? "" : String(zone.freeAbove),
      estimatedDays: zone.estimatedDays ?? "",
      status: zone.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    });
    setFormOpen(true);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.providerId || form.countryIds.length === 0 || !form.charge) {
      showToast("Provider, at least one country, and charge are required.", "error");
      return;
    }
    const payload = {
      providerId: form.providerId,
      countryIds: form.countryIds,
      charge: Number(form.charge),
      freeAbove: form.freeAbove ? Number(form.freeAbove) : null,
      estimatedDays: form.estimatedDays.trim() || null,
      status: form.status,
    };
    try {
      if (editingZone) {
        await updateMutation.mutateAsync({ id: editingZone.id, ...payload });
        showToast("Shipping zone updated.");
      } else {
        await createMutation.mutateAsync(payload);
        showToast("Shipping zone created.");
      }
      setFormOpen(false);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not save shipping zone."), "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteMutation.mutateAsync(deleteTarget.id);
      showToast("Shipping zone deleted.");
      setDeleteTarget(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not delete shipping zone."), "error");
    }
  }

  const columns: Column<ShippingZone>[] = [
    { key: "provider", label: "Provider", render: (zone) => zone.provider?.displayName ?? "-" },
    { key: "country", label: "Country", render: (zone) => (zone.countries ?? []).map((entry) => `${entry.country.name} (${entry.country.code})`).join(", ") || "-" },
    { key: "charge", label: "Charge", render: (zone) => money(zone.charge) },
    { key: "freeAbove", label: "Free Above", render: (zone) => money(zone.freeAbove) },
    { key: "estimatedDays", label: "Est. Days", render: (zone) => zone.estimatedDays ?? "-" },
    { key: "status", label: "Status", render: (zone) => <StatusBadge status={zone.status} /> },
    {
      key: "actions",
      label: "Actions",
      render: (zone) => (
        <div className="flex items-center gap-2">
          {canUpdate && (
            <button onClick={() => openEdit(zone)} className="rounded-md border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:text-[#111]" title="Edit zone">
              <Edit2 size={14} />
            </button>
          )}
          {canDelete && (
            <button onClick={() => setDeleteTarget(zone)} className="rounded-md border border-red-100 p-2 text-red-600 hover:bg-red-50" title="Delete zone">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Shipping Zones" breadcrumb={[{ label: "Shipping", href: "/admin/shipping" }, { label: "Zones" }]}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 border-b border-[#E6E6E6]">
            <Link href="/admin/shipping" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Providers
            </Link>
            <span className="border-b-2 border-[#E31E24] px-4 py-2 text-[13px] font-semibold text-[#111]">Zones</span>
            <Link href="/admin/shipping/boxes" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Boxes
            </Link>
          </div>
          {canCreate && (
            <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
              <Plus size={15} /> Add Zone
            </button>
          )}
        </div>

        <DataTable columns={columns} data={zoneList} isLoading={zonesLoading} rowKey="id" emptyMessage="No shipping zones configured." />
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#111]">{editingZone ? "Edit Zone" : "Add Zone"}</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-md p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#111]">
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminSelect label="Provider" options={providerOptions} value={form.providerId} onChange={(event) => setForm((current) => ({ ...current, providerId: event.target.value }))} />
                <AdminMultiSelect label="Countries" options={countryMultiOptions} value={form.countryIds} onChange={(values) => setForm((current) => ({ ...current, countryIds: values }))} selectAllLabel="Select All" />
                <AdminInput label="Charge" type="number" min="0" step="0.01" value={form.charge} onChange={(event) => setForm((current) => ({ ...current, charge: event.target.value }))} />
                <AdminInput label="Free Above" type="number" min="0" step="0.01" value={form.freeAbove} onChange={(event) => setForm((current) => ({ ...current, freeAbove: event.target.value }))} placeholder="Optional" />
                <AdminInput label="Estimated Days" value={form.estimatedDays} onChange={(event) => setForm((current) => ({ ...current, estimatedDays: event.target.value }))} placeholder="e.g. 3-5 business days" />
                <AdminSelect
                  label="Status"
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  value={form.status}
                  onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as ZoneForm["status"] }))}
                />
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
                  {createMutation.isPending || updateMutation.isPending ? "Saving..." : editingZone ? "Save Changes" : "Create Zone"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <ConfirmModal
        open={Boolean(deleteTarget)}
        title="Delete shipping zone?"
        message={`This removes the ${(deleteTarget?.countries ?? []).map((entry) => entry.country.code).join(", ") || "selected countries"} zone for ${deleteTarget?.provider?.displayName ?? "this provider"}.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
        isLoading={deleteMutation.isPending}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
