"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminListToolbar, AdminSelect, ConfirmModal, DataTable, StatusBadge, useToast, type Column, LoadingButton } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { getAdminErrorMessage } from "@/services/adminApi";
import {
  useAdminShippingProviders,
  useAdminShippingZones,
  useCreateShippingZone,
  useUpdateShippingZone,
  useDeleteShippingZone,
  useGetShippingDefaultRate,
} from "@/hooks/admin/useAdminHooks";
import { useAdminCountries } from "@/hooks/admin/useAdminHooks";
import { useAdminForm } from "@/hooks/admin/useAdminForm";

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
  const [rateLoading, setRateLoading] = useState(false);
  const [rateCurrency, setRateCurrency] = useState("");

  const { data: zones, isLoading: zonesLoading } = useAdminShippingZones();
  const { data: providers = [] } = useAdminShippingProviders();
  const { data: countries = [] } = useAdminCountries();
  const createMutation = useCreateShippingZone();
  const updateMutation = useUpdateShippingZone();
  const deleteMutation = useDeleteShippingZone();
  const rateMutation = useGetShippingDefaultRate();

  const form = useAdminForm<ZoneForm>({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: Partial<Record<keyof ZoneForm, string>> = {};
      if (!values.providerId) errors.providerId = "Provider is required";
      if (!values.countryIds || values.countryIds.length === 0) errors.countryIds = "At least one country is required";
      if (!values.charge) errors.charge = "Charge is required";
      return errors;
    },
    onSubmit: async (values) => {
      if (!values.providerId || values.countryIds.length === 0 || !values.charge) {
        showToast("Select a provider and at least one country to fetch the default rate.", "error");
        return;
      }
      const payload = {
        providerId: values.providerId,
        countryIds: values.countryIds,
        charge: Number(values.charge),
        freeAbove: values.freeAbove ? Number(values.freeAbove) : null,
        estimatedDays: values.estimatedDays.trim() || null,
        status: values.status,
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
    },
  });

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

  useEffect(() => {
    if (!form.values.providerId || form.values.countryIds.length === 0) return;
    const firstCountry = countryList.find((c) => c.id === form.values.countryIds[0]);
    if (!firstCountry) return;

    const timer = setTimeout(() => {
      setRateLoading(true);
      rateMutation
        .mutateAsync({ id: form.values.providerId, countryCode: firstCountry.code })
        .then((result) => {
          setRateCurrency(result.currency ?? "");
          form.setValues({
            ...form.values,
            charge: result.charge != null ? String(result.charge) : "",
            estimatedDays: result.estimatedDays ?? "",
          });
        })
        .catch(() => {
          setRateCurrency("");
          form.setValues({ ...form.values, charge: "", estimatedDays: "" });
        })
        .finally(() => setRateLoading(false));
    }, 300);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.values.providerId, form.values.countryIds]);

  function openCreate() {
    setEditingZone(null);
    form.reset();
    setFormOpen(true);
  }

  function openEdit(zone: ShippingZone) {
    setEditingZone(zone);
    form.setValues({
      providerId: zone.providerId,
      countryIds: (zone.countries ?? []).map((entry) => entry.country.id),
      charge: String(zone.charge ?? ""),
      freeAbove: zone.freeAbove === null || zone.freeAbove === undefined ? "" : String(zone.freeAbove),
      estimatedDays: zone.estimatedDays ?? "",
      status: zone.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
    });
    setFormOpen(true);
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
        <AdminListToolbar
          leftExtra={
            <div className="flex gap-2 border-b border-[#E6E6E6]">
              <Link href="/admin/shipping" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
                Providers
              </Link>
              <span className="border-b-2 border-[#E31E24] px-4 py-2 text-[13px] font-semibold text-[#111]">Zones</span>
              <Link href="/admin/shipping/boxes" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
                Boxes
              </Link>
            </div>
          }
          primaryAction={canCreate ? { onClick: openCreate, label: "Add Zone" } : undefined}
        />

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

            <form onSubmit={form.handleSubmit} className="space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <AdminSelect
                  label="Provider"
                  required
                  options={providerOptions}
                  {...form.getFieldProps("providerId")}
                  onChange={(event) => {
                    setRateCurrency("");
                    form.setValues({ ...form.values, providerId: event.target.value, charge: "", estimatedDays: "" });
                  }}
                  error={form.errors.providerId as string}
                />
                <AdminMultiSearchableSelect
                  label="Countries"
                  required
                  options={countryMultiOptions}
                  values={form.values.countryIds}
                  onValuesChange={(values) => {
                    if (values.length === 0) setRateCurrency("");
                    form.setValues({ ...form.values, countryIds: values, charge: values.length ? form.values.charge : "", estimatedDays: values.length ? form.values.estimatedDays : "" });
                  }}
                  allowSelectAll
                  selectAllLabel="Select All"
                  error={form.errors.countryIds as string}
                />
                <AdminInput label={rateCurrency ? `Charge (${rateCurrency})` : "Charge"} required type="number" min="0" step="0.01" {...form.getFieldProps("charge")} error={form.errors.charge as string} disabled className="cursor-not-allowed bg-[#F5F5F5] text-[#6B6B6B]" />
                <AdminInput label={rateCurrency ? `Free Above (${rateCurrency})` : "Free Above"} type="number" min="0" step="0.01" {...form.getFieldProps("freeAbove")} error={form.errors.freeAbove as string} placeholder="Optional" />
                <AdminInput label="Estimated Days" required {...form.getFieldProps("estimatedDays")} error={form.errors.estimatedDays as string} disabled className="cursor-not-allowed bg-[#F5F5F5] text-[#6B6B6B]" />
                <AdminSelect
                  label="Status"
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  {...form.getFieldProps("status")}
                  error={form.errors.status as string}
                />
              </div>
              <p className="text-[12px] text-[#6B6B6B]">
                {rateLoading ? "Fetching default rate from provider..." : "Charge and estimated days are fetched from the selected provider and are read-only."}
              </p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setFormOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]">
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  loading={form.isSubmitting || createMutation.isPending || updateMutation.isPending}
                  loadingText="Saving..."
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  {editingZone ? "Save Changes" : "Create Zone"}
                </LoadingButton>
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
