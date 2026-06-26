"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, Column, DataTable, Pagination, StatusBadge } from "@/components/admin/AdminComponents";
import { useAdminCountries, useAdminOrders } from "@/hooks/admin/useAdminHooks";
import { Eye, Plus, Search, X } from "lucide-react";

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  customerEmail: string;
  total: number;
  status: string;
  paymentStatus: string;
  country?: { id: string; name: string; code: string } | null;
  createdAt: string;
}

export default function OrdersPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");
  const [countryId, setCountryId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const { data, isLoading } = useAdminOrders({ page, status, paymentStatus, search, countryId, dateFrom, dateTo });
  const { data: countries = [] } = useAdminCountries();

  const resetFilters = () => {
    setStatus("");
    setPaymentStatus("");
    setSearch("");
    setCountryId("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
  };

  const columns: Column<Order>[] = [
    { key: "orderNumber", label: "Order #", render: (r) => <span className="font-mono text-[13px] font-semibold">{r.orderNumber}</span> },
    { key: "customerName", label: "Customer", render: (r) => <div><div className="font-medium">{r.customerName}</div><div className="text-[11.5px] text-[#9A9A9A]">{r.customerEmail}</div></div> },
    { key: "country", label: "Country", render: (r) => r.country?.code ?? "-" },
    { key: "total", label: "Total", render: (r) => `$${Number(r.total ?? 0).toFixed(2)}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "paymentStatus", label: "Payment", render: (r) => <StatusBadge status={r.paymentStatus} /> },
    { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: "actions", label: "", width: "50px", render: (r) => <Link href={`/admin/orders/${r.id}`} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Eye size={13} /></Link> },
  ];

  return (
    <AdminLayout title="Orders" breadcrumb={[{ label: "Orders" }]}>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div className="grid flex-1 gap-2.5 md:grid-cols-[minmax(180px,1.4fr)_150px_150px_150px_145px_145px_auto]">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              placeholder="Order, customer, email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
            />
          </div>
          <AdminSelect
            label=""
            options={[{ value: "", label: "All Status" }, { value: "PENDING", label: "Pending" }, { value: "CONFIRMED", label: "Confirmed" }, { value: "PROCESSING", label: "Processing" }, { value: "SHIPPED", label: "Shipped" }, { value: "DELIVERED", label: "Delivered" }, { value: "CANCELLED", label: "Cancelled" }]}
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          />
          <AdminSelect
            label=""
            options={[{ value: "", label: "All Payments" }, { value: "PENDING", label: "Pending" }, { value: "PAID", label: "Paid" }, { value: "FAILED", label: "Failed" }, { value: "REFUNDED", label: "Refunded" }]}
            value={paymentStatus}
            onChange={(e) => {
              setPaymentStatus(e.target.value);
              setPage(1);
            }}
          />
          <AdminSelect
            label=""
            options={[{ value: "", label: "All Countries" }, ...countries.map((country: { id: string; code: string; name: string }) => ({ value: country.id, label: `${country.code} - ${country.name}` }))]}
            value={countryId}
            onChange={(e) => {
              setCountryId(e.target.value);
              setPage(1);
            }}
          />
          <AdminInput label="" type="date" value={dateFrom} onChange={(event) => { setDateFrom(event.target.value); setPage(1); }} />
          <AdminInput label="" type="date" value={dateTo} onChange={(event) => { setDateTo(event.target.value); setPage(1); }} />
          <button type="button" onClick={resetFilters} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]">
            <X size={14} />
            Reset
          </button>
        </div>
        <Link href="/admin/orders/create" className="flex h-10 items-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={14} /> Create Order
        </Link>
      </div>
      <DataTable<Order> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No orders yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
    </AdminLayout>
  );
}
