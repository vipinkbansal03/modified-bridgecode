"use client";

import { useState, useLayoutEffect, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  DataTable,
  AdminStatsGrid,
  AdminListToolbar,
  AdminSelect,
  Pagination,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminContactSubmissions } from "@/hooks/admin/useAdminHooks";
import { Eye, MessageSquare, Building2, Inbox, Mail, HelpCircle } from "lucide-react";
import { cn } from "@/utils/cn";

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

const visibleColumnsDefault = {
  contact: true,
  phone: true,
  company: true,
  type: true,
  subject: true,
  createdAt: true,
  actions: true,
};

export default function ContactSubmissionsPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();

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
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);

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

  const { data: allData } = useAdminContactSubmissions({ limit: 1000 });
  const allSubmissions = ((allData as any)?.data ?? []) as ContactSubmissionRow[];

  const submissions = (data?.data ?? []) as ContactSubmissionRow[];
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const totalCount = allSubmissions.length || total;
  const generalCount = allSubmissions.filter((s) => s.type !== "dealer").length;
  const dealerCount = allSubmissions.filter((s) => s.type === "dealer").length;

  const columns: Column<ContactSubmissionRow>[] = [
    {
      key: "contact",
      label: "Contact",
      width: "240px",
      align: "left",
      render: (row) => (
        <div className="min-w-0 pr-2">
          <Link
            href={`/admin/contact-submissions/${row.id}`}
            className="text-left font-semibold text-[#1A1A1A] hover:text-[#E31E24] text-[13px] block truncate transition-colors cursor-pointer"
            title={row.name}
          >
            {row.name}
          </Link>
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
        <AdminRowActions
          view={{
            onClick: () => router.push(`/admin/contact-submissions/${row.id}`),
            title: "View inquiry details",
          }}
        />
      ),
    },
  ];

  const filteredColumns = columns.filter((column) => {
    if (column.key === "contact") return visibleColumns.contact;
    if (column.key === "phone") return visibleColumns.phone;
    if (column.key === "company") return visibleColumns.company;
    if (column.key === "type") return visibleColumns.type;
    if (column.key === "subject") return visibleColumns.subject;
    if (column.key === "createdAt") return visibleColumns.createdAt;
    if (column.key === "actions") return visibleColumns.actions;
    return true;
  });

  if (authLoading || !hasPermission("contactSubmissions.view")) {
    return null;
  }

  return (
    <AdminLayout title="Inquiries" breadcrumb={[{ label: "Customers", href: "/admin/customers" }, { label: "Inquiries" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Inquiries", value: totalCount, subtitle: "All received contact forms", icon: <Inbox size={18} />, isLoading },
            { title: "General Inquiries", value: generalCount, subtitle: "Customer support & questions", icon: <MessageSquare size={18} />, color: "bg-sky-600", isLoading },
            { title: "Dealer Applications", value: dealerCount, subtitle: "Partnership & distribution requests", icon: <Building2 size={18} />, color: "bg-amber-600", isLoading },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {[
            { id: "", label: "All Inquiries", count: totalCount, icon: <Inbox size={15} /> },
            { id: "general", label: "General Inquiries", count: generalCount, icon: <MessageSquare size={15} /> },
            { id: "dealer", label: "Dealer Applications", count: dealerCount, icon: <Building2 size={15} /> },
          ].map((tab) => {
            const isActive = type === tab.id;
            return (
              <button
                key={tab.id || "ALL"}
                type="button"
                onClick={() => {
                  setType(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap",
                  isActive
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A]"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "bg-[#F0F0F0] text-[#666]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

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
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [type, sortBy !== "createdAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
            label: "Filters",
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
            options: [
              { key: "contact", label: "Contact" },
              { key: "phone", label: "Phone" },
              { key: "company", label: "Company" },
              { key: "type", label: "Inquiry Type" },
              { key: "subject", label: "Subject / Message" },
              { key: "createdAt", label: "Submitted Date" },
              { key: "actions", label: "Actions" },
            ],
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Inquiries refreshed."));
            },
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
            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <AdminSelect
                label="Inquiry Type"
                value={type}
                onChange={(e) => {
                  setType(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Inquiry Types" },
                  { value: "general", label: "General Inquiries" },
                  { value: "dealer", label: "Dealer Applications" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: "createdAt", label: "Submitted Date" },
                  { value: "name", label: "Contact Name" },
                  { value: "email", label: "Email Address" },
                  { value: "company", label: "Company" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Descending (Newest)" },
                  { value: "asc", label: "Ascending (Oldest)" },
                ]}
              />
            </div>
          }
        />

        {/* FULL-WIDTH DATA TABLE */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<ContactSubmissionRow>
            title="Contact Submissions List"
            columns={filteredColumns}
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
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>
      {ToastComponent}
    </AdminLayout>
  );
}
