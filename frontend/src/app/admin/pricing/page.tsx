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
  ChevronDown,
  Edit2,
  Copy,
  RotateCcw,
  XCircle,
  Layers,
  AlertTriangle,
} from "lucide-react";
import { cn } from "@/utils/cn";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  AdminDeleteModal,
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
import { AdminImportWizard, WizardColumnDef, WizardExpectedColumn } from "@/components/admin/AdminImportWizard";
import { Modal } from "@/components/ui/Modal";
import { Tooltip } from "@/components/ui/Tooltip";
import { AdminRowActions, AdminActionButton } from "@/components/admin/AdminRowActions";
import { formatDate } from "@/utils/formatDate";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  useAdminCountries,
  useAdminCustomerRoles,
  useAdminPricing,
  useAdminPricingDashboard,
  useAdminProducts,
  useAdminProductsInfinite,
  useAdminTiers,
  useBulkPricing,
  useCreatePricing,
  useDeletePricing,
  useRestorePricing,
  usePermanentDeletePricing,
  useBulkRestorePricing,
  useBulkPermanentDeletePricing,
  useExportPricing,
  useImportPricing,
  usePreviewPricing,
  usePreviewPricingImport,
  useUpdatePricing,
  useAdminProduct,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type PricingRuleType = "ALL" | "BASE_PRICE" | "VARIANT_PRICE" | "TIER_PRICE" | "MOQ_PRICE" | "CUSTOMER_ROLE_PRICE";
type PricingStatusFilter = "ALL" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
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
  deletedAt?: string | null;
  canPermanentDelete?: boolean;
  permanentDeleteBlockReason?: string | null;
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
  archivedRules?: number;
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
  productIds?: string[];
  variantId: string;
  variantIds?: string[];
  countryId: string;
  countryIds?: string[];
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
  productIds: [],
  variantId: "",
  variantIds: [],
  countryId: "",
  countryIds: [],
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
  tier: false,
  moq: false,
  basePrice: true,
  discount: true,
  priority: false,
  status: true,
  createdBy: false,
  updatedAt: false,
};

const pricingExpectedColumns: WizardExpectedColumn[] = [
  { name: "productTitle", hint: "Product Name / Title (optional if code or slug provided)" },
  { name: "productCode", hint: "Product Code, Slug, or ID" },
  { name: "countryCode", required: true, hint: "ISO 2-letter Country code (e.g. IN, US), 'ALL' for all countries, or Country Name" },
  { name: "mrp", required: true, hint: "Maximum Retail Price" },
  { name: "sellingPrice", required: true, hint: "Standard Selling Price" },
  { name: "variantSku", hint: "Variant SKU (optional for parent product)" },
  { name: "dealerPrice", hint: "B2B Dealer price" },
  { name: "doctorRetailerPrice", hint: "Doctor / Retailer price (also accepts distributorPrice)" },
  { name: "status", hint: "ACTIVE or INACTIVE" },
];

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
  if (!key) return "Global / All Roles";
  const upper = key.toUpperCase();
  switch (upper) {
    case "GUEST":
      return "Guest / Retail";
    case "DEALER":
      return "Dealer / B2B Wholesale";
    case "DOCTOR_RETAILER":
      return "Doctor / Retailer";
    default:
      return key;
  }
}

