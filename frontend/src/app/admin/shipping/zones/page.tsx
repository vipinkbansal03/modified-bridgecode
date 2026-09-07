"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X, Truck, Globe, Package, MapPin, ShieldCheck } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  ConfirmModal,
  DataTable,
  Modal,
  Pagination,
  StatusBadge,
  Tooltip,
  useToast,
  type Column,
  LoadingButton,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { getAdminErrorMessage } from "@/services/adminApi";
import {
  useAdminShippingProviders,
  useAdminShippingZones,
  useCreateShippingZone,
  useUpdateShippingZone,
  useDeleteShippingZone,
  useGetShippingDefaultRate,
  useBulkShippingZones,
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

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const bulkZones = useBulkShippingZones();

  // Search, filter, sorting and pagination states
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [providerFilter, setProviderFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"provider" | "charge" | "freeAbove" | "estimatedDays">("provider");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: zones, isLoading: zonesLoading, refetch, isFetching } = useAdminShippingZones();
  const { data: providers = [] } = useAdminShippingProviders();
  const { data: countries = [] } = useAdminCountries();
  const createMutation = useCreateShippingZone();
  const updateMutation = useUpdateShippingZone();
  const deleteMutation = useDeleteShippingZone();
  const rateMutation = useGetShippingDefaultRate();

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

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

  const totals = useMemo(() => {
    const total = zoneList.length;
    const active = zoneList.filter((z) => z.status === "ACTIVE").length;
    const countrySet = new Set<string>();
    zoneList.forEach((z) => {
      (z.countries || []).forEach((c) => {
        if (c.country?.code) countrySet.add(c.country.code);
      });
    });
    const providerSet = new Set(zoneList.map((z) => z.providerId));
    return {
      total,
      active,
      coveredCountries: countrySet.size,
      providers: providerSet.size,
    };
  }, [zoneList]);

  const filteredZones = useMemo(() => {
    const query = debouncedSearch.trim().toLowerCase();
    const result = zoneList.filter((zone) => {
      const providerName = (zone.provider?.displayName || zone.provider?.name || "").toLowerCase();
      const countryNames = (zone.countries || [])
        .map((c) => `${c.country?.name || ""} ${c.country?.code || ""}`)
        .join(" ")
        .toLowerCase();

      const matchesSearch = !query || providerName.includes(query) || countryNames.includes(query);
      const matchesProvider = !providerFilter || zone.providerId === providerFilter;
      const matchesStatus = !statusFilter || zone.status === statusFilter;

      return matchesSearch && matchesProvider && matchesStatus;
    });

    result.sort((a, b) => {
      const direction = sortDir === "asc" ? 1 : -1;
      if (sortBy === "charge") {
        return (Number(a.charge || 0) - Number(b.charge || 0)) * direction;
      }
      if (sortBy === "freeAbove") {
        return (Number(a.freeAbove || 0) - Number(b.freeAbove || 0)) * direction;
      }
      if (sortBy === "estimatedDays") {
        return String(a.estimatedDays || "").localeCompare(String(b.estimatedDays || "")) * direction;
      }
      const aName = a.provider?.displayName || a.provider?.name || "";
      const bName = b.provider?.displayName || b.provider?.name || "";
      return aName.localeCompare(bName) * direction;
    });

    return result;
  }, [zoneList, debouncedSearch, providerFilter, statusFilter, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filteredZones.length / pageSize));
  const paginatedZones = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredZones.slice(start, start + pageSize);
  }, [filteredZones, page, pageSize]);

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

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "delete") {
      if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected shipping zone(s)? This action cannot be undone.`)) {
        return;
      }
    }

    setBulkSaving(true);
    try {
      await bulkZones.mutateAsync({
        ids: selectedIds,
        action: bulkAction === "delete" ? "DELETE" : bulkAction === "activate" ? "ENABLE" : "DISABLE",
      });
      showToast(
        bulkAction === "delete" ? "Shipping zones deleted." : bulkAction === "activate" ? "Shipping zones activated." : "Shipping zones paused."
      );
      setSelectedIds([]);
      setBulkAction("");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to run bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };
  const columns: Column<ShippingZone>[] = [
    { key: "provider", label: "Provider", render: (zone) => zone.provider?.displayName ?? "-" },
    {
      key: "country",
      label: "Country",
      render: (zone) => {
        return (zone.countries ?? []).map((entry: any) => {
          const isCountryDisabled = entry.country.status === "INACTIVE";
          return `${entry.country.name} (${entry.country.code})${isCountryDisabled ? " (Disabled)" : ""}`;
        }).join(", ") || "-";
      }
    },
    { key: "charge", label: "Charge", render: (zone) => money(zone.charge) },
    { key: "freeAbove", label: "Free Above", render: (zone) => money(zone.freeAbove) },
    { key: "estimatedDays", label: "Est. Days", render: (zone) => zone.estimatedDays ?? "-" },
    {
      key: "status",
      label: "Status",
      render: (zone) => {
        const allCountriesInactive = zone.countries.length > 0 && zone.countries.every((c: any) => c.country.status === "INACTIVE");
        if (allCountriesInactive && zone.status === "ACTIVE") {
          return (
            <Tooltip content="All assigned countries are inactive in country settings" side="top">
              <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-800 ring-1 ring-inset ring-amber-600/20 cursor-default">
                INACTIVE (Country Disabled)
              </span>
            </Tooltip>
          );
        }
        return <StatusBadge status={zone.status} />;
      }
    },
    {
      key: "actions",
      label: "Actions",
      width: "110px",
      align: "left",
      render: (zone) => (
        <AdminRowActions
          edit={
            canUpdate
              ? {
                  onClick: () => openEdit(zone),
                  title: "Edit shipping zone",
                }
              : undefined
          }
          delete={
            canDelete
              ? {
                  onClick: () => setDeleteTarget(zone),
                  title: "Delete shipping zone",
                }
              : undefined
          }
        />
      ),
    },
  ];

  return (
    <AdminLayout title="Shipping Zones" breadcrumb={[{ label: "Shipping", href: "/admin/shipping" }, { label: "Zones" }]}>
      <div className="space-y-5">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/shipping"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Truck size={15} />
            <span>Providers</span>
          </Link>
          <Link
            href="/admin/shipping/zones"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Globe size={15} />
            <span>Zones</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {totals.total}
            </span>
          </Link>
          <Link
            href="/admin/shipping/boxes"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Package size={15} />
            <span>Boxes</span>
          </Link>
        </div>

        {/* KPI Stats Grid */}
        <AdminStatsGrid
          stats={[
            { title: "Total Zones", value: totals.total, subtitle: "Configured shipping zones", icon: <Globe size={18} />, isLoading: zonesLoading },
            { title: "Active Zones", value: totals.active, subtitle: "Available for checkout", icon: <ShieldCheck size={18} />, color: "bg-emerald-600", isLoading: zonesLoading },
            { title: "Covered Countries", value: totals.coveredCountries, subtitle: "Unique country destinations", icon: <MapPin size={18} />, color: "bg-sky-600", isLoading: zonesLoading },
            { title: "Active Carriers", value: totals.providers, subtitle: "Configured providers", icon: <Truck size={18} />, color: "bg-amber-600", isLoading: zonesLoading }
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
            placeholder: "Search provider or country...",
            widthClassName: "w-[260px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [providerFilter, statusFilter, sortBy !== "provider" ? sortBy : "", sortDir !== "asc" ? sortDir : ""].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: () => void refetch(),
            isRefreshing: isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: openCreate,
                  label: "Add Zone",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          onResetFilters={() => {
            setSearch("");
            setProviderFilter("");
            setStatusFilter("");
            setSortBy("provider");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-4 pt-2">
              <AdminSelect
                label="Provider"
                value={providerFilter}
                onChange={(e) => {
                  setProviderFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Providers" },
                  ...providerList.map((p) => ({ value: p.id, label: p.displayName })),
                ]}
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
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as "provider" | "charge" | "freeAbove" | "estimatedDays");
                  setPage(1);
                }}
                options={[
                  { value: "provider", label: "Provider" },
                  { value: "charge", label: "Charge Rate" },
                  { value: "freeAbove", label: "Free Above Threshold" },
                  { value: "estimatedDays", label: "Estimated Days" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
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

        {/* DataTable in rounded-xl container with Bottom Pagination */}
        <div>
          <DataTable<ShippingZone>
            title="Zones List"
            columns={columns}
            data={paginatedZones}
            isLoading={zonesLoading}
            rowKey="id"
            emptyMessage="No shipping zones configured."
            enableSelection={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalItems={filteredZones.length}
            currentPage={page}
            pageSize={pageSize}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setPage(1);
            }}
            pageSizeOptions={[10, 25, 50, 100]}
            renderBulkActions={(selectedIds) => (
              <AdminBulkActionsBar
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actionType={bulkAction}
                onActionTypeChange={setBulkAction}
                actions={[
                  { value: "activate", label: "Mark active" },
                  { value: "deactivate", label: "Mark inactive" },
                  { value: "delete", label: "Delete selected" }
                ]}
                onApply={handleBulkAction}
                applyLoading={bulkSaving}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
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
      </div>

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingZone ? "Edit Zone" : "Add Zone"}
        subtitle="Configure shipping provider, country coverage, rates, and delivery estimates."
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="shipping-zone-form"
              loading={form.isSubmitting || createMutation.isPending || updateMutation.isPending}
              loadingText="Saving..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              {editingZone ? "Save Changes" : "Create Zone"}
            </LoadingButton>
          </div>
        }
      >
        <form id="shipping-zone-form" onSubmit={form.handleSubmit} className="space-y-5 p-6">
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
              emptyMeansAll={false}
              error={form.errors.countryIds as string}
            />
            <AdminInput label={rateCurrency ? `Charge (${rateCurrency})` : "Charge"} required type="text" name="charge" value={form.values.charge} onChange={(e) => form.setFieldValue("charge", e.target.value.replace(/[^0-9.]/g, ""))} onBlur={form.handleBlur} error={form.errors.charge as string} disabled className="cursor-not-allowed bg-[#F5F5F5] text-[#6B6B6B]" />
            <AdminInput label={rateCurrency ? `Free Above (${rateCurrency})` : "Free Above"} type="text" name="freeAbove" value={form.values.freeAbove} onChange={(e) => form.setFieldValue("freeAbove", e.target.value.replace(/[^0-9.]/g, ""))} onBlur={form.handleBlur} error={form.errors.freeAbove as string} placeholder="Optional" />
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
        </form>
      </Modal>

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
