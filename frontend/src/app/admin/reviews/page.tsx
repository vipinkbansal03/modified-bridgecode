"use client";

import { useEffect, useMemo, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { adminApi } from "@/services/adminApi";
import { Star, CheckCircle2, XCircle, Trash2, Search, Filter, MessageSquare, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { StatCard, AdminStatsGrid, AdminListToolbar, ConfirmModal, LoadingButton } from "@/components/admin/AdminComponents";

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
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("reviews.update");
  const canDelete = hasPermission("reviews.delete");

  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingLoading, setDeletingLoading] = useState(false);

  const fetchReviews = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
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
    fetchReviews();
  }, [statusFilter, search]);

  const reviewStats = useMemo(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === "APPROVED").length;
    const pending = reviews.filter((r) => r.status === "PENDING").length;
    const avgScore = total > 0 ? (reviews.reduce((sum, r) => sum + r.ratingOverall, 0) / total).toFixed(1) : "0.0";
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
      }
    } catch (err) {
      console.error("Failed to update status", err);
      alert("Failed to update status.");
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
      }
    } catch (err) {
      console.error("Failed to delete review", err);
      alert("Failed to delete review.");
    } finally {
      setDeletingLoading(false);
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout title="Product Reviews & Feedback" breadcrumb={[{ label: "Reviews" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Reviews", value: reviewStats.total, subtitle: "Customer feedback entries", icon: <MessageSquare size={18} /> },
            { title: "Approved Reviews", value: reviewStats.approved, subtitle: "Published on product pages", icon: <CheckCircle2 size={18} />, color: "bg-green-600" },
            { title: "Pending Reviews", value: reviewStats.pending, subtitle: "Awaiting moderation", icon: <Star size={18} />, color: "bg-amber-600" },
            { title: "Average Score", value: `${reviewStats.avgScore} ★`, subtitle: "Overall average rating", icon: <Star size={18} />, color: "bg-indigo-600" }
          ]}
          isLoading={loading}
        />
        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search customer, email, text...",
            widthClassName: "max-w-[280px]",
          }}
          leftExtra={
            <div className="flex items-center gap-1 overflow-x-auto">
              {["ALL", "APPROVED", "PENDING", "REJECTED"].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setStatusFilter(tab)}
                  className={`px-3.5 py-1.5 rounded-lg text-[13px] font-semibold transition-colors ${
                    statusFilter === tab
                      ? "bg-[#E31E24] text-white shadow-2xs"
                      : "bg-[#F9FAFB] text-[#4B5563] hover:bg-[#F3F4F6]"
                  }`}
                >
                  {tab === "ALL" ? "All Reviews" : tab}
                </button>
              ))}
            </div>
          }
          rightExtra={
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F3F4F6] text-[#374151]">
              Total Reviews: {reviews.length}
            </span>
          }
        />

        {/* Reviews List Table */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xs overflow-hidden">
          {loading ? (
            <div className="p-8 text-center text-sm text-[#6B7280]">Loading customer reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="p-12 text-center">
              <MessageSquare size={36} className="mx-auto mb-2 text-[#9CA3AF]" />
              <h3 className="text-base font-bold text-[#111827]">No Reviews Found</h3>
              <p className="text-xs text-[#6B7280] mt-1">No customer reviews match your selected filters.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB] text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
                    <th className="py-3 px-4">Product</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Rating</th>
                    <th className="py-3 px-4">Feedback Comment</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Date</th>
                    {(canUpdate || canDelete) && <th className="py-3 px-4 text-right">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] text-[13px] text-[#374151]">
                  {reviews.map((rev) => (
                    <tr key={rev.id} className="hover:bg-[#F9FAFB] transition-colors">
                      {/* Product */}
                      <td className="py-3.5 px-4 max-w-[220px]">
                        <span className="font-semibold text-[#111827] block truncate" title={rev.productTitle}>
                          {rev.productTitle}
                        </span>
                        <Link
                          href={`/products/${rev.productSlug}`}
                          target="_blank"
                          className="inline-flex items-center gap-1 text-[11px] text-[#E31E24] hover:underline mt-0.5"
                        >
                          View Page <ExternalLink size={10} />
                        </Link>
                      </td>

                      {/* Customer */}
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-[#111827] block">{rev.customerName}</span>
                        {rev.customerEmail && (
                          <span className="text-[11.5px] text-[#6B7280] block">{rev.customerEmail}</span>
                        )}
                        <span className="inline-block mt-1 text-[10px] font-semibold text-[#16A34A] bg-[#DCFCE7] px-1.5 py-0.5 rounded">
                          ✓ Verified Buyer
                        </span>
                      </td>

                      {/* Rating */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <div className="flex items-center gap-1 text-[#F59E0B] font-bold">
                          <span>{rev.ratingOverall}.0</span>
                          <Star size={14} className="fill-[#F59E0B]" />
                        </div>
                        <div className="text-[11px] text-[#6B7280] mt-0.5">
                          Q: {rev.ratingQuality}/5 ★ | P: {rev.ratingPrice}/5 ★
                        </div>
                      </td>

                      {/* Feedback Text */}
                      <td className="py-3.5 px-4 max-w-[280px]">
                        {rev.feedbackText ? (
                          <p className="text-[12.5px] text-[#374151] line-clamp-3 leading-relaxed bg-[#F9FAFB] p-2 rounded border border-[#E5E7EB]">
                            &quot;{rev.feedbackText}&quot;
                          </p>
                        ) : (
                          <span className="text-[11.5px] italic text-[#9CA3AF]">No text provided</span>
                        )}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
                            rev.status === "APPROVED"
                              ? "bg-[#DCFCE7] text-[#15803D]"
                              : rev.status === "REJECTED"
                              ? "bg-[#FEE2E2] text-[#B91C1C]"
                              : "bg-[#FEF3C7] text-[#B45309]"
                          }`}
                        >
                          {rev.status}
                        </span>
                      </td>

                      {/* Date */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-[12px] text-[#6B7280]">
                        {new Date(rev.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </td>

                      {(canUpdate || canDelete) && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {canUpdate && rev.status !== "APPROVED" && (
                              <LoadingButton
                                loading={updatingId === rev.id}
                                loadingText="Approving..."
                                onClick={() => handleUpdateStatus(rev.id, "APPROVED")}
                                className="px-2.5 py-1 bg-[#16A34A] text-white text-[11px] font-semibold rounded hover:bg-[#15803D] transition-colors"
                                title="Approve Review"
                              >
                                Approve
                              </LoadingButton>
                            )}
                            {canUpdate && rev.status !== "REJECTED" && (
                              <LoadingButton
                                loading={updatingId === rev.id}
                                loadingText="Rejecting..."
                                onClick={() => handleUpdateStatus(rev.id, "REJECTED")}
                                className="px-2.5 py-1 bg-[#EA580C] text-white text-[11px] font-semibold rounded hover:bg-[#C2410C] transition-colors"
                                title="Reject Review"
                              >
                                Reject
                              </LoadingButton>
                            )}
                            {canDelete && (
                              <button
                                disabled={updatingId === rev.id}
                                onClick={() => setDeletingId(rev.id)}
                                className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors disabled:opacity-50"
                                title="Delete Review"
                              >
                                <Trash2 size={15} />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <ConfirmModal
        open={!!deletingId}
        title="Delete review?"
        message="Are you sure you want to delete this review permanently?"
        onConfirm={confirmDeleteReview}
        onCancel={() => setDeletingId(null)}
        isLoading={deletingLoading}
        danger
      />
    </AdminLayout>
  );
}
