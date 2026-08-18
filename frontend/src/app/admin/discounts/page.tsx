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
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  Column,
  ConfirmModal,
  DataTable,
  Pagination,
  StatCard,
  AdminStatsGrid,
  AdminListToolbar,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  useAdminCategories,
  useAdminCountries,
  useAdminDiscountDashboard,
  useAdminDiscounts,
  useAdminCollections,
  useAdminProducts,
  useAdminProductsInfinite,
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
  countries?: Related[];
  productId: string | null;
  product?: Related | null;
  products?: Related[];
  collectionId: string | null;
  collection?: Related | null;
  collections?: Related[];
  categoryId: string | null;
  category?: Related | null;
  categories?: Related[];
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
  productIds: string[];
  collectionIds: string[];
  categoryIds: string[];
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
  productIds: [],
  collectionIds: [],
  categoryIds: [],
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
  const pCount = (discount as any).products?.length ?? 0;
  const colCount = (discount as any).collections?.length ?? 0;
  const catCount = (discount as any).categories?.length ?? 0;
  if (pCount > 0) return `${pCount} Product(s): ${(discount as any).products.map((p: any) => p.title).join(", ")}`;
  if (colCount > 0) return `${colCount} Collection(s): ${(discount as any).collections.map((c: any) => c.name).join(", ")}`;
  if (catCount > 0) return `${catCount} Category(ies): ${(discount as any).categories.map((c: any) => c.name).join(", ")}`;
  return "Platform-wide";
}

