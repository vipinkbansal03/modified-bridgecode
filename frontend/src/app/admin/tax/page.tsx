"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Filter, Plus, RefreshCw, Search, SquareCheckBig, Trash2, Upload, X, SlidersHorizontal, Pencil } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  DataTable,
  Pagination,
  StatCard,
  StatusBadge,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCountries,
  useAdminTaxDashboard,
  useAdminTaxPreview,
  useAdminTaxRules,
  useBulkTaxRules,
  useCreateTaxRule,
  useDeleteTaxRule,
  useExportTaxRules,
  useImportTaxRules,
  usePreviewTaxImport,
  useUpdateTaxRule,
  useAdminProducts,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type TaxRule = {
  id: string;
  name: string;
  type: "CGST" | "SGST" | "VAT" | "SALES_TAX";
  taxMode: "EXCLUSIVE" | "INCLUSIVE" | "EXEMPT";
  percentage: string | number;
  countryId: string;
  country?: { id: string; name: string; code: string; currency?: { code: string; symbol: string } | null };
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  products?: Array<{ id: string; title: string }>;
};

type TaxDashboard = {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  activeCountries: number;
  byType: { cgst: number; sgst: number; vat: number; salesTax: number };
  recentlyUpdatedRules: TaxRule[];
};

type TaxPreview = {
  country: { id: string; name: string; code: string; currency?: { code: string; symbol: string } | null };
  subtotal: number;
  taxAmount: number;
  total: number;
  appliedRules: Array<{
    id: string;
    name: string;
    type: string;
    taxMode?: string;
    percentage: number;
    taxAmount: number;
    amountBefore: number;
    amountAfter: number;
  }>;
};

type TaxFormState = {
  id: string;
  name: string;
  type: TaxRule["type"];
  taxMode: TaxRule["taxMode"];
  percentage: string;
  countryId: string;
  status: TaxRule["status"];
  sortOrder: string;
  productIds: string[];
};

type PreviewState = {
  countryId: string;
  subtotal: string;
};

type SpreadsheetReport = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: Array<{ row: number; field: string; message: string }>;
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

const emptyForm: TaxFormState = {
  id: "",
  name: "",
  type: "VAT",
  taxMode: "EXCLUSIVE",
  percentage: "",
  countryId: "",
  status: "ACTIVE",
  sortOrder: "0",
  productIds: [],
};

const emptyPreview: PreviewState = {
  countryId: "",
  subtotal: "1000",
};

const visibleColumnsDefault = {
  name: true,
  type: true,
  country: true,
  percentage: true,
  status: true,
  sortOrder: true,
  updatedAt: true,
};

function formatMoney(value: number | string | null | undefined, currencySymbol?: string | null) {
  if (value === null || value === undefined || value === "") return "—";
  const amount = Number(value);
  const prefix = currencySymbol ?? "";
  return `${prefix}${Number.isFinite(amount) ? amount.toFixed(2) : String(value)}`;
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString();
}

