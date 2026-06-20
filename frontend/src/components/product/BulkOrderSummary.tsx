"use client";

import { ShoppingCart, Tag, CheckCircle } from "lucide-react";
import { applyDiscount, nextDiscountTier, VOLUME_TIERS } from "@/utils/discountRules";

interface Props {
  quantityMap: Record<string, number>;
  priceMap: Record<string, number>;
  currencySymbol: string;
  onAddToQuote: () => void;
  added: boolean;
}

function fmt(sym: string, val: number) {
  return `${sym}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function BulkOrderSummary({ quantityMap, priceMap, currencySymbol, onAddToQuote, added }: Props) {
  const subtotal = Object.entries(quantityMap).reduce((sum, [vid, qty]) => {
    return sum + (priceMap[vid] ?? 0) * qty;
  }, 0);

  const totalQty = Object.values(quantityMap).reduce((s, q) => s + q, 0);
  const { percentage, amount, grandTotal } = applyDiscount(subtotal);
  const next = nextDiscountTier(subtotal);
  const hasItems = totalQty > 0;

  return (
    <div className="mt-6 rounded-lg border border-[#E6E6E6] bg-white p-5">
      {/* Volume discount tiers info */}
      <div className="mb-4 flex flex-wrap gap-2">
        {VOLUME_TIERS.map((t) => (
          <span
            key={t.minValue}
            className={`rounded border px-2.5 py-1 text-[11.5px] font-medium ${
              percentage >= t.percentage
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : "border-[#E6E6E6] text-[#9A9A9A]"
            }`}
          >
            <Tag size={10} className="mr-1 inline -mt-px" />
            {t.percentage}% off orders above {currencySymbol}
            {(t.minValue / 1000).toFixed(0)}k
          </span>
        ))}
      </div>

      {/* Progress to next discount */}
      {next && subtotal > 0 && (
        <div className="mb-4">
          <div className="mb-1 flex justify-between text-[11.5px] text-[#9A9A9A]">
            <span>
              Add {fmt(currencySymbol, next.minValue - subtotal)} more for {next.percentage}% off
            </span>
            <span>
              {fmt(currencySymbol, subtotal)} / {fmt(currencySymbol, next.minValue)}
            </span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-[#F0F0F0]">
            <div
              className="h-full rounded-full bg-[#E31E24] transition-all"
              style={{ width: `${Math.min(100, (subtotal / next.minValue) * 100).toFixed(1)}%` }}
            />
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="space-y-1.5 border-t border-[#F0F0F0] pt-4">
        <div className="flex justify-between text-[13px] text-[#6B6B6B]">
          <span>
            {totalQty} {totalQty === 1 ? "unit" : "units"} selected
          </span>
          <span>{fmt(currencySymbol, subtotal)}</span>
        </div>
        {percentage > 0 && (
          <div className="flex justify-between text-[13px] text-emerald-600">
            <span>Volume discount ({percentage}%)</span>
            <span>−{fmt(currencySymbol, amount)}</span>
          </div>
        )}
        <div className="flex justify-between text-[15px] font-semibold text-ink">
          <span>Estimated Total</span>
          <span>{fmt(currencySymbol, grandTotal)}</span>
        </div>
      </div>

      {/* CTA */}
      <button
        type="button"
        onClick={onAddToQuote}
        disabled={!hasItems || added}
        className={`mt-4 flex w-full items-center justify-center gap-2 rounded py-2.5 text-[14px] font-semibold transition-colors ${
          added
            ? "bg-emerald-600 text-white cursor-default"
            : hasItems
            ? "bg-[#E31E24] text-white hover:bg-[#B5151B]"
            : "bg-[#F0F0F0] text-[#9A9A9A] cursor-not-allowed"
        }`}
      >
        {added ? (
          <>
            <CheckCircle size={16} />
            Added to Quote
          </>
        ) : (
          <>
            <ShoppingCart size={16} />
            Add Selected Variants to Quote
          </>
        )}
      </button>
      {!hasItems && (
        <p className="mt-2 text-center text-[11.5px] text-[#9A9A9A]">Enter quantities above to build your order</p>
      )}
    </div>
  );
}
