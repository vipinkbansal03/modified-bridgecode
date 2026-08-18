"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import {
  Copy,
  Download,
  Edit2,
  Eye,
  Filter,
  Plus,
  RefreshCw,
  Search,
  SlidersHorizontal,
  SquareCheckBig,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { AdminInput, AdminSelect, AdminStatsGrid, ConfirmModal, Pagination, StatCard, StatusBadge, useToast, AdminBulkActionsBar } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCountries,
  useAdminTierCountries,
  useAdminTierDashboard,
  useAdminTiersPaged,
  useBulkTiers,
  useCreateTier,
  useDeleteTier,
  useExportTiers,
  useImportTiers,
  usePreviewTierImport,
  useUpdateTier,
  useUpdateTierCountries,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type TierRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  _count?: { customers?: number; pricing?: number; discounts?: number; countries?: number };
};

type TierCountryRow = {
  id: string;
  name: string;
  code: string;
  status: string;
  enabled: boolean;
  currency?: { code?: string | null } | null;
};

type TierDashboard = {
  totalTiers: number;
  activeTiers: number;
  inactiveTiers: number;
  mappedCountries: number;
  recentlyUpdated: TierRow[];
};

type SpreadsheetReport = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: Array<{ row: number; field: string; message: string }>;
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

type TierFormState = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: string;
};

const emptyForm: TierFormState = {
  id: "",
  name: "",
  status: "ACTIVE",
  sortOrder: "0",
};

const visibleColumnsDefault = {
  name: true,
  customers: true,
  pricing: true,
  discounts: true,
  countries: true,
  priority: true,
  status: true,
  updatedAt: true,
};