export default function PricingPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("pricing.create");
  const canUpdate = hasPermission("pricing.update");
  const canDelete = hasPermission("pricing.delete");

  const { showToast, ToastComponent } = useToast();

  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [bulkAction, setBulkAction] = useState("");
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
  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/pricing", {
        params: {
          search: search || undefined,
          status: statusFilter === "ALL" || statusFilter === "ARCHIVED" ? undefined : statusFilter,
          deleted: statusFilter === "ARCHIVED" ? "true" : undefined,
          ruleType: ruleTypeFilter === "ALL" ? undefined : ruleTypeFilter,
          countryId: countryFilter || undefined,
          tierId: tierFilter || undefined,
          productId: productFilter || undefined,
          variantId: variantFilter || undefined,
          minQuantity: minQuantityFilter || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((row: any) => row.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} pricing rules across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all pricing rules.", "error");
    }
  };
  const [columnVisibility, setColumnVisibility] = useState(defaultColumnVisibility);
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [viewingRule, setViewingRule] = useState<PricingRuleRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<PricingRuleRow | null>(null);
  const [bulkCountryId, setBulkCountryId] = useState("");
  const [bulkTierId, setBulkTierId] = useState("");
  const [showAssignDropdown, setShowAssignDropdown] = useState(false);
  const [togglingStatusId, setTogglingStatusId] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [previewInput, setPreviewInput] = useState<PreviewFormState>(emptyPreview);
  const [showBulkPermanentModal, setShowBulkPermanentModal] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkPermanentResult, setBulkPermanentResult] = useState<any | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data: dashboardData, isLoading: dashboardLoading } = useAdminPricingDashboard();
  const { data: pricingResponse, isLoading: pricingLoading, refetch, isFetching } = useAdminPricing({
    page,
    limit,
    search: search || undefined,
    status: statusFilter === "ALL" || statusFilter === "ARCHIVED" ? undefined : statusFilter,
    deleted: statusFilter === "ARCHIVED" ? "true" : undefined,
    ruleType: ruleTypeFilter === "ALL" ? undefined : ruleTypeFilter,
    countryId: countryFilter || undefined,
    tierId: tierFilter || undefined,
    productId: productFilter || undefined,
    variantId: variantFilter || undefined,
    minQuantity: minQuantityFilter || undefined,
    sortBy,
    sortDir,
  });

  const dashboard = useMemo(() => {
    const raw = (dashboardData ?? pricingResponse?.counts) as Record<string, any> | undefined;
    if (!raw) return undefined;
    return {
      totalRules: raw.totalRules ?? 0,
      activeRules: raw.activeRules ?? 0,
      inactiveRules: raw.inactiveRules ?? 0,
      archivedRules: raw.archivedRules ?? 0,
      countryPricingRules: raw.countryPricingRules ?? 0,
      tierPricingRules: raw.tierPricingRules ?? 0,
      moqPricingRules: raw.moqPricingRules ?? 0,
      variantPricingRules: raw.variantPricingRules ?? 0,
      customerSpecificPricing: raw.customerSpecificPricing ?? 0,
      recentlyUpdatedRules: raw.recentlyUpdatedRules ?? [],
    };
  }, [dashboardData, pricingResponse?.counts]);

  const [knownRules, setKnownRules] = useState<Record<string, PricingRuleRow>>({});

  useEffect(() => {
    if (pricingResponse?.data) {
      setKnownRules((current) => {
        const next = { ...current };
        pricingResponse.data.forEach((row: PricingRuleRow) => {
          next[row.id] = row;
        });
        return next;
      });
    }
  }, [pricingResponse?.data]);

  const isStatsLoading = dashboardLoading && pricingLoading && !dashboard;
  const { data: countries = [] } = useAdminCountries();

  const wizardCountryOptions = useMemo(() => {
    const list = (countries as Array<{ id: string; name: string; code: string; status?: string }>)
      .filter((c) => c.status !== "INACTIVE")
      .map((c) => ({
        label: `${c.name} (${c.code.toUpperCase()})`,
        value: c.code.toUpperCase(),
      }));
    return [
      { label: "All countries", value: "ALL" },
      ...list,
    ];
  }, [countries]);

  const pricingWizardColumns = useMemo<WizardColumnDef[]>(() => [
    { key: "productTitle", header: "Product", minWidth: "170px", placeholder: "Product name" },
    { key: "productCode", header: "Product Code", minWidth: "130px", placeholder: "e.g. BRK-MBT-22" },
    { key: "variantSku", header: "Variant SKU", minWidth: "130px", placeholder: "e.g. VAR-MB-001" },
    {
      key: "countryCode",
      header: "Country",
      required: true,
      type: "multiselect",
      minWidth: "160px",
      options: wizardCountryOptions,
    },
    { key: "mrp", header: "MRP", required: true, type: "number", minWidth: "95px" },
    { key: "sellingPrice", header: "Selling Price", required: true, type: "number", minWidth: "105px" },
    { key: "dealerPrice", header: "Dealer Price", type: "number", minWidth: "105px" },
    {
      key: "distributorPrice",
      header: "Doctor / Retailer Price",
      type: "number",
      minWidth: "165px",
      placeholder: "Doctor / Retailer price",
    },
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
  ], [wizardCountryOptions]);
  const { data: tiers = [] } = useAdminTiers();
  const { data: customerRoles = [] } = useAdminCustomerRoles();
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
  const { data: filterProduct } = useAdminProduct(productFilter);

  const previewImport = usePreviewPricingImport();
  const importPricing = useImportPricing();
  const exportPricing = useExportPricing();
  const createPricing = useCreatePricing();
  const updatePricing = useUpdatePricing();
  const deletePricing = useDeletePricing();
  const restorePricing = useRestorePricing();
  const permanentDeletePricing = usePermanentDeletePricing();
  const bulkRestorePricing = useBulkRestorePricing();
  const bulkPermanentDeletePricing = useBulkPermanentDeletePricing();
  const bulkPricing = useBulkPricing();

  const form = useAdminForm({
    initialValues: emptyForm,
    validate: (values) => {
      const errors: any = {};
      const resolvedProductIds = !values.id && (values.productIds ?? []).length === 0
        ? products.map((p) => p.id)
        : values.productIds ?? [];
      const resolvedCountryIds = !values.id && (values.countryIds ?? []).length === 0
        ? countries.map((c) => c.id)
        : values.countryIds ?? [];

      if (values.id) {
        if (!values.productId) errors.productId = "Product is required.";
        if (!values.countryId) errors.countryId = "Country is required.";
      } else {
        if (resolvedProductIds.length === 0) errors.productId = "At least one product is required.";
        if (resolvedCountryIds.length === 0) errors.countryId = "At least one country is required.";
      }

      if (values.ruleType === "BASE_PRICE" || values.ruleType === "VARIANT_PRICE" || values.ruleType === "CUSTOMER_ROLE_PRICE") {
        if (values.ruleType === "CUSTOMER_ROLE_PRICE" && !values.customerRoleKey) {
          errors.customerRoleKey = "Customer role is required.";
        }

        // Common required fields
        if (values.mrp === "") errors.mrp = "MRP is required.";
        if (values.sellingPrice === "") errors.sellingPrice = "Selling price is required.";

        // Negative check
        if (values.mrp !== "" && Number(values.mrp) < 0) errors.mrp = "MRP cannot be negative.";
        if (values.sellingPrice !== "" && Number(values.sellingPrice) < 0) errors.sellingPrice = "Selling price cannot be negative.";

        // Role-specific validation
        const roleKey = values.customerRoleKey;
        if (roleKey === "") {
          // None / Any case: Dealer Price and Doctor / Retailer Price are required
          if (values.dealerPrice === "") errors.dealerPrice = "Dealer price is required.";
          if (values.distributorPrice === "") errors.distributorPrice = "Doctor / Retailer price is required.";
        } else if (roleKey === "DEALER") {
          // Dealer case: Dealer Price is required
          if (values.dealerPrice === "") errors.dealerPrice = "Dealer price is required.";
        } else if (roleKey === "DOCTOR_RETAILER") {
          // Doctor / Retailer case: Doctor / Retailer Price is required
          if (values.distributorPrice === "") errors.distributorPrice = "Doctor / Retailer price is required.";
        }

        // Optional checks for negative values
        if (values.dealerPrice !== "" && Number(values.dealerPrice) < 0) errors.dealerPrice = "Dealer price cannot be negative.";
        if (values.distributorPrice !== "" && Number(values.distributorPrice) < 0) errors.distributorPrice = "Doctor / Retailer price cannot be negative.";
      } else if (values.ruleType === "TIER_PRICE") {
        if (!values.tierId) errors.tierId = "Tier is required.";
        if (values.discountPercent === "" && values.fixedPrice === "") errors.discountPercent = "Provide either a discount percent or a fixed price.";
        if (values.discountPercent !== "" && Number(values.discountPercent) < 0) errors.discountPercent = "Discount cannot be negative.";
        if (values.fixedPrice !== "" && Number(values.fixedPrice) < 0) errors.fixedPrice = "Fixed price cannot be negative.";
      } else if (values.ruleType === "MOQ_PRICE") {
        if (values.minQuantity === "" || Number(values.minQuantity) < 1) errors.minQuantity = "MOQ must be at least 1.";
        if (values.discountPercent === "" && values.fixedPrice === "") errors.discountPercent = "Provide either a discount percent or a fixed price.";
        if (values.discountPercent !== "" && Number(values.discountPercent) < 0) errors.discountPercent = "Discount cannot be negative.";
        if (values.fixedPrice !== "" && Number(values.fixedPrice) < 0) errors.fixedPrice = "Fixed price cannot be negative.";
      }
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      const variantId = values.variantId || null;
      const status = values.status;

      try {
        if (values.id) {
          const selectedCountry = countries.find((country: { id: string; currencyId?: string }) => country.id === values.countryId);
          if (values.ruleType === "BASE_PRICE" || values.ruleType === "VARIANT_PRICE" || values.ruleType === "CUSTOMER_ROLE_PRICE") {
            if (!selectedCountry?.currencyId) {
              showToast("The selected country does not have a currency assigned.", "error");
              return;
            }

            const payload = {
              productId: values.productId,
              variantId,
              countryId: values.countryId,
              customerRoleKey: values.customerRoleKey || null,
              currencyId: selectedCountry.currencyId,
              mrp: Number(values.mrp),
              sellingPrice: Number(values.sellingPrice),
              dealerPrice: values.dealerPrice === "" ? null : Number(values.dealerPrice),
              distributorPrice: values.distributorPrice === "" ? null : Number(values.distributorPrice),
              status,
            };

            await updatePricing.mutateAsync({ id: values.id, ...payload });
            showToast("Pricing rule updated.", "success");
          } else if (values.ruleType === "TIER_PRICE") {
            const payload = {
              productId: values.productId,
              variantId,
              countryId: values.countryId,
              tierId: values.tierId,
              discountPercent: values.discountPercent === "" ? null : Number(values.discountPercent),
              fixedPrice: values.fixedPrice === "" ? null : Number(values.fixedPrice),
              status,
            };
            await adminApi.put(`/pricing/${values.productId}/tier-pricing/${values.id}`, payload);
            showToast("Tier pricing rule updated.", "success");
          } else if (values.ruleType === "MOQ_PRICE") {
            const payload = {
              productId: values.productId,
              variantId,
              countryId: values.countryId,
              minQuantity: Number(values.minQuantity),
              discountPercent: values.discountPercent === "" ? null : Number(values.discountPercent),
              fixedPrice: values.fixedPrice === "" ? null : Number(values.fixedPrice),
              status,
            };
            await adminApi.put(`/pricing/${values.productId}/moq-pricing/${values.id}`, payload);
            showToast("MOQ pricing rule updated.", "success");
          }
        } else {
          const resolvedProductIds = (values.productIds ?? []).length === 0
            ? products.map((p) => p.id)
            : values.productIds ?? [];
          const resolvedCountryIds = (values.countryIds ?? []).length === 0
            ? countries.map((c) => c.id)
            : values.countryIds ?? [];
          const resolvedVariantIds = resolvedProductIds.length === 1 && (values.variantIds ?? []).length > 0
            ? (values.variantIds ?? []).map((v) => v === "" ? null : v)
            : [null];

          let createdCount = 0;
          let failedCount = 0;

          for (const pId of resolvedProductIds) {
            for (const cId of resolvedCountryIds) {
              for (const vId of resolvedVariantIds) {
                const selectedCountry = countries.find((country: { id: string; currencyId?: string }) => country.id === cId);
                if (!selectedCountry?.currencyId) continue;

                try {
                  if (values.ruleType === "BASE_PRICE" || values.ruleType === "VARIANT_PRICE" || values.ruleType === "CUSTOMER_ROLE_PRICE") {
                    const payload = {
                      productId: pId,
                      variantId: vId,
                      countryId: cId,
                      customerRoleKey: values.customerRoleKey || null,
                      currencyId: selectedCountry.currencyId,
                      mrp: Number(values.mrp),
                      sellingPrice: Number(values.sellingPrice),
                      dealerPrice: values.dealerPrice === "" ? null : Number(values.dealerPrice),
                      distributorPrice: values.distributorPrice === "" ? null : Number(values.distributorPrice),
                      status,
                    };
                    await createPricing.mutateAsync(payload);
                  } else if (values.ruleType === "TIER_PRICE") {
                    const payload = {
                      productId: pId,
                      variantId: vId,
                      countryId: cId,
                      tierId: values.tierId,
                      discountPercent: values.discountPercent === "" ? null : Number(values.discountPercent),
                      fixedPrice: values.fixedPrice === "" ? null : Number(values.fixedPrice),
                      status,
                    };
                    await adminApi.post(`/pricing/${pId}/tier-pricing`, payload);
                  } else if (values.ruleType === "MOQ_PRICE") {
                    const payload = {
                      productId: pId,
                      variantId: vId,
                      countryId: cId,
                      minQuantity: Number(values.minQuantity),
                      discountPercent: values.discountPercent === "" ? null : Number(values.discountPercent),
                      fixedPrice: values.fixedPrice === "" ? null : Number(values.fixedPrice),
                      status,
                    };
                    await adminApi.post(`/pricing/${pId}/moq-pricing`, payload);
                  }
                  createdCount++;
                } catch (err) {
                  failedCount++;
                }
              }
            }
          }

          if (createdCount > 0) {
            showToast(`${createdCount} pricing rule(s) created successfully.`, "success");
          }
          if (failedCount > 0) {
            showToast(`${failedCount} pricing rule(s) failed to create (duplicate or invalid).`, "error");
          }
        }

        await refetch();
        resetForm();
        setShowForm(false);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save pricing rule."), "error");
      }
    }
  });

  const { data: selectedProduct } = useAdminProduct(
    form.values.productId || (form.values.productIds && form.values.productIds.length === 1 ? form.values.productIds[0] : "")
  );
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


  const products = useMemo(() => {
    return infiniteProductsData?.pages.flatMap((page: any) => page.data ?? []) ?? [];
  }, [infiniteProductsData?.pages]);
  const customerRoleRows = customerRoles as CustomerRoleOption[];
  const ruleRows = (pricingResponse?.data ?? []) as PricingRuleRow[];
  const pagination = pricingResponse?.pagination ?? { page, limit, total: 0, totalPages: 1 };
  const selectedRuleType = useMemo(() => {
    if (!selectedIds.length) return null;
    const types = selectedIds.map(id => knownRules[id]?.ruleType || ruleRows.find(row => row.id === id)?.ruleType).filter(Boolean);
    if (new Set(types).size > 1) return null; // multiple types selected
    return (types[0] as PricingRuleType) || null;
  }, [selectedIds, knownRules, ruleRows]);
  const bulkActionFamily = selectedRuleType === "TIER_PRICE" || selectedRuleType === "MOQ_PRICE" ? "rule-only" : "base";
  const customerRoleOptions = useMemo(
    () => [
      { value: "", label: "Global / All Roles" },
      { value: "GUEST", label: "Guest / Retail Only" },
      { value: "DEALER", label: "Dealer / B2B Wholesale Only" },
      { value: "DOCTOR_RETAILER", label: "Doctor / Retailer Only" },
    ],
    []
  );
  const previewCustomerRoleOptions = useMemo(
    () => [
      { value: "", label: "Auto (Resolve from Customer Profile)" },
      { value: "GUEST", label: "Guest / Retail" },
      { value: "DEALER", label: "Dealer / B2B Wholesale" },
      { value: "DOCTOR_RETAILER", label: "Doctor / Retailer" },
    ],
    []
  );

  useEffect(() => {
    const firstActive = countries.find((c: any) => c.status === "ACTIVE");
    if (firstActive && !previewInput.countryId) {
      setPreviewInput((current) => ({ ...current, countryId: firstActive.id }));
    }
  }, [countries, previewInput.countryId]);

  useEffect(() => {
    setSelectedIds([]);
  }, [limit, search, statusFilter, ruleTypeFilter, countryFilter, tierFilter, productFilter, variantFilter, minQuantityFilter, sortBy, sortDir]);

  useEffect(() => {
    if (!form.values.productId) return;
    const product = selectedProduct?.data ?? selectedProduct;
    const variants = (product?.variants ?? []) as Array<{ id: string }>;
    if (form.values.variantId && !variants.some((variant) => variant.id === form.values.variantId)) {
      form.setFieldValue("variantId", "");
    }
  }, [form.values.productId, form.values.variantId, selectedProduct]);

  const countryOptions = [
    { value: "", label: "All countries" },
    ...countries
      .filter((c: any) => c.status === "ACTIVE")
      .map((country: { id: string; name: string; code: string }) => ({
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

  const productOptions = useMemo(
    () => [
      { value: "", label: "All products" },
      ...products.map((product) => ({
        value: product.id,
        label: product.sku ? `${product.title} (${product.sku})` : product.title,
      })),
    ],
    [products]
  );

  const formProductOptions = useMemo(
    () => products.map((product) => ({
      value: product.id,
      label: product.sku ? `${product.title} (${product.sku})` : product.title,
    })),
    [products]
  );

  const selectedProductData = selectedProduct?.data ?? selectedProduct;
  const filterProductData = filterProduct?.data ?? filterProduct;
  const variantOptions = useMemo(() => {
    const variants = (selectedProductData?.variants ?? []) as Array<{ id: string; title: string; sku?: string | null; status?: string }>;
    return [
      { value: "", label: "All Variants" },
      ...variants.map((variant) => ({
        value: variant.id,
        label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title,
      })),
    ];
  }, [selectedProductData]);

  const filterVariantOptions = useMemo(() => {
    const variants = (filterProductData?.variants ?? []) as Array<{ id: string; title: string; sku?: string | null }>;
    return [
      { value: "", label: "All Variants" },
      ...variants.map((variant) => ({
        value: variant.id,
        label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title,
      })),
    ];
  }, [filterProductData]);

  const previewProduct = useAdminProduct(previewInput.productId);
  const previewProductData = previewProduct?.data?.data ?? previewProduct?.data ?? selectedProductData;
  const previewVariantOptions = useMemo(() => {
    const variants = (previewProductData?.variants ?? []) as Array<{ id: string; title: string; sku?: string | null }>;
    return [
      { value: "", label: "All Variants" },
      ...variants.map((variant) => ({
        value: variant.id,
        label: variant.sku ? `${variant.title} (${variant.sku})` : variant.title,
      })),
    ];
  }, [previewProductData]);

  const bulkCountryOptions = useMemo(() => {
    return [
      { value: "", label: "No country selected" },
      ...countries.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code})` }))
    ];
  }, [countries]);

  const bulkTierOptions = useMemo(() => {
    return [
      { value: "", label: "No tier selected" },
      ...tiers.map((tier: { id: string; name: string }) => ({
        value: tier.id,
        label: tier.name,
      })),
    ];
  }, [tiers]);

  const resetForm = () => {
    form.reset(emptyForm);
    setShowForm(false);
  };

  const openCreateForm = (ruleType: Exclude<PricingRuleType, "ALL"> = "BASE_PRICE") => {
    form.reset({ ...emptyForm, ruleType });
    setShowForm(true);
  };

  const openEditForm = (row: PricingRuleRow) => {
    let initialRuleType = row.ruleType;
    let initialCustomerRoleKey = "";

    if (row.ruleType === "BASE_PRICE" || row.ruleType === "VARIANT_PRICE") {
      const hasDealer = row.details?.dealerPrice != null;
      const hasDistributor = row.details?.distributorPrice != null;

      if (hasDealer && !hasDistributor) {
        initialRuleType = "CUSTOMER_ROLE_PRICE";
        initialCustomerRoleKey = "DEALER";
      } else if (hasDistributor && !hasDealer) {
        initialRuleType = "CUSTOMER_ROLE_PRICE";
        initialCustomerRoleKey = "DOCTOR_RETAILER";
      } else if (!hasDealer && !hasDistributor) {
        initialRuleType = "CUSTOMER_ROLE_PRICE";
        initialCustomerRoleKey = "GUEST";
      }
    }

    form.reset({
      id: row.id,
      ruleType: initialRuleType,
      productId: row.productId,
      productIds: [row.productId],
      variantId: row.variantId ?? "",
      variantIds: [row.variantId ?? ""],
      countryId: row.countryId ?? "",
      countryIds: [row.countryId ?? ""],
      tierId: row.tierId ?? "",
      customerRoleKey: initialCustomerRoleKey,
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



  const handleDelete = async (row: PricingRuleRow) => {
    try {
      await deletePricing.mutateAsync(row.id);
      showToast("Pricing rule archived successfully.", "success");
      setDeleteTarget(null);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to archive pricing rule."), "error");
    }
  };

  const handlePermanentDelete = async (row: PricingRuleRow) => {
    if (row.canPermanentDelete === false) {
      showToast(row.permanentDeleteBlockReason || "Permanent deletion is blocked for this pricing rule.", "error");
      return;
    }
    try {
      await permanentDeletePricing.mutateAsync(row.id);
      showToast(`Pricing rule "${row.ruleName}" permanently deleted.`, "success");
      setDeleteTarget(null);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to permanently delete pricing rule."), "error");
    }
  };

  const handleRestore = async (row: PricingRuleRow) => {
    try {
      await restorePricing.mutateAsync(row.id);
      showToast("Pricing rule restored successfully.", "success");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to restore pricing rule."), "error");
    }
  };

  const handleBulkRestore = async () => {
    if (!selectedIds.length) return;
    try {
      await bulkRestorePricing.mutateAsync(selectedIds);
      showToast(`Restored ${selectedIds.length} pricing rule(s).`, "success");
      setSelectedIds([]);
      setBulkAction("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to restore pricing rules."), "error");
    }
  };

  const handleBulkSoftDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      const result = await bulkPricing.mutateAsync({
        ids: selectedIds,
        ruleType: selectedRuleType || "BASE_PRICE",
        action: "DELETE",
      });
      const data = (result as any)?.data ?? result;
      const blocked: Array<{ id: string; name?: string; reason: string }> = Array.isArray(data?.blocked) ? data.blocked : [];
      const deletedCount = typeof data?.deletedCount === "number" ? data.deletedCount : (Array.isArray(data?.deletedIds) ? data.deletedIds.length : (data?.affected ?? 0));
      const blockedCount = typeof data?.blockedCount === "number" ? data.blockedCount : blocked.length;

      if (blockedCount === 0 && deletedCount > 0) {
        showToast(`Successfully archived ${deletedCount} pricing rule(s).`, "success");
        setSelectedIds([]);
        setBulkAction("");
        setShowBulkDeleteModal(false);
      } else if (deletedCount === 0 && blockedCount > 0) {
        showToast(blocked[0]?.reason || `All ${blockedCount} selected pricing rules are protected from archiving.`, "error");
      } else {
        showToast(`Archived ${deletedCount} rule(s); ${blockedCount} protected sole active rule(s) were preserved.`, "warning");
        if (Array.isArray(data?.deletedIds)) {
          setSelectedIds((prev) => prev.filter((id) => !data.deletedIds.includes(id)));
        }
        setBulkAction("");
        setShowBulkDeleteModal(false);
      }
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk archive failed."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleConfirmBulkPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    const totalSelected = selectedIds.length;
    setBulkSaving(true);
    try {
      const result = await bulkPermanentDeletePricing.mutateAsync(selectedIds);
      setBulkSaving(false);
      setShowBulkPermanentModal(false);
      setBulkAction("");

      await refetch();

      if (result) {
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
          tab: "pricing",
        });

        if (blockedCount === 0 && deletedCount > 0) {
          showToast(`Successfully permanently deleted all ${deletedCount} pricing rule(s).`, "success");
        } else if (deletedCount === 0 && blockedCount > 0) {
          showToast(`All ${blockedCount} selected pricing rules are protected from permanent deletion.`, "error");
        } else {
          showToast(`Permanently deleted ${deletedCount} pricing rule(s); ${blockedCount} protected rule(s) preserved.`, "warning");
        }
      }
    } catch (err) {
      setBulkSaving(false);
      showToast(getAdminErrorMessage(err, "Failed to permanently delete pricing rules."), "error");
    }
  };

  const toggleStatus = async (row: PricingRuleRow) => {
    const newStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      setTogglingStatusId(row.id);
      if (row.ruleType === "TIER_PRICE") {
        await adminApi.put(`/pricing/${row.productId}/tier-pricing/${row.id}`, {
          productId: row.productId,
          variantId: row.variantId || null,
          countryId: row.countryId,
          tierId: row.tierId,
          discountPercent: row.details?.discountPercent ?? null,
          fixedPrice: row.details?.fixedPrice ?? null,
          status: newStatus,
        });
      } else if (row.ruleType === "MOQ_PRICE") {
        await adminApi.put(`/pricing/${row.productId}/moq-pricing/${row.id}`, {
          productId: row.productId,
          variantId: row.variantId || null,
          countryId: row.countryId,
          minQuantity: row.moq || 1,
          discountPercent: row.details?.discountPercent ?? null,
          fixedPrice: row.details?.fixedPrice ?? null,
          status: newStatus,
        });
      } else {
        await updatePricing.mutateAsync({
          id: row.id,
          productId: row.productId,
          variantId: row.variantId || null,
          countryId: row.countryId,
          customerRoleKey: row.customerRole,
          currencyId: row.details?.currency?.id || null,
          mrp: row.details?.mrp != null ? Number(row.details.mrp) : null,
          sellingPrice: row.basePrice != null ? Number(row.basePrice) : 0,
          status: newStatus,
        });
      }
      showToast("Pricing rule status updated.", "success");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update status."), "error");
    } finally {
      setTogglingStatusId(null);
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
    if (!selectedRuleType && action !== "DELETE") {
      showToast("Bulk actions require rules from the same type.", "error");
      return;
    }
    if (bulkActionFamily !== "base" && action !== "DELETE") {
      showToast("This rule type only supports bulk delete and reassignment.", "error");
      return;
    }

    try {
      const result = await bulkPricing.mutateAsync({
        ids: selectedIds,
        ruleType: selectedRuleType || "BASE_PRICE",
        action,
        countryId: bulkCountryId || null,
        tierId: bulkTierId || null,
      });
      const data = (result as any)?.data ?? result;
      const blocked: Array<{ id: string; name?: string; reason: string }> = Array.isArray(data?.blocked) ? data.blocked : [];
      if (blocked.length > 0) {
        const updatedCount = (data?.updated ?? 0) + (data?.disabled ?? 0) + (data?.deleted ?? 0);
        if (updatedCount > 0) {
          showToast(`Action completed for ${updatedCount} rule(s); ${blocked.length} protected rule(s) preserved.`, "warning");
        } else {
          showToast(blocked[0]?.reason || `All ${blocked.length} selected rules are protected from this action.`, "error");
        }
      } else {
        showToast("Bulk action completed.", "success");
      }
      setSelectedIds([]);
      setBulkCountryId("");
      setBulkTierId("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const runBulkAssign = async () => {
    if (!selectedIds.length) {
      showToast("Select at least one rule first.", "error");
      return;
    }
    if (!selectedRuleType) {
      showToast("Bulk actions require rules from the same type.", "error");
      return;
    }
    if (!bulkCountryId && !bulkTierId) {
      showToast("Select a country or tier to assign first.", "error");
      return;
    }
    try {
      if (bulkCountryId) {
        await bulkPricing.mutateAsync({
          ids: selectedIds,
          ruleType: selectedRuleType,
          action: undefined as any,
          countryId: bulkCountryId,
        });
      }
      if (bulkTierId) {
        await bulkPricing.mutateAsync({
          ids: selectedIds,
          ruleType: selectedRuleType,
          action: undefined as any,
          tierId: bulkTierId,
        });
      }
      showToast("Bulk assignment completed.", "success");
      setSelectedIds([]);
      setBulkCountryId("");
      setBulkTierId("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk assignment failed."), "error");
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

  const downloadSampleTemplate = async () => {
    try {
      const response = await adminApi.get("/pricing/sample-template", { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "pricing-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download sample template."), "error");
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

  const dataTableColumns = useMemo(() => {
    const list = [
      {
        key: "ruleName",
        label: "Rule Name",
        render: (row: PricingRuleRow) => (
          <div className="align-top max-w-[200px]">
            <Tooltip content={row.ruleName} side="top">
              <span
                onClick={() => setViewingRule(row)}
                className="font-semibold text-[#1A1A1A] line-clamp-2 cursor-pointer hover:text-[#E31E24] transition-colors"
              >
                {row.ruleName}
              </span>
            </Tooltip>
            <div className="text-[11.5px] text-[#9A9A9A]">
              Resolution order {ruleResolutionOrder(row.ruleType)}
            </div>
          </div>
        ),
      },
      {
        key: "ruleType",
        label: "Rule Type",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555]">{ruleTypeLabels[row.ruleType] || row.ruleType}</div>
        ),
      },
      {
        key: "product",
        label: "Product",
        render: (row: PricingRuleRow) => (
          <div className="align-top max-w-[200px]">
            <Tooltip content={row.product.title} side="top">
              <span className="font-semibold text-[#1A1A1A] line-clamp-2 block">
                {row.product.title}
              </span>
            </Tooltip>
            <div className="text-[11.5px] text-[#9A9A9A]">{row.product.sku ?? "No SKU"}</div>
          </div>
        ),
      },
      {
        key: "variant",
        label: "Variant",
        render: (row: PricingRuleRow) => {
          const variantTitle = row.variant ? row.variant.title : "All Variants";
          return (
            <div className="align-top text-[#555] max-w-[150px]">
              <Tooltip content={variantTitle} side="top">
                <span className="line-clamp-2 block">{variantTitle}</span>
              </Tooltip>
            </div>
          );
        },
      },
      {
        key: "country",
        label: "Country",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555]">
            {row.country ? `${row.country.name} (${row.country.code})` : "—"}
          </div>
        ),
      },
      {
        key: "customerRole",
        label: "Customer Role",
        render: (row: PricingRuleRow) => {
          if (!row.customerRole) return <span className="inline-flex items-center rounded-md bg-gray-50 border border-gray-200 px-2 py-0.5 text-[11px] font-semibold text-gray-500">Global / All Roles</span>;
          const roles = row.customerRole.split(",").map((r) => r.trim()).filter(Boolean);
          return (
            <div className="flex flex-wrap gap-1 align-top max-w-[150px]">
              {roles.map((role) => {
                const label = getCustomerRoleLabel(role);
                return (
                  <span
                    key={role}
                    className="inline-flex items-center rounded-md bg-red-50 border border-red-100 px-2 py-0.5 text-[11px] font-semibold text-[#E31E24]"
                  >
                    {label}
                  </span>
                );
              })}
            </div>
          );
        },
      },
      {
        key: "tier",
        label: "Tier",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555]">{row.tier?.name ?? "—"}</div>
        ),
      },
      {
        key: "moq",
        label: "MOQ",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555]">{row.moq ?? "—"}</div>
        ),
      },
      {
        key: "basePrice",
        label: "Base Price",
        render: (row: PricingRuleRow) => {
          const currencySymbol = row.details?.currency?.symbol ?? "";
          return (
            <div className="align-top text-[#555]">
              {formatMoney(row.basePrice, currencySymbol)}
            </div>
          );
        },
      },
      {
        key: "discount",
        label: "Discount",
        render: (row: PricingRuleRow) => {
          const currencySymbol = row.details?.currency?.symbol ?? "";
          return (
            <div className="align-top text-[#555]">
              {row.details?.discountPercent != null
                ? `${Number(row.details.discountPercent).toFixed(2)}%`
                : row.discount != null
                  ? formatMoney(row.discount, currencySymbol)
                  : "—"}
            </div>
          );
        },
      },
      {
        key: "priority",
        label: "Priority",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555]">{row.priority}</div>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "110px",
      },
      {
        key: "createdBy",
        label: "Created By",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555]">{row.createdBy ?? "—"}</div>
        ),
      },
      {
        key: "updatedAt",
        label: "Updated Date",
        render: (row: PricingRuleRow) => (
          <div className="align-top text-[#555] whitespace-nowrap">
            {formatDate(row.updatedAt)}
          </div>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "110px",
        render: (row: PricingRuleRow) => {
          const isArchived = Boolean(row.deletedAt || statusFilter === "ARCHIVED");
          if (isArchived) {
            return (
              <AdminRowActions
                view={{
                  onClick: () => setViewingRule(row),
                  title: "View pricing rule details",
                }}
                extra={
                  canUpdate ? (
                    <AdminActionButton
                      action={{
                        onClick: () => handleRestore(row),
                        title: "Restore pricing rule",
                        icon: <RotateCcw size={13} />,
                        disabled: restorePricing.isPending,
                      }}
                      defaultIcon={<RotateCcw size={13} />}
                      defaultTitle="Restore pricing rule"
                    />
                  ) : undefined
                }
                delete={
                  canDelete
                    ? {
                        onClick: () => setDeleteTarget(row),
                        title: "Permanently delete pricing rule",
                      }
                    : undefined
                }
              />
            );
          }

          return (
            <AdminRowActions
              view={{
                onClick: () => setViewingRule(row),
                title: "View pricing rule details",
              }}
              edit={
                canUpdate
                  ? {
                      onClick: () => openEditForm(row),
                      title: "Edit pricing rule",
                    }
                  : undefined
              }
              extra={
                canCreate ? (
                  <AdminActionButton
                    action={{
                      onClick: () => cloneRuleToForm(row),
                      title: "Duplicate / Clone rule",
                    }}
                    defaultIcon={<Copy size={13} className="text-emerald-600" />}
                    defaultTitle="Clone rule"
                    className="hover:bg-emerald-50 hover:border-emerald-200"
                  />
                ) : null
              }
              delete={
                canDelete
                  ? {
                      onClick: () => setDeleteTarget(row),
                      title: "Delete pricing rule",
                    }
                  : undefined
              }
            />
          );
        },
      },
    ];

    return list.filter((col) => col.key === "actions" || columnVisibility[col.key as keyof typeof columnVisibility]);
  }, [columnVisibility, canUpdate, canCreate, canDelete, statusFilter, restorePricing.isPending]);

  const resolutionPreview = previewData as PricingPreviewResult | undefined;

  return (
    <AdminLayout title="Pricing" breadcrumb={[{ label: "Pricing" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Pricing Rules", value: dashboard?.totalRules ?? 0, subtitle: "All configured pricing records", icon: <SquareCheckBig size={18} />, isLoading: isStatsLoading },
            { title: "Active Rules", value: dashboard?.activeRules ?? 0, subtitle: "Ready to resolve in checkout", icon: <CheckCircle2 size={18} />, color: "bg-emerald-500", isLoading: isStatsLoading },
            { title: "Inactive Rules", value: dashboard?.inactiveRules ?? 0, subtitle: "Disabled rules", icon: <Trash2 size={18} />, color: "bg-slate-500", isLoading: isStatsLoading },
            { title: "Archived Rules", value: dashboard?.archivedRules ?? 0, subtitle: "Soft-deleted in archive", icon: <RotateCcw size={18} />, color: "bg-amber-600", isLoading: isStatsLoading },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {[
            { id: "ALL", label: "All Pricing Rules", count: dashboard?.totalRules ?? 0, icon: <Layers size={15} /> },
            { id: "ACTIVE", label: "Active", count: dashboard?.activeRules ?? 0, icon: <CheckCircle2 size={15} /> },
            { id: "INACTIVE", label: "Inactive", count: dashboard?.inactiveRules ?? 0, icon: <XCircle size={15} /> },
            { id: "ARCHIVED", label: "Archived / Deleted", count: dashboard?.archivedRules ?? 0, icon: <RotateCcw size={15} /> },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id as PricingStatusFilter);
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

        {/* RECENTLY UPDATED */}
        {dashboard?.recentlyUpdatedRules?.length ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Recently Updated</h3>
                <p className="text-[12px] text-[#6B6B6B]">Quick access to latest modified pricing rules.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-[#6B6B6B]">
                {dashboard.recentlyUpdatedRules.length} items
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {dashboard.recentlyUpdatedRules.slice(0, 4).map((row: PricingRuleRow) => (
                <div
                  key={row.id}
                  onClick={() => setViewingRule(row)}
                  className="rounded-lg border border-[#E6E6E6] p-3 bg-[#FAFAFA] flex flex-col justify-between min-h-[90px] cursor-pointer hover:border-[#D6D6D6] transition-colors"
                >
                  <div className="min-w-0">
                    <Tooltip content={row.ruleName} side="top">
                      <div className="truncate text-[13px] font-semibold text-[#1A1A1A]">{row.ruleName}</div>
                    </Tooltip>
                    <Tooltip content={row.product?.title || ""} side="top">
                      <div className="text-[11.5px] text-[#9A9A9A] mt-1 truncate">
                        {ruleTypeLabels[row.ruleType as Exclude<PricingRuleType, "ALL">]} · {row.product?.title}
                      </div>
                    </Tooltip>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11.5px] text-[#9A9A9A]">
                      {formatDate(row.updatedAt)}
                    </span>
                    <StatusBadge status={row.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        <AdminListToolbar
          search={{
            value: searchInput,
            onChange: (val) => setSearchInput(val),
            placeholder: "Search rule, product, country, tier...",
            widthClassName: "max-w-[280px]",
          }}
          filters={{
            showFilters: showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [
              statusFilter !== "ALL" ? statusFilter : "",
              ruleTypeFilter !== "ALL" ? ruleTypeFilter : "",
              countryFilter,
              tierFilter,
              productFilter,
              variantFilter,
              minQuantityFilter,
            ].filter(Boolean).length,
            label: "Filters",
          }}
          columns={{
            visibleColumns: columnVisibility,
            onToggleColumn: (key) => {
              setColumnVisibility((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
            options: columns.map((c) => ({ key: c.key, label: c.label })),
          }}
          leftExtra={
            <Tooltip content="Simulate real-time checkout pricing" side="top">
              <button
                type="button"
                onClick={() => setPreviewOpen(true)}
                className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3.5 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] hover:border-[#D1D1D1] transition-all cursor-pointer shadow-2xs"
              >
                <Eye size={14} className="text-[#E31E24]" />
                <span>Live Preview</span>
              </button>
            </Tooltip>
          }
          primaryAction={
            canCreate
              ? {
                  onClick: () => openCreateForm("BASE_PRICE"),
                  label: "New Pricing Rule",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          exportAction={{
            onClick: () => handleExport(selectedIds.length > 0),
            label: selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export Excel",
            disabled: exportPricing.isPending,
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
              void refetch().then(() => showToast("Pricing rules refreshed.", "success"));
            },
            isRefreshing: isFetching || pricingLoading,
          }}
          filterPanel={
            <div className="space-y-4 pt-2">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
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
                <AdminSelect
                  label="Status"
                  value={statusFilter}
                  onChange={(event) => {
                    setStatusFilter(event.target.value as PricingStatusFilter);
                    setPage(1);
                  }}
                  options={[
                    { value: "ALL", label: "All statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                    { value: "ARCHIVED", label: "Archived" },
                  ]}
                />
                <AdminMultiSearchableSelect
                  label="Country"
                  values={countryFilter ? countryFilter.split(",").filter(Boolean) : []}
                  onValuesChange={(values) => {
                    setCountryFilter(values.join(","));
                    setPage(1);
                  }}
                  options={(countries as any[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                  placeholder="Select countries"
                  allowSelectAll
                  selectAllLabel="All countries"
                />
                <AdminSelect label="Tier" value={tierFilter} onChange={(event) => { setTierFilter(event.target.value); setPage(1); }} options={tierOptions} />
                <AdminSearchableSelect
                  label="Product"
                  value={productFilter}
                  onChange={(event) => {
                    setProductFilter(event.target.value);
                    setVariantFilter("");
                    setPage(1);
                  }}
                  options={productOptions}
                  onSearchChange={setProductSearch}
                  onMenuScrollToBottom={() => {
                    if (hasNextProductsPage && !isFetchingNextProductsPage) {
                      fetchNextProductsPage();
                    }
                  }}
                  isLoadingMore={isFetchingNextProductsPage}
                />
                <AdminSelect label="Variant" value={variantFilter} onChange={(event) => { setVariantFilter(event.target.value); setPage(1); }} options={filterVariantOptions} />
                <AdminInput label="Min Quantity" type="text" value={minQuantityFilter} onChange={(event) => { setMinQuantityFilter(event.target.value.replace(/\D/g, "")); setPage(1); }} />
                <AdminSelect
                  label="Page Size"
                  value={String(limit)}
                  onChange={(event) => {
                    setLimit(Number(event.target.value) || 20);
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
          }
          onResetFilters={() => {
            setSearchInput("");
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
        />

          <DataTable
            title={statusFilter === "ARCHIVED" ? "Archived Pricing Rules" : bulkActionFamily === "base" ? "Base Pricing Rules" : "Override Pricing Rules"}
            columns={dataTableColumns as any}
            data={ruleRows}
            rowKey="id"
            isLoading={pricingLoading}
            emptyMessage={statusFilter === "ARCHIVED" ? "No archived pricing rules found." : "No pricing rules found."}
            enableSelection={canUpdate}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onToggleStatus={statusFilter === "ARCHIVED" ? undefined : toggleStatus}
            statusLoadingId={togglingStatusId}
            totalItems={pagination.total}
            currentPage={page}
            pageSize={limit}
            totalPages={pagination.totalPages ?? 1}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            pageSizeOptions={[20, 50, 100, 500]}
            onSelectAll={handleSelectAll}
            renderBulkActions={(selectedIds) => {
              if (!canUpdate) return null;
              
              const actions = [];
              if (statusFilter === "ARCHIVED") {
                actions.push(
                  { value: "restore", label: "Restore" },
                  { value: "permanentDelete", label: "Permanently Delete" }
                );
              } else {
                if (bulkActionFamily === "base") {
                  actions.push(
                    { value: "enable", label: "Enable" },
                    { value: "disable", label: "Disable" }
                  );
                }
                actions.push(
                  { value: "delete", label: "Delete" },
                  { value: "assignCountryTier", label: "Assign Country & Tier" }
                );
              }

              return (
                <AdminBulkActionsBar
                  selectedCount={selectedIds.length}
                  onClear={() => setSelectedIds([])}
                  actionType={bulkAction}
                  onActionTypeChange={setBulkAction}
                  actions={actions}
                  onApply={() => {
                    if (bulkAction === "restore") handleBulkRestore();
                    else if (bulkAction === "permanentDelete") setShowBulkPermanentModal(true);
                    else if (bulkAction === "enable") runBulkAction("ENABLE");
                    else if (bulkAction === "disable") runBulkAction("DISABLE");
                    else if (bulkAction === "delete") {
                      if (statusFilter === "ARCHIVED") {
                        setShowBulkPermanentModal(true);
                      } else {
                        setShowBulkDeleteModal(true);
                      }
                    }
                    else if (bulkAction === "assignCountryTier") runBulkAssign();
                  }}
                  applyLoading={bulkPricing.isPending || bulkRestorePricing.isPending || bulkPermanentDeletePricing.isPending}
                  applyDisabled={bulkAction === "assignCountryTier" && !bulkCountryId && !bulkTierId}
                  renderExtraSelectors={() => (
                    <>
                      {bulkAction === "assignCountryTier" && (
                        <div className="flex items-center gap-2 max-w-sm">
                          <div className="w-36">
                            <AdminSearchableSelect
                              value={bulkCountryId}
                              onChange={(event) => setBulkCountryId(event.target.value)}
                              options={bulkCountryOptions}
                              placeholder="Select country"
                            />
                          </div>
                          <div className="w-36">
                            <AdminSelect
                              value={bulkTierId}
                              onChange={(event) => setBulkTierId(event.target.value)}
                              options={bulkTierOptions}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  )}
                />
              );
            }}
          />

          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={pagination.totalPages ?? 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
      </div>

      <Modal
        open={showForm}
        onClose={resetForm}
        title={form.values.id ? "Edit pricing rule" : "New pricing rule"}
        subtitle="Configure base prices, country pricing, tier overrides, or role-specific pricing rules."
        size="4xl"
        panelClassName="max-w-5xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="text-[12px] text-[#6B6B6B]">
              Priority is currently enforced by the existing resolver hierarchy: Customer Specific, Tier, Country, Variant, MOQ, Base Price.
            </div>
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
                form="pricing-rule-form"
                loading={form.isSubmitting || createPricing.isPending || updatePricing.isPending}
                loadingText="Processing..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
              >
                {form.values.id ? "Save Changes" : "Create Rule"}
              </LoadingButton>
            </div>
          </div>
        }
      >
        {showForm ? (
          <form id="pricing-rule-form" onSubmit={form.handleSubmit} className="space-y-6 p-6">
            {form.values.id ? (
              <div className="rounded-md bg-[#F8F9FA] border border-[#E6E6E6] px-3.5 py-2 text-[12.5px] text-[#5A5A5A] flex items-center gap-1.5">
                <span>
                  Product, Variant, and Country are locked. To change them, use the{" "}
                  <span className="inline-flex items-center gap-1 font-semibold text-[#E31E24]">
                    Duplicate / Copy{" "}
                    <span className="inline-flex h-4 w-4 items-center justify-center rounded border border-[#E6E6E6] bg-white text-emerald-600">
                      <Copy size={9} />
                    </span>
                  </span>{" "}
                  action from the main list.
                </span>
              </div>
            ) : null}
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <AdminSelect
                label="Rule Type"
                {...form.getFieldProps("ruleType")}
                error={form.errors.ruleType as string}
                options={Object.entries(ruleTypeLabels).map(([value, label]) => ({ value, label }))}
              />
              <div className="flex flex-col">
                {form.values.id ? (
                  <AdminSearchableSelect
                    label="Product"
                    required
                    disabled
                    value={form.values.productId}
                    onChange={(event) => form.setValues((current) => ({ ...current, productId: event.target.value }))}
                    options={productOptions}
                    onSearchChange={setProductSearch}
                  />
                ) : (
                  <AdminMultiSearchableSelect
                    label="Products"
                    required
                    values={form.values.productIds ?? []}
                    onValuesChange={(values) => form.setValues((current) => ({ ...current, productIds: values }))}
                    options={products.map((p) => ({ value: p.id, label: p.sku ? `${p.title} (${p.sku})` : p.title }))}
                    placeholder="Select products"
                    allowSelectAll
                    selectAllLabel="All products"
                    onMenuScrollToBottom={() => {
                      if (hasNextProductsPage && !isFetchingNextProductsPage) {
                        fetchNextProductsPage();
                      }
                    }}
                    isLoadingMore={isFetchingNextProductsPage}
                  />
                )}
                {form.errors.productId && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.productId as string}</span>}
              </div>
              <div className="flex flex-col">
                {form.values.id ? (
                  <AdminSelect
                    label="Variant"
                    disabled
                    value={form.values.variantId}
                    options={variantOptions}
                  />
                ) : (form.values.productIds ?? []).length === 1 ? (
                  <AdminMultiSearchableSelect
                    label="Variants"
                    values={form.values.variantIds ?? []}
                    onValuesChange={(values) => form.setValues((current) => ({ ...current, variantIds: values }))}
                    options={variantOptions.filter((o) => o.value !== "")}
                    placeholder="Select variants"
                    allowSelectAll
                    selectAllLabel="All variants"
                  />
                ) : (
                  <AdminSelect
                    label="Variant"
                    disabled
                    value=""
                    options={[{ value: "", label: "All Variants (Select single product)" }]}
                  />
                )}
                {form.errors.variantId && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.variantId as string}</span>}
              </div>
              <div className="flex flex-col">
                {form.values.id ? (
                  <AdminSearchableSelect
                    label="Country"
                    required
                    disabled
                    value={form.values.countryId}
                    onChange={(event) => form.setValues((current) => ({ ...current, countryId: event.target.value }))}
                    options={(countries as any[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                    placeholder="Select country"
                  />
                ) : (
                  <AdminMultiSearchableSelect
                    label="Countries"
                    required
                    values={form.values.countryIds ?? []}
                    onValuesChange={(values) => form.setValues((current) => ({ ...current, countryIds: values }))}
                    options={(countries as any[]).map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }))}
                    placeholder="Select countries"
                    allowSelectAll
                    selectAllLabel="All countries"
                  />
                )}
                {form.errors.countryId && <span className="text-red-500 text-[11.5px] mt-1">{form.errors.countryId as string}</span>}
              </div>
              <AdminSelect label="Status" {...form.getFieldProps("status")} error={form.errors.status as string} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />
              <AdminSelect
                label="Customer Role"
                {...form.getFieldProps("customerRoleKey")}
                error={form.errors.customerRoleKey as string}
                options={customerRoleOptions}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {form.values.ruleType === "TIER_PRICE" ? (
                <>
                  <AdminSelect label="Tier" {...form.getFieldProps("tierId")} error={form.errors.tierId as string} options={tierOptions} />
                  <AdminInput label="Discount %" type="text" {...form.getFieldProps("discountPercent")} error={form.errors.discountPercent as string} />
                  <AdminInput label="Fixed Price" type="text" {...form.getFieldProps("fixedPrice")} error={form.errors.fixedPrice as string} />
                </>
              ) : null}

              {form.values.ruleType === "MOQ_PRICE" ? (
                <>
                  <AdminInput label="Minimum Quantity" type="text" {...form.getFieldProps("minQuantity")} error={form.errors.minQuantity as string} />
                  <AdminInput label="Discount %" type="text" {...form.getFieldProps("discountPercent")} error={form.errors.discountPercent as string} />
                  <AdminInput label="Fixed Price" type="text" {...form.getFieldProps("fixedPrice")} error={form.errors.fixedPrice as string} />
                </>
              ) : null}

              {form.values.ruleType === "BASE_PRICE" || form.values.ruleType === "VARIANT_PRICE" || form.values.ruleType === "CUSTOMER_ROLE_PRICE" ? (
                (() => {
                  const currentRole = form.values.customerRoleKey;
                  const isDealerRequired = currentRole === "" || currentRole === "DEALER";
                  const isDistributorRequired = currentRole === "" || currentRole === "DOCTOR_RETAILER";
                  return (
                    <>
                      <AdminInput label="MRP" required type="text" {...form.getFieldProps("mrp")} error={form.errors.mrp as string} />
                      <AdminInput label="Selling Price" required type="text" {...form.getFieldProps("sellingPrice")} error={form.errors.sellingPrice as string} />
                      <AdminInput label="Dealer Price" required={isDealerRequired} type="text" {...form.getFieldProps("dealerPrice")} error={form.errors.dealerPrice as string} />
                      <AdminInput label="Doctor / Retailer Price" required={isDistributorRequired} type="text" {...form.getFieldProps("distributorPrice")} error={form.errors.distributorPrice as string} />
                    </>
                  );
                })()
              ) : null}
            </div>
          </form>
        ) : null}
      </Modal>

      <Modal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        title="Live Pricing Preview"
        subtitle="Preview final prices for variants based on rules, country taxes, roles, and quantities."
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setPreviewOpen(false)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <div className="flex items-center justify-end pb-1">
            <button type="button" onClick={() => setPreviewInput(emptyPreview)} className="text-[12.5px] font-semibold text-[#E31E24] hover:underline shrink-0 cursor-pointer">
              Reset Filters
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <AdminSearchableSelect
              label="Product"
              value={previewInput.productId}
              onChange={(event) => setPreviewInput((current) => ({ ...current, productId: event.target.value, variantId: "" }))}
              options={productOptions}
              onSearchChange={setProductSearch}
              onMenuScrollToBottom={() => {
                if (hasNextProductsPage && !isFetchingNextProductsPage) {
                  fetchNextProductsPage();
                }
              }}
              isLoadingMore={isFetchingNextProductsPage}
            />
            <AdminSelect
              label="Variant"
              value={previewInput.variantId}
              onChange={(event) => setPreviewInput((current) => ({ ...current, variantId: event.target.value }))}
              options={previewVariantOptions}
            />
            <AdminSearchableSelect
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
            <AdminInput label="Quantity" type="text" value={previewInput.quantity} onChange={(event) => setPreviewInput((current) => ({ ...current, quantity: event.target.value.replace(/\D/g, "") }))} />
          </div>

          <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
            {previewLoading ? (
              <p className="text-[13px] text-[#6B6B6B]">Loading preview...</p>
            ) : previewError ? (
              <p className="text-[13px] text-red-600">{getAdminErrorMessage(previewError, "Preview failed.")}</p>
            ) : resolutionPreview ? (
              <div className="space-y-4">
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
                  <ul className="mt-2 space-y-2 max-h-40 overflow-y-auto">
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
              <p className="text-[13px] text-[#6B6B6B] text-center py-4">Choose product and country to preview the final price.</p>
            )}
          </div>
        </div>
      </Modal>

      <AdminImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Pricing Rules"
        subtitle="Upload an .xlsx or .csv file to bulk configure pricing rules with live preview & direct inline editing."
        entityName="pricing rules"
        columns={pricingWizardColumns}
        expectedColumns={pricingExpectedColumns}
        sampleTemplateUrl="/pricing/sample-template"
        sampleTemplateFilename="pricing-template.xlsx"
        previewEndpoint="/pricing/import/preview"
        executeEndpoint="/pricing/import"
        onSuccess={(result) => {
          showToast(
            `Import complete: ${result?.created ?? 0} created, ${result?.updated ?? 0} updated.`,
            "success"
          );
          void refetch();
        }}
      />

      {/* READ-ONLY PRICING RULE VIEW MODAL */}
      <Modal
        open={!!viewingRule}
        onClose={() => setViewingRule(null)}
        title={viewingRule?.ruleName ?? "Pricing Rule Details"}
        subtitle="Detailed configuration, scope, and resolution tier for this pricing record."
        size="2xl"
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <span className="text-[12px] text-[#6B6B6B]">
              Rule ID: <span className="font-mono text-[#1A1A1A]">{viewingRule?.id}</span>
            </span>
            <div className="flex items-center gap-2">
              {canUpdate && viewingRule && (
                <button
                  type="button"
                  onClick={() => {
                    const rule = viewingRule;
                    setViewingRule(null);
                    openEditForm(rule);
                  }}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
                >
                  Edit Rule
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingRule(null)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        }
      >
        {viewingRule && (
          <div className="p-6 space-y-5">
            {/* Primary Details Grid */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Rule Name</span>
                <p className="mt-1 text-[14px] font-semibold text-[#1A1A1A] truncate">{viewingRule.ruleName}</p>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Rule Type</span>
                <p className="mt-1 text-[14px] font-semibold text-[#1A1A1A]">{ruleTypeLabels[viewingRule.ruleType] || viewingRule.ruleType}</p>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Status</span>
                <div className="mt-1"><StatusBadge status={viewingRule.status} /></div>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Base / Selling Price</span>
                <p className="mt-1 text-[14px] font-bold text-[#E31E24]">
                  {formatMoney(viewingRule.basePrice, viewingRule.details?.currency?.symbol)}
                </p>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">MRP / List Price</span>
                <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A]">
                  {viewingRule.details?.mrp != null ? formatMoney(viewingRule.details.mrp, viewingRule.details?.currency?.symbol) : "—"}
                </p>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Priority / Order</span>
                <p className="mt-1 text-[13.5px] font-semibold text-[#1A1A1A]">
                  Priority {viewingRule.priority} (Order {ruleResolutionOrder(viewingRule.ruleType)})
                </p>
              </div>
            </div>

            {/* Scope / Assignment Section */}
            <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-3">
              <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Scope & Target Assignment</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-[13px]">
                <div>
                  <span className="text-[#9A9A9A]">Product: </span>
                  <span className="font-semibold text-[#1A1A1A]">{viewingRule.product?.title || "—"}</span>
                  {viewingRule.product?.sku && <span className="text-[11.5px] text-[#6B6B6B] ml-1">({viewingRule.product.sku})</span>}
                </div>
                <div>
                  <span className="text-[#9A9A9A]">Variant: </span>
                  <span className="font-medium text-[#1A1A1A]">{viewingRule.variant?.title || "All Variants"}</span>
                </div>
                <div>
                  <span className="text-[#9A9A9A]">Country: </span>
                  <span className="font-medium text-[#1A1A1A]">
                    {viewingRule.country ? `${viewingRule.country.name} (${viewingRule.country.code})` : "All Countries (Global)"}
                  </span>
                </div>
                <div>
                  <span className="text-[#9A9A9A]">Customer Tier: </span>
                  <span className="font-medium text-[#1A1A1A]">{viewingRule.tier?.name || "All Tiers"}</span>
                </div>
                <div>
                  <span className="text-[#9A9A9A]">Customer Role: </span>
                  <span className="font-medium text-[#1A1A1A]">
                    {viewingRule.customerRole ? getCustomerRoleLabel(viewingRule.customerRole) : "Global / All Roles"}
                  </span>
                </div>
                <div>
                  <span className="text-[#9A9A9A]">Min Quantity (MOQ): </span>
                  <span className="font-medium text-[#1A1A1A]">{viewingRule.moq ?? "1"}</span>
                </div>
              </div>
            </div>

            {/* Additional Pricing & Discount Details if present */}
            {(viewingRule.details?.dealerPrice != null ||
              viewingRule.details?.distributorPrice != null ||
              viewingRule.details?.discountPercent != null ||
              viewingRule.details?.fixedPrice != null) && (
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-2">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Special Pricing Breakdown</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[13px] pt-1">
                  {viewingRule.details?.discountPercent != null && (
                    <div>
                      <span className="text-[#9A9A9A] text-[11.5px] block">Discount</span>
                      <span className="font-bold text-emerald-600">{Number(viewingRule.details.discountPercent).toFixed(2)}%</span>
                    </div>
                  )}
                  {viewingRule.details?.dealerPrice != null && (
                    <div>
                      <span className="text-[#9A9A9A] text-[11.5px] block">Dealer Price</span>
                      <span className="font-semibold text-[#1A1A1A]">{formatMoney(viewingRule.details.dealerPrice, viewingRule.details?.currency?.symbol)}</span>
                    </div>
                  )}
                  {viewingRule.details?.distributorPrice != null && (
                    <div>
                      <span className="text-[#9A9A9A] text-[11.5px] block">Distributor Price</span>
                      <span className="font-semibold text-[#1A1A1A]">{formatMoney(viewingRule.details.distributorPrice, viewingRule.details?.currency?.symbol)}</span>
                    </div>
                  )}
                  {viewingRule.details?.fixedPrice != null && (
                    <div>
                      <span className="text-[#9A9A9A] text-[11.5px] block">Fixed Price</span>
                      <span className="font-semibold text-[#1A1A1A]">{formatMoney(viewingRule.details.fixedPrice, viewingRule.details?.currency?.symbol)}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Timestamps */}
            <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-3 text-[12px] text-[#9A9A9A]">
              <span>Created: {viewingRule.createdAt ? formatDate(viewingRule.createdAt) : "—"}</span>
              <span>Last Modified: {viewingRule.updatedAt ? formatDate(viewingRule.updatedAt) : "—"}</span>
            </div>
          </div>
        )}
      </Modal>

      <AdminDeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        itemName={deleteTarget ? `${deleteTarget.ruleName}` : undefined}
        itemType="Pricing Rule"
        warningMessage={
          deleteTarget?.deletedAt || statusFilter === "ARCHIVED"
            ? "Choose the deletion method for this pricing rule. Soft Delete is recommended to maintain pricing audit logs and historical sales analytics."
            : "Choose the deletion method for this pricing rule. Soft Delete hides it from active checkout resolution while preserving pricing logs."
        }
        softDeleteDescription={
          deleteTarget?.deletedAt || statusFilter === "ARCHIVED"
            ? "This pricing rule is already soft-deleted and stored in the central Archive."
            : undefined
        }
        permanentDeleteDescription={
          deleteTarget
            ? `Physically and permanently purges pricing rule "${deleteTarget.ruleName}" from the database. Allowed ONLY if a fallback active base price remains or parent product is inactive/archived.`
            : undefined
        }
        permanentDeleteDisabled={Boolean(deleteTarget && deleteTarget.canPermanentDelete === false)}
        permanentDeleteDisabledReason={deleteTarget?.permanentDeleteBlockReason ?? undefined}
        initialDeleteType={
          deleteTarget?.deletedAt || statusFilter === "ARCHIVED"
            ? "permanent"
            : "soft"
        }
        onSoftDelete={
          deleteTarget?.deletedAt || statusFilter === "ARCHIVED"
            ? () => {
                showToast("Pricing rule is already archived.");
                setDeleteTarget(null);
              }
            : () => {
                if (deleteTarget) return handleDelete(deleteTarget);
              }
        }
        onPermanentDelete={() => {
          if (deleteTarget) return handlePermanentDelete(deleteTarget);
        }}
        isSoftDeleting={deletePricing.isPending}
        isPermanentDeleting={permanentDeletePricing.isPending}
      />

      {/* ─── Bulk Delete Modal (Matching Product / Variant / Review standard) ─── */}
      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected pricing rules`}
        itemType="Pricing Rules (Bulk)"
        warningMessage="Choose the deletion method for the selected pricing rules. Soft Delete is recommended for maintaining catalog pricing and quote history."
        softDeleteDescription={`Hides the ${selectedIds.length} selected pricing rules from active resolution while preserving historical orders, quotes, and audit trails.`}
        permanentDeleteDescription={`Permanently purges the ${selectedIds.length} selected pricing rules from the database. Any sole active base price rule will be protected.`}
        onSoftDelete={handleBulkSoftDelete}
        onPermanentDelete={() => {
          setShowBulkDeleteModal(false);
          setShowBulkPermanentModal(true);
        }}
        isSoftDeleting={bulkSaving || bulkPricing.isPending}
        isPermanentDeleting={bulkPermanentDeletePricing.isPending}
      />

      {/* ─── Bulk Permanent Delete Confirmation Modal ─── */}
      <Modal
        open={showBulkPermanentModal}
        onClose={() => !(bulkSaving || bulkPermanentDeletePricing.isPending) && setShowBulkPermanentModal(false)}
        title={`Permanently Delete ${selectedIds.length} PRICING Record${selectedIds.length > 1 ? "s" : ""}`}
        subtitle="Physical database purge with authoritative fallback resolution check."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2 w-full">
            <button
              type="button"
              disabled={bulkSaving || bulkPermanentDeletePricing.isPending}
              onClick={() => setShowBulkPermanentModal(false)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={bulkSaving || bulkPermanentDeletePricing.isPending}
              onClick={handleConfirmBulkPermanentDelete}
              className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
            >
              <Trash2 size={14} />
              {bulkSaving || bulkPermanentDeletePricing.isPending ? "Evaluating & Deleting..." : "Permanently Delete"}
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
            You have selected <span className="font-bold">{selectedIds.length}</span> record{selectedIds.length > 1 ? "s" : ""} from the{" "}
            <span className="font-semibold uppercase tracking-wide">PRICING</span> archive for permanent deletion.
          </div>

          <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 text-[12.5px] text-[#555] space-y-2">
            <span className="font-semibold text-[#1A1A1A] block">Authoritative Data Integrity Protection:</span>
            <p>
              Every selected record is individually verified by backend resolver safety rules before deletion.
            </p>
            <p>
              Any base price that is the sole active pricing rule for a product/variant in that country will be <strong className="text-[#1A1A1A]">strictly protected</strong> and skipped.
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
              ? `All ${bulkPermanentResult.blockedCount || bulkPermanentResult.totalSelected} selected records are protected by pricing resolver integrity rules.`
              : bulkPermanentResult.blockedCount === 0
              ? `All ${bulkPermanentResult.totalSelected} selected records were permanently purged from the database.`
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
                  All {bulkPermanentResult.deletedCount} selected records were permanently removed from the database.
                </span>
              </div>
            )}

            {bulkPermanentResult.deletedCount === 0 && bulkPermanentResult.blockedCount > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[12.5px] text-red-900">
                <XCircle size={16} className="shrink-0 text-red-600" />
                <span>
                  All {bulkPermanentResult.blockedCount} records could not be permanently deleted because they are protected sole active prices or lack required fallbacks.
                </span>
              </div>
            )}

            {bulkPermanentResult.deletedCount > 0 && bulkPermanentResult.blockedCount > 0 && (
              <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[12.5px] text-amber-900">
                <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                <span>
                  Partial completion: {bulkPermanentResult.deletedCount} records deleted, {bulkPermanentResult.blockedCount} records preserved by safety rules.
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
                      <span className="rounded bg-red-100 text-red-700 px-2 py-0.5 text-[10.5px] font-medium shrink-0">
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
