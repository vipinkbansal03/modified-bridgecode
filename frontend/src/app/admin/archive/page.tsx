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
} from "@/components/admin/AdminComponents";
import { AdminBulkActionsBar } from "@/components/admin/AdminBulkActionsBar";
import {
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminRowActions";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  useAdminArchivedCategories,
  useRestoreCategory,
  usePermanentDeleteCategory,
  useAdminArchivedProducts,
  useRestoreProduct,
  usePermanentDeleteProduct,
  useAdminCategories,
  useAdminArchivedOrders,
  useRestoreOrder,
  usePermanentDeleteOrder,
  useAdminArchivedCustomers,
  useRestoreCustomer,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { formatDate, formatDateTime } from "@/utils/formatDate";

type ArchiveTab = "categories" | "products" | "orders" | "customers";

interface RestoringItem {
  type: ArchiveTab;
  id: string;
  name: string;
}

interface DeletingItem {
  type: "categories" | "products" | "orders";
  id: string;
  name: string;
}

function AdminArchiveContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { hasPermission } = useAdminAuth();
  const { showToast } = useToast();

  // Permissions
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

  // Tab State
  const tabFromUrl = searchParams.get("tab") as ArchiveTab | null;
  const [activeTab, setActiveTab] = useState<ArchiveTab>(
    tabFromUrl && ["categories", "products", "orders", "customers"].includes(tabFromUrl)
      ? tabFromUrl
      : "categories"
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

  // Sort State
  const [sortBy, setSortBy] = useState<string>("deletedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>("");
  const [showBulkRestoreModal, setShowBulkRestoreModal] = useState(false);
  const [bulkProcessing, setBulkProcessing] = useState(false);

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
    role: true,
    total: true,
    status: true,
    paymentStatus: true,
    archivedAt: true,
    actions: true,
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
  const [viewingCategory, setViewingCategory] = useState<any | null>(null);
  const [viewingProduct, setViewingProduct] = useState<any | null>(null);
  const [restoringItem, setRestoringItem] = useState<RestoringItem | null>(null);
  const [deletingItem, setDeletingItem] = useState<DeletingItem | null>(null);

  // Aux Data
  const { data: categoriesOptions = [] } = useAdminCategories();

  // Queries
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

  // Mutations
  const restoreCategoryMutation = useRestoreCategory();
  const permanentDeleteCategoryMutation = usePermanentDeleteCategory();
  const restoreProductMutation = useRestoreProduct();
  const permanentDeleteProductMutation = usePermanentDeleteProduct();
  const restoreOrderMutation = useRestoreOrder();
  const permanentDeleteOrderMutation = usePermanentDeleteOrder();
  const restoreCustomerMutation = useRestoreCustomer();

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
    return 0;
  }, [
    activeTab,
    productCategoryId,
    productStatus,
    orderStatus,
    orderPaymentStatus,
    customerType,
    customerApprovalStatus,
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
    setPage(1);
    setSelectedIds([]);
  };

  // Restore Confirmation Handler (Single)
  const handleConfirmRestore = async () => {
    if (!restoringItem) return;
    try {
      if (restoringItem.type === "categories") {
        await restoreCategoryMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "products") {
        await restoreProductMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "orders") {
        await restoreOrderMutation.mutateAsync(restoringItem.id);
      } else if (restoringItem.type === "customers") {
        await restoreCustomerMutation.mutateAsync(restoringItem.id);
      }
      showToast(`${restoringItem.name} restored successfully.`, "success");
      setRestoringItem(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to restore record."), "error");
    }
  };

  // Bulk Restore Handler
  const handleBulkActionApply = () => {
    if (bulkAction === "RESTORE" && selectedIds.length > 0) {
      setShowBulkRestoreModal(true);
    }
  };

  const handleConfirmBulkRestore = async () => {
    if (selectedIds.length === 0) return;
    setBulkProcessing(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        if (activeTab === "categories") {
          await restoreCategoryMutation.mutateAsync(id);
        } else if (activeTab === "products") {
          await restoreProductMutation.mutateAsync(id);
        } else if (activeTab === "orders") {
          await restoreOrderMutation.mutateAsync(id);
        } else if (activeTab === "customers") {
          await restoreCustomerMutation.mutateAsync(id);
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

  // Permanent Delete Confirmation Handler
  const handleConfirmPermanentDelete = async () => {
    if (!deletingItem) return;
    try {
      if (deletingItem.type === "categories") {
        await permanentDeleteCategoryMutation.mutateAsync(deletingItem.id);
        showToast(`${deletingItem.name} permanently deleted from database.`, "success");
      } else if (deletingItem.type === "products") {
        await permanentDeleteProductMutation.mutateAsync(deletingItem.id);
        showToast(`${deletingItem.name} permanently deleted from database.`, "success");
      } else if (deletingItem.type === "orders") {
        await permanentDeleteOrderMutation.mutateAsync(deletingItem.id);
        showToast(`${deletingItem.name} permanently deleted.`, "success");
      }
      setDeletingItem(null);
    } catch (error) {
      showToast(
        getAdminErrorMessage(error, "Failed to permanently delete record."),
        "error"
      );
    }
  };

  // ─── Table Columns Configuration ──────────────────────────

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
        render: (cat) => (
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
                    title: "Permanently Delete Category",
                    onClick: () =>
                      setDeletingItem({
                        type: "categories",
                        id: cat.id,
                        name: `Category "${cat.name}"`,
                      }),
                  }
                : undefined
            }
          />
        ),
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
        render: (prod) => (
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
                    title: "Permanently Delete Product",
                    onClick: () =>
                      setDeletingItem({
                        type: "products",
                        id: prod.id,
                        name: `Product "${prod.title}"`,
                      }),
                  }
                : undefined
            }
          />
        ),
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
        render: (order) => (
          <div className="min-w-0">
            <div className="font-medium text-[#1A1A1A] text-[13px] truncate">
              {order.customer
                ? `${order.customer.firstName} ${order.customer.lastName}`
                : order.guestEmail || "Guest User"}
            </div>
            <div className="text-[11.5px] text-[#9A9A9A] truncate">
              {order.customer?.email || order.guestEmail || "—"}
            </div>
          </div>
        ),
      },
      {
        key: "total",
        label: "Total Amount",
        width: "140px",
        render: (order) => (
          <span className="font-medium text-[13.5px] text-[#1A1A1A]">
            {order.currency?.symbol || "$"}{" "}
            {Number(order.totalAmount || 0).toLocaleString()}
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
        render: (order) => (
          <AdminRowActions
            view={{
              title: "View Order Details",
              href: `/admin/orders/${order.id}`,
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
              canDeleteOrders && order.isTest
                ? {
                    title: "Permanently Delete Test Order",
                    onClick: () =>
                      setDeletingItem({
                        type: "orders",
                        id: order.id,
                        name: `Test Order ${order.orderNumber}`,
                      }),
                  }
                : undefined
            }
          />
        ),
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

  // ─── Current Tab Dataset & Props ──────────────────────────

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
    }
  }, [
    activeTab,
    categoriesQuery,
    productsQuery,
    ordersQuery,
    customersQuery,
    debouncedSearch,
    activeFiltersCount,
    visibleColumns,
    categoryColumns,
    productColumns,
    orderColumns,
    customerColumns,
    productsCount,
    ordersCount,
    customersCount,
  ]);

  // Tab Item Configuration
  const tabs = [
    {
      id: "categories" as const,
      label: "Categories",
      icon: <FolderTree size={15} />,
      count: categoriesCount,
    },
    {
      id: "products" as const,
      label: "Products",
      icon: <Package size={15} />,
      count: productsCount,
    },
    {
      id: "orders" as const,
      label: "Orders",
      icon: <ShoppingCart size={15} />,
      count: ordersCount,
    },
    {
      id: "customers" as const,
      label: "Customers",
      icon: <Users size={15} />,
      count: customersCount,
    },
  ];

  // Total Pages Calculation
  const totalPages = useMemo(() => {
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
    return 1;
  }, [
    activeTab,
    categoriesCount,
    productsCount,
    ordersCount,
    customersCount,
    limit,
    productsQuery.data,
    ordersQuery.data,
    customersQuery.data,
  ]);

  return (
    <AdminLayout
      title="Archive"
      breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Archive" }]}
    >
      <div className="space-y-5">
        {/* KPI STATS GRID MATCHING TAX / DASHBOARD / ORDERS PATTERN */}
        <AdminStatsGrid
          stats={[
            {
              title: "Archived Categories",
              value: categoriesCount,
              subtitle: "Soft-deleted category nodes",
              icon: <FolderTree size={18} />,
              isLoading: categoriesQuery.isLoading,
            },
            {
              title: "Archived Products",
              value: productsCount,
              subtitle: "Soft-deleted catalog products",
              icon: <Package size={18} />,
              isLoading: productsQuery.isLoading,
            },
            {
              title: "Archived Orders",
              value: ordersCount,
              subtitle: "Soft-deleted order records",
              icon: <ShoppingCart size={18} />,
              isLoading: ordersQuery.isLoading,
            },
            {
              title: "Archived Customers",
              value: customersCount,
              subtitle: "Soft-deleted user accounts",
              icon: <Users size={18} />,
              isLoading: customersQuery.isLoading,
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
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer",
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
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
              actionType={bulkAction}
              onActionTypeChange={setBulkAction}
              actions={[{ value: "RESTORE", label: "Restore Selected" }]}
              onApply={handleBulkActionApply}
              applyDisabled={!bulkAction || selectedIds.length === 0}
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
            restoreCategoryMutation.isPending ||
            restoreProductMutation.isPending ||
            restoreOrderMutation.isPending ||
            restoreCustomerMutation.isPending
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

        {/* ─── Permanent Delete Confirmation Modal ─── */}
        <ConfirmModal
          open={Boolean(deletingItem)}
          title="Permanently Delete Record?"
          message={`Warning: This action is irreversible. Are you sure you want to physically purge ${deletingItem?.name || "this record"} from the database? All historical associations must be unreferenced.`}
          danger={true}
          confirmText="Permanently Delete"
          loadingText="Deleting..."
          isLoading={
            permanentDeleteProductMutation.isPending ||
            permanentDeleteOrderMutation.isPending
          }
          onConfirm={handleConfirmPermanentDelete}
          onCancel={() => setDeletingItem(null)}
        />
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
