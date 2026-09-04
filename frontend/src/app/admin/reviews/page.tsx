"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Star, CheckCircle2, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { getAdminErrorMessage } from "@/services/adminApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminStatsGrid,
  AdminListToolbar,
  ConfirmModal,
  LoadingButton,
  DataTable,
  StatusBadge,
  Pagination,
  AdminSelect,
  AdminInput,
  useToast,
} from "@/components/admin/AdminComponents";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import {
  useAdminReviews,
  useUpdateReviewStatus,
  useDeleteReview,
  useAdminProducts,
  useAdminCategories,
} from "@/hooks/admin/useAdminHooks";
import { cn } from "@/utils/cn";

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

  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

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

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      await updateStatusMutation.mutateAsync({ id, status: newStatus });
      showToast(`Review ${newStatus.toLowerCase()} successfully.`);
    } catch (err) {
      console.error("Failed to update status", err);
      showToast(getAdminErrorMessage(err, "Failed to update status."), "error");
    } finally {
      setUpdatingId(null);
    }
  };

  const confirmDeleteReview = async () => {
    if (!deletingId) return;
    setDeletingLoading(true);
    try {
      await deleteReviewMutation.mutateAsync(deletingId);
      showToast("Review deleted successfully.");
    } catch (err) {
      console.error("Failed to delete review", err);
      showToast(getAdminErrorMessage(err, "Failed to delete review."), "error");
    } finally {
      setDeletingLoading(false);
      setDeletingId(null);
    }
  };

  const columns = useMemo(
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
              <span className="font-semibold text-[#1A1A1A] block truncate text-[13px]" title={rev.productTitle}>
                {rev.productTitle}
              </span>
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
              <p className="text-[12.5px] text-[#374151] line-clamp-3 leading-relaxed bg-[#F9FAFB] p-2.5 rounded-md border border-[#E6E6E6]">
                &quot;{rev.feedbackText}&quot;
              </p>
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
        width: "110px",
        render: (rev: ReviewItem) => (
          <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
            {new Date(rev.createdAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
            })}
          </span>
        ),
      },
      ...((canUpdate || canDelete)
        ? [
            {
              key: "actions",
              label: "Actions",
              width: "160px",
              render: (rev: ReviewItem) => (
                <div className="flex items-center justify-end gap-1.5">
                  {canUpdate && rev.status !== "APPROVED" && (
                    <LoadingButton
                      loading={updatingId === rev.id}
                      loadingText="Approving..."
                      onClick={() => handleUpdateStatus(rev.id, "APPROVED")}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#CFE8D7] bg-white px-2.5 text-[12px] font-medium text-[#1F8F4A] hover:bg-[#F1FBF4] transition-colors shadow-2xs cursor-pointer"
                      title="Approve Review"
                    >
                      <CheckCircle2 size={13} />
                      Approve
                    </LoadingButton>
                  )}
                  {canUpdate && rev.status !== "REJECTED" && (
                    <LoadingButton
                      loading={updatingId === rev.id}
                      loadingText="Rejecting..."
                      onClick={() => handleUpdateStatus(rev.id, "REJECTED")}
                      className="inline-flex h-7 items-center gap-1 rounded-md border border-[#F2C9C9] bg-white px-2.5 text-[12px] font-medium text-[#E31E24] hover:bg-[#FFF5F5] transition-colors shadow-2xs cursor-pointer"
                      title="Reject Review"
                    >
                      Reject
                    </LoadingButton>
                  )}
                  {canDelete && (
                    <button
                      disabled={updatingId === rev.id}
                      onClick={() => setDeletingId(rev.id)}
                      className="flex h-7 w-7 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#E31E24] hover:bg-[#FFF5F5] hover:border-[#F2C9C9] transition-colors disabled:opacity-40 cursor-pointer shadow-2xs"
                      title="Delete Review"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ),
            },
          ]
        : []),
    ],
    [canUpdate, canDelete, updatingId]
  );

  return (
    <AdminLayout title="Product Reviews & Feedback" breadcrumb={[{ label: "Reviews" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Reviews", value: stats.total, subtitle: "Customer feedback entries", icon: <MessageSquare size={18} /> },
            { title: "Approved Reviews", value: stats.approved, subtitle: "Published on product pages", icon: <CheckCircle2 size={18} />, color: "bg-green-600" },
            { title: "Pending Reviews", value: stats.pending, subtitle: "Awaiting moderation", icon: <Star size={18} />, color: "bg-amber-600" },
            { title: "Average Score", value: `${stats.avgScore} ★`, subtitle: "Overall average rating", icon: <Star size={18} />, color: "bg-gray-600" },
          ]}
          isLoading={isLoading}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search customer, email, text, product...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: activeFilterCount,
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Reviews refreshed."));
            },
            isRefreshing: isFetching,
          }}
          leftExtra={
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "ALL", label: "All Reviews", count: stats.total },
                { id: "PENDING", label: "Pending", count: stats.pending },
                { id: "APPROVED", label: "Approved", count: stats.approved },
                { id: "REJECTED", label: "Rejected", count: stats.rejected },
              ].map((tab) => {
                const isSelected = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setStatusFilter(tab.id);
                      setPage(1);
                    }}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold transition-all cursor-pointer",
                      isSelected
                        ? "border border-[#E31E24] bg-[#FFF8F8] text-[#E31E24]"
                        : "border border-[#E6E6E6] bg-white text-[#555555] hover:border-[#D1D1D1] hover:bg-[#FAFAFA]"
                    )}
                  >
                    <span>{tab.label}</span>
                    <span
                      className={cn(
                        "rounded-full px-1.5 py-0.2 text-[10.5px] font-bold",
                        isSelected ? "bg-[#E31E24] text-white" : "bg-[#F0F0F0] text-[#666666]"
                      )}
                    >
                      {tab.count}
                    </span>
                  </button>
                );
              })}
            </div>
          }
          rightExtra={
            <span className="text-[12.5px] font-semibold text-[#6B6B6B]">
              Total: {pagination.total} {pagination.total === 1 ? "review" : "reviews"}
            </span>
          }
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

              <AdminSelect
                label="Page Size"
                value={String(limit)}
                onChange={(e) => {
                  setLimit(Number(e.target.value));
                  setPage(1);
                }}
                options={[
                  { value: "10", label: "10 per page" },
                  { value: "20", label: "20 per page" },
                  { value: "50", label: "50 per page" },
                  { value: "100", label: "100 per page" },
                ]}
              />
            </div>
          }
        />

        {/* Reviews List Table */}
        <DataTable
          title="Product Reviews"
          description="Moderate and manage customer feedback across catalog products."
          columns={columns}
          data={reviews}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage="No customer reviews match your search or filter criteria."
        />

        {pagination.totalPages > 1 && (
          <div className="mt-4 flex justify-end">
            <Pagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={(newPage) => setPage(newPage)}
            />
          </div>
        )}
      </div>

      <ConfirmModal
        open={!!deletingId}
        title="Delete review?"
        message="Are you sure you want to delete this review permanently? This action cannot be undone."
        onConfirm={confirmDeleteReview}
        onCancel={() => setDeletingId(null)}
        isLoading={deletingLoading}
        danger
      />

      {ToastComponent}
    </AdminLayout>
  );
}

