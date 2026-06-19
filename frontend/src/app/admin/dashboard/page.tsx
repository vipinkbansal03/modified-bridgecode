"use client";

import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatCard, DataTable, StatusBadge, Column } from "@/components/admin/AdminComponents";
import { useAdminOrders, useAdminProducts, useAdminQuotes, useAdminInventory } from "@/hooks/admin/useAdminHooks";
import { Package, ShoppingCart, MessageSquare, Warehouse, ArrowRight } from "lucide-react";
import Link from "next/link";

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

export default function DashboardPage() {
  const { data: orders, isLoading: ordersLoading } = useAdminOrders({ limit: 5 } as never);
  const { data: products, isLoading: productsLoading } = useAdminProducts({ limit: 1 });
  const { data: quotes } = useAdminQuotes({ page: 1 });
  const { data: inventory } = useAdminInventory({} as never);

  return (
    <AdminLayout title="Dashboard">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4 mb-6">
        <StatCard title="Total Products" value={products?.pagination?.total ?? "—"} icon={<Package size={18} />} isLoading={productsLoading} />
        <StatCard title="Total Orders" value={orders?.pagination?.total ?? "—"} icon={<ShoppingCart size={18} />} isLoading={ordersLoading} color="bg-blue-600" />
        <StatCard title="Pending Quotes" value={quotes?.pagination?.total ?? "—"} icon={<MessageSquare size={18} />} color="bg-orange-500" />
        <StatCard title="Low Stock Items" value={inventory?.pagination?.total ?? "—"} icon={<Warehouse size={18} />} color="bg-red-500" />
      </div>

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
