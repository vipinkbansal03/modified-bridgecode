"use client";

import { useEffect, useMemo, useState } from "react";
import { useQueries } from "@tanstack/react-query";
import { Download, Eye, Filter, Plus, RefreshCw, Search, SquareCheckBig, Trash2, Upload, X, SlidersHorizontal, Pencil } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  AdminInput,
  AdminSelect,
  AdminMultiSelect,
  ConfirmModal,
  DataTable,
  Pagination,
  StatCard,
  AdminStatsGrid,
  AdminListToolbar,
  StatusBadge,
  useToast,
  LoadingButton,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
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
  useAdminCategories,
  useAdminProduct,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type TaxRule = {
  id: string;
  name: string;
  type: "CGST" | "SGST" | "VAT" | "SALES_TAX";
  taxMode: "EXCLUSIVE" | "INCLUSIVE" | "EXEMPT";
  percentage: string | number;
  countries?: Array<{ id: string; name: string; code: string; currency?: { code: string; symbol: string } | null }>;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  products?: Array<{ id: string; title: string }>;
  categories?: Array<{ id: string; name: string }>;
  variants?: Array<{ id: string; title: string; sku?: string }>;
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
  countryIds: string[];
  status: TaxRule["status"];
  sortOrder: string;
  productIds: string[];
  categoryIds: string[];
  variantIds: string[];
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
  countryIds: [],
  status: "ACTIVE",
  sortOrder: "0",
  productIds: [],
  categoryIds: [],
  variantIds: [],
};

const emptyPreview: PreviewState = {
  countryId: "",
  subtotal: "1000",
};

