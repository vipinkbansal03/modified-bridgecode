"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle, XCircle, RotateCw, DollarSign } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { StatusBadge, AdminInput, useToast } from "@/components/admin/AdminComponents";
import { useAdminOrderReturn, useUpdateOrderReturnStatus } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { Modal } from "@/components/ui/Modal";

type ReturnDetail = {
  id: string;
  status: string;
  reason: string;
  notes: string | null;
  adminNotes: string | null;
  refundDetails: string | null;
  transactionReference: string | null;
  attachmentUrls: string[];
  refundAmount: number | string;
  createdAt: string;
  customer: { firstName: string; lastName: string; email: string; phone: string | null };
  order: {
    id: string;
    orderNumber: string;
    status: string;
    paymentStatus: string;
    paymentMethod: string | null;
    currency: { symbol: string };
  };
  items: {
    id: string;
    quantity: number;
    orderItem: {
      id: string;
      title: string;
      sku: string | null;
      unitPrice: number | string;
      taxAmount: number | string;
      quantity: number;
    };
  }[];
};

function getMediaUrl(url: string | null) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return url;
}

export default function AdminReturnDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { showToast } = useToast();

  const { data: returnRequest, isLoading } = useAdminOrderReturn(id) as {
    data?: ReturnDetail;
    isLoading: boolean;
  };

  const { mutate: updateStatus, isPending: updating } = useUpdateOrderReturnStatus();
  const [adminNotes, setAdminNotes] = useState("");
  const [onlineRefundMethod, setOnlineRefundMethod] = useState<"RAZORPAY" | "MANUAL">("RAZORPAY");
  const [transactionReference, setTransactionReference] = useState("");
  const [confirmModal, setConfirmModal] = useState<{
    open: boolean;
    title: string;
    message: string;
    onConfirm: (() => void) | null;
    isAlertOnly?: boolean;
  }>({
    open: false,
    title: "",
    message: "",
    onConfirm: null,
    isAlertOnly: false,
  });

  const handleAction = (status: "APPROVED" | "REJECTED" | "COMPLETED") => {
    const refundMethod = status === "COMPLETED"
      ? (returnRequest?.order.paymentMethod === "RAZORPAY" ? onlineRefundMethod : "MANUAL")
      : undefined;

    const txRef = status === "COMPLETED" && (refundMethod === "MANUAL") ? transactionReference : undefined;

    updateStatus(
      {
        id,
        status,
        adminNotes: adminNotes || undefined,
        refundMethod,
        transactionReference: txRef || undefined,
      },
      {
        onSuccess: () => {
          showToast(`Return status updated to ${status} successfully.`, "success");
          setAdminNotes("");
          setTransactionReference("");
        },
        onError: (err) => {
          showToast(getAdminErrorMessage(err, "Failed to update return status"), "error");
        },
      }
    );
  };

  if (isLoading) {
    return (
      <AdminLayout
        title="Return Request Details"
        breadcrumb={[{ label: "Returns", href: "/admin/returns" }, { label: "Loading…" }]}
      >
        <div className="animate-pulse space-y-4">
          <div className="h-10 rounded-lg bg-grey" />
          <div className="h-40 rounded-lg bg-grey" />
        </div>
      </AdminLayout>
    );
  }

  if (!returnRequest) {
    return (
      <AdminLayout
        title="Return Request Details"
        breadcrumb={[{ label: "Returns", href: "/admin/returns" }, { label: "Not found" }]}
      >
        <div className="text-center py-10 space-y-4">
          <p className="text-steel">Return request not found.</p>
          <Link href="/admin/returns" className="text-brand hover:underline inline-flex items-center gap-1">
            <ArrowLeft size={14} /> Back to list
          </Link>
        </div>
      </AdminLayout>
    );
  }

  const sym = returnRequest.order.currency?.symbol ?? "$";

  return (
    <AdminLayout
      title={`Return Request Details`}
      breadcrumb={[
        { label: "Returns", href: "/admin/returns" },
        { label: `Order #${returnRequest.order.orderNumber}` },
      ]}
    >
      <div className="space-y-6">
        {/* Header Summary */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-lg border border-line bg-white p-5">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <span className="text-[16px] font-bold text-ink">
                Return ID: {returnRequest.id.slice(-8).toUpperCase()}
              </span>
              <StatusBadge status={returnRequest.status} />
            </div>
            <p className="text-[13px] text-steel">
              Requested on: {new Date(returnRequest.createdAt).toLocaleString()}
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Link
              href="/admin/returns"
              className="rounded-md border border-line bg-white px-3.5 py-2 text-[13px] font-medium text-steel hover:bg-grey transition"
            >
              Back to List
            </Link>
          </div>
        </div>

        {/* main grid layouts */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {/* Items being Returned */}
            <div className="rounded-lg border border-line bg-white overflow-hidden shadow-sm">
              <div className="border-b border-line px-5 py-3.5 bg-offwhite">
                <h3 className="text-[14px] font-bold text-ink">Returned Items</h3>
              </div>
              <div className="divide-y divide-line">
                {returnRequest.items.map((item) => {
                  const oItem = item.orderItem;
                  const itemPrice = Number(oItem.unitPrice);
                  const itemTax = oItem.quantity > 0 ? Number(oItem.taxAmount) / oItem.quantity : 0;
                  const refundPerUnit = itemPrice + itemTax;
                  return (
                    <div key={item.id} className="flex items-center justify-between p-5">
                      <div>
                        <h4 className="text-[13.5px] font-semibold text-ink">{oItem.title}</h4>
                        {oItem.sku && <p className="font-mono text-[11.5px] text-steel mt-0.5">SKU: {oItem.sku}</p>}
                        <p className="text-[12px] text-steel mt-1">
                          Returned Quantity: <strong className="text-ink font-semibold">{item.quantity}</strong> (out of {oItem.quantity} ordered)
                        </p>
                      </div>
                      <div className="text-right">
                        <span className="text-[14px] font-semibold text-ink">
                          {sym}{(refundPerUnit * item.quantity).toFixed(2)}
                        </span>
                        <p className="text-[11.5px] text-steel mt-0.5">
                          {sym}{refundPerUnit.toFixed(2)} / unit (incl. tax)
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="border-t border-line p-5 bg-offwhite flex justify-between items-center">
                <span className="text-[14px] font-semibold text-ink">Total Refund Amount</span>
                <span className="text-[16px] font-bold text-brand">
                  {sym}{Number(returnRequest.refundAmount).toFixed(2)}
                </span>
              </div>
            </div>

            {/* Return Reason and Notes */}
            <div className="rounded-lg border border-line bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-[14px] font-bold text-ink border-b border-line pb-2.5">
                Reason & Explanation
              </h3>
              <div className="space-y-3 text-[13.5px]">
                <div>
                  <span className="text-steel font-medium">Reason:</span>
                  <p className="mt-1 font-semibold text-ink">{returnRequest.reason}</p>
                </div>
                {returnRequest.notes && (
                  <div>
                    <span className="text-steel font-medium">Customer Explanation:</span>
                    <p className="mt-1 bg-grey/40 p-3 rounded-md text-ink whitespace-pre-wrap">{returnRequest.notes}</p>
                  </div>
                )}
                {returnRequest.refundDetails && (
                  <div>
                    <span className="text-steel font-medium block mb-1">Customer Refund Destination (COD):</span>
                    <p className="mt-1 bg-amber-50 border border-amber-200/60 p-3.5 rounded-lg text-ink font-semibold whitespace-pre-wrap text-[13.5px]">
                      {returnRequest.refundDetails}
                    </p>
                  </div>
                )}
                {returnRequest.transactionReference && (
                  <div>
                    <span className="text-steel font-medium block mb-1">Manual Refund Transfer Reference / UTR:</span>
                    <p className="mt-1 bg-emerald-50 border border-emerald-200 p-3.5 rounded-lg text-emerald-950 font-bold text-[13.5px]">
                      {returnRequest.transactionReference}
                    </p>
                  </div>
                )}
                {returnRequest.attachmentUrls && returnRequest.attachmentUrls.length > 0 && (
                  <div>
                    <span className="text-steel font-medium font-semibold block mb-1">Uploaded Proof (Images/Videos):</span>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-xl">
                      {returnRequest.attachmentUrls.map((url, idx) => {
                        const isVideo = url.match(/\.(mp4|webm|ogg|mov)$/i);
                        return (
                          <div key={idx} className="border border-line rounded-lg p-2 bg-grey/10">
                            {isVideo ? (
                              <video
                                src={getMediaUrl(url)}
                                controls
                                className="max-w-full h-auto rounded-lg max-h-48 mx-auto"
                              />
                            ) : (
                              <img
                                src={getMediaUrl(url)}
                                alt={`Proof ${idx + 1}`}
                                className="max-w-full h-auto rounded-lg max-h-48 mx-auto cursor-pointer hover:opacity-90 transition-opacity"
                                onClick={() => window.open(getMediaUrl(url), "_blank")}
                              />
                            )}
                            <div className="mt-1.5 text-center">
                              <a
                                href={getMediaUrl(url)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-[12px] text-brand hover:underline font-semibold"
                              >
                                View File
                              </a>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
                {returnRequest.adminNotes && (
                  <div>
                    <span className="text-steel font-medium">Administrative Notes:</span>
                    <p className="mt-1 bg-amber-50/50 border border-amber-100 p-3 rounded-md text-ink whitespace-pre-wrap">{returnRequest.adminNotes}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column details */}
          <div className="space-y-6">
            {/* Customer & Order Information cards */}
            <div className="rounded-lg border border-line bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-[14px] font-bold text-ink border-b border-line pb-2.5">
                Customer Info
              </h3>
              <div className="space-y-2 text-[13px] text-steel">
                <p>Name: <strong className="text-ink font-semibold">{returnRequest.customer.firstName} {returnRequest.customer.lastName}</strong></p>
                <p>Email: <a href={`mailto:${returnRequest.customer.email}`} className="text-brand hover:underline font-mono">{returnRequest.customer.email}</a></p>
                {returnRequest.customer.phone && <p>Phone: <strong className="text-ink font-medium">{returnRequest.customer.phone}</strong></p>}
              </div>
            </div>

            <div className="rounded-lg border border-line bg-white p-5 space-y-4 shadow-sm">
              <h3 className="text-[14px] font-bold text-ink border-b border-line pb-2.5">
                Order Info
              </h3>
              <div className="space-y-2 text-[13px] text-steel">
                <p>Order Number: <Link href={`/admin/orders/${returnRequest.order.id}?mode=edit`} className="text-brand hover:underline font-mono font-semibold">{returnRequest.order.orderNumber}</Link></p>
                <p>Order Status: <StatusBadge status={returnRequest.order.status} /></p>
                <p>Payment: <StatusBadge status={returnRequest.order.paymentStatus} /></p>
                <p>Payment Method: <span className="text-ink font-medium">{returnRequest.order.paymentMethod || "COD"}</span></p>
              </div>
            </div>

            {/* return Actions Console */}
            {["PENDING", "APPROVED"].includes(returnRequest.status) && (
              <div className="rounded-lg border border-line bg-white p-5 space-y-4 shadow-sm">
                <h3 className="text-[14px] font-bold text-ink border-b border-line pb-2.5">
                  Actions Console
                </h3>

                <div className="space-y-3.5">
                  <AdminInput
                    label="Admin Notes / Reason"
                    value={adminNotes}
                    onChange={(e) => setAdminNotes(e.target.value)}
                    placeholder="Enter notes for this action..."
                  />

                  <div className="flex flex-col gap-2 pt-1.5">
                    {returnRequest.status === "PENDING" && (
                      <button
                        onClick={() => {
                          setConfirmModal({
                            open: true,
                            title: "Approve Return",
                            message: "Are you sure you want to approve this return request?",
                            onConfirm: () => handleAction("APPROVED"),
                          });
                        }}
                        disabled={updating}
                        className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-emerald-600 px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                      >
                        <CheckCircle size={15} /> Approve Return
                      </button>
                    )}

                    {returnRequest.status === "APPROVED" && (
                      <div className="space-y-3">
                        {returnRequest.order.paymentMethod === "RAZORPAY" ? (
                          <div className="rounded-lg border border-line p-3 bg-grey/15 space-y-2">
                            <span className="text-[12.5px] font-bold text-ink block">Refund Transfer Mode:</span>
                            <div className="flex flex-col gap-2">
                              <label className="flex items-center gap-2 text-[12.5px] text-steel font-medium cursor-pointer">
                                <input
                                  type="radio"
                                  name="onlineRefundMethod"
                                  checked={onlineRefundMethod === "RAZORPAY"}
                                  onChange={() => setOnlineRefundMethod("RAZORPAY")}
                                  className="h-3.5 w-3.5 text-brand focus:ring-brand"
                                />
                                Razorpay Automatic Refund API
                              </label>
                              <label className="flex items-center gap-2 text-[12.5px] text-steel font-medium cursor-pointer">
                                <input
                                  type="radio"
                                  name="onlineRefundMethod"
                                  checked={onlineRefundMethod === "MANUAL"}
                                  onChange={() => setOnlineRefundMethod("MANUAL")}
                                  className="h-3.5 w-3.5 text-brand focus:ring-brand"
                                />
                                Offline Manual Transfer (UPI/Bank)
                              </label>
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-lg border border-amber-200 p-3 bg-amber-50/50 text-[11.5px] text-amber-800 leading-normal">
                            Note: This is a COD order. Please manually transfer the refund amount using the bank/UPI details on the left before completing this return.
                          </div>
                        )}
                        {((returnRequest.order.paymentMethod !== "RAZORPAY") || (onlineRefundMethod === "MANUAL")) && (
                          <div className="pt-1">
                            <AdminInput
                              label="Manual Transfer Ref / UTR Number"
                              value={transactionReference}
                              onChange={(e) => setTransactionReference(e.target.value)}
                              placeholder="e.g. UTR1234567890"
                            />
                          </div>
                        )}
                        <button
                          onClick={() => {
                            const isManual = returnRequest.order.paymentMethod !== "RAZORPAY" || onlineRefundMethod === "MANUAL";
                            if (isManual && !transactionReference.trim()) {
                              setConfirmModal({
                                open: true,
                                title: "Reference Required",
                                message: "Please enter the Manual Transfer Reference / UTR Number.",
                                onConfirm: null,
                                isAlertOnly: true,
                              });
                              return;
                            }
                            setConfirmModal({
                              open: true,
                              title: "Complete & Refund",
                              message: "Are you sure you want to complete this return and issue the refund?",
                              onConfirm: () => handleAction("COMPLETED"),
                            });
                          }}
                          disabled={updating}
                          className="w-full inline-flex items-center justify-center gap-1.5 rounded-md bg-brand px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-[#c3191e] disabled:opacity-50 transition"
                        >
                          <DollarSign size={15} /> Complete & Refund
                        </button>
                      </div>
                    )}

                    <button
                      onClick={() => {
                        setConfirmModal({
                          open: true,
                          title: "Reject Return",
                          message: "Are you sure you want to reject this return request?",
                          onConfirm: () => handleAction("REJECTED"),
                        });
                      }}
                      disabled={updating}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-md border border-line bg-white px-4 py-2.5 text-[13.5px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 transition"
                    >
                      <XCircle size={15} /> Reject Return
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            {/* Confirmation Modal */}
            <Modal
              open={confirmModal.open}
              onClose={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
              title={confirmModal.title}
              panelClassName="max-w-md rounded-2xl"
              footer={
                <>
                  {!confirmModal.isAlertOnly && (
                    <button
                      type="button"
                      onClick={() => setConfirmModal((prev) => ({ ...prev, open: false }))}
                      className="px-4 py-2 text-[13px] font-semibold text-[#6B7280] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F3F4F6] transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmModal((prev) => ({ ...prev, open: false }));
                      if (confirmModal.onConfirm) confirmModal.onConfirm();
                    }}
                    className="px-4 py-2 text-[13px] font-semibold text-white bg-brand rounded-lg hover:bg-[#c3191e] transition-colors"
                  >
                    {confirmModal.isAlertOnly ? "OK" : "Confirm"}
                  </button>
                </>
              }
            >
              <div className="p-6 text-[14px] text-steel whitespace-pre-wrap leading-relaxed">
                {confirmModal.message}
              </div>
            </Modal>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