function formatDate(value?: string) {
  if (!value) return " - ";
  return new Date(value).toLocaleDateString();
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export default function AdminTiersPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("tiers.create");
  const canUpdate = hasPermission("tiers.update");
  const canDelete = hasPermission("tiers.delete");

  const { showToast, ToastComponent } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");
  const [showForm, setShowForm] = useState(false);
  const form = useAdminForm({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Tier name is required.";
      return errors;
    },
    onSubmit: async (values, { resetForm: formReset }) => {
      try {
        const payload = { name: values.name.trim(), status: values.status, sortOrder: Number(values.sortOrder || 0) };
        if (values.id) {
          await updateTier.mutateAsync({ id: values.id, ...payload });
          showToast("Tier updated.");
        } else {
          await createTier.mutateAsync(payload);
          showToast("Tier created.");
        }
        formReset();
        setShowForm(false);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save tier."), "error");
      }
    }
  });
  const [deleteTarget, setDeleteTarget] = useState<TierRow | null>(null);
  const [selectedTierId, setSelectedTierId] = useState("");
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<SpreadsheetReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminTierDashboard();
  const { data: countries = [] } = useAdminCountries();
  const tiersQuery = useAdminTiersPaged({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: statusFilter || undefined,
    countryId: countryFilter || undefined,
    sortBy,
    sortDir,
  });

  const tierDashboard = dashboardData as TierDashboard | undefined;
  const tiersResponse = tiersQuery.data as { data?: TierRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } } | undefined;
  const rows = (tiersResponse?.data ?? []) as TierRow[];
  const pagination = tiersResponse?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  const selectedTier = rows.find((tier) => tier.id === selectedTierId) ?? null;
  const { data: tierCountries = [], isLoading: countriesLoading } = useAdminTierCountries(selectedTierId);

  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();
  const bulkTiers = useBulkTiers();
  const exportTiers = useExportTiers();
  const previewTierImport = usePreviewTierImport();
  const importTiers = useImportTiers();
  const updateTierCountries = useUpdateTierCountries(selectedTierId);

  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);

  const countryOptions = useMemo(
    () => [
      { value: "", label: "All countries" },
      ...countries.map((country: { id: string; name: string; code: string }) => ({
        value: country.id,
        label: `${country.name} (${country.code})`,
      })),
    ],
    [countries],
  );

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, debouncedSearch, statusFilter, countryFilter, sortBy, sortDir]);

  useEffect(() => {
    if (rows.length === 0) {
      setSelectedTierId("");
      return;
    }
    if (!rows.some((row) => row.id === selectedTierId)) {
      setSelectedTierId(rows[0].id);
    }
  }, [rows, selectedTierId]);

  useEffect(() => {
    setCountryOverrides({});
  }, [selectedTierId]);

  const filteredColumns = useMemo(
    () =>
      [
        visibleColumns.name ? "name" : null,
        visibleColumns.customers ? "customers" : null,
        visibleColumns.pricing ? "pricing" : null,
        visibleColumns.discounts ? "discounts" : null,
        visibleColumns.countries ? "countries" : null,
        visibleColumns.priority ? "priority" : null,
        visibleColumns.status ? "status" : null,
        visibleColumns.updatedAt ? "updatedAt" : null,
      ].filter(Boolean) as string[],
    [visibleColumns],
  );

  const pageIds = rows.map((row) => row.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.includes(id));
  const selectedTierCountries = tierCountries as TierCountryRow[];
  const enabledCountryCount = selectedTierCountries.filter((country) => countryOverrides[country.id] ?? country.enabled).length;
  const allCountriesSelected =
    selectedTierCountries.length > 0 &&
    selectedTierCountries.every((country) => countryOverrides[country.id] ?? country.enabled);
  const someCountriesSelected =
    !allCountriesSelected &&
    selectedTierCountries.some((country) => countryOverrides[country.id] ?? country.enabled);

  const resetForm = () => {
    form.reset();
    setShowForm(false);
  };

  const startCreate = () => {
    form.setValues(emptyForm);
    setShowForm(true);
  };

  const startEdit = (tier: TierRow) => {
    form.setValues({
      id: tier.id,
      name: tier.name,
      status: tier.status,
      sortOrder: String(tier.sortOrder ?? 0),
    });
    setShowForm(true);
  };

  const startClone = (tier: TierRow) => {
    form.setValues({
      id: "",
      name: `${tier.name} Copy`,
      status: "ACTIVE",
      sortOrder: String(tier.sortOrder ?? 0),
    });
    setShowForm(true);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTier.mutateAsync(deleteTarget.id);
      if (selectedTierId === deleteTarget.id) {
        setSelectedTierId("");
      }
      showToast("Tier deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete tier."), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) {
      showToast("Select at least one tier and choose an action.", "error");
      return;
    }

    try {
      const res = await bulkTiers.mutateAsync({ ids: selectedIds, action: bulkAction });
      const summary = res.data?.summary;
      if (summary) {
        if (summary.failed > 0) {
          if (summary.succeeded === 0) {
            const firstError = res.data.results.find((r: any) => !r.success)?.error || "Action failed.";
            showToast(firstError, "error");
            return;
          } else {
            showToast(`Completed with warnings: ${summary.succeeded} succeeded, ${summary.failed} failed.`, "warning");
          }
        } else {
          showToast("Tiers deleted.", "success");
        }
      } else {
        showToast(
          bulkAction === "ENABLE" ? "Tiers enabled." : "Tiers disabled.",
          "success"
        );
      }
      setSelectedIds([]);
      setBulkAction("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const handleToggleStatus = async (tier: TierRow) => {
    try {
      await updateTier.mutateAsync({
        id: tier.id,
        status: tier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      showToast(tier.status === "ACTIVE" ? "Tier disabled." : "Tier enabled.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update tier."), "error");
    }
  };

  const handleSelectAllPage = () => {
    if (allPageSelected) {
      setSelectedIds((current) => current.filter((id) => !pageIds.includes(id)));
      return;
    }

    setSelectedIds((current) => Array.from(new Set([...current, ...pageIds])));
  };

  const handleSelectAllCountries = (checked: boolean) => {
    setCountryOverrides(
      Object.fromEntries(selectedTierCountries.map((country) => [country.id, checked])),
    );
  };

  const handleExport = async (selectedOnly = false) => {
    try {
      const params: Record<string, unknown> = {
        search: search || undefined,
        status: statusFilter || undefined,
        countryId: countryFilter || undefined,
        sortBy,
        sortDir,
      };
      if (selectedOnly && selectedIds.length > 0) {
        params.ids = selectedIds.join(",");
      }
      const blob = await exportTiers.mutateAsync(params);
      downloadBlob(blob as Blob, selectedOnly && selectedIds.length ? "tiers-selected.xlsx" : "tiers-export.xlsx");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export tiers."), "error");
    }
  };

  const handleImportPreview = async () => {
    if (!importFile) {
      showToast("Choose a spreadsheet first.", "error");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const report = (await previewTierImport.mutateAsync(formData)) as SpreadsheetReport;
      setImportReport(report);
      setImportMessage(report.invalidRows > 0 ? "Fix the validation issues before importing." : "Preview looks good. You can import now.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to preview tier spreadsheet."), "error");
    }
  };

  const handleImport = async () => {
    if (!importFile) {
      showToast("Choose a spreadsheet first.", "error");
      return;
    }

    try {
      setImporting(true);
      const formData = new FormData();
      formData.append("file", importFile);
      await importTiers.mutateAsync(formData);
      showToast("Tiers imported.");
      setImportFile(null);
      setImportReport(null);
      setImportMessage("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import tiers."), "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout title="Tiers" breadcrumb={[{ label: "Tiers" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Tiers", value: tierDashboard?.totalTiers ?? 0, subtitle: "All tier records", icon: <Filter size={18} />, isLoading: dashboardLoading },
            { title: "Active Tiers", value: tierDashboard?.activeTiers ?? 0, subtitle: "Available for use", icon: <SquareCheckBig size={18} />, color: "bg-green-600", isLoading: dashboardLoading },
            { title: "Inactive Tiers", value: tierDashboard?.inactiveTiers ?? 0, subtitle: "Disabled tiers", icon: <X size={18} />, color: "bg-gray-600", isLoading: dashboardLoading },
            { title: "Country Rules", value: tierDashboard?.mappedCountries ?? 0, subtitle: "Tiers with country mapping", icon: <RefreshCw size={18} />, color: "bg-[#0F6CBD]", isLoading: dashboardLoading }
          ]}
        />

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => {
                  setPage(1);
                  setSearch(event.target.value);
                }}
                placeholder="Search tiers..."
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
                  onClick={startCreate}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Plus size={14} />
                  Add Tier
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
                    setCountryFilter("");
                    setSortBy("sortOrder");
                    setSortDir("asc");
                    setPage(1);
                  }}
                  className="text-[12.5px] font-medium text-[#E31E24] hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                <AdminSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => {
                    setPage(1);
                    setStatusFilter(event.target.value);
                  }}
                  options={[
                    { value: "", label: "All status" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                <AdminMultiSearchableSelect
                  label="Country"
                  values={countryFilter ? countryFilter.split(",").filter(Boolean) : []}
                  onValuesChange={(values) => {
                    setPage(1);
                    setCountryFilter(values.join(","));
                  }}
                  options={countries.map((country: { id: string; name: string; code: string }) => ({
                    value: country.id,
                    label: `${country.name} (${country.code})`,
                  }))}
                  placeholder="Select countries"
                  allowSelectAll
                  selectAllLabel="All countries"
                />
                <AdminSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  options={[
                    { value: "sortOrder", label: "Priority" },
                    { value: "updatedAt", label: "Updated date" },
                    { value: "createdAt", label: "Created date" },
                    { value: "name", label: "Tier name" },
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
                    setPage(1);
                    setLimit(Number(event.target.value));
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


          {showColumns ? (
            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">Column visibility</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(visibleColumns).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-[13px] text-[#1A1A1A]">
                    <input
                      type="checkbox"
                      checked={value}
                      onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Recently Updated</h3>
              <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">Quick access to the latest tier changes.</p>
            </div>
            <span className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] text-[#6B6B6B]">
              {tierDashboard?.recentlyUpdated?.length ?? 0} items
            </span>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-5">
            {(tierDashboard?.recentlyUpdated ?? []).slice(0, 5).map((tier) => (
              <button
                key={tier.id}
                type="button"
                onClick={() => {
                  setSelectedTierId(tier.id);
                  setShowForm(false);
                }}
                className="rounded-lg border border-[#E6E6E6] px-3 py-2 text-left transition hover:bg-[#FAFAFA]"
              >
                <div className="truncate text-[13px] font-medium text-[#1A1A1A]">{tier.name}</div>
                <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">Updated {formatDate(tier.updatedAt)}</div>
              </button>
            ))}
            {(tierDashboard?.recentlyUpdated ?? []).length === 0 ? (
              <p className="text-[13px] text-[#6B6B6B]">No recent tier changes yet.</p>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
          <div className="space-y-4">
            <div className="rounded-xl border border-[#E6E6E6] bg-white">
              <div className="border-b border-[#E6E6E6] bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 min-h-[56px] transition-all rounded-t-xl">
                <div className="flex flex-wrap items-center gap-3 w-full">
                  <span className="text-[13px] font-bold text-[#1A1A1A]">Tiers List</span>
                  <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
                    Showing {pagination.total === 0 ? 0 : (pagination.page - 1) * pagination.limit + 1}-{Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}
                  </span>
                  
                  <div className="flex items-center gap-2 border-l border-[#E6E6E6] pl-3 ml-2 flex-wrap">
                    <AdminBulkActionsBar
                      selectedCount={selectedIds.length}
                      onClear={() => setSelectedIds([])}
                      actionType={bulkAction}
                      onActionTypeChange={(val) => setBulkAction(val as any)}
                      actions={[
                        { value: "ENABLE", label: "Mark active" },
                        { value: "DISABLE", label: "Mark inactive" },
                        { value: "DELETE", label: "Delete selected" }
                      ]}
                      onApply={handleBulkAction}
                      applyLoading={bulkTiers.isPending}
                      applyDisabled={!bulkAction || selectedIds.length === 0}
                    />
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-[#F8F8F8] border-b border-[#E6E6E6]">
                    <tr>
                      <th className="w-10 px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                        {canUpdate ? (
                          <input
                            type="checkbox"
                            checked={allPageSelected}
                            onChange={handleSelectAllPage}
                            aria-label="Select all rows on this page"
                            className="h-4 w-4 accent-[#E31E24]"
                          />
                        ) : null}
                      </th>
                      {filteredColumns.includes("name") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Tier Name</th> : null}
                      {filteredColumns.includes("customers") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Customers</th> : null}
                      {filteredColumns.includes("pricing") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Pricing Rules</th> : null}
                      {filteredColumns.includes("discounts") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Discounts</th> : null}
                      {filteredColumns.includes("countries") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Countries</th> : null}
                      {filteredColumns.includes("priority") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Priority</th> : null}
                      {filteredColumns.includes("status") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Status</th> : null}
                      {filteredColumns.includes("updatedAt") ? <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Updated Date</th> : null}
                      <th className="px-4 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E6E6]">
                    {tiersQuery.isLoading ? (
                      [...Array(5)].map((_, index) => (
                        <tr key={index}>
                          <td className="px-4 py-4" colSpan={10}>
                            <div className="h-5 animate-pulse rounded bg-[#F0F0F0]" />
                          </td>
                        </tr>
                      ))
                    ) : rows.length === 0 ? (
                      <tr>
                        <td colSpan={10} className="px-4 py-12 text-center text-[13.5px] text-[#9A9A9A]">
                          No tiers found.
                        </td>
                      </tr>
                    ) : (
                      rows.map((tier) => {
                        const isSelected = selectedIds.includes(tier.id);
                        return (
                          <tr key={tier.id} className={isSelected ? "bg-[#FFF8F8]" : "hover:bg-[#FAFAFA]"}>
                            <td className="px-4 py-4 align-top">
                              {canUpdate ? (
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={(event) => {
                                    const checked = event.target.checked;
                                    setSelectedIds((current) =>
                                      checked ? Array.from(new Set([...current, tier.id])) : current.filter((id) => id !== tier.id),
                                    );
                                  }}
                                  className="h-4 w-4 accent-[#E31E24]"
                                />
                              ) : null}
                            </td>
                            {filteredColumns.includes("name") ? (
                              <td className="px-4 py-4 align-top">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTierId(tier.id);
                                    setShowForm(false);
                                  }}
                                  className="text-left"
                                >
                                  <div className="font-medium text-[#1A1A1A] hover:text-[#E31E24]">{tier.name}</div>
                                  <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">Updated {formatDate(tier.updatedAt)}</div>
                                </button>
                              </td>
                            ) : null}
                            {filteredColumns.includes("customers") ? <td className="px-4 py-4 align-top text-[13px] text-[#1A1A1A]">{tier._count?.customers ?? 0}</td> : null}
                            {filteredColumns.includes("pricing") ? <td className="px-4 py-4 align-top text-[13px] text-[#1A1A1A]">{tier._count?.pricing ?? 0}</td> : null}
                            {filteredColumns.includes("discounts") ? <td className="px-4 py-4 align-top text-[13px] text-[#1A1A1A]">{tier._count?.discounts ?? 0}</td> : null}
                            {filteredColumns.includes("countries") ? <td className="px-4 py-4 align-top text-[13px] text-[#1A1A1A]">{tier._count?.countries ?? 0}</td> : null}
                            {filteredColumns.includes("priority") ? <td className="px-4 py-4 align-top text-[13px] text-[#6B6B6B]">{tier.sortOrder}</td> : null}
                            {filteredColumns.includes("status") ? <td className="px-4 py-4 align-top"><StatusBadge status={tier.status} /></td> : null}
                            {filteredColumns.includes("updatedAt") ? <td className="px-4 py-4 align-top text-[13px] text-[#1A1A1A]">{formatDate(tier.updatedAt)}</td> : null}
                            <td className="px-4 py-4 align-top">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedTierId(tier.id);
                                    setShowForm(false);
                                  }}
                                  className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
                                  title="View countries"
                                >
                                  <Eye size={15} />
                                </button>
                                {canUpdate && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => startEdit(tier)}
                                      className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
                                      title="Edit tier"
                                    >
                                      <Edit2 size={15} />
                                    </button>
                                  </>
                                )}
                                {canCreate && (
                                  <button
                                    type="button"
                                    onClick={() => startClone(tier)}
                                    className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
                                    title="Clone tier"
                                  >
                                    <Copy size={15} />
                                  </button>
                                )}
                                {canUpdate && (
                                  <button
                                    type="button"
                                    onClick={() => void handleToggleStatus(tier)}
                                    className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
                                    title={tier.status === "ACTIVE" ? "Disable tier" : "Enable tier"}
                                  >
                                    <RefreshCw size={15} />
                                  </button>
                                )}
                                {canDelete && (
                                  <button
                                    type="button"
                                    onClick={() => setDeleteTarget(tier)}
                                    className="rounded border border-[#F2D7D7] p-2 text-[#E31E24] hover:bg-[#FFF5F5]"
                                    title="Delete tier"
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                )}
                              </div>
                            </td>
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
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country Availability</h3>
                  <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
                    A tier stays global if no countries are enabled. Once one or more are selected, the tier is restricted to those countries.
                  </p>
                </div>
                {selectedTier ? (
                  <span className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] text-[#6B6B6B]">
                    {enabledCountryCount === 0 ? "Global fallback" : `${enabledCountryCount} enabled`}
                  </span>
                ) : null}
              </div>

              {!selectedTier ? (
                <p className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-4 text-[13px] text-[#9A9A9A]">
                  Select a tier to manage country availability.
                </p>
              ) : countriesLoading ? (
                <div className="h-28 animate-pulse rounded-md bg-[#F2F2F2]" />
              ) : selectedTierCountries.length === 0 ? (
                <p className="text-[13px] text-[#9A9A9A]">No countries found.</p>
              ) : (
                <>
                  <div className="mb-4 rounded-md bg-[#FAFAFA] px-3 py-2 text-[13px] font-medium text-[#1A1A1A]">{selectedTier.name}</div>
                  <label className="mb-3 flex items-center gap-2.5 rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2.5">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#E31E24]"
                      checked={allCountriesSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someCountriesSelected;
                      }}
                      onChange={(event) => handleSelectAllCountries(event.target.checked)}
                      aria-label="Select all countries"
                    />
                    <span className="text-[13px] font-medium text-[#1A1A1A]">Select all</span>
                    <span className="text-[12px] text-[#9A9A9A]">
                      ({enabledCountryCount} of {selectedTierCountries.length} enabled)
                    </span>
                  </label>
                  <div className="grid gap-2">
                    {selectedTierCountries.map((country) => (
                      <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2">
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                          <span className="text-[11.5px] text-[#9A9A9A]">
                            {country.code}
                            {country.currency?.code ? ` - ${country.currency.code}` : ""}
                          </span>
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
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await updateTierCountries.mutateAsync(
                          selectedTierCountries.map((country) => ({
                            countryId: country.id,
                            enabled: countryOverrides[country.id] ?? country.enabled,
                          })),
                        );
                        setCountryOverrides({});
                        showToast("Tier country availability saved.");
                      } catch (error) {
                        showToast(getAdminErrorMessage(error, "Failed to save tier country availability."), "error");
                      }
                    }}
                    disabled={updateTierCountries.isPending}
                    className="mt-4 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                  >
                    {updateTierCountries.isPending ? "Saving..." : "Save Availability"}
                  </button>
                </>
              )}
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Import / Export</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Spreadsheet import uses validation before commit and reuses the existing Excel utility.</p>
                </div>
                <button
                  type="button"
                  onClick={() => void handleExport(false)}
                  className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
                >
                  <Download size={14} /> Export
                </button>
              </div>

              {canUpdate ? (
                <div className="mt-4 grid gap-3">
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
                      <div className="mt-0.5 text-[12px] text-[#6B6B6B]">Preview before import.</div>
                    </div>
                    <Upload size={16} className="shrink-0 text-[#E31E24]" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => void handleImportPreview()}
                      disabled={previewTierImport.isPending}
                      className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-50"
                    >
                      <Eye size={14} /> Preview
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleImport()}
                      disabled={importing || importTiers.isPending || !!importReport?.invalidRows}
                      className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                    >
                      <Upload size={14} /> {importing ? "Importing..." : "Import"}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 grid gap-3">
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-center text-[13px] text-[#6B6B6B]">
                    Importing is disabled (No edit permission)
                  </div>
                </div>
              )}

              {importMessage ? (
                <div className="mt-4 rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#1A1A1A]">
                  {importMessage}
                </div>
              ) : null}

              {importReport ? (
                <div className="mt-4 space-y-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3 text-[12.5px] text-[#1A1A1A]">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Total rows</div>
                      <div className="mt-1 text-[18px] font-semibold text-[#1A1A1A]">{importReport.totalRows}</div>
                    </div>
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Valid rows</div>
                      <div className="mt-1 text-[18px] font-semibold text-green-600">{importReport.validRows}</div>
                    </div>
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Invalid rows</div>
                      <div className="mt-1 text-[18px] font-semibold text-red-600">{importReport.invalidRows}</div>
                    </div>
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Duplicates</div>
                      <div className="mt-1 text-[18px] font-semibold text-amber-600">{importReport.duplicateWarnings.length}</div>
                    </div>
                  </div>

                  {importReport.issues.length > 0 ? (
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Validation issues</div>
                      <div className="mt-2 space-y-1.5">
                        {importReport.issues.slice(0, 5).map((issue, index) => (
                          <div key={`${issue.row}-${issue.field}-${index}`} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12px] text-[#6B6B6B]">
                            Row {issue.row}: {issue.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  {importReport.sampleRows.length > 0 ? (
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Sample rows</div>
                      <div className="mt-2 space-y-2">
                        {importReport.sampleRows.slice(0, 3).map((row, index) => (
                          <div key={index} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12px] text-[#6B6B6B]">
                            {JSON.stringify(row)}
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <Modal open={showForm} onClose={resetForm} title={form.values.id ? "Edit tier" : "Add tier"} panelClassName="max-w-xl">
          <form onSubmit={form.handleSubmit} className="space-y-6 p-6">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput required label="Tier Name" {...form.getFieldProps("name")} error={form.errors.name as string} placeholder="Diamond, Gold, Silver..." />
              <AdminSelect
                label="Status"
                {...form.getFieldProps("status")}
                error={form.errors.status as string}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminInput
                label="Priority"
                type="number"
                min="0"
                step="1"
                {...form.getFieldProps("sortOrder")}
                error={form.errors.sortOrder as string}
              />
            </div>

            <div className="flex items-center justify-between gap-3 border-t border-[#E6E6E6] pt-4">
              <p className="text-[12.5px] text-[#6B6B6B]">Priority controls resolver precedence. Lower values are processed first.</p>
              <div className="flex gap-2">
                <button type="button" onClick={resetForm} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  Cancel
                </button>
                <button type="submit" disabled={form.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
                  {form.isSubmitting ? "Processing..." : form.values.id ? "Save tier" : "Create tier"}
                </button>
              </div>
            </div>
          </form>
        </Modal>

        <ConfirmModal
          open={!!deleteTarget}
          title="Delete tier?"
          message={deleteTarget ? `Delete ${deleteTarget.name}? This is blocked automatically if customers, pricing rules, or discounts still reference it.` : ""}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteTier.isPending}
        />

        {ToastComponent}
      </div>
    </AdminLayout>
  );
}
