"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { Star, CheckCircle2, Trash2, MessageSquare, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminStatsGrid,
  AdminListToolbar,
  ConfirmModal,
  LoadingButton,
  DataTable,
  StatusBadge,
  useToast,
} from "@/components/admin/AdminComponents";
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
  const canUpdate = hasPermission("reviews.update");
  const canDelete = hasPermission("reviews.delete");

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchReviews = async (searchQuery: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("search", searchQuery);
      if (statusFilter !== "ALL") params.set("status", statusFilter);

      const res = await adminApi.get(`/reviews?${params.toString()}`);
      if (res.data?.success) {
        setReviews(res.data.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch reviews", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    fetchReviews(debouncedSearch);
  }, [debouncedSearch, statusFilter]);

  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === "APPROVED").length;
    const pending = reviews.filter((r) => r.status === "PENDING").length;
    const avgScore =
      total > 0
        ? (
            reviews.reduce((acc, r) => acc + (r.ratingOverall || 5), 0) /
            total
          ).toFixed(1)
        : "0.0";
    return { total, approved, pending, avgScore };
  }, [reviews]);

  const handleUpdateStatus = async (id: string, newStatus: string) => {
    setUpdatingId(id);
    try {
      const res = await adminApi.patch(`/reviews/${id}/status`, { status: newStatus });
      if (res.data?.success) {
        setReviews((prev) =>
          prev.map((r) => (r.id === id ? { ...r, status: newStatus as any } : r))
        );
        showToast(`Review ${newStatus.toLowerCase()} successfully.`);
      }
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
      const res = await adminApi.delete(`/reviews/${deletingId}`);
      if (res.data?.success) {
        setReviews((prev) => prev.filter((r) => r.id !== deletingId));
        showToast("Review deleted successfully.");
      }
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
        width: "220px",
        render: (rev: ReviewItem) => (
          <div className="min-w-0 pr-3">
            <span className="font-semibold text-[#1A1A1A] block truncate text-[13px]" title={rev.productTitle}>
              {rev.productTitle}
            </span>
            <Link
              href={`/products/${rev.productSlug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-[11.5px] text-[#E31E24] hover:underline mt-0.5 font-medium"
            >
              View Page <ExternalLink size={11} />
            </Link>
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
            <span className="inline-flex items-center gap-1 mt-1 text-[10.5px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
              ✓ Verified Buyer
            </span>
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
            { title: "Total Reviews", value: reviewStats.total, subtitle: "Customer feedback entries", icon: <MessageSquare size={18} /> },
            { title: "Approved Reviews", value: reviewStats.approved, subtitle: "Published on product pages", icon: <CheckCircle2 size={18} />, color: "bg-green-600" },
            { title: "Pending Reviews", value: reviewStats.pending, subtitle: "Awaiting moderation", icon: <Star size={18} />, color: "bg-amber-600" },
            { title: "Average Score", value: `${reviewStats.avgScore} ★`, subtitle: "Overall average rating", icon: <Star size={18} />, color: "bg-gray-600" },
          ]}
          isLoading={loading}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search customer, email, text...",
            widthClassName: "w-[240px]",
          }}
          leftExtra={
            <div className="flex items-center gap-1.5 overflow-x-auto">
              {[
                { id: "ALL", label: "All Reviews", count: reviewStats.total },
                { id: "APPROVED", label: "Approved", count: reviewStats.approved },
                { id: "PENDING", label: "Pending", count: reviewStats.pending },
                { id: "REJECTED", label: "Rejected", count: reviews.filter((r) => r.status === "REJECTED").length },
              ].map((tab) => {
                const isSelected = statusFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setStatusFilter(tab.id)}
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
              Total Reviews: {reviews.length}
            </span>
          }
        />

        {/* Reviews List Table */}
        <DataTable
          title="Product Reviews"
          description="Moderate and manage customer feedback across catalog products."
          columns={columns}
          data={reviews}
          rowKey="id"
          isLoading={loading}
          emptyMessage="No customer reviews match your search or filter."
        />
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
