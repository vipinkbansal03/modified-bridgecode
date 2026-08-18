"use client";

import { useEffect, useLayoutEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronRight, Edit2, PackageOpen, Plus, Search, Trash2, Warehouse } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, AdminMultiSelect, AdminStatsGrid, AdminListToolbar, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, LoadingButton, AdminBulkActionsBar } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { useAdminWarehouses, useCreateWarehouse, useUpdateWarehouse, useDeleteWarehouse, useAdminCountries } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { State } from "country-state-city";
import { useAdminForm } from "@/hooks/admin/useAdminForm";

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
  deliveryZones?: { countryId: string; states: string[] }[];
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
  deliveryZones: { countryId: string; states: string[] }[];
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
  deliveryZones: [],
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
  const [limit, setLimit] = useState(10);
  
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<WarehouseRow | null>(null);
  const [deleting, setDeleting] = useState<WarehouseRow | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/warehouses", {
        params: {
          search: debouncedSearch || undefined,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((w: any) => w.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} warehouses across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all warehouses.", "error");
    }
  };
  const [bulkAction, setBulkAction] = useState("");
  const [bulkLoading, setBulkLoading] = useState(false);

  const { data = { data: [], pagination: { total: 0, totalPages: 1 } }, isLoading, refetch } = useAdminWarehouses({ page, limit, search: debouncedSearch });
  const { data: countries = [] } = useAdminCountries();
  
  const createMutation = useCreateWarehouse();
  const updateMutation = useUpdateWarehouse(editing?.id || "");
  const deleteMutation = useDeleteWarehouse();

  const handleBulkAction = async () => {
    if (!selectedIds.length) {
      showToast("Select at least one warehouse first.", "error");
      return;
    }
    if (!bulkAction) {
      showToast("Select a bulk action to apply.", "error");
      return;
    }

    setBulkLoading(true);
    try {
      if (bulkAction === "delete") {
        if (!window.confirm(`Delete ${selectedIds.length} selected warehouse(s)?`)) {
          setBulkLoading(false);
          return;
        }
        await Promise.all(selectedIds.map(id => adminApi.delete(`/warehouses/${id}`)));
        showToast(`Successfully deleted ${selectedIds.length} warehouse(s).`, "success");
      } else {
        const nextStatus = bulkAction === "enable" ? "ACTIVE" : "INACTIVE";
        await Promise.all(selectedIds.map(id => adminApi.put(`/warehouses/${id}`, { status: nextStatus })));
        showToast(`Successfully ${bulkAction}d ${selectedIds.length} warehouse(s).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    } finally {
      setBulkLoading(false);
    }
  };

  const form = useAdminForm<WarehouseFormState>({
    initialValues: emptyForm,
    validate: (values) => {
      const errs: Partial<Record<keyof WarehouseFormState, string>> = {};
      if (!values.name) errs.name = "Warehouse name is required";
      if (!values.countryId) errs.countryId = "Country is required";
      if (!values.state) errs.state = "State / Province is required";
      if (!values.addressLine1) errs.addressLine1 = "Address line 1 is required";
      if (!values.city) errs.city = "City is required";
      if (!values.postalCode) errs.postalCode = "Postal / ZIP code is required";
      
      if (values.gstin) {
        const country = countries.find((c: any) => c.id === values.countryId);
        if (country?.code === "IN" && values.gstin.length !== 15) {
          errs.gstin = "Indian GSTIN must be exactly 15 characters";
        }
      }
      
      if (!values.deliveryZones || values.deliveryZones.length === 0) {
        // We'll attach this error to the first zone or general if we had a generic error field
        // Since we don't have a generic error field, we'll assign it to deliveryZones but we might need to display it in the UI.
        errs.deliveryZones = "At least one delivery country must be added" as any;
      } else {
        const hasEmptyStates = values.deliveryZones.some(z => !z.states || z.states.length === 0);
        if (hasEmptyStates) {
          errs.deliveryZones = "Every delivery country must have at least one state selected" as any;
        }
      }

      return errs;
    },
    onSubmit: async (values) => {
      const payload = {
        name: values.name,
        countryId: values.countryId,
        state: values.state,
        address: values.address || null,
        addressLine1: values.addressLine1 || null,
        addressLine2: values.addressLine2 || null,
        city: values.city || null,
        postalCode: values.postalCode || null,
        gstin: values.gstin || null,
        deliveryZones: values.deliveryZones,
        status: values.status,
      };

      try {
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
    },
    onClose: () => setShowForm(false)
  });

  const selectedCountry = countries.find((c: any) => c.id === form.values.countryId);
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
    form.reset({
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
      deliveryZones: w.deliveryZones || [],
      status: w.status,
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditing(null);
    form.reset(emptyForm);
    setShowForm(true);
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
        <AdminStatsGrid
          stats={[
            { title: "Total Warehouses", value: stats.total, subtitle: "All configured origins", icon: <Warehouse size={18} /> },
            { title: "Active Warehouses", value: stats.active, subtitle: "Currently available", icon: <Plus size={18} />, color: "bg-green-600" },
            { title: "Inactive Warehouses", value: stats.inactive, subtitle: "Hidden from routing", icon: <Trash2 size={18} />, color: "bg-gray-600" },
            { title: "Indian Warehouses", value: stats.indian, subtitle: "Requires GSTIN", icon: <Search size={18} />, color: "bg-[#0F6CBD]" }
          ]}
          isLoading={isLoading}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search warehouses...",
            widthClassName: "max-w-[280px]",
          }}
          primaryAction={
            canManage
              ? {
                  onClick: handleCreate,
                  label: "Add Warehouse",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
        />

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="overflow-hidden rounded-lg border border-[#F0F0F0]">
            <DataTable
              title="Warehouses"
              rowKey="id"
              data={data.data}
              isLoading={isLoading}
              emptyMessage="No warehouses found."
              enableSelection={canManage}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              totalItems={data.pagination.total}
              currentPage={page}
              pageSize={limit}
              totalPages={data.pagination.totalPages}
              onPageChange={setPage}
              onPageSizeChange={setLimit}
              pageSizeOptions={[10, 25, 50, 100]}
              onSelectAll={handleSelectAll}
              renderBulkActions={(selectedIds) => (
                <AdminBulkActionsBar
                  selectedCount={selectedIds.length}
                  onClear={() => setSelectedIds([])}
                  actionType={bulkAction}
                  onActionTypeChange={setBulkAction}
                  actions={[
                    { value: "enable", label: "Enable" },
                    { value: "disable", label: "Disable" },
                    { value: "delete", label: "Delete" }
                  ]}
                  onApply={handleBulkAction}
                  applyLoading={bulkLoading}
                />
              )}
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

      <Modal open={showForm} onClose={form.handleClose} title={editing ? "Edit Warehouse" : "Add Warehouse"} panelClassName="max-w-2xl">
        <form onSubmit={form.handleSubmit} className="space-y-5 p-6">
          <AdminInput 
            id="field-name"
            label="Warehouse Name" 
            value={form.values.name} 
            onChange={(e) => form.handleChange("name", e.target.value)} 
            onBlur={() => form.handleBlur("name")}
            error={form.errors.name}
            required 
          />
          
          <div className="grid grid-cols-2 gap-5">
            <AdminSelect 
              id="field-countryId"
              label="Country" 
              value={form.values.countryId} 
              onChange={(e) => {
                form.handleChange("countryId", e.target.value);
                form.handleChange("state", "");
              }}
              onBlur={() => form.handleBlur("countryId")}
              error={form.errors.countryId}
              required
              options={[
                { value: "", label: "Select country..." },
                ...countries.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
              ]}
            />
            {statesOfSelectedCountry.length > 0 ? (
              <AdminSelect
                id="field-state"
                label="State / Province"
                value={form.values.state}
                onChange={(e) => form.handleChange("state", e.target.value)}
                onBlur={() => form.handleBlur("state")}
                error={form.errors.state}
                required
                options={[
                  { value: "", label: "Select state..." },
                  ...statesOfSelectedCountry
                ]}
              />
            ) : (
              <AdminInput 
                id="field-state"
                label="State / Province" 
                value={form.values.state} 
                onChange={(e) => form.handleChange("state", e.target.value)} 
                onBlur={() => form.handleBlur("state")}
                error={form.errors.state}
                required 
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-5">
            <AdminInput 
              id="field-addressLine1"
              label="Address Line 1" 
              value={form.values.addressLine1} 
              onChange={(e) => form.handleChange("addressLine1", e.target.value)} 
              onBlur={() => form.handleBlur("addressLine1")}
              error={form.errors.addressLine1}
              required
              placeholder="Building/Street number"
            />
            <AdminInput 
              id="field-addressLine2"
              label="Address Line 2" 
              value={form.values.addressLine2} 
              onChange={(e) => form.handleChange("addressLine2", e.target.value)} 
              onBlur={() => form.handleBlur("addressLine2")}
              placeholder="Apartment, suite, unit (optional)"
            />
          </div>

          <div className="grid grid-cols-2 gap-5">
            <AdminInput 
              id="field-city"
              label="City" 
              value={form.values.city} 
              onChange={(e) => form.handleChange("city", e.target.value)} 
              onBlur={() => form.handleBlur("city")}
              error={form.errors.city}
              required
              placeholder="City name"
            />
            <AdminInput 
              id="field-postalCode"
              label="Postal / ZIP Code" 
              value={form.values.postalCode} 
              onChange={(e) => form.handleChange("postalCode", e.target.value)} 
              onBlur={() => form.handleBlur("postalCode")}
              error={form.errors.postalCode}
              required
              placeholder="ZIP code"
            />
          </div>

          <AdminInput 
            id="field-gstin"
            label="GSTIN / Tax ID (Optional)" 
            value={form.values.gstin} 
            onChange={(e) => form.handleChange("gstin", e.target.value)} 
            onBlur={() => form.handleBlur("gstin")}
            error={form.errors.gstin}
            placeholder="Tax ID (15-char GSTIN for India)"
          />

          <AdminSelect 
            label="Status" 
            value={form.values.status} 
            onChange={(e) => form.handleChange("status", e.target.value as any)}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" }
            ]}
          />

          <div className="pt-4 mt-2 border-t border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <h4 className="text-sm font-semibold text-[#111827]">
                Delivery Zones <span className="text-[#E31E24] ml-1">*</span>
              </h4>
              <button
                type="button"
                onClick={() => form.handleChange("deliveryZones", [...form.values.deliveryZones, { countryId: "", states: [] }])}
                className="text-[12px] font-semibold text-[#E31E24] hover:underline flex items-center gap-1"
              >
                <Plus size={14} /> Add Delivery Country
              </button>
            </div>
            
            {form.errors.deliveryZones && (
              <p className="mb-4 text-[12px] text-red-500">
                {form.errors.deliveryZones}
              </p>
            )}

            {form.values.deliveryZones.length === 0 && (
              <div className="text-[13px] text-gray-500 italic p-4 text-center bg-gray-50 rounded-md border border-gray-200">
                No delivery zones configured. Click "Add Delivery Country" to start.
              </div>
            )}
            
            <div className="space-y-4">
              {form.values.deliveryZones.map((zone, index) => {
                const zCountry = countries.find((c: any) => c.id === zone.countryId);
                const zCountryCode = zCountry?.code || "";
                let zStates: any[] = [];
                if (zCountryCode) {
                  try {
                    zStates = State.getStatesOfCountry(zCountryCode.toUpperCase()).map((s: any) => ({
                      value: s.name,
                      label: s.name,
                    }));
                  } catch (e) {
                    console.error("Failed to load states", e);
                  }
                }

                return (
                  <div key={index} className="p-3 border border-gray-200 rounded-md relative bg-gray-50">
                    <button
                      type="button"
                      onClick={() => {
                        const newZones = [...form.values.deliveryZones];
                        newZones.splice(index, 1);
                        form.handleChange("deliveryZones", newZones);
                      }}
                      className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-600 rounded-md hover:bg-gray-200 transition-colors"
                      title="Remove Zone"
                    >
                      <Trash2 size={16} />
                    </button>
                    
                    <div className="pr-8 space-y-4">
                      <AdminSelect 
                        label={`Delivery Country ${index + 1}`} 
                        value={zone.countryId} 
                        onChange={(e) => {
                          const newZones = [...form.values.deliveryZones];
                          newZones[index] = { ...newZones[index], countryId: e.target.value, states: [] };
                          form.handleChange("deliveryZones", newZones);
                        }} 
                        options={[
                          { value: "", label: "Select delivery country..." },
                          ...countries.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
                        ]}
                      />

                      {zone.countryId && zStates.length > 0 && (
                        <div className="space-y-1.5 relative">
                          <div className="text-[11px] text-gray-500 mb-2">Select the states in {zCountry?.name} that this warehouse can ship to.</div>
                          
                          <AdminMultiSelect
                            label="Delivery States (Required)"
                            options={zStates}
                            value={zone.states}
                            onChange={(nextValues) => {
                              const newZones = [...form.values.deliveryZones];
                              newZones[index].states = nextValues;
                              form.handleChange("deliveryZones", newZones);
                            }}
                            placeholder="Select states..."
                            selectAllLabel="Select All"
                          />
                        </div>
                      )}
                      
                      {zone.countryId && zStates.length === 0 && (
                        <div className="text-[12px] text-gray-500 italic p-2 bg-white rounded-md border border-gray-200">
                          No states configured for {zCountry?.name}. Wait for states to load, or change the country.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <button type="button" onClick={form.handleClose} className="rounded-md px-4 py-2 text-sm font-medium text-[#6B6B6B] hover:text-[#1A1A1A]">
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={form.isSubmitting || createMutation.isPending || updateMutation.isPending}
              loadingText="Processing..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-sm font-medium text-white hover:bg-[#C91A20]"
            >
              {editing ? "Save Changes" : "Create Warehouse"}
            </LoadingButton>
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