const visibleColumnsDefault = {
  name: true,
  type: true,
  country: true,
  applicability: true,
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

function TaxVariantsDropdown({
  selectedProductIds,
  selectedVariantIds,
  onChange,
}: {
  selectedProductIds: string[];
  selectedVariantIds: string[];
  onChange: (ids: string[]) => void;
}) {
  const productQueries = useQueries({
    queries: selectedProductIds.map((id) => ({
      queryKey: ["admin-product", id],
      queryFn: () => adminApi.get(`/products/${id}`).then((r) => r.data.data),
      enabled: !!id,
    })),
  });

  const isLoading = productQueries.some((q) => q.isLoading);
  if (isLoading) {
    return <div className="text-xs text-[#9CA3AF] py-2">Loading variants...</div>;
  }

  const allVariants = productQueries
    .flatMap((q) => (q.data as any)?.variants ?? []);

  if (allVariants.length === 0) return null;

  return (
    <div className="pt-2">
      <AdminMultiSelect
        label="Select Specific Variants (Optional)"
        placeholder="Select specific variants..."
        options={allVariants.map((v: any) => ({
          value: v.id,
          label: `${v.title} ${v.sku ? `[${v.sku}]` : ""}`
        }))}
        selectedValues={selectedVariantIds}
        onChange={onChange}
      />
    </div>
  );
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
  const [deleteTarget, setDeleteTarget] = useState<TaxRule | null>(null);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<SpreadsheetReport | null>(null);
  const [previewForm, setPreviewForm] = useState<PreviewState>(emptyPreview);
  const [productSearch, setProductSearch] = useState("");

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminTaxDashboard();
  const { data: countries = [] } = useAdminCountries();
  const { data: categories = [] } = useAdminCategories();
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

  const form = useAdminForm<TaxFormState>({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Rule Name is required.";
      if (!values.percentage || isNaN(Number(values.percentage))) errors.percentage = "Valid percentage is required.";
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        // When using AdminMultiSearchableSelect with allowSelectAll, an empty array implies "All selected".
        // Therefore, if it's empty, we send all available country IDs to the backend.
        const selectedCountries = (values.countryIds && values.countryIds.length > 0)
          ? values.countryIds
          : countries.map((c: any) => c.id);
          
        const payload = {
          name: values.name,
          type: values.type,
          taxMode: values.taxMode,
          percentage: values.percentage,
          countryIds: selectedCountries,
          countryId: selectedCountries[0] || null,
          status: values.status,
          sortOrder: values.sortOrder,
          productIds: values.productIds,
          categoryIds: values.categoryIds,
          variantIds: values.variantIds,
        };

        if (values.id) {
          await updateRule.mutateAsync({ id: values.id, ...payload });
          showToast("Tax rule updated.");
        } else {
          await createRule.mutateAsync(payload);
          showToast("Tax rule created.");
        }

        setShowForm(false);
        resetForm();
        await refetch();
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Could not save tax rule."), "error");
      }
    }
  });

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
    ...countries.map((country: { id: string; name: string; code: string; status?: string }) => ({
      value: country.id,
      label: `${country.name} (${country.code})`,
    })),
  ];

  const activeCountryOptions = countries
    .filter((country: { id: string; name: string; code: string; status?: string }) => country.status === "ACTIVE")
    .map((country: { id: string; name: string; code: string; status?: string }) => ({
      value: country.id,
      label: `${country.name} (${country.code})`,
    }));

  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);

  const columns: Column<TaxRule>[] = [
      {
        key: "name",
        label: "Rule Name",
        width: "220px",
        render: (row) => (
          <div className="min-w-0">
            <div className="truncate font-medium text-[#1A1A1A]">{row.name}</div>
            <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.countries?.map(c => c.code).join(", ") || "All countries"}</div>
          </div>
        ),
      },
      { key: "type", label: "Rule Type", width: "140px", render: (row) => row.type.replace("_", " ") },
      {
        key: "country",
        label: "Countries",
        width: "180px",
        render: (row) => (
          <div>
            {row.countries?.length ? (
              <div className="flex flex-wrap gap-1 mt-1">
                {row.countries.map((c) => (
                  <span key={c.id} className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[11px] font-medium text-gray-800">
                    {c.code}
                  </span>
                ))}
              </div>
            ) : (
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                All countries
              </span>
            )}
          </div>
        ),
      },
      {
        key: "applicability" as any,
        label: "Applicability",
        width: "260px",
        render: (row) => {
          const hasCategories = row.categories && row.categories.length > 0;
          const hasProducts = row.products && row.products.length > 0;
          const hasVariants = row.variants && row.variants.length > 0;

          if (!hasCategories && !hasProducts && !hasVariants) {
            return (
              <span className="inline-flex items-center rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-600">
                🌍 Global (All Products)
              </span>
            );
          }

          return (
            <div className="flex flex-col gap-1.5 py-1">
              {hasCategories && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Categories:</span>
                  {row.categories?.slice(0, 2).map((cat) => (
                    <span key={cat.id} className="inline-flex max-w-[180px] items-center rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">
                      <span className="truncate">{cat.name}</span>
                    </span>
                  ))}
                  {row.categories && row.categories.length > 2 && (
                    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      +{row.categories.length - 2} more
                    </span>
                  )}
                </div>
              )}
              {hasProducts && (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Products:</span>
                  {row.products?.slice(0, 2).map((prod) => (
                    <span key={prod.id} className="inline-flex max-w-[180px] items-center rounded bg-green-50 px-1.5 py-0.5 text-[10px] font-medium text-green-700">
                      <span className="truncate">{prod.title}</span>
                    </span>
                  ))}
                  {row.products && row.products.length > 2 && (
                    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      +{row.products.length - 2} more
                    </span>
                  )}
                </div>
              )}
              {hasVariants ? (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Variants:</span>
                  {row.variants?.slice(0, 2).map((v) => (
                    <span key={v.id} className="inline-flex max-w-[180px] items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-medium text-purple-700">
                      <span className="truncate">{v.title}</span>
                    </span>
                  ))}
                  {row.variants && row.variants.length > 2 && (
                    <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                      +{row.variants.length - 2} more
                    </span>
                  )}
                </div>
              ) : hasProducts ? (
                <div className="flex flex-wrap gap-1 items-center">
                  <span className="text-[10px] uppercase font-bold text-[#6B7280]">Variants:</span>
                  <span className="inline-flex items-center rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600">
                    All variants
                  </span>
                </div>
              ) : null}
            </div>
          );
        }
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
    form.reset();
    setProductSearch("");
    setShowForm(true);
  }

  function openEdit(row: TaxRule) {
    form.setValues({
      id: row.id,
      name: row.name,
      type: row.type,
      taxMode: row.taxMode || "EXCLUSIVE",
      percentage: String(row.percentage),
      countryIds: (row.countries ?? []).map((c) => c.id),
      status: row.status,
      sortOrder: String(row.sortOrder ?? 0),
      productIds: (row.products ?? []).map((p) => p.id),
      categoryIds: (row as any).categoryIds ?? [],
      variantIds: (row as any).variantIds ?? [],
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
        <AdminStatsGrid
          stats={[
            { title: "Total Rules", value: dashboard?.totalRules ?? 0, subtitle: "All configured tax rules", icon: <Filter size={18} />, isLoading: dashboardLoading },
            { title: "Active Rules", value: dashboard?.activeRules ?? 0, subtitle: "Live tax records", icon: <SquareCheckBig size={18} />, color: "bg-green-600", isLoading: dashboardLoading },
            { title: "Inactive Rules", value: dashboard?.inactiveRules ?? 0, subtitle: "Disabled tax records", icon: <X size={18} />, color: "bg-gray-600", isLoading: dashboardLoading }
          ]}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val: string) => {
              setPage(1);
              setSearch(val);
            },
            placeholder: "Search tax rules...",
          }}
          filters={{
            showFilters: showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [statusFilter, countryFilter, typeFilter].filter(Boolean).length,
          }}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setCountryFilter("");
            setTypeFilter("");
            setSortBy("updatedAt");
            setSortDir("desc");
            setPage(1);
          }}
          columns={{
            visibleColumns: visibleColumns,
            onToggleColumn: (key: string) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
          }}
          exportAction={{
            onClick: () => void handleExport(selectedIds.length > 0),
            label: selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export",
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: openCreate,
                  label: "Add Tax Rule",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          filterPanel={
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
          }
        />

        {selectedIds.length > 0 && canUpdate && (
          <div className="rounded-xl border border-dashed border-[#E31E24]/30 bg-[#FFF5F5]/30 p-4 flex flex-wrap items-center justify-between gap-3">
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
                <AdminMultiSearchableSelect
                  label="Country"
                  values={previewForm.countryId ? [previewForm.countryId] : []}
                  onValuesChange={(values) => setPreviewForm((current) => ({ ...current, countryId: values[0] ?? "" }))}
                  options={(countries as any[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                  placeholder="Select country"
                  allowSelectAll
                  selectAllLabel="All countries"
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
                            {row.type.replace("_", " ")} · {row.countries?.map(c => c.name).join(", ") || "—"}
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

      <Modal open={showForm} onClose={() => setShowForm(false)} title={form.values.id ? "Edit Tax Rule" : "Add Tax Rule"} panelClassName="max-w-3xl flex flex-col max-h-[90vh]">
        <form onSubmit={form.handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
          <div className="p-6 overflow-y-auto space-y-5 flex-1">
            {/* Rule Details Grid */}
            <div className="grid gap-x-5 gap-y-4 md:grid-cols-2">
              <AdminInput
                label="Rule Name"
                required
                {...form.getFieldProps("name")}
                error={form.errors.name as string}
                placeholder="GST / VAT / Sales Tax"
              />
              <AdminSelect
                label="Rule Type"
                {...form.getFieldProps("type")}
                error={form.errors.type as string}
                options={[
                  { value: "CGST", label: "CGST" },
                  { value: "SGST", label: "SGST" },
                  { value: "VAT", label: "VAT" },
                  { value: "SALES_TAX", label: "Sales Tax" },
                ]}
              />
              <AdminSelect
                label="Tax Mode (Calculation)"
                {...form.getFieldProps("taxMode")}
                error={form.errors.taxMode as string}
                options={[
                  { value: "EXCLUSIVE", label: "Exclusive (Added on top of subtotal)" },
                  { value: "INCLUSIVE", label: "Inclusive (Included in product price)" },
                  { value: "EXEMPT", label: "Exempt (0% Tax / Tax Free)" },
                ]}
              />
              <AdminMultiSearchableSelect
                label="Countries"
                values={form.values.countryIds ?? []}
                onValuesChange={(values) => form.setFieldValue("countryIds", values)}
                options={(countries as any[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                placeholder="Select countries"
                allowSelectAll
                selectAllLabel="All countries"
              />
              <AdminInput
                label="Tax Percentage (%)"
                required
                type="number"
                min="0"
                max="100"
                step="0.01"
                {...form.getFieldProps("percentage")}
                error={form.errors.percentage as string}
                placeholder="e.g. 18.00"
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
              <AdminInput
                label="Priority (Sort Order)"
                type="number"
                min="0"
                step="1"
                {...form.getFieldProps("sortOrder")}
                error={form.errors.sortOrder as string}
                placeholder="0"
              />
            </div>

            {/* Applicable Categories Section */}
            <div className="pt-2 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151]">
                Applicable Categories (Optional)
              </label>
              <div className="space-y-3">
                <AdminMultiSelect
                  placeholder="Select categories..."
                  options={categories.map((cat: any) => ({
                    value: cat.id,
                    label: cat.name
                  }))}
                  selectedValues={form.values.categoryIds ?? []}
                  onChange={(nextIds) => form.setFieldValue("categoryIds", nextIds)}
                />
              </div>
              <p className="text-[11.5px] text-[#6B7280] leading-normal">
                If categories are selected, this tax rule will apply to all products in those categories.
              </p>
            </div>

            {/* Applicable Products Section */}
            <div className="pt-2 space-y-3">
              <label className="block text-xs font-bold uppercase tracking-wider text-[#374151]">
                Applicable Products (Optional)
              </label>
              <div className="space-y-3">
                <AdminMultiSelect
                  placeholder="Select products..."
                  options={products.map((p: any) => ({
                    value: p.id,
                    label: `${p.title} ${p.productCode ? `[${p.productCode}]` : ""}`
                  }))}
                  selectedValues={form.values.productIds ?? []}
                  onChange={(nextIds) => form.setFieldValue("productIds", nextIds)}
                />

                {form.values.productIds && form.values.productIds.length > 0 && (
                  <TaxVariantsDropdown
                    selectedProductIds={form.values.productIds}
                    selectedVariantIds={form.values.variantIds ?? []}
                    onChange={(nextVariantIds) => form.setFieldValue("variantIds", nextVariantIds)}
                  />
                )}
              </div>
              <p className="text-[11.5px] text-[#6B7280] leading-normal">
                If no products/categories/variants are selected, this tax rule will apply globally to all products in the selected country.
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
              <LoadingButton
                type="submit"
                loading={form.isSubmitting || createRule.isPending || updateRule.isPending}
                loadingText="Processing..."
                className="px-5 py-2 rounded-lg bg-[#E31E24] text-xs font-bold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
              >
                {form.values.id ? "Save Rule" : "Create Rule"}
              </LoadingButton>
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
        isLoading={deleteRule.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
