"use client";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatCard, DataTable, StatusBadge, Column } from "@/components/admin/AdminComponents";
import { useAdminOrders, useAdminProducts, useAdminQuotes, useAdminInventory, useAdminInventoryDashboard, useOrderAnalytics } from "@/hooks/admin/useAdminHooks";
import { Package, ShoppingCart, MessageSquare, Warehouse, ArrowRight, TrendingUp } from "lucide-react";
import Link from "next/link";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";

interface OrderRow { id: string; orderNumber: string; customerName: string; total: string; status: string; createdAt: string }
interface InventoryRow { id: string; variant?: { product?: { title: string } }; stock: number; status: string; lowStockThreshold: number }

const orderColumns: Column<OrderRow>[] = [
  { key: "orderNumber", label: "Order #", width: "140px" },
  { key: "customerName", label: "Customer" },
  { key: "total", label: "Total", render: (r) => `${r.total}` },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
];

const invColumns: Column<InventoryRow>[] = [
  { key: "product", label: "Product", render: (r) => r.variant?.product?.title || "—" },
  { key: "stock", label: "Stock" },
  { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
];

const PIE_COLORS = ["#E31E24", "#111111", "#6B6B6B", "#B5151B", "#9A9A9A", "#D4D4D4", "#F2F2F2", "#444444"];

export default function DashboardPage() {
  const { data: orders, isLoading: ordersLoading } = useAdminOrders({ limit: 5 } as never);
  const { data: products, isLoading: productsLoading } = useAdminProducts({ limit: 1 });
  const { data: quotes } = useAdminQuotes({ page: 1 });
  const { data: inventory } = useAdminInventory({ status: "LOW_STOCK", limit: 6 } as never);
  const { data: inventorySummary } = useAdminInventoryDashboard();
  const { data: analytics } = useOrderAnalytics();

  return (
    <AdminLayout title="Dashboard">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard title="Total Products" value={products?.pagination?.total ?? "—"} icon={<Package size={18} />} isLoading={productsLoading} />
        <StatCard title="Total Orders" value={orders?.pagination?.total ?? analytics?.totals?.totalOrders ?? "—"} icon={<ShoppingCart size={18} />} isLoading={ordersLoading} color="bg-blue-600" />
        <StatCard title="Pending Quotes" value={quotes?.pagination?.total ?? "—"} icon={<MessageSquare size={18} />} color="bg-orange-500" />
        <StatCard title="Low Stock Items" value={inventorySummary?.totals?.lowStockCount ?? "—"} icon={<Warehouse size={18} />} color="bg-red-500" />
      </div>

      {/* Charts */}
      {analytics && (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 mb-6">
          {/* Revenue by month */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp size={16} className="text-[#E31E24]" />
              <h2 className="text-[14.5px] font-semibold text-[#1A1A1A]">Revenue by Month (Paid Orders)</h2>
            </div>
            {analytics.revenueByMonth.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-[#9A9A9A]">No paid orders yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={analytics.revenueByMonth} margin={{ top: 0, right: 0, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F0F0F0" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#9A9A9A" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#9A9A9A" }} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip
                    formatter={(v: unknown) => [`$${Number(v).toLocaleString()}`, "Revenue"]}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E6E6E6" }}
                  />
                  <Bar dataKey="revenue" fill="#E31E24" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Orders by country */}
          <div className="rounded-lg border border-[#E6E6E6] bg-white p-5">
            <h2 className="mb-4 text-[14.5px] font-semibold text-[#1A1A1A]">Orders by Country</h2>
            {analytics.ordersByCountry.length === 0 ? (
              <p className="py-12 text-center text-[13px] text-[#9A9A9A]">No orders yet.</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={analytics.ordersByCountry.map((r: { country: string; orders: number }) => ({ name: r.country, orders: r.orders }))}
                    dataKey="orders"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    label={({ name, percent }: { name?: string; percent?: number }) => `${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {analytics.ordersByCountry.map((_: unknown, index: number) => (
                      <Cell key={index} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(v: unknown) => [Number(v), "Orders"]}
                    contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid #E6E6E6" }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Orders */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14.5px] font-semibold text-[#1A1A1A]">Recent Orders</h2>
            <Link href="/admin/orders" className="flex items-center gap-1 text-[12.5px] text-[#E31E24] hover:underline">
              View all <ArrowRight size={12} />
            </Link>
          </div>
          <DataTable<OrderRow>
            columns={orderColumns}
            data={orders?.data?.slice(0, 5) || []}
            rowKey="id"
            isLoading={ordersLoading}
            emptyMessage="No orders yet."
          />
        </div>

        {/* Low stock alerts */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[14.5px] font-semibold text-[#1A1A1A]">Low Stock Alerts</h2>
            <Link href="/admin/inventory" className="flex items-center gap-1 text-[12.5px] text-[#E31E24] hover:underline">
              Manage <ArrowRight size={12} />
            </Link>
          </div>
          <DataTable<InventoryRow>
            columns={invColumns}
            data={inventory?.data?.slice(0, 6) || []}
            rowKey="id"
            emptyMessage="All stock levels are healthy."
          />
        </div>
      </div>
    </AdminLayout>
  );
}
