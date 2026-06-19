"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, Pagination, AdminSelect } from "@/components/admin/AdminComponents";
import { useAdminOrders } from "@/hooks/admin/useAdminHooks";
import { Eye } from "lucide-react";
interface Order { id: string; orderNumber: string; customerName: string; customerEmail: string; total: number; status: string; paymentStatus: string; createdAt: string }
export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const { data, isLoading } = useAdminOrders({ page, status, paymentStatus });
  const columns: Column<Order>[] = [
    { key: "orderNumber", label: "Order #", render: (r) => <span className="font-mono font-semibold text-[13px]">{r.orderNumber}</span> },
    { key: "customerName", label: "Customer", render: (r) => <div><div className="font-medium">{r.customerName}</div><div className="text-[11.5px] text-[#9A9A9A]">{r.customerEmail}</div></div> },
    { key: "total", label: "Total", render: (r) => `$${r.total}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: "actions", label: "", width: "50px", render: (r) => <Link href={`/admin/orders/${r.id}`} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Eye size={13} /></Link> },
  ];
  return (
    <AdminLayout title="Orders" breadcrumb={[{ label: "Orders" }]}>
      <div className="mb-5 flex gap-2.5">
        <div className="w-[180px]"><AdminSelect label="" options={[{ value: "", label: "All Status" }, { value: "PENDING", label: "Pending" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "SHIPPED", label: "Shipped" }, { value: "DELIVERED", label: "Delivered" }, { value: "CANCELLED", label: "Cancelled" }]} value={status} onChange={(e) => setStatus(e.target.value)} /></div>
        <div className="w-[180px]"><AdminSelect label="" options={[{ value: "", label: "All Payments" }, { value: "PENDING", label: "Pending" }, { value: "PAID", label: "Paid" }, { value: "FAILED", label: "Failed" }, { value: "REFUNDED", label: "Refunded" }]} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} /></div>
      </div>
      <DataTable<Order> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No orders yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
    </AdminLayout>
  );
}
