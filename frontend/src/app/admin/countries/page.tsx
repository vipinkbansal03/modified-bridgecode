"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Coins, Filter, Globe, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminListToolbar, AdminSelect, AdminStatsGrid, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, Tooltip, useToast, LoadingButton, type Column } from "@/components/admin/AdminComponents";
import { AdminBulkActionsBar } from "@/components/admin/AdminBulkActionsBar";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { useAdminCountries, useAdminCurrencies, useBulkCountries } from "@/hooks/admin/useAdminHooks";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { worldCountries, type WorldCountry } from "@/data/world-countries";

type Country = {
  id: string;
  name: string;
  code: string;
  currency: { id: string; code: string; name: string; symbol: string };
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
  dutyPercentage?: number;
  autoGenerateInvoice?: boolean;
};

type CountryFormState = {
  id: string;
  name: string;
  code: string;
  currencyId: string;
  currencyCode: string;
  currencyName: string;
  currencySymbol: string;
  status: "ACTIVE" | "INACTIVE";
  isDefault: boolean;
  dutyPercentage: string;
  autoGenerateInvoice: boolean;
};

const emptyForm: CountryFormState = {
  id: "",
  name: "",
  code: "",
  currencyId: "",
  currencyCode: "",
  currencyName: "",
  currencySymbol: "",
  status: "ACTIVE",
  isDefault: false,
  dutyPercentage: "0",
  autoGenerateInvoice: true,
};

const columnDefaults = {
  name: true,
  code: true,
  currency: true,
  autoGenerateInvoice: true,
  isDefault: true,
  status: true,
} as const;

function matchesSearch(country: Country, search: string) {
  const value = search.trim().toLowerCase();
  if (!value) return true;
  return [country.name, country.code, country.currency?.name, country.currency?.symbol].some((field) => String(field ?? "").toLowerCase().includes(value));
}

