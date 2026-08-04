"use client";

import { useEffect, useLayoutEffect, useState, useMemo, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Edit2, PackageOpen, Plus, Search, Trash2, Warehouse } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { useAdminWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse, useAdminCountries, useAdminProducts, useBulkUpdateProducts, useAdminProductVariants } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { State } from "country-state-city";

type WarehouseRow = {
  id: string;
  name: string;
  countryId: string;
  state: string;
  address?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  postalCode?: string;
  gstin?: string;
  status: "ACTIVE" | "INACTIVE";
  country?: { code: string; name: string };
};

type WarehouseFormState = {
  id: string;
  name: string;
  countryId: string;
  state: string;
  address: string;
  addressLine1: string;
  addressLine2: string;
  city: string;
  postalCode: string;
  gstin: string;
  status: "ACTIVE" | "INACTIVE";
};

const emptyForm: WarehouseFormState = {
  id: "",
  name: "",
  countryId: "",
  state: "",
  address: "",
  addressLine1: "",
  addressLine2: "",
  city: "",
  postalCode: "",
  gstin: "",
  status: "ACTIVE",
};

// Product Row Component for the Modal
export default function WarehousesPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("inventory.manage")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canManage = hasPermission("inventory.manage");
  const { showToast, ToastComponent } = useToast();
  
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;
  
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [deleting, setDeleting] = useState<WarehouseRow | null>(null);
  const [form, setForm] = useState<WarehouseFormState>(emptyForm);

  const { data = { data: [], pagination: { total: 0, totalPages: 1 } }, isLoading } = useAdminWarehouses({ page, limit, search: debouncedSearch });
  const { data: countries = [] } = useAdminCountries();
  
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse(editing?.id || "");
  const deleteMutation = useDeleteWarehouse();

  const selectedCountry = countries.find((c: any) => c.id === form.countryId);
  const countryCode = selectedCountry?.code || "";

  const statesOfSelectedCountry = useMemo(() => {
    if (!countryCode) return [];
    try {
      return State.getStatesOfCountry(countryCode.toUpperCase()).map((s: any) => ({
        value: s.name,
        label: s.name,
      }));
    } catch (err) {
      console.error("Failed to load states for country code:", countryCode, err);
      return [];
    }
  }, [countryCode]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const handleEdit = (w: WarehouseRow) => {
    setEditing(w);
    setForm({
      id: w.id,
      name: w.name,
      countryId: w.countryId,
      state: w.state,
      address: w.address || "",
      addressLine1: w.addressLine1 || "",
      addressLine2: w.addressLine2 || "",
      city: w.city || "",
      postalCode: w.postalCode || "",
      gstin: w.gstin || "",
      status: w.status,
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setShowForm(true);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.countryId || !form.state) {
      showToast("Name, Country, and State are required", "error");
      return;
    }
    
    const country = countries.find((c: any) => c.id === form.countryId);
    if (country?.code === "IN" && form.status === "ACTIVE") {
      if (!form.gstin || form.gstin.length !== 15) {
        showToast("Indian warehouses must have a valid 15-character GSTIN to be ACTIVE", "error");
        return;
      }
    }

    try {
      const payload = {
        name: form.name,
        countryId: form.countryId,
        state: form.state,
        address: form.address || null,
        addressLine1: form.addressLine1 || null,
        addressLine2: form.addressLine2 || null,
        city: form.city || null,
        postalCode: form.postalCode || null,
        gstin: form.gstin || null,
        status: form.status,
      };

      if (editing) {
        await updateMutation.mutateAsync(payload);
        showToast("Warehouse updated successfully", "success");
      } else {
        await createMutation.mutateAsync(payload);
        showToast("Warehouse created successfully", "success");
      }
      setShowForm(false);
    } catch (err) {
      showToast(getAdminErrorMessage(err), "error");
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting.id);
      showToast("Warehouse deleted successfully", "success");
      setDeleting(null);
    } catch (err) {
      showToast(getAdminErrorMessage(err), "error");
    }
  };

  const stats = {
    total: data.pagination?.total || 0,
    active: data.data?.filter((w: WarehouseRow) => w.status === "ACTIVE").length || 0,
    inactive: data.data?.filter((w: WarehouseRow) => w.status === "INACTIVE").length || 0,
    indian: data.data?.filter((w: WarehouseRow) => w.country?.code === "IN").length || 0,
  };

  return (
    <AdminLayout title="Warehouses" breadcrumb={[{ label: "Commerce" }, { label: "Warehouses" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Warehouses" value={stats.total} subtitle="All configured origins" icon={<Warehouse size={18} />} />
          <StatCard title="Active Warehouses" value={stats.active} subtitle="Currently available" icon={<Plus size={18} />} color="bg-green-600" />
          <StatCard title="Inactive Warehouses" value={stats.inactive} subtitle="Hidden from routing" icon={<Trash2 size={18} />} color="bg-gray-600" />
          <StatCard title="Indian Warehouses" value={stats.indian} subtitle="Requires GSTIN" icon={<Search size={18} />} color="bg-[#0F6CBD]" />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <div className="relative w-full max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search warehouses..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canManage && (
                <button
                  type="button"
                  onClick={handleCreate}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Plus size={14} />
                  Add Warehouse
                </button>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-lg border border-[#F0F0F0]">
            <DataTable
              rowKey="id"
              data={data.data}
              isLoading={isLoading}
              emptyMessage="No warehouses found."
              columns={[
                { key: "name", label: "Name", render: (w: any) => <span className="font-medium text-[#1A1A1A]">{w.name}</span> },
                { key: "location", label: "Location", render: (w: any) => (
                    <div>
                      <div className="text-[#1A1A1A]">{w.state}</div>
                      <div className="text-[11.5px] text-[#9A9A9A]">{w.country?.name || w.countryId}</div>
                    </div>
                  )
                },
                { key: "gstin", label: "GSTIN", render: (w: any) => w.gstin ? <span className="font-mono text-[#555]">{w.gstin}</span> : <span className="text-[#9A9A9A] italic">None</span> },
                { key: "status", label: "Status", render: (w: any) => <StatusBadge status={w.status} /> },
                {
                  key: "actions",
                  label: "Actions",
                  render: (w: any) => (
                    <div className="flex items-center justify-end gap-2">
                      {canManage && (
                        <button
                          title="Assign Products"
                          onClick={() => router.push(`/admin/warehouses/${w.id}/assign?name=${encodeURIComponent(w.name)}`)}
                          className="rounded border border-[#E6E6E6] bg-white p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0] hover:text-[#1A1A1A]"
                        >
                          <PackageOpen size={15} />
                        </button>
                      )}
                      {canManage && (
                        <button
                          title="Edit Warehouse"
                          onClick={() => handleEdit(w)}
                          className="rounded border border-[#E6E6E6] bg-white p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0] hover:text-[#1A1A1A]"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                      {canManage && (
                        <button
                          title="Delete Warehouse"
                          onClick={() => setDeleting(w)}
                          className="rounded border border-[#E6E6E6] bg-white p-1.5 text-[#E31E24] hover:bg-[#FCE8E8]"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  ),
                },
              ]}
            />
          </div>
          
          {data.pagination?.totalPages > 1 && (
            <div className="mt-4 flex justify-end">
              <Pagination page={page} totalPages={data.pagination.totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={editing ? "Edit Warehouse" : "Add Warehouse"} panelClassName="max-w-2xl">
        <form onSubmit={handleSubmit} className="space-y-5 p-6">
          <AdminInput label="Warehouse Name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
          
          <div className="grid grid-cols-2 gap-5">
            <AdminSelect 
              label="Country" 
              value={form.countryId} 
              onChange={(e) => {
                setForm({ ...form, countryId: e.target.value, state: "" });
              }} 
              required
              options={[
                { value: "", label: "Select country..." },
                ...countries.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
              ]}
            />
            {statesOfSelectedCountry.length > 0 ? (
              <AdminSelect
                label="State / Province"
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                required
                options={[
                  { value: "", label: "Select state..." },
                  ...statesOfSelectedCountry
                ]}
              />
            ) : (
              <AdminInput 
                label="State / Province" 
                value={form.state} 
                onChange={(e) => setForm({ ...form, state: e.target.value })} 
                required 
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <AdminInput 
              label="Address Line 1" 
              value={form.addressLine1} 
              onChange={(e) => setForm({ ...form, addressLine1: e.target.value })} 
              required
              placeholder="Building/Street number"
            />
            <AdminInput 
              label="Address Line 2" 
              value={form.addressLine2} 
              onChange={(e) => setForm({ ...form, addressLine2: e.target.value })} 
              placeholder="Apartment, suite, unit (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <AdminInput 
              label="City" 
              value={form.city} 
              onChange={(e) => setForm({ ...form, city: e.target.value })} 
              required
              placeholder="City name"
            />
            <AdminInput 
              label="Postal / ZIP Code" 
              value={form.postalCode} 
              onChange={(e) => setForm({ ...form, postalCode: e.target.value })} 
              required
              placeholder="ZIP code"
            />
          </div>

          <AdminInput 
            label="GSTIN / Tax ID" 
            value={form.gstin} 
            onChange={(e) => setForm({ ...form, gstin: e.target.value })} 
            placeholder="15-character GSTIN for India"
          />

          <AdminSelect 
            label="Status" 
            value={form.status} 
            onChange={(e) => setForm({ ...form, status: e.target.value as any })}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" }
            ]}
          />

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={() => setShowForm(false)} className="rounded-md px-4 py-2 text-sm font-medium text-[#6B6B6B] hover:text-[#1A1A1A]">
              Cancel
            </button>
            <button type="submit" disabled={createMutation.isPending || updateMutation.isPending} className="rounded-md bg-[#E31E24] px-4 py-2 text-sm font-medium text-white hover:bg-[#C91A20] disabled:opacity-50">
              {editing ? "Save Changes" : "Create Warehouse"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Delete Warehouse"
        message={`Are you sure you want to delete ${deleting?.name}? This action cannot be undone.`}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteMutation.isPending}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