function toForm(discount: Discount): FormState {
  const products = (discount as any).products ?? [];
  const collections = (discount as any).collections ?? [];
  const categories = (discount as any).categories ?? [];
  const countries = (discount as any).countries ?? [];
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
    countryIds: countries.map((c: any) => c.id),
    scope: products.length > 0
      ? "PRODUCT"
      : collections.length > 0
        ? "COLLECTION"
        : categories.length > 0
          ? "CATEGORY"
          : "PLATFORM",
    productIds: products.map((p: any) => p.id),
    collectionIds: collections.map((c: any) => c.id),
    categoryIds: categories.map((c: any) => c.id),
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
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("discounts.create");
  const canUpdate = hasPermission("discounts.update");
  const canDelete = hasPermission("discounts.delete");

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
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { showToast, ToastComponent } = useToast();
  const { data: dashboardData, isLoading: dashboardLoading } =
    useAdminDiscountDashboard();
  const { data, isLoading, refetch, isFetching } = useAdminDiscounts({
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
  const [productSearch, setProductSearch] = useState("");
  const {
    data: infiniteProductsData,
    fetchNextPage: fetchNextProductsPage,
    hasNextPage: hasNextProductsPage,
    isFetchingNextPage: isFetchingNextProductsPage,
  } = useAdminProductsInfinite({
    search: productSearch || undefined,
    limit: 20,
  });
  const createDiscount = useCreateDiscount();
  const updateDiscount = useUpdateDiscount();
  const deleteDiscount = useDeleteDiscount();
  const bulkDiscounts = useBulkDiscounts();
  const exportDiscounts = useExportDiscounts();
  const previewDiscountImport = usePreviewDiscountImport();
  const importDiscounts = useImportDiscounts();

  const form = useAdminForm({
    initialValues: blankForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.name?.trim()) errors.name = "Discount name is required.";
      if (!values.type) errors.type = "Type is required.";
      if (values.type === "TIER" && !values.tierId) errors.tierId = "Tier is required.";
      if (values.type === "MOQ" && !values.minQuantity) errors.minQuantity = "Minimum quantity is required.";
      if (values.valueType === "PERCENT" && !values.discountPercent) errors.discountPercent = "Percentage is required.";
      if (values.valueType === "FIXED" && !values.fixedAmount) errors.fixedAmount = "Fixed amount is required.";
      if (values.scope === "PRODUCT" && values.productIds.length === 0) errors.productIds = "Select at least one product.";
      if (values.scope === "COLLECTION" && values.collectionIds.length === 0) errors.collectionIds = "Select at least one collection.";
      if (values.scope === "CATEGORY" && values.categoryIds.length === 0) errors.categoryIds = "Select at least one category.";
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const payload = {
        name: values.name,
        type: values.type,
        status: values.status,
        tierId: values.type === "TIER" ? values.tierId || null : null,
        minQuantity: values.type === "MOQ" ? values.minQuantity : null,
        discountPercent: values.valueType === "PERCENT" ? values.discountPercent : null,
        fixedAmount: values.valueType === "FIXED" ? values.fixedAmount : null,
        countryIds: values.countryIds,
        productIds: values.scope === "PRODUCT" ? values.productIds : [],
        collectionIds: values.scope === "COLLECTION" ? values.collectionIds : [],
        categoryIds: values.scope === "CATEGORY" ? values.categoryIds : [],
        startDate: values.startDate || null,
        endDate: values.endDate || null,
      };

      try {
        if (values.id) {
          await updateDiscount.mutateAsync({ id: values.id, ...payload });
          showToast("Discount updated.");
        } else {
          await createDiscount.mutateAsync(payload);
          showToast("Discount created.");
        }
        resetForm();
        setShowForm(false);
      } catch (error) {
        showToast(
          getAdminErrorMessage(error, "Failed to save discount."),
          "error",
        );
      }
    }
  });

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

  const products: Related[] = useMemo(() => {
    return infiniteProductsData?.pages.flatMap((page: any) => page.data ?? []) ?? [];
  }, [infiniteProductsData?.pages]);
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
      countries: countries
        .filter((country: any) => country.status === "ACTIVE")
        .map((country: any) => ({
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
    form.reset(blankForm);
    setShowForm(false);
  };

  const resetPage = () => {
    setPage(1);
    setSelectedIds([]);
  };

  const setField = (key: keyof FormState, value: string) => {
    const next = { ...form.values, [key]: value };
    if (key === "type" && value === "TIER") next.minQuantity = "";
    if (key === "type" && value === "MOQ") next.tierId = "";
    if (key === "type" && value === "PROMOTIONAL") {
      next.tierId = "";
      next.minQuantity = "";
    }
    if (key === "valueType" && value === "PERCENT") next.fixedAmount = "";
    if (key === "valueType" && value === "FIXED") next.discountPercent = "";
    if (key === "scope" && value === "PLATFORM") {
      next.productIds = [];
      next.collectionIds = [];
      next.categoryIds = [];
    }
    if (key === "scope" && value === "PRODUCT") {
      next.collectionIds = [];
      next.categoryIds = [];
    }
    if (key === "scope" && value === "COLLECTION") {
      next.productIds = [];
      next.categoryIds = [];
    }
    if (key === "scope" && value === "CATEGORY") {
      next.productIds = [];
      next.collectionIds = [];
    }
    form.setValues(next);
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

  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const { adminApi } = await import("@/services/adminApi");
      const res = await adminApi.get("/discounts", {
        params: {
          status: status || undefined,
          type: typeFilter || undefined,
          scope: scopeFilter || undefined,
          countryId: countryFilter || undefined,
          search: debouncedSearch.trim() || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((d: any) => d.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} discounts across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all discounts.", "error");
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "DELETE") {
      if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected discount(s)? This action cannot be undone.`)) {
        return;
      }
    }
    await runBulkAction(bulkAction);
    setBulkAction("");
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
      render: (row) => {
        const countries = row.countries ?? (row.country ? [row.country] : []);
        if (countries.length === 0) return "All countries";
        if (countries.length === 1) return `${countries[0].name ?? countries[0].code} (${countries[0].code})`;
        if (countries.length <= 2) return countries.map((c) => c.code ?? c.name).join(", ");
        return `${countries.length} Countries (${countries.slice(0, 2).map((c) => c.code ?? c.name).join(", ")}, ...)`;
      },
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
            disabled={updateDiscount.isPending || !canUpdate}
            title={
              !canUpdate
                ? "You do not have permission to edit discounts"
                : isActive
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
          {canUpdate && (
            <button
              onClick={() => {
                form.reset(toForm(row));
                setShowForm(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
              title="Edit discount"
            >
              <Edit2 size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeleting(row.id)}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
              title="Delete discount"
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
    if (column.key === "type") return visibleColumns.type;
    if (column.key === "value") return visibleColumns.discount;
    if (column.key === "condition") return visibleColumns.condition;
    if (column.key === "country") return visibleColumns.country;
    if (column.key === "dates") return visibleColumns.dates;
    if (column.key === "status") return visibleColumns.status;
    return true;
  });

  const discountForm = (
    <form onSubmit={form.handleSubmit} className="flex flex-col min-h-0 overflow-hidden">
      <div className="p-6 overflow-y-auto flex-1">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <AdminInput
            label="Rule Name"
            {...form.getFieldProps("name")}
            error={form.errors.name as string}
            placeholder="Gold launch promo"
          />
          <AdminSelect
            label="Discount Type"
            {...form.getFieldProps("type")}
            error={form.errors.type as string}
            onChange={(event) => setField("type", event.target.value)}
            options={[
              { value: "TIER", label: "Tier Discount" },
              { value: "MOQ", label: "MOQ Discount" },
              { value: "PROMOTIONAL", label: "Promotional" },
            ]}
          />
          <AdminMultiSearchableSelect
            label="Countries"
            values={form.values.countryIds}
            onValuesChange={(values) =>
              form.setFieldValue("countryIds", values)
            }
            options={options.countries}
            placeholder="Select countries"
            allowSelectAll
            selectAllLabel="All countries"
            selectionSummaryFormatter={(selected) => `${selected.length} Countries Selected`}
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

          {form.values.type === "TIER" ? (
            <AdminSelect
              label="Tier"
              {...form.getFieldProps("tierId")}
              error={form.errors.tierId as string}
              options={options.tiers}
            />
          ) : form.values.type === "MOQ" ? (
            <AdminInput
              label="Minimum Quantity"
              type="text"
              inputMode="numeric"
              {...form.getFieldProps("minQuantity")}
              error={form.errors.minQuantity as string}
            />
          ) : (
            <div className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3.5 py-2.5 text-[13px] text-[#6B6B6B]">
              Open promotions apply by scope, country, and active date window.
            </div>
          )}

          <AdminSelect
            label="Value Type"
            {...form.getFieldProps("valueType")}
            error={form.errors.valueType as string}
            onChange={(event) => setField("valueType", event.target.value)}
            options={[
              { value: "PERCENT", label: "Percentage" },
              { value: "FIXED", label: "Fixed amount off" },
            ]}
          />
          {form.values.valueType === "PERCENT" ? (
            <AdminInput
              label="Discount Percent"
              type="text"
              inputMode="decimal"
              {...form.getFieldProps("discountPercent")}
              error={form.errors.discountPercent as string}
            />
          ) : (
            <AdminInput
              label="Fixed Amount"
              type="text"
              inputMode="decimal"
              {...form.getFieldProps("fixedAmount")}
              error={form.errors.fixedAmount as string}
            />
          )}
          <AdminSelect
            label="Scope"
            {...form.getFieldProps("scope")}
            error={form.errors.scope as string}
            onChange={(event) => setField("scope", event.target.value)}
            options={[
              { value: "PLATFORM", label: "Platform-wide" },
              { value: "PRODUCT", label: "Product" },
              { value: "COLLECTION", label: "Collection" },
              { value: "CATEGORY", label: "Category" },
            ]}
          />
          {form.values.scope === "PRODUCT" && (
            <div className="flex flex-col">
            <AdminMultiSearchableSelect
              label="Products"
              values={form.values.productIds}
              onValuesChange={(values) =>
                form.setFieldValue("productIds", values)
              }
              options={options.products}
              placeholder="Select products"
              allowSelectAll
              selectAllLabel="All products"
              selectionSummaryFormatter={(selected) => `${selected.length} Products Selected`}
              onMenuScrollToBottom={() => {
                if (hasNextProductsPage && !isFetchingNextProductsPage) {
                  fetchNextProductsPage();
                }
              }}
              isLoadingMore={isFetchingNextProductsPage}
              onSearchChange={setProductSearch}
            />
            {form.errors.productIds && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.productIds as string}</span>}
            </div>
          )}
          {form.values.scope === "COLLECTION" && (
            <div className="flex flex-col">
            <AdminMultiSearchableSelect
              label="Collections"
              values={form.values.collectionIds}
              onValuesChange={(values) =>
                form.setFieldValue("collectionIds", values)
              }
              options={options.collections}
              placeholder="Select collections"
              allowSelectAll
              selectAllLabel="All collections"
              selectionSummaryFormatter={(selected) => `${selected.length} Collections Selected`}
            />
            {form.errors.collectionIds && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.collectionIds as string}</span>}
            </div>
          )}
          {form.values.scope === "CATEGORY" && (
            <div className="flex flex-col">
            <AdminMultiSearchableSelect
              label="Categories"
              values={form.values.categoryIds}
              onValuesChange={(values) =>
                form.setFieldValue("categoryIds", values)
              }
              options={options.categories}
              placeholder="Select categories"
              allowSelectAll
              selectAllLabel="All categories"
              selectionSummaryFormatter={(selected) => `${selected.length} Categories Selected`}
            />
            {form.errors.categoryIds && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.categoryIds as string}</span>}
            </div>
          )}

          <AdminInput
            label="Start Date"
            type="date"
            {...form.getFieldProps("startDate")}
            error={form.errors.startDate as string}
          />
          <AdminInput
            label="End Date"
            type="date"
            {...form.getFieldProps("endDate")}
            error={form.errors.endDate as string}
          />
        </div>
      </div>
      <div className="border-t border-[#E5E7EB] bg-[#FAFAFA] px-6 py-4 flex items-center justify-end gap-2.5 shrink-0">
        <button
          type="button"
          onClick={resetForm}
          className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]"
        >
          Cancel
        </button>
        <LoadingButton
          type="submit"
          loading={form.isSubmitting || createDiscount.isPending || updateDiscount.isPending}
          loadingText="Processing..."
          className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
        >
          {form.values.id ? "Update Discount" : "Create Discount"}
        </LoadingButton>
      </div>
    </form>
  );

  return (
    <AdminLayout title="Discounts" breadcrumb={[{ label: "Discounts" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Total Discounts", value: dashboard?.totalDiscounts ?? 0, subtitle: "All discount rules", icon: <Filter size={18} />, isLoading: dashboardLoading },
          { title: "Active Discounts", value: dashboard?.activeDiscounts ?? 0, subtitle: "Currently available", icon: <SquareCheckBig size={18} />, color: "bg-green-600", isLoading: dashboardLoading },
          { title: "Inactive Discounts", value: dashboard?.inactiveDiscounts ?? 0, subtitle: "Paused or disabled", icon: <X size={18} />, color: "bg-gray-600", isLoading: dashboardLoading }
        ]}
      />

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              resetPage();
            },
            placeholder: "Search rule, product, category...",
            widthClassName: "max-w-[280px]",
          }}
          filters={{
            showFilters: showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [status, typeFilter, scopeFilter, countryFilter].filter(Boolean).length,
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
            options: Object.keys(visibleColumns).map((key) => ({ key, label: key })),
          }}
          exportAction={{
            onClick: () => void handleExport(selectedIds.length > 0),
            label: selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export",
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: () => {
                    resetForm();
                    setShowForm(true);
                  },
                  label: "Create Discount",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 pt-2">
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
          }
          onResetFilters={() => {
            setSearch("");
            setStatus("");
            setTypeFilter("");
            setScopeFilter("");
            setCountryFilter("");
            setSortBy("createdAt");
            setSortDir("desc");
            resetPage();
          }}
        />

      <Modal
        open={showForm}
        onClose={resetForm}
        title={form.values.id ? "Edit discount" : "New discount"}
        panelClassName="max-w-5xl flex flex-col max-h-[90vh] overflow-hidden z-[9999]"
      >
        {showForm ? discountForm : null}
      </Modal>

      <div className="flex gap-6 items-start">
        {/* TABLE */}
        <div className="flex-1 min-w-0">
          <DataTable<Discount>
            title="Discounts List"
            columns={filteredColumns}
            data={discounts}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No discount rules found."
            enableSelection={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalItems={data?.pagination?.total}
            currentPage={page}
            pageSize={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
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
                  { value: "DELETE", label: "Delete selected" }
                ]}
                onApply={handleBulkAction}
                applyLoading={bulkDiscounts.isPending}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
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
            {canUpdate ? (
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
            ) : (
              <div className="mt-4 flex flex-col items-center justify-center rounded-xl border border-gray-200 bg-gray-50 p-5 text-center text-[13px] text-[#6B6B6B]">
                Importing is disabled (No edit permission)
              </div>
            )}

            {/* ACTION BUTTONS */}
            {canUpdate && (
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
            )}

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
        isLoading={deleteDiscount.isPending}
      />
      <ConfirmModal
        open={bulkDeleting}
        title="Delete selected discounts?"
        message="Selected discount rules will stop applying immediately."
        onConfirm={() => runBulkAction("DELETE")}
        onCancel={() => setBulkDeleting(false)}
        isLoading={bulkDiscounts.isPending}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
