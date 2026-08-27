"use client";

import { useState, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  DataTable,
  AdminStatsGrid,
  AdminListToolbar,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminContactSubmissions } from "@/hooks/admin/useAdminHooks";
import { Eye, MessageSquare, Building2, Inbox } from "lucide-react";

export type ContactSubmissionRow = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  company: string | null;
  subject: string | null;
  message?: string | null;
  type: string | null;
  createdAt: string;
};

export default function ContactSubmissionsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("contactSubmissions.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [type, setType] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch, isFetching } = useAdminContactSubmissions({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    sortBy,
    sortDir,
    type: type || undefined,
  });

  const submissions = (data?.data ?? []) as ContactSubmissionRow[];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const columns: Column<ContactSubmissionRow>[] = [
    {
      key: "contact",
      label: "Contact",
      width: "240px",
      align: "left",
      render: (row) => (
        <div className="min-w-0 pr-2">
          <div className="font-semibold text-[#1A1A1A] text-[13px] truncate">{row.name}</div>
          <div className="text-[11.5px] text-[#6B6B6B] truncate mt-0.5">{row.email}</div>
        </div>
      ),
    },
    {
      key: "phone",
      label: "Phone",
      width: "140px",
      align: "left",
      render: (row) => <span className="text-[12.5px] text-[#555]">{row.phone || "—"}</span>,
    },
    {
      key: "company",
      label: "Company",
      width: "160px",
      align: "left",
      render: (row) => <span className="text-[12.5px] text-[#555] truncate block">{row.company || "—"}</span>,
    },
    {
      key: "type",
      label: "Inquiry Type",
      width: "160px",
      align: "left",
      render: (row) => {
        const isDealer = row.type === "dealer";
        return isDealer ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-amber-800">
            <Building2 size={12} className="text-amber-600" />
            Dealer Application
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-[11.5px] font-semibold text-blue-800">
            <MessageSquare size={12} className="text-blue-600" />
            General Inquiry
          </span>
        );
      },
    },
    {
      key: "subject",
      label: "Subject / Message",
      align: "left",
      render: (row) => (
        <div className="min-w-0 pr-4">
          <div className="text-[12.5px] text-[#1A1A1A] font-medium truncate">
            {row.subject || (row.message ? row.message.slice(0, 60) : "—")}
          </div>
          {row.message && row.subject && (
            <div className="text-[11px] text-[#6B6B6B] truncate mt-0.5">{row.message}</div>
          )}
        </div>
      ),
    },
    {
      key: "createdAt",
      label: "Submitted Date",
      width: "140px",
      align: "left",
      render: (row) => (
        <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "90px",
      align: "left",
      render: (row) => (
        <div className="flex items-center justify-start">
          <Link
            href={`/admin/contact-submissions/${row.id}`}
            className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] transition-colors shadow-2xs"
            title="View inquiry details"
          >
            <Eye size={13} />
          </Link>
        </div>
      ),
    },
  ];

  if (authLoading || !hasPermission("contactSubmissions.view")) {
    return null;
  }

  return (
    <AdminLayout title="Contact Submissions" breadcrumb={[{ label: "Contact Submissions" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Inquiries", value: total, subtitle: "All received contact forms", icon: <Inbox size={18} />, isLoading: isLoading },
            { title: "General Inquiries", value: submissions.filter((s) => s.type !== "dealer").length, subtitle: "Customer support & questions", icon: <MessageSquare size={18} />, color: "bg-blue-600", isLoading: isLoading },
            { title: "Dealer Applications", value: submissions.filter((s) => s.type === "dealer").length, subtitle: "Partnership & distribution requests", icon: <Building2 size={18} />, color: "bg-amber-600", isLoading: isLoading },
          ]}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search name, email, company, subject...",
            widthClassName: "w-[280px]",
          }}
          leftExtra={
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "", label: "All Inquiries" },
                { id: "general", label: "General Inquiries" },
                { id: "dealer", label: "Dealer Applications" },
              ].map((tab) => {
                const isSelected = type === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setType(tab.id);
                      setPage(1);
                    }}
                    className={`inline-flex items-center rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer ${
                      isSelected
                        ? "border border-[#E31E24] bg-[#FFF8F8] text-[#E31E24]"
                        : "border border-[#E6E6E6] bg-white text-[#555555] hover:border-[#D1D1D1] hover:bg-[#FAFAFA]"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          }
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [type, sortBy !== "createdAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: () => void refetch(),
            isRefreshing: isFetching,
          }}
          onResetFilters={() => {
            setSearch("");
            setType("");
            setSortBy("createdAt");
            setSortDir("desc");
            setPage(1);
          }}
          filterPanel={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[150px]"
              >
                <option value="">All Inquiry Types</option>
                <option value="general">General Inquiries</option>
                <option value="dealer">Dealer Applications</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[140px]"
              >
                <option value="createdAt">Created Date</option>
                <option value="name">Name</option>
                <option value="email">Email</option>
                <option value="company">Company</option>
              </select>
              <select
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
                  setPage(1);
                }}
                className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] text-[#1A1A1A] outline-none min-w-[120px]"
              >
                <option value="desc">Descending</option>
                <option value="asc">Ascending</option>
              </select>
            </div>
          }
        />

        <DataTable<ContactSubmissionRow>
          title="Contact Submissions List"
          columns={columns}
          data={submissions}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage="No contact submissions found."
          totalItems={total}
          currentPage={page}
          pageSize={limit}
          totalPages={totalPages}
          onPageChange={setPage}
          onPageSizeChange={setLimit}
          pageSizeOptions={[10, 20, 50, 100]}
        />
      </div>
    </AdminLayout>
  );
}
