"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import {
  ArrowLeft,
  RotateCw,
  Truck,
  Package,
  AlertCircle,
  Clock,
  Layers,
  RotateCcw,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  X,
  CreditCard,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import {
  fetchCustomerOrderTracking,
  getCustomerErrorMessage,
  submitCustomerReturnRequest,
  cancelCustomerReturnRequest,
  cancelCustomerOrder,
  type CustomerOrderTrackingResponse,
} from "@/services/customerApi";
import { OrderTrackingTimeline } from "@/components/account/OrderTrackingTimeline";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/utils/cn";

function formatOrderDate(dateStr?: string) {
  if (!dateStr) return "";
  try {
    return new Intl.DateTimeFormat("en-IN", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(dateStr));
  } catch {
    return dateStr;
  }
}

function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 30) return "Just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes > 1 ? "s" : ""} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? "s" : ""} ago`;
  return date.toLocaleDateString("en-IN");
}

function StatusBadge({ value }: { value: string }) {
  return (
    <span className="inline-flex rounded-pill border border-line bg-grey px-3 py-1 text-[11.5px] font-semibold uppercase tracking-wide text-steel">
      {value.replace(/_/g, " ")}
    </span>
  );
}

export default function CustomerOrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const { currentCustomer, isLoading: authLoading } = useCustomerAuth();

  const orderId = typeof params?.id === "string" ? params.id : "";

  const [tracking, setTracking] = useState<CustomerOrderTrackingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastFetchedAt, setLastFetchedAt] = useState<Date | null>(null);
  const [, setTick] = useState(0);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (searchParams && searchParams.get("return") === "true" && tracking?.isReturnable) {
      setShowReturnForm(true);
    }
  }, [searchParams, tracking]);

  useEffect(() => {
    if (searchParams && searchParams.get("cancel") === "true" && tracking) {
      if (["PENDING", "CONFIRMED", "PROCESSING"].includes(tracking.orderStatus)) {
        setCancelError(null);
        setShowCancelOrderModal(true);
      }
    }
  }, [searchParams, tracking]);

  // Update relative time display every 30s
  useEffect(() => {
    const timer = setInterval(() => setTick((t) => t + 1), 30000);
    return () => clearInterval(timer);
  }, []);

  const loadTracking = useCallback(async (isRefresh = false) => {
    if (!orderId) return;
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const data = await fetchCustomerOrderTracking(orderId);
      setTracking(data);
      setLastFetchedAt(new Date());
    } catch (err: unknown) {
      setError(getCustomerErrorMessage(err, "Failed to load order tracking."));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [orderId]);

  useEffect(() => {
    if (!authLoading && !currentCustomer) {
      router.push("/auth/login?next=/account");
      return;
    }
    if (currentCustomer && orderId) {
      loadTracking(false);
    }
  }, [authLoading, currentCustomer, orderId, loadTracking, router]);

  const [showReturnForm, setShowReturnForm] = useState(false);
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [returnIdToCancel, setReturnIdToCancel] = useState<string | null>(null);
  const [cancellingRequest, setCancellingRequest] = useState(false);
  const [expandedRequests, setExpandedRequests] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (tracking?.returns) {
      const initial: Record<string, boolean> = {};
      tracking.returns.forEach((ret) => {
        initial[ret.id] = ret.status === "PENDING";
      });
      setExpandedRequests(initial);
    }
  }, [tracking]);

  const [selectedItems, setSelectedItems] = useState<Record<string, { checked: boolean; quantity: number }>>({});
  const [returnReason, setReturnReason] = useState("DEFECTIVE");
  const [returnNotes, setReturnNotes] = useState("");
  const [attachmentFiles, setAttachmentFiles] = useState<File[]>([]);
  const [submittingReturn, setSubmittingReturn] = useState(false);
  const [returnError, setReturnError] = useState<string | null>(null);
  const [codRefundMethod, setCodRefundMethod] = useState<"UPI" | "BANK">("UPI");
  const [upiId, setUpiId] = useState("");
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifscCode, setIfscCode] = useState("");

  const [showCancelOrderModal, setShowCancelOrderModal] = useState(false);
  const [cancelReasonInput, setCancelReasonInput] = useState("");
  const [cancelRefundMethod, setCancelRefundMethod] = useState<"UPI" | "BANK">("UPI");
  const [cancelUpiId, setCancelUpiId] = useState("");
  const [cancelBankName, setCancelBankName] = useState("");
  const [cancelAccountHolder, setCancelAccountHolder] = useState("");
  const [cancelAccountNumber, setCancelAccountNumber] = useState("");
  const [cancelIfscCode, setCancelIfscCode] = useState("");
  const [submittingCancel, setSubmittingCancel] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const returnableItems = useMemo(() => {
    if (!tracking) return [];
    const map = new Map<string, { orderItemId: string; title: string; variantTitle: string | null; sku: string | null; quantity: number }>();
    
    // Sum up shipped items
    for (const shipment of tracking.shipments) {
      for (const item of shipment.items) {
        const existing = map.get(item.orderItemId);
        if (existing) {
          existing.quantity += item.quantity;
        } else {
          map.set(item.orderItemId, { ...item });
        }
      }
    }

    // Deduct already returned items (excluding rejected ones)
    if (tracking.returns) {
      for (const ret of tracking.returns) {
        if (ret.status === "REJECTED") continue;
        for (const retItem of ret.items) {
          const orderItemId = retItem.orderItemId;
          const existing = map.get(orderItemId);
          if (existing) {
            existing.quantity = Math.max(0, existing.quantity - retItem.quantity);
          }
        }
      }
    }

    // Filter out items that have no remaining quantity
    return Array.from(map.values()).filter((item) => item.quantity > 0);
  }, [tracking]);

  const handleSubmitReturn = async (e: React.FormEvent) => {
    e.preventDefault();
    const itemsPayload = Object.entries(selectedItems)
      .filter(([_, val]) => val.checked)
      .map(([orderItemId, val]) => ({
        orderItemId,
        quantity: val.quantity,
      }));

    if (itemsPayload.length === 0) {
      setReturnError("Please select at least one item to return.");
      return;
    }

    let refundDetails = "";
    if (codRefundMethod === "UPI") {
      if (!upiId.trim()) {
        setReturnError("Please enter your UPI ID for the refund transfer.");
        return;
      }
      refundDetails = `UPI ID: ${upiId.trim()}`;
    } else {
      if (!bankName.trim() || !accountHolder.trim() || !accountNumber.trim() || !ifscCode.trim()) {
        setReturnError("Please fill out all bank account fields for the refund transfer.");
        return;
      }
      refundDetails = `Bank Transfer - Bank: ${bankName.trim()} | Holder: ${accountHolder.trim()} | Account: ${accountNumber.trim()} | IFSC: ${ifscCode.trim()}`;
    }

    setSubmittingReturn(true);
    setReturnError(null);

    try {
      await submitCustomerReturnRequest({
        orderId,
        reason: returnReason,
        notes: returnNotes || undefined,
        refundDetails: refundDetails || undefined,
        attachments: attachmentFiles,
        items: itemsPayload,
      });
      setShowReturnForm(false);
      setSelectedItems({});
      setReturnNotes("");
      setAttachmentFiles([]);
      await loadTracking(false);
    } catch (err: unknown) {
      setReturnError(getCustomerErrorMessage(err, "Failed to submit return request."));
    } finally {
      setSubmittingReturn(false);
    }
  };

  const handleSubmitCancelOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReasonInput.trim()) {
      setCancelError("Please enter a reason for cancellation.");
      return;
    }

    let refundDetails = "";
    const isPaid = tracking?.paymentStatus === "PAID";

    if (isPaid) {
      if (cancelRefundMethod === "UPI") {
        if (!cancelUpiId.trim()) {
          setCancelError("Please enter your UPI ID for the refund transfer.");
          return;
        }
        refundDetails = `UPI ID: ${cancelUpiId.trim()}`;
      } else {
        if (!cancelBankName.trim() || !cancelAccountHolder.trim() || !cancelAccountNumber.trim() || !cancelIfscCode.trim()) {
          setCancelError("Please fill out all bank account fields for the refund transfer.");
          return;
        }
        refundDetails = `Bank Transfer - Bank: ${cancelBankName.trim()} | Holder: ${cancelAccountHolder.trim()} | Account: ${cancelAccountNumber.trim()} | IFSC: ${cancelIfscCode.trim()}`;
      }
    }

    setSubmittingCancel(true);
    setCancelError(null);

    try {
      await cancelCustomerOrder(orderId, {
        reason: cancelReasonInput.trim(),
        refundDetails: isPaid ? refundDetails : undefined,
      });
      setShowCancelOrderModal(false);
      setCancelReasonInput("");
      setCancelUpiId("");
      setCancelBankName("");
      setCancelAccountHolder("");
      setCancelAccountNumber("");
      setCancelIfscCode("");
      await loadTracking(false);
    } catch (err: unknown) {
      setCancelError(getCustomerErrorMessage(err, "Failed to cancel order."));
    } finally {
      setSubmittingCancel(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FDFBF7] py-8 sm:py-12">
      <Container className="max-w-4xl space-y-6">
        {/* Navigation Breadcrumb */}
        <div>
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-[13px] font-medium text-steel hover:text-ink transition-colors"
          >
            <ArrowLeft size={15} />
            <span>Back to Orders</span>
          </Link>
        </div>

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-6">
            <div className="rounded-lg border border-line bg-white p-6 space-y-4">
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
            </div>
            <div className="rounded-lg border border-line bg-white p-6 space-y-4">
              <Skeleton className="h-8 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          </div>
        ) : error ? (
          /* Error State */
          <div className="rounded-lg border border-rose-200 bg-rose-50 p-6 text-center space-y-4">
            <AlertCircle className="mx-auto text-rose-600" size={32} />
            <div>
              <h2 className="text-[16px] font-semibold text-rose-900">Unable to Load Tracking</h2>
              <p className="mt-1 text-[13.5px] text-rose-700">{error}</p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => loadTracking(false)}
              className="bg-white hover:bg-rose-100"
            >
              Try Again
            </Button>
          </div>
        ) : tracking ? (
          /* Main Tracking Content */
          <div className="space-y-6">
            {/* Header Card */}
            <div className="rounded-lg border border-line bg-white p-5 sm:p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="text-[18px] sm:text-[20px] font-bold text-ink">
                      Order #{tracking.orderNumber}
                    </h1>
                    <StatusBadge value={tracking.orderStatus} />
                  </div>
                  <p className="mt-1 text-[13px] text-steel">
                    Placed on {formatOrderDate(tracking.createdAt)}
                  </p>
                </div>

                 {/* Refresh & Return Actions */}
                 <div className="flex flex-col sm:items-end gap-2">
                   <div className="flex flex-wrap gap-2">
                     {tracking.isReturnable && !showReturnForm && (
                       <button
                         type="button"
                         onClick={() => setShowReturnForm(true)}
                         className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-rose-600 hover:bg-rose-50 transition-colors"
                       >
                         <RotateCcw size={13} />
                         <span>Request Return</span>
                       </button>
                     )}
                      {tracking.orderStatus !== "CANCELLED" &&
                        tracking.orderStatus !== "DELIVERED" &&
                        tracking.paymentStatus !== "PAID" && (
                          <Link
                            href={`/orders/${tracking.orderId}/pay`}
                            className={`inline-flex items-center gap-1.5 rounded-md px-3.5 py-1.5 text-[12.5px] font-semibold text-white shadow-sm transition-colors ${
                              tracking.paymentStatus === "FAILED"
                                ? "bg-[#D97706] hover:bg-[#B45309]"
                                : "bg-[#2A6A40] hover:bg-[#225533]"
                            }`}
                          >
                            <CreditCard size={13} />
                            <span>{tracking.paymentStatus === "FAILED" ? "Retry Payment" : "Pay Now"}</span>
                          </Link>
                        )}
                     {["PENDING", "CONFIRMED", "PROCESSING"].includes(tracking.orderStatus) && (
                        <button
                          type="button"
                          onClick={() => {
                            setCancelError(null);
                            setShowCancelOrderModal(true);
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md border border-rose-200 bg-rose-50 px-3.5 py-1.5 text-[12.5px] font-semibold text-rose-600 hover:bg-rose-100 transition-colors"
                        >
                          <X size={13} />
                          <span>Cancel Order</span>
                        </button>
                      )}
                     <button
                       type="button"
                       onClick={() => loadTracking(true)}
                       disabled={refreshing}
                       className="inline-flex items-center gap-1.5 rounded-md border border-line bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-ink hover:bg-grey transition-colors disabled:opacity-60"
                     >
                       <RotateCw
                         size={13}
                         className={cn(refreshing && "animate-spin text-brand")}
                       />
                       <span>{refreshing ? "Refreshing..." : "Refresh Tracking"}</span>
                     </button>
                   </div>
                    {lastFetchedAt && (
                      <span className="text-[11px] text-steel flex items-center gap-1">
                        <Clock size={11} />
                        Last synced {timeAgo(lastFetchedAt)}
                      </span>
                    )}
                    {tracking.deliveryDate && (
                      <div className="text-[11.5px] mt-1.5 text-steel sm:text-right">
                        {tracking.isReturnable ? (
                          <span>
                            Return eligible until:{" "}
                            <strong className="text-ink font-semibold">
                              {new Date(
                                new Date(tracking.deliveryDate).getTime() +
                                  (tracking.returnWindowDays || 7) * 24 * 60 * 60 * 1000
                              ).toLocaleDateString("en-IN", { dateStyle: "medium" })}
                            </strong>{" "}
                            ({tracking.returnWindowDays} days policy)
                          </span>
                        ) : (
                          <span className="text-rose-600 font-medium">
                            Return window closed ({tracking.returnWindowDays} days policy expired)
                          </span>
                        )}
                      </div>
                    )}
                 </div>
              </div>
            </div>

            {showReturnForm ? (
              <form onSubmit={handleSubmitReturn} className="rounded-lg border border-line bg-white p-6 space-y-6 shadow-sm">
                <div className="flex items-center justify-between border-b border-line pb-4">
                  <h2 className="text-[16px] font-bold text-ink flex items-center gap-2">
                    <RotateCcw size={18} className="text-brand animate-pulse" />
                    <span>Return Request</span>
                  </h2>
                  <button
                    type="button"
                    onClick={() => {
                      setShowReturnForm(false);
                      setSelectedItems({});
                      setReturnError(null);
                    }}
                    className="text-[13px] font-medium text-steel hover:text-ink transition-colors"
                  >
                    Cancel
                  </button>
                </div>

                {tracking.deliveryDate && (
                  <div className="rounded-lg bg-grey/30 border border-line p-3 text-[12.5px] text-steel leading-relaxed">
                    ℹ️ <strong className="text-ink font-semibold">Return Window Policy:</strong> You can return eligible items within <strong className="text-ink font-medium">{tracking.returnWindowDays} days</strong> of delivery (delivered on: <strong className="text-ink font-semibold">{new Date(tracking.deliveryDate).toLocaleDateString("en-IN", { dateStyle: "medium" })}</strong>).
                  </div>
                )}

                {returnError && (
                  <div className="rounded-md bg-rose-50 border border-rose-100 p-4 text-[13.5px] text-rose-700">
                    {returnError}
                  </div>
                )}

                {/* Items selection list */}
                <div className="space-y-4">
                  <label className="text-[13.5px] font-bold text-ink block">Select items to return:</label>
                  <div className="border border-line rounded-lg divide-y divide-line overflow-hidden">
                    {returnableItems.map((item) => {
                      const isChecked = !!selectedItems[item.orderItemId]?.checked;
                      const selectedQty = selectedItems[item.orderItemId]?.quantity ?? 1;

                      return (
                        <div key={item.orderItemId} className="flex items-center justify-between p-4 bg-white hover:bg-grey/10 transition-colors">
                          <div className="flex items-start gap-3">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                setSelectedItems((prev) => ({
                                  ...prev,
                                  [item.orderItemId]: {
                                    checked: e.target.checked,
                                    quantity: prev[item.orderItemId]?.quantity ?? 1,
                                  },
                                }));
                              }}
                              className="mt-1 h-4 w-4 rounded border-line text-brand focus:ring-brand"
                            />
                            <div>
                              <p className="text-[13.5px] font-semibold text-ink">{item.title}</p>
                              {item.variantTitle && <p className="text-[12px] text-steel">{item.variantTitle}</p>}
                              {item.sku && <p className="text-[11px] font-mono text-steel mt-0.5">SKU: {item.sku}</p>}
                            </div>
                          </div>

                          {isChecked && (
                            <div className="flex items-center gap-2">
                              <span className="text-[12.5px] text-steel font-medium">Qty:</span>
                              <div className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedItems((prev) => ({
                                      ...prev,
                                      [item.orderItemId]: {
                                        checked: true,
                                        quantity: Math.max(1, selectedQty - 1),
                                      },
                                    }));
                                  }}
                                  className="h-8 w-8 rounded border border-line bg-white flex items-center justify-center text-steel hover:bg-grey hover:text-ink transition-colors font-bold text-[14px]"
                                >
                                  -
                                </button>
                                <input
                                  type="text"
                                  value={selectedQty}
                                  onChange={(e) => {
                                    const val = e.target.value.replace(/[^0-9]/g, "");
                                    const num = val ? parseInt(val) : 1;
                                    setSelectedItems((prev) => ({
                                      ...prev,
                                      [item.orderItemId]: {
                                        checked: true,
                                        quantity: Math.min(item.quantity, Math.max(1, num)),
                                      },
                                    }));
                                  }}
                                  className="w-12 h-8 rounded border border-line text-center text-[12.5px] font-semibold text-ink focus:border-brand focus:ring-0"
                                />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedItems((prev) => ({
                                      ...prev,
                                      [item.orderItemId]: {
                                        checked: true,
                                        quantity: Math.min(item.quantity, selectedQty + 1),
                                      },
                                    }));
                                  }}
                                  className="h-8 w-8 rounded border border-line bg-white flex items-center justify-center text-steel hover:bg-grey hover:text-ink transition-colors font-bold text-[14px]"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Reason Selection */}
                <div className="space-y-2">
                  <label className="text-[13.5px] font-bold text-ink block">Reason for Return:</label>
                  <select
                    value={returnReason}
                    onChange={(e) => setReturnReason(e.target.value)}
                    className="w-full rounded border border-line bg-white px-3.5 py-2 text-[13.5px] font-medium text-ink focus:border-brand"
                  >
                    <option value="DEFECTIVE">Defective / Damaged</option>
                    <option value="WRONG_ITEM">Wrong Item Received</option>
                    <option value="QUALITY_ISSUE">Quality Issue / Not as Expected</option>
                    <option value="SIZE_FIT">Size / Fit Issue</option>
                    <option value="MISTAKE">Ordered by Mistake</option>
                    <option value="LATE_DELIVERY">Arrived Too Late</option>
                    <option value="OTHER">Other (Please detail below)</option>
                  </select>
                </div>

                {/* Notes Description */}
                <div className="space-y-2">
                  <label className="text-[13.5px] font-bold text-ink block">Additional Notes / Details:</label>
                  <textarea
                    rows={4}
                    value={returnNotes}
                    onChange={(e) => setReturnNotes(e.target.value)}
                    placeholder="Provide any additional context or details about the return..."
                    className="w-full rounded border border-line bg-white px-3.5 py-2 text-[13.5px] text-ink focus:border-brand"
                  />
                </div>

                {tracking && (
                  <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
                    <h3 className="text-[13.5px] font-bold text-amber-900 flex items-center gap-1.5">
                      Refund Information
                    </h3>
                    <p className="text-[12px] text-amber-800 leading-normal">
                      Please provide your refund transfer details below (either UPI ID or Bank Details) so the store can process your refund once approved.
                    </p>

                    <div className="flex gap-4 border-b border-amber-200/60 pb-3">
                      <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="codRefundMethod"
                          checked={codRefundMethod === "UPI"}
                          onChange={() => setCodRefundMethod("UPI")}
                          className="h-4 w-4 text-brand focus:ring-brand"
                        />
                        UPI Transfer
                      </label>
                      <label className="flex items-center gap-1.5 text-[13px] font-medium text-ink cursor-pointer">
                        <input
                          type="radio"
                          name="codRefundMethod"
                          checked={codRefundMethod === "BANK"}
                          onChange={() => setCodRefundMethod("BANK")}
                          className="h-4 w-4 text-brand focus:ring-brand"
                        />
                        Bank Account Transfer
                      </label>
                    </div>

                    {codRefundMethod === "UPI" ? (
                      <div className="space-y-2">
                        <label className="text-[12.5px] font-semibold text-ink block">UPI ID (e.g. GPay/PhonePe ID):</label>
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => setUpiId(e.target.value)}
                          placeholder="username@bank"
                          className="w-full max-w-sm rounded border border-line bg-white px-3 py-1.5 text-[13px] text-ink focus:border-brand"
                        />
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <label className="text-[12.5px] font-semibold text-ink block">Account Holder Name:</label>
                          <input
                            type="text"
                            value={accountHolder}
                            onChange={(e) => setAccountHolder(e.target.value)}
                            placeholder="Full Name"
                            className="w-full rounded border border-line bg-white px-3 py-1.5 text-[13px] text-ink focus:border-brand"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12.5px] font-semibold text-ink block">Bank Name:</label>
                          <input
                            type="text"
                            value={bankName}
                            onChange={(e) => setBankName(e.target.value)}
                            placeholder="e.g. HDFC Bank"
                            className="w-full rounded border border-line bg-white px-3 py-1.5 text-[13px] text-ink focus:border-brand"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12.5px] font-semibold text-ink block">Account Number:</label>
                          <input
                            type="text"
                            value={accountNumber}
                            onChange={(e) => setAccountNumber(e.target.value)}
                            placeholder="Bank Account Number"
                            className="w-full rounded border border-line bg-white px-3 py-1.5 text-[13px] text-ink focus:border-brand"
                          />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-[12.5px] font-semibold text-ink block">IFSC Code:</label>
                          <input
                            type="text"
                            value={ifscCode}
                            onChange={(e) => setIfscCode(e.target.value)}
                            placeholder="e.g. HDFC0000123"
                            className="w-full rounded border border-line bg-white px-3 py-1.5 text-[13px] text-ink focus:border-brand"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Image/Video Upload */}
                <div className="space-y-2">
                  <label className="text-[13.5px] font-bold text-ink block">Upload Images or Videos (Optional):</label>
                  <input
                    type="file"
                    multiple
                    accept="image/*,video/*"
                    onChange={(e) => {
                      const files = e.target.files;
                      if (files) {
                        setAttachmentFiles((prev) => [...prev, ...Array.from(files)]);
                      }
                    }}
                    className="text-[13px] text-steel file:mr-4 file:py-1.5 file:px-3 file:rounded file:border file:border-line file:bg-white file:text-ink hover:file:bg-grey transition-colors"
                  />
                  {attachmentFiles.length > 0 && (
                    <div className="mt-2 space-y-1.5 max-w-md">
                      {attachmentFiles.map((file, index) => (
                        <div key={index} className="flex items-center justify-between text-[12.5px] text-ink bg-grey/30 px-3 py-2 rounded-md border border-line">
                          <span className="truncate max-w-[250px] font-mono">{file.name}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setAttachmentFiles((prev) => prev.filter((_, i) => i !== index));
                            }}
                            className="text-rose-600 hover:underline font-semibold text-[12px] ml-2"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[11px] text-steel">Max file size: 20MB per file. Supported formats: Images & Videos.</p>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setShowReturnForm(false);
                      setSelectedItems({});
                      setReturnError(null);
                    }}
                    disabled={submittingReturn}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={submittingReturn}
                    className="bg-brand hover:bg-[#c3191e] text-white"
                  >
                    {submittingReturn ? "Submitting..." : "Submit Return"}
                  </Button>
                </div>
              </form>
            ) : (
              <>
                {/* Active Return Status Messages */}
                {tracking.orderStatus === "RETURN_REQUESTED" && (
                  <div className="flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50/70 p-4 text-[13.5px] text-amber-900 shadow-sm">
                    <Clock className="text-amber-600 mt-0.5 shrink-0 animate-pulse" size={18} />
                    <div>
                      <strong className="font-semibold block text-[14px]">Return Request Under Review</strong>
                      <span className="mt-0.5 block text-amber-800 leading-relaxed text-[13px]">
                        We have successfully received your return request. Our operations and support team are reviewing the request details and will contact you shortly with approval or instructions.
                      </span>
                    </div>
                  </div>
                )}

                {tracking.orderStatus === "CANCELLED" && (
                  <div className="flex items-start gap-3 rounded-lg border border-rose-200 bg-rose-50/70 p-4 text-[13.5px] text-rose-900 shadow-sm">
                    <AlertCircle className="text-rose-600 mt-0.5 shrink-0" size={18} />
                    <div className="space-y-2.5 w-full">
                      <div>
                        <strong className="font-semibold block text-[14px]">Order Cancelled</strong>
                        <span className="mt-0.5 block text-rose-800 leading-relaxed text-[13px]">
                          This order has been cancelled. If this was a prepaid order, the refund details and progress are shown below.
                        </span>
                      </div>
                      {tracking.cancelReason && (
                        <div className="text-[12.5px] border-t border-rose-200/50 pt-2">
                          <span className="font-bold text-rose-900 block">Cancellation Reason:</span>
                          <span className="text-rose-800">{tracking.cancelReason}</span>
                        </div>
                      )}
                      {tracking.cancelRefundDetails && (
                        <div className="text-[12.5px] bg-white border border-rose-200/60 p-2.5 rounded shadow-sm">
                          <span className="font-bold text-rose-900 block mb-0.5">Refund Destination:</span>
                          <span className="text-rose-800 font-semibold">{tracking.cancelRefundDetails}</span>
                        </div>
                      )}
                      {tracking.cancelTransactionReference && (
                        <div className="text-[12.5px] bg-emerald-50 border border-emerald-200 p-2.5 rounded shadow-sm">
                          <span className="font-bold text-emerald-900 block mb-0.5">Refund Reference / UTR Number:</span>
                          <span className="text-emerald-800 font-bold">{tracking.cancelTransactionReference}</span>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {tracking.orderStatus === "RETURNED" && (
                  <div className="flex items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/70 p-4 text-[13.5px] text-emerald-900 shadow-sm">
                    <CheckCircle2 className="text-emerald-600 mt-0.5 shrink-0" size={18} />
                    <div>
                      <strong className="font-semibold block text-[14px]">Order Returned & Refunded</strong>
                      <span className="mt-0.5 block text-emerald-800 leading-relaxed text-[13px]">
                        The return request for this order has been processed and completed. The refund amount has been credited to your payment method.
                      </span>
                    </div>
                  </div>
                )}

                {tracking.returns && tracking.returns.length > 0 && (
                  <div className="rounded-lg border border-line bg-white p-5 space-y-4 shadow-sm mt-4">
                    <h3 className="text-[14px] font-bold text-ink border-b border-line pb-2.5 flex items-center gap-2">
                      <RotateCw className="text-steel" size={16} />
                      Your Return Requests
                    </h3>
                    <div className="space-y-3 divide-y divide-line">
                      {tracking.returns.map((ret) => {
                        const isExpanded = !!expandedRequests[ret.id];
                        return (
                          <div key={ret.id} className="pt-3 first:pt-0 space-y-3">
                            <button
                              type="button"
                              onClick={() => {
                                setExpandedRequests((prev) => ({
                                  ...prev,
                                  [ret.id]: !prev[ret.id],
                                }));
                              }}
                              className="w-full flex items-center justify-between text-left focus:outline-none py-1 hover:bg-grey/10 rounded px-1 transition"
                            >
                              <div className="flex flex-wrap items-center gap-2.5">
                                <span className="text-[13px] font-bold text-ink">
                                  Request Date: {new Date(ret.createdAt).toLocaleDateString()}
                                </span>
                                <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold ${
                                  ret.status === "PENDING"
                                    ? "bg-amber-100 text-amber-800"
                                    : ret.status === "APPROVED"
                                    ? "bg-blue-100 text-blue-800"
                                    : ret.status === "COMPLETED"
                                    ? "bg-emerald-100 text-emerald-800"
                                    : ret.status === "CANCELLED"
                                    ? "bg-slate-150 text-slate-600 border border-slate-200"
                                    : "bg-rose-100 text-rose-800"
                                }`}>
                                  {ret.status}
                                </span>
                                <span className="text-[12.5px] font-bold text-brand">
                                  ₹{Number(ret.refundAmount).toFixed(2)}
                                </span>
                              </div>
                              <span className="text-steel">
                                {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                              </span>
                            </button>

                            {isExpanded && (
                              <div className="space-y-3 pl-1 pt-1 animate-fadeIn">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-[13px] text-steel">
                                  <div>
                                    <span className="font-medium text-ink block">Reason:</span>
                                    <span>{ret.reason}</span>
                                  </div>
                                  <div>
                                    <span className="font-medium text-ink block">Est. Refund Amount:</span>
                                    <span className="font-bold text-brand">₹{Number(ret.refundAmount).toFixed(2)}</span>
                                  </div>
                                  {ret.notes && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-ink block">Your Explanation:</span>
                                      <span className="bg-grey/20 p-2.5 rounded block mt-0.5 text-ink whitespace-pre-wrap">{ret.notes}</span>
                                    </div>
                                  )}
                                  {ret.refundDetails && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-ink block">Refund Transfer Details:</span>
                                      <span className="bg-amber-50/50 border border-amber-100 p-2.5 rounded block mt-0.5 text-ink whitespace-pre-wrap">{ret.refundDetails}</span>
                                    </div>
                                  )}
                                  {ret.adminNotes && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-ink block">Store Notes / Update:</span>
                                      <span className="bg-amber-50 border border-amber-100 p-2.5 rounded block mt-0.5 text-ink whitespace-pre-wrap">{ret.adminNotes}</span>
                                    </div>
                                  )}
                                  {ret.transactionReference && (
                                    <div className="md:col-span-2">
                                      <span className="font-medium text-ink block">Manual Refund Ref / UTR:</span>
                                      <span className="bg-emerald-50 border border-emerald-100 p-2.5 rounded block mt-0.5 text-emerald-950 font-bold whitespace-pre-wrap">{ret.transactionReference}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Returned Items */}
                                <div className="space-y-1.5 pt-2 border-t border-line/50">
                                  <span className="text-[12.5px] font-bold text-ink block">Items in this return request:</span>
                                  {ret.items.map((item: any) => (
                                    <div key={item.id} className="flex justify-between items-center text-[12.5px] text-steel bg-grey/10 px-3 py-1.5 rounded border border-line/40">
                                      <span>{item.orderItem?.title}</span>
                                      <span className="font-semibold text-ink">Qty: {item.quantity}</span>
                                    </div>
                                  ))}
                                </div>

                                {ret.status === "PENDING" && (
                                  <div className="pt-2 flex justify-end">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setReturnIdToCancel(ret.id);
                                        setCancelModalOpen(true);
                                      }}
                                      className="text-[12px] font-semibold text-rose-600 hover:text-rose-700 border border-rose-200 bg-rose-50 px-3 py-1.5 rounded hover:bg-rose-100 transition shadow-sm"
                                    >
                                      Cancel Return Request
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Split Shipment Notice */}
                {tracking.isMultiShipment && (
                  <div className="flex items-start gap-3 rounded-lg border border-blue-200 bg-blue-50/70 p-4 text-[13px] text-blue-900">
                    <Layers className="text-blue-600 mt-0.5 shrink-0" size={17} />
                    <div>
                      <strong className="font-semibold">Multiple Shipments:</strong> This order is divided into{" "}
                      <strong>{tracking.shipments.length} shipments</strong> fulfilled from different warehouse facilities to optimize delivery speed.
                    </div>
                  </div>
                )}

                {/* Shipments List */}
                {tracking.shipments.length > 0 ? (
                  <div className="space-y-6">
                    {tracking.shipments.map((shipment, idx) => (
                      <OrderTrackingTimeline
                        key={shipment.shipmentId}
                        shipment={shipment}
                        index={idx}
                        totalShipments={tracking.shipments.length}
                      />
                    ))}
                  </div>
                ) : (
                  /* No Shipments Yet State */
                  <div className="rounded-lg border border-line bg-white p-8 text-center space-y-4 shadow-sm">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-grey text-steel">
                      <Package size={26} />
                    </div>
                    <div className="space-y-1">
                      <h3 className="text-[16px] font-semibold text-ink">Order is Processing</h3>
                      <p className="text-[13.5px] text-steel max-w-md mx-auto">
                        Your order is being prepared by our fulfillment team. Shipment tracking and courier details will appear here as soon as the package is dispatched.
                      </p>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        ) : null}
      </Container>

      <Modal
        open={cancelModalOpen}
        onClose={() => {
          if (!cancellingRequest) {
            setCancelModalOpen(false);
            setReturnIdToCancel(null);
          }
        }}
        title="Cancel Return Request"
        footer={
          <>
            <button
              type="button"
              disabled={cancellingRequest}
              onClick={() => {
                setCancelModalOpen(false);
                setReturnIdToCancel(null);
              }}
              className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-white px-4 text-[12.5px] font-semibold text-ink hover:bg-grey transition shadow-sm"
            >
              No, Keep Request
            </button>
            <button
              type="button"
              disabled={cancellingRequest}
              onClick={async () => {
                if (!returnIdToCancel) return;
                setCancellingRequest(true);
                try {
                  await cancelCustomerReturnRequest(returnIdToCancel);
                  setCancelModalOpen(false);
                  setReturnIdToCancel(null);
                  loadTracking(false);
                } catch (err) {
                  alert("Failed to cancel return request: " + getCustomerErrorMessage(err));
                } finally {
                  setCancellingRequest(false);
                }
              }}
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-[12.5px] font-semibold text-white hover:bg-rose-700 transition shadow-sm disabled:opacity-60"
            >
              {cancellingRequest ? "Cancelling..." : "Yes, Cancel Return"}
            </button>
          </>
        }
      >
        <div className="p-6 text-[13.5px] text-steel leading-relaxed">
          Are you sure you want to cancel this return request? This will release the item quantities so you can submit a new return request with updated quantities.
        </div>
      </Modal>

      {/* Cancel Order Modal */}
      <Modal
        open={showCancelOrderModal}
        onClose={() => {
          if (!submittingCancel) {
            setShowCancelOrderModal(false);
          }
        }}
        title="Cancel Order"
        footer={
          <>
            <button
              type="button"
              disabled={submittingCancel}
              onClick={() => setShowCancelOrderModal(false)}
              className="inline-flex h-9 items-center justify-center rounded-md border border-line bg-white px-4 text-[12.5px] font-semibold text-ink hover:bg-grey transition shadow-sm"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={submittingCancel}
              onClick={handleSubmitCancelOrder}
              className="inline-flex h-9 items-center justify-center rounded-md bg-rose-600 px-4 text-[12.5px] font-semibold text-white hover:bg-rose-700 transition shadow-sm disabled:opacity-60"
            >
              {submittingCancel ? "Cancelling..." : "Confirm Cancellation"}
            </button>
          </>
        }
      >
        <form onSubmit={handleSubmitCancelOrder} className="p-6 space-y-4 text-[13.5px] text-steel">
          {cancelError && (
            <div className="rounded bg-rose-50 border border-rose-200 p-3 text-[12.5px] text-rose-600">
              {cancelError}
            </div>
          )}

          <div className="space-y-2">
            <label className="text-[13px] font-bold text-ink block">Reason for Cancellation:</label>
            <textarea
              rows={3}
              value={cancelReasonInput}
              onChange={(e) => setCancelReasonInput(e.target.value)}
              placeholder="Please enter a reason for cancelling this order..."
              className="w-full rounded border border-line bg-white px-3.5 py-2 text-[13px] text-ink focus:border-brand focus:outline-none"
              required
            />
          </div>

          {tracking && tracking.paymentStatus === "PAID" && (
            <div className="space-y-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4 mt-2">
              <h3 className="text-[13px] font-bold text-amber-900 flex items-center gap-1.5">
                Prepaid Refund Information
              </h3>
              <p className="text-[11.5px] text-amber-800 leading-normal">
                This is a paid order. Please provide your refund details below so we can process your manual or gateway fallback transfer once cancelled.
              </p>

              <div className="flex gap-4 border-b border-amber-200/60 pb-3">
                <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="cancelRefundMethod"
                    checked={cancelRefundMethod === "UPI"}
                    onChange={() => setCancelRefundMethod("UPI")}
                    className="h-4 w-4 text-brand focus:ring-brand"
                  />
                  UPI Transfer
                </label>
                <label className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink cursor-pointer">
                  <input
                    type="radio"
                    name="cancelRefundMethod"
                    checked={cancelRefundMethod === "BANK"}
                    onChange={() => setCancelRefundMethod("BANK")}
                    className="h-4 w-4 text-brand focus:ring-brand"
                  />
                  Bank Account Transfer
                </label>
              </div>

              {cancelRefundMethod === "UPI" ? (
                <div className="space-y-2">
                  <label className="text-[12px] font-semibold text-ink block">UPI ID (e.g. GPay/PhonePe ID):</label>
                  <input
                    type="text"
                    value={cancelUpiId}
                    onChange={(e) => setCancelUpiId(e.target.value)}
                    placeholder="username@bank"
                    className="w-full max-w-sm rounded border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                  />
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-ink block">Account Holder Name:</label>
                    <input
                      type="text"
                      value={cancelAccountHolder}
                      onChange={(e) => setCancelAccountHolder(e.target.value)}
                      placeholder="Full Name"
                      className="w-full rounded border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-ink block">Bank Name:</label>
                    <input
                      type="text"
                      value={cancelBankName}
                      onChange={(e) => setCancelBankName(e.target.value)}
                      placeholder="e.g. HDFC Bank"
                      className="w-full rounded border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-ink block">Account Number:</label>
                    <input
                      type="text"
                      value={cancelAccountNumber}
                      onChange={(e) => setCancelAccountNumber(e.target.value)}
                      placeholder="Bank Account Number"
                      className="w-full rounded border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[12px] font-semibold text-ink block">IFSC Code:</label>
                    <input
                      type="text"
                      value={cancelIfscCode}
                      onChange={(e) => setCancelIfscCode(e.target.value)}
                      placeholder="e.g. HDFC0000123"
                      className="w-full rounded border border-line bg-white px-3 py-1.5 text-[12.5px] text-ink focus:border-brand focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}
