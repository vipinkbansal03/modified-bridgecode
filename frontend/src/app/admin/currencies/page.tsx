"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Edit2, Filter, Plus, RefreshCw, Search, SlidersHorizontal, SquareCheckBig, Trash2, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, ConfirmModal, Pagination, StatCard, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCurrencyDashboard,
  useAdminCurrenciesPaged,
  useBulkCurrencies,
  useCreateCurrency,
  useDeleteCurrency,
  useExportCurrencies,
  useImportCurrencies,
  usePreviewCurrencyImport,
  useSyncCurrencyRates,
  useUpdateCurrency,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type CurrencyRow = {
  id: string;
  name: string;
  code: string;
  symbol: string;
  exchangeRate: string | number;
  isBase: boolean;
  status: "ACTIVE" | "INACTIVE";
  updatedAt?: string;
  _count?: { countries?: number };
};

type CurrencyDashboard = {
  totalCurrencies: number;
  activeCurrencies: number;
  inactiveCurrencies: number;
  baseCurrencies: number;
  mappedCountries: number;
  recentlyUpdated: CurrencyRow[];
};

type CurrencyFormState = {
  id: string;
  name: string;
  code: string;
  symbol: string;
  exchangeRate: string;
  isBase: boolean;
  status: "ACTIVE" | "INACTIVE";
};

type ImportReport = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: Array<{ row: number; field: string; message: string }>;
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

const emptyForm: CurrencyFormState = {
  id: "",
  name: "",
  code: "",
  symbol: "",
  exchangeRate: "1",
  isBase: false,
  status: "ACTIVE",
};

