"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, ConfirmModal, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminTierCountries,
  useAdminTiers,
  useCreateTier,
  useDeleteTier,
  useReorderTiers,
  useUpdateTier,
  useUpdateTierCountries,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type TierRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  _count?: { customers?: number; pricing?: number; discounts?: number };
};

type CountryAvailability = {
  id: string;
  name: string;
  code: string;
  status: string;
  enabled: boolean;
  currency?: { code?: string | null } | null;
};

const emptyForm = { id: "", name: "", status: "ACTIVE", sortOrder: "0" };

export default function AdminTiersPage() {
  const { showToast, ToastComponent } = useToast();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [deleting, setDeleting] = useState<TierRow | null>(null);

  const { data: tiers = [], isLoading, refetch } = useAdminTiers();
  const { data: countries = [], isLoading: countriesLoading } = useAdminTierCountries(selectedTierId);
  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();
  const reorderTiers = useReorderTiers();
  const updateTierCountries = useUpdateTierCountries(selectedTierId);

  const rows = useMemo(
    () => [...(tiers as TierRow[])].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)),
    [tiers]
  );
  const selectedTier = rows.find((tier) => tier.id === selectedTierId) ?? null;

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const startCreate = () => {
    setForm(emptyForm);
    setShowForm(true);
  };

  const startEdit = (tier: TierRow) => {
    setForm({ id: tier.id, name: tier.name, status: tier.status, sortOrder: String(tier.sortOrder ?? 0) });
    setSelectedTierId(tier.id);
    setCountryOverrides({});
    setShowForm(true);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = { name: form.name.trim(), status: form.status, sortOrder: Number(form.sortOrder || 0) };
    if (!payload.name) {
      showToast("Tier name is required.", "error");
      return;
    }
    try {
      if (form.id) {
        await updateTier.mutateAsync({ id: form.id, ...payload });
        showToast("Tier updated.");
      } else {
        const result = await createTier.mutateAsync(payload);
        const createdId = result.data?.id;
        if (createdId) setSelectedTierId(createdId);
        showToast("Tier created.");
      }
      resetForm();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save tier."), "error");
    }
  };

  const handleReorder = async (nextRows: TierRow[]) => {
    try {
      await reorderTiers.mutateAsync(toSortOrderPayload(nextRows));
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder tiers."), "error");
      refetch();
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteTier.mutateAsync(deleting.id);
      if (selectedTierId === deleting.id) setSelectedTierId("");
      showToast("Tier deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete tier."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const saveCountries = async () => {
    try {
      await updateTierCountries.mutateAsync((countries as CountryAvailability[]).map((country) => ({
        countryId: country.id,
        enabled: countryOverrides[country.id] ?? country.enabled,
      })));
      showToast("Tier country availability saved.");
      setCountryOverrides({});
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save tier country availability."), "error");
    }
  };

  const enabledCountryCount = (countries as CountryAvailability[]).filter((country) => countryOverrides[country.id] ?? country.enabled).length;

  const isCreateModalOpen = showForm && !form.id;
  const isEditInlineOpen = showForm && !!form.id;

  const tierForm = (
    <form onSubmit={submit} className="rounded-xl border border-[#E6E6E6] bg-white p-5">
      {form.id ? (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Edit tier</h3>
          <button type="button" onClick={resetForm} className="text-[#9A9A9A] hover:text-[#1A1A1A]"><X size={16} /></button>
        </div>
      ) : null}
      <div className="grid gap-4 md:grid-cols-3">
        <AdminInput label="Name *" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="e.g. Diamond" />
        <AdminSelect label="Status" value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value })} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
        <AdminInput label="Sort Order" type="number" value={form.sortOrder} onChange={(event) => setForm({ ...form, sortOrder: event.target.value })} />
      </div>
      <button type="submit" disabled={createTier.isPending || updateTier.isPending} className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
        {createTier.isPending || updateTier.isPending ? "Saving..." : form.id ? "Update Tier" : "Create Tier"}
      </button>
    </form>
  );

  return (
    <AdminLayout title="Tiers" breadcrumb={[{ label: "Tiers" }]}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#6B6B6B]">Manage customer tiers used for assignment and tier-based pricing rules.</p>
        <button onClick={startCreate} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={14} /> New Tier
        </button>
      </div>

      {isEditInlineOpen ? <div className="mb-5">{tierForm}</div> : null}

      <Modal open={isCreateModalOpen} onClose={resetForm} title="New tier" panelClassName="max-w-3xl">
        {isCreateModalOpen ? tierForm : null}
      </Modal>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="mb-3 hidden grid-cols-[1fr_100px_110px_90px_110px] gap-3 px-10 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A] md:grid">
            <span>Name</span><span>Customers</span><span>Sort</span><span>Status</span><span />
          </div>
          {isLoading ? (
            <div className="space-y-3">{[...Array(3)].map((_, index) => <div key={index} className="h-16 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
          ) : rows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E6E6E6] py-10 text-center text-[13px] text-[#9A9A9A]">No tiers yet.</div>
          ) : (
            <SortableList
              items={rows}
              onReorder={handleReorder}
              handleAriaLabel="Drag tier to reorder"
              renderItem={(tier) => (
                <div className="grid gap-3 md:grid-cols-[1fr_100px_110px_90px_110px] md:items-center">
                  <button
                    type="button"
                    onClick={() => { setSelectedTierId(tier.id); setCountryOverrides({}); }}
                    className="text-left text-[14px] font-semibold text-[#1A1A1A] hover:text-[#E31E24]"
                  >
                    {tier.name}
                  </button>
                  <span className="text-[13px] text-[#1A1A1A]">{tier._count?.customers ?? 0}</span>
                  <span className="text-[13px] text-[#6B6B6B]">{tier.sortOrder}</span>
                  <StatusBadge status={tier.status} />
                  <div className="flex gap-1.5 md:justify-end">
                    <button type="button" onClick={() => startEdit(tier)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Edit2 size={13} /></button>
                    <button type="button" onClick={() => setDeleting(tier)} className="flex h-7 w-7 items-center justify-center rounded border border-[#F2C9C9] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                  </div>
                </div>
              )}
            />
          )}
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country Availability</h3>
              <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">A new tier is not recognized in any country until enabled here.</p>
            </div>
            {selectedTier && <span className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] text-[#6B6B6B]">{enabledCountryCount} enabled</span>}
          </div>

          {!selectedTier ? (
            <p className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-4 text-[13px] text-[#9A9A9A]">Select a tier to manage country availability.</p>
          ) : countriesLoading ? (
            <div className="h-28 animate-pulse rounded-md bg-[#F2F2F2]" />
          ) : (countries as CountryAvailability[]).length === 0 ? (
            <p className="text-[13px] text-[#9A9A9A]">No countries found.</p>
          ) : (
            <>
              <div className="mb-4 rounded-md bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#1A1A1A]">{selectedTier.name}</div>
              <div className="grid gap-2">
                {(countries as CountryAvailability[]).map((country) => (
                  <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2">
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                      <span className="text-[11.5px] text-[#9A9A9A]">{country.code}{country.currency?.code ? ` - ${country.currency.code}` : ""}</span>
                    </span>
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#E31E24]"
                      checked={countryOverrides[country.id] ?? country.enabled}
                      onChange={(event) => setCountryOverrides((current) => ({ ...current, [country.id]: event.target.checked }))}
                    />
                  </label>
                ))}
              </div>
              <button onClick={saveCountries} disabled={updateTierCountries.isPending} className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
                {updateTierCountries.isPending ? "Saving..." : "Save Availability"}
              </button>
            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleting}
        title="Delete tier?"
        message={deleting ? `Delete ${deleting.name}? This is blocked automatically if customers, tier pricing, or discounts still reference it.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteTier.isPending}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
