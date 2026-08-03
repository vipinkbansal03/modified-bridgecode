"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Eye, Filter, Pencil, Plus, Search, ShoppingCart, Trash2, Truck, Wallet } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminCountries, useAdminOrders, useDeleteAdminOrder, useOrderAnalytics } from "@/hooks/admin/useAdminHooks";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { getAdminErrorMessage } from "@/services/adminApi";

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
  shippingZone?: { provider?: { displayName: string } | null; country?: { name: string; code: string } | null } | null;
  createdAt: string;
  updatedAt?: string;
  _count?: { items?: number };
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
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("orders.create");
  const canUpdate = hasPermission("orders.update");
  const canDelete = hasPermission("orders.delete");
  const { showToast } = useToast();
  const deleteOrder = useDeleteAdminOrder();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteOrder.mutateAsync(deletingId);
      showToast("Order deleted successfully.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete order."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [countryId, setCountryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading, refetch, isFetching } = useAdminOrders({
    page,
    limit,
    status: status || undefined,
    paymentStatus: paymentStatus || undefined,
    paymentMethod: paymentMethod || undefined,
    search: debouncedSearch.trim() || undefined,
    countryId: countryId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
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
  }, [debouncedSearch, status, paymentStatus, paymentMethod, countryId, dateFrom, dateTo, sortBy, sortDir, limit]);

  const totalRevenue = useMemo(() => Number(analytics.data?.totals?.allTimeRevenue ?? 0), [analytics.data]);

  const resetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setPaymentStatus("");
    setPaymentMethod("");
    setCountryId("");
    setDateFrom("");
    setDateTo("");
    setSortBy("createdAt");
    setSortDir("desc");
    setPage(1);
  };

  const columns: Column<OrderRow>[] = [
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
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/orders/${row.id}`}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
            title="View order"
          >
            <Eye size={13} />
          </Link>
          {canUpdate && (
            <Link
              href={`/admin/orders/${row.id}`}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
              title="Edit order"
            >
              <Pencil size={13} />
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeletingId(row.id)}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50 hover:border-red-200"
              title="Delete order"
            >
              <Trash2 size={13} />
            </button>
          )}
          <Link
            href={`/admin/orders/${row.id}`}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
            title="Shipping"
          >
            <Truck size={13} />
          </Link>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Orders" breadcrumb={[{ label: "Orders" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Orders" value={pagination.total ?? 0} subtitle="All order records" icon={<ShoppingCart size={18} />} />
          <StatCard title="Revenue" value={formatMoney(totalRevenue)} subtitle="All-time paid revenue" icon={<Wallet size={18} />} color="bg-green-600" />
          <StatCard title="Top Country" value={topCountry?.country ?? "-"} subtitle={topCountry ? `${topCountry.orders} orders` : "No order analytics yet"} icon={<Filter size={18} />} color="bg-[#0F6CBD]" />
          <StatCard title="Shipping Ready" value={orders.filter((order) => order.status === "SHIPPED" || order.status === "DELIVERED").length} subtitle="Visible in current page" icon={<Truck size={18} />} color="bg-[#7A4F01]" />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search order, customer..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <RefreshButton onRefresh={refetch} isRefreshing={isFetching} />
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
              >
                <Filter size={14} />
                {showFilters ? "Hide filters" : "Show filters"}
              </button>
              {canCreate && (
                <Link href="/admin/orders/create" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                  <Plus size={14} />
                  Create Order
                </Link>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 border-t border-[#F0F0F0] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#1A1A1A]">Filters & Sorting</span>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="text-[12.5px] font-medium text-[#E31E24] hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white">
          <DataTable<OrderRow> columns={columns} data={orders} rowKey="id" isLoading={isLoading} emptyMessage="No orders yet." />
          <div className="border-t border-[#E6E6E6] px-4 py-3">
            <Pagination page={pagination.page} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!deletingId}
        onCancel={() => setDeletingId(null)}
        onConfirm={handleDelete}
        title="Delete Order"
        message="Are you sure you want to permanently delete this order? This action cannot be undone."
        danger
      />
    </AdminLayout>
  );
}
