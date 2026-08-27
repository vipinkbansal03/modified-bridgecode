"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Download,
  Plus,
  Edit2,
  Filter,
  Search,
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
  AdminStatsGrid,
  AdminListToolbar,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
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
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<SpreadsheetReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [bulkDeleting, setBulkDeleting] = useState(false);
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
      setBulkDeleting(true);
      return;
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

  const handleImportPreview = async (file: File) => {
    try {
      const formData = new FormData();
      formData.append("file", file);
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
      setImportMessage(getAdminErrorMessage(error, "Failed to preview discounts spreadsheet."));
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
      await importDiscounts.mutateAsync(formData);
      showToast("Discounts imported.");
      setImportFile(null);
      setImportReport(null);
      setImportMessage("");
      setImportOpen(false);
      refetch();
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
      width: "240px",
      render: (row) => (
        <div className="min-w-0 pr-3">
          <div className="font-semibold text-[#1A1A1A] text-[13px]">{row.name}</div>
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
          status={row.status}
          interactive={canUpdate}
          onClick={() => toggleStatus(row)}
          loading={updateDiscount.isPending && (updateDiscount.variables as any)?.id === row.id}
        />
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "90px",
      align: "left",
      render: (row) => (
        <div className="flex items-center justify-start gap-1">
          {canUpdate && (
            <button
              onClick={() => {
                form.reset(toForm(row));
                setShowForm(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs cursor-pointer"
              title="Edit discount"
            >
              <Edit2 size={13} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={() => setDeleting(row.id)}
              className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] transition-colors shadow-2xs cursor-pointer"
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
    if (column.key === "discount") return visibleColumns.discount;
    if (column.key === "condition") return visibleColumns.condition;
    if (column.key === "country") return visibleColumns.country;
    if (column.key === "dates") return visibleColumns.dates;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "actions") return visibleColumns.actions;
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
            <div className="grid grid-cols-2 gap-4">
              <AdminInput
                label="Minimum Quantity"
                type="text"
                inputMode="numeric"
                {...form.getFieldProps("minQuantity")}
                error={form.errors.minQuantity as string}
              />
              <AdminInput
                label="Maximum Quantity (Optional)"
                type="text"
                inputMode="numeric"
                {...form.getFieldProps("maxQuantity")}
                error={form.errors.maxQuantity as string}
              />
            </div>
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
          className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2] cursor-pointer"
        >
          Cancel
        </button>
        <LoadingButton
          type="submit"
          loading={form.isSubmitting || createDiscount.isPending || updateDiscount.isPending}
          loadingText="Processing..."
          className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] cursor-pointer"
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

      <div className="space-y-5">
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
            activeCount: [status, typeFilter, scopeFilter, countryFilter, sortBy !== "createdAt" ? sortBy : ""].filter(Boolean).length,
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
                  label: "Create Discount",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          filterPanel={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  resetPage();
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[130px]"
              >
                <option value="">All Statuses</option>
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
              <select
                value={typeFilter}
                onChange={(event) => {
                  setTypeFilter(event.target.value);
                  resetPage();
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[130px]"
              >
                <option value="">All Types</option>
                <option value="TIER">Tier-based</option>
                <option value="MOQ">MOQ-based</option>
                <option value="PROMOTIONAL">Open promotion</option>
              </select>
              <select
                value={scopeFilter}
                onChange={(event) => {
                  setScopeFilter(event.target.value);
                  resetPage();
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[130px]"
              >
                <option value="">All Scopes</option>
                <option value="PLATFORM">Platform-wide</option>
                <option value="PRODUCT">Product</option>
                <option value="COLLECTION">Collection</option>
                <option value="CATEGORY">Category</option>
              </select>
              <select
                value={countryFilter}
                onChange={(event) => {
                  setCountryFilter(event.target.value);
                  resetPage();
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[140px]"
              >
                <option value="">All Countries</option>
                {options.countries.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <select
                value={String(sortBy)}
                onChange={(event) => setSortBy(event.target.value)}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[140px]"
              >
                <option value="createdAt">Created date</option>
                <option value="updatedAt">Updated date</option>
                <option value="name">Rule name</option>
                <option value="type">Type</option>
                <option value="status">Status</option>
              </select>
              <select
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[120px]"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
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
          onToggleStatus={canUpdate ? toggleStatus : undefined}
          statusLoadingId={updateDiscount.isPending ? ((updateDiscount.variables as any)?.id ?? null) : null}
          isStatusDisabled={() => !canUpdate}
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

      {/* CREATE / EDIT DISCOUNT MODAL */}
      <Modal
        open={showForm}
        onClose={resetForm}
        title={form.values.id ? "Edit Discount" : "New Discount"}
        panelClassName="max-w-5xl flex flex-col max-h-[90vh] overflow-hidden z-[9999]"
      >
        {showForm ? discountForm : null}
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
        title="Import Discounts Spreadsheet"
        panelClassName="max-w-2xl"
      >
        <div className="space-y-4">
          <p className="text-[13px] text-[#6B6B6B]">
            Upload an Excel (.xlsx, .xls) or CSV spreadsheet to create or update discount rules in bulk.
          </p>

          <div className="rounded-lg border-2 border-dashed border-[#E6E6E6] bg-[#FAFAFA] p-6 text-center hover:bg-[#F5F5F5] transition-colors">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              id="discount-import-file"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setImportFile(file);
                  void handleImportPreview(file);
                }
              }}
            />
            <label htmlFor="discount-import-file" className="cursor-pointer">
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

          {previewDiscountImport.isPending && (
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

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-[#E6E6E6]">
            <button
              type="button"
              onClick={() => {
                setImportOpen(false);
                setImportFile(null);
                setImportReport(null);
                setImportMessage("");
              }}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#555] hover:bg-[#F2F2F2] cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={handleImport}
              loading={importing || importDiscounts.isPending}
              loadingText="Importing..."
              disabled={!importFile || (importReport !== null && importReport.invalidRows > 0)}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 cursor-pointer"
            >
              Import Discounts
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* CONFIRM DELETE MODALS */}
      <ConfirmModal
        open={!!deleting}
        title="Delete discount?"
        message="This discount rule will be deleted and will immediately stop applying to quotes, orders, and carts."
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteDiscount.isPending}
      />

      <ConfirmModal
        open={bulkDeleting}
        title="Delete selected discounts?"
        message={`Are you sure you want to permanently delete the ${selectedIds.length} selected discount rule(s)? This action cannot be undone.`}
        onConfirm={() => runBulkAction("DELETE")}
        onCancel={() => setBulkDeleting(false)}
        isLoading={bulkDiscounts.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
