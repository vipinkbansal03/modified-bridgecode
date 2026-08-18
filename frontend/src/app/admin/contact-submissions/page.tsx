"use client";

import { useState, useLayoutEffect, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

import { DataTable, Pagination } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

import { ContactSubmissionToolbar } from "./ContactSubmissionToolbar";
import { contactSubmissionColumns } from "./ContactSubmissionColumns";

import { useAdminContactSubmissions } from "@/hooks/admin/useAdminHooks";

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
  const [type, setType] = useState<string | undefined>(undefined);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading, refetch, isFetching } = useAdminContactSubmissions({
    page,
    limit,
    search: debouncedSearch,
    sortBy,
    sortDir,
    type,
  });

  const tabs = [
    { value: undefined, label: "All" },
    { value: "general", label: "General Inquiries" },
    { value: "dealer", label: "Dealer Applications" },
  ];

  if (authLoading || !hasPermission("contactSubmissions.view")) {
    return null;
  }

  return (
    <AdminLayout
      title="Contact Submissions"
      breadcrumb={[
        {
          label: "Contact Submissions",
        },
      ]}
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {tabs.map((tab) => (
          <button
            key={tab.label}
            onClick={() => {
              setType(tab.value);
              setPage(1);
            }}
            className={`h-9 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
              type === tab.value
                ? "border-[#E31E24] bg-[#E31E24] text-white"
                : "border-[#E6E6E6] bg-white text-[#555] hover:bg-[#F9F9F9]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <ContactSubmissionToolbar
        search={search}
        onSearchChange={setSearch}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        sortDirection={sortDir}
        onSortDirectionChange={setSortDir}
        pageSize={limit}
        onPageSizeChange={(value) => {
          setLimit(value);
          setPage(1);
        }}
        onReset={() => {
          setSearch("");
          setDebouncedSearch("");
          setSortBy("createdAt");
          setSortDir("desc");
          setLimit(10);
          setType(undefined);
          setPage(1);
        }}
        onRefresh={() => refetch()}
        isRefreshing={isFetching}
      />

      <DataTable
        columns={contactSubmissionColumns}
        data={data?.data ?? []}
        isLoading={isLoading}
        rowKey="id"
      />

      <div className="mt-6">
        <Pagination
          page={page}
          totalPages={data?.pagination?.totalPages ?? 1}
          onPageChange={setPage}
        />
      </div>
    </AdminLayout>
  );
}
