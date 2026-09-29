"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, CheckCircle2, Trash2, MessageSquare, ExternalLink, Clock, XCircle, Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { formatDate } from "@/utils/formatDate";
import { cn } from "@/utils/cn";
import { Modal } from "@/components/ui/Modal";
import {
  AdminStatsGrid,
  AdminListToolbar,
  ConfirmModal,
  AdminDeleteModal,
  LoadingButton,
  DataTable,
  StatusBadge,
  Pagination,
  AdminSelect,
  AdminInput,
  AdminBulkActionsBar,
  useToast,
  type Column,
  Tooltip,
} from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import {
  useAdminReviews,
  useUpdateReviewStatus,
  useDeleteReview,
  usePermanentDeleteReview,
  useAdminProducts,
  useAdminCategories,
} from "@/hooks/admin/useAdminHooks";

interface ReviewItem {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  productImage: string | null;
  customerName: string;
  customerEmail: string | null;
  ratingQuality: number;
  ratingPrice: number;
  ratingOverall: number;
  feedbackText: string | null;
  status: "APPROVED" | "PENDING" | "REJECTED";
  createdAt: string;
}

const COLUMN_OPTIONS: { key: string; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "customer", label: "Customer" },
  { key: "rating", label: "Rating" },
  { key: "feedback", label: "Feedback Comment" },
  { key: "status", label: "Status" },
  { key: "date", label: "Date" },
];

type ColumnKey = "product" | "customer" | "rating" | "feedback" | "status" | "date";

const visibleColumnsDefault: Record<ColumnKey, boolean> = {
  product: true,
  customer: true,
  rating: true,
  feedback: true,
  status: true,
  date: true,
};