export default function AdminTaxPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("tax.create");
  const canUpdate = hasPermission("tax.update");
  const canDelete = hasPermission("tax.delete");

  const { showToast, ToastComponent } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<TaxFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<TaxRule | null>(null);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<SpreadsheetReport | null>(null);
  const [previewForm, setPreviewForm] = useState<PreviewState>(emptyPreview);
  const [productSearch, setProductSearch] = useState("");

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminTaxDashboard();
  const { data: countries = [] } = useAdminCountries();
  const { data: productsData } = useAdminProducts({ limit: 1000 });
  const products = productsData?.data ?? [];
  const filteredProducts = products.filter((p: any) =>
    p.title.toLowerCase().includes(productSearch.toLowerCase())
  );
  const { data, isLoading, refetch } = useAdminTaxRules({
    page,
    limit,
    search: search || undefined,
    status: statusFilter || undefined,
    countryId: countryFilter || undefined,
    type: typeFilter || undefined,
    sortBy,
    sortDir,
  });

  const dashboard = dashboardData as TaxDashboard | undefined;
  const rules = (data?.data ?? []) as TaxRule[];
  const pagination = data?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  const createRule = useCreateTaxRule();
  const updateRule = useUpdateTaxRule();
  const deleteRule = useDeleteTaxRule();
  const bulkTaxRules = useBulkTaxRules();
  const exportTaxRules = useExportTaxRules();
  const previewTaxImport = usePreviewTaxImport();
  const importTaxRules = useImportTaxRules();

  const previewCountryId = previewForm.countryId || countries[0]?.id || "";
  const previewQuery = previewCountryId && previewForm.subtotal ? { countryId: previewCountryId, subtotal: Number(previewForm.subtotal) } : undefined;
  const { data: taxPreview, isFetching: previewLoading, error: previewError } = useAdminTaxPreview(previewQuery);
  const preview = taxPreview as TaxPreview | undefined;

  useEffect(() => {
    if (!previewForm.countryId && countries.length > 0) {
      setPreviewForm((current) => ({ ...current, countryId: countries[0].id }));
    }
  }, [countries, previewForm.countryId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, search, statusFilter, countryFilter, typeFilter, sortBy, sortDir]);

  const countryOptions = [
    { value: "", label: "All countries" },
    ...countries.map((country: { id: string; name: string; code: string }) => ({
      value: country.id,
      label: `${country.name} (${country.code})`,
    })),
  ];

  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);

  const columns: Column<TaxRule>[] = [
      {
        key: "name",
        label: "Rule Name",
        width: "220px",
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-[#1A1A1A]">{row.name}</div>
            <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.country?.code ?? "—"}</div>
          </div>
        ),
      },
      { key: "type", label: "Rule Type", width: "140px", render: (row) => row.type.replace("_", " ") },
      {
        key: "country",
        label: "Country",
        width: "180px",
        render: (row) => (
          <div>
            <div className="font-medium">{row.country?.name ?? "—"}</div>
            <div className="text-[11.5px] text-[#9A9A9A]">{row.country?.code ?? ""}</div>
          </div>
        ),
      },
      {
        key: "percentage",
        label: "Tax %",
        width: "110px",
        render: (row) => <span className="font-medium text-[#1A1A1A]">{Number(row.percentage).toFixed(2)}%</span>,
      },
      { key: "status", label: "Status", width: "120px", render: (row) => <StatusBadge status={row.status} /> },
      { key: "sortOrder", label: "Priority", width: "100px" },
      {
        key: "updatedAt",
        label: "Updated Date",
        width: "130px",
        render: (row) => <span className="text-[#1A1A1A]">{formatDate(row.updatedAt)}</span>,
      },
      {
        key: "actions",
        label: "Actions",
        width: "200px",
        render: (row) => (
          <div className="flex flex-wrap items-center gap-1.5">
            {canUpdate && (
              <>
                <button type="button" onClick={() => openEdit(row)} className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]" title="Edit rule">
                  <Pencil size={15} />
                </button>
                <button
                  type="button"
                  onClick={() => handleStatusToggle(row)}
                  className="rounded border border-[#E6E6E6] p-2 text-[#6B6B6B] hover:bg-[#F5F5F5]"
                  title={row.status === "ACTIVE" ? "Disable rule" : "Enable rule"}
                >
                  <RefreshCw size={15} />
                </button>
              </>
            )}
            {canDelete && (
              <button type="button" onClick={() => setDeleteTarget(row)} className="rounded border border-[#F2D7D7] p-2 text-[#E31E24] hover:bg-[#FFF5F5]" title="Delete rule">
                <Trash2 size={15} />
              </button>
            )}
          </div>
        ),
      },
  ];

  function openCreate() {
    setForm(emptyForm);
    setProductSearch("");
    setShowForm(true);
  }

  function openEdit(row: TaxRule) {
    setForm({
      id: row.id,
      name: row.name,
      type: row.type,
      taxMode: row.taxMode || "EXCLUSIVE",
      percentage: String(row.percentage),
      countryId: row.countryId,
      status: row.status,
      sortOrder: String(row.sortOrder ?? 0),
      productIds: (row.products ?? []).map((p) => p.id),
    });
    setProductSearch("");
    setShowForm(true);
  }

  async function handleStatusToggle(row: TaxRule) {
    try {
      await updateRule.mutateAsync({
        id: row.id,
        status: row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
      });
      showToast(row.status === "ACTIVE" ? "Tax rule disabled." : "Tax rule enabled.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update tax rule."), "error");
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    try {
      const payload = {
        name: form.name,
        type: form.type,
        taxMode: form.taxMode,
        percentage: form.percentage,
        countryId: form.countryId,
        status: form.status,
        sortOrder: form.sortOrder,
        productIds: form.productIds,
      };

      if (form.id) {
        await updateRule.mutateAsync({ id: form.id, ...payload });
        showToast("Tax rule updated.");
      } else {
        await createRule.mutateAsync(payload);
        showToast("Tax rule created.");
      }

      setShowForm(false);
      setForm(emptyForm);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not save tax rule."), "error");
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      await deleteRule.mutateAsync(deleteTarget.id);
      showToast("Tax rule deleted.");
      setDeleteTarget(null);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not delete tax rule."), "error");
    }
  }

  async function handleBulkAction() {
    if (!bulkAction || selectedIds.length === 0) {
      showToast("Select at least one rule and choose an action.", "error");
      return;
    }

    try {
      await bulkTaxRules.mutateAsync({ ids: selectedIds, action: bulkAction });
      showToast(
        bulkAction === "DELETE" ? "Tax rules deleted." : bulkAction === "ENABLE" ? "Tax rules enabled." : "Tax rules disabled.",
      );
      setSelectedIds([]);
      setBulkAction("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  }

  async function handleExport(selectedOnly: boolean) {
    try {
      const params: Record<string, unknown> = {
        search: search || undefined,
        status: statusFilter || undefined,
        countryId: countryFilter || undefined,
        type: typeFilter || undefined,
        sortBy,
        sortDir,
      };
      if (selectedOnly && selectedIds.length) {
        params.ids = selectedIds.join(",");
      }
      const blob = await exportTaxRules.mutateAsync(params);
      const url = URL.createObjectURL(new Blob([blob], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedOnly && selectedIds.length ? "tax-rules-selected.xlsx" : "tax-rules-export.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export tax rules."), "error");
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
      const report = (await previewTaxImport.mutateAsync(formData)) as SpreadsheetReport;
      setImportReport(report);
      showToast("Import preview ready.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to preview tax spreadsheet."), "error");
    }
  }

  async function handleImportCommit() {
    if (!importFile) {
      showToast("Choose a spreadsheet first.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      await importTaxRules.mutateAsync(formData);
      showToast("Tax rules imported.");
      setImportFile(null);
      setImportReport(null);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import tax spreadsheet."), "error");
    }
  }

  const filteredColumns = columns.filter((column) => {
    if (column.key === "name") return visibleColumns.name;
    if (column.key === "type") return visibleColumns.type;
    if (column.key === "country") return visibleColumns.country;
    if (column.key === "percentage") return visibleColumns.percentage;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "sortOrder") return visibleColumns.sortOrder;
    if (column.key === "updatedAt") return visibleColumns.updatedAt;
    return true;
  });

  const finalColumns = useMemo(() => {
    const list = [...filteredColumns];
    if (canUpdate) {
      list.unshift({
        key: "select" as any,
        label: (
          <input
            type="checkbox"
            checked={rules.length > 0 && rules.every((row) => selectedIds.includes(row.id))}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelectedIds(checked ? rules.map((row) => row.id) : []);
            }}
            className="h-4 w-4 accent-[#E31E24]"
          />
        ),
        width: "50px",
        render: (row) => (
          <input
            type="checkbox"
            checked={selectedIds.includes(row.id)}
            onChange={(event) => {
              const checked = event.target.checked;
              setSelectedIds((current) =>
                checked ? Array.from(new Set([...current, row.id])) : current.filter((id) => id !== row.id)
              );
            }}
            className="h-4 w-4 accent-[#E31E24]"
          />
        ),
      });
    }
    return list;
  }, [filteredColumns, canUpdate, rules, selectedIds]);

  const previewResult = preview as TaxPreview | undefined;

  return (
    <AdminLayout title="Tax Configuration" breadcrumb={[{ label: "Tax" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Rules" value={dashboard?.totalRules ?? 0} subtitle="All configured tax rules" icon={<Filter size={18} />} isLoading={dashboardLoading} />
          <StatCard title="Active Rules" value={dashboard?.activeRules ?? 0} subtitle="Live tax records" icon={<SquareCheckBig size={18} />} color="bg-green-600" isLoading={dashboardLoading} />
          <StatCard title="Inactive Rules" value={dashboard?.inactiveRules ?? 0} subtitle="Disabled tax records" icon={<X size={18} />} color="bg-gray-600" isLoading={dashboardLoading} />
        </div>

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
                placeholder="Search tax rules..."
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
                  onClick={openCreate}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Plus size={14} />
                  Add Tax Rule
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
                    setTypeFilter("");
                    setSortBy("updatedAt");
                    setSortDir("desc");
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
                <AdminSelect
                  label="Country"
                  value={countryFilter}
                  onChange={(event) => {
                    setPage(1);
                    setCountryFilter(event.target.value);
                  }}
                  options={countryOptions}
                />
                <AdminSelect
                  label="Tax Type"
                  value={typeFilter}
                  onChange={(event) => {
                    setPage(1);
                    setTypeFilter(event.target.value);
                  }}
                  options={[
                    { value: "", label: "All types" },
                    { value: "CGST", label: "CGST" },
                    { value: "SGST", label: "SGST" },
                    { value: "VAT", label: "VAT" },
                    { value: "SALES_TAX", label: "Sales Tax" },
                  ]}
                />
                <AdminSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  options={[
                    { value: "updatedAt", label: "Updated date" },
                    { value: "createdAt", label: "Created date" },
                    { value: "name", label: "Rule name" },
                    { value: "type", label: "Rule type" },
                    { value: "percentage", label: "Tax rate" },
                    { value: "sortOrder", label: "Priority" },
                    { value: "country", label: "Country" },
                  ]}
                />
                <AdminSelect
                  label="Direction"
                  value={sortDir}
                  onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                  options={[
                    { value: "desc", label: "Descending" },
                    { value: "asc", label: "Ascending" },
                  ]}
                />
              </div>
            </div>
          )}

          {selectedIds.length > 0 && canUpdate && (
            <div className="mt-4 rounded-xl border border-dashed border-[#E31E24]/30 bg-[#FFF5F5]/30 p-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="text-[13px] font-semibold text-[#E31E24]">{selectedIds.length} rows selected</span>
                <div className="h-4 w-[1px] bg-[#E6E6E6]" />
                <div className="flex flex-wrap items-center gap-2">
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
                  <button type="button" onClick={handleBulkAction} className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
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

          {showColumns && (
            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">Column visibility</div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
                {Object.entries(visibleColumns).map(([key, value]) => (
                  <label key={key} className="flex items-center gap-2 text-[13px] text-[#1A1A1A]">
                    <input type="checkbox" checked={value} onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))} />
                    <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_minmax(320px,0.95fr)]">
          <div className="space-y-5">
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <DataTable<TaxRule>
                columns={finalColumns}
                data={rules}
                rowKey="id"
                isLoading={isLoading}
                emptyMessage="No tax rules configured."
              />
              <Pagination
                page={pagination.page}
                totalPages={pagination.totalPages || 1}
                onPageChange={setPage}
              />
            </div>
          </div>

          <div className="space-y-5">
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-sm">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Tax Preview</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Resolver-backed preview for the selected country and subtotal.</p>
                </div>
                <button type="button" onClick={() => setPreviewForm(emptyPreview)} className="text-[12.5px] font-medium text-[#E31E24] hover:underline">
                  Reset
                </button>
              </div>
              <div className="grid gap-3">
                <AdminSelect
                  label="Country"
                  value={previewForm.countryId}
                  onChange={(event) => setPreviewForm((current) => ({ ...current, countryId: event.target.value }))}
                  options={countryOptions}
                />
                <AdminInput
                  label="Subtotal"
                  type="number"
                  min="0"
                  step="0.01"
                  value={previewForm.subtotal}
                  onChange={(event) => setPreviewForm((current) => ({ ...current, subtotal: event.target.value }))}
                />
              </div>
              <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                {previewLoading ? (
                  <p className="text-[13px] text-[#6B6B6B]">Loading preview...</p>
                ) : previewError ? (
                  <p className="text-[13px] text-red-600">{getAdminErrorMessage(previewError, "Preview failed.")}</p>
                ) : previewResult ? (
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                        <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Subtotal</div>
                        <div className="font-semibold text-[#1A1A1A]">
                          {formatMoney(previewResult.subtotal, previewResult.country.currency?.symbol)}
                        </div>
                      </div>
                      <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                        <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Tax amount</div>
                        <div className="font-semibold text-[#E31E24]">
                          {formatMoney(previewResult.taxAmount, previewResult.country.currency?.symbol)}
                        </div>
                      </div>
                    </div>
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Final total</div>
                      <div className="font-semibold text-[#1A1A1A]">
                        {formatMoney(previewResult.total, previewResult.country.currency?.symbol)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Applied rules</div>
                      <ul className="mt-2 space-y-2">
                        {previewResult.appliedRules.map((rule) => (
                          <li key={rule.id} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] text-[#1A1A1A]">
                            <div className="flex items-center justify-between gap-3">
                              <span className="font-medium">{rule.name}</span>
                              <span className="text-[#6B6B6B]">{rule.percentage.toFixed(2)}%</span>
                            </div>
                            <div className="mt-1 text-[#9A9A9A]">
                              {formatMoney(rule.amountBefore, previewResult.country.currency?.symbol)} → {formatMoney(rule.amountAfter, previewResult.country.currency?.symbol)}
                            </div>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ) : (
                  <p className="text-[13px] text-[#6B6B6B]">Choose a country and subtotal to preview tax.</p>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Import / Export</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Uses the existing spreadsheet utility with validation before commit.</p>
                </div>
                <button type="button" onClick={() => void handleExport(false)} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  <Download size={14} /> Export
                </button>
              </div>
              {canUpdate ? (
                <div className="mt-4 grid gap-3">
                  <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg border border-dashed border-[#D6D6D6] bg-[#FAFAFA] px-4 py-3">
                    <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={(event) => setImportFile(event.target.files?.[0] ?? null)} />
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-[#1A1A1A]">{importFile ? importFile.name : "Choose file"}</div>
                      <div className="mt-0.5 text-[12px] text-[#6B6B6B]">Preview before import.</div>
                    </div>
                    <Upload size={16} className="shrink-0 text-[#E31E24]" />
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={() => void handleImportPreview()} disabled={previewTaxImport.isPending} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-50">
                      <Eye size={14} /> Preview
                    </button>
                    <button type="button" onClick={() => void handleImportCommit()} disabled={importTaxRules.isPending} className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
                      <Upload size={14} /> Import
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
              {importReport ? (
                <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3 text-[12.5px] text-[#1A1A1A]">
                  <div className="font-semibold">Import preview ready</div>
                  <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-[#6B6B6B]">{JSON.stringify(importReport, null, 2)}</pre>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Recent Updates</h3>
              <div className="mt-3 space-y-2">
                {dashboard?.recentlyUpdatedRules?.length ? (
                  dashboard.recentlyUpdatedRules.slice(0, 5).map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => openEdit(row)}
                      className="w-full rounded-lg border border-[#E6E6E6] px-3 py-2 text-left transition hover:bg-[#FAFAFA]"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-[13px] font-medium text-[#1A1A1A]">{row.name}</div>
                          <div className="text-[11.5px] text-[#9A9A9A]">
                            {row.type.replace("_", " ")} · {row.country?.name ?? "—"}
                          </div>
                        </div>
                        <StatusBadge status={row.status} />
                      </div>
                    </button>
                  ))
                ) : (
                  <p className="text-[13px] text-[#6B6B6B]">No recent tax changes yet.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showForm} onClose={() => setShowForm(false)} title={form.id ? "Edit Tax Rule" : "Add Tax Rule"} panelClassName="max-w-3xl flex flex-col max-h-[90vh]">
        <form onSubmit={handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Rule Details Grid */}
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
              <AdminInput
                label="Rule Name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="GST / VAT / Sales Tax"
              />
              <AdminSelect
                label="Rule Type"
                value={form.type}
                onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as TaxRule["type"] }))}
                options={[
                  { value: "CGST", label: "CGST" },
                  { value: "SGST", label: "SGST" },
                  { value: "VAT", label: "VAT" },
                  { value: "SALES_TAX", label: "Sales Tax" },
                ]}
              />
              <AdminSelect
                label="Tax Mode (Calculation)"
                value={form.taxMode}
                onChange={(event) => setForm((current) => ({ ...current, taxMode: event.target.value as TaxRule["taxMode"] }))}
                options={[
                  { value: "EXCLUSIVE", label: "Exclusive (Added on top of subtotal)" },
                  { value: "INCLUSIVE", label: "Inclusive (Included in product price)" },
                  { value: "EXEMPT", label: "Exempt (0% Tax / Tax Free)" },
                ]}
              />
              <AdminSelect
                label="Country"
                value={form.countryId}
                onChange={(event) => setForm((current) => ({ ...current, countryId: event.target.value }))}
                options={countryOptions.filter((option) => option.value !== "")}
              />
              <AdminInput
                label="Tax Percentage (%)"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={form.percentage}
                onChange={(event) => setForm((current) => ({ ...current, percentage: event.target.value }))}
                placeholder="e.g. 18.00"
              />
              <AdminSelect
                label="Status"
                value={form.status}
                onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as TaxRule["status"] }))}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminInput
                label="Priority (Sort Order)"
                type="number"
                min="0"
                step="1"
                value={form.sortOrder}
                onChange={(event) => setForm((current) => ({ ...current, sortOrder: event.target.value }))}
                placeholder="0"
              />
            </div>

            {/* Applicable Products Section */}
            <div className="pt-2 space-y-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151]">
                Applicable Products (Optional)
              </label>
              <div className="border border-[#E5E7EB] rounded-xl p-3.5 bg-[#F9FAFB] space-y-3">
                <div className="relative">
                  <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
                  <input
                    type="text"
                    placeholder="Search products..."
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                    className="w-full pl-9 pr-3.5 py-2 text-xs border border-[#E5E7EB] rounded-lg bg-white outline-none focus:border-[#E31E24]"
                  />
                </div>

                <div className="max-h-44 overflow-y-auto pr-1">
                  {filteredProducts.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] text-center py-3">No products found</p>
                  ) : (
                    <div className="grid gap-2 grid-cols-1 sm:grid-cols-2">
                      {filteredProducts.map((p: any) => {
                        const isChecked = form.productIds?.includes(p.id);
                        return (
                          <label
                            key={p.id}
                            className={`flex items-center gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition-all ${
                              isChecked
                                ? "border-[#E31E24]/40 bg-[#FFF5F5] font-semibold text-[#111827]"
                                : "border-[#E5E7EB] bg-white hover:bg-[#F3F4F6] text-[#374151]"
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setForm((current) => {
                                  const pIds = current.productIds ?? [];
                                  if (isChecked) {
                                    return { ...current, productIds: pIds.filter((id) => id !== p.id) };
                                  } else {
                                    return { ...current, productIds: [...pIds, p.id] };
                                  }
                                });
                              }}
                              className="h-4 w-4 rounded border-[#D1D5DB] text-[#E31E24] focus:ring-[#E31E24]"
                            />
                            <span className="truncate">{p.title}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
              <p className="text-[11.5px] text-[#6B7280] leading-normal">
                If no products are selected, this tax rule will apply globally to all products in the selected country.
              </p>
            </div>
          </div>

          {/* Footer Section */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-[#E5E7EB] px-6 py-4 bg-[#FAFAFA] shrink-0">
            <p className="text-[11.5px] text-[#6B7280] max-w-sm leading-normal">
              Higher priority rules are resolved first. Tax percentage stays resolver-backed and never recalculates on the client.
            </p>
            <div className="flex items-center gap-2.5 shrink-0 w-full sm:w-auto justify-end">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#374151] hover:bg-[#F3F4F6] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createRule.isPending || updateRule.isPending}
                className="px-5 py-2 rounded-lg bg-[#E31E24] text-xs font-bold text-white hover:bg-[#B5151B] transition-colors shadow-2xs disabled:opacity-60"
              >
                {form.id ? "Save Rule" : "Create Rule"}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete tax rule?"
        message={deleteTarget ? `Delete ${deleteTarget.name}?` : ""}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
