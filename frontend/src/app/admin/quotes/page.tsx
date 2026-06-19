"use client";
import { useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, Pagination, AdminSelect } from "@/components/admin/AdminComponents";
import { useAdminQuotes } from "@/hooks/admin/useAdminHooks";
import { Eye } from "lucide-react";
interface Quote { id: string; quoteNumber: string; customerName: string; customerEmail: string; country: { name: string }; total: number; status: string; createdAt: string }
export default function QuotesPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const { data, isLoading } = useAdminQuotes({ page, status });
  const columns: Column<Quote>[] = [
    { key: "quoteNumber", label: "Quote #", render: (r) => <span className="font-mono font-semibold text-[13px]">{r.quoteNumber}</span> },
    { key: "customerName", label: "Customer", render: (r) => <div><div className="font-medium">{r.customerName}</div><div className="text-[11.5px] text-[#9A9A9A]">{r.customerEmail}</div></div> },
    { key: "country", label: "Country", render: (r) => r.country?.name },
    { key: "total", label: "Total", render: (r) => `$${r.total}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleDateString() },
    { key: "actions", label: "", width: "50px", render: (r) => <Link href={`/admin/quotes/${r.id}`} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Eye size={13} /></Link> },
  ];
  return (
    <AdminLayout title="Quote Requests" breadcrumb={[{ label: "Quotes" }]}>
      <div className="mb-5 w-[200px]"><AdminSelect label="" options={[{ value: "", label: "All Status" }, { value: "PENDING", label: "Pending" }, { value: "REVIEWING", label: "Reviewing" }, { value: "SENT", label: "Sent" }, { value: "CONVERTED", label: "Converted" }]} value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} /></div>
      <DataTable<Quote> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No quote requests yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
    </AdminLayout>
  );
}