export default function AdminReviewsPage() {
  const { showToast, ToastComponent } = useToast();
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("reviews.update") || hasPermission("products.update");
  const canDelete = hasPermission("reviews.delete") || hasPermission("products.delete");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [ratingFilter, setRatingFilter] = useState<string>("");
  const [productFilter, setProductFilter] = useState<string>("");
  const [categoryFilter, setCategoryFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [sortBy, setSortBy] = useState<string>("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [viewingReview, setViewingReview] = useState<ReviewItem | null>(null);

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingReview, setDeletingReview] = useState<ReviewItem | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Clear selections on filter changes
  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, statusFilter, ratingFilter, productFilter, categoryFilter, dateFrom, dateTo, sortBy, sortDir]);

  // Data queries
  const { data, isLoading, isFetching, refetch } = useAdminReviews({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter !== "ALL" ? statusFilter : undefined,
    ratingOverall: ratingFilter ? Number(ratingFilter) : undefined,
    productId: productFilter || undefined,
    categoryId: categoryFilter || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    sortBy,
    sortDir,
  });

  const { data: productsData } = useAdminProducts({ limit: 1000, sortBy: "title", sortDir: "asc" });
  const { data: categoriesData } = useAdminCategories();

  // Mutations
  const updateStatusMutation = useUpdateReviewStatus();
  const deleteReviewMutation = useDeleteReview();
  const permanentDeleteReviewMutation = usePermanentDeleteReview();

  const reviews = useMemo(() => (data?.data ?? []) as ReviewItem[], [data?.data]);
  const pagination = data?.pagination ?? { page: 1, limit: 20, total: 0, totalPages: 1 };
  const stats = data?.stats ?? {
    total: 0,
    approved: 0,
    pending: 0,
    rejected: 0,
    avgScore: 0,
  };

  const productOptions = useMemo(() => {
    const list = ((productsData as any)?.data ?? []) as any[];
    return list.map((p) => ({
      value: p.id,
      label: `${p.title}${p.productCode ? ` (${p.productCode})` : ""}`,
    }));
  }, [productsData]);

  const categoryOptions = useMemo(() => {
    const list = (categoriesData ?? []) as any[];
    return list.map((c) => ({
      value: c.id,
      label: c.name,
    }));
  }, [categoriesData]);

  const activeFilterCount = useMemo(() => {
    return [
      statusFilter !== "ALL" ? statusFilter : "",
      ratingFilter,
      productFilter,
      categoryFilter,
      dateFrom,
      dateTo,
      sortBy !== "createdAt" || sortDir !== "desc" ? "custom-sort" : "",
    ].filter(Boolean).length;
  }, [statusFilter, ratingFilter, productFilter, categoryFilter, dateFrom, dateTo, sortBy, sortDir]);

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatusFilter("ALL");
    setRatingFilter("");
    setProductFilter("");
    setCategoryFilter("");
    setDateFrom("");
    setDateTo("");
    setSortBy("createdAt");
    setSortDir("desc");
    setPage(1);
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/reviews", {
        params: {
          search: debouncedSearch || undefined,
          status: statusFilter || undefined,
          rating: ratingFilter || undefined,
          productId: productFilter || undefined,
          categoryId: categoryFilter || undefined,
          dateFrom: dateFrom || undefined,
          dateTo: dateTo || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data?.data ?? []).map((r: any) => r.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} reviews across all pages.`, "success");
    } catch {
      setSelectedIds(reviews.map((r) => r.id));
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus });
      showToast(`Review ${newStatus.toLowerCase()} successfully.`, "success");
      if (viewingReview?.id === id) {
        setViewingReview((prev) => (prev ? { ...prev, status: newStatus as any } : null));
      }
      await refetch();
    } catch (err) {
      console.error("Failed to update status", err);
      showToast(getAdminErrorMessage(err, "Failed to update status."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;

    if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }

    setBulkSaving(true);
    try {
      if (bulkAction === "approve") {
        await Promise.all(
          selectedIds.map((id) => updateStatusMutation.mutateAsync({ id, status: "APPROVED" }))
        );
        showToast(`Successfully approved ${selectedIds.length} review(s).`, "success");
      } else if (bulkAction === "reject") {
        await Promise.all(
          selectedIds.map((id) => updateStatusMutation.mutateAsync({ id, status: "REJECTED" }))
        );
        showToast(`Successfully rejected ${selectedIds.length} review(s).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteReviewMutation.mutateAsync(id)));
      showToast(`Successfully archived ${selectedIds.length} review(s).`, "success");
      setSelectedIds([]);
      setBulkAction("");
      setShowBulkDeleteModal(false);
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to archive selected reviews."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const columns: Column<ReviewItem>[] = useMemo(
    () => [
      {
        key: "product",
        label: "Product",
        width: "240px",
        render: (rev: ReviewItem) => (
          <div className="flex items-center gap-2.5 min-w-0 pr-3">
            {rev.productImage ? (
              <img
                src={rev.productImage}
                alt={rev.productTitle}
                className="h-9 w-9 flex-none rounded object-cover border border-[#E6E6E6]"
              />
            ) : null}
            <div className="min-w-0">
              <Tooltip content={rev.productTitle} side="top">
                <span className="font-semibold text-[#1A1A1A] block truncate text-[13px] cursor-default">
                  {rev.productTitle}
                </span>
              </Tooltip>
              {rev.productSlug && (
                <Link
                  href={`/products/${rev.productSlug}`}
                  target="_blank"
                  className="inline-flex items-center gap-1 text-[11.5px] text-[#E31E24] hover:underline mt-0.5 font-medium"
                >
                  View Page <ExternalLink size={11} />
                </Link>
              )}
            </div>
          </div>
        ),
      },
      {
        key: "customer",
        label: "Customer",
        width: "200px",
        render: (rev: ReviewItem) => (
          <div>
            <span className="font-semibold text-[#1A1A1A] block text-[13px]">{rev.customerName}</span>
            {rev.customerEmail && (
              <span className="text-[11.5px] text-[#6B6B6B] block truncate">{rev.customerEmail}</span>
            )}
          </div>
        ),
      },
      {
        key: "rating",
        label: "Rating",
        width: "140px",
        render: (rev: ReviewItem) => (
          <div>
            <div className="flex items-center gap-1 text-[#F59E0B] font-bold text-[13px]">
              <span>{rev.ratingOverall}.0</span>
              <Star size={13} className="fill-[#F59E0B]" />
            </div>
            <div className="text-[11px] text-[#6B6B6B] mt-0.5 font-medium">
              Q: {rev.ratingQuality}/5 ★ | P: {rev.ratingPrice}/5 ★
            </div>
          </div>
        ),
      },
      {
        key: "feedback",
        label: "Feedback Comment",
        render: (rev: ReviewItem) => (
          <div className="max-w-[320px]">
            {rev.feedbackText ? (
              <Tooltip content="Click to view full feedback" side="top">
                <p
                  onClick={() => setViewingReview(rev)}
                  className="text-[12.5px] text-[#374151] line-clamp-3 leading-relaxed bg-[#F9FAFB] p-2.5 rounded-md border border-[#E6E6E6] hover:border-[#D0D0D0] transition-colors cursor-pointer"
                >
                  &quot;{rev.feedbackText}&quot;
                </p>
              </Tooltip>
            ) : (
              <span className="text-[12px] italic text-[#9A9A9A]">No comment provided</span>
            )}
          </div>
        ),
      },
      {
        key: "status",
        label: "Status",
        width: "110px",
        render: (rev: ReviewItem) => (
          <StatusBadge status={rev.status} />
        ),
      },
      {
        key: "date",
        label: "Date",
        width: "120px",
        render: (rev: ReviewItem) => (
          <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
            {formatDate(rev.createdAt)}
          </span>
        ),
      },
      ...((canUpdate || canDelete)
        ? [
            {
              key: "actions",
              label: "Actions",
              width: "180px",
              render: (rev: ReviewItem) => (
                <div className="flex items-center justify-end gap-1.5 whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                  <Tooltip content="View review details" side="top">
                    <button
                      type="button"
                      onClick={() => setViewingReview(rev)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#555] hover:bg-[#F8F8F8] hover:text-[#1A1A1A] transition-colors cursor-pointer shadow-2xs"
                    >
                      <Eye size={13} />
                    </button>
                  </Tooltip>
                  {canUpdate && rev.status !== "APPROVED" && (
                    <Tooltip content="Approve review" side="top" disabled={updatingId === rev.id}>
                      <LoadingButton
                        loading={updatingId === rev.id}
                        loadingText="Approving..."
                        onClick={() => handleUpdateStatus(rev.id, "APPROVED")}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-[#CFE8D7] bg-white px-2 text-[12px] font-medium text-[#1F8F4A] hover:bg-[#F1FBF4] transition-colors shadow-2xs cursor-pointer"
                      >
                        <CheckCircle2 size={12} />
                        Approve
                      </LoadingButton>
                    </Tooltip>
                  )}
                  {canUpdate && rev.status !== "REJECTED" && (
                    <Tooltip content="Reject review" side="top" disabled={updatingId === rev.id}>
                      <LoadingButton
                        loading={updatingId === rev.id}
                        loadingText="Rejecting..."
                        onClick={() => handleUpdateStatus(rev.id, "REJECTED")}
                        className="inline-flex h-7 items-center gap-1 rounded-md border border-[#F2C9C9] bg-white px-2 text-[12px] font-medium text-[#E31E24] hover:bg-[#FFF5F5] transition-colors shadow-2xs cursor-pointer"
                      >
                        Reject
                      </LoadingButton>
                    </Tooltip>
                  )}
                  {canDelete && (
                    <Tooltip content="Archive / Delete review" side="top" disabled={updatingId === rev.id}>
                      <button
                        disabled={updatingId === rev.id}
                        onClick={() => setDeletingReview(rev)}
                        className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                      >
                        <Trash2 size={13} />
                      </button>
                    </Tooltip>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canUpdate, canDelete, updatingId]
  );

  const filteredColumns = useMemo(() => {
    return columns.filter((col) => {
      if (col.key === "actions") return true;
      const k = col.key as ColumnKey;
      if (k in visibleColumns) return visibleColumns[k];
      return true;
    });
  }, [columns, visibleColumns]);

  return (
    <AdminLayout
      title="Product Reviews & Feedback"
      breadcrumb={[
        { label: "Catalog" },
        { label: "Product Reviews" },
      ]}
    >
      <div className="space-y-5">
        {/* 1. TOP KPI STATS GRID */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Reviews",
              value: stats.total,
              subtitle: "Customer feedback entries",
              icon: <MessageSquare size={18} />,
              isLoading,
            },
            {
              title: "Approved Reviews",
              value: stats.approved,
              subtitle: "Published on product pages",
              icon: <CheckCircle2 size={18} />,
              color: "bg-green-600",
              isLoading,
            },
            {
              title: "Pending Reviews",
              value: stats.pending,
              subtitle: "Awaiting moderation",
              icon: <Clock size={18} />,
              color: "bg-amber-600",
              isLoading,
            },
            {
              title: "Average Score",
              value: `${Number(stats.avgScore || 0).toFixed(1)} ★`,
              subtitle: "Overall average rating",
              icon: <Star size={18} />,
              color: "bg-[#0F6CBD]",
              isLoading,
            },
          ]}
        />

        {/* Horizontal Navigation Status Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs">
          {[
            { id: "ALL", label: "All Reviews", count: stats.total, icon: <MessageSquare size={15} /> },
            { id: "PENDING", label: "Pending", count: stats.pending, icon: <Clock size={15} /> },
            { id: "APPROVED", label: "Approved", count: stats.approved, icon: <CheckCircle2 size={15} /> },
            { id: "REJECTED", label: "Rejected", count: stats.rejected, icon: <XCircle size={15} /> },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer",
                  isActive
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A] hover:border-[#D0D0D0]"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "bg-[#F2F2F2] text-[#6B6B6B]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: (val: string) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: statusFilter === "PENDING" ? "Search pending reviews..." : "Search customer, email, text, product...",
            widthClassName: "w-[260px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: activeFilterCount,
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key: string) =>
              setVisibleColumns((current) => ({
                ...current,
                [key as ColumnKey]: current[key as ColumnKey] === false ? true : false,
              })),
            options: COLUMN_OPTIONS,
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Reviews refreshed."));
            },
            isRefreshing: isFetching || isLoading,
          }}
          onResetFilters={handleResetFilters}
          filterPanel={
            <div className="grid gap-3.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              <AdminSearchableSelect
                label="Product"
                value={productFilter}
                onChange={(e) => {
                  setProductFilter(e.target.value);
                  setPage(1);
                }}
                options={[{ value: "", label: "All Products" }, ...productOptions]}
                placeholder="All Products"
                searchPlaceholder="Search product..."
              />

              <AdminSelect
                label="Product Category"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Categories" },
                  ...categoryOptions,
                ]}
              />

              <AdminSelect
                label="Overall Rating"
                value={ratingFilter}
                onChange={(e) => {
                  setRatingFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Ratings" },
                  { value: "5", label: "5 Stars (★★★★★)" },
                  { value: "4", label: "4 Stars (★★★★☆)" },
                  { value: "3", label: "3 Stars (★★★☆☆)" },
                  { value: "2", label: "2 Stars (★★☆☆☆)" },
                  { value: "1", label: "1 Star (★☆☆☆☆)" },
                ]}
              />

              <AdminSelect
                label="Sort Order"
                value={`${sortBy}-${sortDir}`}
                onChange={(e) => {
                  const [newSortBy, newSortDir] = e.target.value.split("-");
                  setSortBy(newSortBy);
                  setSortDir(newSortDir as "asc" | "desc");
                  setPage(1);
                }}
                options={[
                  { value: "createdAt-desc", label: "Newest First" },
                  { value: "createdAt-asc", label: "Oldest First" },
                  { value: "ratingOverall-desc", label: "Highest Rating" },
                  { value: "ratingOverall-asc", label: "Lowest Rating" },
                ]}
              />

              <AdminInput
                label="Date From"
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value);
                  setPage(1);
                }}
              />

              <AdminInput
                label="Date To"
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          }
        />

        {/* 3. FULL-WIDTH DATA TABLE WITH BULK ACTIONS */}
        <div>
          <DataTable<ReviewItem>
            title="Product Reviews List"
            description="Moderate and manage customer feedback across catalog products."
            columns={filteredColumns}
            data={reviews}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage={
              statusFilter !== "ALL"
                ? `No ${statusFilter.toLowerCase()} reviews found.`
                : debouncedSearch
                ? "No reviews match your search."
                : "No customer reviews found."
            }
            enableSelection={canUpdate || canDelete}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            totalItems={pagination.total ?? 0}
            currentPage={page}
            pageSize={limit}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            onSelectAll={handleSelectAll}
            renderBulkActions={(selectedIds) => (
              <AdminBulkActionsBar
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actionType={bulkAction}
                onActionTypeChange={setBulkAction}
                actions={[
                  ...(canUpdate
                    ? [
                        { value: "approve", label: "Approve selected" },
                        { value: "reject", label: "Reject selected" },
                      ]
                    : []),
                  ...(canDelete
                    ? [
                        { value: "delete", label: "Archive selected" },
                      ]
                    : []),
                ]}
                onApply={handleBulkAction}
                applyLoading={bulkSaving}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={pagination.totalPages || 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>

      {/* READ-ONLY REVIEW DETAILS MODAL */}
      <Modal
        open={Boolean(viewingReview)}
        onClose={() => setViewingReview(null)}
        title="Review Details"
        subtitle="Customer feedback information and rating breakdown."
        size="2xl"
        footer={
          <div className="flex items-center justify-between gap-3 w-full">
            <div className="flex items-center gap-2">
              {canUpdate && viewingReview && viewingReview.status !== "APPROVED" && (
                <LoadingButton
                  loading={updatingId === viewingReview.id}
                  loadingText="Approving..."
                  onClick={() => handleUpdateStatus(viewingReview.id, "APPROVED")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#CFE8D7] bg-[#F1FBF4] px-3 text-[12.5px] font-semibold text-[#1F8F4A] hover:bg-[#E2F7E8] transition-colors cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  Approve Review
                </LoadingButton>
              )}
              {canUpdate && viewingReview && viewingReview.status !== "REJECTED" && (
                <LoadingButton
                  loading={updatingId === viewingReview.id}
                  loadingText="Rejecting..."
                  onClick={() => handleUpdateStatus(viewingReview.id, "REJECTED")}
                  className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#F2C9C9] bg-[#FFF5F5] px-3 text-[12.5px] font-semibold text-[#E31E24] hover:bg-[#FFEBEB] transition-colors cursor-pointer"
                >
                  Reject Review
                </LoadingButton>
              )}
            </div>
            <button
              type="button"
              onClick={() => setViewingReview(null)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        {viewingReview && (
          <div className="p-6 space-y-5">
            {/* Top Product Summary */}
            <div className="flex items-start gap-3.5 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              {viewingReview.productImage ? (
                <img
                  src={viewingReview.productImage}
                  alt={viewingReview.productTitle}
                  className="h-14 w-14 flex-none rounded-lg object-cover border border-[#E6E6E6] bg-white"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Product</span>
                  <StatusBadge status={viewingReview.status} />
                </div>
                <Tooltip content={viewingReview.productTitle} side="top">
                  <h4 className="mt-0.5 text-[14px] font-semibold text-[#1A1A1A] truncate cursor-default">
                    {viewingReview.productTitle}
                  </h4>
                </Tooltip>
                {viewingReview.productSlug && (
                  <Link
                    href={`/products/${viewingReview.productSlug}`}
                    target="_blank"
                    className="inline-flex items-center gap-1 text-[12px] text-[#E31E24] hover:underline mt-1 font-medium"
                  >
                    View Product Page <ExternalLink size={12} />
                  </Link>
                )}
              </div>
            </div>

            {/* Customer & Ratings Grid */}
            <div className="grid grid-cols-2 gap-3.5 sm:grid-cols-4">
              <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Customer</span>
                <p className="mt-1 text-[13px] font-semibold text-[#1A1A1A] truncate">{viewingReview.customerName}</p>
                {viewingReview.customerEmail && (
                  <p className="text-[11.5px] text-[#6B6B6B] truncate">{viewingReview.customerEmail}</p>
                )}
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Overall Score</span>
                <div className="mt-1 flex items-center gap-1 text-[16px] font-bold text-[#F59E0B]">
                  <span>{viewingReview.ratingOverall}.0</span>
                  <Star size={15} className="fill-[#F59E0B]" />
                </div>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Quality Score</span>
                <div className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-[#1A1A1A]">
                  <span>{viewingReview.ratingQuality} / 5</span>
                  <Star size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
                </div>
              </div>
              <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Price Score</span>
                <div className="mt-1 flex items-center gap-1 text-[14px] font-semibold text-[#1A1A1A]">
                  <span>{viewingReview.ratingPrice} / 5</span>
                  <Star size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
                </div>
              </div>
            </div>

            {/* Full Feedback Text */}
            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A]">Customer Feedback</span>
              <p className="text-[13px] leading-relaxed text-[#1A1A1A] whitespace-pre-wrap bg-white p-3.5 rounded-lg border border-[#E6E6E6]">
                {viewingReview.feedbackText || <span className="italic text-[#9A9A9A]">No feedback comment provided.</span>}
              </p>
            </div>

            {/* Timestamps */}
            <div className="flex items-center justify-between border-t border-[#F0F0F0] pt-3 text-[12px] text-[#9A9A9A]">
              <span>Review ID: <span className="font-mono text-[#1A1A1A]">{viewingReview.id}</span></span>
              <span>Submitted: {formatDate(viewingReview.createdAt)}</span>
            </div>
          </div>
        )}
      </Modal>

      {/* SINGLE REVIEW DELETE / ARCHIVE MODAL */}
      <AdminDeleteModal
        open={Boolean(deletingReview)}
        onClose={() => setDeletingReview(null)}
        itemName={
          deletingReview
            ? (deletingReview.customerName ? `Review from ${deletingReview.customerName}` : `Review #${deletingReview.id}`)
            : undefined
        }
        itemType="Product Review"
        warningMessage="Choose the deletion method for this customer review. Soft Delete (Archive) is recommended to remove it from public storefront display while retaining audit history."
        softDeleteDescription={
          deletingReview
            ? `Hides review for "${deletingReview.productTitle}" from the active reviews list and storefront display while preserving it safely in the Central Archive.`
            : undefined
        }
        permanentDeleteDescription={
          deletingReview
            ? `Physically removes review for "${deletingReview.productTitle}" from the database. Blocked for APPROVED customer reviews to preserve review integrity.`
            : undefined
        }
        permanentDeleteDisabled={deletingReview?.status === "APPROVED"}
        permanentDeleteDisabledReason={
          deletingReview?.status === "APPROVED"
            ? "Permanent deletion is blocked for APPROVED reviews. Approved customer reviews must be retained for integrity and audit compliance."
            : undefined
        }
        onSoftDelete={async () => {
          if (!deletingReview) return;
          await deleteReviewMutation.mutateAsync(deletingReview.id);
          showToast("Review archived successfully.", "success");
          if (viewingReview?.id === deletingReview.id) {
            setViewingReview(null);
          }
          setDeletingReview(null);
          await refetch();
        }}
        onPermanentDelete={async () => {
          if (!deletingReview) return;
          if (deletingReview.status === "APPROVED") {
            throw new Error("Cannot permanently delete an approved review.");
          }
          await permanentDeleteReviewMutation.mutateAsync(deletingReview.id);
          showToast("Review permanently deleted.", "success");
          if (viewingReview?.id === deletingReview.id) {
            setViewingReview(null);
          }
          setDeletingReview(null);
          await refetch();
        }}
        isPermanentDeleting={permanentDeleteReviewMutation.isPending}
      />

      {/* BULK ARCHIVE CONFIRM MODAL */}
      <ConfirmModal
        open={showBulkDeleteModal}
        title={`Archive ${selectedIds.length} reviews?`}
        message={`Are you sure you want to archive the selected ${selectedIds.length} review(s)? They will be moved to the Central Archive and hidden from storefront product pages.`}
        confirmText="Archive Reviews"
        onConfirm={confirmBulkDelete}
        onCancel={() => setShowBulkDeleteModal(false)}
        isLoading={bulkSaving}
        danger
      />

      {ToastComponent}
    </AdminLayout>
  );
}

