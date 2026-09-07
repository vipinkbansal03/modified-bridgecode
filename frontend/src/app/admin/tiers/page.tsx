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
  CheckCircle2,
  XCircle,
  RotateCcw,
  SlidersHorizontal,
  Archive,
  AlertTriangle,
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
  AdminDeleteModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import {
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminRowActions";
import { AdminImportWizard, WizardColumnDef, WizardExpectedColumn } from "@/components/admin/AdminImportWizard";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/formatDate";
import {
  useAdminCountries,
  useAdminTierCountries,
  useAdminTierDashboard,
  useAdminTiersPaged,
  useBulkTiers,
  useCreateTier,
  useUpdateTier,
  useArchiveTier,
  useRestoreTier,
  usePermanentDeleteTier,
  useBulkRestoreTiers,
  useBulkPermanentDeleteTiers,
  useExportTiers,
  useImportTiers,
  usePreviewTierImport,
  useUpdateTierCountries,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type TierRow = {
  id: string;
  name: string;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  createdAt?: string;
  updatedAt?: string;
  deletedAt?: string | null;
  _count?: { customers?: number; pricing?: number; discounts?: number; countries?: number };
  canPermanentDelete?: boolean;
  permanentDeleteBlockReason?: string | null;
  dependencyCounts?: { customers?: number; pricing?: number; discounts?: number; countries?: number };
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
  archivedTiers: number;
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

const tierExpectedColumns: WizardExpectedColumn[] = [
  { name: "name", required: true, hint: "Tier display name" },
  { name: "status", hint: "ACTIVE or INACTIVE" },
  { name: "sortOrder", hint: "Priority sort order (0, 1, 2...)" },
  { name: "countryCodes", hint: "All countries (ALL) or comma-separated 2-letter ISO country codes" },
];
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
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "ARCHIVE" | "RESTORE" | "PERMANENT_DELETE" | "DELETE" | "">("");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkPermanentModal, setShowBulkPermanentModal] = useState(false);
  const [bulkPermanentResult, setBulkPermanentResult] = useState<any | null>(null);
  const [knownTiers, setKnownTiers] = useState<Record<string, TierRow>>({});
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<TierRow | null>(null);
  const [isArchivedTab, setIsArchivedTab] = useState(false);

  // Country Availability Modal state
  const [countryModalTier, setCountryModalTier] = useState<TierRow | null>(null);
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [countrySearchQuery, setCountrySearchQuery] = useState("");

  // Import Spreadsheet Modal state
  const [importOpen, setImportOpen] = useState(false);

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
  }, [debouncedSearch, isArchivedTab]);

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminTierDashboard();
  const { data: countries = [] } = useAdminCountries();

  const wizardCountryOptions = useMemo(() => {
    const list = (countries || [])
      .filter((c: any) => c.status === "ACTIVE" || !c.status)
      .map((c: any) => ({
        label: `${c.name} (${c.code.toUpperCase()})`,
        value: c.code.toUpperCase(),
      }));
    return [
      { label: "All countries", value: "ALL" },
      ...list,
    ];
  }, [countries]);

  const tierWizardColumns = useMemo<WizardColumnDef[]>(() => [
    { key: "name", header: "Tier Name", required: true, minWidth: "160px", placeholder: "e.g. Wholesale Gold" },
    {
      key: "status",
      header: "Status",
      type: "select",
      minWidth: "110px",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
      ],
    },
    { key: "sortOrder", header: "Sort Order", type: "number", minWidth: "100px" },
    {
      key: "countryCodes",
      header: "Countries",
      type: "multiselect",
      options: wizardCountryOptions,
      minWidth: "160px",
      placeholder: "All countries or IN, US...",
    },
  ], [wizardCountryOptions]);
  const tiersQuery = useAdminTiersPaged({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: isArchivedTab ? undefined : (statusFilter || undefined),
    deleted: isArchivedTab ? "true" : undefined,
    countryId: countryFilter || undefined,
    sortBy,
    sortDir,
  });

  const tierDashboard = dashboardData as TierDashboard | undefined;
  const tiersResponse = tiersQuery.data as { data?: TierRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } } | undefined;
  const rows = (tiersResponse?.data ?? []) as TierRow[];
  const pagination = tiersResponse?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  useEffect(() => {
    if (rows.length > 0) {
      setKnownTiers((prev) => {
        const next = { ...prev };
        rows.forEach((r) => {
          next[r.id] = r;
        });
        return next;
      });
    }
  }, [rows]);

  const { data: tierCountries = [], isLoading: countriesLoading } = useAdminTierCountries(countryModalTier?.id ?? "");
  const updateTierCountries = useUpdateTierCountries(countryModalTier?.id ?? "");

  const createTier = useCreateTier();
  const updateTier = useUpdateTier();
  const archiveTier = useArchiveTier();
  const restoreTier = useRestoreTier();
  const permanentDeleteTier = usePermanentDeleteTier();
  const bulkTiers = useBulkTiers();
  const bulkRestoreTiers = useBulkRestoreTiers();
  const bulkPermanentDeleteTiers = useBulkPermanentDeleteTiers();
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

  const handleArchiveSingle = async () => {
    if (!deleteTarget) return;
    try {
      await archiveTier.mutateAsync(deleteTarget.id);
      showToast("Tier archived.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to archive tier."), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handlePermanentDeleteSingle = async () => {
    if (!deleteTarget) return;
    try {
      await permanentDeleteTier.mutateAsync(deleteTarget.id);
      showToast("Tier permanently deleted.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete tier."), "error");
    } finally {
      setDeleteTarget(null);
    }
  };

  const handleRestore = async (tier: TierRow) => {
    try {
      await restoreTier.mutateAsync(tier.id);
      showToast(`Tier "${tier.name}" restored.`, "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to restore tier."), "error");
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
          status: isArchivedTab ? undefined : (statusFilter || undefined),
          deleted: isArchivedTab ? "true" : undefined,
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
    if (bulkAction === "PERMANENT_DELETE") {
      setShowBulkPermanentModal(true);
      return;
    }

    try {
      let res: any;
      if (bulkAction === "RESTORE") {
        res = await bulkRestoreTiers.mutateAsync(selectedIds);
      } else {
        res = await bulkTiers.mutateAsync({ ids: selectedIds, action: bulkAction });
      }
      const summary = res?.data?.summary ?? res?.summary;
      if (summary) {
        if (summary.failed > 0) {
          if (summary.succeeded === 0) {
            const firstError = (res?.data?.results ?? res?.results)?.find((r: any) => !r.success)?.error || "Action failed.";
            showToast(firstError, "error");
            return;
          } else {
            showToast(`Completed with warnings: ${summary.succeeded} succeeded, ${summary.failed} failed.`, "warning");
          }
        } else {
          showToast(
            bulkAction === "ENABLE"
              ? "Tiers activated."
              : bulkAction === "DISABLE"
              ? "Tiers deactivated."
              : bulkAction === "RESTORE"
              ? "Tiers restored."
              : "Tiers archived.",
            "success"
          );
        }
      } else {
        showToast(
          bulkAction === "ENABLE"
            ? "Tiers activated."
            : bulkAction === "DISABLE"
            ? "Tiers deactivated."
            : bulkAction === "RESTORE"
            ? "Tiers restored."
            : "Tiers archived.",
          "success"
        );
      }
      setSelectedIds([]);
      setBulkAction("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const handleBulkSoftDelete = async () => {
    if (selectedIds.length === 0) return;
    try {
      await bulkTiers.mutateAsync({ ids: selectedIds, action: "ARCHIVE" });
      showToast(`Successfully archived ${selectedIds.length} tier(s).`, "success");
      setSelectedIds([]);
      setBulkAction("");
      setBulkDeleting(false);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to archive tiers."), "error");
    }
  };

  const handleConfirmBulkPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    const totalSelected = selectedIds.length;
    try {
      const result = await bulkPermanentDeleteTiers.mutateAsync(selectedIds);
      setBulkDeleting(false);
      setShowBulkPermanentModal(false);
      setBulkAction("");

      if (result) {
        const payload = (result as any)?.data ?? result;
        const deletedIds: string[] = Array.isArray(payload?.deletedIds) ? payload.deletedIds : [];
        const blocked: Array<{ id: string; name?: string; reason: string }> = Array.isArray(payload?.blocked) ? payload.blocked : [];
        const deletedCount = typeof payload?.deletedCount === "number" ? payload.deletedCount : deletedIds.length;
        const blockedCount = typeof payload?.blockedCount === "number" ? payload.blockedCount : (blocked.length || Math.max(0, totalSelected - deletedCount));

        const enrichedBlocked = blocked.map((b) => ({
          ...b,
          name: b.name || knownTiers[b.id]?.name || b.id,
        }));

        if (blockedCount > 0 && deletedIds.length > 0) {
          setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
        } else if (deletedCount > 0 && blockedCount === 0) {
          setSelectedIds([]);
        }

        setBulkPermanentResult({
          totalSelected,
          deletedCount,
          blockedCount,
          deletedIds,
          blocked: enrichedBlocked,
        });

        if (blockedCount === 0 && deletedCount > 0) {
          showToast(`Successfully permanently deleted all ${deletedCount} pricing tier(s).`, "success");
        } else if (deletedCount === 0 && blockedCount > 0) {
          showToast(`All ${blockedCount} selected pricing tier(s) are protected from permanent deletion.`, "error");
        } else {
          showToast(`Permanently deleted ${deletedCount} tier(s); ${blockedCount} protected tier(s) preserved.`, "warning");
        }
      }
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to permanently delete pricing tiers."), "error");
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

  const downloadSampleTemplate = async () => {
    try {
      const response = await adminApi.get("/tiers/sample-template", { responseType: "blob" });
      downloadBlob(response.data as Blob, "tiers-template.xlsx");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download sample template."), "error");
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
        isArchivedTab ? (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
            Archived
          </span>
        ) : (
          <StatusBadge
            status={tier.status}
            interactive={canUpdate}
            onClick={() => handleToggleStatus(tier)}
            loading={updateTier.isPending && (updateTier.variables as any)?.id === tier.id}
          />
        )
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
      render: (tier) => {
        if (isArchivedTab) {
          const isBlocked = tier.canPermanentDelete === false;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <AdminActionButton
                action={{
                  onClick: () => handleRestore(tier),
                  title: "Restore tier",
                  loading: restoreTier.isPending && (restoreTier.variables as any) === tier.id,
                }}
                defaultIcon={<RotateCcw size={13} />}
                defaultTitle="Restore tier"
              />
              <AdminActionButton
                action={{
                  onClick: () => setDeleteTarget(tier),
                  title: isBlocked
                    ? (tier.permanentDeleteBlockReason || "Cannot permanently delete: Tier has active dependencies.")
                    : "Permanently delete tier",
                  disabled: isBlocked,
                }}
                variant="danger"
                defaultIcon={<Trash2 size={13} />}
                defaultTitle="Permanently delete tier"
              />
            </div>
          );
        }
        return (
          <AdminRowActions
            view={{
              onClick: () => setCountryModalTier(tier),
              title: "Manage country availability",
              icon: <Globe size={13} />,
            }}
            edit={
              canUpdate
                ? {
                    onClick: () => startEdit(tier),
                    title: "Edit tier",
                  }
                : undefined
            }
            extra={
              canCreate ? (
                <AdminActionButton
                  action={{
                    onClick: () => startClone(tier),
                    title: "Clone tier",
                  }}
                  defaultIcon={<Copy size={13} />}
                  defaultTitle="Clone tier"
                />
              ) : null
            }
            delete={
              canDelete
                ? {
                    onClick: () => setDeleteTarget(tier),
                    title: "Archive tier",
                  }
                : undefined
            }
          />
        );
      },
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
    <AdminLayout title="Pricing Tiers" breadcrumb={[{ label: "Pricing", href: "/admin/pricing" }, { label: "Pricing Tiers" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Tiers", value: tierDashboard?.totalTiers ?? 0, subtitle: "All active & inactive tiers", icon: <Layers size={18} />, isLoading: dashboardLoading },
            { title: "Active Tiers", value: tierDashboard?.activeTiers ?? 0, subtitle: "Available for use", icon: <CheckCircle2 size={18} />, color: "bg-emerald-600", isLoading: dashboardLoading },
            { title: "Inactive Tiers", value: tierDashboard?.inactiveTiers ?? 0, subtitle: "Disabled tiers", icon: <XCircle size={18} />, color: "bg-slate-600", isLoading: dashboardLoading },
            { title: "Archived Tiers", value: tierDashboard?.archivedTiers ?? 0, subtitle: "Soft-deleted tiers", icon: <Archive size={18} />, color: "bg-rose-600", isLoading: dashboardLoading },
            { title: "Country Rules", value: tierDashboard?.mappedCountries ?? 0, subtitle: "Tiers with country mapping", icon: <Globe size={18} />, color: "bg-amber-600", isLoading: dashboardLoading },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {[
            { id: "", label: "All Tiers", count: tierDashboard?.totalTiers ?? 0, icon: <Layers size={15} /> },
            { id: "ACTIVE", label: "Active", count: tierDashboard?.activeTiers ?? 0, icon: <CheckCircle2 size={15} /> },
            { id: "INACTIVE", label: "Inactive", count: tierDashboard?.inactiveTiers ?? 0, icon: <XCircle size={15} /> },
            { id: "ARCHIVED", label: "Archived", count: tierDashboard?.archivedTiers ?? 0, icon: <Archive size={15} /> },
          ].map((tab) => {
            const isActive = isArchivedTab ? tab.id === "ARCHIVED" : (!isArchivedTab && statusFilter === tab.id);
            return (
              <button
                key={tab.id || "ALL"}
                type="button"
                onClick={() => {
                  if (tab.id === "ARCHIVED") {
                    setIsArchivedTab(true);
                    setStatusFilter("");
                  } else {
                    setIsArchivedTab(false);
                    setStatusFilter(tab.id);
                  }
                  setPage(1);
                  setSelectedIds([]);
                }}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap",
                  isActive
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A]"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "bg-[#F0F0F0] text-[#666]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Country"
                value={countryFilter}
                onChange={(event) => {
                  setCountryFilter(event.target.value);
                  setPage(1);
                }}
                options={countryOptions}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "sortOrder", label: "Priority (Sort Order)" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "createdAt", label: "Created Date" },
                  { value: "name", label: "Tier Name" },
                  { value: "status", label: "Status" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
              />
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
        <div>
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
                actions={
                  isArchivedTab
                    ? [
                        { value: "RESTORE", label: "Restore selected" },
                        { value: "PERMANENT_DELETE", label: "Permanently delete selected" },
                      ]
                    : [
                        { value: "ENABLE", label: "Mark active" },
                        { value: "DISABLE", label: "Mark inactive" },
                        { value: "DELETE", label: "Delete selected" },
                      ]
                }
                onApply={handleBulkAction}
                applyLoading={bulkTiers.isPending || bulkRestoreTiers.isPending || bulkPermanentDeleteTiers.isPending}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={pagination.totalPages || 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>

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
              <AdminInput
                required
                label="Tier Name"
                {...form.getFieldProps("name")}
                error={form.errors.name as string}
                placeholder="Platinum, Gold, Silver..."
              />
              <AdminSelect
                label="Status"
                {...form.getFieldProps("status")}
                error={form.errors.status as string}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <div>
                <AdminInput
                  label="Priority"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  {...form.getFieldProps("sortOrder")}
                  error={form.errors.sortOrder as string}
                  placeholder="0"
                />
                <p className="mt-1 text-[11.5px] text-[#6B6B6B]">
                  Lower numerical values take precedence during price resolution.
                </p>
              </div>
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
        <AdminImportWizard
          open={importOpen}
          onClose={() => setImportOpen(false)}
          title="Import Tiers Spreadsheet"
          subtitle="Upload an Excel (.xlsx, .xls) or CSV spreadsheet to create or update pricing tiers with live preview & direct inline editing."
          entityName="pricing tiers"
          columns={tierWizardColumns}
          expectedColumns={tierExpectedColumns}
          sampleTemplateUrl="/tiers/sample-template"
          sampleTemplateFilename="tiers-template.xlsx"
          previewEndpoint="/tiers/import/preview"
          executeEndpoint="/tiers/import"
          onSuccess={(result) => {
            showToast(
              `Import complete: ${result?.created ?? 0} created, ${result?.updated ?? 0} updated.`,
              "success"
            );
            tiersQuery.refetch();
          }}
        />

        {/* CONFIRM DELETE / ARCHIVE MODALS */}
        <AdminDeleteModal
          open={!!deleteTarget}
          onClose={() => setDeleteTarget(null)}
          itemName={deleteTarget ? deleteTarget.name : undefined}
          itemType="Pricing Tier"
          warningMessage={
            isArchivedTab
              ? "Permanent deletion will permanently remove this tier from the database and cascade delete all its country mappings. This action cannot be undone."
              : "Choose the deletion method for this tier. Soft Delete (Archive) is recommended to preserve historical customer and pricing links."
          }
          softDeleteDescription={
            isArchivedTab
              ? "This tier is already soft-deleted and stored in the central Archive."
              : "Hides this tier from active pricing resolution while preserving customer assignments, tier pricing rules, and country availability."
          }
          permanentDeleteDescription={
            deleteTarget
              ? `Permanently purges tier "${deleteTarget.name}" and deletes country availability mappings. Blocked if customers, pricing rules, or discounts are assigned.`
              : undefined
          }
          permanentDeleteDisabled={!isArchivedTab || Boolean(deleteTarget && deleteTarget.canPermanentDelete === false)}
          permanentDeleteDisabledReason={
            !isArchivedTab
              ? "Permanent Delete is available only for archived tiers. Archive the tier first."
              : (deleteTarget?.permanentDeleteBlockReason ?? undefined)
          }
          initialDeleteType={isArchivedTab ? "permanent" : "soft"}
          softDeleteButtonText={isArchivedTab ? undefined : "Archive Pricing Tier"}
          permanentDeleteButtonText="Permanently Delete Pricing Tier"
          onSoftDelete={
            isArchivedTab
              ? () => {
                  showToast("Tier is already archived.", "info");
                  setDeleteTarget(null);
                }
              : handleArchiveSingle
          }
          onPermanentDelete={handlePermanentDeleteSingle}
          isSoftDeleting={archiveTier.isPending}
          isPermanentDeleting={permanentDeleteTier.isPending}
        />

        {/* ─── Bulk Deletion Method Modal (Normal Views) ─── */}
        <AdminDeleteModal
          open={bulkDeleting}
          onClose={() => {
            setBulkDeleting(false);
            setBulkAction("");
          }}
          itemName={`${selectedIds.length} selected pricing tiers`}
          itemType="Pricing Tiers (Bulk)"
          warningMessage="Choose the deletion method for the selected pricing tiers. Soft Delete (Archive) is recommended to maintain customer tier assignments and pricing history."
          softDeleteDescription={`Archives the ${selectedIds.length} selected pricing tiers from the active workspace while preserving customer assignments, tier pricing rules, and country availability for possible restoration.`}
          permanentDeleteDescription={`Permanently purges the ${selectedIds.length} selected pricing tiers from the database. Any tier with assigned customers, pricing rules, or discounts will be protected.`}
          permanentDeleteDisabled={true}
          permanentDeleteDisabledReason="Permanent Delete is available only for archived tiers. Archive the tier first."
          softDeleteButtonText="Archive Pricing Tiers (Bulk)"
          permanentDeleteButtonText="Permanently Delete Pricing Tiers (Bulk)"
          onSoftDelete={handleBulkSoftDelete}
          onPermanentDelete={handleConfirmBulkPermanentDelete}
          isSoftDeleting={bulkTiers.isPending}
          isPermanentDeleting={bulkPermanentDeleteTiers.isPending}
        />

        {/* ─── Bulk Permanent Delete Confirmation Modal (Archived Tab) ─── */}
        <Modal
          open={showBulkPermanentModal}
          onClose={() => !bulkPermanentDeleteTiers.isPending && setShowBulkPermanentModal(false)}
          title={`Permanently Delete ${selectedIds.length} Pricing Tier${selectedIds.length > 1 ? "s" : ""}`}
          subtitle="Physical database purge with authoritative backend dependency checks."
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                disabled={bulkPermanentDeleteTiers.isPending}
                onClick={() => setShowBulkPermanentModal(false)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkPermanentDeleteTiers.isPending}
                onClick={handleConfirmBulkPermanentDelete}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Trash2 size={14} />
                {bulkPermanentDeleteTiers.isPending ? "Evaluating & Deleting..." : "Permanently Delete"}
              </button>
            </div>
          }
        >
          <div className="p-5 space-y-4">
            <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-[13px] text-red-900 leading-relaxed">
              <div className="flex items-center gap-2 font-semibold text-red-800 mb-1">
                <AlertTriangle size={16} className="text-red-600 shrink-0" />
                Warning: Irreversible Action
              </div>
              You have selected <span className="font-bold">{selectedIds.length}</span> pricing tier{selectedIds.length > 1 ? "s" : ""} from the archive for permanent deletion.
            </div>

            <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 text-[12.5px] text-[#555] space-y-2">
              <span className="font-semibold text-[#1A1A1A] block">Authoritative Data Integrity Protection:</span>
              <p>
                Every selected tier is individually verified by backend safety rules before deletion.
              </p>
              <p>
                Any tier with assigned customers, pricing rules, or discounts will be <strong className="text-[#1A1A1A]">strictly protected</strong> and preserved.
              </p>
            </div>
          </div>
        </Modal>

        {/* ─── Bulk Permanent Delete Result Modal ─── */}
        <Modal
          open={Boolean(bulkPermanentResult)}
          onClose={() => setBulkPermanentResult(null)}
          title={
            bulkPermanentResult
              ? bulkPermanentResult.deletedCount === 0
                ? "Permanent Deletion Blocked"
                : bulkPermanentResult.blockedCount === 0
                ? "Permanent Delete Completed"
                : "Permanent Delete Completed (Mixed Result)"
              : "Bulk Permanent Deletion Results"
          }
          subtitle={
            bulkPermanentResult
              ? bulkPermanentResult.deletedCount === 0
                ? `All ${bulkPermanentResult.blockedCount || bulkPermanentResult.totalSelected} selected tiers are protected by database integrity rules.`
                : bulkPermanentResult.blockedCount === 0
                ? `All ${bulkPermanentResult.totalSelected} selected tiers were permanently purged from the database.`
                : `${bulkPermanentResult.deletedCount} permanently deleted, ${bulkPermanentResult.blockedCount} protected records preserved.`
              : "Summary of processed and protected records."
          }
          size="lg"
          footer={
            <div className="flex items-center justify-end w-full">
              <button
                type="button"
                onClick={() => setBulkPermanentResult(null)}
                className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-black transition-colors cursor-pointer shadow-2xs"
              >
                Close Summary
              </button>
            </div>
          }
        >
          {bulkPermanentResult && (
            <div className="p-5 space-y-4">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#666] block">
                    Selected
                  </span>
                  <span className="text-2xl font-bold text-[#1A1A1A]">
                    {bulkPermanentResult.totalSelected ?? (bulkPermanentResult.deletedCount + bulkPermanentResult.blockedCount)}
                  </span>
                </div>
                <div className="rounded-lg border border-green-200 bg-green-50 p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-green-700 block">
                    Permanently Deleted
                  </span>
                  <span className="text-2xl font-bold text-green-800">
                    {bulkPermanentResult.deletedCount}
                  </span>
                </div>
                <div
                  className={cn(
                    "rounded-lg border p-3",
                    bulkPermanentResult.deletedCount === 0
                      ? "border-red-200 bg-red-50 text-red-800"
                      : "border-amber-200 bg-amber-50 text-amber-800"
                  )}
                >
                  <span
                    className={cn(
                      "text-[11px] font-semibold uppercase tracking-wider block",
                      bulkPermanentResult.deletedCount === 0 ? "text-red-700" : "text-amber-700"
                    )}
                  >
                    Protected / Skipped
                  </span>
                  <span
                    className={cn(
                      "text-2xl font-bold",
                      bulkPermanentResult.deletedCount === 0 ? "text-red-800" : "text-amber-800"
                    )}
                  >
                    {bulkPermanentResult.blockedCount}
                  </span>
                </div>
              </div>

              {bulkPermanentResult.blockedCount === 0 && bulkPermanentResult.deletedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-[12.5px] text-emerald-900">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>
                    All {bulkPermanentResult.deletedCount} selected tiers were permanently removed from the database.
                  </span>
                </div>
              )}

              {bulkPermanentResult.deletedCount === 0 && bulkPermanentResult.blockedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[12.5px] text-red-900">
                  <XCircle size={16} className="shrink-0 text-red-600" />
                  <span>
                    All {bulkPermanentResult.blockedCount} tiers could not be permanently deleted because they have active dependencies (assigned customers, pricing rules, or discounts).
                  </span>
                </div>
              )}

              {bulkPermanentResult.deletedCount > 0 && bulkPermanentResult.blockedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[12.5px] text-amber-900">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                  <span>
                    Partial completion: {bulkPermanentResult.deletedCount} tier(s) deleted, {bulkPermanentResult.blockedCount} tier(s) preserved by safety rules.
                  </span>
                </div>
              )}

              {bulkPermanentResult.blocked && bulkPermanentResult.blocked.length > 0 && (
                <div className="space-y-2 mt-2">
                  <span className="text-[12px] font-semibold text-[#555] uppercase tracking-wider block">
                    Protected Records & Reasons
                  </span>
                  <div className="max-h-48 overflow-y-auto rounded-md border border-[#E6E6E6] bg-[#FAFAFA] divide-y divide-[#E6E6E6]">
                    {bulkPermanentResult.blocked.map((item: any) => (
                      <div key={item.id} className="p-2.5 text-[12px] flex items-start justify-between gap-3">
                        <div>
                          <div className="font-medium text-[#1A1A1A]">{item.name || item.id}</div>
                          <div className="text-[#888] text-[11px] mt-0.5">{item.reason}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {ToastComponent}
      </div>
    </AdminLayout>
  );
}