const columnDefaults = {
  name: true,
  code: true,
  symbol: true,
  exchangeRate: true,
  isBase: true,
  status: true,
  countries: true,
  updatedAt: true,
} as const;

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatRate(value: string | number) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return "-";
  return rate.toFixed(6);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function CurrenciesPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("currencies.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("currencies.create");
  const canUpdate = hasPermission("currencies.update");
  const canDelete = hasPermission("currencies.delete");

  const { showToast, ToastComponent } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("code");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState({ ...columnDefaults });
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<CurrencyFormState>(emptyForm);
  const [deleting, setDeleting] = useState<CurrencyRow | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminCurrencyDashboard();
  const currenciesQuery = useAdminCurrenciesPaged({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortDir,
  });

  const dashboard = dashboardData as CurrencyDashboard | undefined;
  const response = currenciesQuery.data as { data?: CurrencyRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } } | undefined;
  const currencies = response?.data ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };
  const recentlyUpdated = dashboard?.recentlyUpdated ?? [];

  const createCurrency = useCreateCurrency();
  const updateCurrency = useUpdateCurrency();
  const deleteCurrency = useDeleteCurrency();
  const bulkCurrencies = useBulkCurrencies();
  const exportCurrencies = useExportCurrencies();
  const previewCurrencyImport = usePreviewCurrencyImport();
  const importCurrencies = useImportCurrencies();
  const syncCurrencyRates = useSyncCurrencyRates();

  const visibleColumnKeys = useMemo(
    () => Object.entries(visibleColumns).filter(([, enabled]) => enabled).map(([key]) => key),
    [visibleColumns],
  );

  const allSelected = currencies.length > 0 && currencies.every((currency) => selectedIds.includes(currency.id));

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, debouncedSearch, statusFilter, sortBy, sortDir]);

  function resetForm() {
    setForm(emptyForm);
    setShowForm(false);
  }

  function openCreate() {
    setForm(emptyForm);
    setShowForm(true);
  }

  function openEdit(currency: CurrencyRow) {
    setForm({
      id: currency.id,
      name: currency.name,
      code: currency.code,
      symbol: currency.symbol,
      exchangeRate: String(currency.exchangeRate),
      isBase: Boolean(currency.isBase),
      status: currency.status,
    });
    setShowForm(true);
  }

  function openDuplicate(currency: CurrencyRow) {
    setForm({
      id: "",
      name: `${currency.name} Copy`,
      code: currency.code,
      symbol: currency.symbol,
      exchangeRate: String(currency.exchangeRate),
      isBase: false,
      status: currency.status,
    });
    setShowForm(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      symbol: form.symbol.trim(),
      exchangeRate: Number(form.exchangeRate),
      isBase: form.isBase,
      status: form.status,
    };

    if (!payload.name || !payload.code || !payload.symbol) {
      showToast("Name, code, and symbol are required.", "error");
      return;
    }
    if (payload.code.length !== 3) {
      showToast("Currency code must be 3 letters.", "error");
      return;
    }
    if (!Number.isFinite(payload.exchangeRate) || payload.exchangeRate < 0) {
      showToast("Exchange rate must be a non-negative number.", "error");
      return;
    }

    try {
      if (form.id) {
        await updateCurrency.mutateAsync({ id: form.id, ...payload });
        showToast("Currency updated.");
      } else {
        await createCurrency.mutateAsync(payload);
        showToast("Currency created.");
      }
      resetForm();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save currency."), "error");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await deleteCurrency.mutateAsync(deleting.id);
      showToast("Currency deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete currency."), "error");
    } finally {
      setDeleting(null);
    }
  }

  async function handleBulkAction() {
    if (!bulkAction || selectedIds.length === 0) {
      showToast("Select at least one currency and choose an action.", "error");
      return;
    }

    try {
      await bulkCurrencies.mutateAsync({ ids: selectedIds, action: bulkAction });
      showToast(bulkAction === "DELETE" ? "Currencies deleted." : bulkAction === "ENABLE" ? "Currencies enabled." : "Currencies disabled.");
      setBulkAction("");
      setSelectedIds([]);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  }

  async function handleExport(selectedOnly = false) {
    try {
      const params: Record<string, unknown> = {
        search: debouncedSearch.trim() || undefined,
        status: statusFilter || undefined,
        sortBy,
        sortDir,
      };
      if (selectedOnly && selectedIds.length > 0) params.ids = selectedIds.join(",");
      const blob = await exportCurrencies.mutateAsync(params);
      downloadBlob(blob as Blob, selectedOnly ? "currencies-selected.xlsx" : "currencies-export.xlsx");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export currencies."), "error");
    }
  }

  async function handleSyncRates() {
    try {
      const result = await syncCurrencyRates.mutateAsync();
      showToast(
        `Rates synced! Updated ${result.updatedCount ?? 0} currency rate(s) based on ${result.baseCode ?? "base currency"}.`,
      );
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to sync exchange rates."), "error");
    }
  }

  async function handleImportPreview() {
    if (!importFile) {
      showToast("Choose a spreadsheet first.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const report = (await previewCurrencyImport.mutateAsync(formData)) as ImportReport;
      setImportReport(report);
      setImportMessage(report.invalidRows > 0 ? "Fix validation issues before importing." : "Preview looks clean.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to preview currency spreadsheet."), "error");
    }
  }

  async function handleImport() {
    if (!importFile) {
      showToast("Choose a spreadsheet first.", "error");
      return;
    }
    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", importFile);
      await importCurrencies.mutateAsync(formData);
      showToast("Currencies imported.");
      setImportFile(null);
      setImportReport(null);
      setImportMessage("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import currencies."), "error");
    } finally {
      setImporting(false);
    }
  }

  if (authLoading || !hasPermission("currencies.view")) {
    return null;
  }

  return (
    <AdminLayout title="Currencies" breadcrumb={[{ label: "Currencies" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <StatCard title="Total Currencies" value={dashboard?.totalCurrencies ?? 0} subtitle="All records" icon={<SquareCheckBig size={18} />} isLoading={dashboardLoading} />
          <StatCard title="Active" value={dashboard?.activeCurrencies ?? 0} subtitle="Usable now" icon={<SlidersHorizontal size={18} />} color="bg-green-600" isLoading={dashboardLoading} />
          <StatCard title="Inactive" value={dashboard?.inactiveCurrencies ?? 0} subtitle="Disabled records" icon={<X size={18} />} color="bg-gray-600" isLoading={dashboardLoading} />
          <StatCard title="Base Currency" value={dashboard?.baseCurrencies ?? 0} subtitle="Should stay one" icon={<RefreshCw size={18} />} color="bg-[#0F6CBD]" isLoading={dashboardLoading} />
          <StatCard title="Mapped Countries" value={dashboard?.mappedCountries ?? 0} subtitle="Countries using currencies" icon={<Filter size={18} />} color="bg-[#7A4F01]" isLoading={dashboardLoading} />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Search currencies..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
              >
                <Filter size={14} />
                {showFilters ? "Hide filters" : "Show filters"}
              </button>
              <button
                type="button"
                onClick={() => setShowColumns((current) => !current)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
              >
                <SlidersHorizontal size={14} />
                Columns
              </button>
              {canUpdate && (
                <button
                  type="button"
                  disabled={syncCurrencyRates.isPending}
                  onClick={handleSyncRates}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-60"
                >
                  <RefreshCw size={14} className={syncCurrencyRates.isPending ? "animate-spin text-[#E31E24]" : ""} />
                  {syncCurrencyRates.isPending ? "Syncing..." : "Sync Rates"}
                </button>
              )}
              <button
                type="button"
                onClick={() => void handleExport(false)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F7F7F7]"
              >
                <Download size={14} />
                Export
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Plus size={14} />
                  Add Currency
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 border-t border-[#F0F0F0] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#1A1A1A]">Filters & Sorting</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("");
                    setSortBy("code");
                    setSortDir("asc");
                    setPage(1);
                  }}
                  className="text-[12.5px] font-medium text-[#E31E24] hover:underline"
                >
                  Reset
                </button>
              </div>
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
                  onChange={(event) => setSortBy(event.target.value)}
                  options={[
                    { value: "code", label: "Code" },
                    { value: "name", label: "Name" },
                    { value: "exchangeRate", label: "Exchange rate" },
                    { value: "status", label: "Status" },
                    { value: "updatedAt", label: "Updated date" },
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
                  ]}
                />
              </div>
            </div>
          )}

          {selectedIds.length > 0 && (
            <div className="mt-4 rounded-xl border border-dashed border-[#E31E24]/30 bg-[#FFF5F5]/30 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-[#E31E24]">{selectedIds.length} rows selected</span>
                <div className="h-4 w-[1px] bg-[#E6E6E6]" />
                <div className="flex items-center gap-2">
                  <AdminSelect
                    label=""
                    value={bulkAction}
                    onChange={(event) => setBulkAction(event.target.value as "ENABLE" | "DISABLE" | "DELETE" | "")}
                    options={[
                      { value: "", label: "Choose action" },
                      { value: "ENABLE", label: "Enable" },
                      { value: "DISABLE", label: "Disable" },
                      { value: "DELETE", label: "Delete" },
                    ]}
                  />
                  <button type="button" onClick={() => void handleBulkAction()} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                    Apply
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => void handleExport(true)} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  <Download size={13} /> Export selected
                </button>
                <button type="button" onClick={() => setSelectedIds([])} className="text-[13px] font-medium text-[#6B6B6B] hover:text-[#E31E24] hover:underline">
                  Clear selection
                </button>
              </div>
            </div>
          )}
        </div>

        {showColumns ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">Column visibility</div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {Object.entries(visibleColumns).map(([key, value]) => (
                <label key={key} className="flex items-center gap-2 text-[13px] text-[#1A1A1A]">
                  <input
                    type="checkbox"
                    checked={value}
                    onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))}
                    className="h-4 w-4 accent-[#E31E24]"
                  />
                  <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                </label>
              ))}
            </div>
          </div>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.6fr)_minmax(320px,0.95fr)]">
          <div className="rounded-xl border border-[#E6E6E6] bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="border-b border-[#E6E6E6] bg-[#F8F8F8]">
                  <tr>
                    {canUpdate && (
                      <th className="w-10 px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(event) =>
                            setSelectedIds((current) =>
                              event.target.checked ? Array.from(new Set([...current, ...currencies.map((currency) => currency.id)])) : current.filter((id) => !currencies.some((currency) => currency.id === id)),
                            )
                          }
                          className="h-4 w-4 accent-[#E31E24]"
                          aria-label="Select all currencies"
                        />
                      </th>
                    )}
                    {visibleColumnKeys.includes("name") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Currency</th> : null}
                    {visibleColumnKeys.includes("code") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Code</th> : null}
                    {visibleColumnKeys.includes("symbol") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Symbol</th> : null}
                    {visibleColumnKeys.includes("exchangeRate") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Exchange Rate</th> : null}
                    {visibleColumnKeys.includes("isBase") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Base</th> : null}
                    {visibleColumnKeys.includes("status") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Status</th> : null}
                    {visibleColumnKeys.includes("countries") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Countries</th> : null}
                    {visibleColumnKeys.includes("updatedAt") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Updated Date</th> : null}
                    {(canCreate || canUpdate || canDelete) ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Actions</th> : null}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {currenciesQuery.isLoading ? (
                    Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index}>
                        <td className="px-4 py-4" colSpan={10}>
                          <div className="h-5 animate-pulse rounded bg-[#F0F0F0]" />
                        </td>
                      </tr>
                    ))
                  ) : currencies.length === 0 ? (
                    <tr>
                      <td className="px-4 py-12 text-center text-[13.5px] text-[#9A9A9A]" colSpan={10}>
                        No currencies found.
                      </td>
                    </tr>
                  ) : (
                    currencies.map((currency) => {
                      const selected = selectedIds.includes(currency.id);
                      return (
                        <tr key={currency.id} className={selected ? "bg-[#FFF8F8]" : "hover:bg-[#FAFAFA]"}>
                          {canUpdate && (
                            <td className="px-4 py-4 align-top">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={(event) =>
                                  setSelectedIds((current) =>
                                    event.target.checked ? Array.from(new Set([...current, currency.id])) : current.filter((id) => id !== currency.id),
                                  )
                                }
                                className="h-4 w-4 accent-[#E31E24]"
                                aria-label={`Select ${currency.code}`}
                              />
                            </td>
                          )}
                          {visibleColumnKeys.includes("name") ? (
                            <td className="px-4 py-4 align-top">
                              <div className="font-medium text-[#1A1A1A]">{currency.name}</div>
                            </td>
                          ) : null}
                          {visibleColumnKeys.includes("code") ? <td className="px-4 py-4 align-top font-mono font-semibold text-[#1A1A1A]">{currency.code}</td> : null}
                          {visibleColumnKeys.includes("symbol") ? <td className="px-4 py-4 align-top text-[#1A1A1A]">{currency.symbol}</td> : null}
                          {visibleColumnKeys.includes("exchangeRate") ? <td className="px-4 py-4 align-top text-[#1A1A1A]">{formatRate(currency.exchangeRate)}</td> : null}
                          {visibleColumnKeys.includes("isBase") ? <td className="px-4 py-4 align-top">{currency.isBase ? <span className="font-medium text-green-600">Base</span> : "-"}</td> : null}
                          {visibleColumnKeys.includes("status") ? (
                            <td className="px-4 py-4 align-top">
                              <StatusBadge status={currency.status} />
                            </td>
                          ) : null}
                          {visibleColumnKeys.includes("countries") ? <td className="px-4 py-4 align-top text-[#1A1A1A]">{currency._count?.countries ?? 0}</td> : null}
                          {visibleColumnKeys.includes("updatedAt") ? <td className="px-4 py-4 align-top text-[#1A1A1A]">{formatDate(currency.updatedAt)}</td> : null}
                          {(canCreate || canUpdate || canDelete) ? (
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-nowrap items-center gap-1.5 whitespace-nowrap">
                                {canCreate && (
                                  <button
                                    type="button"
                                    onClick={() => openDuplicate(currency)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F5F5F5]"
                                    title="Duplicate currency"
                                  >
                                    <Copy size={14} />
                                  </button>
                                )}
                                {canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => openEdit(currency)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F5F5F5]"
                                    title="Edit currency"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleting(currency)}
                                    className="inline-flex h-8 w-8 items-center justify-center rounded border border-[#F2D7D7] text-[#E31E24] hover:bg-[#FFF5F5]"
                                    title="Delete currency"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                )}
                              </div>
                            </td>
                          ) : null}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
            <div className="border-t border-[#E6E6E6] px-4 py-3">
              <Pagination page={pagination.page} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Import / Export</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Validate spreadsheets before import.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleExport(false)}
                  className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
                >
                  <Download size={14} />
                  Export
                </button>
              </div>

              {canUpdate && (
                <>
                  <div className="mt-4 space-y-3">
                    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-[#D6D6D6] bg-[#FAFAFA] px-4 py-3">
                      <input
                        type="file"
                        accept=".xlsx,.xls,.csv"
                        className="hidden"
                        onChange={(event) => {
                          setImportFile(event.target.files?.[0] ?? null);
                          setImportReport(null);
                          setImportMessage("");
                        }}
                      />
                      <div className="min-w-0">
                        <div className="text-[13px] font-medium text-[#1A1A1A]">{importFile ? importFile.name : "Choose file"}</div>
                        <div className="mt-0.5 text-[12px] text-[#6B6B6B]">Preview, validate, then import.</div>
                      </div>
                      <Upload size={16} className="shrink-0 text-[#E31E24]" />
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void handleImportPreview()}
                        disabled={previewCurrencyImport.isPending}
                        className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-50"
                      >
                        Preview
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleImport()}
                        disabled={importing || importCurrencies.isPending || !!importReport?.invalidRows}
                        className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                      >
                        <Upload size={14} />
                        {importing ? "Importing..." : "Import"}
                      </button>
                    </div>
                  </div>

                  {importMessage ? <div className="mt-4 rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#1A1A1A]">{importMessage}</div> : null}

                  {importReport ? (
                    <div className="mt-4 space-y-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3 text-[12.5px] text-[#1A1A1A]">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                          <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Rows</div>
                          <div className="mt-1 text-[18px] font-semibold text-[#1A1A1A]">{importReport.totalRows}</div>
                        </div>
                        <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                          <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Valid</div>
                          <div className="mt-1 text-[18px] font-semibold text-green-600">{importReport.validRows}</div>
                        </div>
                        <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                          <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Invalid</div>
                          <div className="mt-1 text-[18px] font-semibold text-red-600">{importReport.invalidRows}</div>
                        </div>
                        <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                          <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Warnings</div>
                          <div className="mt-1 text-[18px] font-semibold text-amber-600">{importReport.duplicateWarnings.length}</div>
                        </div>
                      </div>
                      {importReport.issues.length > 0 ? (
                        <div className="space-y-2">
                          <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Preview issues</div>
                          <div className="max-h-48 space-y-2 overflow-auto rounded-md border border-[#E6E6E6] bg-white p-2">
                            {importReport.issues.slice(0, 8).map((issue, index) => (
                              <div key={`${issue.row}-${issue.field}-${index}`} className="rounded border border-[#F0E0E0] bg-[#FFF8F8] px-3 py-2">
                                <div className="text-[12px] font-semibold text-[#1A1A1A]">Row {issue.row} · {issue.field}</div>
                                <div className="text-[12px] text-[#6B6B6B]">{issue.message}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Recently Updated</h3>
              <div className="mt-3 space-y-2">
              {recentlyUpdated.length > 0 ? (
                  recentlyUpdated.map((currency) => (
                    <div key={currency.id} className="flex items-center justify-between rounded-lg border border-[#EDEDED] px-3 py-2">
                      <div>
                        <div className="text-[13px] font-medium text-[#1A1A1A]">{currency.name}</div>
                        <div className="text-[12px] text-[#9A9A9A]">{currency.code} · {formatDate(currency.updatedAt)}</div>
                      </div>
                      <StatusBadge status={currency.status} />
                    </div>
                  ))
                ) : (
                  <div className="rounded-lg border border-dashed border-[#E6E6E6] px-3 py-8 text-center text-[13px] text-[#9A9A9A]">
                    No recent updates yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <Modal open={showForm} onClose={resetForm} title={form.id ? "Edit currency" : "Add currency"} panelClassName="max-w-3xl">
          <form onSubmit={handleSubmit} className="space-y-6 p-6">
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {form.id ? (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-[#1A1A1A]">Currency Name (Auto-fetched)</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={form.name}
                      className="h-10 w-full rounded-md border border-[#E6E6E6] bg-[#F7F7F7] px-3.5 text-[14px] text-[#6B6B6B] cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-[#1A1A1A]">ISO Code (Auto-fetched)</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={form.code}
                      className="h-10 w-full rounded-md border border-[#E6E6E6] bg-[#F7F7F7] px-3.5 text-[14px] text-[#6B6B6B] cursor-not-allowed font-mono uppercase"
                    />
                  </div>
                </>
              ) : (
                <>
                  <AdminInput label="Currency Name *" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder="US Dollar" />
                  <AdminInput label="ISO Code *" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value.toUpperCase() }))} placeholder="USD" maxLength={3} />
                </>
              )}
              <AdminInput label="Symbol *" value={form.symbol} onChange={(event) => setForm((current) => ({ ...current, symbol: event.target.value }))} placeholder="$" />
              <AdminInput label="Exchange Rate *" type="number" min="0" step="0.000001" value={form.exchangeRate} onChange={(event) => setForm((current) => ({ ...current, exchangeRate: event.target.value }))} />
              <AdminSelect
                label="Status *"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as CurrencyFormState["status"] }))}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <div className="pt-7">
                <label className="inline-flex items-center gap-2.5 text-[13.5px] font-medium text-[#1A1A1A] cursor-pointer">
                  <input type="checkbox" checked={form.isBase} onChange={(event) => setForm((current) => ({ ...current, isBase: event.target.checked }))} className="h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24]" />
                  Base currency
                </label>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E6E6E6] pt-4">
              <p className="text-[12.5px] text-[#6B6B6B]">Currency data feeds pricing, quotes, and orders. Keep only one active base currency.</p>
              <div className="flex gap-2">
                <button type="button" onClick={resetForm} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  Cancel
                </button>
                <button type="submit" disabled={createCurrency.isPending || updateCurrency.isPending} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
                  {form.id ? "Save currency" : "Create currency"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          open={!!deleting}
          title="Delete currency?"
          message={deleting ? `Delete ${deleting.code}? This is blocked if the currency is already referenced by countries, orders, quotes, or pricing records.` : ""}
          onConfirm={handleDelete}
          onCancel={() => setDeleting(null)}
          isLoading={deleteCurrency.isPending}
        />

        {ToastComponent}
      </div>
    </AdminLayout>
  );
}
