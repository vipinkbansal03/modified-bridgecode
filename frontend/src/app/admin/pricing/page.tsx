"use client";

import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  Eye,
  Filter,
  FolderSymlink,
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
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  Pagination,
  StatCard,
  StatusBadge,
  useToast,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCountries,
  useAdminCustomerRoles,
  useAdminPricing,
  useAdminPricingDashboard,
  useAdminProduct,
  useAdminProducts,
  useAdminTiers,
  useBulkPricing,
  useCreatePricing,
  useDeletePricing,
  useExportPricing,
  useImportPricing,
  usePreviewPricing,
  usePreviewPricingImport,
  useUpdatePricing,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type PricingRuleType = "ALL" | "BASE_PRICE" | "VARIANT_PRICE" | "TIER_PRICE" | "MOQ_PRICE" | "CUSTOMER_ROLE_PRICE";
type PricingStatusFilter = "ALL" | "ACTIVE" | "INACTIVE";
type PricingSortBy = "updatedAt" | "createdAt" | "ruleName" | "ruleType" | "product" | "country" | "tier" | "basePrice" | "status";
type PricingSortDir = "desc" | "asc";

type PricingRuleRow = {
  id: string;
  ruleType: Exclude<PricingRuleType, "ALL">;
  ruleName: string;
  productId: string;
  variantId: string | null;
  countryId: string | null;
  tierId: string | null;
  moq: number | null;
  status: "ACTIVE" | "INACTIVE";
  customerRole: string | null;
  basePrice: number | null;
  discount: number | null;
  priority: number;
  createdAt: string;
  updatedAt: string;
  createdBy: string | null;
  product: { id: string; title: string; sku: string | null };
  variant: { id: string; title: string; sku: string | null } | null;
  country: { id: string; name: string; code: string } | null;
  tier: { id: string; name: string } | null;
  details?: {
    currency?: { id: string; code: string; symbol: string } | null;
    mrp?: number | null;
    sellingPrice?: number | null;
    discountPercent?: number | null;
    fixedPrice?: number | null;
    fixedAmount?: number | null;
    minQuantity?: number | null;
    dealerPrice?: number | null;
    distributorPrice?: number | null;
  };
};

type PricingDashboard = {
  totalRules: number;
  activeRules: number;
  inactiveRules: number;
  countryPricingRules: number;
  tierPricingRules: number;
  moqPricingRules: number;
  variantPricingRules: number;
  customerSpecificPricing: number;
  recentlyUpdatedRules: PricingRuleRow[];
};

type PricingPreviewResult = {
  basePrice: number;
  appliedDiscounts: Array<{
    type: string;
    label: string;
    amountBefore: number;
    amountAfter: number;
    discountPercent?: number | null;
    fixedPrice?: number | null;
    fixedAmount?: number | null;
    taxPercent?: number | null;
    taxAmount?: number | null;
    warning?: string;
  }>;
  priceBeforeTax: number;
  taxAmount: number;
  finalPrice: number;
  currency: { id: string; code: string; symbol: string };
};

type PricingFormState = {
  id: string;
  ruleType: Exclude<PricingRuleType, "ALL">;
  productId: string;
  variantId: string;
  countryId: string;
  tierId: string;
  customerRoleKey: string;
  mrp: string;
  sellingPrice: string;
  dealerPrice: string;
  distributorPrice: string;
  discountPercent: string;
  fixedPrice: string;
  minQuantity: string;
  status: "ACTIVE" | "INACTIVE";
};

type PreviewFormState = {
  productId: string;
  variantId: string;
  countryId: string;
  customerRoleKey: string;
  tierId: string;
  quantity: string;
};

type CustomerRoleOption = {
  id: string;
  key: string;
  name: string;
  status?: string;
};

const emptyForm: PricingFormState = {
  id: "",
  ruleType: "BASE_PRICE",
  productId: "",
  variantId: "",
  countryId: "",
  tierId: "",
  customerRoleKey: "",
  mrp: "",
  sellingPrice: "",
  dealerPrice: "",
  distributorPrice: "",
  discountPercent: "",
  fixedPrice: "",
  minQuantity: "1",
  status: "ACTIVE",
};

const emptyPreview: PreviewFormState = {
  productId: "",
  variantId: "",
  countryId: "",
  customerRoleKey: "",
  tierId: "",
  quantity: "1",
};

const ruleTypeLabels: Record<Exclude<PricingRuleType, "ALL">, string> = {
  BASE_PRICE: "Base Price",
  VARIANT_PRICE: "Variant Pricing",
  TIER_PRICE: "Tier Pricing",
  MOQ_PRICE: "MOQ Pricing",
  CUSTOMER_ROLE_PRICE: "Customer Role Pricing",
};

const defaultColumnVisibility = {
  ruleName: true,
  ruleType: true,
  product: true,
  variant: true,
  country: true,
  customerRole: true,
  tier: true,
  moq: true,
  basePrice: true,
  discount: true,
  priority: true,
  status: true,
  createdBy: true,
  updatedAt: true,
};

function formatMoney(value: number | null | undefined, currencySymbol?: string | null) {
  if (value == null) return "—";
  const prefix = currencySymbol ?? "";
  return `${prefix}${Number(value).toFixed(2)}`;
}

