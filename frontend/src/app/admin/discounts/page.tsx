"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Download,
  Plus,
  Edit2,
  Eye,
  Filter,
  Search,
  SlidersHorizontal,
  SquareCheckBig,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminInput,
  AdminSelect,
  Column,
  ConfirmModal,
  DataTable,
  Pagination,
  StatCard,
  useToast,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import {
  useAdminCategories,
  useAdminCountries,
  useAdminDiscountDashboard,
  useAdminDiscounts,
  useAdminCollections,
  useAdminProducts,
  useAdminTiers,
  useBulkDiscounts,
  useCreateDiscount,
  useDeleteDiscount,
  useExportDiscounts,
  useImportDiscounts,
  usePreviewDiscountImport,
  useUpdateDiscount,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Related = {
  id: string;
  name?: string;
  title?: string;
  code?: string;
  slug?: string;
};
type Discount = {
  id: string;
  name: string;
  type: "TIER" | "MOQ" | "PROMOTIONAL";
  status: string;
  tierId: string | null;
  tier?: Related | null;
  minQuantity: number | null;
  discountPercent: string | number | null;
  fixedAmount: string | number | null;
  countryId: string | null;
  country?: Related | null;
  productId: string | null;
  product?: Related | null;
  collectionId: string | null;
  collection?: Related | null;
  categoryId: string | null;
  category?: Related | null;
  startDate: string | null;
  endDate: string | null;
};

type FormState = {
  id?: string;
  name: string;
  type: "TIER" | "MOQ" | "PROMOTIONAL";
  status: "ACTIVE" | "INACTIVE";
  tierId: string;
  minQuantity: string;
  valueType: "PERCENT" | "FIXED";
  discountPercent: string;
  fixedAmount: string;
  countryIds: string[];
  scope: "PLATFORM" | "PRODUCT" | "COLLECTION" | "CATEGORY";
  productId: string;
  collectionId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
};

type DiscountDashboard = {
  totalDiscounts: number;
  activeDiscounts: number;
  inactiveDiscounts: number;
  tierDiscounts: number;
  moqDiscounts: number;
  promotionalDiscounts: number;
  recentlyUpdated: Discount[];
};

type SpreadsheetReport = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: Array<{ row: number; field: string; message: string }>;
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

const blankForm: FormState = {
  name: "",
  type: "TIER",
  status: "ACTIVE",
  tierId: "",
  minQuantity: "",
  valueType: "PERCENT",
  discountPercent: "",
  fixedAmount: "",
  countryIds: [],
  scope: "PLATFORM",
  productId: "",
  collectionId: "",
  categoryId: "",
  startDate: "",
  endDate: "",
};

const visibleColumnsDefault = {
  name: true,
  type: true,
  discount: true,
  condition: true,
  country: true,
  dates: true,
  status: true,
};

function dateInput(value: string | null) {
  return value ? value.slice(0, 10) : "";
}

function discountValue(discount: Discount) {
  return discount.discountPercent != null
    ? `${Number(discount.discountPercent)}% off`
    : `${Number(discount.fixedAmount ?? 0)} off`;
}

function scopeLabel(discount: Discount) {
  if (discount.product) return `Product: ${discount.product.title}`;
  if (discount.collection) return `Collection: ${discount.collection.name}`;
  if (discount.category) return `Category: ${discount.category.name}`;
  return "Platform-wide";
}

function toForm(discount: Discount): FormState {
  return {
    id: discount.id,
    name: discount.name,
    type: discount.type,
    status: discount.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    tierId: discount.tierId ?? "",
    minQuantity: discount.minQuantity ? String(discount.minQuantity) : "",
    valueType: discount.discountPercent != null ? "PERCENT" : "FIXED",
    discountPercent:
      discount.discountPercent != null ? String(discount.discountPercent) : "",
    fixedAmount:
      discount.fixedAmount != null ? String(discount.fixedAmount) : "",
    countryIds: discount.countryId ? [discount.countryId] : [],
    scope: discount.productId
      ? "PRODUCT"
      : discount.collectionId
        ? "COLLECTION"
        : discount.categoryId
          ? "CATEGORY"
          : "PLATFORM",
    productId: discount.productId ?? "",
    collectionId: discount.collectionId ?? "",
    categoryId: discount.categoryId ?? "",
    startDate: dateInput(discount.startDate),
    endDate: dateInput(discount.endDate),
  };
}

function formatDate(value?: string | null) {
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

export default function DiscountsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [scopeFilter, setScopeFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [showColumns, setShowColumns] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<SpreadsheetReport | null>(
    null,
  );
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [form, setForm] = useState<FormState>(blankForm);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { showToast, ToastComponent } = useToast();
  const { data: dashboardData, isLoading: dashboardLoading } =
    useAdminDiscountDashboard();
  const { data, isLoading } = useAdminDiscounts({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: status || undefined,
    type: typeFilter || undefined,
    scope: scopeFilter || undefined,
    countryId: countryFilter || undefined,
    sortBy,
    sortDir,
  });
  const { data: tiers = [] } = useAdminTiers();
  const { data: countries = [] } = useAdminCountries();
  const { data: collectionsData } = useAdminCollections({ page: 1 });
  const { data: categories = [] } = useAdminCategories();
  const { data: productsData } = useAdminProducts({ limit: 200 });
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const deleteDiscount = useDeleteDiscount();
  const bulkDiscounts = useBulkDiscounts();
  const exportDiscounts = useExportDiscounts();
  const previewDiscountImport = usePreviewDiscountImport();
  const importDiscounts = useImportDiscounts();

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    setSelectedIds([]);
  }, [
    page,
    limit,
    debouncedSearch,
    status,
    typeFilter,
    scopeFilter,
    countryFilter,
    sortBy,
    sortDir,
  ]);

  const products: Related[] = productsData?.data ?? [];
  const collections: Related[] = collectionsData?.data ?? [];
  const discounts: Discount[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const dashboard = dashboardData as DiscountDashboard | undefined;
  const visibleIds = useMemo(
    () => discounts.map((discount) => discount.id),
    [discounts],
  );
  const selectedOnPage =
    visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);

  const options = useMemo(
    () => ({
      tiers: [
        { value: "", label: "Select tier" },
        ...tiers.map((tier: Related) => ({
          value: tier.id,
          label: tier.name ?? tier.id,
        })),
      ],
      countries: countries.map((country: Related) => ({
        value: country.id,
        label: `${country.name} (${country.code})`,
      })),
      products: [
        { value: "", label: "Select product" },
        ...products.map((product) => ({
          value: product.id,
          label: product.title ?? product.id,
        })),
      ],
      collections: [
        { value: "", label: "Select collection" },
        ...collections.map((collection) => ({
          value: collection.id,
          label: collection.name ?? collection.id,
        })),
      ],
      categories: [
        { value: "", label: "Select category" },
        ...categories.map((category: Related) => ({
          value: category.id,
          label: category.name ?? category.id,
        })),
      ],
    }),
    [tiers, countries, products, collections, categories],
  );

  const resetForm = () => {
    setForm(blankForm);
    setShowForm(false);
  };

  const resetPage = () => {
    setPage(1);
    setSelectedIds([]);
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: value };
      if (key === "type" && value === "TIER") next.minQuantity = "";
      if (key === "type" && value === "MOQ") next.tierId = "";
      if (key === "type" && value === "PROMOTIONAL") {
        next.tierId = "";
        next.minQuantity = "";
      }
      if (key === "valueType" && value === "PERCENT") next.fixedAmount = "";
      if (key === "valueType" && value === "FIXED") next.discountPercent = "";
      if (key === "scope" && value === "PLATFORM") {
        next.productId = "";
        next.collectionId = "";
        next.categoryId = "";
      }
      if (key === "scope" && value === "PRODUCT") {
        next.collectionId = "";
        next.categoryId = "";
      }
      if (key === "scope" && value === "COLLECTION") {
        next.productId = "";
        next.categoryId = "";
      }
      if (key === "scope" && value === "CATEGORY") {
        next.productId = "";
        next.collectionId = "";
      }
      return next;
    });
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      type: form.type,
      status: form.status,
      tierId: form.type === "TIER" ? form.tierId || null : null,
      minQuantity: form.type === "MOQ" ? form.minQuantity : null,
      discountPercent:
        form.valueType === "PERCENT" ? form.discountPercent : null,
      fixedAmount: form.valueType === "FIXED" ? form.fixedAmount : null,
      countryId: form.countryIds.length > 0 ? form.countryIds[0] : null,
      productId: form.scope === "PRODUCT" ? form.productId || null : null,
      collectionId:
        form.scope === "COLLECTION" ? form.collectionId || null : null,
      categoryId: form.scope === "CATEGORY" ? form.categoryId || null : null,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };

    try {
      if (form.id) {
        await updateDiscount.mutateAsync({ id: form.id, ...payload });
        showToast("Discount updated.");
      } else {
        await createDiscount.mutateAsync(payload);
        showToast("Discount created.");
      }
      resetForm();
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to save discount."),
        "error",
      );
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteDiscount.mutateAsync(deleting);
      showToast("Discount deleted.");
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to delete discount."),
        "error",
      );
    } finally {
      setDeleting(null);
    }
  };

  const toggleStatus = async (discount: Discount) => {
    const nextStatus = discount.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateDiscount.mutateAsync({ id: discount.id, status: nextStatus });
      showToast(
        nextStatus === "ACTIVE" ? "Discount activated." : "Discount paused.",
      );
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to update discount status."),
        "error",
      );
    }
  };

  const toggleRowSelection = (id: string) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id],
    );
  };

  const togglePageSelection = () => {
    setSelectedIds((current) => {
      if (selectedOnPage)
        return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const runBulkAction = async (action: "ENABLE" | "DISABLE" | "DELETE") => {
    try {
      const response = await bulkDiscounts.mutateAsync({
        ids: selectedIds,
        action,
      });
      const affected = response?.data?.affected ?? selectedIds.length;
      showToast(
        `${affected} discount${affected === 1 ? "" : "s"} ${action === "ENABLE" ? "activated" : action === "DISABLE" ? "paused" : "deleted"}.`,
      );
      setSelectedIds([]);
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to run bulk action."),
        "error",
      );
    } finally {
      setBulkDeleting(false);
    }
  };

  const handleExport = async (selectedOnly = false) => {
    try {
      const params: Record<string, unknown> = {
        search: debouncedSearch.trim() || undefined,
        status: status || undefined,
        type: typeFilter || undefined,
        scope: scopeFilter || undefined,
        countryId: countryFilter || undefined,
        sortBy,
        sortDir,
      };
      if (selectedOnly && selectedIds.length > 0) {
        params.ids = selectedIds.join(",");
      }
      const blob = await exportDiscounts.mutateAsync(params);
      downloadBlob(
        blob as Blob,
        selectedOnly && selectedIds.length
          ? "discounts-selected.xlsx"
          : "discounts-export.xlsx",
      );
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to export discounts."),
        "error",
      );
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
      const report = (await previewDiscountImport.mutateAsync(
        formData,
      )) as SpreadsheetReport;
      setImportReport(report);
      setImportMessage(
        report.invalidRows > 0
          ? "Fix the validation issues before importing."
          : "Preview looks good. You can import now.",
      );
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to preview discounts spreadsheet."),
        "error",
      );
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
      await importDiscounts.mutateAsync(formData);
      showToast("Discounts imported.");
      setImportFile(null);
      setImportReport(null);
      setImportMessage("");
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to import discounts."),
        "error",
      );
    } finally {
      setImporting(false);
    }
  };

  const columns: Column<Discount>[] = [
    {
      key: "select",
      label: "",
      width: "48px",
      render: (row) => (
        <input
          type="checkbox"
          checked={selectedIds.includes(row.id)}
          onChange={() => toggleRowSelection(row.id)}
          aria-label={`Select ${row.name}`}
          className="h-4 w-4 cursor-pointer rounded border-[#D9D9D9] accent-[#E31E24]"
        />
      ),
    },
    {
      key: "name",
      label: "Rule",
      render: (row) => (
        <div className="min-w-[210px]">
          <div className="font-semibold text-[#1A1A1A]">{row.name}</div>
          <div className="mt-1 text-[12px] text-[#6B6B6B]">
            {scopeLabel(row)}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      render: (row) => (
        <span className="rounded-full border border-[#E6E6E6] bg-[#F8F8F8] px-2.5 py-1 text-[12px] font-medium text-[#1A1A1A]">
          {row.type === "TIER"
            ? "Tier discount"
            : row.type === "MOQ"
              ? "MOQ discount"
              : "Open promotion"}
        </span>
      ),
    },
    {
      key: "value",
      label: "Discount",
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1A1A1A]">
            {discountValue(row)}
          </div>
          <div className="mt-1 text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">
            {row.discountPercent != null ? "Percentage" : "Fixed amount"}
          </div>
        </div>
      ),
    },
    {
      key: "condition",
      label: "Condition",
      render: (row) => (
        <div className="text-[#6B6B6B]">
          {row.type === "TIER"
            ? (row.tier?.name ?? "Tier required")
            : row.type === "MOQ"
              ? `${row.minQuantity}+ units`
              : "No minimum condition"}
        </div>
      ),
    },
    {
      key: "country",
      label: "Country",
      render: (row) =>
        row.country
          ? `${row.country.name} (${row.country.code})`
          : "All countries",
    },
    {
      key: "dates",
      label: "Dates",
      render: (row) =>
        row.startDate || row.endDate
          ? `${dateInput(row.startDate) || "Any"} to ${dateInput(row.endDate) || "Any"}`
          : "Always active",
    },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const isActive = row.status === "ACTIVE";
        return (
          <button
            type="button"
            onClick={() => toggleStatus(row)}
            disabled={updateDiscount.isPending}
            title={
              isActive
                ? "Click to pause this discount rule"
                : "Click to activate this discount rule"
            }
            className="inline-flex items-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[12px] font-medium transition hover:border-[#D0D0D0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span
              className={`relative h-4 w-8 rounded-full transition ${isActive ? "bg-emerald-500" : "bg-[#D9D9D9]"}`}
            >
              <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${isActive ? "left-4" : "left-0.5"}`}
              />
            </span>
            <span className={isActive ? "text-emerald-700" : "text-[#6B6B6B]"}>
              {isActive ? "Active" : "Inactive"}
            </span>
          </button>
        );
      },
    },
    {
      key: "actions",
      label: "",
      width: "86px",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setForm(toForm(row));
              setShowForm(true);
            }}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  const filteredColumns = columns.filter((column) => {
    if (column.key === "name") return visibleColumns.name;
    if (column.key === "type") return visibleColumns.type;
    if (column.key === "value") return visibleColumns.discount;
    if (column.key === "condition") return visibleColumns.condition;
    if (column.key === "country") return visibleColumns.country;
    if (column.key === "dates") return visibleColumns.dates;
    if (column.key === "status") return visibleColumns.status;
    return true;
  });

  const isCreateModalOpen = showForm && !form.id;
  const isEditInlineOpen = showForm && !!form.id;

  const discountForm = (
    <form
      onSubmit={submit}
      className={`flex flex-col min-h-0 overflow-hidden ${
        form.id ? "rounded-xl border border-[#E6E6E6] bg-white p-5" : ""
      }`}
    >
      {form.id && (
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-[14px] font-semibold text-[#1A1A1A]">
            Edit discount
          </h3>
          <button
            type="button"
            onClick={resetForm}
            className="text-[#9A9A9A] hover:text-[#1A1A1A]"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <div className={form.id ? "" : "p-6 overflow-y-auto flex-1"}>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AdminInput
            label="Rule Name *"
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
            placeholder="Gold launch promo"
          />
          <AdminMultiSearchableSelect
            label="Countries"
            values={form.countryIds}
            onValuesChange={(values) =>
              setForm((prev) => ({
                ...prev,
                countryIds: values,
              }))
            }
            options={options.countries}
            placeholder="Select countries"
            allowSelectAll
            selectAllLabel="All countries"
            selectionSummaryFormatter={(count) => `${count} Countries Selected`}
          />
          <AdminSelect
            label="Status"
            value={form.status}
            onChange={(event) => setField("status", event.target.value)}
            options={[
              { value: "ACTIVE", label: "Active" },
              { value: "INACTIVE", label: "Inactive" },
            ]}
          />

          {form.type === "TIER" ? (
            <AdminSelect
              label="Tier *"
              value={form.tierId}
              onChange={(event) => setField("tierId", event.target.value)}
              options={options.tiers}
            />
          ) : form.type === "MOQ" ? (
            <AdminInput
              label="Minimum Quantity *"
              type="text"
              inputMode="numeric"
              value={form.minQuantity}
              onChange={(event) => setField("minQuantity", event.target.value)}
            />
          ) : (
            <div className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3.5 py-2.5 text-[13px] text-[#6B6B6B]">
              Open promotions apply by scope, country, and active date window.
            </div>
          )}

          <AdminSelect
            label="Value Type"
            value={form.valueType}
            onChange={(event) => setField("valueType", event.target.value)}
            options={[
              { value: "PERCENT", label: "Percentage" },
              { value: "FIXED", label: "Fixed amount off" },
            ]}
          />
          {form.valueType === "PERCENT" ? (
            <AdminInput
              label="Discount Percent *"
              type="text"
              inputMode="decimal"
              value={form.discountPercent}
              onChange={(event) =>
                setField("discountPercent", event.target.value)
              }
            />
          ) : (
            <AdminInput
              label="Fixed Amount *"
              type="text"
              inputMode="decimal"
              value={form.fixedAmount}
              onChange={(event) => setField("fixedAmount", event.target.value)}
            />
          )}
          <AdminSelect
            label="Scope"
            value={form.scope}
            onChange={(event) => setField("scope", event.target.value)}
            options={[
              { value: "PLATFORM", label: "Platform-wide" },
              { value: "PRODUCT", label: "Product" },
              { value: "COLLECTION", label: "Collection" },
              { value: "CATEGORY", label: "Category" },
            ]}
          />
          {form.scope === "PRODUCT" && (
            <AdminSelect
              label="Product *"
              value={form.productId}
              onChange={(event) => setField("productId", event.target.value)}
              options={options.products}
            />
          )}
          {form.scope === "COLLECTION" && (
            <AdminSelect
              label="Collection *"
              value={form.collectionId}
              onChange={(event) => setField("collectionId", event.target.value)}
              options={options.collections}
            />
          )}
          {form.scope === "CATEGORY" && (
            <AdminSelect
              label="Category *"
              value={form.categoryId}
              onChange={(event) => setField("categoryId", event.target.value)}
              options={options.categories}
            />
          )}

          <AdminInput
            label="Start Date"
            type="date"
            value={form.startDate}
            onChange={(event) => setField("startDate", event.target.value)}
          />
          <AdminInput
            label="End Date"
            type="date"
            value={form.endDate}
            onChange={(event) => setField("endDate", event.target.value)}
          />
        </div>
      </div>
      <div className={form.id ? "mt-5 flex gap-2" : "border-t border-[#E5E7EB] bg-[#FAFAFA] px-6 py-4 flex items-center justify-end gap-2.5 shrink-0"}>
        <button
          type="submit"
          disabled={createDiscount.isPending || updateDiscount.isPending}
          className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
        >
          {form.id ? "Update Discount" : "Create Discount"}
        </button>
        {form.id && (
          <button
            type="button"
            onClick={resetForm}
            className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]"
          >
            Clear Edit
          </button>
        )}
      </div>
    </form>
  );

  return (
    <AdminLayout title="Discounts" breadcrumb={[{ label: "Discounts" }]}>
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <StatCard
          title="Total Discounts"
          value={dashboard?.totalDiscounts ?? 0}
          subtitle="All discount rules"
          icon={<Filter size={18} />}
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Active Discounts"
          value={dashboard?.activeDiscounts ?? 0}
          subtitle="Currently available"
          icon={<SquareCheckBig size={18} />}
          color="bg-green-600"
          isLoading={dashboardLoading}
        />
        <StatCard
          title="Inactive Discounts"
          value={dashboard?.inactiveDiscounts ?? 0}
          subtitle="Paused or disabled"
          icon={<X size={18} />}
          color="bg-gray-600"
          isLoading={dashboardLoading}
        />
      </div>

      <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="relative w-full max-w-[280px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                resetPage();
              }}
              placeholder="Search rule, product, category..."
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
            <button
              type="button"
              onClick={() => {
                resetForm();
                setShowForm(true);
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
            >
              <Plus size={14} />
              Create Discount
            </button>
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
                  setStatus("");
                  setTypeFilter("");
                  setScopeFilter("");
                  setCountryFilter("");
                  setSortBy("createdAt");
                  setSortDir("desc");
                  resetPage();
                }}
                className="text-[12.5px] font-medium text-[#E31E24] hover:underline"
              >
                Reset
              </button>
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  resetPage();
                }}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Discount Type"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                options={[
                  { value: "", label: "All types" },
                  { value: "TIER", label: "Tier-based" },
                  { value: "MOQ", label: "MOQ-based" },
                  { value: "PROMOTIONAL", label: "Open promotion" },
                ]}
              />
              <AdminSelect
                label="Scope"
                value={scopeFilter}
                onChange={(event) => {
                  setScopeFilter(event.target.value);
                  resetPage();
                }}
                options={[
                  { value: "", label: "All scopes" },
                  { value: "PLATFORM", label: "Platform-wide" },
                  { value: "PRODUCT", label: "Product" },
                  { value: "COLLECTION", label: "Collection" },
                  { value: "CATEGORY", label: "Category" },
                ]}
              />
              <AdminSelect
                label="Country"
                value={countryFilter}
                onChange={(event) => {
                  setCountryFilter(event.target.value);
                  resetPage();
                }}
                options={options.countries}
              />
              <AdminSelect
                label="Sort By"
                value={String(sortBy)}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "createdAt", label: "Created date" },
                  { value: "updatedAt", label: "Updated date" },
                  { value: "name", label: "Rule name" },
                  { value: "type", label: "Type" },
                  { value: "status", label: "Status" },
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
              <AdminSelect
                label="Page Size"
                value={String(limit)}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  resetPage();
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
            </div>
            <div className="flex flex-wrap items-center gap-2">
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

      {isEditInlineOpen ? <div className="mb-5">{discountForm}</div> : null}

      <Modal
        open={isCreateModalOpen}
        onClose={resetForm}
        title="New discount"
        panelClassName="max-w-5xl flex flex-col max-h-[90vh] overflow-hidden z-[9999]"
      >
        {isCreateModalOpen ? discountForm : null}
      </Modal>

      <div className="mb-3 flex flex-col gap-2 rounded-lg border border-[#E6E6E6] bg-white px-4 py-3 md:flex-row md:items-center md:justify-between">
        <label className="inline-flex cursor-pointer items-center gap-2 text-[13px] font-medium text-[#1A1A1A]">
          <input
            type="checkbox"
            checked={selectedOnPage}
            onChange={togglePageSelection}
            disabled={!discounts.length}
            className="h-4 w-4 cursor-pointer rounded border-[#D9D9D9] accent-[#E31E24] disabled:cursor-not-allowed"
          />
          Select visible discounts
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[12.5px] text-[#6B6B6B]">
            {selectedIds.length} selected
          </span>
          <button
            type="button"
            onClick={() => runBulkAction("ENABLE")}
            disabled={!selectedIds.length || bulkDiscounts.isPending}
            className="rounded-md border border-[#DCEFE5] bg-[#F4FBF7] px-3 py-1.5 text-[12.5px] font-medium text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bulk enable
          </button>
          <button
            type="button"
            onClick={() => runBulkAction("DISABLE")}
            disabled={!selectedIds.length || bulkDiscounts.isPending}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#6B6B6B] disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bulk disable
          </button>
          <button
            type="button"
            onClick={() => setBulkDeleting(true)}
            disabled={!selectedIds.length || bulkDiscounts.isPending}
            className="rounded-md border border-red-100 bg-red-50 px-3 py-1.5 text-[12.5px] font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Bulk delete
          </button>
        </div>
      </div>

      {showColumns ? (
        <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">
            Column visibility
          </div>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(visibleColumns).map(([key, value]) => (
              <label
                key={key}
                className="flex items-center gap-2 text-[13px] text-[#1A1A1A]"
              >
                <input
                  type="checkbox"
                  checked={value}
                  onChange={(event) =>
                    setVisibleColumns((current) => ({
                      ...current,
                      [key]: event.target.checked,
                    }))
                  }
                />
                <span className="capitalize">{key}</span>
              </label>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex gap-6 items-start">
        {/* TABLE */}
        <div className="flex-1 min-w-0">
          <DataTable<Discount>
            columns={filteredColumns}
            data={discounts}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No discount rules found."
          />
        </div>

        {/* RIGHT SIDEBAR */}
        <div className="w-[340px] shrink-0 space-y-5">
          {/* IMPORT / EXPORT CARD */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            {/* HEADER */}
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-gray-900">
                  Import / Export
                </h3>
                <p className="mt-1 text-[12.5px] text-gray-500">
                  Upload spreadsheet to manage discounts
                </p>
              </div>

              <button
                type="button"
                onClick={() => void handleExport(false)}
                className="text-sm font-medium text-gray-600 hover:text-black"
              >
                Export
              </button>
            </div>

            {/* DROPZONE */}
            <label className="mt-4 flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 p-5 text-center transition hover:bg-gray-100">
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

              <Upload size={20} className="mb-2 text-red-500" />

              <p className="text-sm font-medium text-gray-800 truncate max-w-[220px]">
                {importFile ? importFile.name : "Click to upload file"}
              </p>

              <p className="text-xs text-gray-500 mt-1">
                XLSX, XLS, CSV supported
              </p>
            </label>

            {/* ACTION BUTTONS */}
            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => void handleImportPreview()}
                disabled={previewDiscountImport.isPending}
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Preview
              </button>

              <button
                type="button"
                onClick={() => void handleImport()}
                disabled={
                  importing ||
                  importDiscounts.isPending ||
                  !!importReport?.invalidRows
                }
                className="flex-1 rounded-lg bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
              >
                {importing ? "Importing..." : "Import"}
              </button>
            </div>

            {/* MESSAGE */}
            {importMessage && (
              <div className="mt-4 rounded-lg bg-gray-50 border border-gray-200 px-3 py-2 text-sm text-gray-700">
                {importMessage}
              </div>
            )}
          </div>

          {/* REPORT CARD */}
          {importReport && (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm space-y-4">
              <h4 className="text-sm font-semibold text-gray-800">
                Import Summary
              </h4>

              {/* STATS */}
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Rows", value: importReport.totalRows },
                  {
                    label: "Valid",
                    value: importReport.validRows,
                    color: "text-green-600",
                  },
                  {
                    label: "Invalid",
                    value: importReport.invalidRows,
                    color: "text-red-600",
                  },
                  {
                    label: "Duplicates",
                    value: importReport.duplicateWarnings.length,
                    color: "text-amber-600",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="rounded-xl bg-gray-50 p-3 text-center"
                  >
                    <div className="text-xs text-gray-500">{item.label}</div>
                    <div
                      className={`text-lg font-semibold ${item.color || "text-gray-900"}`}
                    >
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* ISSUES */}
              {importReport.issues.length > 0 && (
                <div>
                  <div className="text-xs font-medium text-gray-500 mb-2">
                    Issues
                  </div>

                  <div className="space-y-2 max-h-[150px] overflow-auto">
                    {importReport.issues.slice(0, 4).map((issue, index) => (
                      <div
                        key={`${issue.row}-${issue.field}-${index}`}
                        className="rounded-md bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-600"
                      >
                        Row {issue.row}: {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        onPageChange={(nextPage) => {
          setPage(nextPage);
          setSelectedIds([]);
        }}
      />
      <ConfirmModal
        open={!!deleting}
        title="Delete discount?"
        message="This rule will stop applying immediately."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />
      <ConfirmModal
        open={bulkDeleting}
        title="Delete selected discounts?"
        message="Selected discount rules will stop applying immediately."
        onConfirm={() => runBulkAction("DELETE")}
        onCancel={() => setBulkDeleting(false)}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
