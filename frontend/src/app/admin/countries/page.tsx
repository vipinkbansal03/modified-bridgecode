"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Edit2, Filter, Plus, Search, SlidersHorizontal, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminListToolbar, AdminSelect, AdminStatsGrid, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, LoadingButton } from "@/components/admin/AdminComponents";
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
};

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
  const [showColumns, setShowColumns] = useState(false);
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

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectAll, setSelectAll] = useState(false);
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

  // Handle select all on current page
  useEffect(() => {
    if (!selectAll) return;

    setSelectedIds((current) => {
      if (current.size === paginatedCountryIds.size && Array.from(current).every((id) => paginatedCountryIds.has(id))) {
        return current;
      }

      return new Set(paginatedCountryIds);
    });
  }, [selectAll, paginatedCountryIds]);

  const toggleSelectAll = () => {
    setSelectAll((current) => {
      const next = !current;
      if (!next) {
        setSelectedIds(new Set<string>());
      }
      return next;
    });
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set<string>());
    setSelectAll(false);
  };

  const handleBulkAction = async (action: "ENABLE" | "DISABLE" | "DELETE") => {
    if (selectedIds.size === 0) {
      showToast("No countries selected.", "error");
      return;
    }
    if (action === "DELETE") {
      const hasDefault = paginatedCountries.some((c) => selectedIds.has(c.id) && c.isDefault);
      if (hasDefault) {
        showToast("Default country cannot be deleted.", "error");
        return;
      }
    }
    try {
      await bulkMutation.mutateAsync({ ids: Array.from(selectedIds), action });
      showToast(`${action === "DELETE" ? "Deleted" : action === "ENABLE" ? "Enabled" : "Disabled"} ${selectedIds.size} countries.`);
      clearSelection();
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  function resetEditor() {
    setShowForm(false);
    setEditing(null);
    form.reset();
  }

  function openCreate() {
    setEditing(null);
    // Set base currency (USD or first active) as default
    const baseCurrency = currencies.find((c: { code: string; isBase?: boolean }) => c.code === "USD" || c.isBase) || currencies[0];
    if (baseCurrency) {
      form.setValues({
        ...form.values,
        currencyId: baseCurrency.id,
        currencyCode: baseCurrency.code,
        currencyName: baseCurrency.name,
        currencySymbol: baseCurrency.symbol,
      });
    }
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

  const columns = [
    ...(canUpdate
      ? [
          {
            key: "select",
            label: (
              <input
                type="checkbox"
                checked={selectAll}
                onChange={toggleSelectAll}
                className="h-4 w-4 rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                aria-label="Select all"
              />
            ),
            width: "40px",
            render: (row: Country) => (
              <input
                type="checkbox"
                checked={selectedIds.has(row.id)}
                onChange={() => toggleSelect(row.id)}
                className="h-4 w-4 rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                aria-label={`Select ${row.name}`}
              />
            ),
          },
        ]
      : []),
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
    { key: "code", label: "Code", render: (row: Country) => <span className="font-mono font-semibold text-[#1A1A1A]">{row.code}</span> },
    { key: "currency", label: "Currency", render: (row: Country) => `${row.currency?.name ?? "-"} (${row.currency?.symbol ?? "-"})` },
    { key: "isDefault", label: "Default", render: (row: Country) => (row.isDefault ? <span className="font-medium text-green-600">Default</span> : "-") },
    { key: "status", label: "Status" },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            label: "Actions",
            width: "110px",
            render: (row: Country) => (
              <div className="flex items-center gap-1.5">
                {canUpdate && (
                  <button
                    type="button"
                    onClick={() => openEdit(row)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                    title="Edit country details"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
                {canDelete && (
                  <button
                    type="button"
                    onClick={() => setDeleting(row)}
                    disabled={deleting?.id === row.id}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#F2C9C9] text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
                    title={row.isDefault ? "Default country cannot be deleted" : "Deactivate country"}
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];

  if (authLoading || !hasPermission("countries.view")) {
    return null;
  }

  return (
    <AdminLayout title="Countries" breadcrumb={[{ label: "Countries" }]}>
      <div className="space-y-5">
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
            onChange: setSearch,
            placeholder: "Search countries...",
            widthClassName: "max-w-[280px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: [statusFilter].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: refetch,
            isRefreshing: isLoading,
          }}
          primaryAction={canCreate ? { onClick: openCreate, label: "Add Country" } : undefined}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setSortBy("name");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
                onChange={(event) => setLimit(Number(event.target.value))}
                options={[
                  { value: "10", label: "10 per page" },
                  { value: "20", label: "20 per page" },
                  { value: "50", label: "50 per page" },
                ]}
              />
            </div>
          }
        />
          {selectedIds.size > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-[#E31E24]/30 bg-[#FFF5F5]/30 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-[#E31E24]">{selectedIds.size} rows selected</span>
                <div className="h-4 w-[1px] bg-[#E6E6E6]" />
                <div className="flex items-center gap-2">
                  <LoadingButton type="button" onClick={() => handleBulkAction("ENABLE")} loading={bulkMutation.isPending} loadingText="Enabling..." className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                    Enable
                  </LoadingButton>
                  <LoadingButton type="button" onClick={() => handleBulkAction("DISABLE")} loading={bulkMutation.isPending} loadingText="Disabling..." className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                    Disable
                  </LoadingButton>
                  <LoadingButton type="button" onClick={() => handleBulkAction("DELETE")} loading={bulkMutation.isPending} loadingText="Deleting..." className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#F2C9C9] bg-white px-3 text-[13px] font-medium text-red-500 hover:bg-red-50">
                    Delete
                  </LoadingButton>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={clearSelection} className="text-[13px] font-medium text-[#6B6B6B] hover:text-[#E31E24] hover:underline">
                  Clear selection
                </button>
              </div>
            </div>
          )}

        {showColumns ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="text-[13px] font-semibold text-[#1A1A1A]">Current filters</div>
            <div className="mt-2 flex flex-wrap gap-2 text-[12.5px] text-[#6B6B6B]">
              <span className="rounded-full border border-[#E6E6E6] px-3 py-1">Search: {debouncedSearch.trim() || "All"}</span>
              <span className="rounded-full border border-[#E6E6E6] px-3 py-1">Status: {statusFilter || "All"}</span>
              <span className="rounded-full border border-[#E6E6E6] px-3 py-1">Sort: {sortBy} / {sortDir}</span>
              <span className="rounded-full border border-[#E6E6E6] px-3 py-1">Page size: {limit}</span>
            </div>
          </div>
        ) : null}

        <div className="rounded-xl border border-[#E6E6E6] bg-white">
          <DataTable<Country>
            columns={columns}
            data={paginatedCountries}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No countries configured."
            onToggleStatus={canUpdate ? handleToggleStatus : undefined}
            statusLoadingId={togglingCountryId}
            isStatusDisabled={(c) => !canUpdate || (c.isDefault && c.status === "ACTIVE")}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3">
            <Pagination page={safePage} totalPages={totalPages} onPageChange={setPage} />
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
            
            <div className="md:col-span-2 pt-1">
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
      />

      {ToastComponent}
    </AdminLayout>
  );
}
