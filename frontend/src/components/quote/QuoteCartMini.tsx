"use client";

import { useState } from "react";
import { ShoppingCart, FileText, ChevronRight } from "lucide-react";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { QuoteCartDrawer } from "./QuoteCartDrawer";

function fmt(sym: string, val: number) {
  return `${sym}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function QuoteCartMini() {
  const { items, totals } = useQuoteCart();
  const [drawerOpen, setDrawerOpen] = useState(false);

  if (!items.length) return null;

  return (
    <>
      {/* Desktop sticky sidebar */}
      <div className="hidden lg:block fixed right-5 top-1/2 z-50 -translate-y-1/2">
        <div className="w-[220px] rounded-xl border border-[#E6E6E6] bg-white shadow-lg overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#F0F0F0] bg-[#FAFAFA] px-4 py-3">
            <div className="relative">
              <ShoppingCart size={16} className="text-[#E31E24]" />
              <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E31E24] text-[8px] font-bold text-white">
                {items.length}
              </span>
            </div>
            <span className="text-[12.5px] font-semibold text-ink">Quote Cart</span>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            <div className="flex justify-between text-[12px] text-[#6B6B6B]">
              <span>Variants</span>
              <span className="font-medium text-ink">{items.length}</span>
            </div>
            <div className="flex justify-between text-[12px] text-[#6B6B6B]">
              <span>Total units</span>
              <span className="font-medium text-ink">{totals.totalQuantity}</span>
            </div>
            <div className="flex justify-between text-[12px] text-[#6B6B6B]">
              <span>Est. value</span>
              <span className="font-semibold text-ink">{fmt(totals.currencySymbol, totals.grandTotal)}</span>
            </div>
            {totals.discountPercentage > 0 && (
              <div className="rounded bg-emerald-50 px-2 py-1 text-[10.5px] font-medium text-emerald-700">
                {totals.discountPercentage}% volume discount applied
              </div>
            )}
          </div>
          <div className="border-t border-[#F0F0F0] p-3 space-y-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded bg-[#E31E24] py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B]"
            >
              <FileText size={13} />
              Submit RFQ
            </button>
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex w-full items-center justify-center gap-1 rounded border border-[#E6E6E6] py-1.5 text-[12px] font-medium text-[#6B6B6B] hover:bg-[#F5F5F5]"
            >
              View Quote
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden border-t border-[#E6E6E6] bg-white px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <ShoppingCart size={18} className="text-[#E31E24]" />
              <span className="absolute -right-1.5 -top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#E31E24] text-[9px] font-bold text-white">
                {items.length}
              </span>
            </div>
            <div>
              <p className="text-[12.5px] font-semibold text-ink">
                {items.length} {items.length === 1 ? "variant" : "variants"} — {totals.totalQuantity} units
              </p>
              <p className="text-[11.5px] text-[#9A9A9A]">
                {fmt(totals.currencySymbol, totals.grandTotal)}
                {totals.discountPercentage > 0 && (
                  <span className="ml-1 text-emerald-600">({totals.discountPercentage}% off)</span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
          >
            View Quote
          </button>
        </div>
      </div>

      <QuoteCartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
