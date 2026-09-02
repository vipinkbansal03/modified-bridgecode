"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Edit2,
  Filter,
  Globe,
  Plus,
  RefreshCw,
  Search,
  SquareCheckBig,
  Trash2,
  Upload,
  X,
  Layers,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  AdminInput,
  AdminSelect,
  AdminStatsGrid,
  AdminListToolbar,
  AdminBulkActionsBar,
  Column,
  ConfirmModal,
  DataTable,
  StatusBadge,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
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
  actions: true,
};

function formatDate(value?: string) {
  if (!value) return " — ";
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
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TierRow | null>(null);

  // Country Availability Modal state
  const [countryModalTier, setCountryModalTier] = useState<TierRow | null>(null);
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [countrySearchQuery, setCountrySearchQuery] = useState("");

  // Import Spreadsheet Modal state
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<SpreadsheetReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const { data: tierCountries = [], isLoading: countriesLoading } = useAdminTierCountries(countryModalTier?.id ?? "");
  const updateTierCountries = useUpdateTierCountries(countryModalTier?.id ?? "");

  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const deleteTier = useDeleteTier();
  const bulkTiers = useBulkTiers();
  const exportTiers = useExportTiers();
  const previewTierImport = usePreviewTierImport();
  const importTiers = useImportTiers();

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
    setCountryOverrides({});
    setCountrySearchQuery("");
  }, [countryModalTier?.id]);

  const selectedTierCountries = tierCountries as TierCountryRow[];
  const filteredModalCountries = useMemo(() => {
    if (!countrySearchQuery.trim()) return selectedTierCountries;
    const q = countrySearchQuery.toLowerCase();
    return selectedTierCountries.filter((c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [selectedTierCountries, countrySearchQuery]);

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
      showToast("Tier deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete tier."), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const { adminApi } = await import("@/services/adminApi");
      const res = await adminApi.get("/tiers", {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          countryId: countryFilter || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((t: any) => t.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} tiers across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all tiers.", "error");
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "DELETE") {
      setBulkDeleting(true);
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
          showToast(bulkAction === "ENABLE" ? "Tiers activated." : "Tiers deactivated.", "success");
        }
      } else {
        showToast(
          bulkAction === "ENABLE" ? "Tiers activated." : "Tiers deactivated.",
          "success"
        );
      }
      setSelectedIds([]);
      setBulkAction("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const confirmBulkDelete = async () => {
    try {
      const res = await bulkTiers.mutateAsync({ ids: selectedIds, action: "DELETE" });
      const summary = res.data?.summary;
      if (summary?.failed > 0) {
        showToast(`Deleted ${summary.succeeded} tier(s). ${summary.failed} could not be deleted as they are in use.`, "warning");
      } else {
        showToast(`Successfully deleted ${selectedIds.length} tier(s).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk delete."), "error");
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleToggleStatus = async (tier: TierRow) => {
    try {
      await updateTier.mutateAsync({
        id: tier.id,
        status: tier.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      showToast(tier.status === "ACTIVE" ? "Tier deactivated." : "Tier activated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update tier."), "error");
    }
  };

  const handleSelectAllCountries = (checked: boolean) => {
    setCountryOverrides(
      Object.fromEntries(selectedTierCountries.map((country) => [country.id, checked])),
    );
  };

  const handleExport = async (selectedOnly = false) => {
    try {
      const params: Record<string, unknown> = {
        search: debouncedSearch || undefined,
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

  const handleImportPreview = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
      const report = (await previewTierImport.mutateAsync(formData)) as SpreadsheetReport;
      setImportReport(report);
      setImportMessage(report.invalidRows > 0 ? "Fix the validation issues before importing." : "Preview looks good. You can import now.");
    } catch (error) {
      setImportMessage(getAdminErrorMessage(error, "Failed to preview tier spreadsheet."));
      setImportReport(null);
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
      setImportOpen(false);
      tiersQuery.refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import tiers."), "error");
    } finally {
      setImporting(false);
    }
  };

  const columns: Column<TierRow>[] = [
    {
      key: "name",
      label: "Tier Name",
      width: "220px",
      render: (tier) => (
        <div className="min-w-0 pr-3">
          <button
            type="button"
            onClick={() => startEdit(tier)}
            className="text-left font-semibold text-[#1A1A1A] hover:text-[#E31E24] text-[13px] block truncate transition-colors"
            title={tier.name}
          >
            {tier.name}
          </button>
          <div className="mt-0.5 text-[11.5px] text-[#6B6B6B]">Updated {formatDate(tier.updatedAt)}</div>
        </div>
      ),
    },
    {
      key: "customers",
      label: "Customers",
      width: "110px",
      render: (tier) => <span className="font-medium text-[#1A1A1A] text-[12.5px]">{tier._count?.customers ?? 0}</span>,
    },
    {
      key: "pricing",
      label: "Pricing Rules",
      width: "120px",
      render: (tier) => <span className="font-medium text-[#1A1A1A] text-[12.5px]">{tier._count?.pricing ?? 0}</span>,
    },
    {
      key: "discounts",
      label: "Discounts",
      width: "110px",
      render: (tier) => <span className="font-medium text-[#1A1A1A] text-[12.5px]">{tier._count?.discounts ?? 0}</span>,
    },
    {
      key: "countries",
      label: "Countries",
      width: "140px",
      render: (tier) => {
        const count = tier._count?.countries ?? 0;
        return (
          <button
            type="button"
            onClick={() => setCountryModalTier(tier)}
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#1A1A1A] hover:text-[#E31E24] rounded-md px-2 py-1 bg-gray-50 border border-gray-200 hover:border-gray-300 transition-colors cursor-pointer"
            title="Manage country availability"
          >
            <Globe size={12} className="text-[#6B6B6B]" />
            <span>{count === 0 ? "Global (All)" : `${count} Countries`}</span>
          </button>
        );
      },
    },
    {
      key: "priority",
      label: "Priority",
      width: "100px",
      render: (tier) => <span className="font-medium text-[#6B6B6B] text-[12.5px]">{tier.sortOrder}</span>,
    },
    {
      key: "status",
      label: "Status",
      width: "110px",
      render: (tier) => (
        <StatusBadge
          status={tier.status}
          interactive={canUpdate}
          onClick={() => handleToggleStatus(tier)}
          loading={updateTier.isPending && (updateTier.variables as any)?.id === tier.id}
        />
      ),
    },
    {
      key: "updatedAt",
      label: "Updated Date",
      width: "120px",
      render: (tier) => <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">{formatDate(tier.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "150px",
      align: "left",
      render: (tier) => (
        <div className="flex items-center justify-start gap-1">
          <button
            type="button"
            onClick={() => setCountryModalTier(tier)}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs cursor-pointer"
            title="Manage country availability"
          >
            <Globe size={13} />
          </button>
          {canUpdate && (
            <button
              type="button"
              onClick={() => startEdit(tier)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs cursor-pointer"
              title="Edit tier"
            >
              <Edit2 size={13} />
            </button>
          )}
          {canCreate && (
            <button
              type="button"
              onClick={() => startClone(tier)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs cursor-pointer"
              title="Clone tier"
            >
              <Copy size={13} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleteTarget(tier)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] transition-colors shadow-2xs cursor-pointer"
              title="Delete tier"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const filteredColumns = columns.filter((column) => {
    if (column.key === "name") return visibleColumns.name;
    if (column.key === "customers") return visibleColumns.customers;
    if (column.key === "pricing") return visibleColumns.pricing;
    if (column.key === "discounts") return visibleColumns.discounts;
    if (column.key === "countries") return visibleColumns.countries;
    if (column.key === "priority") return visibleColumns.priority;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "updatedAt") return visibleColumns.updatedAt;
    if (column.key === "actions") return visibleColumns.actions;
    return true;
  });

  return (
    <AdminLayout title="Pricing Tiers" breadcrumb={[{ label: "Pricing Tiers" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Tiers", value: tierDashboard?.totalTiers ?? 0, subtitle: "All tier records", icon: <Layers size={18} />, isLoading: dashboardLoading },
            { title: "Active Tiers", value: tierDashboard?.activeTiers ?? 0, subtitle: "Available for use", icon: <SquareCheckBig size={18} />, color: "bg-green-600", isLoading: dashboardLoading },
            { title: "Inactive Tiers", value: tierDashboard?.inactiveTiers ?? 0, subtitle: "Disabled tiers", icon: <X size={18} />, color: "bg-gray-600", isLoading: dashboardLoading },
            { title: "Country Rules", value: tierDashboard?.mappedCountries ?? 0, subtitle: "Tiers with country mapping", icon: <Globe size={18} />, color: "bg-amber-600", isLoading: dashboardLoading },
          ]}
        />

        {/* RECENTLY UPDATED CARD */}
        {(tierDashboard?.recentlyUpdated ?? []).length > 0 && (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Recently Updated</h3>
                <p className="text-[12px] text-[#6B6B6B]">Quick access to latest modified pricing tiers.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-[#6B6B6B]">
                {tierDashboard?.recentlyUpdated?.length ?? 0} items
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {(tierDashboard?.recentlyUpdated ?? []).slice(0, 5).map((tier) => (
                <div
                  key={tier.id}
                  className="rounded-lg border border-[#E6E6E6] p-3 text-left transition hover:bg-[#FAFAFA] flex flex-col justify-between"
                >
                  <div>
                    <div className="truncate text-[13px] font-semibold text-[#1A1A1A]">{tier.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">Updated {formatDate(tier.updatedAt)}</div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#F0F0F0] flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setCountryModalTier(tier)}
                      className="text-[11.5px] font-medium text-[#E31E24] hover:underline cursor-pointer"
                    >
                      Countries
                    </button>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => startEdit(tier)}
                        className="text-[11.5px] font-medium text-[#555] hover:text-[#1A1A1A] cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
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
            placeholder: "Search tiers...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters: showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [statusFilter, countryFilter, sortBy !== "sortOrder" ? sortBy : "", sortDir !== "asc" ? sortDir : ""].filter(Boolean).length,
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
            options: [
              { key: "name", label: "Tier Name" },
              { key: "customers", label: "Customers" },
              { key: "pricing", label: "Pricing Rules" },
              { key: "discounts", label: "Discounts" },
              { key: "countries", label: "Countries" },
              { key: "priority", label: "Priority" },
              { key: "status", label: "Status" },
              { key: "updatedAt", label: "Updated Date" },
              { key: "actions", label: "Actions" },
            ],
          }}
          exportAction={{
            onClick: () => void handleExport(selectedIds.length > 0),
            label: selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export Excel",
          }}
          importAction={
            canUpdate
              ? {
                  onClick: () => setImportOpen(true),
                  label: "Import Excel",
                }
              : undefined
          }
          refresh={{
            onRefresh: () => {
              void tiersQuery.refetch().then(() => showToast("Tiers refreshed."));
            },
            isRefreshing: tiersQuery.isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: startCreate,
                  label: "Add Tier",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          filterPanel={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[130px]"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                value={countryFilter}
                onChange={(event) => {
                  setCountryFilter(event.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[140px]"
              >
                <option value="">All Countries</option>
                {countries.map((c: any) => (
                  <option key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[140px]"
              >
                <option value="sortOrder">Priority</option>
                <option value="updatedAt">Updated date</option>
                <option value="createdAt">Created date</option>
                <option value="name">Tier name</option>
                <option value="status">Status</option>
              </select>
              <select
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[120px]"
              >
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          }
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setCountryFilter("");
            setSortBy("sortOrder");
            setSortDir("asc");
            setPage(1);
          }}
        />

        {/* FULL-WIDTH DATA TABLE */}
        <DataTable<TierRow>
          title="Tiers List"
          columns={filteredColumns}
          data={rows}
          rowKey="id"
          isLoading={tiersQuery.isLoading}
          emptyMessage="No tiers found."
          enableSelection={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onToggleStatus={canUpdate ? handleToggleStatus : undefined}
          statusLoadingId={updateTier.isPending ? ((updateTier.variables as any)?.id ?? null) : null}
          isStatusDisabled={() => !canUpdate}
          totalItems={pagination.total}
          currentPage={page}
          pageSize={limit}
          totalPages={pagination.totalPages || 1}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
          pageSizeOptions={[10, 20, 50, 100]}
          onSelectAll={handleSelectAll}
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
              actionType={bulkAction}
              onActionTypeChange={(val) => setBulkAction(val as any)}
              actions={[
                { value: "ENABLE", label: "Mark active" },
                { value: "DISABLE", label: "Mark inactive" },
                { value: "DELETE", label: "Delete selected" },
              ]}
              onApply={handleBulkAction}
              applyLoading={bulkTiers.isPending}
              applyDisabled={!bulkAction || selectedIds.length === 0}
            />
          )}
        />

        {/* ADD / EDIT TIER MODAL */}
        <Modal
          open={showForm}
          onClose={resetForm}
          title={form.values.id ? "Edit Tier" : "Add Tier"}
          subtitle="Configure customer pricing tiers, rank precedence, and lifecycle status."
          size="lg"
          footer={
            <div className="flex flex-wrap items-center justify-between gap-3 w-full">
              <p className="text-[12px] text-[#6B6B6B]">Priority controls resolver precedence. Lower values are processed first.</p>
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <LoadingButton
                  type="submit"
                  form="tier-form"
                  loading={form.isSubmitting || createTier.isPending || updateTier.isPending}
                  loadingText="Saving..."
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
                >
                  {form.values.id ? "Save Tier" : "Create Tier"}
                </LoadingButton>
              </div>
            </div>
          }
        >
          <form id="tier-form" onSubmit={form.handleSubmit} className="space-y-6 p-6">
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
          </form>
        </Modal>

        {/* COUNTRY AVAILABILITY MODAL */}
        <Modal
          open={!!countryModalTier}
          onClose={() => setCountryModalTier(null)}
          title={`Country Availability — ${countryModalTier?.name ?? ""}`}
          subtitle="A tier stays global if no countries are enabled. Once one or more countries are enabled, this tier is restricted exclusively to those selected countries."
          size="2xl"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => setCountryModalTier(null)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
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
                    setCountryModalTier(null);
                    tiersQuery.refetch();
                  } catch (error) {
                    showToast(getAdminErrorMessage(error, "Failed to save tier country availability."), "error");
                  }
                }}
                loading={updateTierCountries.isPending}
                loadingText="Saving..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
              >
                Save Availability
              </LoadingButton>
            </div>
          }
        >
          <div className="space-y-4 p-6">
            <div className="flex items-center justify-end">
              <span className="rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-[11.5px] font-semibold text-[#1A1A1A] shrink-0">
                {enabledCountryCount === 0 ? "Global fallback (All countries)" : `${enabledCountryCount} Countries Enabled`}
              </span>
            </div>

            {countriesLoading ? (
              <div className="h-48 animate-pulse rounded-md bg-[#F2F2F2]" />
            ) : selectedTierCountries.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#9A9A9A]">No countries found.</p>
            ) : (
              <>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2 text-[13px] font-semibold text-[#1A1A1A] cursor-pointer">
                    <input
                      type="checkbox"
                      className="h-4 w-4 accent-[#E31E24] cursor-pointer"
                      checked={allCountriesSelected}
                      ref={(element) => {
                        if (element) element.indeterminate = someCountriesSelected;
                      }}
                      onChange={(event) => handleSelectAllCountries(event.target.checked)}
                    />
                    <span>Select all ({enabledCountryCount} of {selectedTierCountries.length} enabled)</span>
                  </label>

                  <div className="relative w-[200px]">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                    <input
                      type="text"
                      placeholder="Filter countries..."
                      value={countrySearchQuery}
                      onChange={(e) => setCountrySearchQuery(e.target.value)}
                      className="h-8 w-full rounded-md border border-[#E6E6E6] bg-white pl-7 pr-2.5 text-[12px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                    />
                  </div>
                </div>

                <div className="max-h-[320px] overflow-y-auto rounded-lg border border-[#E6E6E6] bg-white divide-y divide-[#F0F0F0] p-1">
                  {filteredModalCountries.length === 0 ? (
                    <p className="p-4 text-center text-[12.5px] text-[#9A9A9A]">No matching countries.</p>
                  ) : (
                    filteredModalCountries.map((country) => {
                      const isEnabled = countryOverrides[country.id] ?? country.enabled;
                      return (
                        <label
                          key={country.id}
                          className="flex items-center justify-between gap-3 px-3 py-2 hover:bg-[#FAFAFA] rounded-md transition-colors cursor-pointer"
                        >
                          <div className="min-w-0">
                            <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                            <span className="text-[11.5px] text-[#9A9A9A]">
                              {country.code}
                              {country.currency?.code ? ` • ${country.currency.code}` : ""}
                            </span>
                          </div>
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-[#E31E24] cursor-pointer"
                            checked={isEnabled}
                            onChange={(event) => setCountryOverrides((current) => ({ ...current, [country.id]: event.target.checked }))}
                          />
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </Modal>

        {/* IMPORT SPREADSHEET MODAL */}
        <Modal
          open={importOpen}
          onClose={() => {
            setImportOpen(false);
            setImportFile(null);
            setImportReport(null);
            setImportMessage("");
          }}
          title="Import Tiers Spreadsheet"
          subtitle="Upload an Excel (.xlsx, .xls) or CSV spreadsheet to create or update pricing tiers in bulk."
          size="2xl"
          footer={
            <div className="flex items-center justify-end gap-2.5 w-full">
              <button
                type="button"
                onClick={() => {
                  setImportOpen(false);
                  setImportFile(null);
                  setImportReport(null);
                  setImportMessage("");
                }}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="button"
                onClick={handleImport}
                loading={importing || importTiers.isPending}
                loadingText="Importing..."
                disabled={!importFile || (importReport !== null && importReport.invalidRows > 0)}
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-50 cursor-pointer shadow-2xs"
              >
                Import Tiers
              </LoadingButton>
            </div>
          }
        >
          <div className="space-y-4 p-6">
            <div className="rounded-lg border-2 border-dashed border-[#E6E6E6] bg-[#FAFAFA] p-6 text-center hover:bg-[#F5F5F5] transition-colors">
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                className="hidden"
                id="tier-import-file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    setImportFile(file);
                    void handleImportPreview(file);
                  }
                }}
              />
              <label htmlFor="tier-import-file" className="cursor-pointer">
                <Upload size={28} className="mx-auto text-[#9A9A9A] mb-2" />
                <span className="text-[13.5px] font-semibold text-[#1A1A1A] block">
                  {importFile ? importFile.name : "Click to select spreadsheet"}
                </span>
                <span className="text-[12px] text-[#9A9A9A] mt-1 block">
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
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }}
                  className="mt-2 text-[12px] font-medium text-red-600 hover:underline inline-block cursor-pointer"
                >
                  Remove file
                </button>
              )}
            </div>

            {previewTierImport.isPending && (
              <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
                Validating and previewing spreadsheet...
              </div>
            )}

            {importReport && (
              <div className="space-y-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
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
                    <div className="text-[11px] font-semibold text-[#9A9A9A] uppercase tracking-wide">Duplicates</div>
                    <div className="mt-1 text-[18px] font-bold text-amber-600">{importReport.duplicateWarnings.length}</div>
                  </div>
                </div>

                {importReport.issues.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-[12.5px] font-semibold text-[#1A1A1A]">Validation Issues</h4>
                    <div className="max-h-40 overflow-y-auto rounded border border-[#E6E6E6] bg-white divide-y divide-[#F0F0F0]">
                      {importReport.issues.map((issue, index) => (
                        <div key={`${issue.row}-${issue.field}-${index}`} className="px-3 py-2 text-[12px] text-red-600">
                          <span className="font-semibold">Row {issue.row} [{issue.field}]:</span> {issue.message}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {importMessage && !importReport && (
              <div className="rounded-md bg-red-50 border border-red-200 p-3 text-[12.5px] text-red-700">
                {importMessage}
              </div>
            )}
          </div>
        </Modal>

        {/* CONFIRM DELETE MODALS */}
        <ConfirmModal
          open={!!deleteTarget}
          title="Delete tier?"
          message={deleteTarget ? `Delete tier "${deleteTarget.name}"? This is blocked automatically if customers, pricing rules, or discounts still reference it.` : ""}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          isLoading={deleteTier.isPending}
        />

        <ConfirmModal
          open={bulkDeleting}
          title="Delete selected tiers?"
          message={`Are you sure you want to delete the ${selectedIds.length} selected tier(s)? Tiers with active customer, pricing, or discount associations will be protected from deletion.`}
          onConfirm={confirmBulkDelete}
          onCancel={() => setBulkDeleting(false)}
          isLoading={bulkTiers.isPending}
        />

        {ToastComponent}
      </div>
    </AdminLayout>
  );
}
