"use client";

import { useEffect, useLayoutEffect, useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Download, Edit2, Filter, Plus, RefreshCw, Search, SlidersHorizontal, SquareCheckBig, Trash2, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, AdminStatsGrid, AdminListToolbar, ConfirmModal, Pagination, StatCard, StatusBadge, useToast, LoadingButton, DataTable, type Column } from "@/components/admin/AdminComponents";
import { AdminBulkActionsBar } from "@/components/admin/AdminBulkActionsBar";
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
import { useAdminForm } from "@/hooks/admin/useAdminForm";type CurrencyRow = {
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
  baseCurrency?: CurrencyRow | null;
  mappedCountries: number;
  recentlyUpdated: CurrencyRow[];
  ratesNeedSync?: boolean;
  lastBaseChangedAt?: string | null;
  lastRatesSyncAt?: string | null;
  lastSyncSource?: string | null;
  lastSyncStatus?: string | null;
  nextScheduledSyncTime?: string | null;
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

function formatDateTime(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-IN", {
    dateStyle: "short",
    timeStyle: "short",
  });
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
  const [deleting, setDeleting] = useState<CurrencyRow | null>(null);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<ImportReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [dismissedSyncAt, setDismissedSyncAt] = useState<string | null>(null);

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



  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, debouncedSearch, statusFilter, sortBy, sortDir]);

  const showSyncReminder = !!dashboard?.ratesNeedSync && dashboard?.lastBaseChangedAt !== dismissedSyncAt;
  const form = useAdminForm<CurrencyFormState>({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Name is required.";
      if (!values.code?.trim()) errors.code = "Code is required.";
      else if (values.code.trim().length !== 3) errors.code = "Currency code must be 3 letters.";
      if (!values.symbol?.trim()) errors.symbol = "Symbol is required.";
      
      const rate = Number(values.exchangeRate);
      if (!Number.isFinite(rate) || rate < 0) errors.exchangeRate = "Exchange rate must be a non-negative number.";
      
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const payload = {
        name: values.name.trim(),
        code: values.code.trim().toUpperCase(),
        symbol: values.symbol.trim(),
        exchangeRate: Number(values.exchangeRate),
        isBase: values.isBase,
        status: values.status,
      };

      try {
        const baseCurrencyChanged = payload.isBase && (!dashboard?.baseCurrency || dashboard.baseCurrency.id !== values.id);

        if (values.id) {
          await updateCurrency.mutateAsync({ id: values.id, ...payload });
          if (baseCurrencyChanged) {
            showToast(
              "Base currency updated successfully. The selected currency has been set to an exchange rate of 1.000000. Other exchange rates are still based on the previous base currency. Please click 'Sync Rates' to refresh.",
              "success"
            );
            setDismissedSyncAt(null);
          } else {
            showToast("Currency updated.");
          }
        } else {
          await createCurrency.mutateAsync(payload);
          if (baseCurrencyChanged) {
            showToast(
              "Base currency created successfully. The selected currency has been set to an exchange rate of 1.000000. Other exchange rates are still based on the previous base currency. Please click 'Sync Rates' to refresh.",
              "success"
            );
            setDismissedSyncAt(null);
          } else {
            showToast("Currency created.");
          }
        }
        resetForm();
        setShowForm(false);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save currency."), "error");
      }
    }
  });

  function resetForm() {
    form.reset();
    setShowForm(false);
  }

  function openCreate() {
    form.reset();
    setShowForm(true);
  }

  function openEdit(currency: CurrencyRow) {
    form.setValues({
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
    form.setValues({
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

  const handleStatusToggle = async (currency: CurrencyRow) => {
    try {
      const nextStatus = currency.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
      await updateCurrency.mutateAsync({
        id: currency.id,
        name: currency.name,
        code: currency.code,
        symbol: currency.symbol,
        exchangeRate: Number(currency.exchangeRate),
        isBase: currency.isBase,
        status: nextStatus,
      });
      showToast(`Currency status changed to ${nextStatus}.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update currency status."), "error");
    }
  };

  const columns: Column<CurrencyRow>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Currency",
        render: (row) => (
          <div className="flex items-center gap-2">
            <span className="font-medium text-[#1A1A1A]">{row.name}</span>
            {row.isBase && (
              <span className="inline-flex items-center rounded-full bg-[#0F6CBD]/10 px-2 py-0.5 text-[10px] font-bold text-[#0F6CBD]">
                BASE
              </span>
            )}
          </div>
        ),
      },
      {
        key: "code",
        label: "Code",
        width: "100px",
        render: (row) => (
          <span className="font-mono font-semibold text-[#1A1A1A]">{row.code}</span>
        ),
      },
      {
        key: "symbol",
        label: "Symbol",
        width: "90px",
        render: (row) => <span className="text-[#1A1A1A]">{row.symbol}</span>,
      },
      {
        key: "exchangeRate",
        label: "Exchange Rate",
        width: "140px",
        render: (row) => (
          <span className="font-mono text-[#1A1A1A]">{formatRate(row.exchangeRate)}</span>
        ),
      },
      {
        key: "isBase",
        label: "Base",
        width: "90px",
        render: (row) =>
          row.isBase ? (
            <span className="inline-flex items-center rounded-full bg-[#0F6CBD]/15 px-2 py-0.5 text-[11px] font-bold text-[#0F6CBD]">
              BASE
            </span>
          ) : (
            <span className="text-[#9A9A9A]">-</span>
          ),
      },
      {
        key: "status",
        label: "Status",
        width: "110px",
        render: (row) => <StatusBadge status={row.status} />,
      },
      {
        key: "countries",
        label: "Countries",
        width: "110px",
        render: (row) => (
          <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-700">
            {row._count?.countries ?? 0}
          </span>
        ),
      },
      {
        key: "updatedAt",
        label: (
          <span>
            Updated Date <span className="text-[9.5px] font-normal lowercase tracking-normal text-[#9A9A9A]">(dd/mm/yy)</span>
          </span>
        ),
        width: "160px",
        render: (row) => (
          <span className="text-[11.5px] text-[#6B6B6B] whitespace-nowrap">
            {formatDateTime(row.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "110px",
        render: (row) => (
          <div className="flex items-center justify-start gap-1.5 whitespace-nowrap">
            {canCreate && (
              <button
                type="button"
                onClick={() => openDuplicate(row)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                title="Duplicate currency"
              >
                <Copy size={13} />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] transition-colors cursor-pointer"
                title="Edit currency"
              >
                <Edit2 size={13} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleting(row)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded border border-[#F2D7D7] bg-white text-[#E31E24] hover:bg-[#FFF5F5] transition-colors cursor-pointer"
                title="Delete currency"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canCreate, canUpdate, canDelete]
  );

  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      if (col.key in visibleColumns) {
        return visibleColumns[col.key as keyof typeof visibleColumns];
      }
      return true;
    });
  }, [columns, visibleColumns]);

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
      setDismissedSyncAt(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to sync exchange rates."), "error");
    }
  }

  async function handleImportPreview(fileToPreview?: File) {
    const file = fileToPreview || importFile;
    if (!file) {
      showToast("Choose a spreadsheet first.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", file);
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
      setShowImportModal(false);
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
        <AdminStatsGrid
          stats={[
            { title: "Total Currencies", value: dashboard?.totalCurrencies ?? 0, subtitle: "All records", icon: <SquareCheckBig size={18} />, isLoading: dashboardLoading },
            { title: "Active", value: dashboard?.activeCurrencies ?? 0, subtitle: "Usable now", icon: <SlidersHorizontal size={18} />, color: "bg-green-600", isLoading: dashboardLoading },
            { title: "Inactive", value: dashboard?.inactiveCurrencies ?? 0, subtitle: "Disabled records", icon: <X size={18} />, color: "bg-gray-600", isLoading: dashboardLoading },
            {
              customCard: (
                <div className="flex flex-col justify-between rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-sm relative overflow-hidden h-full">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#6B7280]">Base Currency</span>
                    <span className="inline-flex items-center rounded-full bg-[#0F6CBD]/10 px-2 py-0.5 text-[10px] font-bold text-[#0F6CBD]">
                      BASE
                    </span>
                  </div>
                  {dashboardLoading ? (
                    <div className="h-8 animate-pulse bg-gray-100 rounded my-1.5" />
                  ) : dashboard?.baseCurrency ? (
                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex items-baseline gap-1.5">
                        <span className="text-[16px] font-bold text-[#1A1A1A] truncate">{dashboard.baseCurrency.name}</span>
                        <span className="text-[12px] font-semibold text-[#0F6CBD]">({dashboard.baseCurrency.code})</span>
                      </div>
                      <div className="flex items-center justify-between text-[11px] text-[#6B7280]">
                        <span>Rate: <strong className="text-[#1A1A1A]">1.000000</strong></span>
                        <span className="font-semibold text-[#1A1A1A]">{dashboard.baseCurrency.symbol}</span>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-1.5 text-[12px] font-semibold text-amber-600">
                      ⚠️ No Base Currency set!
                    </div>
                  )}
                  <div className="mt-1.5 text-[10px] text-[#9A9A9A] space-y-1">
                    <div>
                      {dashboard?.baseCurrency?.updatedAt ? `Last updated: ${formatDate(dashboard.baseCurrency.updatedAt)}` : "Primary system currency"}
                    </div>
                    {dashboard?.lastRatesSyncAt && (
                      <div className="border-t border-[#F3F4F6] pt-1 mt-1 text-[9.5px]">
                        <span>Sync: {formatDateTime(dashboard.lastRatesSyncAt)} </span>
                        <span className="font-semibold">({dashboard.lastSyncSource || "Manual"})</span>
                        {" · "}
                        <span className={dashboard.lastSyncStatus === "Success" ? "text-green-600 font-bold" : "text-red-600 font-bold"}>
                          {dashboard.lastSyncStatus || "Success"}
                        </span>
                      </div>
                    )}
                    {dashboard?.nextScheduledSyncTime && (
                      <div className="text-[9.5px] text-[#9A9A9A]">
                        Next Auto: {formatDateTime(dashboard.nextScheduledSyncTime)}
                      </div>
                    )}
                  </div>
                </div>
              )
            },
            { title: "Mapped Countries", value: dashboard?.mappedCountries ?? 0, subtitle: "Countries using currencies", icon: <Filter size={18} />, color: "bg-[#7A4F01]", isLoading: dashboardLoading }
          ]}
        />

        {showSyncReminder && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-[14px] font-bold flex items-center gap-2">
                ⚠️ Synchronization Required
              </h4>
              <p className="text-[12.5px] leading-relaxed text-amber-800">
                The base currency was updated. Other exchange rates are still based on the previous base currency. Please click 'Sync Rates' to refresh all exchange rates using the new base currency.
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={syncCurrencyRates.isPending}
                onClick={handleSyncRates}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-amber-600 px-4 text-[13px] font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
              >
                <RefreshCw size={14} className={syncCurrencyRates.isPending ? "animate-spin" : ""} />
                Sync Rates Now
              </button>
              <button
                type="button"
                onClick={() => {
                  setDismissedSyncAt(dashboard?.lastBaseChangedAt || null);
                }}
                className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-amber-300 text-amber-700 hover:bg-amber-100"
                title="Dismiss reminder"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}

        {/* RECENTLY UPDATED CARDS GRID */}
        {recentlyUpdated.length > 0 && (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-bold text-[#1A1A1A]">Recently Updated</h3>
                <p className="mt-0.5 text-[12px] text-[#6B6B6B]">Quick access to latest modified currencies.</p>
              </div>
              <span className="text-[12px] font-medium text-[#6B6B6B]">{recentlyUpdated.length} items</span>
            </div>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {recentlyUpdated.slice(0, 3).map((currency) => (
                <div
                  key={currency.id}
                  onClick={() => canUpdate && openEdit(currency)}
                  className="group flex flex-col justify-between rounded-lg border border-[#EDEDED] bg-[#FAFAFA] p-3 transition-colors hover:border-[#D6D6D6] hover:bg-white cursor-pointer"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-bold text-[13.5px] text-[#1A1A1A] truncate">{currency.name}</span>
                        {currency.isBase && (
                          <span className="inline-flex items-center rounded-full bg-[#0F6CBD]/10 px-1.5 py-0.2 text-[9.5px] font-bold text-[#0F6CBD]">
                            BASE
                          </span>
                        )}
                      </div>
                      <div className="mt-0.5 text-[12px] font-mono text-[#6B6B6B]">
                        {currency.code} ({currency.symbol}) · Rate: {formatRate(currency.exchangeRate)}
                      </div>
                    </div>
                    <StatusBadge status={currency.status} />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-[#9A9A9A] border-t border-[#F0F0F0] pt-1.5">
                    <span>{formatDate(currency.updatedAt)}</span>
                    <span className="text-[#6B6B6B]">{currency._count?.countries ?? 0} Countries</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search currencies...",
            widthClassName: "max-w-[280px]",
          }}
          filters={{
            showFilters: showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [statusFilter].filter(Boolean).length,
            label: "Filters",
          }}
          columns={{
            visibleColumns: visibleColumns,
            onToggleColumn: (key) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
            options: Object.keys(visibleColumns).map((key) => ({ key, label: key.replace(/([A-Z])/g, " $1") })),
          }}
          leftExtra={
            canUpdate && (
              <button
                type="button"
                disabled={syncCurrencyRates.isPending}
                onClick={handleSyncRates}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-60 cursor-pointer"
              >
                <RefreshCw size={14} className={syncCurrencyRates.isPending ? "animate-spin text-[#E31E24]" : ""} />
                {syncCurrencyRates.isPending ? "Syncing..." : "Sync Rates"}
              </button>
            )
          }
          exportAction={{
            onClick: () => void handleExport(selectedIds.length > 0),
            label: selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export Excel",
          }}
          importAction={
            canUpdate
              ? {
                  onClick: () => setShowImportModal(true),
                  label: "Import Excel",
                }
              : undefined
          }
          primaryAction={
            canCreate
              ? {
                  onClick: openCreate,
                  label: "Add Currency",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
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
                  { value: "100", label: "100 per page" },
                ]}
              />
            </div>
          }
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setSortBy("code");
            setSortDir("asc");
            setPage(1);
          }}
        />

        {/* FULL-WIDTH DATA TABLE WITH UNIFIED SUBHEADER & PAGINATION */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-xs">
          <DataTable<CurrencyRow>
            title="Currencies List"
            columns={filteredColumns}
            data={currencies}
            rowKey="id"
            isLoading={currenciesQuery.isLoading}
            emptyMessage="No currencies found."
            enableSelection={canUpdate}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onToggleStatus={canUpdate ? handleStatusToggle : undefined}
            statusLoadingId={updateCurrency.isPending ? ((updateCurrency.variables as any)?.id ?? null) : null}
            isStatusDisabled={() => !canUpdate}
            totalItems={pagination.total ?? 0}
            currentPage={page}
            pageSize={limit}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            onSelectAll={(checked) => setSelectedIds(checked ? currencies.map((c) => c.id) : [])}
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
                applyLoading={bulkCurrencies.isPending}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages || 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>

        {/* IMPORT SPREADSHEET MODAL */}
        <Modal
          open={showImportModal}
          onClose={() => {
            setShowImportModal(false);
            setImportFile(null);
            setImportReport(null);
            setImportMessage("");
          }}
          title="Import Currencies Spreadsheet"
          panelClassName="max-w-2xl"
        >
          <div className="space-y-4 p-6">
            <p className="text-[13px] text-[#6B6B6B]">
              Upload an Excel (.xlsx, .xls) or CSV spreadsheet to create or update currency records in bulk.
            </p>

            <div className="rounded-lg border-2 border-dashed border-[#E6E6E6] bg-[#FAFAFA] p-6 text-center hover:bg-[#F5F5F5] transition-colors">
              <input
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="currency-import-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                    setImportReport(null);
                    setImportMessage("");
                    void handleImportPreview(file);
                  }
                }}
              />
              <label htmlFor="currency-import-file" className="cursor-pointer block">
                <Upload className="mx-auto h-8 w-8 text-[#9A9A9A]" />
                <span className="mt-2 block text-[13px] font-semibold text-[#1A1A1A]">
                  {importFile ? importFile.name : "Choose spreadsheet file"}
                </span>
                <span className="mt-0.5 block text-[11.5px] text-[#9A9A9A]">
                  XLSX, XLS or CSV files supported
                </span>
              </label>
              {importFile && (
                <button
                  type="button"
                  onClick={() => {
                    setImportFile(null);
                    setImportReport(null);
                    setImportMessage("");
                  }}
                  className="mt-2 text-[12px] font-medium text-red-600 hover:underline inline-block cursor-pointer"
                >
                  Remove file
                </button>
              )}
            </div>

            {previewCurrencyImport.isPending && (
              <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
                Validating and previewing spreadsheet...
              </div>
            )}

            {importMessage && (
              <div className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3.5 py-2.5 text-[12.5px] text-[#1A1A1A]">
                {importMessage}
              </div>
            )}

            {importReport && (
              <div className="space-y-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-md border border-[#E6E6E6] bg-white p-3 text-center">
                    <div className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Total Rows</div>
                    <div className="mt-1 text-[18px] font-bold text-[#1A1A1A]">{importReport.totalRows}</div>
                  </div>
                  <div className="rounded-md border border-[#E6E6E6] bg-white p-3 text-center">
                    <div className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Valid Rows</div>
                    <div className="mt-1 text-[18px] font-bold text-emerald-600">{importReport.validRows}</div>
                  </div>
                  <div className="rounded-md border border-[#E6E6E6] bg-white p-3 text-center">
                    <div className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Invalid Rows</div>
                    <div className="mt-1 text-[18px] font-bold text-red-600">{importReport.invalidRows}</div>
                  </div>
                  <div className="rounded-md border border-[#E6E6E6] bg-white p-3 text-center">
                    <div className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Warnings</div>
                    <div className="mt-1 text-[18px] font-bold text-amber-600">{importReport.duplicateWarnings.length}</div>
                  </div>
                </div>

                {importReport.issues.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-[12.5px] font-semibold text-[#1A1A1A]">Validation Issues</h4>
                    <div className="max-h-40 overflow-y-auto rounded border border-[#E6E6E6] bg-white divide-y divide-[#F0F0F0]">
                      {importReport.issues.map((issue, idx) => (
                        <div key={idx} className="flex items-center gap-3 px-3 py-2 text-[12px]">
                          <span className="font-mono font-semibold text-[#E31E24]">Row {issue.row}</span>
                          <span className="font-medium text-[#1A1A1A]">{issue.field}</span>
                          <span className="text-[#6B6B6B]">{issue.message}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-[#E6E6E6] pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowImportModal(false);
                  setImportFile(null);
                  setImportReport(null);
                  setImportMessage("");
                }}
                className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7] cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                onClick={handleImport}
                loading={importing || importCurrencies.isPending}
                loadingText="Importing..."
                disabled={!importFile || (importReport !== null && importReport.invalidRows > 0)}
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 cursor-pointer"
              >
                Import Currencies
              </LoadingButton>
            </div>
          </div>
        </Modal>

        <Modal open={showForm} onClose={() => { form.reset(); setShowForm(false); }} title={form.values.id ? "Edit currency" : "Add currency"} panelClassName="max-w-3xl">
          <form onSubmit={form.handleSubmit} className="space-y-6 p-6">
            <div className="grid gap-x-6 gap-y-5 md:grid-cols-2">
              {form.values.id ? (
                <>
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-[#1A1A1A]">Currency Name (Auto-fetched)</label>
                    <input
                      type="text"
                      readOnly
                      disabled
                      value={form.values.name}
                      className="h-10 w-full rounded-md border border-[#E6E6E6] bg-[#F7F7F7] px-3.5 text-[14px] text-[#6B6B6B] cursor-not-allowed"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-[13px] font-medium text-[#1A1A1A]">ISO Code (Auto-fetched)</label>
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
                  <AdminInput label="Currency Name" {...form.getFieldProps("name")} error={form.errors.name as string} placeholder="US Dollar" />
                  <AdminInput label="ISO Code" {...form.getFieldProps("code")} error={form.errors.code as string} placeholder="USD" maxLength={3} onChange={(e) => form.setFieldValue("code", e.target.value.toUpperCase())} />
                </>
              )}
              <AdminInput label="Symbol" {...form.getFieldProps("symbol")} error={form.errors.symbol as string} placeholder="$" />
              <div className="space-y-1">
                <AdminInput
                  label="Exchange Rate"
                  type="number"
                  min="0"
                  step="0.000001"
                  disabled={form.values.isBase}
                  {...form.getFieldProps("exchangeRate")}
                  value={form.values.isBase ? "1" : form.values.exchangeRate}
                  error={form.errors.exchangeRate as string}
                />
                {form.values.isBase && (
                  <p className="text-[11px] font-medium text-[#0F6CBD]">Base currency exchange rate is fixed at 1.000000</p>
                )}
              </div>
              <AdminSelect
                label="Status"
                {...form.getFieldProps("status")}
                error={form.errors.status as string}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <div className="pt-7">
                <label className="inline-flex items-center gap-2.5 text-[13.5px] font-medium text-[#1A1A1A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.values.isBase}
                    onChange={(event) => {
                      form.setFieldValue("isBase", event.target.checked);
                      if (event.target.checked) form.setFieldValue("exchangeRate", "1");
                    }}
                    className="h-4 w-4 rounded border-[#D1D5DB] accent-[#E31E24]"
                  />
                  Base currency
                </label>
              </div>

              {form.values.isBase && (
                <div className="col-span-full rounded-lg border border-amber-200 bg-amber-50 p-3.5 text-amber-900">
                  <div className="flex items-start gap-2.5">
                    <span className="text-amber-600 text-[15px] font-bold">⚠️</span>
                    <div className="text-[12px] leading-relaxed text-amber-800">
                      <strong className="font-semibold text-amber-900">Base Currency Impact Notice:</strong> Product base prices across the catalog are entered and stored in the Base Currency. Changing the global base currency does not automatically convert stored product prices. After changing the base currency, review product catalog prices and click <strong>Sync Rates</strong> to update exchange rates for all countries.
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E6E6E6] pt-4">
              <p className="text-[12.5px] text-[#6B6B6B]">Currency data feeds pricing, quotes, and orders. Keep only one active base currency.</p>
              <div className="flex gap-2">
                <button type="button" onClick={() => resetForm()} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  Cancel
                </button>
                <LoadingButton type="submit" loading={form.isSubmitting || createCurrency.isPending || updateCurrency.isPending} loadingText="Processing..." className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                  {form.values.id ? "Save currency" : "Create currency"}
                </LoadingButton>
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
