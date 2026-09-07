"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Download,
  AlertTriangle,
  User,
  MapPin,
  Package,
  ExternalLink,
  MessageSquare,
  FileText,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { useAdminQuote } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { formatDateTime, formatDate } from "@/utils/formatDate";

export interface QuoteDetailModalProps {
  open: boolean;
  onClose: () => void;
  quoteId: string | null;
}

export function QuoteDetailModal({ open, onClose, quoteId }: QuoteDetailModalProps) {
  const { showToast } = useToast();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const { data: quote, isLoading } = useAdminQuote(quoteId || "") as {
    data: any | undefined;
    isLoading: boolean;
  };

  const sym = quote?.currency?.symbol ?? "$";

  const handleDownloadPdf = async () => {
    if (!quote) return;
    setIsDownloadingPdf(true);
    try {
      const res = await adminApi.get(`/quotes/${quote.id}/pdf`, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Quote-${quote.quoteNumber}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download Quote PDF"), "error");
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  const address = quote?.shippingAddress as Record<string, any> | undefined;

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="3xl"
      bodyClassName="px-7 py-5 md:px-8 md:py-6"
      title={
        <div className="flex items-center gap-2.5">
          <span className="font-bold text-[17px] text-[#1A1A1A]">
            {quote ? `Quote #${quote.quoteNumber}` : "Quote Details"}
          </span>
          {quote?.status === "CONVERTED" && (
            <span className="rounded-sm bg-emerald-50 px-2 py-0.5 text-[10.5px] font-semibold text-emerald-700 border border-emerald-200">
              CONVERTED
            </span>
          )}
        </div>
      }
      subtitle={
        quote ? (
          <span className="text-[12.5px] text-[#6B6B6B]">
            Requested on {formatDateTime(quote.createdAt)}
          </span>
        ) : undefined
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <button
            type="button"
            onClick={handleDownloadPdf}
            disabled={!quote || isDownloadingPdf}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3.5 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5] disabled:opacity-50 transition-colors shadow-2xs cursor-pointer"
          >
            <Download size={14} />
            {isDownloadingPdf ? "Downloading..." : "Download Quote PDF"}
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
          <p>Loading quote details...</p>
        </div>
      ) : !quote ? (
        <div className="py-8 text-center text-[13px] text-[#888]">
          Quote information could not be found.
        </div>
      ) : (
        <div className="space-y-4 text-[13px]">
          {/* Archived notice if soft-deleted */}
          {quote.deletedAt && (
            <div className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 p-3 text-[12.5px] text-amber-800 shadow-2xs">
              <div className="flex items-start gap-2">
                <AlertTriangle size={16} className="text-amber-600 mt-0.5 shrink-0" />
                <div>
                  <span className="font-semibold">Archived Record:</span> This quote was archived on{" "}
                  <span className="font-semibold">{formatDateTime(quote.deletedAt)}</span>. Retained for audit and quote inquiry history.
                </div>
              </div>
              <span className="shrink-0 rounded-full bg-amber-200/80 px-2.5 py-0.5 text-[10.5px] font-bold uppercase tracking-wider text-amber-900">
                Archived
              </span>
            </div>
          )}

          {/* Converted Order Banner */}
          {quote.convertedOrderId && (
            <div className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50/80 p-3 text-[12.5px] text-emerald-800">
              <div className="flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
                <span>
                  This quote was converted into Order ID{" "}
                  <code className="font-mono font-semibold">{quote.convertedOrderId}</code>.
                </span>
              </div>
              <Link
                href={`/admin/orders/${quote.convertedOrderId}`}
                className="inline-flex items-center gap-1 font-semibold text-emerald-700 hover:underline"
              >
                View Order <ExternalLink size={12} />
              </Link>
            </div>
          )}

          {/* Quick status bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 rounded-xl bg-[#F9F9F9] border border-[#EBEBEB]">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Status</div>
              <div className="mt-1"><StatusBadge status={quote.status} /></div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Country</div>
              <div className="mt-1 font-medium text-[#1A1A1A] truncate">
                {quote.country ? `${quote.country.code} - ${quote.country.name}` : "—"}
              </div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Currency</div>
              <div className="mt-1 font-medium text-[#1A1A1A]">{quote.currency?.code || "USD"}</div>
            </div>
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A8A8A]">Expires At</div>
              <div className="mt-1 text-[12px] text-[#555]">
                {quote.expiresAt ? formatDate(quote.expiresAt) : "No expiry"}
              </div>
            </div>
          </div>

          {/* Customer & Shipping 2-col info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Customer Details */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-3.5">
              <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] pb-2 border-b border-[#F0F0F0]">
                <User size={14} className="text-[#666]" />
                <span>Customer Details</span>
              </div>
              <div className="mt-2.5 space-y-1 text-[#444]">
                <div className="font-semibold text-[#111]">{quote.customerName || "—"}</div>
                <div className="text-[12px] text-[#666]">{quote.customerEmail || "—"}</div>
                {quote.customerPhone && <div className="text-[12px] text-[#666]">{quote.customerPhone}</div>}
                {quote.companyName && (
                  <div className="text-[12px] text-[#777] font-medium">Company: {quote.companyName}</div>
                )}
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
                    {address.street && <div>{address.street}</div>}
                    {address.addressLine1 && <div>{address.addressLine1}</div>}
                    {address.addressLine2 && <div>{address.addressLine2}</div>}
                    <div>
                      {[address.city, address.state, address.postalCode || address.pincode]
                        .filter(Boolean)
                        .join(", ")}
                    </div>
                    <div className="font-medium text-[#111]">
                      {quote.country?.name || address.country || "—"}
                    </div>
                  </>
                ) : (
                  <div className="text-[#888]">No shipping address recorded</div>
                )}
              </div>
            </div>
          </div>

          {/* Customer / Admin Notes if any */}
          {quote.notes && (
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-3.5 space-y-1">
              <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] pb-1.5 border-b border-[#F0F0F0]">
                <MessageSquare size={14} className="text-[#666]" />
                <span>Customer Notes</span>
              </div>
              <p className="text-[12.5px] text-[#555] leading-relaxed pt-1">{quote.notes}</p>
            </div>
          )}

          {/* Items Table */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden">
            <div className="flex items-center gap-1.5 font-semibold text-[#1A1A1A] p-3 border-b border-[#F0F0F0] bg-[#FAFAFA]">
              <Package size={14} className="text-[#666]" />
              <span>Quote Items ({quote.items?.length || 0})</span>
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
                  {quote.items && quote.items.length > 0 ? (
                    quote.items.map((item: any) => (
                      <tr key={item.id} className="hover:bg-[#FAFAFA]">
                        <td className="px-3.5 py-2.5">
                          <div className="font-medium text-[#1A1A1A]">
                            {item.title || item.product?.title}
                          </div>
                          {item.variant?.title && (
                            <div className="text-[11px] text-[#777]">{item.variant.title}</div>
                          )}
                        </td>
                        <td className="px-3 py-2.5 font-mono text-[11.5px] text-[#666]">
                          {item.sku || "—"}
                        </td>
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
                <span>{sym}{Number(quote.subtotal || 0).toFixed(2)}</span>
              </div>
              {Number(quote.discount ?? 0) > 0 && (
                <div className="flex justify-between text-[#2A6A40]">
                  <span>Discount</span>
                  <span>-{sym}{Number(quote.discount).toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-[#666]">
                <span>Shipping</span>
                <span>{sym}{Number(quote.shippingCharge || 0).toFixed(2)}</span>
              </div>
              <div className="pt-2 mt-1 border-t border-[#EBEBEB] flex justify-between font-bold text-[14.5px] text-[#111]">
                <span>Total Amount</span>
                <span>{sym}{Number(quote.total || 0).toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
