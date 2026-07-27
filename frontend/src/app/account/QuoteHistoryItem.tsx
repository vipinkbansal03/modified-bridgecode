"use client";

import { useState } from "react";
import { ChevronDown, CheckCircle, XCircle } from "lucide-react";
import { acceptCustomerQuote, declineCustomerQuote, type CustomerQuoteSummary } from "@/services/customerApi";
import { useToast } from "@/components/ui/ToastProvider";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";

interface QuoteHistoryItemProps {
  quote: CustomerQuoteSummary;
  expanded: boolean;
  onToggle: () => void;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
  }).format(new Date(value));
}

function money(
  quote: CustomerQuoteSummary,
  amount: string | number | undefined,
) {
  const value = Number(amount ?? 0);
  const symbol = quote.currency?.symbol ?? "";

  return `${symbol}${value.toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })}`;
}

function getStatusBadgeClass(status: string) {
  switch (status) {
    case "PENDING":
      return "border-yellow-300 bg-yellow-50 text-yellow-700";
    case "REVIEWING":
    case "SENT":
      return "border-blue-300 bg-blue-50 text-blue-700";
    case "ACCEPTED":
      return "border-emerald-300 bg-emerald-50 text-emerald-700";
    case "CONVERTED":
      return "border-green-300 bg-green-50 text-green-700";
    case "DECLINED":
    case "CANCELLED":
      return "border-red-300 bg-red-50 text-red-700";
    case "EXPIRED":
      return "border-gray-300 bg-gray-100 text-gray-700";
    default:
      return "border-line bg-grey text-steel";
  }
}

export default function QuoteHistoryItem({
  quote,
  expanded,
  onToggle,
}: QuoteHistoryItemProps) {
  const { showToast } = useToast();
  const qc = useQueryClient();
  const [loading, setLoading] = useState(false);

  const canAction = quote.status === "SENT" || quote.status === "REVIEWING" || quote.status === "PENDING";

  async function handleAccept(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      await acceptCustomerQuote(quote.id);
      showToast("Quote accepted successfully!");
      qc.invalidateQueries({ queryKey: ["customer-quotes"] });
    } catch {
      showToast("Failed to accept quote.", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecline(e: React.MouseEvent) {
    e.stopPropagation();
    setLoading(true);
    try {
      await declineCustomerQuote(quote.id);
      showToast("Quote declined.");
      qc.invalidateQueries({ queryKey: ["customer-quotes"] });
    } catch {
      showToast("Failed to decline quote.", "error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <article className="py-4 first:pt-0 last:pb-0">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full flex-col gap-3 text-left focus:outline-none sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-semibold text-ink">{quote.quoteNumber}</p>

            <span
              className={cn(
                "inline-flex rounded-pill border px-3 py-1 text-[11px] font-semibold uppercase tracking-wide",
                getStatusBadgeClass(quote.status),
              )}
            >
              {quote.status.replace(/_/g, " ")}
            </span>
          </div>

          <p className="mt-1 text-[13px] text-steel">
            {formatDate(quote.createdAt)} · {quote.items.length}{" "}
            {quote.items.length === 1 ? "item" : "items"}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <p className="text-[15px] font-semibold text-ink">
            {money(quote, quote.total)}
          </p>

          <ChevronDown
            size={16}
            className={cn(
              "text-steel transition-transform",
              expanded && "rotate-180",
            )}
          />
        </div>
      </button>

      {expanded && (
        <div className="mt-4 rounded-md border border-line bg-offwhite p-4">
          <div className="space-y-3">
            {quote.items.map((item) => (
              <div
                key={item.id}
                className="flex flex-col gap-2 border-b border-line pb-3 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
              >
                <div>
                  <p className="text-[14px] font-semibold text-ink">
                    {item.title}
                  </p>

                  <p className="mt-1 text-[12.5px] text-steel">
                    {item.variant?.title ?? item.sku ?? "Variant"}
                  </p>

                  {item.sku && (
                    <p className="mt-0.5 text-[12px] text-steel-2">
                      SKU: {item.sku}
                    </p>
                  )}
                </div>

                <div className="text-[13px] text-steel sm:text-right">
                  <p>
                    Qty {item.quantity} × {money(quote, item.unitPrice)}
                  </p>

                  <p className="mt-1 font-semibold text-ink">
                    {money(quote, item.total)}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 space-y-2 border-t border-line pt-4 text-[13.5px]">
            <div className="flex justify-between">
              <span className="text-steel">Subtotal</span>
              <strong className="text-ink">
                {money(quote, quote.subtotal)}
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-steel">Shipping</span>
              <strong className="text-ink">
                {money(quote, quote.shippingCharge)}
              </strong>
            </div>

            <div className="flex justify-between">
              <span className="text-steel">Discount</span>
              <strong className="text-ink">
                {money(quote, quote.discount)}
              </strong>
            </div>

            <div className="flex justify-between border-t border-line pt-2 text-[15px]">
              <span className="font-semibold text-ink">Total</span>
              <strong className="text-ink">{money(quote, quote.total)}</strong>
            </div>
          </div>

          {quote.notes && (
            <div className="mt-4 border-t border-line pt-4">
              <h4 className="text-sm font-semibold text-ink">Notes</h4>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-steel">
                {quote.notes}
              </p>
            </div>
          )}

          {canAction && (
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-4">
              <button
                type="button"
                disabled={loading}
                onClick={handleAccept}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition-all"
              >
                <CheckCircle size={14} /> Accept Quote
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={handleDecline}
                className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-white px-4 py-2 text-xs font-semibold text-red-600 hover:bg-red-50 disabled:opacity-50 transition-all"
              >
                <XCircle size={14} /> Decline Quote
              </button>
            </div>
          )}

          {quote.status === "ACCEPTED" && (
            <div className="mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
              <p className="text-sm font-semibold text-emerald-700">
                ✓ Quote Accepted
              </p>
              <p className="mt-0.5 text-xs text-emerald-600">
                You have accepted this quote. Our team will generate your final order shortly.
              </p>
            </div>
          )}

          {quote.status === "DECLINED" && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-3 py-2">
              <p className="text-sm font-semibold text-red-700">
                ✕ Quote Declined
              </p>
            </div>
          )}

          {quote.status === "CONVERTED" && (
            <div className="mt-4 rounded-md border border-green-200 bg-green-50 px-3 py-2">
              <p className="text-sm font-semibold text-green-700">
                ✓ Converted to Order
              </p>
              <p className="mt-1 text-sm text-green-700">
                This quote has already been converted into an order.
              </p>
            </div>
          )}

          {quote.expiresAt && (
            <div className="mt-4 border-t border-line pt-4">
              <h4 className="text-sm font-semibold text-ink">Valid Until</h4>
              <p className="mt-2 text-sm text-steel">
                {formatDate(quote.expiresAt)}
              </p>
            </div>
          )}
        </div>
      )}
    </article>
  );
}
