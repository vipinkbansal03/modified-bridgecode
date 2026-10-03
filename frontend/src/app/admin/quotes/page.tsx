"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Eye,
  FileText,
  Filter,
  MessageSquareQuote,
  Pencil,
  Plus,
  Search,
  ShoppingCart,
  Trash2,
  UserCheck,
  CheckCircle2,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminDeleteModal,
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  ConfirmModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminBulkActionsBar } from "@/components/admin/AdminBulkActionsBar";
import { AdminRowActions } from "@/components/admin/AdminRowActions";
import {
  useAdminQuotes,
  useDeleteAdminQuote,
  usePermanentDeleteAdminQuote,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/formatDate";

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
  source?: string;
  convertedOrderId?: string | null;
  deletedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
  internalNotes?: { id: string; note: string }[];
  _count?: { items?: number };
};

type QuoteListResponse = {
  data?: QuoteRow[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

function formatMoney(value: number | string, currency?: QuoteRow["currency"]) {
  const amount = Number(value ?? 0);
  if (amount <= 0) return "Price Upon Request";
  const prefix = currency?.symbol || currency?.code || "$";
  return `${prefix}${amount.toFixed(2)}`;
}

export default function QuotesPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("quotes.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("quotes.create");
  const canUpdate = hasPermission("quotes.update");
  const canDelete = hasPermission("quotes.delete");

  const { showToast } = useToast();
  const deleteQuote = useDeleteAdminQuote();
  const permanentDeleteQuote = usePermanentDeleteAdminQuote();
  const [deletingQuote, setDeletingQuote] = useState<QuoteRow | null>(null);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [isBulkSubmitting, setIsBulkSubmitting] = useState(false);

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");

  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>({
    quoteNumber: true,
    customerName: true,
    country: true,
    source: true,
    items: true,
    status: true,
    total: true,
    updatedAt: true,
  });

  const { data, isLoading, refetch, isFetching } = useAdminQuotes({
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

  const handleBulkArchive = async () => {
    if (selectedIds.length === 0) return;
    setIsBulkSubmitting(true);
    let successCount = 0;
    let failCount = 0;

    for (const id of selectedIds) {
      try {
        await deleteQuote.mutateAsync(id);
        successCount++;
      } catch {
        failCount++;
      }
    }

    setIsBulkSubmitting(false);
    setIsBulkDeleting(false);
    setSelectedIds([]);
    setBulkAction("");

    if (successCount > 0) {
      showToast(`Successfully archived ${successCount} quote${successCount > 1 ? "s" : ""}.`);
    }
    if (failCount > 0) {
      showToast(`Failed to archive ${failCount} quote${failCount > 1 ? "s" : ""}.`, "error");
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/quotes", {
        params: {
          search: debouncedSearch || undefined,
          status: status || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data?.data ?? []).map((q: any) => q.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} quotes across all pages.`, "success");
    } catch {
      setSelectedIds(quotes.map((q) => q.id));
    }
  };

  const handleBulkActionApply = () => {
    if (bulkAction === "ARCHIVE") {
      setIsBulkDeleting(true);
    }
  };

  const handleToggleColumn = (key: string) => {
    setVisibleColumns((prev) => ({
      ...prev,
      [key]: prev[key] === false ? true : false,
    }));
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setSortBy("createdAt");
    setSortDir("desc");
    setLimit(10);
    setPage(1);
  };

  const counts = useMemo(
    () => ({
      total: Number(pagination.total ?? 0),
      pending: quotes.filter((quote) => quote.status === "PENDING").length,
      reviewing: quotes.filter((quote) => quote.status === "REVIEWING").length,
      converted: quotes.filter((quote) => quote.status === "CONVERTED").length,
    }),
    [pagination.total, quotes],
  );

  const columnOptions = [
    { key: "quoteNumber", label: "Quote & Date" },
    { key: "customerName", label: "Customer" },
    { key: "country", label: "Country" },
    { key: "source", label: "Source" },
    { key: "items", label: "Items" },
    { key: "status", label: "Status" },
    { key: "total", label: "Total Amount" },
    { key: "updatedAt", label: "Last Updated" },
  ];

  const columns: Column<QuoteRow>[] = [
    {
      key: "quoteNumber",
      label: "Quote",
      render: (row) => (
        <div className="min-w-[170px]">
          <div className="font-mono text-[13px] font-semibold text-[#1A1A1A]">{row.quoteNumber}</div>
          <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{formatDate(row.createdAt)}</div>
        </div>
      ),
    },
    {
      key: "customerName",
      label: "Customer",
      render: (row) => (
        <div className="min-w-[200px]">
          <div className="font-medium text-[#1A1A1A]">{row.customerName}</div>
          <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.customerEmail}</div>
          {row.companyName ? <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.companyName}</div> : null}
        </div>
      ),
    },
    {
      key: "country",
      label: "Country",
      render: (row) => (row.country ? `${row.country.code} - ${row.country.name}` : "—"),
    },
    {
      key: "source",
      label: "Source",
      render: (row) => {
        const isAdminCreated = row.source === "ADMIN" || Boolean(row.internalNotes && row.internalNotes.length > 0);
        return isAdminCreated ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-purple-200 bg-purple-50 px-2.5 py-1 text-[11px] font-semibold text-purple-700">
            <UserCheck size={11} /> Admin Created
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full border border-blue-200 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700">
            <ShoppingCart size={11} /> Customer RFQ
          </span>
        );
      },
    },
    {
      key: "items",
      label: "Items",
      render: (row) => <span className="font-medium">{row._count?.items ?? 0}</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "total",
      label: "Total",
      render: (row) => <span className="font-medium">{formatMoney(row.total, row.currency)}</span>,
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (row) => <span className="text-[12px] text-[#777]">{formatDate(row.updatedAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      render: (row) => (
        <AdminRowActions
          view={{
            title: "View Quote",
            href: `/admin/quotes/${row.id}`,
          }}
          edit={
            canUpdate
              ? {
                  title: "Edit Quote",
                  href: `/admin/quotes/${row.id}`,
                }
              : undefined
          }
          delete={
            canDelete
              ? {
                  title: "Delete Quote",
                  onClick: () => setDeletingQuote(row),
                }
              : undefined
          }
        />
      ),
    },
  ];

  const filteredColumns = useMemo(
    () => columns.filter((col) => col.key === "actions" || visibleColumns[col.key as string] !== false),
    [visibleColumns, canUpdate, canDelete],
  );

  if (authLoading || !hasPermission("quotes.view")) {
    return null;
  }

  return (
    <AdminLayout title="Quote Requests" breadcrumb={[{ label: "Quotes" }]}>
      <div className="space-y-5">
        {/* KPI STATS GRID MATCHING TAX / ORDERS */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Quotes",
              value: counts.total,
              subtitle: "All quote records",
              icon: <MessageSquareQuote size={18} />,
            },
            {
              title: "Pending Quotes",
              value: counts.pending,
              subtitle: "Awaiting review",
              icon: <Clock3 size={18} />,
              color: "bg-amber-600",
            },
            {
              title: "Reviewing",
              value: counts.reviewing,
              subtitle: "In active review",
              icon: <Search size={18} />,
              color: "bg-[#0F6CBD]",
            },
            {
              title: "Converted",
              value: counts.converted,
              subtitle: "Orders converted",
              icon: <ShoppingCart size={18} />,
              color: "bg-green-600",
            },
          ]}
          isLoading={isLoading}
        />

        {/* STANDARDIZED TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search quotes...",
            widthClassName: "w-[240px]",
          }}
          columns={{
            visibleColumns,
            onToggleColumn: handleToggleColumn,
            options: columnOptions,
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: [status].filter(Boolean).length,
          }}
          refresh={{
            onRefresh: refetch,
            isRefreshing: isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  href: "/admin/quotes/create",
                  label: "Create Quote",
                  icon: <Plus size={15} />,
                }
              : undefined
          }
          onResetFilters={handleResetFilters}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
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
                label="Sort By"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "createdAt", label: "Created Date" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "quoteNumber", label: "Quote Number" },
                  { value: "customerName", label: "Customer Name" },
                  { value: "total", label: "Total Amount" },
                  { value: "status", label: "Status" },
                  { value: "country", label: "Country" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Newest First (Descending)" },
                  { value: "asc", label: "Oldest First (Ascending)" },
                ]}
              />
            </div>
          }
        />

        {/* FULL-WIDTH DATA TABLE WITH BULK ACTIONS */}
        <DataTable<QuoteRow>
          title="Quote Requests List"
          columns={filteredColumns}
          data={quotes}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage={
            debouncedSearch || status
              ? "No quote requests matched your search or filters."
              : "No quote requests yet."
          }
          totalItems={pagination.total ?? 0}
          currentPage={page}
          pageSize={limit}
          totalPages={pagination.totalPages || 0}
          onPageChange={setPage}
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
          enableSelection={canDelete}
          selectedIds={selectedIds}
          onSelectionChange={setSelectedIds}
          onSelectAll={handleSelectAll}
          renderBulkActions={(selectedIds) => (
            <AdminBulkActionsBar
              selectedCount={selectedIds.length}
              onClear={() => setSelectedIds([])}
              actionType={bulkAction}
              onActionTypeChange={setBulkAction}
              actions={[{ value: "ARCHIVE", label: "Archive Selected" }]}
              onApply={handleBulkActionApply}
              applyDisabled={!bulkAction || selectedIds.length === 0}
            />
          )}
        />

        {/* BOTTOM PAGINATION MATCHING TAX / ORDERS */}
        {pagination.total > 0 && (
          <div className="flex items-center justify-end mt-4">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages || 0}
              total={pagination.total}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        )}
      </div>

      {/* SINGLE QUOTE DELETE / ARCHIVE MODAL */}
      <AdminDeleteModal
        open={Boolean(deletingQuote)}
        onClose={() => setDeletingQuote(null)}
        itemName={deletingQuote ? `Quote #${deletingQuote.quoteNumber}` : undefined}
        itemType="Quote Request"
        warningMessage="Choose the deletion method for this quote request. Soft Delete is recommended to maintain commercial history, customer records, and communication logs."
        softDeleteDescription={
          deletingQuote
            ? `Hides Quote #${deletingQuote.quoteNumber} from the active quotes list while safely retaining customer inquiry history in the Archive.`
            : undefined
        }
        permanentDeleteDescription={
          deletingQuote
            ? `Physically removes Quote #${deletingQuote.quoteNumber} from the database. Blocked for converted, sent, or accepted commercial quotes.`
            : undefined
        }
        permanentDeleteDisabled={
          Boolean(
            deletingQuote &&
              (["SENT", "ACCEPTED", "CONVERTED"].includes(deletingQuote.status) ||
                Boolean(deletingQuote.convertedOrderId))
          )
        }
        permanentDeleteDisabledReason={
          deletingQuote?.status === "CONVERTED" || deletingQuote?.convertedOrderId
            ? "Permanent deletion is not allowed for converted quotes because the quote is linked to a commercial order and must be retained."
            : ["SENT", "ACCEPTED"].includes(deletingQuote?.status || "")
            ? "Permanent deletion is not allowed for quotes in SENT or ACCEPTED status because they represent retained commercial negotiation history."
            : undefined
        }
        onSoftDelete={async () => {
          if (!deletingQuote) return;
          await deleteQuote.mutateAsync(deletingQuote.id);
          showToast(`Quote #${deletingQuote.quoteNumber} archived successfully.`, "success");
          setDeletingQuote(null);
          refetch();
        }}
        onPermanentDelete={async () => {
          if (!deletingQuote) return;
          if (
            ["SENT", "ACCEPTED", "CONVERTED"].includes(deletingQuote.status) ||
            Boolean(deletingQuote.convertedOrderId)
          ) {
            throw new Error("Cannot permanently delete a quote with retained commercial history.");
          }
          await permanentDeleteQuote.mutateAsync(deletingQuote.id);
          showToast(`Quote #${deletingQuote.quoteNumber} permanently deleted.`, "success");
          setDeletingQuote(null);
          refetch();
        }}
        isPermanentDeleting={permanentDeleteQuote.isPending}
      />

      {/* BULK ARCHIVE CONFIRMATION MODAL */}
      <ConfirmModal
        open={isBulkDeleting}
        onCancel={() => setIsBulkDeleting(false)}
        onConfirm={handleBulkArchive}
        title="Archive Selected Quotes"
        message={`Are you sure you want to archive ${selectedIds.length} selected quote request${selectedIds.length > 1 ? "s" : ""}? They will be moved to the Archive and can be restored at any time.`}
        confirmText={`Archive (${selectedIds.length})`}
        loadingText="Archiving..."
        isLoading={isBulkSubmitting}
        danger={false}
      />
    </AdminLayout>
  );
}
