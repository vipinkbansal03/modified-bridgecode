"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Star, MessageSquarePlus, X, Copy, Check, Send, LogIn, Lock } from "lucide-react";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { submitProductReview } from "@/hooks/api/useProducts";
import type { ProductDetail } from "@/types/product.types";

interface ProductFeedbackSectionProps {
  product: ProductDetail;
  onRatingUpdate?: (newAvg: number, newCount: number) => void;
}

export function ProductFeedbackSection({ product, onRatingUpdate }: ProductFeedbackSectionProps) {
  const { currentCustomer } = useCustomerAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedSuccess, setSubmittedSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [qualityRating, setQualityRating] = useState(5);
  const [priceRating, setPriceRating] = useState(5);
  const [overallRating, setOverallRating] = useState(5);
  const [feedbackText, setFeedbackText] = useState("");

  const pageUrl = typeof window !== "undefined" ? window.location.href : `https://modortho.com/products/${product.slug}`;
  const thumbnail = product.images?.[0] || "";

  const customerName = currentCustomer
    ? `${currentCustomer.firstName || ""} ${currentCustomer.lastName || ""}`.trim() || "Verified Buyer"
    : "";

  const handleCopyUrl = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(pageUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentCustomer) return;
    setSubmitting(true);
    setErrorMessage(null);

    try {
      const data = await submitProductReview(product.slug || product.productCode || "", {
        customerName: customerName || "Verified Buyer",
        customerEmail: currentCustomer.email || "",
        ratingQuality: qualityRating,
        ratingPrice: priceRating,
        ratingOverall: overallRating,
        feedbackText: feedbackText.trim(),
      });

      setSubmittedSuccess(true);
      if (data?.averageRating !== undefined && data?.totalRatings !== undefined) {
        onRatingUpdate?.(data.averageRating, data.totalRatings);
      }
      setTimeout(() => {
        setIsOpen(false);
        setSubmittedSuccess(false);
        setFeedbackText("");
      }, 2500);
    } catch (err: any) {
      setErrorMessage(err?.message || "Failed to submit feedback. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Dentalkart Style Feedback Bar */}
      <div className="my-6 flex items-center justify-between rounded-2xl border border-[#E31E24] bg-white p-4 shadow-2xs">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-[#E31E24] border border-[#E31E24]">
            <MessageSquarePlus size={20} />
          </div>
          <p className="text-[14.5px] font-bold text-[#111827]">
            Would you like to tell us about the product?
          </p>
        </div>

        <button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setSubmittedSuccess(false);
            setIsOpen(true);
          }}
          className="flex items-center gap-1.5 rounded-xl bg-[#E31E24] px-5 py-2.5 text-[13.5px] font-bold text-white shadow-2xs transition-all hover:bg-[#B5151B] hover:shadow-xs active:scale-95 cursor-pointer"
        >
          Feedback &gt;&gt;
        </button>
      </div>

      {/* Valuable Feedback Modal Popup */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-[#F3F4F6] text-[#6B7280] hover:bg-[#E5E7EB] hover:text-[#111827]"
            >
              <X size={18} />
            </button>

            <h3 className="mb-4 text-[18px] font-bold text-[#111827]">Valuable Feedback</h3>

            {/* Product Header inside Modal */}
            <div className="mb-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
              <div className="flex items-center gap-3">
                {thumbnail && (
                  <div className="relative h-14 w-14 flex-none overflow-hidden rounded-lg border border-[#E5E7EB] bg-white">
                    <Image
                      src={thumbnail}
                      alt={product.title}
                      fill
                      className="object-contain p-1"
                      unoptimized={thumbnail.startsWith("http://") || thumbnail.startsWith("https://")}
                    />
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h4 className="line-clamp-2 text-[13.5px] font-bold text-[#1F2937]">{product.title}</h4>
                  <div className="mt-1 flex items-center gap-2 text-[12px] text-[#6B7280]">
                    <span className="truncate max-w-[200px]">{pageUrl}</span>
                    <button
                      type="button"
                      onClick={handleCopyUrl}
                      className="flex items-center gap-1 text-[#2563EB] font-semibold hover:underline"
                    >
                      {copied ? <Check size={13} className="text-[#16A34A]" /> : <Copy size={13} />}
                      {copied ? "Copied!" : "Share"}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* LOGIN REQUIRED GATE */}
            {!currentCustomer ? (
              <div className="my-6 rounded-xl border border-[#FED7AA] bg-[#FFEDD5]/60 p-5 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F97316]/10 text-[#F97316]">
                  <Lock size={22} />
                </div>
                <h4 className="text-[16px] font-bold text-[#9A3412]">Login Required</h4>
                <p className="mt-1 text-[13.5px] leading-relaxed text-[#C2410C]">
                  Only logged-in customers can submit product ratings &amp; valuable feedback.
                </p>
                <Link
                  href={`/login?redirect=/products/${product.slug}`}
                  className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#E31E24] px-6 py-2.5 text-[14px] font-bold text-white shadow-sm hover:bg-[#B5151B] transition-all"
                >
                  <LogIn size={16} /> Log In To Give Feedback
                </Link>
              </div>
            ) : submittedSuccess ? (
              <div className="my-8 text-center space-y-2">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#DCFCE7] text-[#16A34A]">
                  <Check size={24} />
                </div>
                <h4 className="text-[16px] font-bold text-[#111827]">Thank You, {customerName}!</h4>
                <p className="text-[13.5px] text-[#4B5563]">Your valuable feedback has been submitted and is pending admin approval.</p>
              </div>
            ) : errorMessage ? (
              <div className="my-8 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FEF3C7] text-[#D97706]">
                  <MessageSquarePlus size={24} />
                </div>
                <h4 className="text-[16px] font-bold text-[#111827]">Notice</h4>
                <p className="text-[13.5px] text-[#4B5563]">{errorMessage}</p>
                <button
                  type="button"
                  onClick={() => setErrorMessage(null)}
                  className="mt-2 inline-flex items-center rounded-xl bg-[#F3F4F6] px-4 py-2 text-[13px] font-semibold text-[#374151] hover:bg-[#E5E7EB] transition-colors"
                >
                  Try Again
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="border-b border-[#F3F4F6] pb-3">
                  <span className="block text-[12px] font-semibold uppercase tracking-wider text-[#9CA3AF]">
                    Log In as {customerName || currentCustomer.email}
                  </span>
                  <h4 className="mt-0.5 text-[15px] font-bold text-[#111827]">
                    We&apos;d Love To Hear Your Thoughts And Feedback!
                  </h4>
                </div>

                {/* Star Ratings */}
                <div className="space-y-3 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-3.5">
                  <InteractiveStarRating
                    label="Product Quality"
                    value={qualityRating}
                    onChange={setQualityRating}
                  />
                  <InteractiveStarRating
                    label="Product Price"
                    value={priceRating}
                    onChange={setPriceRating}
                  />
                  <InteractiveStarRating
                    label="Overall Experience"
                    value={overallRating}
                    onChange={setOverallRating}
                  />
                </div>

                {/* Feedback Textarea */}
                <div>
                  <label className="block text-[12.5px] font-bold text-[#374151] mb-1">Product Feedback</label>
                  <textarea
                    rows={3}
                    placeholder="Share your experience regarding performance, bonding strength, or packaging..."
                    value={feedbackText}
                    onChange={(e) => setFeedbackText(e.target.value)}
                    className="w-full rounded-lg border border-[#D1D5DB] px-3.5 py-2 text-[13.5px] text-[#111827] outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
                  />
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#E31E24] py-3 text-[14px] font-bold text-white shadow-md transition-all hover:bg-[#B5151B] disabled:opacity-50 cursor-pointer"
                >
                  <Send size={15} />
                  {submitting ? "Submitting..." : "Submit Feedback"}
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function InteractiveStarRating({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (val: number) => void;
}) {
  const [hoverVal, setHoverVal] = useState(0);

  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] font-bold text-[#374151]">{label}</span>
      <div className="flex items-center gap-1" onMouseLeave={() => setHoverVal(0)}>
        {[1, 2, 3, 4, 5].map((star) => {
          const active = (hoverVal || value) >= star;
          return (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star)}
              onMouseEnter={() => setHoverVal(star)}
              className="p-1 transition-transform hover:scale-110 focus:outline-none"
            >
              <Star
                size={18}
                className={active ? "fill-[#F59E0B] text-[#F59E0B]" : "text-[#D1D5DB]"}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
