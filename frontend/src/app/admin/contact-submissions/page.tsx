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

  const { data, isLoading, refetch, isFetching } = useAdminContactSubmissions({
    page,
    limit,
    search,
    sortBy,
    sortDir,
  });

  return (
    <AdminLayout
      title="Contact Submissions"
      breadcrumb={[
        {
          label: "Contact Submissions",
        },
      ]}
    >
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
