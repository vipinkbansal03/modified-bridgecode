"use client";

import { useState } from "react";

import { DataTable, Pagination } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";

import { ContactSubmissionToolbar } from "./ContactSubmissionToolbar";
import { contactSubmissionColumns } from "./ContactSubmissionColumns";

import { useAdminContactSubmissions } from "@/hooks/admin/useAdminHooks";

export default function ContactSubmissionsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [type, setType] = useState<string | undefined>(undefined);

  const { data, isLoading, refetch, isFetching } = useAdminContactSubmissions({
    page,
    limit,
    search,
    sortBy,
    sortDir,
    type,
  });

  const tabs = [
    { value: undefined, label: "All" },
    { value: "general", label: "General Inquiries" },
    { value: "dealer", label: "Dealer Applications" },
  ];

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
