"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Clock3, Eye, Filter, MessageSquareQuote, Plus, Search, ShoppingCart, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, DataTable, Pagination, StatCard, StatusBadge, type Column } from "@/components/admin/AdminComponents";
import { useAdminQuotes } from "@/hooks/admin/useAdminHooks";

type QuoteRow = {
  id: string;
  quoteNumber: string;
  customerName: string;
  customerEmail: string;
  companyName?: string | null;
  country?: { name: string; code: string } | null;
  currency?: { code: string; symbol: string } | null;
  total: number | string;
  status: string;
  createdAt: string;
  updatedAt?: string;
  _count?: { items?: number };
};

type QuoteListResponse = {
  data?: QuoteRow[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

function formatMoney(value: number | string, currency?: QuoteRow["currency"]) {
  const amount = Number(value ?? 0);
  const prefix = currency?.symbol || currency?.code || "$";
  return `${prefix}${amount.toFixed(2)}`;
}

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function QuotesPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data, isLoading } = useAdminQuotes({
    page,
    limit,
    status: status || undefined,
    search: debouncedSearch.trim() || undefined,
    sortBy,
    sortDir,
  });

  const response = data as QuoteListResponse | undefined;
  const quotes = response?.data ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sortBy, sortDir, limit]);

  const counts = useMemo(
    () => ({
      total: Number(pagination.total ?? 0),
      pending: quotes.filter((quote) => quote.status === "PENDING").length,
      reviewing: quotes.filter((quote) => quote.status === "REVIEWING").length,
      converted: quotes.filter((quote) => quote.status === "CONVERTED").length,
    }),
    [pagination.total, quotes],
  );

  const columns: Column<QuoteRow>[] = [
    {
      key: "quoteNumber",
      label: "Quote",
      render: (row) => (
        <div className="min-w-[180px]">
          <div className="font-mono text-[13px] font-semibold text-[#1A1A1A]">{row.quoteNumber}</div>
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
          {row.companyName ? <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.companyName}</div> : null}
        </div>
      ),
    },
    { key: "country", label: "Country", render: (row) => row.country ? `${row.country.code} - ${row.country.name}` : "-" },
    { key: "items", label: "Items", render: (row) => row._count?.items ?? 0 },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "total", label: "Total", render: (row) => formatMoney(row.total, row.currency) },
    { key: "updatedAt", label: "Updated", render: (row) => formatDate(row.updatedAt) },
    {
      key: "actions",
      label: "Actions",
      width: "90px",
      render: (row) => (
        <Link href={`/admin/quotes/${row.id}`} className="inline-flex h-7 items-center gap-1 rounded border border-[#E6E6E6] px-2.5 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]">
          <Eye size={13} />
          View
        </Link>
      ),
    },
  ];

  return (
    <AdminLayout title="Quotes" breadcrumb={[{ label: "Quotes" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Quotes" value={counts.total} subtitle="All quote requests" icon={<MessageSquareQuote size={18} />} />
          <StatCard title="Pending Quotes" value={counts.pending} subtitle="Awaiting review" icon={<Clock3 size={18} />} color="bg-amber-600" />
          <StatCard title="Reviewing" value={counts.reviewing} subtitle="In progress" icon={<Filter size={18} />} color="bg-[#0F6CBD]" />
          <StatCard title="Converted" value={counts.converted} subtitle="Turned into orders" icon={<ShoppingCart size={18} />} color="bg-green-600" />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(3,minmax(0,1fr))]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search quotes"
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>
            <AdminSelect
              label=""
              value={status}
              onChange={(event) => setStatus(event.target.value)}
              options={[
                { value: "", label: "All status" },
                { value: "PENDING", label: "Pending" },
                { value: "REVIEWING", label: "Reviewing" },
                { value: "SENT", label: "Sent" },
                { value: "ACCEPTED", label: "Accepted" },
                { value: "DECLINED", label: "Declined" },
                { value: "CONVERTED", label: "Converted" },
                { value: "EXPIRED", label: "Expired" },
              ]}
            />
            <AdminSelect
              label=""
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              options={[
                { value: "createdAt", label: "Created date" },
                { value: "updatedAt", label: "Updated date" },
                { value: "quoteNumber", label: "Quote number" },
                { value: "customerName", label: "Customer name" },
                { value: "total", label: "Total" },
                { value: "status", label: "Status" },
                { value: "country", label: "Country" },
              ]}
            />
            <AdminSelect
              label=""
              value={sortDir}
              onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
            />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[repeat(2,minmax(0,1fr))_auto_auto]">
            <AdminSelect
              label=""
              value={String(limit)}
              onChange={(event) => setLimit(Number(event.target.value))}
              options={[
                { value: "10", label: "10 / page" },
                { value: "20", label: "20 / page" },
                { value: "50", label: "50 / page" },
              ]}
            />
            <button type="button" onClick={() => setPage(1)} className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]">
              <Filter size={14} />
              Refresh filters
            </button>
            <button
              type="button"
              onClick={() => {
                setSearch("");
                setStatus("");
                setSortBy("createdAt");
                setSortDir("desc");
                setLimit(10);
                setPage(1);
              }}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
            >
              <X size={14} />
              Reset
            </button>
            <Link href="/admin/quotes/create" className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
              <Plus size={14} />
              Create Quote
            </Link>
          </div>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white">
          <DataTable<QuoteRow> columns={columns} data={quotes} rowKey="id" isLoading={isLoading} emptyMessage="No quote requests yet." />
          <div className="border-t border-[#E6E6E6] px-4 py-3">
            <Pagination page={pagination.page} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