function toNumberOrEmpty(value: string) {
  if (value.trim() === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function ruleResolutionOrder(ruleType: PricingRuleType) {
  switch (ruleType) {
    case "CUSTOMER_ROLE_PRICE":
      return 1;
    case "TIER_PRICE":
      return 2;
    case "BASE_PRICE":
      return 3;
    case "VARIANT_PRICE":
      return 4;
    case "MOQ_PRICE":
      return 5;
    default:
      return 99;
  }
}

function getCustomerRoleLabel(key: string | null) {
  switch (key) {
    case "guest":
      return "Guest";
    case "dealer":
      return "Dealer";
    case "doctor-retailer":
      return "Doctor / Retailer";
    default:
      return key || "—";
  }
}

export default function PricingPage() {
  const { showToast, ToastComponent } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<PricingStatusFilter>("ALL");
  const [ruleTypeFilter, setRuleTypeFilter] = useState<PricingRuleType>("ALL");
  const [countryFilter, setCountryFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [productFilter, setProductFilter] = useState("");
  const [variantFilter, setVariantFilter] = useState("");
  const [minQuantityFilter, setMinQuantityFilter] = useState("");
  const [sortBy, setSortBy] = useState<PricingSortBy>("updatedAt");
  const [sortDir, setSortDir] = useState<PricingSortDir>("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [columnVisibility, setColumnVisibility] = useState(defaultColumnVisibility);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<PricingFormState>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<PricingRuleRow | null>(null);
  const [bulkCountryId, setBulkCountryId] = useState("");
  const [bulkTierId, setBulkTierId] = useState("");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importReport, setImportReport] = useState<unknown>(null);
  const [previewInput, setPreviewInput] = useState<PreviewFormState>(emptyPreview);

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminPricingDashboard();
  const { data: pricingResponse, isLoading: pricingLoading, refetch } = useAdminPricing({
    page,
    limit,
    search: search || undefined,
    status: statusFilter === "ALL" ? undefined : statusFilter,
    ruleType: ruleTypeFilter === "ALL" ? undefined : ruleTypeFilter,
    countryId: countryFilter || undefined,
    tierId: tierFilter || undefined,
    productId: productFilter || undefined,
    variantId: variantFilter || undefined,
    minQuantity: minQuantityFilter || undefined,
    sortBy,
    sortDir,
    ids: selectedIds.length ? selectedIds : undefined,
  });
  const { data: countries = [] } = useAdminCountries();
  const { data: tiers = [] } = useAdminTiers();
  const { data: customerRoles = [] } = useAdminCustomerRoles();
  const { data: productsData } = useAdminProducts({ page: 1, limit: 100, search: productFilter || undefined });
  const { data: filterProduct } = useAdminProduct(productFilter);
  const { data: selectedProduct } = useAdminProduct(form.productId);
  const { data: previewData, isFetching: previewLoading, error: previewError } = usePreviewPricing(
    previewInput.productId && previewInput.countryId
      ? {
          productId: previewInput.productId,
          variantId: previewInput.variantId || undefined,
          countryId: previewInput.countryId,
          customerRoleKey: previewInput.customerRoleKey || undefined,
          tierId: previewInput.tierId || undefined,
          quantity: Number(previewInput.quantity || 1),
        }
      : undefined,
  );
  const previewImport = usePreviewPricingImport();
  const importPricing = useImportPricing();
  const exportPricing = useExportPricing();
  const createPricing = useCreatePricing();
  const updatePricing = useUpdatePricing();
  const deletePricing = useDeletePricing();
  const bulkPricing = useBulkPricing();

  const products = (productsData?.data ?? []) as Array<{ id: string; title: string; sku?: string | null; status?: string }>;
  const customerRoleRows = customerRoles as CustomerRoleOption[];
  const ruleRows = (pricingResponse?.data ?? []) as PricingRuleRow[];
  const pagination = pricingResponse?.pagination ?? { page, limit, total: 0, totalPages: 1 };
  const dashboard = dashboardData?.data as PricingDashboard | undefined;
  const selectedRuleType = selectedIds.length
    ? ruleRows.find((row) => selectedIds.includes(row.id))?.ruleType ?? null
    : null;
  const bulkActionFamily = selectedRuleType === "TIER_PRICE" || selectedRuleType === "MOQ_PRICE" ? "rule-only" : "base";
  const customerRoleOptions = useMemo(
    () => [
      { value: "", label: "None / Any" },
      ...customerRoleRows.map((role) => ({
        value: role.key,
        label: `${role.name} (${role.key})`,
      })),
    ],
    [customerRoleRows],
  );
  const previewCustomerRoleOptions = useMemo(
    () => [
      { value: "", label: "Auto from customer" },
      ...customerRoleRows.map((role) => ({
        value: role.key,
        label: `${role.name} (${role.key})`,
      })),
    ],
    [customerRoleRows],
  );

  useEffect(() => {
    if (countries.length && !previewInput.countryId) {
      setPreviewInput((current) => ({ ...current, countryId: countries[0].id }));
    }
  }, [countries, previewInput.countryId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, search, statusFilter, ruleTypeFilter, countryFilter, tierFilter, productFilter, variantFilter, minQuantityFilter, sortBy, sortDir]);

  useEffect(() => {
    if (!form.productId) return;
    const product = selectedProduct?.data ?? selectedProduct;
    const variants = (product?.variants ?? []) as Array<{ id: string }>;
    if (form.variantId && !variants.some((variant) => variant.id === form.variantId)) {
      setForm((current) => ({ ...current, variantId: "" }));
    }
  }, [form.productId, form.variantId, selectedProduct]);

  const countryOptions = [
    { value: "", label: "All countries" },
    ...countries.map((country: { id: string; name: string; code: string }) => ({
      value: country.id,
      label: `${country.name} (${country.code})`,
    })),
  ];

  const tierOptions = [
    { value: "", label: "All tiers" },
    ...tiers.map((tier: { id: string; name: string }) => ({
      value: tier.id,
      label: tier.name,
    })),
  ];

  const productOptions = [
    { value: "", label: "All products" },
    ...products.map((product) => ({
      value: product.id,
      label: product.sku ? `${product.title} (${product.sku})` : product.title,
    })),
  ];

  const selectedProductData = selectedProduct?.data ?? selectedProduct;
  const filterProductData = filterProduct?.data ?? filterProduct;
  const variantOptions = useMemo(() => {
    const variants = (selectedProductData?.variants ?? []) as Array<{ id: string; title: string; sku?: string | null; status?: string }>;
    return [
      { value: "", label: "Product level" },
      ...variants.map((variant) => ({
        value: variant.id,
        label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title,
      })),
    ];
  }, [selectedProductData]);

  const previewProduct = useAdminProduct(previewInput.productId);
  const previewProductData = previewProduct?.data?.data ?? previewProduct?.data ?? selectedProductData;
  const previewVariantOptions = useMemo(() => {
    const variants = (previewProductData?.variants ?? []) as Array<{ id: string; title: string; sku?: string | null }>;
    return [
      { value: "", label: "Product level" },
      ...variants.map((variant) => ({
        value: variant.id,
        label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title,
      })),
    ];
  }, [previewProductData]);

  const resetForm = () => {
    setForm(emptyForm);
    setShowForm(false);
  };

  const openCreateForm = (ruleType: Exclude<PricingRuleType, "ALL"> = "BASE_PRICE") => {
    setForm({ ...emptyForm, ruleType });
    setShowForm(true);
  };

  const openEditForm = (row: PricingRuleRow) => {
    setForm({
      id: row.id,
      ruleType: row.ruleType,
      productId: row.productId,
      variantId: row.variantId ?? "",
      countryId: row.countryId ?? "",
      tierId: row.tierId ?? "",
      customerRoleKey: row.customerRole ?? "",
      mrp: row.details?.mrp != null ? String(row.details.mrp) : "",
      sellingPrice: row.details?.sellingPrice != null ? String(row.details.sellingPrice) : "",
      dealerPrice: row.details?.dealerPrice != null ? String(row.details.dealerPrice) : "",
      distributorPrice: row.details?.distributorPrice != null ? String(row.details.distributorPrice) : "",
      discountPercent: row.details?.discountPercent != null ? String(row.details.discountPercent) : "",
      fixedPrice: row.details?.fixedPrice != null ? String(row.details.fixedPrice) : "",
      minQuantity: row.details?.minQuantity != null ? String(row.details.minQuantity) : row.moq != null ? String(row.moq) : "1",
      status: row.status,
    });
    setShowForm(true);
  };

  const cloneRuleToForm = (row: PricingRuleRow) => {
    openEditForm({ ...row, id: "", status: "INACTIVE" });
    showToast("Rule copied into the editor. Adjust any conflicting fields before saving.", "info");
  };

  const validateForm = () => {
    if (!form.productId) return "Product is required.";
    if (!form.countryId) return "Country is required.";

    if (form.ruleType === "BASE_PRICE" || form.ruleType === "VARIANT_PRICE" || form.ruleType === "CUSTOMER_ROLE_PRICE") {
      if (form.ruleType === "CUSTOMER_ROLE_PRICE" && !form.customerRoleKey) return "Customer role is required.";
      if (form.mrp === "" || form.sellingPrice === "") return "MRP and selling price are required.";
      if (Number(form.mrp) < 0 || Number(form.sellingPrice) < 0) return "Prices cannot be negative.";
      if (form.dealerPrice && Number(form.dealerPrice) < 0) return "Prices cannot be negative.";
      if (form.distributorPrice && Number(form.distributorPrice) < 0) return "Prices cannot be negative.";
      return null;
    }

    if (form.ruleType === "TIER_PRICE") {
      if (!form.tierId) return "Tier is required.";
      if (form.discountPercent === "" && form.fixedPrice === "") return "Provide either a discount percent or a fixed price.";
      if (form.discountPercent !== "" && Number(form.discountPercent) < 0) return "Discount cannot be negative.";
      if (form.fixedPrice !== "" && Number(form.fixedPrice) < 0) return "Fixed price cannot be negative.";
      return null;
    }

    if (form.ruleType === "MOQ_PRICE") {
      if (form.minQuantity === "" || Number(form.minQuantity) < 1) return "MOQ must be at least 1.";
      if (form.discountPercent === "" && form.fixedPrice === "") return "Provide either a discount percent or a fixed price.";
      if (form.discountPercent !== "" && Number(form.discountPercent) < 0) return "Discount cannot be negative.";
      if (form.fixedPrice !== "" && Number(form.fixedPrice) < 0) return "Fixed price cannot be negative.";
      return null;
    }

    return null;
  };

  const saveRule = async () => {
    const validationMessage = validateForm();
    if (validationMessage) {
      showToast(validationMessage, "error");
      return;
    }

    const productId = form.productId;
    const variantId = form.variantId || null;
    const countryId = form.countryId;
    const status = form.status;

    try {
      if (form.ruleType === "BASE_PRICE" || form.ruleType === "VARIANT_PRICE" || form.ruleType === "CUSTOMER_ROLE_PRICE") {
        const selectedCountry = countries.find((country: { id: string; currencyId?: string }) => country.id === countryId);
        if (!selectedCountry?.currencyId) {
          showToast("The selected country does not have a currency assigned.", "error");
          return;
        }

        const payload = {
          productId,
          variantId,
          countryId,
          customerRoleKey: form.ruleType === "CUSTOMER_ROLE_PRICE" ? form.customerRoleKey : null,
          currencyId: selectedCountry.currencyId,
          mrp: Number(form.mrp),
          sellingPrice: Number(form.sellingPrice),
          dealerPrice: form.dealerPrice === "" ? null : Number(form.dealerPrice),
          distributorPrice: form.distributorPrice === "" ? null : Number(form.distributorPrice),
          status,
        };

        if (form.id) {
          await updatePricing.mutateAsync({ id: form.id, ...payload });
          showToast("Pricing rule updated.", "success");
        } else {
          await createPricing.mutateAsync(payload);
          showToast("Pricing rule created.", "success");
        }
      } else if (form.ruleType === "TIER_PRICE") {
        const payload = {
          productId,
          variantId,
          countryId,
          tierId: form.tierId,
          discountPercent: form.discountPercent === "" ? null : Number(form.discountPercent),
          fixedPrice: form.fixedPrice === "" ? null : Number(form.fixedPrice),
          status,
        };
        if (form.id) {
          await adminApi.put(`/pricing/${productId}/tier-pricing/${form.id}`, payload);
          showToast("Tier pricing rule updated.", "success");
        } else {
          await adminApi.post(`/pricing/${productId}/tier-pricing`, payload);
          showToast("Tier pricing rule created.", "success");
        }
      } else if (form.ruleType === "MOQ_PRICE") {
        const payload = {
          productId,
          variantId,
          countryId,
          minQuantity: Number(form.minQuantity),
          discountPercent: form.discountPercent === "" ? null : Number(form.discountPercent),
          fixedPrice: form.fixedPrice === "" ? null : Number(form.fixedPrice),
          status,
        };
        if (form.id) {
          await adminApi.put(`/pricing/${productId}/moq-pricing/${form.id}`, payload);
          showToast("MOQ pricing rule updated.", "success");
        } else {
          await adminApi.post(`/pricing/${productId}/moq-pricing`, payload);
          showToast("MOQ pricing rule created.", "success");
        }
      }

      await refetch();
      resetForm();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save pricing rule."), "error");
    }
  };

  const handleDelete = async (row: PricingRuleRow) => {
    try {
      if (row.ruleType === "TIER_PRICE") {
        await adminApi.delete(`/pricing/${row.productId}/tier-pricing/${row.id}`);
      } else if (row.ruleType === "MOQ_PRICE") {
        await adminApi.delete(`/pricing/${row.productId}/moq-pricing/${row.id}`);
      } else {
        await deletePricing.mutateAsync(row.id);
      }
      showToast("Pricing rule deleted.", "success");
      setDeleteTarget(null);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete pricing rule."), "error");
    }
  };

  const toggleSelected = (id: string, checked: boolean) => {
    setSelectedIds((current) => (checked ? Array.from(new Set([...current, id])) : current.filter((item) => item !== id)));
  };

  const runBulkAction = async (action: "ENABLE" | "DISABLE" | "DELETE") => {
    if (!selectedIds.length) {
      showToast("Select at least one rule first.", "error");
      return;
    }
    if (!selectedRuleType) {
      showToast("Bulk actions require rules from the same type.", "error");
      return;
    }
    if (bulkActionFamily !== "base" && action !== "DELETE") {
      showToast("This rule type only supports bulk delete and reassignment.", "error");
      return;
    }

    try {
      await bulkPricing.mutateAsync({
        ids: selectedIds,
        ruleType: selectedRuleType,
        action,
        countryId: bulkCountryId || null,
        tierId: bulkTierId || null,
      });
      showToast("Bulk action completed.", "success");
      setSelectedIds([]);
      setBulkCountryId("");
      setBulkTierId("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const handleExport = async (selectedOnly: boolean) => {
    try {
      if (selectedOnly && !selectedIds.length) {
        showToast("Select at least one rule to export selected.", "error");
        return;
      }
      const blob = await exportPricing.mutateAsync(
        selectedOnly
          ? { ids: selectedIds.join(",") }
          : {
              search: search || undefined,
              status: statusFilter === "ALL" ? undefined : statusFilter,
              ruleType: ruleTypeFilter === "ALL" ? undefined : ruleTypeFilter,
              countryId: countryFilter || undefined,
              tierId: tierFilter || undefined,
              productId: productFilter || undefined,
              variantId: variantFilter || undefined,
              minQuantity: minQuantityFilter || undefined,
              sortBy,
              sortDir,
            },
      );
      const url = window.URL.createObjectURL(blob as Blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pricing-export.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      showToast("Pricing export downloaded.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export pricing."), "error");
    }
  };

  const handleImportPreview = async () => {
    if (!importFile) {
      showToast("Choose an Excel file first.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const report = await previewImport.mutateAsync(formData);
      setImportReport(report);
      showToast("Import preview generated.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to preview import."), "error");
    }
  };

  const handleImportCommit = async () => {
    if (!importFile) {
      showToast("Choose an Excel file first.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      await importPricing.mutateAsync(formData);
      showToast("Pricing imported successfully.", "success");
      setImportFile(null);
      setImportReport(null);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import pricing."), "error");
    }
  };

  const columns = [
    { key: "ruleName", label: "Rule Name" },
    { key: "ruleType", label: "Rule Type" },
    { key: "product", label: "Product" },
    { key: "variant", label: "Variant" },
    { key: "country", label: "Country" },
    { key: "customerRole", label: "Customer Role" },
    { key: "tier", label: "Tier" },
    { key: "moq", label: "MOQ" },
    { key: "basePrice", label: "Base Price" },
    { key: "discount", label: "Discount" },
    { key: "priority", label: "Priority" },
    { key: "status", label: "Status" },
    { key: "createdBy", label: "Created By" },
    { key: "updatedAt", label: "Updated Date" },
  ] as const;

  const visibleColumns = columns.filter((column) => columnVisibility[column.key as keyof typeof columnVisibility]);

  const resolutionPreview = previewData as PricingPreviewResult | undefined;

  return (
    <AdminLayout title="Pricing" breadcrumb={[{ label: "Pricing" }]}>
      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard title="Total Pricing Rules" value={dashboard?.totalRules ?? 0} subtitle="All active pricing records" icon={<SquareCheckBig size={18} />} isLoading={dashboardLoading} />
        <StatCard title="Active Rules" value={dashboard?.activeRules ?? 0} subtitle="Ready to resolve in checkout" icon={<CheckCircle2 size={18} />} color="bg-emerald-500" isLoading={dashboardLoading} />
        <StatCard title="Inactive Rules" value={dashboard?.inactiveRules ?? 0} subtitle="Disabled or archived" icon={<Trash2 size={18} />} color="bg-slate-500" isLoading={dashboardLoading} />
        <StatCard title="Recently Updated" value={dashboard?.recentlyUpdatedRules?.length ?? 0} subtitle="Latest touched rules" icon={<RefreshCw size={18} />} color="bg-[#E31E24]" isLoading={dashboardLoading} />
      </div>

      <div className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <StatCard title="Country Pricing" value={dashboard?.countryPricingRules ?? 0} icon={<FolderSymlink size={18} />} isLoading={dashboardLoading} />
        <StatCard title="Tier Pricing" value={dashboard?.tierPricingRules ?? 0} icon={<Filter size={18} />} color="bg-[#0F766E]" isLoading={dashboardLoading} />
        <StatCard title="MOQ Pricing" value={dashboard?.moqPricingRules ?? 0} icon={<SlidersHorizontal size={18} />} color="bg-[#2563EB]" isLoading={dashboardLoading} />
        <StatCard title="Variant Pricing" value={dashboard?.variantPricingRules ?? 0} icon={<Eye size={18} />} color="bg-[#7C3AED]" isLoading={dashboardLoading} />
        <StatCard title="Customer Specific" value={dashboard?.customerSpecificPricing ?? 0} icon={<CheckCircle2 size={18} />} color="bg-[#0EA5E9]" isLoading={dashboardLoading} />
      </div>

      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E6E6E6] bg-white p-4">
        <div>
          <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Pricing Administration</h2>
          <p className="mt-1 text-[12.5px] text-[#6B6B6B]">
            Reuses the existing resolver, product, variant, customer role, tier, country, MOQ, quote, and checkout pricing stack.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => setShowFilters((current) => !current)} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
            <Filter size={14} /> Filters
          </button>
          <button type="button" onClick={() => setShowColumnPanel((current) => !current)} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
            <SlidersHorizontal size={14} /> Columns
          </button>
          <button type="button" onClick={() => openCreateForm("BASE_PRICE")} className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
            <Plus size={14} /> New Pricing Rule
          </button>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_420px]">
        <div className="space-y-5">
          {showFilters ? (
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Search and Filters</h3>
                  <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Search, filter, and sort across the existing pricing tables.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatusFilter("ALL");
                    setRuleTypeFilter("ALL");
                    setCountryFilter("");
                    setTierFilter("");
                    setProductFilter("");
                    setVariantFilter("");
                    setMinQuantityFilter("");
                    setSortBy("updatedAt");
                    setSortDir("desc");
                    setPage(1);
                  }}
                  className="text-[13px] font-medium text-[#E31E24] hover:underline"
                >
                  Reset
                </button>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <AdminInput label="Search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Rule, product, country, tier" />
                <AdminSelect
                  label="Rule Type"
                  value={ruleTypeFilter}
                  onChange={(event) => {
                    setRuleTypeFilter(event.target.value as PricingRuleType);
                    setPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All rule types" },
                    ...Object.entries(ruleTypeLabels).map(([value, label]) => ({ value, label })),
                  ]}
                />
                <AdminSelect label="Status" value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value as PricingStatusFilter); setPage(1); }} options={[{ value: "ALL", label: "All statuses" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
                <AdminSelect label="Country" value={countryFilter} onChange={(event) => { setCountryFilter(event.target.value); setPage(1); }} options={countryOptions} />
                <AdminSelect label="Tier" value={tierFilter} onChange={(event) => { setTierFilter(event.target.value); setPage(1); }} options={tierOptions} />
                <AdminSelect label="Product" value={productFilter} onChange={(event) => { setProductFilter(event.target.value); setPage(1); }} options={productOptions} />
                <AdminSelect label="Variant" value={variantFilter} onChange={(event) => { setVariantFilter(event.target.value); setPage(1); }} options={[{ value: "", label: "All variants" }, ...(filterProductData?.variants ?? []).map((variant: { id: string; title: string; sku?: string | null }) => ({ value: variant.id, label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title }))]} />
                <AdminInput label="MOQ" type="number" min="1" value={minQuantityFilter} onChange={(event) => { setMinQuantityFilter(event.target.value); setPage(1); }} placeholder="Filter MOQ" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <AdminSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value as PricingSortBy)}
                  options={[
                    { value: "updatedAt", label: "Updated date" },
                    { value: "createdAt", label: "Created date" },
                    { value: "ruleName", label: "Rule name" },
                    { value: "ruleType", label: "Rule type" },
                    { value: "product", label: "Product" },
                    { value: "country", label: "Country" },
                    { value: "tier", label: "Tier" },
                    { value: "basePrice", label: "Base price" },
                    { value: "status", label: "Status" },
                  ]}
                />
                <AdminSelect
                  label="Direction"
                  value={sortDir}
                  onChange={(event) => setSortDir(event.target.value as PricingSortDir)}
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
                    setPage(1);
                  }}
                  options={[
                    { value: "10", label: "10" },
                    { value: "20", label: "20" },
                    { value: "50", label: "50" },
                    { value: "100", label: "100" },
                  ]}
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Pricing Rules</h3>
                <p className="mt-1 text-[12.5px] text-[#6B6B6B]">
                  {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select rows for bulk actions."}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => setSelectedIds(ruleRows.map((row) => row.id))} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  <CheckCircle2 size={14} /> Select page
                </button>
                <button type="button" onClick={() => setSelectedIds([])} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  <X size={14} /> Clear
                </button>
                <button type="button" onClick={() => handleExport(false)} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  <Download size={14} /> Export
                </button>
              </div>
            </div>

            {selectedIds.length > 0 ? (
              <div className="mb-4 flex flex-wrap items-center gap-2 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                <span className="text-[12.5px] font-medium text-[#1A1A1A]">Bulk actions</span>
                {bulkActionFamily === "base" ? (
                  <>
                    <button type="button" onClick={() => runBulkAction("ENABLE")} className="rounded-md border border-emerald-200 px-3 py-1.5 text-[12.5px] font-medium text-emerald-700 hover:bg-emerald-50">
                      Enable
                    </button>
                    <button type="button" onClick={() => runBulkAction("DISABLE")} className="rounded-md border border-amber-200 px-3 py-1.5 text-[12.5px] font-medium text-amber-700 hover:bg-amber-50">
                      Disable
                    </button>
                  </>
                ) : null}
                <button type="button" onClick={() => runBulkAction("DELETE")} className="rounded-md border border-red-200 px-3 py-1.5 text-[12.5px] font-medium text-red-700 hover:bg-red-50">
                  Delete
                </button>
                <div className="ml-auto grid gap-2 md:grid-cols-2">
                  <AdminSelect label="Bulk country assignment" value={bulkCountryId} onChange={(event) => setBulkCountryId(event.target.value)} options={countryOptions} />
                  <AdminSelect label="Bulk tier assignment" value={bulkTierId} onChange={(event) => setBulkTierId(event.target.value)} options={tierOptions} />
                </div>
              </div>
            ) : null}

            {showColumnPanel ? (
              <div className="mb-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3">
                <div className="mb-2 flex items-center gap-2 text-[13px] font-semibold text-[#1A1A1A]">
                  <SlidersHorizontal size={14} /> Column visibility
                </div>
                <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                  {Object.entries(columnVisibility).map(([key, visible]) => (
                    <label key={key} className="flex items-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A]">
                      <input
                        type="checkbox"
                        checked={visible}
                        onChange={(event) => setColumnVisibility((current) => ({ ...current, [key]: event.target.checked }))}
                        className="h-4 w-4 accent-[#E31E24]"
                      />
                      <span className="capitalize">{key.replace(/([A-Z])/g, " $1")}</span>
                    </label>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1320px] text-sm">
                <thead className="bg-[#F8F8F8]">
                  <tr className="border-b border-[#E6E6E6]">
                    <th className="px-3 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                      <input
                        type="checkbox"
                        checked={ruleRows.length > 0 && ruleRows.every((row) => selectedIds.includes(row.id))}
                        onChange={(event) => setSelectedIds(event.target.checked ? ruleRows.map((row) => row.id) : [])}
                        className="h-4 w-4 accent-[#E31E24]"
                        aria-label="Select all rows"
                      />
                    </th>
                    {visibleColumns.map((column) => (
                      <th key={column.key} className="px-3 py-3 text-left text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                        {column.label}
                      </th>
                    ))}
                    <th className="px-3 py-3 text-right text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {pricingLoading ? (
                    <tr>
                      <td colSpan={visibleColumns.length + 2} className="px-4 py-12 text-center text-[13px] text-[#9A9A9A]">
                        Loading pricing rules...
                      </td>
                    </tr>
                  ) : ruleRows.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumns.length + 2} className="px-4 py-12 text-center text-[13px] text-[#9A9A9A]">
                        No pricing rules found.
                      </td>
                    </tr>
                  ) : (
                    ruleRows.map((row) => {
                      const currencySymbol = row.details?.currency?.symbol ?? "";
                      return (
                        <tr key={row.id} className="hover:bg-[#FAFAFA]">
                          <td className="px-3 py-3 align-top">
                            <input
                              type="checkbox"
                              checked={selectedIds.includes(row.id)}
                              onChange={(event) => toggleSelected(row.id, event.target.checked)}
                              className="h-4 w-4 accent-[#E31E24]"
                              aria-label={`Select ${row.ruleName}`}
                            />
                          </td>
                          {columnVisibility.ruleName ? (
                            <td className="px-3 py-3 align-top">
                              <div className="font-medium text-[#1A1A1A]">{row.ruleName}</div>
                              <div className="text-[11.5px] text-[#9A9A9A]">Resolution order {ruleResolutionOrder(row.ruleType)}</div>
                            </td>
                          ) : null}
                          {columnVisibility.ruleType ? <td className="px-3 py-3 align-top">{ruleTypeLabels[row.ruleType]}</td> : null}
                          {columnVisibility.product ? (
                            <td className="px-3 py-3 align-top">
                              <div className="font-medium text-[#1A1A1A]">{row.product.title}</div>
                              <div className="text-[11.5px] text-[#9A9A9A]">{row.product.sku ?? "No SKU"}</div>
                            </td>
                          ) : null}
                          {columnVisibility.variant ? <td className="px-3 py-3 align-top">{row.variant ? row.variant.title : "Product level"}</td> : null}
                          {columnVisibility.country ? <td className="px-3 py-3 align-top">{row.country ? `${row.country.name} (${row.country.code})` : "—"}</td> : null}
                          {columnVisibility.customerRole ? <td className="px-3 py-3 align-top">{getCustomerRoleLabel(row.customerRole)}</td> : null}
                          {columnVisibility.tier ? <td className="px-3 py-3 align-top">{row.tier?.name ?? "—"}</td> : null}
                          {columnVisibility.moq ? <td className="px-3 py-3 align-top">{row.moq ?? "—"}</td> : null}
                          {columnVisibility.basePrice ? <td className="px-3 py-3 align-top">{formatMoney(row.basePrice, currencySymbol)}</td> : null}
                          {columnVisibility.discount ? (
                            <td className="px-3 py-3 align-top">
                              {row.details?.discountPercent != null
                                ? `${Number(row.details.discountPercent).toFixed(2)}%`
                                : row.discount != null
                                  ? formatMoney(row.discount, currencySymbol)
                                  : "—"}
                            </td>
                          ) : null}
                          {columnVisibility.priority ? <td className="px-3 py-3 align-top">{row.priority}</td> : null}
                          {columnVisibility.status ? <td className="px-3 py-3 align-top"><StatusBadge status={row.status} /></td> : null}
                          {columnVisibility.createdBy ? <td className="px-3 py-3 align-top">{row.createdBy ?? "—"}</td> : null}
                          {columnVisibility.updatedAt ? (
                            <td className="px-3 py-3 align-top">
                              {new Date(row.updatedAt).toLocaleDateString(undefined, {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </td>
                          ) : null}
                          <td className="px-3 py-3 align-top text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button type="button" onClick={() => openEditForm(row)} className="rounded-md border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                                Edit
                              </button>
                              <button type="button" onClick={() => cloneRuleToForm(row)} className="rounded-md border border-[#E6E6E6] px-2 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                                Clone
                              </button>
                              <button type="button" onClick={() => setDeleteTarget(row)} className="rounded-md border border-red-200 px-2 py-1.5 text-[12.5px] font-medium text-red-700 hover:bg-red-50">
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            <Pagination page={pagination.page} totalPages={pagination.totalPages ?? 1} onPageChange={setPage} />
          </div>
        </div>

        <div className="space-y-5">
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Live Pricing Preview</h3>
                <p className="mt-1 text-[12.5px] text-[#6B6B6B]">This calls the existing resolver, so what you see here matches checkout and quote pricing.</p>
              </div>
              <button type="button" onClick={() => setPreviewInput(emptyPreview)} className="text-[12.5px] font-medium text-[#E31E24] hover:underline">
                Reset
              </button>
            </div>

            <div className="grid gap-3">
              <AdminSelect
                label="Product"
                value={previewInput.productId}
                onChange={(event) => setPreviewInput((current) => ({ ...current, productId: event.target.value, variantId: "" }))}
                options={productOptions}
              />
              <AdminSelect
                label="Variant"
                value={previewInput.variantId}
                onChange={(event) => setPreviewInput((current) => ({ ...current, variantId: event.target.value }))}
                options={previewVariantOptions}
              />
              <AdminSelect
                label="Country"
                value={previewInput.countryId}
                onChange={(event) => setPreviewInput((current) => ({ ...current, countryId: event.target.value }))}
                options={countryOptions}
              />
              <AdminSelect
                label="Customer Role"
                value={previewInput.customerRoleKey}
                onChange={(event) => setPreviewInput((current) => ({ ...current, customerRoleKey: event.target.value }))}
                options={previewCustomerRoleOptions}
              />
              <AdminSelect
                label="Tier"
                value={previewInput.tierId}
                onChange={(event) => setPreviewInput((current) => ({ ...current, tierId: event.target.value }))}
                options={tierOptions}
              />
              <AdminInput label="Quantity" type="number" min="1" value={previewInput.quantity} onChange={(event) => setPreviewInput((current) => ({ ...current, quantity: event.target.value }))} />
            </div>

            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              {previewLoading ? (
                <p className="text-[13px] text-[#6B6B6B]">Loading preview...</p>
              ) : previewError ? (
                <p className="text-[13px] text-red-600">{getAdminErrorMessage(previewError, "Preview failed.")}</p>
              ) : resolutionPreview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Base price</div>
                      <div className="text-[15px] font-semibold text-[#1A1A1A]">{formatMoney(resolutionPreview.basePrice, resolutionPreview.currency.symbol)}</div>
                    </div>
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Final price</div>
                      <div className="text-[15px] font-semibold text-[#E31E24]">{formatMoney(resolutionPreview.finalPrice, resolutionPreview.currency.symbol)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Applied rules</div>
                    <ul className="mt-2 space-y-2">
                      {resolutionPreview.appliedDiscounts.map((layer, index) => (
                        <li key={`${layer.type}-${index}`} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] text-[#1A1A1A]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{layer.label}</span>
                            <span className="text-[#6B6B6B]">{formatMoney(layer.amountAfter, resolutionPreview.currency.symbol)}</span>
                          </div>
                          {layer.warning ? <div className="mt-1 text-[11.5px] text-amber-700">{layer.warning}</div> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[#9A9A9A]">Tax</div>
                      <div className="font-medium">{formatMoney(resolutionPreview.taxAmount, resolutionPreview.currency.symbol)}</div>
                    </div>
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[#9A9A9A]">Resolution order</div>
                      <div className="font-medium">Resolver hierarchy enforced server-side</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#6B6B6B]">Choose product and country to preview the final price.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Live Preview</h3>
                <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Resolver-backed pricing check for the exact customer journey.</p>
              </div>
              <button type="button" onClick={() => setPreviewInput(emptyPreview)} className="text-[12.5px] font-medium text-[#E31E24] hover:underline">
                Reset
              </button>
            </div>
            <div className="grid gap-3">
              <AdminSelect label="Product" value={previewInput.productId} onChange={(event) => setPreviewInput((current) => ({ ...current, productId: event.target.value, variantId: "" }))} options={productOptions} />
              <AdminSelect label="Variant" value={previewInput.variantId} onChange={(event) => setPreviewInput((current) => ({ ...current, variantId: event.target.value }))} options={previewVariantOptions} />
              <AdminSelect label="Country" value={previewInput.countryId} onChange={(event) => setPreviewInput((current) => ({ ...current, countryId: event.target.value }))} options={countryOptions} />
              <AdminSelect
                label="Customer Role"
                value={previewInput.customerRoleKey}
                onChange={(event) => setPreviewInput((current) => ({ ...current, customerRoleKey: event.target.value }))}
                options={previewCustomerRoleOptions}
              />
              <AdminSelect label="Tier" value={previewInput.tierId} onChange={(event) => setPreviewInput((current) => ({ ...current, tierId: event.target.value }))} options={tierOptions} />
              <AdminInput label="Quantity" type="number" min="1" value={previewInput.quantity} onChange={(event) => setPreviewInput((current) => ({ ...current, quantity: event.target.value }))} />
            </div>
            <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              {previewLoading ? (
                <p className="text-[13px] text-[#6B6B6B]">Loading preview...</p>
              ) : previewError ? (
                <p className="text-[13px] text-red-600">{getAdminErrorMessage(previewError, "Preview failed.")}</p>
              ) : resolutionPreview ? (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Base price</div>
                      <div className="text-[15px] font-semibold text-[#1A1A1A]">{formatMoney(resolutionPreview.basePrice, resolutionPreview.currency.symbol)}</div>
                    </div>
                    <div>
                      <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Final price</div>
                      <div className="text-[15px] font-semibold text-[#E31E24]">{formatMoney(resolutionPreview.finalPrice, resolutionPreview.currency.symbol)}</div>
                    </div>
                  </div>
                  <div>
                    <div className="text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">Applied rules</div>
                    <ul className="mt-2 space-y-2">
                      {resolutionPreview.appliedDiscounts.map((layer, index) => (
                        <li key={`${layer.type}-${index}`} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] text-[#1A1A1A]">
                          <div className="flex items-center justify-between gap-3">
                            <span className="font-medium">{layer.label}</span>
                            <span className="text-[#6B6B6B]">{formatMoney(layer.amountAfter, resolutionPreview.currency.symbol)}</span>
                          </div>
                          {layer.warning ? <div className="mt-1 text-[11.5px] text-amber-700">{layer.warning}</div> : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-[12.5px]">
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[#9A9A9A]">Tax</div>
                      <div className="font-medium">{formatMoney(resolutionPreview.taxAmount, resolutionPreview.currency.symbol)}</div>
                    </div>
                    <div className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2">
                      <div className="text-[#9A9A9A]">Resolution order</div>
                      <div className="font-medium">Resolver hierarchy enforced server-side</div>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-[13px] text-[#6B6B6B]">Choose product and country to preview the final price.</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Quick Import / Export</h3>
                <p className="mt-1 text-[12.5px] text-[#6B6B6B]">Use the existing spreadsheet parser with preview before commit.</p>
              </div>
              <button type="button" onClick={() => handleExport(true)} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                <Download size={14} /> Export
              </button>
            </div>
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
                <button type="button" onClick={handleImportPreview} disabled={previewImport.isPending} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7] disabled:opacity-50">
                  <Eye size={14} /> Preview
                </button>
                <button type="button" onClick={handleImportCommit} disabled={importPricing.isPending} className="inline-flex items-center gap-2 rounded-md bg-[#E31E24] px-3 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50">
                  <Upload size={14} /> Import
                </button>
                <button type="button" onClick={() => handleExport(false)} className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  <Download size={14} /> Export all
                </button>
              </div>
            </div>
            {importReport ? (
              <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3 text-[12.5px] text-[#1A1A1A]">
                <div className="font-semibold">Import preview ready</div>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap text-[12px] text-[#6B6B6B]">{JSON.stringify(importReport, null, 2)}</pre>
              </div>
            ) : null}
          </div>

          {dashboard?.recentlyUpdatedRules?.length ? (
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-sm">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Recent Updates</h3>
              <div className="mt-3 space-y-2">
                {dashboard.recentlyUpdatedRules.slice(0, 4).map((row) => (
                  <div key={row.id} className="rounded-lg border border-[#E6E6E6] px-3 py-2">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-[13px] font-medium text-[#1A1A1A]">{row.ruleName}</div>
                        <div className="text-[11.5px] text-[#9A9A9A]">{ruleTypeLabels[row.ruleType]} · {row.product.title}</div>
                      </div>
                      <StatusBadge status={row.status} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <Modal open={showForm} onClose={resetForm} title={form.id ? "Edit pricing rule" : "New pricing rule"} panelClassName="max-w-5xl">
        {showForm ? (
          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminSelect
                label="Rule Type"
                value={form.ruleType}
                onChange={(event) =>
                  setForm((current) => {
                    const nextRuleType = event.target.value as Exclude<PricingRuleType, "ALL">;
                    return {
                      ...current,
                      ruleType: nextRuleType,
                    };
                  })
                }
                options={Object.entries(ruleTypeLabels).map(([value, label]) => ({ value, label }))}
              />
              <AdminSelect label="Product" value={form.productId} onChange={(event) => setForm((current) => ({ ...current, productId: event.target.value, variantId: "" }))} options={productOptions} />
              <AdminSelect label="Variant" value={form.variantId} onChange={(event) => setForm((current) => ({ ...current, variantId: event.target.value }))} options={variantOptions} />
              <AdminSelect label="Country" value={form.countryId} onChange={(event) => setForm((current) => ({ ...current, countryId: event.target.value }))} options={countryOptions} />
              <AdminSelect label="Status" value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value as "ACTIVE" | "INACTIVE" }))} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
              <AdminSelect
                label="Customer Role"
                value={form.customerRoleKey}
                onChange={(event) => setForm((current) => ({ ...current, customerRoleKey: event.target.value }))}
                options={customerRoleOptions}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {form.ruleType === "TIER_PRICE" ? (
                <>
                  <AdminSelect label="Tier" value={form.tierId} onChange={(event) => setForm((current) => ({ ...current, tierId: event.target.value }))} options={tierOptions} />
                  <AdminInput label="Discount %" type="number" min="0" step="0.01" value={form.discountPercent} onChange={(event) => setForm((current) => ({ ...current, discountPercent: event.target.value }))} />
                  <AdminInput label="Fixed Price" type="number" min="0" step="0.01" value={form.fixedPrice} onChange={(event) => setForm((current) => ({ ...current, fixedPrice: event.target.value }))} />
                </>
              ) : null}

              {form.ruleType === "MOQ_PRICE" ? (
                <>
                  <AdminInput label="Minimum Quantity" type="number" min="1" step="1" value={form.minQuantity} onChange={(event) => setForm((current) => ({ ...current, minQuantity: event.target.value }))} />
                  <AdminInput label="Discount %" type="number" min="0" step="0.01" value={form.discountPercent} onChange={(event) => setForm((current) => ({ ...current, discountPercent: event.target.value }))} />
                  <AdminInput label="Fixed Price" type="number" min="0" step="0.01" value={form.fixedPrice} onChange={(event) => setForm((current) => ({ ...current, fixedPrice: event.target.value }))} />
                </>
              ) : null}

              {form.ruleType === "BASE_PRICE" || form.ruleType === "VARIANT_PRICE" || form.ruleType === "CUSTOMER_ROLE_PRICE" ? (
                <>
                  <AdminInput label="MRP" type="number" min="0" step="0.01" value={form.mrp} onChange={(event) => setForm((current) => ({ ...current, mrp: event.target.value }))} />
                  <AdminInput label="Selling Price" type="number" min="0" step="0.01" value={form.sellingPrice} onChange={(event) => setForm((current) => ({ ...current, sellingPrice: event.target.value }))} />
                  <AdminInput label="Dealer Price" type="number" min="0" step="0.01" value={form.dealerPrice} onChange={(event) => setForm((current) => ({ ...current, dealerPrice: event.target.value }))} />
                  <AdminInput label="Doctor / Retailer Price" type="number" min="0" step="0.01" value={form.distributorPrice} onChange={(event) => setForm((current) => ({ ...current, distributorPrice: event.target.value }))} />
                </>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#E6E6E6] pt-4">
              <div className="text-[12.5px] text-[#6B6B6B]">
                Priority is currently enforced by the existing resolver hierarchy: Customer Specific, Tier, Country, Variant, MOQ, Base Price.
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={resetForm} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]">
                  Cancel
                </button>
                <button type="button" onClick={saveRule} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                  {form.id ? "Save rule" : "Create rule"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </Modal>

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete pricing rule?"
        message={deleteTarget ? `Delete ${deleteTarget.ruleName}?` : ""}
        onConfirm={() => deleteTarget && handleDelete(deleteTarget)}
        onCancel={() => setDeleteTarget(null)}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
