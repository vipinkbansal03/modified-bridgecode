"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { adminApi } from "@/services/adminApi";
import { Star, CheckCircle2, XCircle, Trash2, Search, Filter, MessageSquare, ExternalLink } from "lucide-react";
import Link from "next/link";
import { useAdminAuth } from "@/contexts/AdminAuthContext";

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
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchReviews();
  };

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

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this review permanently?")) return;
    setUpdatingId(id);
    try {
      const res = await adminApi.delete(`/reviews/${id}`);
      if (res.data?.success) {
        setReviews((prev) => prev.filter((r) => r.id !== id));
      }
    } catch (err) {
      console.error("Failed to delete review", err);
      alert("Failed to delete review.");
    } finally {
      setUpdatingId(null);
    }
  };

  return (
    <AdminLayout title="Product Reviews & Feedback" breadcrumb={[{ label: "Reviews" }]}>
      <div className="space-y-6 p-4 md:p-6">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-5 rounded-xl border border-[#E5E7EB] shadow-2xs">
          <div>
            <h1 className="text-xl font-bold text-[#111827]">Product Reviews & Feedback Manager</h1>
            <p className="text-sm text-[#6B7280] mt-0.5">
              Review, approve, reject, or delete customer ratings and feedback submitted across all store products.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#F3F4F6] text-[#374151]">
              Total Reviews: {reviews.length}
            </span>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E5E7EB]">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto">
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

          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="flex items-center gap-2 w-full md:w-80">
            <div className="relative w-full">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]" />
              <input
                type="text"
                placeholder="Search customer, email, text..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-sm border border-[#E5E7EB] rounded-lg focus:outline-none focus:border-[#E31E24]"
              />
            </div>
            <button
              type="submit"
              className="px-3 py-1.5 bg-[#111827] text-white text-xs font-medium rounded-lg hover:bg-black shrink-0"
            >
              Filter
            </button>
          </form>
        </div>

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

                      {/* Actions */}
                      {(canUpdate || canDelete) && (
                        <td className="py-3.5 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {canUpdate && rev.status !== "APPROVED" && (
                              <button
                                disabled={updatingId === rev.id}
                                onClick={() => handleUpdateStatus(rev.id, "APPROVED")}
                                className="px-2.5 py-1 bg-[#16A34A] text-white text-[11px] font-semibold rounded hover:bg-[#15803D] transition-colors"
                                title="Approve Review"
                              >
                                Approve
                              </button>
                            )}
                            {canUpdate && rev.status !== "REJECTED" && (
                              <button
                                disabled={updatingId === rev.id}
                                onClick={() => handleUpdateStatus(rev.id, "REJECTED")}
                                className="px-2.5 py-1 bg-[#EA580C] text-white text-[11px] font-semibold rounded hover:bg-[#C2410C] transition-colors"
                                title="Reject Review"
                              >
                                Reject
                              </button>
                            )}
                            {canDelete && (
                              <button
                                disabled={updatingId === rev.id}
                                onClick={() => handleDelete(rev.id)}
                                className="p-1.5 text-[#EF4444] hover:bg-[#FEE2E2] rounded transition-colors"
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
    </AdminLayout>
  );
}
