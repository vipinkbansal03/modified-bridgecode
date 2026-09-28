"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  FolderTree,
  Package,
  ShoppingCart,
  Users,
  RotateCcw,
  Trash2,
  Eye,
  Info,
  Layers,
  Calendar,
  AlertTriangle,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  XCircle,
  Tag,
  Clock,
  ExternalLink,
  MessageSquareQuote,
  MessageSquare,
  Star,
  Warehouse,
  Sliders,
  Percent,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminListToolbar,
  DataTable,
  type Column,
  ConfirmModal,
  Pagination,
  StatusBadge,
  useToast,
  AdminSelect,
  AdminStatsGrid,
  Modal,
  AdminDeleteModal,
} from "@/components/admin/AdminComponents";
import { OrderDetailModal } from "@/components/admin/orders/OrderDetailModal";
import { QuoteDetailModal } from "@/components/admin/quotes/QuoteDetailModal";
import { WarehouseDetailModal } from "@/components/admin/warehouses/WarehouseDetailModal";
import { AdminBulkActionsBar } from "@/components/admin/AdminBulkActionsBar";
import {
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminRowActions";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  useAdminArchivedAttributes,
  useRestoreAttribute,
  usePermanentDeleteAttribute,
  useBulkPermanentDeleteAttributes,
  useAdminArchivedCategories,
  useRestoreCategory,
  usePermanentDeleteCategory,
  useBulkPermanentDeleteCategories,
  useAdminArchivedProducts,
  useRestoreProduct,
  usePermanentDeleteProduct,
  useBulkPermanentDeleteProducts,
  useAdminCategories,
  useAdminArchivedOrders,
  useRestoreOrder,
  usePermanentDeleteOrder,
  useBulkPermanentDeleteOrders,
  useAdminArchivedCustomers,
  useRestoreCustomer,
  useAdminArchivedQuotes,
  useRestoreAdminQuote,
  usePermanentDeleteAdminQuote,
  useBulkPermanentDeleteQuotes,
  useAdminArchivedReviews,
  useRestoreReview,
  usePermanentDeleteReview,
  useBulkPermanentDeleteReviews,
  useAdminArchivedWarehouses,
  useRestoreWarehouse,
  usePermanentDeleteWarehouse,
  useBulkPermanentDeleteWarehouses,
  useAdminArchivedVariants,
  useRestoreVariant,
  usePermanentDeleteVariant,
  useBulkPermanentDeleteVariants,
  useAdminArchivedPricing,
  useRestorePricing,
  usePermanentDeletePricing,
  useBulkPermanentDeletePricing,
  useAdminArchivedTiers,
  useRestoreTier,
  usePermanentDeleteTier,
  useBulkPermanentDeleteTiers,
  useAdminArchivedDiscounts,
  useRestoreDiscount,
  usePermanentDeleteDiscount,
  useBulkPermanentDeleteDiscounts,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime } from "@/utils/formatDate";

type ArchiveTab =
  | "attributes"
  | "categories"
  | "customers"
  | "discounts"
  | "orders"
  | "pricing"
  | "products"
  | "quotes"
  | "reviews"
  | "tiers"
  | "variants"
  | "warehouses";

interface RestoringItem {
  type: ArchiveTab;
  id: string;
  name: string;
  productId?: string;
}


function AdminArchiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAdminAuth();
  const { showToast } = useToast();

  // Permissions
  const canManageAttributes =
    hasPermission("attributes.manage") || hasPermission("attributes.update");
  const canDeleteAttributes =
    hasPermission("attributes.delete") || hasPermission("attributes.manage");
  const canManageCategories =
    hasPermission("categories.manage") || hasPermission("categories.update");
  const canManageProducts =
    hasPermission("products.update") || hasPermission("products.manage");
  const canDeleteProducts =
    hasPermission("products.delete") || hasPermission("products.manage");
  const canManageOrders = hasPermission("orders.manage");
  const canDeleteOrders =
    hasPermission("orders.delete") || hasPermission("orders.manage");
  const canManageCustomers =
    hasPermission("customers.manage") || hasPermission("customers.update");
  const canManageQuotes =
    hasPermission("quotes.manage") || hasPermission("quotes.update");
  const canDeleteQuotes =
    hasPermission("quotes.delete") || hasPermission("quotes.manage");
  const canManageReviews =
    hasPermission("reviews.update") ||
    hasPermission("products.update") ||
    hasPermission("products.manage");
  const canDeleteReviews =
    hasPermission("reviews.delete") ||
    hasPermission("products.delete") ||
    hasPermission("products.manage");
  const canManageWarehouses = hasPermission("inventory.manage");
  const canManagePricing =
    hasPermission("pricing.manage") || hasPermission("pricing.update");
  const canDeletePricing =
    hasPermission("pricing.delete") || hasPermission("pricing.manage");
  const canManageDiscounts =
    hasPermission("discounts.update") || hasPermission("discounts.manage");
  const canDeleteDiscounts =
    hasPermission("discounts.delete") || hasPermission("discounts.manage");
  const canManageTiers =
    hasPermission("tiers.update") || hasPermission("tiers.manage");
  const canDeleteTiers =
    hasPermission("tiers.delete") || hasPermission("tiers.manage");

  // Tab State
  const tabFromUrl = searchParams.get("tab") as ArchiveTab | null;
  const [activeTab, setActiveTab] = useState<ArchiveTab>(
    tabFromUrl && ["attributes", "categories", "customers", "discounts", "orders", "pricing", "products", "quotes", "reviews", "tiers", "variants", "warehouses"].includes(tabFromUrl)
      ? tabFromUrl
      : "attributes"
  );

  const handleTabChange = (tab: ArchiveTab) => {
    setActiveTab(tab);
    setPage(1);
    setSearch("");
    setDebouncedSearch("");
    setShowFilters(false);
    setSelectedIds([]);
    setBulkAction("");
    const params = new URLSearchParams(window.location.search);
    params.set("tab", tab);
    router.replace(`/admin/archive?${params.toString()}`);
  };

  // Shared Toolbar / Filter State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  // Tab-Specific Filters
  const [productCategoryId, setProductCategoryId] = useState("");
  const [productStatus, setProductStatus] = useState("");
  const [orderStatus, setOrderStatus] = useState("");
  const [orderPaymentStatus, setOrderPaymentStatus] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [customerApprovalStatus, setCustomerApprovalStatus] = useState("");
  const [quoteStatus, setQuoteStatus] = useState("");
  const [reviewStatus, setReviewStatus] = useState("");

  // Sort State
  const [sortBy, setSortBy] = useState<string>("deletedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [showBulkRestoreModal, setShowBulkRestoreModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [isSelectingAll, setIsSelectingAll] = useState(false);

  // Column Visibility State per Tab
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    name: true,
    title: true,
    orderNumber: true,
    parent: true,
    sku: true,
    category: true,
    customer: true,
    contact: true,
    company: true,
    role: true,
    total: true,
    status: true,
    paymentStatus: true,
    archivedAt: true,
    actions: true,
    product: true,
    rating: true,
    feedback: true,
  });

  const toggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Modals State
  const [viewingAttribute, setViewingAttribute] = useState<any | null>(null);
  const [viewingCategory, setViewingCategory] = useState<any | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);
  const [viewingVariant, setViewingVariant] = useState<any | null>(null);
  const [viewingOrderId, setViewingOrderId] = useState<string | null>(null);
  const [viewingQuoteId, setViewingQuoteId] = useState<string | null>(null);
  const [viewingWarehouse, setViewingWarehouse] = useState<any | null>(null);
  const [viewingReview, setViewingReview] = useState<any | null>(null);
  const [viewingPricing, setViewingPricing] = useState<any | null>(null);
  const [restoringItem, setRestoringItem] = useState<RestoringItem | null>(null);
  const [deletingCategory, setDeletingCategory] = useState<any | null>(null);
  const [deletingProduct, setDeletingProduct] = useState<any | null>(null);
  const [deletingAttribute, setDeletingAttribute] = useState<any | null>(null);
  const [deletingVariant, setDeletingVariant] = useState<any | null>(null);
  const [deletingOrder, setDeletingOrder] = useState<any | null>(null);
  const [deletingQuote, setDeletingQuote] = useState<any | null>(null);
  const [deletingWarehouse, setDeletingWarehouse] = useState<any | null>(null);
  const [deletingReview, setDeletingReview] = useState<any | null>(null);
  const [deletingPricing, setDeletingPricing] = useState<any | null>(null);
  const [deletingTier, setDeletingTier] = useState<any | null>(null);
  const [deletingDiscount, setDeletingDiscount] = useState<any | null>(null);
  const [showBulkPermanentModal, setShowBulkPermanentModal] = useState(false);
  const [bulkPermanentResult, setBulkPermanentResult] = useState<any | null>(null);

  // Aux Data
  const { data: categoriesOptions = [] } = useAdminCategories();

  // Queries
  const attributesQuery = useAdminArchivedAttributes();
  const categoriesQuery = useAdminArchivedCategories();
  const productsQuery = useAdminArchivedProducts({
    page,
    limit,
    search: debouncedSearch || undefined,
    categoryId: productCategoryId || undefined,
    status: productStatus || undefined,
    sortBy,
    sortDir,
  });
  const variantsQuery = useAdminArchivedVariants({
    page,
    limit,
    search: debouncedSearch || undefined,
    sortBy,
    sortDir,
  });
  const ordersQuery = useAdminArchivedOrders({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: orderStatus || undefined,
    paymentStatus: orderPaymentStatus || undefined,
    sortBy,
    sortDir,
  });
  const customersQuery = useAdminArchivedCustomers({
    page,
    limit,
    search: debouncedSearch || undefined,
    customerType: customerType || undefined,
    approvalStatus: customerApprovalStatus || undefined,
    sortBy,
    sortDir,
  });
  const quotesQuery = useAdminArchivedQuotes({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: quoteStatus || undefined,
    sortBy,
    sortDir,
  });
  const reviewsQuery = useAdminArchivedReviews({
    page,
    limit,
    search: debouncedSearch || undefined,
    status: reviewStatus || undefined,
    sortBy: "createdAt",
    sortDir: "desc",
  });
  const warehousesQuery = useAdminArchivedWarehouses({
    page,
    limit,
    search: debouncedSearch || undefined,
  });
  const pricingQuery = useAdminArchivedPricing({
    page,
    limit,
    search: debouncedSearch || undefined,
    sortBy: sortBy === "deletedAt" ? "updatedAt" : sortBy,
    sortDir,
  });
  const tiersQuery = useAdminArchivedTiers({
    page,
    limit,
    search: debouncedSearch || undefined,
    sortBy: sortBy === "deletedAt" ? "updatedAt" : sortBy,
    sortDir,
  });
  const discountsQuery = useAdminArchivedDiscounts({
    page,
    limit,
    search: debouncedSearch || undefined,
    sortBy: sortBy === "deletedAt" ? "updatedAt" : sortBy,
    sortDir,
  });

  // Mutations
  const restoreAttributeMutation = useRestoreAttribute();
  const permanentDeleteAttributeMutation = usePermanentDeleteAttribute();
  const bulkPermanentDeleteAttributesMutation = useBulkPermanentDeleteAttributes();
  const restoreCategoryMutation = useRestoreCategory();
  const permanentDeleteCategoryMutation = usePermanentDeleteCategory();
  const bulkPermanentDeleteCategoriesMutation = useBulkPermanentDeleteCategories();
  const restoreProductMutation = useRestoreProduct();
  const permanentDeleteProductMutation = usePermanentDeleteProduct();
  const bulkPermanentDeleteProductsMutation = useBulkPermanentDeleteProducts();
  const restoreVariantMutation = useRestoreVariant();
  const permanentDeleteVariantMutation = usePermanentDeleteVariant();
  const bulkPermanentDeleteVariantsMutation = useBulkPermanentDeleteVariants();
  const restoreOrderMutation = useRestoreOrder();
  const permanentDeleteOrderMutation = usePermanentDeleteOrder();
  const bulkPermanentDeleteOrdersMutation = useBulkPermanentDeleteOrders();
  const restoreCustomerMutation = useRestoreCustomer();
  const restoreQuoteMutation = useRestoreAdminQuote();
  const permanentDeleteQuoteMutation = usePermanentDeleteAdminQuote();
  const bulkPermanentDeleteQuotesMutation = useBulkPermanentDeleteQuotes();
  const restoreReviewMutation = useRestoreReview();
  const permanentDeleteReviewMutation = usePermanentDeleteReview();
  const bulkPermanentDeleteReviewsMutation = useBulkPermanentDeleteReviews();
  const restoreWarehouseMutation = useRestoreWarehouse();
  const permanentDeleteWarehouseMutation = usePermanentDeleteWarehouse();
  const bulkPermanentDeleteWarehousesMutation = useBulkPermanentDeleteWarehouses();
  const restorePricingMutation = useRestorePricing();
  const permanentDeletePricingMutation = usePermanentDeletePricing();
  const bulkPermanentDeletePricingMutation = useBulkPermanentDeletePricing();
  const restoreTierMutation = useRestoreTier();
  const permanentDeleteTierMutation = usePermanentDeleteTier();
  const bulkPermanentDeleteTiersMutation = useBulkPermanentDeleteTiers();
  const restoreDiscountMutation = useRestoreDiscount();
  const permanentDeleteDiscountMutation = usePermanentDeleteDiscount();
  const bulkPermanentDeleteDiscountsMutation = useBulkPermanentDeleteDiscounts();

  // Filter Active Counts
  const activeFiltersCount = useMemo(() => {
    if (activeTab === "products") {
      return [productCategoryId, productStatus].filter(Boolean).length;
    }
    if (activeTab === "orders") {
      return [orderStatus, orderPaymentStatus].filter(Boolean).length;
    }
    if (activeTab === "customers") {
      return [customerType, customerApprovalStatus].filter(Boolean).length;
    }
    if (activeTab === "quotes") {
      return [quoteStatus].filter(Boolean).length;
    }
    if (activeTab === "reviews") {
      return [reviewStatus].filter(Boolean).length;
    }
    return 0;
  }, [
    activeTab,
    productCategoryId,
    productStatus,
    orderStatus,
    orderPaymentStatus,
    customerType,
    customerApprovalStatus,
    quoteStatus,
    reviewStatus,
  ]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setProductCategoryId("");
    setProductStatus("");
    setOrderStatus("");
    setOrderPaymentStatus("");
    setCustomerType("");
    setCustomerApprovalStatus("");
    setQuoteStatus("");
    setReviewStatus("");
    setPage(1);
    setSelectedIds([]);
  };

  // Restore Confirmation Handler (Single)
  const handleConfirmRestore = async () => {
    if (!restoringItem) return;
    try {
      if (restoringItem.type === "attributes") {
        await restoreAttributeMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "categories") {
        await restoreCategoryMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "products") {
        await restoreProductMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "orders") {
        await restoreOrderMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "customers") {
        await restoreCustomerMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "quotes") {
        await restoreQuoteMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "reviews") {
        await restoreReviewMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "variants") {
        if (!restoringItem.productId) throw new Error("Variant missing parent product reference.");
        await restoreVariantMutation.mutateAsync({
          productId: restoringItem.productId,
          variantId: restoringItem.id,
        });
      } else if (restoringItem.type === "warehouses") {
        await restoreWarehouseMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "pricing") {
        await restorePricingMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "tiers") {
        await restoreTierMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "discounts") {
        await restoreDiscountMutation.mutateAsync(restoringItem.id);
      }
      showToast(`${restoringItem.name} restored successfully.`, "success");
      setRestoringItem(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to restore record."), "error");
    }
  };

  const fetchAllArchivedIdsForTab = async (tab: ArchiveTab): Promise<string[]> => {
    switch (tab) {
      case "variants": {
        const res = await adminApi.get("/products/variants", {
          params: {
            search: debouncedSearch || undefined,
            status: "ARCHIVED",
            idsOnly: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
            sortBy,
            sortDir,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((v: any) => v.id);
      }
      case "products": {
        const res = await adminApi.get("/products", {
          params: {
            search: debouncedSearch || undefined,
            categoryId: productCategoryId || undefined,
            status: productStatus || undefined,
            deleted: "true",
            idsOnly: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
            sortBy,
            sortDir,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((p: any) => p.id);
      }
      case "orders": {
        const res = await adminApi.get("/orders", {
          params: {
            search: debouncedSearch || undefined,
            status: orderStatus || undefined,
            paymentStatus: orderPaymentStatus || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
            sortBy,
            sortDir,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((o: any) => o.id);
      }
      case "customers": {
        const res = await adminApi.get("/customers", {
          params: {
            search: debouncedSearch || undefined,
            customerType: customerType || undefined,
            approvalStatus: customerApprovalStatus || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
            sortBy,
            sortDir,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((c: any) => c.id);
      }
      case "quotes": {
        const res = await adminApi.get("/quotes", {
          params: {
            search: debouncedSearch || undefined,
            status: quoteStatus || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
            sortBy,
            sortDir,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((q: any) => q.id);
      }
      case "reviews": {
        const res = await adminApi.get("/reviews", {
          params: {
            search: debouncedSearch || undefined,
            status: reviewStatus || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((r: any) => r.id);
      }
      case "warehouses": {
        const res = await adminApi.get("/warehouses", {
          params: {
            search: debouncedSearch || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((w: any) => w.id);
      }
      case "pricing": {
        const res = await adminApi.get("/pricing", {
          params: {
            search: debouncedSearch || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((p: any) => p.id);
      }
      case "tiers": {
        const res = await adminApi.get("/tiers", {
          params: {
            search: debouncedSearch || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((t: any) => t.id);
      }
      case "discounts": {
        const res = await adminApi.get("/discounts", {
          params: {
            search: debouncedSearch || undefined,
            deleted: "true",
            ignoreMaxLimit: "true",
            limit: 999999,
          },
        });
        const items = res.data?.data ?? [];
        return items.map((d: any) => d.id);
      }
      case "attributes": {
        return (attributesQuery.data ?? []).map((a: any) => a.id);
      }
      case "categories": {
        return (categoriesQuery.data ?? []).map((c: any) => c.id);
      }
      default:
        return [];
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    setIsSelectingAll(true);
    try {
      const allIds = await fetchAllArchivedIdsForTab(activeTab);
      setSelectedIds(allIds);
      showToast(
        `Selected all ${allIds.length} archived ${activeTab} across all pages.`,
        "success"
      );
    } catch (err) {
      showToast(
        getAdminErrorMessage(err, `Failed to select all archived ${activeTab}.`),
        "error"
      );
    } finally {
      setIsSelectingAll(false);
    }
  };

  // Bulk Action Apply Handler
  const handleBulkActionApply = () => {
    if (bulkAction === "RESTORE" && selectedIds.length > 0) {
      setShowBulkRestoreModal(true);
    } else if (bulkAction === "PERMANENT_DELETE" && selectedIds.length > 0) {
      setShowBulkPermanentModal(true);
    }
  };

  const handleConfirmBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        if (activeTab === "attributes") {
          await restoreAttributeMutation.mutateAsync(id);
        } else if (activeTab === "categories") {
          await restoreCategoryMutation.mutateAsync(id);
        } else if (activeTab === "products") {
          await restoreProductMutation.mutateAsync(id);
        } else if (activeTab === "variants") {
          const variant = (currentData as any[]).find((v: any) => v.id === id);
          if (variant?.productId) {
            await restoreVariantMutation.mutateAsync({
              productId: variant.productId,
              variantId: id,
            });
          }
        } else if (activeTab === "orders") {
          await restoreOrderMutation.mutateAsync(id);
        } else if (activeTab === "customers") {
          await restoreCustomerMutation.mutateAsync(id);
        } else if (activeTab === "quotes") {
          await restoreQuoteMutation.mutateAsync(id);
        } else if (activeTab === "reviews") {
          await restoreReviewMutation.mutateAsync(id);
        } else if (activeTab === "warehouses") {
          await restoreWarehouseMutation.mutateAsync(id);
        } else if (activeTab === "pricing") {
          await restorePricingMutation.mutateAsync(id);
        } else if (activeTab === "tiers") {
          await restoreTierMutation.mutateAsync(id);
        } else if (activeTab === "discounts") {
          await restoreDiscountMutation.mutateAsync(id);
        }
        successCount++;
      } catch (err) {
        failCount++;
      }
    }

    setBulkProcessing(false);
    setShowBulkRestoreModal(false);
    setSelectedIds([]);
    setBulkAction("");

    if (successCount > 0) {
      showToast(
        `Successfully restored ${successCount} ${activeTab} item${successCount > 1 ? "s" : ""}.`,
        "success"
      );
    }
    if (failCount > 0) {
      showToast(`Failed to restore ${failCount} item${failCount > 1 ? "s" : ""}.`, "error");
    }
  };

  // Bulk Permanent Delete Handler
  const handleConfirmBulkPermanentDelete = async () => {
    if (selectedIds.length === 0) return;
    const totalSelected = selectedIds.length;
    const targetTab = activeTab;
    setBulkProcessing(true);
    try {
      let result: any = null;
      if (activeTab === "attributes") {
        result = await bulkPermanentDeleteAttributesMutation.mutateAsync(selectedIds);
      } else if (activeTab === "categories") {
        result = await bulkPermanentDeleteCategoriesMutation.mutateAsync(selectedIds);
      } else if (activeTab === "orders") {
        result = await bulkPermanentDeleteOrdersMutation.mutateAsync(selectedIds);
      } else if (activeTab === "products") {
        result = await bulkPermanentDeleteProductsMutation.mutateAsync(selectedIds);
      } else if (activeTab === "variants") {
        result = await bulkPermanentDeleteVariantsMutation.mutateAsync(selectedIds);
      } else if (activeTab === "quotes") {
        result = await bulkPermanentDeleteQuotesMutation.mutateAsync(selectedIds);
      } else if (activeTab === "reviews") {
        result = await bulkPermanentDeleteReviewsMutation.mutateAsync(selectedIds);
      } else if (activeTab === "warehouses") {
        result = await bulkPermanentDeleteWarehousesMutation.mutateAsync(selectedIds);
      } else if (activeTab === "pricing") {
        result = await bulkPermanentDeletePricingMutation.mutateAsync(selectedIds);
      } else if (activeTab === "tiers") {
        result = await bulkPermanentDeleteTiersMutation.mutateAsync(selectedIds);
      } else if (activeTab === "discounts") {
        result = await bulkPermanentDeleteDiscountsMutation.mutateAsync(selectedIds);
      }

      setBulkProcessing(false);
      setShowBulkPermanentModal(false);
      setBulkAction("");

      // UI & Cache Refresh: refresh current tab data and update all cross-module counts & KPI cards
      await refetchCurrent();
      void Promise.all([
        attributesQuery.refetch(),
        categoriesQuery.refetch(),
        productsQuery.refetch(),
        variantsQuery.refetch(),
        ordersQuery.refetch(),
        customersQuery.refetch(),
        quotesQuery.refetch(),
        reviewsQuery.refetch(),
        warehousesQuery.refetch(),
        pricingQuery.refetch(),
        tiersQuery.refetch(),
        discountsQuery.refetch(),
      ]);

      if (result) {
        const payload = (result as any)?.data ?? result;
        const deletedIds: string[] = Array.isArray(payload?.deletedIds) ? payload.deletedIds : [];
        const blocked: Array<{ id: string; name?: string; reason: string }> = Array.isArray(payload?.blocked) ? payload.blocked : [];
        const deletedCount = typeof payload?.deletedCount === "number" ? payload.deletedCount : deletedIds.length;
        const blockedCount = typeof payload?.blockedCount === "number" ? payload.blockedCount : (blocked.length || Math.max(0, totalSelected - deletedCount));

        // If items were deleted, remove them from selectedIds; keep any remaining blocked IDs selected
        if (blockedCount > 0 && deletedIds.length > 0) {
          setSelectedIds((prev) => prev.filter((id) => !deletedIds.includes(id)));
        } else if (deletedCount > 0 && blockedCount === 0) {
          setSelectedIds([]);
        }

        // Set comprehensive summary data so result modal displays accurately
        setBulkPermanentResult({
          totalSelected,
          deletedCount,
          blockedCount,
          deletedIds,
          blocked,
          tab: targetTab,
        });

        if (blockedCount === 0 && deletedCount > 0) {
          showToast(
            `Successfully permanently deleted all ${deletedCount} ${targetTab} record${deletedCount > 1 ? "s" : ""}.`,
            "success"
          );
        } else if (deletedCount === 0 && blockedCount > 0) {
          showToast(
            `All ${blockedCount} selected ${targetTab} record${blockedCount > 1 ? "s are" : " is"} protected from permanent deletion.`,
            "error"
          );
        } else {
          showToast(
            `Permanently deleted ${deletedCount} record${deletedCount > 1 ? "s" : ""}; ${blockedCount} protected record${blockedCount > 1 ? "s were" : " was"} preserved.`,
            "warning"
          );
        }
      }
    } catch (err) {
      setBulkProcessing(false);
      showToast(getAdminErrorMessage(err, "Failed to permanently delete records."), "error");
    }
  };


  // ─── Table Columns Configuration ──────────────────────────

  // 0. Attributes Columns
  const attributeColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Attribute Name",
        width: "260px",
        render: (attr) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
              <Sliders size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-[#1A1A1A] text-[13.5px] truncate">
                {attr.name}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate font-mono">
                {attr.slug || attr.id}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "role",
        label: "Display Type",
        width: "160px",
        render: (attr) => (
          <span className="inline-flex items-center rounded-md bg-gray-100 px-2.5 py-1 text-[12px] font-medium text-[#444]">
            {attr.role === "DROPDOWN"
              ? "Dropdown"
              : attr.role === "X_GRID"
              ? "Grid X Axis"
              : "Grid Y Axis"}
          </span>
        ),
      },
      {
        key: "values",
        label: "Values",
        width: "120px",
        render: (attr) => (
          <span className="text-[13px] text-[#555]">
            {attr.values?.length ?? attr._count?.values ?? 0} values
          </span>
        ),
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (attr) => <StatusBadge status={attr.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "180px",
        render: (attr) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(attr.deletedAt || attr.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (attr) => (
          <AdminRowActions
            view={{
              title: "View Attribute Details",
              onClick: () => setViewingAttribute(attr),
            }}
            extra={
              canManageAttributes ? (
                <AdminActionButton
                  action={{
                    title: "Restore Attribute",
                    onClick: () =>
                      setRestoringItem({
                        type: "attributes",
                        id: attr.id,
                        name: `Attribute "${attr.name}"`,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Attribute"
                />
              ) : undefined
            }
            delete={
              canDeleteAttributes
                ? {
                    title: "Delete Attribute",
                    onClick: () => setDeletingAttribute(attr),
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canManageAttributes, canDeleteAttributes]
  );

  // 1. Categories Columns
  const categoryColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Category",
        width: "280px",
        render: (cat) => (
          <div className="flex items-center gap-3">
            {cat.image ? (
              <img
                src={cat.image}
                alt={cat.name}
                className="h-9 w-9 rounded-md object-cover border border-[#E6E6E6]"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
                <FolderTree size={16} />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-[#1A1A1A] text-[13.5px] truncate">
                {cat.name}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate font-mono">
                {cat.slug}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "parent",
        label: "Parent Category",
        width: "180px",
        render: (cat) => (
          <span className="text-[13px] text-[#555]">
            {cat.parent?.name || "— (Root)"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (cat) => <StatusBadge status={cat.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "180px",
        render: (cat) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(cat.deletedAt || cat.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "120px",
        render: (cat) => {
          const productCount = cat._count?.products ?? 0;
          const childCount = cat.children?.length ?? 0;
          const isBlocked = productCount > 0 || childCount > 0;
          const blockReason = productCount > 0
            ? `Cannot permanently delete category: referenced by ${productCount} active product(s).`
            : childCount > 0
            ? `Cannot permanently delete category: has ${childCount} child sub-category(ies).`
            : null;

          return (
            <AdminRowActions
              view={{
                title: "View Category Details",
                onClick: () => setViewingCategory(cat),
              }}
              extra={
                canManageCategories ? (
                  <AdminActionButton
                    action={{
                      title: "Restore Category",
                      onClick: () =>
                        setRestoringItem({
                          type: "categories",
                          id: cat.id,
                          name: `Category "${cat.name}"`,
                        }),
                      icon: <RotateCcw size={13} />,
                    }}
                    defaultIcon={<RotateCcw size={13} />}
                    defaultTitle="Restore Category"
                  />
                ) : undefined
              }
              delete={
                canManageCategories
                  ? {
                      title: "Delete Category",
                      onClick: () => setDeletingCategory(cat),
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
    [canManageCategories]
  );

  // 2. Products Columns
  const productColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "title",
        label: "Product",
        width: "300px",
        render: (prod) => (
          <div className="flex items-center gap-3">
            {prod.media?.[0]?.url ? (
              <img
                src={prod.media[0].url}
                alt={prod.title}
                className="h-9 w-9 rounded-md object-cover border border-[#E6E6E6]"
              />
            ) : (
              <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
                <Package size={16} />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-medium text-[#1A1A1A] text-[13.5px] truncate">
                {prod.title}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate font-mono">
                {prod.productCode || prod.sku || prod.id}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "sku",
        label: "SKU",
        width: "140px",
        render: (prod) => (
          <span className="text-[13px] font-mono text-[#555]">
            {prod.sku || "—"}
          </span>
        ),
      },
      {
        key: "category",
        label: "Category",
        width: "160px",
        render: (prod) => (
          <span className="text-[13px] text-[#555]">
            {prod.category?.name || "—"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (prod) => <StatusBadge status={prod.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "180px",
        render: (prod) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(prod.deletedAt || prod.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (prod) => {
          const variantCount = prod._count?.variants ?? prod.variants?.length ?? 0;
          const isBlocked = variantCount > 0;
          const blockReason = isBlocked
            ? `Cannot permanently delete product: has ${variantCount} associated variant(s). Delete or detach variants first.`
            : null;

          return (
            <AdminRowActions
              view={{
                title: "View Product Details",
                onClick: () => setViewingProduct(prod),
              }}
              extra={
                canManageProducts ? (
                  <AdminActionButton
                    action={{
                      title: "Restore Product",
                      onClick: () =>
                        setRestoringItem({
                          type: "products",
                          id: prod.id,
                          name: `Product "${prod.title}"`,
                        }),
                      icon: <RotateCcw size={13} />,
                    }}
                    defaultIcon={<RotateCcw size={13} />}
                    defaultTitle="Restore Product"
                  />
                ) : undefined
              }
              delete={
                canDeleteProducts
                  ? {
                      title: "Delete Product",
                      onClick: () => setDeletingProduct(prod),
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
    [canManageProducts, canDeleteProducts]
  );

  // 3. Orders Columns
  const orderColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "orderNumber",
        label: "Order",
        width: "180px",
        render: (order) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#1A1A1A] text-[13.5px]">
                {order.orderNumber}
              </span>
              {order.isTest && (
                <span className="inline-flex items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 border border-amber-200">
                  TEST
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-[#9A9A9A]">
              {formatDate(order.createdAt)}
            </div>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        width: "220px",
        render: (order) => {
          const customerFullName = order.customer
            ? `${order.customer.firstName || ""} ${order.customer.lastName || ""}`.trim()
            : "";
          const displayName =
            customerFullName ||
            order.customerName ||
            (!order.customerId ? "Guest User" : "Customer");
          const displayEmail =
            order.customer?.email ||
            order.customerEmail ||
            "—";

          return (
            <div className="min-w-0">
              <div className="font-medium text-[#1A1A1A] text-[13px] truncate" title={displayName}>
                {displayName}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate" title={displayEmail}>
                {displayEmail}
              </div>
            </div>
          );
        },
      },
      {
        key: "total",
        label: "Total Amount",
        width: "140px",
        render: (order) => (
          <span className="font-medium text-[13.5px] text-[#1A1A1A]">
            {order.currency?.symbol || "$"}{" "}
            {Number(order.total || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "status",
        label: "Order Status",
        width: "130px",
        render: (order) => <StatusBadge status={order.status} />,
      },
      {
        key: "paymentStatus",
        label: "Payment",
        width: "130px",
        render: (order) => <StatusBadge status={order.paymentStatus} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "170px",
        render: (order) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(order.deletedAt || order.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (order) => {
          const isBlocked = !order.isTest || order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED";
          const blockReason = !order.isTest
            ? "Permanent deletion is restricted to Draft and Test orders only. Real customer orders cannot be permanently deleted to retain financial and audit records."
            : order.paymentStatus === "PAID" || order.paymentStatus === "REFUNDED"
            ? `Cannot permanently delete order with payment status "${order.paymentStatus}". Financial records must be retained.`
            : null;

          return (
            <AdminRowActions
              view={{
                title: "View Order Details",
                onClick: () => setViewingOrderId(order.id),
              }}
              extra={
                canManageOrders ? (
                  <AdminActionButton
                    action={{
                      title: "Restore Order",
                      onClick: () =>
                        setRestoringItem({
                          type: "orders",
                          id: order.id,
                          name: `Order ${order.orderNumber}`,
                        }),
                      icon: <RotateCcw size={13} />,
                    }}
                    defaultIcon={<RotateCcw size={13} />}
                    defaultTitle="Restore Order"
                  />
                ) : undefined
              }
              delete={
                canDeleteOrders
                  ? {
                      title: "Delete Order",
                      onClick: () => setDeletingOrder(order),
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
    [canManageOrders, canDeleteOrders]
  );

  // 4. Customers Columns
  const customerColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Customer",
        width: "250px",
        render: (cust) => (
          <div className="min-w-0">
            <div className="font-medium text-[#1A1A1A] text-[13.5px] truncate">
              {`${cust.firstName || ""} ${cust.lastName || ""}`.trim() || "—"}
            </div>
            {cust.companyName && (
              <div className="text-[11.5px] text-[#9A9A9A] truncate flex items-center gap-1">
                <Building size={11} /> {cust.companyName}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "contact",
        label: "Email & Phone",
        width: "240px",
        render: (cust) => (
          <div className="min-w-0">
            <div className="text-[13px] text-[#1A1A1A] truncate flex items-center gap-1">
              <Mail size={12} className="text-[#888]" /> {cust.email}
            </div>
            {cust.phone && (
              <div className="text-[11.5px] text-[#9A9A9A] truncate flex items-center gap-1">
                <Phone size={11} className="text-[#888]" /> {cust.phone}
              </div>
            )}
          </div>
        ),
      },
      {
        key: "role",
        label: "Role / Tier",
        width: "160px",
        render: (cust) => (
          <div className="text-[12.5px] text-[#555]">
            <div>{cust.customerRole?.name || cust.customerType || "Standard"}</div>
            {cust.tier?.name && (
              <span className="text-[11px] text-[#888] font-medium">
                Tier: {cust.tier.name}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "120px",
        render: (cust) => <StatusBadge status={cust.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "180px",
        render: (cust) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(cust.deletedAt || cust.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "120px",
        render: (cust) => (
          <AdminRowActions
            view={{
              title: "View Customer Details",
              href: `/admin/customers/${cust.id}`,
            }}
            extra={
              canManageCustomers ? (
                <AdminActionButton
                  action={{
                    title: "Restore Customer",
                    onClick: () =>
                      setRestoringItem({
                        type: "customers",
                        id: cust.id,
                        name: `Customer "${cust.firstName} ${cust.lastName}"`,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Customer"
                />
              ) : undefined
            }
          />
        ),
      },
    ],
    [canManageCustomers]
  );

  // 5. Quotes Columns
  const quoteColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "quoteNumber",
        label: "Quote",
        width: "190px",
        render: (quote) => (
          <div>
            <div className="flex items-center gap-2">
              <span className="font-medium text-[#1A1A1A] text-[13.5px]">
                {quote.quoteNumber}
              </span>
              {quote.status === "CONVERTED" && (
                <span className="inline-flex items-center rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                  CONVERTED
                </span>
              )}
            </div>
            <div className="text-[11.5px] text-[#9A9A9A]">
              {formatDate(quote.createdAt)}
            </div>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        width: "220px",
        render: (quote) => {
          const displayName = quote.customerName || "—";
          const displayEmail = quote.customerEmail || "—";
          return (
            <div className="min-w-0">
              <div className="font-medium text-[#1A1A1A] text-[13px] truncate" title={displayName}>
                {displayName}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate" title={displayEmail}>
                {displayEmail}
              </div>
            </div>
          );
        },
      },
      {
        key: "company",
        label: "Company",
        width: "160px",
        render: (quote) => (
          <span className="text-[13px] text-[#555] truncate block">
            {quote.companyName || "—"}
          </span>
        ),
      },
      {
        key: "total",
        label: "Total",
        width: "130px",
        render: (quote) => (
          <span className="font-medium text-[13.5px] text-[#1A1A1A]">
            {quote.currency?.symbol || "$"}{" "}
            {Number(quote.total || 0).toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "120px",
        render: (quote) => <StatusBadge status={quote.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "170px",
        render: (quote) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(quote.deletedAt || quote.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (quote) => {
          const isHardBlocked =
            ["SENT", "ACCEPTED", "CONVERTED"].includes(quote.status) ||
            Boolean(quote.convertedOrderId);
          const quoteBlockReason =
            quote.status === "CONVERTED" || quote.convertedOrderId
              ? "Permanent deletion is not allowed for converted quotes because the quote is linked to a commercial order."
              : ["SENT", "ACCEPTED"].includes(quote.status || "")
              ? `Permanent deletion is not allowed for quotes in ${quote.status} status because they represent retained commercial negotiation history.`
              : null;

          return (
            <AdminRowActions
              view={{
                title: "View Quote Details",
                onClick: () => setViewingQuoteId(quote.id),
              }}
              extra={
                canManageQuotes ? (
                  <AdminActionButton
                    action={{
                      title: "Restore Quote",
                      onClick: () =>
                        setRestoringItem({
                          type: "quotes",
                          id: quote.id,
                          name: `Quote #${quote.quoteNumber}`,
                        }),
                      icon: <RotateCcw size={13} />,
                    }}
                    defaultIcon={<RotateCcw size={13} />}
                    defaultTitle="Restore Quote"
                  />
                ) : undefined
              }
              delete={
                canDeleteQuotes
                  ? {
                      title: "Delete Quote",
                      onClick: () => setDeletingQuote(quote),
                    }
                  : undefined
              }
            />
          );
        },
      },
    ],
    [canManageQuotes, canDeleteQuotes]
  );

  // 6. Warehouses Columns
  const warehouseColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Warehouse Name",
        width: "280px",
        render: (w) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
              <Warehouse size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-medium text-[#1A1A1A] text-[13.5px] truncate">
                {w.name}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate font-mono">
                {w.id}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "location",
        label: "Location",
        width: "200px",
        render: (w) => (
          <div>
            <div className="text-[#1A1A1A] font-medium text-[13px]">{w.state}</div>
            <div className="text-[11.5px] text-[#9A9A9A]">
              {w.country?.name || w.countryId}
            </div>
          </div>
        ),
      },
      {
        key: "gstin",
        label: "GSTIN / Tax ID",
        width: "160px",
        render: (w) =>
          w.gstin ? (
            <span className="font-mono text-[#555] font-medium text-[12.5px]">
              {w.gstin}
            </span>
          ) : (
            <span className="text-[#9A9A9A] italic text-[12.5px]">None</span>
          ),
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (w) => <StatusBadge status={w.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "180px",
        render: (w) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(w.deletedAt || w.updatedAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (w) => (
          <AdminRowActions
            view={{
              title: "View Warehouse Details",
              onClick: () => setViewingWarehouse(w),
            }}
            extra={
              canManageWarehouses ? (
                <AdminActionButton
                  action={{
                    title: "Restore Warehouse",
                    onClick: () =>
                      setRestoringItem({
                        type: "warehouses",
                        id: w.id,
                        name: w.name,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Warehouse"
                />
              ) : undefined
            }
            delete={
              canManageWarehouses
                ? {
                    title: "Delete Warehouse",
                    onClick: () => setDeletingWarehouse(w),
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canManageWarehouses]
  );

  // 7. Variants Columns
  const variantColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Product / Variant",
        width: "280px",
        render: (row: any) => {
          const imgUrl = row.product?.media?.[0]?.url;
          return (
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 shrink-0 overflow-hidden rounded-md border border-[#E6E6E6] bg-[#FAFAFA] flex items-center justify-center">
                {imgUrl ? (
                  <img
                    src={imgUrl}
                    alt={row.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Package size={16} className="text-[#9A9A9A]" />
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 font-medium text-[#1A1A1A] text-[13.5px] truncate">
                  <span className="truncate">{row.title}</span>
                  {row.package && (
                    <span className="inline-flex shrink-0 items-center rounded bg-purple-50 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700 border border-purple-200">
                      {row.package.title}
                    </span>
                  )}
                </div>
                <div className="text-[11.5px] text-[#9A9A9A] truncate">
                  {row.product ? (
                    <Link
                      href={`/admin/products/${row.product.id}/edit`}
                      className="hover:text-[#E31E24] hover:underline"
                    >
                      {row.product.title}
                    </Link>
                  ) : (
                    "Standalone Variant"
                  )}
                </div>
              </div>
            </div>
          );
        },
      },
      {
        key: "sku",
        label: "SKU",
        width: "160px",
        render: (row: any) => (
          <span className="font-mono text-[12.5px] text-[#555]">
            {row.sku || "—"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "120px",
        render: () => (
          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 border border-red-200">
            Archived
          </span>
        ),
      },
      {
        key: "countries",
        label: "Countries",
        width: "100px",
        render: (row: any) => {
          const count = row.countries?.length || 0;
          return (
            <span className="text-[12.5px] text-[#555]">
              {count} {count === 1 ? "Country" : "Countries"}
            </span>
          );
        },
      },
      {
        key: "inventory",
        label: "Inventory",
        width: "140px",
        render: (row: any) => {
          const stock = row.dependencyCounts?.activeStock ?? row.inventories?.reduce((acc: number, inv: any) => acc + (inv.stock || 0), 0) ?? 0;
          const reserved = row.dependencyCounts?.reservedStock ?? row.inventories?.reduce((acc: number, inv: any) => acc + (inv.reservedStock || 0), 0) ?? 0;
          const available = Math.max(0, stock - reserved);
          return (
            <div className="text-[12.5px]">
              <span className="font-medium text-[#1A1A1A]">{stock} in stock</span>
              <span className="text-[11px] text-[#888] block">({available} avail)</span>
            </div>
          );
        },
      },
      {
        key: "price",
        label: "Price",
        width: "120px",
        render: (row: any) => {
          const primaryPrice = row.prices?.[0];
          if (!primaryPrice) return <span className="text-[12.5px] text-[#888]">—</span>;
          const sym = primaryPrice.currency?.symbol || "$";
          return (
            <span className="text-[12.5px] font-medium text-[#1A1A1A]">
              {sym}{Number(primaryPrice.sellingPrice).toFixed(2)}
            </span>
          );
        },
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "180px",
        render: (row: any) => (
          <span className="text-[12.5px] text-[#777]">
            {row.deletedAt ? formatDateTime(row.deletedAt) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (row: any) => (
          <AdminRowActions
            view={{
              title: "View Variant Details",
              onClick: () => setViewingVariant(row),
            }}
            extra={
              canManageProducts ? (
                <AdminActionButton
                  action={{
                    title: "Restore Variant",
                    onClick: () =>
                      setRestoringItem({
                        type: "variants",
                        id: row.id,
                        name: `Variant "${row.title}" (${row.sku || "No SKU"})`,
                        productId: row.productId,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Variant"
                />
              ) : undefined
            }
            delete={
              canDeleteProducts
                ? {
                    title: "Delete Variant",
                    onClick: () => setDeletingVariant(row),
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canManageProducts, canDeleteProducts]
  );

  // 8. Reviews Columns
  const reviewColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "product",
        label: "Product",
        width: "240px",
        render: (rev: any) => (
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            {rev.productImage ? (
              <img
                src={rev.productImage}
                alt={rev.productTitle}
                className="h-9 w-9 flex-none rounded object-cover border border-[#E6E6E6]"
              />
            ) : null}
            <div className="min-w-0">
              <span className="font-semibold text-[#1A1A1A] block truncate text-[13px]">
                {rev.productTitle || "Unknown Product"}
              </span>
              {rev.productSlug && (
                <Link
                  href={`/products/${rev.productSlug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11.5px] text-[#E31E24] hover:underline mt-0.5 font-medium"
                >
                  View Page <ExternalLink size={11} />
                </Link>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        width: "200px",
        render: (rev: any) => (
          <div>
            <span className="font-semibold text-[#1A1A1A] block text-[13px]">
              {rev.customerName || "Anonymous"}
            </span>
            {rev.customerEmail && (
              <span className="text-[11.5px] text-[#6B6B6B] block truncate">
                {rev.customerEmail}
              </span>
            )}
          </div>
        ),
      },
      {
        key: "rating",
        label: "Rating",
        width: "120px",
        render: (rev: any) => (
          <div className="flex items-center gap-1 text-[13px] font-bold text-[#F59E0B]">
            <span>{rev.ratingOverall ?? 5}.0</span>
            <Star size={13} className="fill-[#F59E0B]" />
          </div>
        ),
      },
      {
        key: "feedback",
        label: "Feedback Comment",
        width: "260px",
        render: (rev: any) => (
          <span className="text-[12.5px] text-[#555] line-clamp-2" title={rev.feedbackText || ""}>
            {rev.feedbackText || <span className="italic text-[#9A9A9A]">No feedback comment</span>}
          </span>
        ),
      },
      {
        key: "status",
        label: "Moderation Status",
        width: "140px",
        render: (rev: any) => <StatusBadge status={rev.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "170px",
        render: (rev: any) => (
          <span className="text-[12.5px] text-[#777]">
            {formatDateTime(rev.deletedAt || rev.createdAt)}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (rev: any) => (
          <AdminRowActions
            view={{
              title: "View Full Review",
              onClick: () => setViewingReview(rev),
            }}
            extra={
              canManageReviews ? (
                <AdminActionButton
                  action={{
                    title: "Restore Review",
                    onClick: () =>
                      setRestoringItem({
                        type: "reviews",
                        id: rev.id,
                        name: `Review for "${rev.productTitle || rev.id}"`,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Review"
                />
              ) : undefined
            }
            delete={
              canDeleteReviews
                ? {
                    title: "Delete Review",
                    onClick: () => setDeletingReview(rev),
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canManageReviews, canDeleteReviews]
  );

  // 9. Pricing Columns
  const pricingColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "ruleName",
        label: "Pricing Rule",
        width: "280px",
        render: (row: any) => {
          const typeLabel =
            row.ruleType === "BASE_PRICE"
              ? "Base Price"
              : row.ruleType === "COUNTRY_PRICE"
              ? "Country Price"
              : row.ruleType === "VARIANT_PRICE"
              ? "Variant Price"
              : row.ruleType === "TIER_PRICE"
              ? "Tier Price"
              : row.ruleType === "MOQ_PRICE"
              ? "MOQ Price"
              : row.ruleType;

          return (
            <div className="flex items-center gap-2.5 min-w-0 pr-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
                <Tag size={16} />
              </div>
              <div className="min-w-0">
                <span className="font-semibold text-[#1A1A1A] block truncate text-[13px]">
                  {row.ruleName || "Pricing Rule"}
                </span>
                <span className="inline-block text-[11px] font-medium text-[#666] bg-[#ECECEC] px-1.5 py-0.5 rounded mt-0.5">
                  {typeLabel}
                </span>
              </div>
            </div>
          );
        },
      },
      {
        key: "product",
        label: "Product / Variant",
        width: "240px",
        render: (row: any) => (
          <div className="min-w-0">
            <span className="font-medium text-[#1A1A1A] block truncate text-[13px]">
              {row.product?.title || "Unknown Product"}
            </span>
            {row.variant?.title ? (
              <span className="text-[11.5px] text-[#6B6B6B] block truncate">
                Variant: {row.variant.title}
              </span>
            ) : row.product?.sku ? (
              <span className="text-[11.5px] text-[#9A9A9A] font-mono block truncate">
                SKU: {row.product.sku}
              </span>
            ) : null}
          </div>
        ),
      },
      {
        key: "country",
        label: "Country / Tier",
        width: "180px",
        render: (row: any) => (
          <div>
            <div className="text-[#1A1A1A] font-medium text-[13px]">
              {row.country?.name ? `${row.country.name} (${row.country.code})` : "Global / All"}
            </div>
            {row.tier?.name ? (
              <div className="text-[11.5px] text-[#888]">Tier: {row.tier.name}</div>
            ) : row.moq ? (
              <div className="text-[11.5px] text-[#888]">MOQ: {row.moq}+ units</div>
            ) : null}
          </div>
        ),
      },
      {
        key: "price",
        label: "Price",
        width: "130px",
        render: (row: any) => {
          const sym = row.details?.currency?.symbol || "$";
          const selling = row.details?.sellingPrice ?? row.basePrice;
          if (selling == null) return <span className="text-[12.5px] text-[#888]">—</span>;
          return (
            <div>
              <span className="text-[13px] font-semibold text-[#1A1A1A]">
                {sym}{Number(selling).toFixed(2)}
              </span>
              {row.details?.mrp != null && (
                <div className="text-[11px] text-[#9A9A9A] line-through">
                  {sym}{Number(row.details.mrp).toFixed(2)}
                </div>
              )}
            </div>
          );
        },
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (row: any) => <StatusBadge status={row.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "170px",
        render: (row: any) => (
          <span className="text-[12.5px] text-[#777]">
            {row.deletedAt ? formatDateTime(row.deletedAt) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "140px",
        render: (row: any) => (
          <AdminRowActions
            view={{
              title: "View Pricing Details",
              onClick: () => setViewingPricing(row),
            }}
            extra={
              canManagePricing ? (
                <AdminActionButton
                  action={{
                    title: "Restore Pricing Rule",
                    onClick: () =>
                      setRestoringItem({
                        type: "pricing",
                        id: row.id,
                        name: `Pricing Rule "${row.ruleName}"`,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Pricing Rule"
                />
              ) : undefined
            }
            delete={
              canDeletePricing
                ? {
                    title: "Delete Pricing Rule",
                    onClick: () => setDeletingPricing(row),
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canManagePricing, canDeletePricing]
  );

  // 10. Tiers Columns
  const tierColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Tier Name",
        width: "220px",
        render: (tier: any) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
              <Layers size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[#1A1A1A] text-[13.5px] truncate" title={tier.name}>
                {tier.name}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate">
                Priority #{tier.sortOrder ?? 0}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "customers",
        label: "Customers",
        width: "110px",
        render: (tier: any) => (
          <span className="font-medium text-[#1A1A1A] text-[12.5px]">{tier._count?.customers ?? 0}</span>
        ),
      },
      {
        key: "pricing",
        label: "Pricing Rules",
        width: "120px",
        render: (tier: any) => (
          <span className="font-medium text-[#1A1A1A] text-[12.5px]">{tier._count?.pricing ?? 0}</span>
        ),
      },
      {
        key: "discounts",
        label: "Discounts",
        width: "110px",
        render: (tier: any) => (
          <span className="font-medium text-[#1A1A1A] text-[12.5px]">{tier._count?.discounts ?? 0}</span>
        ),
      },
      {
        key: "countries",
        label: "Countries",
        width: "120px",
        render: (tier: any) => {
          const count = tier._count?.countries ?? 0;
          return (
            <span className="text-[12px] font-medium text-[#555]">
              {count === 0 ? "Global (All)" : `${count} Countries`}
            </span>
          );
        },
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (tier: any) => <StatusBadge status={tier.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "160px",
        render: (tier: any) => (
          <span className="text-[12.5px] text-[#777]">
            {tier.deletedAt ? formatDateTime(tier.deletedAt) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "120px",
        render: (tier: any) => {
          const isBlocked = tier.canPermanentDelete === false;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {canManageTiers && (
                <AdminActionButton
                  action={{
                    title: "Restore Tier",
                    onClick: () =>
                      setRestoringItem({
                        type: "tiers",
                        id: tier.id,
                        name: `Pricing Tier "${tier.name}"`,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Tier"
                />
              )}
              {canDeleteTiers && (
                <AdminActionButton
                  action={{
                    title: isBlocked
                      ? (tier.permanentDeleteBlockReason || "Cannot permanently delete: Tier has active dependencies.")
                      : "Permanently Delete Tier",
                    onClick: () => setDeletingTier(tier),
                    disabled: isBlocked,
                  }}
                  variant="danger"
                  defaultIcon={<Trash2 size={13} />}
                  defaultTitle="Permanently Delete Tier"
                />
              )}
            </div>
          );
        },
      },
    ],
    [canManageTiers, canDeleteTiers]
  );

  const discountColumns: Column<any>[] = useMemo(
    () => [
      {
        key: "name",
        label: "Discount Name",
        width: "240px",
        render: (discount: any) => (
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-md bg-[#F5F5F5] border border-[#E6E6E6] text-[#888]">
              <Percent size={16} />
            </div>
            <div className="min-w-0">
              <div className="font-semibold text-[#1A1A1A] text-[13.5px] truncate" title={discount.name}>
                {discount.name}
              </div>
              <div className="text-[11.5px] text-[#9A9A9A] truncate">
                {discount.type === "TIER"
                  ? `Tier: ${discount.tier?.name || "All Tiers"}`
                  : discount.type === "MOQ"
                  ? `MOQ ${discount.minQuantity ?? 1}+`
                  : "Promotional"}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "type",
        label: "Type",
        width: "120px",
        render: (discount: any) => (
          <span className="text-[12.5px] font-medium text-[#1A1A1A]">
            {discount.type === "TIER" ? "Tier-based" : discount.type === "MOQ" ? "MOQ-based" : "Promotional"}
          </span>
        ),
      },
      {
        key: "value",
        label: "Discount Value",
        width: "130px",
        render: (discount: any) => (
          <span className="font-semibold text-[#1A1A1A] text-[12.5px]">
            {discount.discountPercent != null
              ? `${Number(discount.discountPercent).toFixed(1)}% OFF`
              : discount.fixedAmount != null
              ? `-$${Number(discount.fixedAmount).toFixed(2)}`
              : "—"}
          </span>
        ),
      },
      {
        key: "scope",
        label: "Scope",
        width: "120px",
        render: (discount: any) => (
          <span className="text-[12px] font-medium text-[#555]">
            {discount.scope || "PLATFORM"}
          </span>
        ),
      },
      {
        key: "status",
        label: "Original Status",
        width: "120px",
        render: (discount: any) => <StatusBadge status={discount.status} />,
      },
      {
        key: "archivedAt",
        label: "Archived Date",
        width: "160px",
        render: (discount: any) => (
          <span className="text-[12.5px] text-[#777]">
            {discount.deletedAt ? formatDateTime(discount.deletedAt) : "—"}
          </span>
        ),
      },
      {
        key: "actions",
        label: "Actions",
        width: "120px",
        render: (discount: any) => {
          const isBlocked = discount.canPermanentDelete === false;
          return (
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              {canManageDiscounts && (
                <AdminActionButton
                  action={{
                    title: "Restore Discount",
                    onClick: () =>
                      setRestoringItem({
                        type: "discounts",
                        id: discount.id,
                        name: `Discount "${discount.name}"`,
                      }),
                    icon: <RotateCcw size={13} />,
                  }}
                  defaultIcon={<RotateCcw size={13} />}
                  defaultTitle="Restore Discount"
                />
              )}
              {canDeleteDiscounts && (
                <AdminActionButton
                  action={{
                    title: isBlocked
                      ? (discount.permanentDeleteBlockReason || "Cannot permanently delete: Discount is protected.")
                      : "Permanently Delete Discount",
                    onClick: () => setDeletingDiscount(discount),
                    disabled: isBlocked,
                  }}
                  variant="danger"
                  defaultIcon={<Trash2 size={13} />}
                  defaultTitle="Permanently Delete Discount"
                />
              )}
            </div>
          );
        },
      },
    ],
    [canManageDiscounts, canDeleteDiscounts]
  );

  // ─── Current Tab Dataset & Props ──────────────────────────

  const attributesCount = Array.isArray(attributesQuery.data)
    ? attributesQuery.data.length
    : (attributesQuery.data?.total ?? 0);
  const categoriesCount = Array.isArray(categoriesQuery.data)
    ? categoriesQuery.data.length
    : (categoriesQuery.data?.total ?? 0);
  const productsCount =
    productsQuery.data?.pagination?.total ??
    productsQuery.data?.total ??
    (Array.isArray(productsQuery.data?.data)
      ? productsQuery.data.data.length
      : 0);
  const ordersCount =
    ordersQuery.data?.pagination?.total ??
    ordersQuery.data?.total ??
    (Array.isArray(ordersQuery.data?.data)
      ? ordersQuery.data.data.length
      : 0);
  const customersCount =
    customersQuery.data?.pagination?.total ??
    customersQuery.data?.total ??
    (Array.isArray(customersQuery.data?.data)
      ? customersQuery.data.data.length
      : 0);
  const quotesCount =
    quotesQuery.data?.pagination?.total ??
    quotesQuery.data?.total ??
    (Array.isArray(quotesQuery.data?.data)
      ? quotesQuery.data.data.length
      : 0);
  const reviewsCount =
    reviewsQuery.data?.pagination?.total ??
    reviewsQuery.data?.total ??
    (Array.isArray(reviewsQuery.data?.data)
      ? reviewsQuery.data.data.length
      : 0);
  const warehousesCount =
    warehousesQuery.data?.pagination?.total ??
    warehousesQuery.data?.total ??
    (Array.isArray(warehousesQuery.data?.data)
      ? warehousesQuery.data.data.length
      : 0);
  const variantsCount =
    variantsQuery.data?.pagination?.total ??
    variantsQuery.data?.total ??
    (Array.isArray(variantsQuery.data?.data)
      ? variantsQuery.data.data.length
      : 0);
  const pricingCount =
    pricingQuery.data?.pagination?.total ??
    pricingQuery.data?.total ??
    pricingQuery.data?.counts?.archivedRules ??
    (Array.isArray(pricingQuery.data?.data)
      ? pricingQuery.data.data.length
      : 0);
  const tiersCount =
    tiersQuery.data?.pagination?.total ??
    tiersQuery.data?.total ??
    (Array.isArray(tiersQuery.data?.data)
      ? tiersQuery.data.data.length
      : 0);
  const discountsCount =
    discountsQuery.data?.pagination?.total ??
    discountsQuery.data?.total ??
    (Array.isArray(discountsQuery.data?.data)
      ? discountsQuery.data.data.length
      : 0);

  const {
    currentData,
    currentColumns,
    totalItems,
    isLoading,
    refetchCurrent,
    isFetching,
    tabTitle,
    emptyMessage,
    columnOptions,
  } = useMemo(() => {
    switch (activeTab) {
      case "attributes": {
        const rawList = attributesQuery.data || [];
        const sortedList = [...rawList].sort((a: any, b: any) => {
          const dateA = new Date(a.deletedAt || a.updatedAt || 0).getTime();
          const dateB = new Date(b.deletedAt || b.updatedAt || 0).getTime();
          return sortDir === "asc" ? dateA - dateB : dateB - dateA;
        });
        const filtered = debouncedSearch
          ? sortedList.filter(
              (a: any) =>
                a.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                a.slug?.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
          : sortedList;
        const paged = filtered.slice((page - 1) * limit, page * limit);
        return {
          currentData: paged,
          currentColumns: attributeColumns.filter((c) => visibleColumns[c.key as string] !== false),
          totalItems: filtered.length,
          isLoading: attributesQuery.isLoading,
          refetchCurrent: attributesQuery.refetch,
          isFetching: attributesQuery.isFetching,
          tabTitle: "Archived Attributes",
          emptyMessage: debouncedSearch
            ? "No archived attributes matched your search."
            : "No archived attributes found.",
          columnOptions: [
            { key: "name", label: "Attribute Name" },
            { key: "role", label: "Display Type" },
            { key: "values", label: "Values" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "categories": {
        const rawList = categoriesQuery.data || [];
        const sortedList = [...rawList].sort((a: any, b: any) => {
          const dateA = new Date(a.deletedAt || a.updatedAt || 0).getTime();
          const dateB = new Date(b.deletedAt || b.updatedAt || 0).getTime();
          return sortDir === "asc" ? dateA - dateB : dateB - dateA;
        });
        const filtered = debouncedSearch
          ? sortedList.filter(
              (c: any) =>
                c.name?.toLowerCase().includes(debouncedSearch.toLowerCase()) ||
                c.slug?.toLowerCase().includes(debouncedSearch.toLowerCase())
            )
          : sortedList;
        return {
          currentData: filtered,
          currentColumns: categoryColumns.filter((c) => visibleColumns[c.key as string] !== false),
          totalItems: filtered.length,
          isLoading: categoriesQuery.isLoading,
          refetchCurrent: categoriesQuery.refetch,
          isFetching: categoriesQuery.isFetching,
          tabTitle: "Archived Categories",
          emptyMessage: debouncedSearch
            ? "No archived categories matched your search."
            : "No archived categories found.",
          columnOptions: [
            { key: "name", label: "Category" },
            { key: "parent", label: "Parent Category" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "products": {
        const data = productsQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: productColumns.filter((c) => visibleColumns[c.key as string] !== false),
          totalItems: productsCount,
          isLoading: productsQuery.isLoading,
          refetchCurrent: productsQuery.refetch,
          isFetching: productsQuery.isFetching,
          tabTitle: "Archived Products",
          emptyMessage:
            debouncedSearch || activeFiltersCount > 0
              ? "No archived products matched your search or filters."
              : "No archived products found.",
          columnOptions: [
            { key: "title", label: "Product" },
            { key: "sku", label: "SKU" },
            { key: "category", label: "Category" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "orders": {
        const data = ordersQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: orderColumns.filter((c) => visibleColumns[c.key as string] !== false),
          totalItems: ordersCount,
          isLoading: ordersQuery.isLoading,
          refetchCurrent: ordersQuery.refetch,
          isFetching: ordersQuery.isFetching,
          tabTitle: "Archived Orders",
          emptyMessage:
            debouncedSearch || activeFiltersCount > 0
              ? "No archived orders matched your search or filters."
              : "No archived orders found.",
          columnOptions: [
            { key: "orderNumber", label: "Order" },
            { key: "customer", label: "Customer" },
            { key: "total", label: "Total Amount" },
            { key: "status", label: "Order Status" },
            { key: "paymentStatus", label: "Payment Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "customers": {
        const data = customersQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: customerColumns.filter((c) => visibleColumns[c.key as string] !== false),
          totalItems: customersCount,
          isLoading: customersQuery.isLoading,
          refetchCurrent: customersQuery.refetch,
          isFetching: customersQuery.isFetching,
          tabTitle: "Archived Customers",
          emptyMessage:
            debouncedSearch || activeFiltersCount > 0
              ? "No archived customers matched your search or filters."
              : "No archived customers found.",
          columnOptions: [
            { key: "name", label: "Customer" },
            { key: "contact", label: "Email & Phone" },
            { key: "role", label: "Role / Tier" },
            { key: "status", label: "Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "quotes": {
        const data = quotesQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: quoteColumns.filter((c) => visibleColumns[c.key as string] !== false),
          totalItems: quotesCount,
          isLoading: quotesQuery.isLoading,
          refetchCurrent: quotesQuery.refetch,
          isFetching: quotesQuery.isFetching,
          tabTitle: "Archived Quotes",
          emptyMessage:
            debouncedSearch || activeFiltersCount > 0
              ? "No archived quotes matched your search or filters."
              : "No archived quotes found.",
          columnOptions: [
            { key: "quoteNumber", label: "Quote" },
            { key: "customer", label: "Customer" },
            { key: "company", label: "Company" },
            { key: "total", label: "Total Amount" },
            { key: "status", label: "Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "reviews": {
        const data = reviewsQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: reviewColumns.filter(
            (c) => visibleColumns[c.key as string] !== false
          ),
          totalItems: reviewsCount,
          isLoading: reviewsQuery.isLoading,
          refetchCurrent: reviewsQuery.refetch,
          isFetching: reviewsQuery.isFetching,
          tabTitle: "Archived Product Reviews",
          emptyMessage:
            debouncedSearch || activeFiltersCount > 0
              ? "No archived reviews matched your search or filters."
              : "No archived reviews found.",
          columnOptions: [
            { key: "product", label: "Product" },
            { key: "customer", label: "Customer" },
            { key: "rating", label: "Rating" },
            { key: "feedback", label: "Feedback Comment" },
            { key: "status", label: "Moderation Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "warehouses": {
        const data = warehousesQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: warehouseColumns.filter(
            (c) => visibleColumns[c.key as string] !== false
          ),
          totalItems: warehousesCount,
          isLoading: warehousesQuery.isLoading,
          refetchCurrent: warehousesQuery.refetch,
          isFetching: warehousesQuery.isFetching,
          tabTitle: "Archived Warehouses",
          emptyMessage: debouncedSearch
            ? "No archived warehouses matched your search."
            : "No archived warehouses found.",
          columnOptions: [
            { key: "name", label: "Warehouse Name" },
            { key: "location", label: "Location" },
            { key: "gstin", label: "GSTIN / Tax ID" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "variants": {
        const data = variantsQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: variantColumns.filter(
            (c) => visibleColumns[c.key as string] !== false
          ),
          totalItems: variantsCount,
          isLoading: variantsQuery.isLoading,
          refetchCurrent: variantsQuery.refetch,
          isFetching: variantsQuery.isFetching,
          tabTitle: "Archived Variants",
          emptyMessage: debouncedSearch
            ? "No archived variants matched your search."
            : "No archived variants found.",
          columnOptions: [
            { key: "name", label: "Product / Variant" },
            { key: "sku", label: "SKU" },
            { key: "status", label: "Status" },
            { key: "countries", label: "Countries" },
            { key: "inventory", label: "Inventory" },
            { key: "price", label: "Price" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "pricing": {
        const data = pricingQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: pricingColumns.filter(
            (c) => visibleColumns[c.key as string] !== false
          ),
          totalItems: pricingCount,
          isLoading: pricingQuery.isLoading,
          refetchCurrent: pricingQuery.refetch,
          isFetching: pricingQuery.isFetching,
          tabTitle: "Archived Pricing Rules",
          emptyMessage: debouncedSearch
            ? "No archived pricing rules matched your search."
            : "No archived pricing rules found.",
          columnOptions: [
            { key: "ruleName", label: "Pricing Rule" },
            { key: "product", label: "Product / Variant" },
            { key: "country", label: "Country / Tier" },
            { key: "price", label: "Price" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "tiers": {
        const data = tiersQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: tierColumns.filter(
            (c) => visibleColumns[c.key as string] !== false
          ),
          totalItems: tiersCount,
          isLoading: tiersQuery.isLoading,
          refetchCurrent: tiersQuery.refetch,
          isFetching: tiersQuery.isFetching,
          tabTitle: "Archived Pricing Tiers",
          emptyMessage: debouncedSearch
            ? "No archived pricing tiers matched your search."
            : "No archived pricing tiers found.",
          columnOptions: [
            { key: "name", label: "Tier Name" },
            { key: "customers", label: "Customers" },
            { key: "pricing", label: "Pricing Rules" },
            { key: "discounts", label: "Discounts" },
            { key: "countries", label: "Countries" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
      case "discounts": {
        const data = discountsQuery.data?.data || [];
        return {
          currentData: data,
          currentColumns: discountColumns.filter(
            (c) => visibleColumns[c.key as string] !== false
          ),
          totalItems: discountsCount,
          isLoading: discountsQuery.isLoading,
          refetchCurrent: discountsQuery.refetch,
          isFetching: discountsQuery.isFetching,
          tabTitle: "Archived Discounts",
          emptyMessage: debouncedSearch
            ? "No archived discounts matched your search."
            : "No archived discounts found.",
          columnOptions: [
            { key: "name", label: "Discount Name" },
            { key: "type", label: "Type" },
            { key: "value", label: "Discount Value" },
            { key: "scope", label: "Scope" },
            { key: "status", label: "Original Status" },
            { key: "archivedAt", label: "Archived Date" },
          ],
        };
      }
    }
  }, [
    activeTab,
    attributesQuery,
    categoriesQuery,
    productsQuery,
    ordersQuery,
    customersQuery,
    quotesQuery,
    reviewsQuery,
    variantsQuery,
    warehousesQuery,
    pricingQuery,
    tiersQuery,
    discountsQuery,
    debouncedSearch,
    activeFiltersCount,
    visibleColumns,
    attributeColumns,
    categoryColumns,
    productColumns,
    orderColumns,
    customerColumns,
    quoteColumns,
    reviewColumns,
    variantColumns,
    warehouseColumns,
    pricingColumns,
    tierColumns,
    discountColumns,
    attributesCount,
    productsCount,
    ordersCount,
    customersCount,
    quotesCount,
    reviewsCount,
    variantsCount,
    warehousesCount,
    pricingCount,
    tiersCount,
    discountsCount,
    sortDir,
    page,
    limit,
  ]);

  // Tab Item Configuration (Strict Alphabetical Order)
  const tabs = [
    {
      id: "attributes" as const,
      label: "Attributes",
      icon: <Sliders size={15} />,
      count: attributesCount,
    },
    {
      id: "categories" as const,
      label: "Categories",
      icon: <FolderTree size={15} />,
      count: categoriesCount,
    },
    {
      id: "customers" as const,
      label: "Customers",
      icon: <Users size={15} />,
      count: customersCount,
    },
    {
      id: "discounts" as const,
      label: "Discounts",
      icon: <Percent size={15} />,
      count: discountsCount,
    },
    {
      id: "orders" as const,
      label: "Orders",
      icon: <ShoppingCart size={15} />,
      count: ordersCount,
    },
    {
      id: "pricing" as const,
      label: "Pricing",
      icon: <Tag size={15} />,
      count: pricingCount,
    },
    {
      id: "products" as const,
      label: "Products",
      icon: <Package size={15} />,
      count: productsCount,
    },
    {
      id: "quotes" as const,
      label: "Quotes",
      icon: <MessageSquareQuote size={15} />,
      count: quotesCount,
    },
    {
      id: "reviews" as const,
      label: "Reviews",
      icon: <MessageSquare size={15} />,
      count: reviewsCount,
    },
    {
      id: "tiers" as const,
      label: "Tiers",
      icon: <Layers size={15} />,
      count: tiersCount,
    },
    {
      id: "variants" as const,
      label: "Variants",
      icon: <Layers size={15} />,
      count: variantsCount,
    },
    {
      id: "warehouses" as const,
      label: "Warehouses",
      icon: <Warehouse size={15} />,
      count: warehousesCount,
    },
  ];

  // Total Pages Calculation
  const totalPages = useMemo(() => {
    if (activeTab === "attributes") {
      return Math.max(1, Math.ceil(attributesCount / limit));
    }
    if (activeTab === "categories") {
      return Math.max(1, Math.ceil(categoriesCount / limit));
    }
    if (activeTab === "products") {
      return (
        productsQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(productsCount / limit))
      );
    }
    if (activeTab === "orders") {
      return (
        ordersQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(ordersCount / limit))
      );
    }
    if (activeTab === "customers") {
      return (
        customersQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(customersCount / limit))
      );
    }
    if (activeTab === "quotes") {
      return (
        quotesQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(quotesCount / limit))
      );
    }
    if (activeTab === "reviews") {
      return (
        reviewsQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(reviewsCount / limit))
      );
    }
    if (activeTab === "variants") {
      return (
        variantsQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(variantsCount / limit))
      );
    }
    if (activeTab === "warehouses") {
      return (
        warehousesQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(warehousesCount / limit))
      );
    }
    if (activeTab === "pricing") {
      return (
        pricingQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(pricingCount / limit))
      );
    }
    if (activeTab === "tiers") {
      return (
        tiersQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(tiersCount / limit))
      );
    }
    if (activeTab === "discounts") {
      return (
        discountsQuery.data?.pagination?.totalPages ??
        Math.max(1, Math.ceil(discountsCount / limit))
      );
    }
    return 1;
  }, [
    activeTab,
    attributesCount,
    categoriesCount,
    productsCount,
    ordersCount,
    customersCount,
    quotesCount,
    reviewsCount,
    variantsCount,
    warehousesCount,
    pricingCount,
    tiersCount,
    discountsCount,
    limit,
    productsQuery.data,
    ordersQuery.data,
    customersQuery.data,
    quotesQuery.data,
    reviewsQuery.data,
    variantsQuery.data,
    warehousesQuery.data,
    pricingQuery.data,
    tiersQuery.data,
    discountsQuery.data,
  ]);

  return (
    <AdminLayout
      title="Archive"
      breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Archive" }]}
    >
      <div className="space-y-5">
        {/* KPI STATS GRID - 4 CROSS-MODULE SUMMARY CARDS */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Archived",
              value:
                attributesCount +
                categoriesCount +
                customersCount +
                discountsCount +
                ordersCount +
                pricingCount +
                productsCount +
                quotesCount +
                reviewsCount +
                tiersCount +
                variantsCount +
                warehousesCount,
              subtitle: "Soft-deleted records across all modules",
              icon: <Layers size={18} />,
              color: "bg-[#E31E24]",
              isLoading:
                attributesQuery.isLoading ||
                categoriesQuery.isLoading ||
                customersQuery.isLoading ||
                discountsQuery.isLoading ||
                ordersQuery.isLoading ||
                pricingQuery.isLoading ||
                productsQuery.isLoading ||
                quotesQuery.isLoading ||
                reviewsQuery.isLoading ||
                tiersQuery.isLoading ||
                variantsQuery.isLoading ||
                warehousesQuery.isLoading,
            },
            {
              title: "Catalog Entities",
              value: productsCount + categoriesCount + attributesCount + variantsCount + reviewsCount + pricingCount + tiersCount + discountsCount,
              subtitle: "Archived products, variants, categories, reviews, attributes, pricing, tiers & discounts",
              icon: <Package size={18} />,
              color: "bg-blue-600",
              isLoading:
                productsQuery.isLoading ||
                categoriesQuery.isLoading ||
                attributesQuery.isLoading ||
                variantsQuery.isLoading ||
                reviewsQuery.isLoading ||
                pricingQuery.isLoading ||
                tiersQuery.isLoading ||
                discountsQuery.isLoading,
            },
            {
              title: "Commerce Records",
              value: ordersCount + quotesCount,
              subtitle: "Archived orders & quotation requests",
              icon: <ShoppingCart size={18} />,
              color: "bg-amber-600",
              isLoading: ordersQuery.isLoading || quotesQuery.isLoading,
            },
            {
              title: "Accounts & Logistics",
              value: customersCount + warehousesCount,
              subtitle: "Archived customer accounts & warehouses",
              icon: <Building size={18} />,
              color: "bg-gray-600",
              isLoading: customersQuery.isLoading || warehousesQuery.isLoading,
            },
          ]}
        />

        {/* Top Informational Banner */}
        <div className="flex items-start gap-3 rounded-lg border border-[#D0E2FF] bg-[#F4F8FF] p-3.5 text-[#1D39C4] shadow-2xs">
          <Info size={18} className="mt-0.5 shrink-0 text-[#2F54EB]" />
          <div className="text-[13px] leading-relaxed text-[#1D39C4]">
            <span className="font-semibold">Archive Management:</span> This area
            centralizes soft-deleted records across the store. You can review details,
            restore items back to their active management modules, or permanently delete
            eligible unreferenced test records.
          </div>
        </div>

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap",
                  isActive
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A] hover:border-[#D0D0D0]"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "bg-[#F2F2F2] text-[#6B6B6B]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* TOOLBAR MATCHING TAX / ORDERS */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: `Search archived ${activeTab}...`,
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: activeFiltersCount,
          }}
          columns={{
            visibleColumns,
            onToggleColumn: toggleColumn,
            options: columnOptions,
          }}
          refresh={{
            onRefresh: () => {
              void refetchCurrent().then(() =>
                showToast(`Archived ${activeTab} refreshed.`)
              );
            },
            isRefreshing: isFetching,
          }}
          onResetFilters={activeFiltersCount > 0 || search ? resetFilters : undefined}
          filterPanel={
            showFilters ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 pt-2">
                {activeTab === "products" && (
                  <>
                    <AdminSelect
                      label="Category"
                      value={productCategoryId}
                      onChange={(e) => {
                        setProductCategoryId(e.target.value);
                        setPage(1);
                      }}
                      options={[
                        { value: "", label: "All Categories" },
                        ...categoriesOptions.map((c: any) => ({
                          value: c.id,
                          label: c.name,
                        })),
                      ]}
                    />
                    <AdminSelect
                      label="Status"
                      value={productStatus}
                      onChange={(e) => {
                        setProductStatus(e.target.value);
                        setPage(1);
                      }}
                      options={[
                        { value: "", label: "All Statuses" },
                        { value: "ACTIVE", label: "Active" },
                        { value: "DRAFT", label: "Draft" },
                        { value: "INACTIVE", label: "Inactive" },
                        { value: "ARCHIVED", label: "Archived" },
                      ]}
                    />
                  </>
                )}

                {activeTab === "orders" && (
                  <>
                    <AdminSelect
                      label="Order Status"
                      value={orderStatus}
                      onChange={(e) => {
                        setOrderStatus(e.target.value);
                        setPage(1);
                      }}
                      options={[
                        { value: "", label: "All Order Statuses" },
                        { value: "PENDING", label: "Pending" },
                        { value: "CONFIRMED", label: "Confirmed" },
                        { value: "PROCESSING", label: "Processing" },
                        { value: "SHIPPED", label: "Shipped" },
                        { value: "DELIVERED", label: "Delivered" },
                        { value: "CANCELLED", label: "Cancelled" },
                      ]}
                    />
                    <AdminSelect
                      label="Payment Status"
                      value={orderPaymentStatus}
                      onChange={(e) => {
                        setOrderPaymentStatus(e.target.value);
                        setPage(1);
                      }}
                      options={[
                        { value: "", label: "All Payment Statuses" },
                        { value: "PENDING", label: "Pending" },
                        { value: "PAID", label: "Paid" },
                        { value: "FAILED", label: "Failed" },
                        { value: "REFUNDED", label: "Refunded" },
                      ]}
                    />
                  </>
                )}

                {activeTab === "customers" && (
                  <>
                    <AdminSelect
                      label="Customer Type"
                      value={customerType}
                      onChange={(e) => {
                        setCustomerType(e.target.value);
                        setPage(1);
                      }}
                      options={[
                        { value: "", label: "All Types" },
                        { value: "INDIVIDUAL", label: "Individual" },
                        { value: "BUSINESS", label: "Business" },
                      ]}
                    />
                    <AdminSelect
                      label="Approval Status"
                      value={customerApprovalStatus}
                      onChange={(e) => {
                        setCustomerApprovalStatus(e.target.value);
                        setPage(1);
                      }}
                      options={[
                        { value: "", label: "All Approval Statuses" },
                        { value: "APPROVED", label: "Approved" },
                        { value: "PENDING", label: "Pending" },
                        { value: "REJECTED", label: "Rejected" },
                      ]}
                    />
                  </>
                )}

                {activeTab === "quotes" && (
                  <AdminSelect
                    label="Quote Status"
                    value={quoteStatus}
                    onChange={(e) => {
                      setQuoteStatus(e.target.value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "All Statuses" },
                      { value: "PENDING", label: "Pending" },
                      { value: "REVIEWING", label: "Reviewing" },
                      { value: "SENT", label: "Sent" },
                      { value: "ACCEPTED", label: "Accepted" },
                      { value: "DECLINED", label: "Declined" },
                      { value: "EXPIRED", label: "Expired" },
                      { value: "CONVERTED", label: "Converted" },
                    ]}
                  />
                )}

                {activeTab === "reviews" && (
                  <AdminSelect
                    label="Moderation Status"
                    value={reviewStatus}
                    onChange={(e) => {
                      setReviewStatus(e.target.value);
                      setPage(1);
                    }}
                    options={[
                      { value: "", label: "All Statuses" },
                      { value: "APPROVED", label: "Approved" },
                      { value: "PENDING", label: "Pending" },
                      { value: "REJECTED", label: "Rejected" },
                    ]}
                  />
                )}

                <AdminSelect
                  label="Sort Direction"
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                  options={[
                    { value: "desc", label: "Newest First (Descending)" },
                    { value: "asc", label: "Oldest First (Ascending)" },
                  ]}
                />
              </div>
            ) : undefined
          }
        />

        {/* SELECT ALL ACROSS ALL PAGES HELPER BANNER */}
        {selectedIds.length > 0 && totalItems > currentData.length && (
          <div className="flex items-center justify-between gap-3 rounded-lg border border-[#D0E2FF] bg-[#F4F8FF] px-4 py-2.5 text-[13px] text-[#1D39C4] shadow-2xs transition-all">
            <div className="flex items-center gap-2">
              {selectedIds.length >= totalItems ? (
                <span>
                  All <strong>{selectedIds.length}</strong> archived {activeTab} across all pages are selected.
                </span>
              ) : (
                <span>
                  <strong>{selectedIds.length}</strong> {activeTab} on this page are selected.
                </span>
              )}
            </div>
            <div>
              {selectedIds.length >= totalItems ? (
                <button
                  type="button"
                  onClick={() => setSelectedIds([])}
                  className="font-semibold underline hover:text-[#092b00] cursor-pointer"
                >
                  Clear selection
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void handleSelectAll(true)}
                  disabled={isSelectingAll}
                  className="font-semibold underline hover:text-[#092b00] cursor-pointer"
                >
                  {isSelectingAll
                    ? "Selecting all..."
                    : `Select all ${totalItems} archived ${activeTab} across all pages`}
                </button>
              )}
            </div>
          </div>
        )}

        {/* FULL-WIDTH DATA TABLE WITH BULK ACTIONS */}
        <DataTable
          columns={currentColumns}
          data={currentData}
          rowKey="id"
          title={tabTitle}
          isLoading={isLoading}
          emptyMessage={emptyMessage}
          totalItems={totalItems}
          currentPage={page}
          pageSize={limit}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          enableSelection={true}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onSelectAll={handleSelectAll}
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
              actionType={bulkAction}
              onActionTypeChange={setBulkAction}
              actions={
                activeTab === "customers"
                  ? [{ value: "RESTORE", label: "Restore Selected" }]
                  : [
                      { value: "RESTORE", label: "Restore Selected" },
                      { value: "PERMANENT_DELETE", label: "Permanently Delete Selected" },
                    ]
              }
              onApply={handleBulkActionApply}
              applyDisabled={!bulkAction || selectedIds.length === 0 || bulkProcessing}
            />
          )}
        />

        {/* BOTTOM PAGINATION MATCHING TAX / ORDERS */}
        <div className="flex items-center justify-end mt-4">
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={setPage}
            alwaysShow={true}
          />
        </div>

        {/* ─── Read-Only Category Detail Modal (Styled like Tax Rule View) ─── */}
        <Modal
          open={Boolean(viewingCategory)}
          onClose={() => setViewingCategory(null)}
          title={viewingCategory?.name ?? "Category Details"}
          subtitle="Detailed configuration and snapshot for this archived category."
          size="2xl"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="text-[12px] text-[#6B6B6B]">
                Category ID: <span className="font-mono text-[#1A1A1A]">{viewingCategory?.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingCategory(null)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
                >
                  Close
                </button>
                {canManageCategories && (
                  <button
                    type="button"
                    onClick={() => {
                      const cat = viewingCategory;
                      setViewingCategory(null);
                      setRestoringItem({
                        type: "categories",
                        id: cat.id,
                        name: `Category "${cat.name}"`,
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    Restore Category
                  </button>
                )}
              </div>
            </div>
          }
        >
          {viewingCategory && (
            <div className="p-6 space-y-5">
              {/* Primary Details Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Category Name
                  </span>
                  <p className="mt-1 text-[14px] font-semibold text-[#1A1A1A] truncate" title={viewingCategory.name}>
                    {viewingCategory.name}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Slug
                  </span>
                  <p className="mt-1 text-[13px] font-mono text-[#555] truncate">
                    {viewingCategory.slug}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Parent Category
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A]">
                    {viewingCategory.parent?.name || "None (Root Category)"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Original Status
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={viewingCategory.status} />
                  </div>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Subcategories Count
                  </span>
                  <p className="mt-1 text-[13.5px] font-semibold text-[#1A1A1A]">
                    {viewingCategory.children?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Archived Date
                  </span>
                  <p className="mt-1 text-[12.5px] font-medium text-[#777]">
                    {formatDateTime(viewingCategory.deletedAt || viewingCategory.updatedAt)}
                  </p>
                </div>
              </div>

              {viewingCategory.description && (
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-1.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Description
                  </span>
                  <p className="text-[13px] text-[#555] leading-relaxed">
                    {viewingCategory.description}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ─── Read-Only Product Detail Modal (Styled like Tax Rule View) ─── */}
        <Modal
          open={Boolean(viewingProduct)}
          onClose={() => setViewingProduct(null)}
          title={viewingProduct?.title ?? "Product Details"}
          subtitle="Detailed specification and variant snapshot for this archived product."
          size="2xl"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="text-[12px] text-[#6B6B6B]">
                Product Code: <span className="font-mono text-[#1A1A1A]">{viewingProduct?.productCode || viewingProduct?.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingProduct(null)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
                >
                  Close
                </button>
                {canManageProducts && (
                  <button
                    type="button"
                    onClick={() => {
                      const prod = viewingProduct;
                      setViewingProduct(null);
                      setRestoringItem({
                        type: "products",
                        id: prod.id,
                        name: `Product "${prod.title}"`,
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    Restore Product
                  </button>
                )}
              </div>
            </div>
          }
        >
          {viewingProduct && (
            <div className="p-6 space-y-5">
              {/* Primary Details Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    SKU
                  </span>
                  <p className="mt-1 text-[13.5px] font-mono font-medium text-[#1A1A1A] truncate">
                    {viewingProduct.sku || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Category
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingProduct.category?.name || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Brand
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingProduct.brand || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Status
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={viewingProduct.status} />
                  </div>
                </div>
              </div>

              {/* Variants & Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Variants Count
                  </span>
                  <p className="mt-1 text-[14px] font-semibold text-[#1A1A1A]">
                    {viewingProduct._count?.variants ?? viewingProduct.variants?.length ?? 0}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Archived Timestamp
                  </span>
                  <p className="mt-1 text-[12.5px] font-medium text-[#777]">
                    {formatDateTime(viewingProduct.deletedAt || viewingProduct.updatedAt)}
                  </p>
                </div>
              </div>

              {viewingProduct.shortDescription && (
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-1.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Short Description
                  </span>
                  <p className="text-[13px] text-[#555] leading-relaxed">
                    {viewingProduct.shortDescription}
                  </p>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ─── Single Restore Confirmation Modal ─── */}
        <ConfirmModal
          open={Boolean(restoringItem)}
          title="Restore Archived Record?"
          message={`Are you sure you want to restore ${restoringItem?.name || "this record"}? It will become active and return to normal management views.`}
          danger={false}
          confirmText="Restore"
          loadingText="Restoring..."
          isLoading={
            restoreAttributeMutation.isPending ||
            restoreCategoryMutation.isPending ||
            restoreProductMutation.isPending ||
            restoreOrderMutation.isPending ||
            restoreCustomerMutation.isPending ||
            restoreQuoteMutation.isPending ||
            restoreWarehouseMutation.isPending ||
            restoreTierMutation.isPending
          }
          onConfirm={handleConfirmRestore}
          onCancel={() => setRestoringItem(null)}
        />

        {/* ─── Bulk Restore Confirmation Modal ─── */}
        <ConfirmModal
          open={showBulkRestoreModal}
          title="Restore Selected Records?"
          message={`Are you sure you want to restore ${selectedIds.length} selected ${activeTab} item${selectedIds.length > 1 ? "s" : ""}? They will return to active status.`}
          danger={false}
          confirmText={`Restore (${selectedIds.length})`}
          loadingText="Restoring records..."
          isLoading={bulkProcessing}
          onConfirm={handleConfirmBulkRestore}
          onCancel={() => setShowBulkRestoreModal(false)}
        />

        {/* ─── Category Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingCategory)}
          onClose={() => setDeletingCategory(null)}
          itemName={deletingCategory ? deletingCategory.name : undefined}
          itemType="Category"
          warningMessage="Choose the deletion method for this category. Soft Delete is recommended for maintaining catalog hierarchy and product categorisation."
          softDeleteDescription="This category is already soft-deleted and stored in the Archive."
          permanentDeleteDescription={
            deletingCategory
              ? `Physically removes "${deletingCategory.name}" from the database. Any child categories will be promoted to root level, and un-ordered products will be permanently cleaned up.`
              : undefined
          }
          permanentDeleteDisabled={false}
          permanentDeleteDisabledReason={undefined}
          onSoftDelete={() => {
            showToast("Category is already archived.");
            setDeletingCategory(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingCategory) return;
            try {
              await permanentDeleteCategoryMutation.mutateAsync({ id: deletingCategory.id, force: true });
              showToast(`Category "${deletingCategory.name}" permanently deleted.`, "success");
              setDeletingCategory(null);
              categoriesQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete category."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteCategoryMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Product Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingProduct)}
          onClose={() => setDeletingProduct(null)}
          itemName={deletingProduct ? deletingProduct.title : undefined}
          itemType="Product"
          warningMessage="Choose the deletion method for this product. Soft Delete is recommended for maintaining catalog structure and historical order lines."
          softDeleteDescription="This product is already soft-deleted and stored in the Archive."
          permanentDeleteDescription={
            deletingProduct
              ? `Physically removes "${deletingProduct.title}" from the database. Allowed only if no variants or order records are tied to this product.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(
            deletingProduct &&
              (deletingProduct._count?.variants ?? deletingProduct.variants?.length ?? 0) > 0
          )}
          permanentDeleteDisabledReason={
            deletingProduct &&
            (deletingProduct._count?.variants ?? deletingProduct.variants?.length ?? 0) > 0
              ? `Cannot permanently delete product because it has ${deletingProduct._count?.variants ?? deletingProduct.variants?.length} associated variant(s). Delete or detach variants first.`
              : undefined
          }
          onSoftDelete={() => {
            showToast("Product is already archived.");
            setDeletingProduct(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingProduct) return;
            const variantCount = deletingProduct._count?.variants ?? deletingProduct.variants?.length ?? 0;
            if (variantCount > 0) {
              throw new Error(`Cannot permanently delete product because it has ${variantCount} associated variant(s).`);
            }
            try {
              await permanentDeleteProductMutation.mutateAsync(deletingProduct.id);
              showToast(`Product "${deletingProduct.title}" permanently deleted.`, "success");
              setDeletingProduct(null);
              productsQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete product."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteProductMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Read-Only Order Details Global Modal ─── */}
        <OrderDetailModal
          open={Boolean(viewingOrderId)}
          onClose={() => setViewingOrderId(null)}
          orderId={viewingOrderId}
        />

        {/* ─── Order Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingOrder)}
          onClose={() => setDeletingOrder(null)}
          itemName={deletingOrder ? `Order #${deletingOrder.orderNumber}` : undefined}
          itemType="Order"
          warningMessage="Choose the deletion method for this order. Soft Delete is recommended for maintaining customer order history, invoices, and financial records."
          softDeleteDescription="This order is already soft-deleted and stored in the Archive."
          permanentDeleteDescription={
            deletingOrder
              ? `Physically removes Order #${deletingOrder.orderNumber} from the database. Allowed only for Draft or Test orders. Blocked by system guards if the order is a real customer order or contains financial transactions.`
              : undefined
          }
          permanentDeleteDisabled={!deletingOrder?.isTest}
          permanentDeleteDisabledReason="Permanent deletion is restricted to Draft and Test orders only. Real customer orders cannot be permanently deleted to retain financial and audit records."
          onSoftDelete={() => {
            showToast("Order is already archived.");
            setDeletingOrder(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingOrder) return;
            if (!deletingOrder.isTest) {
              throw new Error("Cannot permanently delete a real order. Real order history and financial records must be retained. Only Draft or Test orders can be permanently deleted.");
            }
            if (deletingOrder.paymentStatus === "PAID" || deletingOrder.paymentStatus === "REFUNDED") {
              throw new Error(`Cannot permanently delete order with payment status "${deletingOrder.paymentStatus}". Financial records must be retained.`);
            }
            try {
              await permanentDeleteOrderMutation.mutateAsync(deletingOrder.id);
              showToast(`Test order #${deletingOrder.orderNumber} permanently deleted.`, "success");
              setDeletingOrder(null);
              ordersQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete order."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteOrderMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Read-Only Quote Details Global Modal ─── */}
        <QuoteDetailModal
          open={Boolean(viewingQuoteId)}
          onClose={() => setViewingQuoteId(null)}
          quoteId={viewingQuoteId}
        />

        {/* ─── Quote Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingQuote)}
          onClose={() => setDeletingQuote(null)}
          itemName={deletingQuote ? `Quote #${deletingQuote.quoteNumber}` : undefined}
          itemType="Quote Request"
          warningMessage="Choose the deletion method for this quote request. Soft Delete is recommended for maintaining customer communication history and audit records."
          softDeleteDescription="This quote request is already soft-deleted and stored in the Archive."
          permanentDeleteDescription={
            deletingQuote
              ? `Physically removes Quote #${deletingQuote.quoteNumber} from the database. Allowed only for uncommitted or disposable quotes. Blocked if the quote has been sent, accepted, or converted into an order.`
              : undefined
          }
          permanentDeleteDisabled={
            Boolean(
              deletingQuote &&
                (["SENT", "ACCEPTED", "CONVERTED"].includes(deletingQuote.status) ||
                  Boolean(deletingQuote.convertedOrderId))
            )
          }
          permanentDeleteDisabledReason={
            deletingQuote?.status === "CONVERTED" || deletingQuote?.convertedOrderId
              ? "Permanent deletion is not allowed for converted quotes because the quote is linked to a commercial order and must be retained."
              : ["SENT", "ACCEPTED"].includes(deletingQuote?.status || "")
              ? "Permanent deletion is not allowed for quotes in SENT or ACCEPTED status because they represent retained commercial negotiation history."
              : undefined
          }
          onSoftDelete={() => {
            showToast("Quote is already archived.");
            setDeletingQuote(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingQuote) return;
            if (
              ["SENT", "ACCEPTED", "CONVERTED"].includes(deletingQuote.status) ||
              Boolean(deletingQuote.convertedOrderId)
            ) {
              throw new Error("Cannot permanently delete a quote with retained commercial history.");
            }
            try {
              await permanentDeleteQuoteMutation.mutateAsync(deletingQuote.id);
              showToast(`Quote #${deletingQuote.quoteNumber} permanently deleted.`, "success");
              setDeletingQuote(null);
              quotesQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete quote."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteQuoteMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Read-Only Warehouse Details Global Modal ─── */}
        <WarehouseDetailModal
          open={Boolean(viewingWarehouse)}
          onClose={() => setViewingWarehouse(null)}
          warehouse={viewingWarehouse}
        />

        {/* ─── Warehouse Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingWarehouse)}
          onClose={() => setDeletingWarehouse(null)}
          itemName={deletingWarehouse ? deletingWarehouse.name : undefined}
          itemType="Warehouse"
          warningMessage="Choose the deletion method for this warehouse. Soft Delete is recommended to maintain historical orders, invoices, and shipment tracking."
          softDeleteDescription="This warehouse is already archived and stored in the central Archive."
          permanentDeleteDescription={
            deletingWarehouse
              ? `Physically and permanently purges ${deletingWarehouse.name} from the database. Allowed ONLY if this warehouse has zero historical orders, zero order items, zero shipments, zero active stock, and zero inventory adjustment audit logs.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(deletingWarehouse && !deletingWarehouse.canPermanentDelete)}
          permanentDeleteDisabledReason={deletingWarehouse?.permanentDeleteBlockReason || undefined}
          onSoftDelete={() => {
            showToast("Warehouse is already archived.");
            setDeletingWarehouse(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingWarehouse) return;
            if (!deletingWarehouse.canPermanentDelete) {
              throw new Error(deletingWarehouse.permanentDeleteBlockReason || "Cannot permanently delete this warehouse.");
            }
            try {
              await permanentDeleteWarehouseMutation.mutateAsync(deletingWarehouse.id);
              showToast(`${deletingWarehouse.name} permanently deleted.`, "success");
              setDeletingWarehouse(null);
              warehousesQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete warehouse."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteWarehouseMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Read-Only Attribute Details Global Modal ─── */}
        <Modal
          open={Boolean(viewingAttribute)}
          onClose={() => setViewingAttribute(null)}
          title={viewingAttribute ? `Attribute: ${viewingAttribute.name}` : "Attribute Details"}
          size="lg"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="text-[12px] text-[#6B6B6B]">
                ID: <span className="font-mono text-[#1A1A1A]">{viewingAttribute?.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingAttribute(null)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
                >
                  Close
                </button>
                {canManageAttributes && (
                  <button
                    type="button"
                    onClick={() => {
                      const attr = viewingAttribute;
                      setViewingAttribute(null);
                      setRestoringItem({
                        type: "attributes",
                        id: attr.id,
                        name: `Attribute "${attr.name}"`,
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    Restore Attribute
                  </button>
                )}
              </div>
            </div>
          }
        >
          {viewingAttribute && (
            <div className="p-6 space-y-5">
              {/* Primary Details Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Attribute Name
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingAttribute.name}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Slug
                  </span>
                  <p className="mt-1 text-[13.5px] font-mono font-medium text-[#1A1A1A] truncate">
                    {viewingAttribute.slug || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Display Type
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingAttribute.role === "DROPDOWN" ? "Dropdown" : viewingAttribute.role === "X_GRID" ? "Grid X Axis" : "Grid Y Axis"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Original Status
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={viewingAttribute.status} />
                  </div>
                </div>
              </div>

              {/* Dependencies Summary */}
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A] block mb-2">
                  System Dependencies & References
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
                  <div>
                    <span className="text-[#6B6B6B]">Products: </span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingAttribute.dependencyCounts?.products ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B]">Variants: </span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingAttribute.dependencyCounts?.variants ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B]">Product Selections: </span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingAttribute.dependencyCounts?.productSelections ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B]">Filter Config: </span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingAttribute.dependencyCounts?.filterSettings ? "Yes" : "No"}</span>
                  </div>
                </div>
                {viewingAttribute.permanentDeleteBlockReason && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-[12px] text-amber-800 border border-amber-200">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>{viewingAttribute.permanentDeleteBlockReason}</span>
                  </div>
                )}
              </div>

              {/* Values List */}
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A] block mb-2">
                  Configured Values ({viewingAttribute.values?.length ?? 0})
                </span>
                {viewingAttribute.values && viewingAttribute.values.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {viewingAttribute.values.map((v: any) => (
                      <span
                        key={v.id}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12.5px] text-[#1A1A1A]"
                      >
                        <span className="font-medium">{v.value}</span>
                        <span className="text-[10.5px] font-mono text-[#9A9A9A]">({v.slug})</span>
                        {v.status === "INACTIVE" && (
                          <span className="text-[10px] text-gray-500 font-semibold uppercase">(Inactive)</span>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12.5px] text-[#9A9A9A]">No values configured.</p>
                )}
              </div>
            </div>
          )}
        </Modal>

        {/* ─── Attribute Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingAttribute)}
          onClose={() => setDeletingAttribute(null)}
          itemName={deletingAttribute ? deletingAttribute.name : undefined}
          itemType="Attribute"
          warningMessage="Choose the deletion method for this attribute. Soft Delete is recommended to maintain variant configurations and catalog matrices."
          softDeleteDescription="This attribute is already archived and stored in the central Archive."
          permanentDeleteDescription={
            deletingAttribute
              ? `Physically and permanently purges "${deletingAttribute.name}" from the database. Allowed ONLY if this attribute is completely unused by active and archived products, variants, selections, and storefront filter configs.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(deletingAttribute && !deletingAttribute.canPermanentDelete)}
          permanentDeleteDisabledReason={deletingAttribute?.permanentDeleteBlockReason || undefined}
          onSoftDelete={() => {
            showToast("Attribute is already archived.");
            setDeletingAttribute(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingAttribute) return;
            if (!deletingAttribute.canPermanentDelete) {
              throw new Error(deletingAttribute.permanentDeleteBlockReason || "Cannot permanently delete this attribute.");
            }
            try {
              await permanentDeleteAttributeMutation.mutateAsync(deletingAttribute.id);
              showToast(`Attribute "${deletingAttribute.name}" permanently deleted.`, "success");
              setDeletingAttribute(null);
              attributesQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete attribute."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteAttributeMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Variant Permanent Delete Modal (Product Pattern) ─── */}
        <AdminDeleteModal
          open={Boolean(deletingVariant)}
          onClose={() => setDeletingVariant(null)}
          itemName={deletingVariant ? `${deletingVariant.title} (${deletingVariant.sku || "No SKU"})` : undefined}
          itemType="Variant"
          warningMessage="Choose the deletion method for this product variant. Soft Delete is recommended to maintain historical orders, invoices, and analytics integrity."
          softDeleteDescription="This variant is already archived and stored in the central Archive."
          permanentDeleteDescription={
            deletingVariant
              ? `Physically and permanently purges variant "${deletingVariant.title}" from the database. Allowed if this variant has 0 historical orders, 0 quotation items, and 0 active reserved stock.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(deletingVariant && !deletingVariant.canPermanentDelete)}
          permanentDeleteDisabledReason={deletingVariant?.permanentDeleteBlockReason || undefined}
          onSoftDelete={() => {
            showToast("Variant is already archived.");
            setDeletingVariant(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingVariant) return;
            if (!deletingVariant.canPermanentDelete) {
              throw new Error(deletingVariant.permanentDeleteBlockReason || "Cannot permanently delete this variant.");
            }
            try {
              await permanentDeleteVariantMutation.mutateAsync({
                productId: deletingVariant.productId,
                variantId: deletingVariant.id,
              });
              showToast(`Variant "${deletingVariant.title}" permanently deleted.`, "success");
              setDeletingVariant(null);
              variantsQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete variant."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteVariantMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Read-Only Variant Details Global Modal ─── */}
        <Modal
          open={Boolean(viewingVariant)}
          onClose={() => setViewingVariant(null)}
          title={viewingVariant ? `Variant: ${viewingVariant.title}` : "Variant Details"}
          subtitle="Detailed configuration, stock levels, pricing, and dependency snapshot for this archived variant."
          size="2xl"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              <span className="text-[12px] text-[#6B6B6B]">
                Variant ID: <span className="font-mono text-[#1A1A1A]">{viewingVariant?.id}</span>
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setViewingVariant(null)}
                  className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
                >
                  Close
                </button>
                {canManageProducts && (
                  <button
                    type="button"
                    onClick={() => {
                      const v = viewingVariant;
                      setViewingVariant(null);
                      setRestoringItem({
                        type: "variants",
                        id: v.id,
                        name: `Variant "${v.title}"`,
                        productId: v.productId,
                      });
                    }}
                    className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
                  >
                    <RotateCcw size={13} />
                    Restore Variant
                  </button>
                )}
              </div>
            </div>
          }
        >
          {viewingVariant && (
            <div className="p-6 space-y-5">
              {/* Primary Details Grid */}
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    SKU
                  </span>
                  <p className="mt-1 font-mono text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingVariant.sku || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Parent Product
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingVariant.product?.title || "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Package
                  </span>
                  <p className="mt-1 text-[13.5px] font-medium text-[#1A1A1A] truncate">
                    {viewingVariant.package?.title || "Standard Item"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A]">
                    Original Status
                  </span>
                  <div className="mt-1">
                    <StatusBadge status={viewingVariant.status} />
                  </div>
                </div>
              </div>

              {/* Dependencies Summary */}
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A] block mb-2">
                  System Dependencies & References
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 text-[12.5px]">
                  <div>
                    <span className="text-[#6B6B6B] block">Order Items:</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingVariant.dependencyCounts?.orderItems ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B] block">Quote Items:</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingVariant.dependencyCounts?.quoteItems ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B] block">Cart Items:</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingVariant.dependencyCounts?.cartItems ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B] block">Active Stock:</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingVariant.dependencyCounts?.activeStock ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B] block">Reserved Stock:</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingVariant.dependencyCounts?.reservedStock ?? 0}</span>
                  </div>
                  <div>
                    <span className="text-[#6B6B6B] block">Adjustments:</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingVariant.dependencyCounts?.adjustments ?? 0}</span>
                  </div>
                </div>
                {viewingVariant.permanentDeleteBlockReason && (
                  <div className="mt-3 flex items-start gap-2 rounded-md bg-amber-50 p-2.5 text-[12px] text-amber-800 border border-amber-200">
                    <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-600" />
                    <span>{viewingVariant.permanentDeleteBlockReason}</span>
                  </div>
                )}
              </div>

              {/* Configured Attributes */}
              {viewingVariant.attributeValues && viewingVariant.attributeValues.length > 0 && (
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A] block mb-2">
                    Configured Attributes ({viewingVariant.attributeValues.length})
                  </span>
                  <div className="flex flex-wrap gap-2">
                    {viewingVariant.attributeValues.map((av: any, idx: number) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-2.5 py-1 text-[12.5px] text-[#1A1A1A]"
                      >
                        <span className="text-[#888]">{av.attribute?.name || "Attribute"}:</span>
                        <span className="font-medium">{av.attributeValue?.value || "—"}</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Pricing & Inventory by Country */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A] block mb-2">
                    Selling Prices ({viewingVariant.prices?.length ?? 0})
                  </span>
                  {viewingVariant.prices && viewingVariant.prices.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {viewingVariant.prices.map((p: any) => (
                        <div key={p.id} className="flex justify-between text-[12.5px] bg-white p-2 rounded border border-[#E6E6E6]">
                          <span className="text-[#6B6B6B]">{p.country?.name || p.country?.code || "Default"}:</span>
                          <span className="font-medium text-[#1A1A1A]">
                            {p.currency?.symbol || "$"}{Number(p.sellingPrice).toFixed(2)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-[#9A9A9A]">No active pricing rows.</p>
                  )}
                </div>

                <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                  <span className="text-[11.5px] font-semibold uppercase tracking-wider text-[#9A9A9A] block mb-2">
                    Inventory Facilities ({viewingVariant.inventories?.length ?? 0})
                  </span>
                  {viewingVariant.inventories && viewingVariant.inventories.length > 0 ? (
                    <div className="space-y-1.5 max-h-36 overflow-y-auto">
                      {viewingVariant.inventories.map((inv: any) => (
                        <div key={inv.id} className="flex justify-between text-[12.5px] bg-white p-2 rounded border border-[#E6E6E6]">
                          <span className="text-[#6B6B6B] truncate">{inv.warehouse?.name || "Facility"}:</span>
                          <span className="font-medium text-[#1A1A1A] shrink-0">
                            {inv.stock} in stock ({inv.reservedStock} reserved)
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[12.5px] text-[#9A9A9A]">No inventory assignments.</p>
                  )}
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* ─── Review Permanent Delete Modal ─── */}
        <AdminDeleteModal
          open={Boolean(deletingReview)}
          onClose={() => setDeletingReview(null)}
          itemName={
            deletingReview
              ? (deletingReview.customerName ? `Review from ${deletingReview.customerName}` : `Review #${deletingReview.id}`)
              : undefined
          }
          itemType="Product Review"
          warningMessage="Choose the deletion method for this archived product review. Soft Delete is recommended to maintain review records and audit history."
          softDeleteDescription="This review is already archived and stored in the central Archive."
          permanentDeleteDescription={
            deletingReview
              ? `Physically and permanently deletes the review for "${deletingReview.productTitle || "Product"}" from the database. Allowed only for PENDING or REJECTED reviews; APPROVED reviews are protected.`
              : undefined
          }
          permanentDeleteDisabled={deletingReview?.status === "APPROVED"}
          permanentDeleteDisabledReason={
            deletingReview?.status === "APPROVED"
              ? "Cannot permanently delete an approved review. Approved customer reviews must be retained for integrity and audit compliance."
              : undefined
          }
          onSoftDelete={() => {
            showToast("Review is already archived.", "info");
            setDeletingReview(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingReview) return;
            if (deletingReview.status === "APPROVED") {
              throw new Error("Cannot permanently delete an approved review.");
            }
            try {
              await permanentDeleteReviewMutation.mutateAsync(deletingReview.id);
              showToast("Review permanently deleted successfully.", "success");
              setDeletingReview(null);
              reviewsQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete review."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteReviewMutation.isPending}
          initialDeleteType="permanent"
        />

        {/* ─── Read-Only Review Details Global Modal ─── */}
        <Modal
          open={Boolean(viewingReview)}
          onClose={() => setViewingReview(null)}
          title="Archived Review Details"
          subtitle="Customer feedback information and rating breakdown."
          size="2xl"
          footer={
            <div className="flex items-center justify-between gap-3 w-full">
              {canManageReviews && viewingReview && (
                <button
                  type="button"
                  onClick={() => {
                    const rev = viewingReview;
                    setViewingReview(null);
                    setRestoringItem({
                      type: "reviews",
                      id: rev.id,
                      name: `Review for "${rev.productTitle || rev.id}"`,
                    });
                  }}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#CFE8D7] bg-[#F1FBF4] px-3 text-[12.5px] font-semibold text-[#1F8F4A] hover:bg-[#E2F7E8] transition-colors cursor-pointer"
                >
                  <RotateCcw size={13} />
                  Restore Review
                </button>
              )}
              <button
                type="button"
                onClick={() => setViewingReview(null)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer ml-auto"
              >
                Close
              </button>
            </div>
          }
        >
          {viewingReview && (
            <div className="p-6 space-y-5">
              {/* Top Product Summary */}
              <div className="flex items-start gap-3.5 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                {viewingReview.productImage ? (
                  <img
                    src={viewingReview.productImage}
                    alt={viewingReview.productTitle}
                    className="h-12 w-12 rounded-lg object-cover border border-[#E6E6E6] flex-none"
                  />
                ) : null}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Product</span>
                    <StatusBadge status={viewingReview.status} />
                  </div>
                  <h4 className="text-[15px] font-semibold text-[#1A1A1A] mt-0.5">{viewingReview.productTitle || "Unknown Product"}</h4>
                  {viewingReview.productSlug && (
                    <Link
                      href={`/products/${viewingReview.productSlug}`}
                      target="_blank"
                      className="inline-flex items-center gap-1 text-[11.5px] text-[#E31E24] hover:underline mt-1 font-medium"
                    >
                      View Live Product Page <ExternalLink size={11} />
                    </Link>
                  )}
                </div>
              </div>

              {/* Customer & Ratings Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Customer</span>
                  <p className="mt-1 text-[13px] font-semibold text-[#1A1A1A] truncate">{viewingReview.customerName || "Anonymous"}</p>
                  {viewingReview.customerEmail && (
                    <p className="text-[11.5px] text-[#6B6B6B] truncate">{viewingReview.customerEmail}</p>
                  )}
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Overall Score</span>
                  <div className="mt-1 flex items-center gap-1 text-[16px] font-bold text-[#F59E0B]">
                    <span>{viewingReview.ratingOverall ?? 5}.0</span>
                    <Star size={15} className="fill-[#F59E0B]" />
                  </div>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Quality Score</span>
                  <div className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-[#1A1A1A]">
                    <span>{viewingReview.ratingQuality ?? 5} / 5</span>
                    <Star size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
                  </div>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Price Score</span>
                  <div className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-[#1A1A1A]">
                    <span>{viewingReview.ratingPrice ?? 5} / 5</span>
                    <Star size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
                  </div>
                </div>
              </div>

              {/* Full Feedback Text */}
              <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Customer Feedback</span>
                <p className="text-[13px] leading-relaxed text-[#1A1A1A] whitespace-pre-wrap bg-white p-3.5 rounded-lg border border-[#E6E6E6]">
                  {viewingReview.feedbackText || <span className="italic text-[#9A9A9A]">No feedback comment provided.</span>}
                </p>
              </div>

              {/* Timestamps */}
              <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-3 text-[12px] text-[#9A9A9A]">
                <span>Review ID: <span className="font-mono text-[#1A1A1A]">{viewingReview.id}</span></span>
                <span>Archived: {formatDateTime(viewingReview.deletedAt || viewingReview.createdAt)}</span>
              </div>
            </div>
          )}
        </Modal>

        {/* ─── Bulk Permanent Delete Confirmation Modal ─── */}
        <Modal
          open={showBulkPermanentModal}
          onClose={() => !bulkProcessing && setShowBulkPermanentModal(false)}
          title={`Permanently Delete ${selectedIds.length} ${activeTab.slice(0, -1).toUpperCase()} Record${selectedIds.length > 1 ? "s" : ""}`}
          subtitle="Physical database purge with authoritative dependency evaluation."
          size="md"
          footer={
            <div className="flex items-center justify-end gap-2 w-full">
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={() => setShowBulkPermanentModal(false)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={bulkProcessing}
                onClick={handleConfirmBulkPermanentDelete}
                className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-red-700 transition-colors cursor-pointer disabled:opacity-50 shadow-2xs"
              >
                <Trash2 size={14} />
                {bulkProcessing ? "Evaluating & Deleting..." : "Permanently Delete"}
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
              <span className="font-semibold uppercase tracking-wide">{activeTab}</span> archive for permanent deletion.
            </div>

            <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-3.5 text-[12.5px] text-[#555] space-y-2">
              <span className="font-semibold text-[#1A1A1A] block">Authoritative Data Integrity Protection:</span>
              <p>
                Every selected record is individually verified by backend safety rules before deletion.
              </p>
              <p>
                Any item associated with historical orders, invoices, shipment tracking, customer carts, or active inventory will be <strong className="text-[#1A1A1A]">strictly protected</strong> and skipped.
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
                ? `All ${bulkPermanentResult.blockedCount || bulkPermanentResult.totalSelected} selected records are protected by database integrity rules.`
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
              {/* 3 Metric Cards: Selected, Permanently Deleted, Protected / Skipped */}
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

              {/* Status Outcome Banner */}
              {bulkPermanentResult.blockedCount === 0 && bulkPermanentResult.deletedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-emerald-200 bg-emerald-50/70 p-3 text-[12.5px] text-emerald-900">
                  <CheckCircle2 size={16} className="shrink-0 text-emerald-600" />
                  <span>
                    All {bulkPermanentResult.deletedCount} selected records were verified as unreferenced and permanently removed from the database.
                  </span>
                </div>
              )}

              {bulkPermanentResult.deletedCount === 0 && bulkPermanentResult.blockedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-red-200 bg-red-50/70 p-3 text-[12.5px] text-red-900">
                  <XCircle size={16} className="shrink-0 text-red-600" />
                  <span>
                    No records were deleted. All selected items are protected because they are linked to order history, tax invoices, carts, or active stock.
                  </span>
                </div>
              )}

              {bulkPermanentResult.deletedCount > 0 && bulkPermanentResult.blockedCount > 0 && (
                <div className="flex items-center gap-2.5 rounded-lg border border-amber-200 bg-amber-50/70 p-3 text-[12.5px] text-amber-900">
                  <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                  <span>
                    Mixed outcome: {bulkPermanentResult.deletedCount} eligible records were permanently purged. {bulkPermanentResult.blockedCount} records with active system dependencies remain safely preserved in the archive.
                  </span>
                </div>
              )}

              {/* Protected Records List */}
              {bulkPermanentResult.blocked && bulkPermanentResult.blocked.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12.5px] font-semibold text-[#1A1A1A]">
                      Protected Records ({bulkPermanentResult.blocked.length}):
                    </span>
                    <span className="text-[11px] text-[#888]">
                      Untouched in database
                    </span>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-2 border border-[#E6E6E6] rounded-lg p-2.5 bg-[#FAFAFA]">
                    {bulkPermanentResult.blocked.map((item: any, index: number) => (
                      <div key={item.id || index} className="text-[12px] bg-white p-3 rounded-lg border border-[#E6E6E6] shadow-2xs">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[#1A1A1A]">{item.name || item.id}</span>
                          <span className="inline-flex shrink-0 items-center rounded bg-amber-50 px-1.5 py-0.5 text-[10.5px] font-medium text-amber-800 border border-amber-200">
                            Protected
                          </span>
                        </div>
                        <div className="text-amber-900 mt-1 flex items-start gap-1">
                          <span className="font-medium shrink-0">Reason:</span>
                          <span>{item.reason}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Modal>

        {/* ─── Pricing Permanent Delete Modal ─── */}
        <AdminDeleteModal
          open={Boolean(deletingPricing)}
          onClose={() => setDeletingPricing(null)}
          itemName={deletingPricing?.ruleName || "Pricing Rule"}
          itemType="Pricing Rule"
          warningMessage="Choose the deletion method for this archived pricing rule. Soft Delete is recommended to keep historic pricing logs intact."
          softDeleteDescription="This pricing rule is already soft-deleted and stored in the central Archive."
          permanentDeleteDescription={
            deletingPricing
              ? `Physically and permanently purges pricing rule "${deletingPricing.ruleName}" from the database. Allowed ONLY if a fallback active base price remains or parent product is inactive/archived.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(deletingPricing && deletingPricing.canPermanentDelete === false)}
          permanentDeleteDisabledReason={deletingPricing?.permanentDeleteBlockReason ?? undefined}
          initialDeleteType="permanent"
          onSoftDelete={() => {
            showToast("Pricing rule is already archived.");
            setDeletingPricing(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingPricing) return;
            if (deletingPricing.canPermanentDelete === false) {
              showToast(deletingPricing.permanentDeleteBlockReason || "Permanent deletion is blocked for this pricing rule.", "error");
              return;
            }
            try {
              await permanentDeletePricingMutation.mutateAsync(deletingPricing.id);
              showToast(`Pricing rule "${deletingPricing.ruleName}" permanently deleted from database.`, "success");
              setDeletingPricing(null);
              await refetchCurrent();
              void pricingQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete pricing rule."), "error");
            }
          }}
          isPermanentDeleting={permanentDeletePricingMutation.isPending}
        />

        {/* ─── Tier Permanent Delete Modal ─── */}
        <AdminDeleteModal
          open={Boolean(deletingTier)}
          onClose={() => setDeletingTier(null)}
          itemName={deletingTier?.name || "Pricing Tier"}
          itemType="Pricing Tier"
          warningMessage="Choose the deletion method for this archived pricing tier. Permanent deletion will permanently remove this tier and cascade-delete its country mappings."
          softDeleteDescription="This pricing tier is already soft-deleted and stored in the central Archive."
          permanentDeleteDescription={
            deletingTier
              ? `Physically and permanently purges pricing tier "${deletingTier.name}" from the database. Allowed ONLY if 0 customers, 0 pricing rules, and 0 discounts reference it.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(deletingTier && deletingTier.canPermanentDelete === false)}
          permanentDeleteDisabledReason={deletingTier?.permanentDeleteBlockReason ?? undefined}
          initialDeleteType="permanent"
          onSoftDelete={() => {
            showToast("Pricing tier is already archived.", "info");
            setDeletingTier(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingTier) return;
            if (deletingTier.canPermanentDelete === false) {
              showToast(deletingTier.permanentDeleteBlockReason || "Permanent deletion is blocked for this tier.", "error");
              return;
            }
            try {
              await permanentDeleteTierMutation.mutateAsync(deletingTier.id);
              showToast(`Pricing tier "${deletingTier.name}" permanently deleted from database.`, "success");
              setDeletingTier(null);
              await refetchCurrent();
              void tiersQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete tier."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteTierMutation.isPending}
        />

        {/* ─── Discount Permanent Delete Modal ─── */}
        <AdminDeleteModal
          open={Boolean(deletingDiscount)}
          onClose={() => setDeletingDiscount(null)}
          itemName={deletingDiscount?.name || "Discount Rule"}
          itemType="Discount Rule"
          warningMessage="Choose the deletion method for this archived discount rule. Permanent deletion will permanently purge this discount and cascade-remove all its association records."
          softDeleteDescription="This discount rule is already soft-deleted and stored in the central Archive."
          permanentDeleteDescription={
            deletingDiscount
              ? `Physically and permanently purges discount rule "${deletingDiscount.name}" from the database. This action cannot be undone.`
              : undefined
          }
          permanentDeleteDisabled={Boolean(deletingDiscount && deletingDiscount.canPermanentDelete === false)}
          permanentDeleteDisabledReason={deletingDiscount?.permanentDeleteBlockReason ?? undefined}
          initialDeleteType="permanent"
          onSoftDelete={() => {
            showToast("Discount is already archived.", "info");
            setDeletingDiscount(null);
          }}
          onPermanentDelete={async () => {
            if (!deletingDiscount) return;
            if (deletingDiscount.canPermanentDelete === false) {
              showToast(deletingDiscount.permanentDeleteBlockReason || "Permanent deletion is blocked for this discount.", "error");
              return;
            }
            try {
              await permanentDeleteDiscountMutation.mutateAsync(deletingDiscount.id);
              showToast(`Discount "${deletingDiscount.name}" permanently deleted from database.`, "success");
              setDeletingDiscount(null);
              await refetchCurrent();
              void discountsQuery.refetch();
            } catch (err) {
              showToast(getAdminErrorMessage(err, "Failed to permanently delete discount."), "error");
            }
          }}
          isPermanentDeleting={permanentDeleteDiscountMutation.isPending}
        />

        {/* ─── Pricing Read-Only Detail Modal ─── */}
        <Modal
          open={Boolean(viewingPricing)}
          onClose={() => setViewingPricing(null)}
          title="Archived Pricing Rule Details"
          subtitle={viewingPricing?.ruleName || "Pricing Rule"}
          size="lg"
          footer={
            <div className="flex items-center justify-between w-full">
              <div className="text-[12px] text-[#888]">
                ID: <span className="font-mono">{viewingPricing?.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setViewingPricing(null)}
                className="rounded-md bg-[#1A1A1A] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-black transition-colors cursor-pointer shadow-2xs"
              >
                Close
              </button>
            </div>
          }
        >
          {viewingPricing && (
            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Rule Type</span>
                  <p className="mt-1 text-[13px] font-semibold text-[#1A1A1A]">{viewingPricing.ruleType}</p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Selling Price</span>
                  <p className="mt-1 text-[14px] font-bold text-[#E31E24]">
                    {viewingPricing.details?.currency?.symbol || "$"}{Number(viewingPricing.details?.sellingPrice ?? viewingPricing.basePrice ?? 0).toFixed(2)}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">MRP</span>
                  <p className="mt-1 text-[13px] font-semibold text-[#1A1A1A]">
                    {viewingPricing.details?.mrp != null ? `${viewingPricing.details?.currency?.symbol || "$"}${Number(viewingPricing.details.mrp).toFixed(2)}` : "—"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Status</span>
                  <div className="mt-1">
                    <StatusBadge status={viewingPricing.status} />
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A] block">Product & Variant Context</span>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <span className="text-[#888] block text-[11.5px]">Product</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingPricing.product?.title || "—"}</span>
                    {viewingPricing.product?.sku && <span className="font-mono text-[#888] text-[11px] block">SKU: {viewingPricing.product.sku}</span>}
                  </div>
                  <div>
                    <span className="text-[#888] block text-[11.5px]">Variant</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingPricing.variant?.title || "No Variant (Product Base Price)"}</span>
                    {viewingPricing.variant?.sku && <span className="font-mono text-[#888] text-[11px] block">SKU: {viewingPricing.variant.sku}</span>}
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A] block">Scope & Geographic Context</span>
                <div className="grid grid-cols-2 gap-3 text-[13px]">
                  <div>
                    <span className="text-[#888] block text-[11.5px]">Country</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingPricing.country?.name ? `${viewingPricing.country.name} (${viewingPricing.country.code})` : "Global / All Countries"}</span>
                  </div>
                  <div>
                    <span className="text-[#888] block text-[11.5px]">Tier / Minimum Quantity</span>
                    <span className="font-semibold text-[#1A1A1A]">{viewingPricing.tier?.name || (viewingPricing.moq ? `MOQ: ${viewingPricing.moq}+` : "Standard Base Scope")}</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-3 text-[12px] text-[#9A9A9A]">
                <span>Created: {viewingPricing.createdAt ? formatDateTime(viewingPricing.createdAt) : "—"}</span>
                <span>Archived: {viewingPricing.deletedAt ? formatDateTime(viewingPricing.deletedAt) : "—"}</span>
              </div>
            </div>
          )}
        </Modal>
      </div>
    </AdminLayout>
  );
}

export default function AdminArchivePage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center bg-[#F2F2F2]">
          <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
        </div>
      }
    >
      <AdminArchiveContent />
    </Suspense>
  );
}
