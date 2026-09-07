"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Copy,
  Download,
  Plus,
  Edit2,
  Filter,
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
  Tag,
  Percent,
  Archive,
  AlertTriangle,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  Column,
  DataTable,
  AdminStatsGrid,
  AdminListToolbar,
  Pagination,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
  AdminDeleteModal,
} from "@/components/admin/AdminComponents";
import {
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminRowActions";
import { AdminImportWizard, WizardColumnDef, WizardExpectedColumn } from "@/components/admin/AdminImportWizard";
import { Modal } from "@/components/ui/Modal";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/formatDate";
import {
  useAdminCategories,
  useAdminCountries,
  useAdminDiscountDashboard,
  useAdminDiscounts,
  useAdminCollections,
  useAdminProductsInfinite,
  useAdminTiers,
  useBulkDiscounts,
  useCreateDiscount,
  useUpdateDiscount,
  useArchiveDiscount,
  useDeleteDiscount,
  useRestoreDiscount,
  usePermanentDeleteDiscount,
  useBulkRestoreDiscounts,
  useBulkPermanentDeleteDiscounts,
  useExportDiscounts,
  useImportDiscounts,
  usePreviewDiscountImport,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

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
  maxQuantity: number | null;
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
  deletedAt?: string | null;
  canPermanentDelete?: boolean;
  permanentDeleteBlockReason?: string | null;
  dependencyCounts?: {
    countries: number;
    products: number;
    categories: number;
    collections: number;
  };
};

type FormState = {
  id?: string;
  name: string;
  type: "TIER" | "MOQ" | "PROMOTIONAL";
  status: "ACTIVE" | "INACTIVE";
  tierId: string;
  minQuantity: string;
  maxQuantity: string;
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
  archivedDiscounts: number;
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
  maxQuantity: "",
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
  actions: true,
};

const discountWizardColumns: WizardColumnDef[] = [
  { key: "name", header: "Discount Name", required: true, minWidth: "160px" },
  {
    key: "type",
    header: "Type",
    required: true,
    type: "select",
    minWidth: "130px",
    options: [
      { label: "Tier Discount", value: "TIER" },
      { label: "MOQ Discount", value: "MOQ" },
      { label: "Promotional", value: "PROMOTIONAL" },
    ],
  },
  { key: "discountPercent", header: "Discount %", type: "number", minWidth: "110px" },
  { key: "fixedAmount", header: "Fixed Amount", type: "number", minWidth: "110px" },
  { key: "minQuantity", header: "Min Quantity", type: "number", minWidth: "110px" },
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
  { key: "countryId", header: "Country IDs", minWidth: "140px", placeholder: "Comma separated IDs" },
  { key: "productId", header: "Product IDs", minWidth: "140px", placeholder: "Comma separated IDs" },
];

const discountExpectedColumns: WizardExpectedColumn[] = [
  { name: "name", required: true, hint: "Discount rule name" },
  { name: "type", required: true, hint: "TIER, MOQ, or PROMOTIONAL" },
  { name: "discountPercent", hint: "Percentage off (0-100)" },
  { name: "fixedAmount", hint: "Fixed currency discount amount" },
  { name: "minQuantity", hint: "Minimum item quantity" },
  { name: "status", hint: "ACTIVE or INACTIVE" },
  { name: "countryId", hint: "Country ID or comma-separated IDs" },
  { name: "productId", hint: "Product ID or comma-separated IDs" },
  { name: "tierId", hint: "Customer Tier ID" },
];

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
    maxQuantity: discount.maxQuantity ? String(discount.maxQuantity) : "",
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
  const [importOpen, setImportOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Discount | null>(null);
  const [deleteMode, setDeleteMode] = useState<"soft" | "permanent">("soft");
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [bulkDeleteMode, setBulkDeleteMode] = useState<"soft" | "permanent">("soft");
  const [bulkPermanentResult, setBulkPermanentResult] = useState<{
    totalSelected: number;
    deletedCount: number;
    blockedCount: number;
    deletedIds: string[];
    blocked: Array<{ id: string; name?: string; reason: string }>;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { showToast, ToastComponent } = useToast();

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminDiscountDashboard();
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
  const archiveDiscount = useArchiveDiscount();
  const deleteDiscount = useDeleteDiscount();
  const restoreDiscount = useRestoreDiscount();
  const permanentDeleteDiscount = usePermanentDeleteDiscount();
  const bulkDiscounts = useBulkDiscounts();
  const bulkRestoreDiscounts = useBulkRestoreDiscounts();
  const bulkPermanentDeleteDiscounts = useBulkPermanentDeleteDiscounts();
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
      if (values.type === "MOQ" && values.minQuantity && values.maxQuantity) {
        if (Number(values.maxQuantity) < Number(values.minQuantity)) {
          errors.maxQuantity = "Maximum quantity cannot be less than minimum quantity.";
        }
      }
      if (values.valueType === "PERCENT" && !values.discountPercent) errors.discountPercent = "Percentage is required.";
      if (values.valueType === "FIXED" && !values.fixedAmount) errors.fixedAmount = "Fixed amount is required.";
      if (values.scope === "PRODUCT" && values.productIds.length === 0) errors.productIds = "Select at least one product.";
      if (values.scope === "COLLECTION" && values.collectionIds.length === 0) errors.collectionIds = "Select at least one collection.";
      if (values.scope === "CATEGORY" && values.categoryIds.length === 0) errors.categoryIds = "Select at least one category.";
      return errors;
    },
    onSubmit: async (values, { resetForm: resetF }) => {
      const payload = {
        name: values.name,
        type: values.type,
        status: values.status,
        tierId: values.type === "TIER" ? values.tierId || null : null,
        minQuantity: values.type === "MOQ" ? values.minQuantity : null,
        maxQuantity: values.type === "MOQ" ? values.maxQuantity || null : null,
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
        resetF();
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
    }, 300);

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
    return infiniteProductsData?.pages.flatMap((p: any) => p.data ?? []) ?? [];
  }, [infiniteProductsData?.pages]);
  const collections: Related[] = collectionsData?.data ?? [];
  const discounts: Discount[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;
  const dashboard = dashboardData as DiscountDashboard | undefined;
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
    if (key === "type" && value === "TIER") {
      next.minQuantity = "";
      next.maxQuantity = "";
    }
    if (key === "type" && value === "MOQ") next.tierId = "";
    if (key === "type" && value === "PROMOTIONAL") {
      next.tierId = "";
      next.minQuantity = "";
      next.maxQuantity = "";
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

  const handleConfirmDelete = async (mode: "soft" | "permanent") => {
    if (!deleteTarget) return;
    try {
      if (mode === "permanent") {
        await permanentDeleteDiscount.mutateAsync(deleteTarget.id);
        showToast("Discount permanently deleted successfully.", "success");
      } else {
        await archiveDiscount.mutateAsync(deleteTarget.id);
        showToast("Discount archived successfully.", "success");
      }
      setDeleteTarget(null);
      setSelectedIds((prev) => prev.filter((id) => id !== deleteTarget.id));
    } catch (err) {
      showToast(
        getAdminErrorMessage(
          err,
          mode === "permanent" ? "Failed to permanently delete discount." : "Failed to archive discount."
        ),
        "error"
      );
    }
  };

  const handleRestore = async (discount: Discount) => {
    try {
      await restoreDiscount.mutateAsync(discount.id);
      showToast("Discount restored successfully.", "success");
      setSelectedIds((prev) => prev.filter((id) => id !== discount.id));
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to restore discount."), "error");
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

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "DELETE") {
      setBulkDeleteMode("soft");
      setBulkDeleting(true);
      return;
    }
    if (bulkAction === "PERMANENT_DELETE") {
      setBulkDeleteMode("permanent");
      setBulkDeleting(true);
      return;
    }
    if (bulkAction === "RESTORE") {
      try {
        const result = await bulkRestoreDiscounts.mutateAsync(selectedIds);
        const payload = (result as any)?.data ?? result;
        const restoredCount = typeof payload?.restoredCount === "number" ? payload.restoredCount : selectedIds.length;
        const blockedCount = typeof payload?.blockedCount === "number" ? payload.blockedCount : 0;
        if (blockedCount === 0) {
          showToast(`Successfully restored all ${restoredCount} discount rule(s).`, "success");
          setSelectedIds([]);
        } else {
          showToast(`Restored ${restoredCount} discount(s); ${blockedCount} could not be restored.`, "warning");
        }
        setBulkAction("");
      } catch (err) {
        showToast(getAdminErrorMessage(err, "Failed to restore selected discounts."), "error");
      }
      return;
    }
    if (bulkAction === "ENABLE" || bulkAction === "DISABLE") {
      try {
        await bulkDiscounts.mutateAsync({ ids: selectedIds, action: bulkAction });
        showToast(bulkAction === "ENABLE" ? "Discounts activated." : "Discounts deactivated.");
        setSelectedIds([]);
        setBulkAction("");
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to update discounts."), "error");
      }
    }
  };

  const handleConfirmBulkDelete = async (mode: "soft" | "permanent") => {
    if (!selectedIds.length) return;
    const totalSelected = selectedIds.length;
    try {
      if (mode === "permanent") {
        const result = await bulkPermanentDeleteDiscounts.mutateAsync(selectedIds);
        const payload = (result as any)?.data ?? result;
        const deletedIds: string[] = Array.isArray(payload?.deletedIds) ? payload.deletedIds : [];
        const blocked: Array<{ id: string; name?: string; reason: string }> = Array.isArray(payload?.blocked) ? payload.blocked : [];
        const deletedCount = typeof payload?.deletedCount === "number" ? payload.deletedCount : deletedIds.length;
        const blockedCount = typeof payload?.blockedCount === "number" ? payload.blockedCount : (blocked.length || Math.max(0, totalSelected - deletedCount));

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
          blocked,
        });

        if (blockedCount === 0 && deletedCount > 0) {
          showToast(`Successfully permanently deleted all ${deletedCount} discount rule(s).`, "success");
        } else if (deletedCount === 0 && blockedCount > 0) {
          showToast(`All ${blockedCount} selected discount rule(s) are protected from permanent deletion.`, "error");
        } else {
          showToast(`Permanently deleted ${deletedCount} rule(s); ${blockedCount} protected rule(s) preserved.`, "warning");
        }
      } else {
        await bulkDiscounts.mutateAsync({ ids: selectedIds, action: "ARCHIVE" });
        showToast(`Successfully archived ${selectedIds.length} discount rule(s).`, "success");
        setSelectedIds([]);
      }
      setBulkDeleting(false);
      setBulkAction("");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to delete selected discounts."), "error");
    }
  };

  const [bulkAction, setBulkAction] = useState<string>("");

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

  const downloadSampleTemplate = async () => {
    try {
      const response = await adminApi.get("/discounts/sample-template", { responseType: "blob" });
      downloadBlob(response.data as Blob, "discounts-template.xlsx");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download sample template."), "error");
    }
  };




  const columns: Column<Discount>[] = [
    {
      key: "name",
      label: "Rule",
      width: "240px",
      render: (row) => (
        <div className="min-w-0 pr-3">
          <button
            type="button"
            onClick={() => {
              if (canUpdate) {
                form.reset(toForm(row));
                setShowForm(true);
              }
            }}
            className="text-left font-semibold text-[#1A1A1A] hover:text-[#E31E24] text-[13px] block truncate transition-colors cursor-pointer"
            title={row.name}
          >
            {row.name}
          </button>
          <div className="mt-0.5 text-[11.5px] text-[#6B6B6B] truncate" title={scopeLabel(row)}>
            {scopeLabel(row)}
          </div>
        </div>
      ),
    },
    {
      key: "type",
      label: "Type",
      width: "130px",
      render: (row) => (
        <span className="inline-flex items-center rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-2.5 py-0.5 text-[11.5px] font-medium text-[#555] whitespace-nowrap">
          {row.type === "TIER"
            ? "Tier discount"
            : row.type === "MOQ"
              ? "MOQ discount"
              : "Open promotion"}
        </span>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      width: "130px",
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1A1A1A] text-[13px]">
            {discountValue(row)}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-[#9A9A9A]">
            {row.discountPercent != null ? "Percentage" : "Fixed amount"}
          </div>
        </div>
      ),
    },
    {
      key: "condition",
      label: "Condition",
      width: "150px",
      render: (row) => (
        <div className="text-[12.5px] text-[#555]">
          {row.type === "TIER"
            ? (row.tier?.name ?? "Tier required")
            : row.type === "MOQ"
              ? row.maxQuantity
                ? `${row.minQuantity} - ${row.maxQuantity} units`
                : `${row.minQuantity}+ units`
              : "No minimum condition"}
        </div>
      ),
    },
    {
      key: "country",
      label: "Country",
      width: "160px",
      render: (row) => {
        const cList = row.countries ?? (row.country ? [row.country] : []);
        let label = "All countries";
        if (cList.length === 1) label = `${cList[0].name ?? cList[0].code} (${cList[0].code})`;
        else if (cList.length <= 2) label = cList.map((c) => c.code ?? c.name).join(", ");
        else if (cList.length > 2) label = `${cList.length} Countries (${cList.slice(0, 2).map((c) => c.code ?? c.name).join(", ")}, ...)`;
        return <span className="text-[12.5px] text-[#555] truncate block" title={label}>{label}</span>;
      },
    },
    {
      key: "dates",
      label: "Dates",
      width: "180px",
      render: (row) => (
        <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
          {row.startDate || row.endDate
            ? `${dateInput(row.startDate) || "Any"} to ${dateInput(row.endDate) || "Any"}`
            : "Always active"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "110px",
      render: (row) => (
        <StatusBadge
          status={row.deletedAt ? "ARCHIVED" : row.status}
          interactive={canUpdate && !row.deletedAt && status !== "ARCHIVED"}
          onClick={() => toggleStatus(row)}
          loading={updateDiscount.isPending && (updateDiscount.variables as any)?.id === row.id}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      align: "left",
      render: (row) => {
        if (status === "ARCHIVED" || row.deletedAt) {
          return (
            <AdminRowActions
              extra={
                canUpdate ? (
                  <AdminActionButton
                    action={{
                      onClick: () => handleRestore(row),
                      title: "Restore discount",
                    }}
                    defaultIcon={<RotateCcw size={13} />}
                    defaultTitle="Restore discount"
                  />
                ) : null
              }
              delete={
                canDelete
                  ? {
                      onClick: () => {
                        setDeleteTarget(row);
                        setDeleteMode("permanent");
                      },
                      title: "Permanently delete discount",
                    }
                  : undefined
              }
            />
          );
        }

        return (
          <AdminRowActions
            edit={
              canUpdate
                ? {
                    onClick: () => {
                      form.reset(toForm(row));
                      setShowForm(true);
                    },
                    title: "Edit discount",
                  }
                : undefined
            }
            extra={
              canCreate ? (
                <AdminActionButton
                  action={{
                    onClick: () => {
                      const cloned = toForm(row);
                      cloned.id = undefined;
                      cloned.name = `${cloned.name} Copy`;
                      form.reset(cloned);
                      setShowForm(true);
                    },
                    title: "Clone discount",
                  }}
                  defaultIcon={<Copy size={13} />}
                  defaultTitle="Clone discount"
                />
              ) : null
            }
            delete={
              canDelete
                ? {
                    onClick: () => {
                      setDeleteTarget(row);
                      setDeleteMode("soft");
                    },
                    title: "Delete discount",
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
    if (column.key === "type") return visibleColumns.type;
    if (column.key === "discount") return visibleColumns.discount;
    if (column.key === "condition") return visibleColumns.condition;
    if (column.key === "country") return visibleColumns.country;
    if (column.key === "dates") return visibleColumns.dates;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "actions") return visibleColumns.actions;
    return true;
  });

  const discountForm = (
    <form id="discount-form" onSubmit={form.handleSubmit} className="p-6">
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
          <div className="grid grid-cols-2 gap-4">
            <AdminInput
              label="Minimum Quantity"
              type="text"
              inputMode="numeric"
              {...form.getFieldProps("minQuantity")}
              error={form.errors.minQuantity as string}
            />
            <AdminInput
              label="Maximum Quantity"
              type="text"
              inputMode="numeric"
              placeholder="Optional"
              {...form.getFieldProps("maxQuantity")}
              error={form.errors.maxQuantity as string}
            />
          </div>
        ) : null}

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
    </form>
  );

  return (
    <AdminLayout title="Discounts" breadcrumb={[{ label: "Pricing", href: "/admin/pricing" }, { label: "Discounts" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Discounts", value: dashboard?.totalDiscounts ?? 0, subtitle: "All discount rules", icon: <Tag size={18} />, isLoading: dashboardLoading },
            { title: "Active Discounts", value: dashboard?.activeDiscounts ?? 0, subtitle: "Currently available", icon: <CheckCircle2 size={18} />, color: "bg-emerald-600", isLoading: dashboardLoading },
            { title: "Inactive Discounts", value: dashboard?.inactiveDiscounts ?? 0, subtitle: "Paused or disabled", icon: <XCircle size={18} />, color: "bg-slate-600", isLoading: dashboardLoading },
            { title: "Promotions", value: dashboard?.promotionalDiscounts ?? 0, subtitle: "Open promotional rules", icon: <Percent size={18} />, color: "bg-amber-600", isLoading: dashboardLoading },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {[
            { id: "", label: "All Discounts", count: dashboard?.totalDiscounts ?? 0, icon: <Layers size={15} /> },
            { id: "ACTIVE", label: "Active", count: dashboard?.activeDiscounts ?? 0, icon: <CheckCircle2 size={15} /> },
            { id: "INACTIVE", label: "Inactive", count: dashboard?.inactiveDiscounts ?? 0, icon: <XCircle size={15} /> },
            { id: "ARCHIVED", label: "Archived", count: (dashboard as any)?.archivedDiscounts ?? 0, icon: <Archive size={15} /> },
          ].map((tab) => {
            const isActive = status === tab.id;
            return (
              <button
                key={tab.id || "ALL"}
                type="button"
                onClick={() => {
                  setStatus(tab.id);
                  setPage(1);
                  setSelectedIds([]);
                  setBulkAction("");
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
        {status !== "ARCHIVED" && (dashboard?.recentlyUpdated ?? []).length > 0 && (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Recently Updated</h3>
                <p className="text-[12px] text-[#6B6B6B]">Quick access to latest modified discount rules.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-[#6B6B6B]">
                {dashboard?.recentlyUpdated?.length ?? 0} items
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
              {(dashboard?.recentlyUpdated ?? []).slice(0, 5).map((d) => (
                <div
                  key={d.id}
                  className="rounded-lg border border-[#E6E6E6] p-3 text-left transition hover:bg-[#FAFAFA] flex flex-col justify-between"
                >
                  <div>
                    <div className="truncate text-[13px] font-semibold text-[#1A1A1A]">{d.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">
                      {discountValue(d)} • {d.type === "TIER" ? "Tier" : d.type === "MOQ" ? "MOQ" : "Promo"}
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t border-[#F0F0F0] flex items-center justify-between">
                    <span className="text-[11px] text-[#6B6B6B]">
                      {d.status === "ACTIVE" ? "Active" : "Inactive"}
                    </span>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => {
                          form.reset(toForm(d));
                          setShowForm(true);
                        }}
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
              resetPage();
            },
            placeholder: "Search rule, product, category...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters: showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [status, typeFilter, scopeFilter, countryFilter, sortBy !== "createdAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
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
              { key: "name", label: "Rule" },
              { key: "type", label: "Type" },
              { key: "discount", label: "Discount" },
              { key: "condition", label: "Condition" },
              { key: "country", label: "Country" },
              { key: "dates", label: "Dates" },
              { key: "status", label: "Status" },
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
              void refetch().then(() => showToast("Discounts refreshed."));
            },
            isRefreshing: isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  onClick: () => {
                    resetForm();
                    setShowForm(true);
                  },
                  label: "Add Discount",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 pt-2">
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  resetPage();
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Type"
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                options={[
                  { value: "", label: "All Types" },
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
                  { value: "", label: "All Scopes" },
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
                options={[
                  { value: "", label: "All Countries" },
                  ...options.countries,
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={String(sortBy)}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "createdAt", label: "Created Date" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "name", label: "Rule Name" },
                  { value: "type", label: "Type" },
                  { value: "status", label: "Status" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
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

        {/* FULL-WIDTH DATA TABLE */}
        <div>
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
            onToggleStatus={canUpdate && status !== "ARCHIVED" ? toggleStatus : undefined}
            statusLoadingId={updateDiscount.isPending ? ((updateDiscount.variables as any)?.id ?? null) : null}
            isStatusDisabled={(row) => !canUpdate || row.status === "ARCHIVED" || (row as any).deletedAt != null}
            totalItems={data?.pagination?.total ?? 0}
            currentPage={page}
            pageSize={limit}
            totalPages={totalPages}
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
                  status === "ARCHIVED"
                    ? [
                        { value: "RESTORE", label: "Restore selected" },
                        { value: "PERMANENT_DELETE", label: "Permanent delete selected" },
                      ]
                    : [
                        { value: "ENABLE", label: "Mark active" },
                        { value: "DISABLE", label: "Mark inactive" },
                        { value: "DELETE", label: "Delete selected" },
                      ]
                }
                onApply={handleBulkAction}
                applyLoading={
                  bulkDiscounts.isPending ||
                  bulkRestoreDiscounts.isPending ||
                  bulkPermanentDeleteDiscounts.isPending
                }
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>

      {/* CREATE / EDIT DISCOUNT MODAL */}
      <Modal
        open={showForm}
        onClose={resetForm}
        title={form.values.id ? "Edit Discount" : "New Discount"}
        subtitle="Configure promotional, tier-based, or volume MOQ discount campaigns."
        size="4xl"
        panelClassName="max-w-5xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={resetForm}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="discount-form"
              loading={form.isSubmitting || createDiscount.isPending || updateDiscount.isPending}
              loadingText="Processing..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              {form.values.id ? "Update Discount" : "Create Discount"}
            </LoadingButton>
          </div>
        }
      >
        {showForm ? discountForm : null}
      </Modal>

      {/* IMPORT SPREADSHEET MODAL */}
      <AdminImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Discounts Spreadsheet"
        subtitle="Upload an Excel (.xlsx, .xls) or CSV spreadsheet to create or update discount rules with live preview & direct inline editing."
        entityName="discount rules"
        columns={discountWizardColumns}
        expectedColumns={discountExpectedColumns}
        sampleTemplateUrl="/discounts/sample-template"
        sampleTemplateFilename="discounts-template.xlsx"
        previewEndpoint="/discounts/import/preview"
        executeEndpoint="/discounts/import"
        onSuccess={(result) => {
          showToast(
            `Import complete: ${result?.created ?? 0} created, ${result?.updated ?? 0} updated.`,
            "success"
          );
          refetch();
        }}
      />

      {/* CONFIRM DELETE / ARCHIVE MODALS */}
      <AdminDeleteModal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        itemName={deleteTarget ? deleteTarget.name : undefined}
        itemType="Discount Rule"
        warningMessage={
          status === "ARCHIVED" || deleteTarget?.deletedAt != null
            ? "Permanent deletion will permanently remove this discount rule from the database and cascade remove all its product, category, collection, and country mappings. This action cannot be undone."
            : "Choose the deletion method for this discount rule. Soft Delete (Archive) is recommended to preserve promotional history."
        }
        softDeleteDescription={
          status === "ARCHIVED" || deleteTarget?.deletedAt != null
            ? "This discount rule is already soft-deleted and stored in the central Archive."
            : "Hides this discount rule from active pricing and checkout resolution while preserving all product, category, collection, and country mappings."
        }
        permanentDeleteDescription={
          deleteTarget
            ? `Permanently purges discount rule "${deleteTarget.name}". All association records will be cleanly removed.`
            : undefined
        }
        permanentDeleteDisabled={status !== "ARCHIVED" && deleteTarget?.deletedAt == null}
        permanentDeleteDisabledReason={
          status !== "ARCHIVED" && deleteTarget?.deletedAt == null
            ? "Permanent Delete is available only for archived discounts. Archive the discount first."
            : (deleteTarget?.permanentDeleteBlockReason ?? undefined)
        }
        initialDeleteType={status === "ARCHIVED" || deleteTarget?.deletedAt != null ? "permanent" : "soft"}
        softDeleteButtonText={status === "ARCHIVED" || deleteTarget?.deletedAt != null ? undefined : "Archive Discount"}
        permanentDeleteButtonText="Permanently Delete Discount"
        onSoftDelete={
          status === "ARCHIVED" || deleteTarget?.deletedAt != null
            ? () => {
                showToast("Discount is already archived.", "info");
                setDeleteTarget(null);
              }
            : () => handleConfirmDelete("soft")
        }
        onPermanentDelete={() => handleConfirmDelete("permanent")}
        isSoftDeleting={archiveDiscount.isPending}
        isPermanentDeleting={permanentDeleteDiscount.isPending}
      />

      {/* BULK DELETION METHOD MODAL */}
      <AdminDeleteModal
        open={bulkDeleting}
        onClose={() => {
          setBulkDeleting(false);
          setBulkAction("");
        }}
        itemName={`${selectedIds.length} selected discount rule${selectedIds.length === 1 ? "" : "s"}`}
        itemType="Discount Rules (Bulk)"
        warningMessage={
          status === "ARCHIVED"
            ? "Permanent deletion will permanently remove the selected discount rules from the database and cascade remove all their mappings. This action cannot be undone."
            : "Choose the deletion method for the selected discount rules. Soft Delete (Archive) is recommended to maintain promotional history."
        }
        softDeleteDescription={
          status === "ARCHIVED"
            ? "These discount rules are already soft-deleted and stored in the central Archive."
            : `Archives the ${selectedIds.length} selected discount rule${selectedIds.length === 1 ? "" : "s"} from the active workspace while preserving all product, category, and collection assignments for possible restoration.`
        }
        permanentDeleteDescription={`Permanently purges the ${selectedIds.length} selected discount rule${selectedIds.length === 1 ? "" : "s"} from the database. Any active (non-archived) discount rules will be protected.`}
        permanentDeleteDisabled={status !== "ARCHIVED"}
        permanentDeleteDisabledReason="Permanent Delete is available only for archived discounts. Archive the discount first."
        initialDeleteType={status === "ARCHIVED" ? "permanent" : "soft"}
        softDeleteButtonText={status === "ARCHIVED" ? undefined : "Archive Discounts (Bulk)"}
        permanentDeleteButtonText="Permanently Delete Discounts (Bulk)"
        onSoftDelete={
          status === "ARCHIVED"
            ? () => {
                showToast("Selected discounts are already archived.", "info");
                setBulkDeleting(false);
              }
            : () => handleConfirmBulkDelete("soft")
        }
        onPermanentDelete={() => handleConfirmBulkDelete("permanent")}
        isSoftDeleting={bulkDiscounts.isPending}
        isPermanentDeleting={bulkPermanentDeleteDiscounts.isPending}
      />

      {/* BULK PERMANENT DELETE RESULT MODAL */}
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
              ? `All ${bulkPermanentResult.blockedCount || bulkPermanentResult.totalSelected} selected discount rules are protected by database integrity rules.`
              : bulkPermanentResult.blockedCount === 0
              ? `All ${bulkPermanentResult.totalSelected} selected discount rules were permanently purged from the database.`
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
                  {bulkPermanentResult.deletedCount === 0 ? "Blocked / Protected" : "Protected Preserved"}
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

            {bulkPermanentResult.blockedCount > 0 && bulkPermanentResult.blocked.length > 0 && (
              <div className="space-y-2">
                <span className="text-[12.5px] font-semibold text-[#1A1A1A] block">
                  Protected Records Detail:
                </span>
                <div className="max-h-52 overflow-y-auto rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] divide-y divide-[#E6E6E6]">
                  {bulkPermanentResult.blocked.map((item) => (
                    <div key={item.id} className="p-3 text-[12.5px] flex items-start justify-between gap-3">
                      <div>
                        <div className="font-semibold text-[#1A1A1A]">{item.name || item.id}</div>
                        <div className="text-[11.5px] text-[#666] mt-0.5">{item.reason}</div>
                      </div>
                      <span className="rounded bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800 shrink-0">
                        Protected
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      {ToastComponent}
    </AdminLayout>
  );
}