export default function CountriesPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("countries.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("countries.create");
  const canUpdate = hasPermission("countries.update");
  const canDelete = hasPermission("countries.delete");

  const { showToast, ToastComponent } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "code" | "currency" | "status">("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({ ...columnDefaults });
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [deleting, setDeleting] = useState<Country | null>(null);
  
  const form = useAdminForm({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Country name is required.";
      if (!values.code?.trim()) errors.code = "Country code is required.";
      else if (values.code.trim().length !== 2) errors.code = "Country code must be 2 letters.";
      if (!values.currencyId) errors.currencyId = "Currency is required.";
      if (values.isDefault && values.status === "INACTIVE") {
        errors.status = "Default country must remain active.";
      }
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const dutyPercentage = Number(values.dutyPercentage);
  
      const payload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        currencyId: values.currencyId,
        status: values.status,
        isDefault: values.isDefault,
        dutyPercentage: Number.isFinite(dutyPercentage) && dutyPercentage > 0 ? dutyPercentage : 0,
        autoGenerateInvoice: values.autoGenerateInvoice,
      };
  
      try {
        if (editing) {
          await adminApi.put(`/countries/${editing.id}`, payload);
          showToast("Country updated.");
        } else {
          await adminApi.post("/countries", payload);
          showToast("Country added.");
        }
        await refetch();
        resetEditor();
        resetForm();
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save country."), "error");
      }
    }
  });

  const [togglingCountryId, setTogglingCountryId] = useState<string | null>(null);

  const { data: countries = [], isLoading, refetch } = useAdminCountries({ includeInactive: true });
  const { data: currencies = [] } = useAdminCurrencies();
  const bulkMutation = useBulkCountries();

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, sortBy, sortDir, limit]);

  // World countries options for the searchable select (without currency info)
  const worldCountryOptions = useMemo(
    () => [
      { value: "", label: "Select a country..." },
      ...worldCountries.map((c) => ({
        value: c.code,
        label: `${c.name} (${c.code})`,
      })),
    ],
    [],
  );

  const currencyOptions = useMemo(
    () => [
      { value: "", label: "Select currency..." },
      ...currencies.map((c: { id: string; name: string; symbol: string; code: string }) => ({
        value: c.id,
        label: `${c.name} (${c.code})`,
      })),
    ],
    [currencies]
  );

  // Auto-populate name, code, and currency when world country is selected
  const handleWorldCountrySelect = useCallback(
    (countryCode: string) => {
      if (!countryCode) {
        form.setValues({ ...form.values, name: "", code: "", currencyId: "", currencyCode: "", currencyName: "", currencySymbol: "" });
        return;
      }
      const worldCountry = worldCountries.find((c) => c.code === countryCode);
      if (!worldCountry) return;

      // Find matching currency in available currencies
      const matchingCurrency = currencies.find(
        (c: { id: string; code: string; name: string; symbol: string }) => c.code === worldCountry.currencyCode
      );

      // Fallback to base currency (USD) if specific currency not available
      const baseCurrency = currencies.find((c: { id: string; code: string; isBase?: boolean }) => c.isBase === true || c.code === "USD");
      const finalCurrency = matchingCurrency ?? baseCurrency ?? currencies[0];

      form.setValues({
        ...form.values,
        name: worldCountry.name,
        code: worldCountry.code,
        currencyId: finalCurrency?.id ?? "",
        currencyCode: finalCurrency?.code ?? worldCountry.currencyCode,
        currencyName: finalCurrency?.name ?? worldCountry.currencyName,
        currencySymbol: finalCurrency?.symbol ?? worldCountry.currencySymbol,
      });
    },
    [currencies]
  );

  const filteredCountries = useMemo(() => {
    const items: Country[] = countries.filter((country: Country) => {
      const searchMatch = matchesSearch(country, debouncedSearch);
      const statusMatch = !statusFilter || country.status === statusFilter;
      return searchMatch && statusMatch;
    });

    items.sort((a: Country, b: Country) => {
      const direction = sortDir === "asc" ? 1 : -1;
      const left =
        sortBy === "code"
          ? a.code
          : sortBy === "currency"
            ? a.currency?.name ?? ""
            : sortBy === "status"
              ? a.status
              : a.name;
      const right =
        sortBy === "code"
          ? b.code
          : sortBy === "currency"
            ? b.currency?.name ?? ""
            : sortBy === "status"
              ? b.status
              : b.name;
      return String(left).localeCompare(String(right)) * direction;
    });

    return items;
  }, [countries, debouncedSearch, statusFilter, sortBy, sortDir]);

  const total = filteredCountries.length;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const safePage = Math.min(page, totalPages);
  const paginatedCountries = filteredCountries.slice((safePage - 1) * limit, safePage * limit);
  const paginatedCountryIds = useMemo(() => new Set(paginatedCountries.map((country) => country.id)), [paginatedCountries]);

  const stats = useMemo(
    () => ({
      total: countries.length,
      active: countries.filter((country: Country) => country.status === "ACTIVE").length,
      inactive: countries.filter((country: Country) => country.status === "INACTIVE").length,
    }),
    [countries],
  );

  const defaultCountry = useMemo(() => countries.find((c: Country) => c.isDefault) ?? null, [countries]);
  const defaultCountryValue = useMemo(() => {
    if (!defaultCountry) return "Not Set";
    return `${defaultCountry.name} | ${defaultCountry.code.toUpperCase()} | ${defaultCountry.status}`;
  }, [defaultCountry]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, debouncedSearch, statusFilter, sortBy, sortDir]);

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "DELETE") {
      setBulkDeleting(true);
      return;
    }
    try {
      await bulkMutation.mutateAsync({ ids: selectedIds, action: bulkAction });
      showToast(`${bulkAction === "ENABLE" ? "Enabled" : "Disabled"} ${selectedIds.length} countries.`);
      setSelectedIds([]);
      setBulkAction("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const confirmBulkDelete = async () => {
    const hasDefault = paginatedCountries.some((c) => selectedIds.includes(c.id) && c.isDefault);
    if (hasDefault) {
      showToast("Default country cannot be deleted.", "error");
      setBulkDeleting(false);
      return;
    }
    try {
      await bulkMutation.mutateAsync({ ids: selectedIds, action: "DELETE" });
      showToast(`Deleted ${selectedIds.length} countries.`);
      setSelectedIds([]);
      setBulkAction("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete countries."), "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  function resetEditor() {
    setShowForm(false);
    setEditing(null);
    form.reset();
  }

  function openCreate() {
    setEditing(null);
    const baseCurrency = currencies.find((c: { code: string; isBase?: boolean }) => c.code === "USD" || c.isBase) || currencies[0];
    form.setValues({
      ...emptyForm,
      ...(baseCurrency
        ? {
            currencyId: baseCurrency.id,
            currencyCode: baseCurrency.code,
            currencyName: baseCurrency.name,
            currencySymbol: baseCurrency.symbol,
          }
        : {}),
      autoGenerateInvoice: true,
    });
    setShowForm(true);
  }

  function openEdit(country: Country) {
    setEditing(country);
    form.setValues({
      id: country.id,
      name: country.name,
      code: country.code,
      currencyId: country.currency?.id ?? "",
      currencyCode: country.currency?.code ?? "",
      currencyName: country.currency?.name ?? "",
      currencySymbol: country.currency?.symbol ?? "",
      status: country.status,
      isDefault: country.isDefault,
      dutyPercentage: country.dutyPercentage != null ? String(country.dutyPercentage) : "0",
      autoGenerateInvoice: country.autoGenerateInvoice !== false,
    });
    setShowForm(true);
  }

  async function handleDelete() {
    if (!deleting) return;
    if (deleting.isDefault) {
      showToast("Default country cannot be deleted.", "error");
      setDeleting(null);
      return;
    }
    try {
      await adminApi.delete(`/countries/${deleting.id}`);
      showToast("Country deactivated.");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete country."), "error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleToggleAutoInvoice(country: Country) {
    const nextVal = !(country.autoGenerateInvoice !== false);
    try {
      await adminApi.put(`/countries/${country.id}`, { autoGenerateInvoice: nextVal });
      showToast(`Auto-generate invoice ${nextVal ? "enabled" : "disabled"} for ${country.name}.`);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update invoice setting."), "error");
    }
  }

  async function handleToggleStatus(country: Country) {
    if (country.isDefault && country.status === "ACTIVE") {
      showToast("Default country must remain active.", "error");
      return;
    }
    const nextStatus = country.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    setTogglingCountryId(country.id);
    try {
      await adminApi.put(`/countries/${country.id}`, { status: nextStatus });
      showToast(`${country.name} is now ${nextStatus.toLowerCase()}.`);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update status."), "error");
    } finally {
      setTogglingCountryId(null);
    }
  }

  const columns: Column<Country>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Country",
        render: (row: Country) => (
          <div>
            <div className="font-medium text-[#1A1A1A]">{row.name}</div>
            <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.isDefault ? "Default country" : "Standard country"}</div>
          </div>
        ),
      },
      { key: "code", label: "Code", width: "100px", render: (row: Country) => <span className="font-mono font-semibold text-[#1A1A1A]">{row.code}</span> },
      { key: "currency", label: "Currency", render: (row: Country) => `${row.currency?.name ?? "-"} (${row.currency?.symbol ?? "-"})` },
      {
        key: "autoGenerateInvoice",
        label: "Auto Invoice",
        width: "140px",
        render: (row: Country) => {
          const isEnabled = row.autoGenerateInvoice !== false;
          return canUpdate ? (
            <button
              type="button"
              onClick={() => handleToggleAutoInvoice(row)}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-semibold transition-colors ${
                isEnabled
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
                  : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
              }`}
              title="Click to toggle auto-generate invoice for this country"
            >
              <span className={`h-1.5 w-1.5 rounded-full ${isEnabled ? "bg-emerald-600" : "bg-gray-400"}`} />
              {isEnabled ? "Auto (ON)" : "Manual (OFF)"}
            </button>
          ) : (
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11.5px] font-medium ${
              isEnabled ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-600"
            }`}>
              {isEnabled ? "Enabled" : "Disabled"}
            </span>
          );
        },
      },
      { key: "isDefault", label: "Default", width: "100px", render: (row: Country) => (row.isDefault ? <span className="font-medium text-green-600">Default</span> : "-") },
      { key: "status", label: "Status", width: "120px" },
      ...(canUpdate || canDelete
        ? [
            {
              key: "actions",
              label: "Actions",
              width: "110px",
              align: "left" as const,
              render: (row: Country) => (
                <AdminRowActions
                  edit={
                    canUpdate
                      ? {
                          onClick: () => openEdit(row),
                          title: "Edit country details",
                        }
                      : undefined
                  }
                  delete={
                    canDelete
                      ? {
                          onClick: () => setDeleting(row),
                          title: row.isDefault ? "Default country cannot be deleted" : "Deactivate country",
                          disabled: row.isDefault || deleting?.id === row.id,
                        }
                      : undefined
                  }
                />
              ),
            },
          ]
        : []),
    ],
    [canUpdate, canDelete, deleting]
  );

  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      if (col.key in visibleColumns) {
        return visibleColumns[col.key as keyof typeof visibleColumns];
      }
      return true;
    });
  }, [columns, visibleColumns]);

  if (authLoading || !hasPermission("countries.view")) {
    return null;
  }

  return (
    <AdminLayout title="Countries" breadcrumb={[{ label: "Regions", href: "/admin/countries" }, { label: "Countries" }]}>
      <div className="space-y-5">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/countries"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-semibold shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Globe size={15} />
            <span>Countries</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {stats.total}
            </span>
          </Link>
          <Link
            href="/admin/currencies"
            className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
          >
            <Coins size={15} />
            <span>Currencies</span>
          </Link>
        </div>

        <AdminStatsGrid
          stats={[
            { title: "Total Countries", value: stats.total, subtitle: "All configured countries", icon: <SlidersHorizontal size={18} /> },
            { title: "Active Countries", value: stats.active, subtitle: "Currently available", icon: <Plus size={18} />, color: "bg-green-600" },
            { title: "Inactive Countries", value: stats.inactive, subtitle: "Hidden from active use", icon: <X size={18} />, color: "bg-gray-600" },
            { title: "Default Country", value: defaultCountryValue, subtitle: defaultCountry ? `Market currency: ${defaultCountry.currency?.code ?? ""}` : "Please configure a default country", icon: <Search size={18} />, color: "bg-[#0F6CBD]" }
          ]}
          isLoading={isLoading}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search countries...",
            widthClassName: "max-w-[280px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: [statusFilter].filter(Boolean).length,
          }}
          columns={{
            visibleColumns: visibleColumns,
            onToggleColumn: (key) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
            options: Object.keys(visibleColumns).map((key) => ({
              key,
              label: key === "isDefault" ? "Default" : key.charAt(0).toUpperCase() + key.slice(1),
            })),
          }}
          refresh={{
            onRefresh: refetch,
            isRefreshing: isLoading,
          }}
          primaryAction={canCreate ? { onClick: openCreate, label: "Add Country", icon: <Plus size={14} /> } : undefined}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setSortBy("name");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All status" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value as "name" | "code" | "currency" | "status")}
                options={[
                  { value: "name", label: "Name" },
                  { value: "code", label: "Code" },
                  { value: "currency", label: "Currency" },
                  { value: "status", label: "Status" },
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
              <AdminSelect
                label="Page Size"
                value={String(limit)}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                options={[
                  { value: "10", label: "10 per page" },
                  { value: "20", label: "20 per page" },
                  { value: "50", label: "50 per page" },
                  { value: "100", label: "100 per page" },
                ]}
              />
            </div>
          }
        />

        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<Country>
            title="Countries List"
            columns={filteredColumns}
            data={paginatedCountries}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No countries configured."
            enableSelection={canUpdate}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onSelectAll={(checked) => setSelectedIds(checked ? paginatedCountries.map((c) => c.id) : [])}
            totalItems={filteredCountries.length}
            currentPage={safePage}
            pageSize={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            onToggleStatus={canUpdate ? handleToggleStatus : undefined}
            statusLoadingId={togglingCountryId}
            isStatusDisabled={(c) => !canUpdate || (c.isDefault && c.status === "ACTIVE")}
            renderBulkActions={(selectedIds) => (
              <AdminBulkActionsBar
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actionType={bulkAction}
                onActionTypeChange={(val) => setBulkAction(val as "ENABLE" | "DISABLE" | "DELETE" | "")}
                actions={[
                  { value: "ENABLE", label: "Mark active" },
                  { value: "DISABLE", label: "Mark inactive" },
                  { value: "DELETE", label: "Delete selected" },
                ]}
                onApply={handleBulkAction}
                applyLoading={bulkMutation.isPending}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} alwaysShow={true} />
          </div>
        </div>
      </div>

      <Modal open={showForm} onClose={resetEditor} title={editing ? `Manage ${editing.name}` : "Configure country"} panelClassName="max-w-3xl">
        <form onSubmit={form.handleSubmit} className="space-y-6 p-6">
          <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
            {editing ? (
              <>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#1A1A1A]">Country Name (Auto-fetched)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={form.values.name}
                    className="h-10 w-full rounded-md border border-[#E6E6E6] bg-[#F7F7F7] px-3.5 text-[14px] text-[#6B6B6B] cursor-not-allowed"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-[13px] font-medium text-[#1A1A1A]">ISO Code (2 letters)</label>
                  <input
                    type="text"
                    readOnly
                    disabled
                    value={form.values.code}
                    className="h-10 w-full rounded-md border border-[#E6E6E6] bg-[#F7F7F7] px-3.5 text-[14px] text-[#6B6B6B] cursor-not-allowed font-mono uppercase"
                  />
                </div>
              </>
            ) : (
              <>
                <AdminSearchableSelect
                  label="Country Name (Pre-fetched)"
                  placeholder="Search for a country..."
                  searchPlaceholder="Search by name or code..."
                  options={worldCountryOptions}
                  {...form.getFieldProps("code")}
                  onChange={(event) => {
                    form.handleChange(event);
                    handleWorldCountrySelect(event.target.value);
                  }}
                  error={form.errors.code as string}
                  showSearch
                />
                <AdminInput
                  label="ISO Code (2 letters)"
                  placeholder="DE"
                  maxLength={2}
                  {...form.getFieldProps("code")}
                  error={form.errors.code as string}
                  readOnly
                  disabled
                  className="bg-[#F7F7F7] cursor-not-allowed font-mono"
                />
              </>
            )}

            <AdminSearchableSelect
              label="Currency"
              placeholder="Select currency..."
              searchPlaceholder="Search by name or code..."
              options={currencyOptions}
              {...form.getFieldProps("currencyId")}
              error={form.errors.currencyId as string}
              onChange={(event) => {
                form.handleChange(event);
                const selectedCurrency = currencies.find(
                  (c: { id: string; code: string; name: string; symbol: string }) => c.id === event.target.value
                );
                form.setValues({
                  ...form.values,
                  currencyId: event.target.value,
                  currencyCode: selectedCurrency?.code ?? "",
                  currencyName: selectedCurrency?.name ?? "",
                  currencySymbol: selectedCurrency?.symbol ?? "",
                });
              }}
              showSearch
            />

            <AdminSelect
              label="Status"
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
              {...form.getFieldProps("status")}
              error={form.errors.status as string}
            />
            <AdminInput
              label="Customs Duty %"
              type="number"
              min="0"
              step="0.01"
              placeholder="e.g. 18"
              {...form.getFieldProps("dutyPercentage")}
              error={form.errors.dutyPercentage as string}
            />
            
            <div className="md:col-span-2 pt-1 space-y-3">
              <label className="flex items-start gap-2.5 text-[13.5px] font-medium text-[#1A1A1A] cursor-pointer">
                <input
                  type="checkbox"
                  name="autoGenerateInvoice"
                  checked={form.values.autoGenerateInvoice}
                  onChange={form.handleChange}
                  className="mt-0.5 h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24]"
                />
                <div>
                  <div>Auto-Generate Invoice for Orders</div>
                  <p className="text-[12px] font-normal text-[#6B6B6B]">
                    When enabled, invoices are automatically generated when customers place orders from this country. When disabled, admin can upload or create invoices manually.
                  </p>
                </div>
              </label>

              <label className="inline-flex items-center gap-2.5 text-[13.5px] font-medium text-[#1A1A1A] cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefault"
                  checked={form.values.isDefault}
                  onChange={form.handleChange}
                  className="h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24]"
                />
                Set as default country
              </label>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#E6E6E6] pt-4">
            <p className="text-[12.5px] text-[#6B6B6B]">Default country must stay active. Deleting a country only deactivates it in the backend.</p>
            <div className="flex gap-2">
              <button type="button" onClick={resetEditor} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                Cancel
              </button>
              <LoadingButton type="submit" loading={form.isSubmitting} loadingText="Processing..." className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                {editing ? "Save country" : "Create country"}
              </LoadingButton>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Deactivate country?"
        message={deleting ? `Deactivate ${deleting.name}? It will remain in the list as inactive and stay available for historical records.` : ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        isLoading={bulkMutation.isPending}
        danger
      />

      <ConfirmModal
        open={bulkDeleting}
        title="Delete Selected Countries?"
        message={`Are you sure you want to delete ${selectedIds.length} selected countries? Default country will not be deleted.`}
        confirmText="Delete"
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleting(false)}
        isLoading={bulkMutation.isPending}
        danger
      />

      {ToastComponent}
    </AdminLayout>
  );
}
