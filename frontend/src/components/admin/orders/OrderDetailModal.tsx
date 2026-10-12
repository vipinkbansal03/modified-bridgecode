"use client";

import { useState } from "react";
import { Download, AlertTriangle, User, MapPin, CreditCard, Package, CheckCircle2 } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { useAdminOrder } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { formatDateTime } from "@/utils/formatDate";

export interface OrderDetailModalProps {
  open: boolean;
  onClose: () => void;
  orderId: string | null;
}

export function OrderDetailModal({ open, onClose, orderId }: OrderDetailModalProps) {
  const { showToast } = useToast();
  const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);

  const { data: order, isLoading } = useAdminOrder(orderId || "") as {
    data: any | undefined;
    isLoading: boolean;
  };

  const sym = order?.currency?.symbol ?? "$";

  const handleDownloadInvoice = async () => {
    if (!order) return;
    setIsDownloadingInvoice(true);
    try {
      const res = await adminApi.get(`/orders/${order.id}/invoice`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      const invNumber = order.orderNumber ? order.orderNumber : order.id.slice(-8);
      link.download = `Invoice-${invNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Invoice generation failed"), "error");
    } finally {
      setIsDownloadingInvoice(false);
    }
  };

  const address = order?.shippingAddress as Record<string, any> | undefined;
  const billingAddress = order?.billingAddress as Record<string, any> | undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      bodyClassName="px-7 py-5 md:px-8 md:py-6"
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[17px] text-[#1A1A1A]">
            {order ? `Order #${order.orderNumber}` : "Order Details"}
          </span>
          {order?.isTest && (
            <span className="rounded-sm bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 border border-amber-200">
              TEST ORDER
            </span>
          )}
        </div>
      }
      subtitle={
        order ? (
          <span className="text-[12.5px] text-[#6B6B6B]">
            Placed on {formatDateTime(order.createdAt)}
          </span>
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleDownloadInvoice}
            disabled={!order || isDownloadingInvoice}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Download size={14} />
            {isDownloadingInvoice ? "Downloading..." : "Download Invoice"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-[#1A1A1A] px-4 py-1.5 text-[12.5px] font-medium text-white hover:bg-neutral-800 transition-colors shadow-2xs cursor-pointer"
          >
            Close
          </button>
        </div>
      }
    >
      {isLoading ? (
        <div className="py-12 text-center text-[13px] text-[#888]">
          <div className="inline-block animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-800 w-6 h-6 mb-2" />
          <p>Loading order details...</p>
        </div>
      ) : !order ? (
        <div className="py-8 text-center text-[13px] text-[#888]">
          Order information could not be found.
        </div>
      ) : (
        <div className="space-y-4 text-[13px]">
          {/* Archived notice if soft-deleted */}
          {order.deletedAt && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[12.5px] text-amber-800 shadow-2xs">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Archived Record:</span> This order was soft-deleted on{" "}
                  <span className="font-semibold">{formatDateTime(order.deletedAt)}</span>. It is retained for historical audits, reporting, and financial compliance.
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-900">
                Archived
              </span>
            </div>
          )}

          {/* Quick status bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#F9F9F9] border border-[#EBEBEB]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Order Status</div>
              <div className="mt-1"><StatusBadge status={order.status} /></div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Payment Status</div>
              <div className="mt-1"><StatusBadge status={order.paymentStatus} /></div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Payment Method</div>
              <div className="mt-1 font-medium text-[#1A1A1A] truncate">{order.paymentMethod || order.paymentProvider || "-"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Payment / Ref ID</div>
              <div className="mt-1 font-mono text-[11.5px] text-[#555] truncate" title={order.paymentId || "-"}>
                {order.paymentId || (order.paymentTransactions?.[0]?.gatewayPaymentId) || "-"}
              </div>
            </div>
          </div>

          {/* Customer & Shipping 2/3-col info */}
          <div className={`grid grid-cols-1 ${billingAddress ? "sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2"} gap-3.5`}>
            {/* Customer Details */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] pb-2 border-b border-[#F0F0F0]">
                <User size={14} className="text-[#666]" />
                <span>Customer Details</span>
              </div>
              <div className="mt-2.5 space-y-1 text-[#444]">
                <div className="font-semibold text-[#111]">{order.customerName || "Guest User"}</div>
                <div className="text-[12px] text-[#666]">{order.customerEmail || "-"}</div>
                {order.customerPhone && <div className="text-[12px] text-[#666]">{order.customerPhone}</div>}
                {order.companyName && <div className="text-[12px] text-[#777] font-medium">Company: {order.companyName}</div>}
              </div>
            </div>

            {/* Shipping Address */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] pb-2 border-b border-[#F0F0F0]">
                <MapPin size={14} className="text-[#666]" />
                <span>Shipping Address</span>
              </div>
              <div className="mt-2.5 text-[12.5px] text-[#444] space-y-0.5">
                {address ? (
                  <>
                    {address.fullName && <div className="font-semibold text-[#111]">{address.fullName}</div>}
                    {address.phone && <div className="text-[12px] text-[#666]">{address.phone}</div>}
                    {address.addressLine1 && <div>{address.addressLine1}</div>}
                    {address.addressLine2 && <div>{address.addressLine2}</div>}
                    <div>
                      {[address.city, address.state, address.postalCode || address.pincode].filter(Boolean).join(", ")}
                    </div>
                    <div className="font-medium text-[#111]">{order.country?.name || address.country || address.countryCode || "-"}</div>
                  </>
                ) : (
                  <div className="text-[#888]">No address recorded</div>
                )}
                {order.trackingNumber && (
                  <div className="pt-1.5 text-[11.5px] text-[#0F6CBD] font-mono">
                    Tracking: {order.trackingNumber}
                  </div>
                )}
              </div>
            </div>

            {/* Billing Address */}
            {billingAddress && (
              <div className="rounded-xl border border-[#E6E6E6] bg-white p-3.5">
                <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] pb-2 border-b border-[#F0F0F0]">
                  <CreditCard size={14} className="text-[#666]" />
                  <span>Billing Address</span>
                </div>
                <div className="mt-2.5 text-[12.5px] text-[#444] space-y-0.5">
                  {billingAddress.fullName && (
                    <div className="font-semibold text-[#111]">{billingAddress.fullName}</div>
                  )}
                  {billingAddress.phone && (
                    <div className="text-[12px] text-[#666]">{billingAddress.phone}</div>
                  )}
                  {billingAddress.addressLine1 && <div>{billingAddress.addressLine1}</div>}
                  {billingAddress.addressLine2 && <div>{billingAddress.addressLine2}</div>}
                  <div>
                    {[billingAddress.city, billingAddress.state, billingAddress.postalCode || billingAddress.pincode].filter(Boolean).join(", ")}
                  </div>
                  <div className="font-medium text-[#111]">{billingAddress.country || billingAddress.countryCode || "-"}</div>
                </div>
              </div>
            )}
          </div>

          {/* Items Table */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden">
            <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] p-3 border-b border-[#F0F0F0] bg-[#FAFAFA]">
              <Package size={14} className="text-[#666]" />
              <span>Order Items ({order.items?.length || 0})</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#EBEBEB] bg-[#F7F7F7] text-[11px] uppercase tracking-wider font-semibold text-[#777]">
                    <th className="px-3.5 py-2">Item</th>
                    <th className="px-3 py-2">SKU</th>
                    <th className="px-3 py-2 text-center">Qty</th>
                    <th className="px-3 py-2 text-right">Price</th>
                    <th className="px-3.5 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0F0F0]">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item: any) => (
                      <tr key={item.id} className="hover:bg-[#FAFAFA]">
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-[#1A1A1A]">{item.title || item.product?.title}</div>
                          {item.variant?.title && (
                            <div className="text-[11px] text-[#777]">{item.variant.title}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-[#666]">{item.sku || "-"}</td>
                        <td className="px-3 py-2.5 text-center font-medium">{item.quantity}</td>
                        <td className="px-3 py-2.5 text-right font-medium text-[#555]">
                          {sym}{Number(item.unitPrice || 0).toFixed(2)}
                        </td>
                        <td className="px-3.5 py-2.5 text-right font-semibold text-[#111]">
                          {sym}{Number(item.total || 0).toFixed(2)}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="p-4 text-center text-[#888]">
                        No item lines found.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pricing breakdown */}
          <div className="flex justify-end">
            <div className="w-full sm:w-[320px] rounded-xl border border-[#E6E6E6] bg-white p-3.5 space-y-1.5 text-[12.5px]">
              <div className="flex justify-between text-[#666]">
                <span>Subtotal</span>
                <span>{sym}{Number(order.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(order.discount ?? 0) > 0 && (
                <div className="flex justify-between text-[#2A6A40]">
                  <span>Discount {order.couponCode ? `(${order.couponCode})` : ""}</span>
                  <span>-{sym}{Number(order.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#666]">
                <span>Tax {order.taxLabel ? `(${order.taxLabel})` : ""}</span>
                <span>{sym}{Number(order.taxAmount || 0).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#666]">
                <span>Shipping</span>
                <span>{sym}{Number(order.shippingCharge || 0).toFixed(2)}</span>
              </div>
              <div className="pt-2 mt-1 border-t border-[#EBEBEB] flex justify-between font-bold text-[14.5px] text-[#111]">
                <span>Total Amount</span>
                <span>{sym}{Number(order.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
