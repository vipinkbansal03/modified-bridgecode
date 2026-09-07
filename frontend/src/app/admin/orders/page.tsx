"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Eye, Filter, Pencil, Plus, Search, ShoppingCart, Trash2, Truck, Wallet } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  DataTable,
  Pagination,
  StatCard,
  StatusBadge,
  useToast,
  type Column,
  AdminBulkActionsBar,
  ConfirmModal,
  AdminDeleteModal,
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminCountries, useAdminOrders, useAdminProducts, useOrderAnalytics, useUpdateOrderStatus, useUpdatePaymentStatus, useDeleteOrder, usePermanentDeleteOrder } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type OrderRow = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number | string;
  status: string;
  paymentStatus: string;
  paymentMethod?: string | null;
  country?: { id: string; name: string; code: string } | null;
  currency?: { code: string; symbol?: string | null } | null;
  shippingProvider?: string | null;
  shippingZone?: { provider?: { displayName: string } | null; countries?: { country: { name: string; code: string } }[] } | null;
  createdAt: string;
  updatedAt?: string;
  _count?: { items?: number };
  deletedAt?: string | null;
  isTest?: boolean;
};

type OrderListResponse = {
  data?: OrderRow[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

function formatMoney(value: number | string, currency?: OrderRow["currency"]) {
  const amount = Number(value ?? 0);
  const prefix = currency?.symbol || currency?.code || "$";
  return `${prefix}${amount.toFixed(2)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

function formatPaymentMethod(value?: string | null) {
  if (!value) return "-";
  if (value === "PAY_ON_DELIVERY") return "Pay on Delivery (COD)";
  if (value === "RAZORPAY") return "Razorpay";
  return value;
}

export default function OrdersPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("orders.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("orders.create");
  const canUpdate = hasPermission("orders.update");
  const canDelete = hasPermission("orders.delete") || hasPermission("orders.manage");
  const { showToast } = useToast();
  const updateOrderStatus = useUpdateOrderStatus();
  const updatePaymentStatusMutation = useUpdatePaymentStatus();
  const deleteOrderMutation = useDeleteOrder();
  const permanentDeleteOrderMutation = usePermanentDeleteOrder();

  const [deletingOrder, setDeletingOrder] = useState<OrderRow | null>(null);
  const [deletedView, setDeletedView] = useState<"active" | "deleted">("active");

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPaymentStatus, setBulkPaymentStatus] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/orders", {
        params: {
          status: status || undefined,
          paymentStatus: paymentStatus || undefined,
          paymentMethod: paymentMethod || undefined,
          search: debouncedSearch.trim() || undefined,
          countryId: countryId || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy,
          sortDir,
          deleted: deletedView === "deleted" ? "true" : undefined,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((o: any) => o.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} orders across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all orders.", "error");
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;

    setBulkSaving(true);
    try {
      if (bulkAction === "updateStatus") {
        if (!bulkStatus) {
          showToast("Please select an order status.", "error");
          setBulkSaving(false);
          return;
        }
        await Promise.all(selectedIds.map((id) => updateOrderStatus.mutateAsync({ id, status: bulkStatus })));
        showToast(`Successfully updated status for ${selectedIds.length} order(s).`, "success");
      } else if (bulkAction === "updatePayment") {
        if (!bulkPaymentStatus) {
          showToast("Please select a payment status.", "error");
          setBulkSaving(false);
          return;
        }
        await Promise.all(selectedIds.map((id) => updatePaymentStatusMutation.mutateAsync({ id, paymentStatus: bulkPaymentStatus })));
        showToast(`Successfully updated payment status for ${selectedIds.length} order(s).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
      setBulkStatus("");
      setBulkPaymentStatus("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [countryId, setCountryId] = useState("");
  const [productId, setProductId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: productsData } = useAdminProducts({ limit: 1000, sortBy: "title", sortDir: "asc" });
  const productOptions = useMemo(() => {
    const productList = ((productsData as any)?.data ?? []) as any[];
    return productList.map((product) => ({
      value: product.id,
      label: `${product.title}${product.productCode ? ` (${product.productCode})` : product.sku ? ` (${product.sku})` : ""}`,
    }));
  }, [productsData]);

  const { data, isLoading, refetch, isFetching } = useAdminOrders({
    page,
    limit,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    search: debouncedSearch.trim() || undefined,
    countryId: countryId || undefined,
    productId: productId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
    deleted: deletedView === "deleted" ? "true" : undefined,
  });
  const { data: countries = [] } = useAdminCountries();
  const analytics = useOrderAnalytics();

  const response = data as OrderListResponse | undefined;
  const orders = response?.data ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };
  const topCountry = analytics.data?.ordersByCountry?.[0];

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, paymentStatus, paymentMethod, countryId, productId, dateFrom, dateTo, sortBy, sortDir, limit]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, status, paymentStatus, paymentMethod, countryId, productId, dateFrom, dateTo, sortBy, sortDir, limit]);

  const totalRevenue = useMemo(() => Number(analytics.data?.totals?.allTimeRevenue ?? 0), [analytics.data]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setPaymentStatus("");
    setPaymentMethod("");
    setCountryId("");
    setProductId("");
    setDateFrom("");
    setDateTo("");
    setSortBy("createdAt");
    setSortDir("desc");
    setPage(1);
  };

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    orderNumber: true,
    customerName: true,
    country: true,
    items: true,
    status: true,
    paymentStatus: true,
    paymentMethod: true,
    total: true,
    shippingProvider: true,
    actions: true,
  });

  const columns = useMemo<Column<OrderRow>[]>(
    () => [
      {
        key: "orderNumber",
        label: "Order",
        render: (row) => (
          <div className="min-w-[180px]">
            <div className="font-mono text-[13px] font-semibold text-[#1A1A1A]">{row.orderNumber}</div>
            <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{formatDate(row.createdAt)}</div>
          </div>
        ),
      },
      {
        key: "customerName",
        label: "Customer",
        render: (row) => (
          <div className="min-w-[220px]">
            <div className="font-medium text-[#1A1A1A]">{row.customerName}</div>
            <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.customerEmail}</div>
          </div>
        ),
      },
      { key: "country", label: "Country", render: (row) => row.country?.code ?? "-" },
      { key: "items", label: "Items", render: (row) => row._count?.items ?? 0 },
      { key: "status", label: "Order Status", render: (row) => <StatusBadge status={row.status} /> },
      { key: "paymentStatus", label: "Payment Status", render: (row) => <StatusBadge status={row.paymentStatus} /> },
      { key: "paymentMethod", label: "Payment Mode", render: (row) => formatPaymentMethod(row.paymentMethod) },
      { key: "total", label: "Total", render: (row) => formatMoney(row.total, row.currency) },
      {
        key: "shippingProvider",
        label: "Shipping",
        render: (row) => row.shippingProvider || row.shippingZone?.provider?.displayName || "-",
      },
      {
        key: "actions",
        label: "Actions",
        width: "160px",
        align: "right",
        render: (row) => (
          <AdminRowActions
            align="right"
            view={{
              href: `/admin/orders/${row.id}`,
              title: "View order details",
            }}
            edit={
              canUpdate && !row.deletedAt
                ? {
                    href: `/admin/orders/${row.id}?mode=edit`,
                    title: "Edit order",
                  }
                : undefined
            }
            extra={
              <>
                {!row.deletedAt && (
                  <AdminActionButton
                    action={{
                      href: `/admin/orders/${row.id}?mode=edit`,
                      title: "Manage shipping",
                      icon: <Truck size={13} />,
                    }}
                    defaultIcon={<Truck size={13} />}
                    defaultTitle="Shipping"
                  />
                )}
                {row.deletedAt && (
                  <span className="rounded bg-gray-100 px-2 py-0.5 text-[11px] font-medium text-gray-500 whitespace-nowrap">
                    Soft-deleted
                  </span>
                )}
              </>
            }
            delete={
              canDelete && !row.deletedAt
                ? {
                    onClick: () => setDeletingOrder(row),
                    title: "Delete order",
                  }
                : undefined
            }
          />
        ),
      },
    ],
    [canUpdate, canDelete],
  );

  const filteredColumns = useMemo(
    () => columns.filter((col) => col.key === "actions" || visibleColumns[String(col.key)] !== false),
    [columns, visibleColumns],
  );

  if (authLoading || !hasPermission("orders.view")) {
    return null;
  }

  return (
    <AdminLayout title="Orders" breadcrumb={[{ label: "Orders" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Orders", value: pagination.total ?? 0, icon: <ShoppingCart size={18} /> },
            { title: "Revenue", value: formatMoney(totalRevenue), icon: <Wallet size={18} />, color: "bg-green-600" },
            { title: "Top Country", value: topCountry?.country ?? "-", subtitle: topCountry ? `${topCountry.orders} orders` : "No order analytics yet", icon: <Filter size={18} />, color: "bg-[#0F6CBD]" },
            { title: "Shipping Ready", value: orders.filter((order) => order.status === "SHIPPED" || order.status === "DELIVERED").length, subtitle: "Visible in current page", icon: <Truck size={18} />, color: "bg-[#7A4F01]" }
          ]}
          isLoading={isLoading}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search order, customer...",
            widthClassName: "max-w-[280px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: [status, paymentStatus, paymentMethod, countryId, productId, dateFrom, dateTo].filter(Boolean).length,
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key: string) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key],
              }));
            },
            options: [
              { key: "orderNumber", label: "Order" },
              { key: "customerName", label: "Customer" },
              { key: "country", label: "Country" },
              { key: "items", label: "Items" },
              { key: "status", label: "Order Status" },
              { key: "paymentStatus", label: "Payment Status" },
              { key: "paymentMethod", label: "Payment Mode" },
              { key: "total", label: "Total" },
              { key: "shippingProvider", label: "Shipping" },
            ],
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Orders refreshed."));
            },
            isRefreshing: isFetching,
          }}
          primaryAction={canCreate ? { href: "/admin/orders/create", label: "Create Order" } : undefined}
          onResetFilters={resetFilters}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <AdminSelect
                label="Order View"
                value={deletedView}
                onChange={(event) => {
                  setDeletedView(event.target.value as "active" | "deleted");
                  setPage(1);
                }}
                options={[
                  { value: "active", label: "Active Orders" },
                  { value: "deleted", label: "Soft-Deleted Orders" },
                ]}
              />
              <AdminMultiSearchableSelect
                label="Product"
                values={productId ? productId.split(",").filter(Boolean) : []}
                onValuesChange={(values) => {
                  setProductId(values.join(","));
                  setPage(1);
                }}
                options={productOptions}
                placeholder="Select products"
                allowSelectAll
                selectAllLabel="All products"
              />
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All status" },
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
                value={paymentStatus}
                onChange={(event) => {
                  setPaymentStatus(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All payments" },
                  { value: "PENDING", label: "Pending" },
                  { value: "PAID", label: "Paid" },
                  { value: "FAILED", label: "Failed" },
                  { value: "REFUNDED", label: "Refunded" },
                ]}
              />
              <AdminSelect
                label="Payment Mode"
                value={paymentMethod}
                onChange={(event) => {
                  setPaymentMethod(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All payment modes" },
                  { value: "PAY_ON_DELIVERY", label: "Pay on Delivery (COD)" },
                  { value: "RAZORPAY", label: "Razorpay" },
                ]}
              />
              <AdminMultiSearchableSelect
                label="Country"
                values={countryId ? countryId.split(",").filter(Boolean) : []}
                onValuesChange={(values) => {
                  setCountryId(values.join(","));
                  setPage(1);
                }}
                options={(countries as any[]).map((country) => ({
                  value: country.id,
                  label: `${country.name} (${country.code})`,
                }))}
                placeholder="Select countries"
                allowSelectAll
                selectAllLabel="All countries"
              />
              <AdminSelect
                label="Page Size"
                value={String(limit)}
                onChange={(event) => {
                  setLimit(Number(event.target.value));
                  setPage(1);
                }}
                options={[
                  { value: "10", label: "10 per page" },
                  { value: "20", label: "20 per page" },
                  { value: "50", label: "50 per page" },
                ]}
              />
              <AdminInput label="Date From" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
              <AdminInput label="Date To" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "createdAt", label: "Created date" },
                  { value: "updatedAt", label: "Updated date" },
                  { value: "orderNumber", label: "Order number" },
                  { value: "customerName", label: "Customer name" },
                  { value: "total", label: "Total" },
                  { value: "status", label: "Order status" },
                  { value: "paymentStatus", label: "Payment status" },
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

        <div>
          <DataTable<OrderRow>
            title={deletedView === "deleted" ? "Soft-Deleted Orders" : "Orders List"}
            columns={filteredColumns}
            data={orders}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage={deletedView === "deleted" ? "No soft-deleted orders." : "No orders yet."}
            enableSelection={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalItems={pagination.total}
            currentPage={page}
            pageSize={limit}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            pageSizeOptions={[10, 20, 50]}
            onSelectAll={handleSelectAll}
            renderBulkActions={(selectedIds) => (
              <AdminBulkActionsBar
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actionType={bulkAction}
                onActionTypeChange={setBulkAction}
                actions={[
                  { value: "updateStatus", label: "Update Order Status" },
                  { value: "updatePayment", label: "Update Payment Status" },
                ]}
                onApply={handleBulkAction}
                applyLoading={bulkSaving}
                applyDisabled={
                  !bulkAction || 
                  (bulkAction === "updateStatus" && !bulkStatus) || 
                  (bulkAction === "updatePayment" && !bulkPaymentStatus)
                }
                renderExtraSelectors={() => (
                  <>
                    {bulkAction === "updateStatus" && (
                      <select
                        value={bulkStatus}
                        onChange={(e) => setBulkStatus(e.target.value)}
                        className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                      >
                        <option value="">Choose Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="CONFIRMED">Confirmed</option>
                        <option value="PROCESSING">Processing</option>
                        <option value="SHIPPED">Shipped</option>
                        <option value="DELIVERED">Delivered</option>
                        <option value="CANCELLED">Cancelled</option>
                      </select>
                    )}
                    {bulkAction === "updatePayment" && (
                      <select
                        value={bulkPaymentStatus}
                        onChange={(e) => setBulkPaymentStatus(e.target.value)}
                        className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                      >
                        <option value="">Choose Payment Status</option>
                        <option value="PENDING">Pending</option>
                        <option value="PAID">Paid</option>
                        <option value="FAILED">Failed</option>
                        <option value="REFUNDED">Refunded</option>
                      </select>
                    )}
                  </>
                )}
              />
            )}
          />
          <div className="flex items-center justify-end mt-4">
            <Pagination page={pagination.page} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <AdminDeleteModal
        open={Boolean(deletingOrder)}
        onClose={() => setDeletingOrder(null)}
        itemName={deletingOrder ? `Order #${deletingOrder.orderNumber}` : undefined}
        itemType="Order"
        warningMessage="Choose the deletion method for this order. Soft Delete is recommended for maintaining customer order history, invoices, and financial records."
        softDeleteDescription={
          deletingOrder
            ? `Hides Order #${deletingOrder.orderNumber} from the active orders list while safely retaining customer history, invoices, and accounting records in the Archive.`
            : undefined
        }
        permanentDeleteDescription={
          deletingOrder
            ? `Physically removes Order #${deletingOrder.orderNumber} from the database. Allowed only for Draft or Test orders. Blocked by system guards if the order is a real customer order or contains financial transactions.`
            : undefined
        }
        permanentDeleteDisabled={!deletingOrder?.isTest}
        permanentDeleteDisabledReason="Permanent deletion is restricted to Draft and Test orders only. Real customer orders cannot be permanently deleted to retain financial and audit records."
        onSoftDelete={async () => {
          if (!deletingOrder) return;
          await deleteOrderMutation.mutateAsync(deletingOrder.id);
          showToast(`Order #${deletingOrder.orderNumber} soft-deleted successfully.`, "success");
          setDeletingOrder(null);
          refetch();
        }}
        onPermanentDelete={async () => {
          if (!deletingOrder) return;
          if (!deletingOrder.isTest) {
            throw new Error("Cannot permanently delete a real order. Real order history and financial records must be retained. Only Draft or Test orders can be permanently deleted.");
          }
          if (deletingOrder.paymentStatus === "PAID" || deletingOrder.paymentStatus === "REFUNDED") {
            throw new Error(`Cannot permanently delete order with payment status "${deletingOrder.paymentStatus}". Financial records must be retained.`);
          }
          await permanentDeleteOrderMutation.mutateAsync(deletingOrder.id);
          showToast(`Test order #${deletingOrder.orderNumber} permanently deleted successfully.`, "success");
          setDeletingOrder(null);
          refetch();
        }}
        isSoftDeleting={deleteOrderMutation.isPending}
        isPermanentDeleting={permanentDeleteOrderMutation.isPending}
      />
    </AdminLayout>
  );
}
