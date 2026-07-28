"use client";

import { useState, useEffect } from "react";
import { ShoppingCart, FileText, ChevronRight, Minus, X } from "lucide-react";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { useQuoteCartUI } from "@/contexts/QuoteCartUIContext";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { QuoteCartDrawer } from "./QuoteCartDrawer";

function fmt(sym: string, val: number) {
  return `${sym}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function QuoteCartMini() {
  const { isReady: isCartReady, items, totals } = useQuoteCart();
  const { isMinimized, isClosed, minimize, restore, close, open, isReady } =
    useQuoteCartUI();

  const [drawerOpen, setDrawerOpen] = useState(false);
  const { t } = useStaticTranslations();
  const hasUnavailableItems = items.some((item) => item.priceUnavailable);

  useEffect(() => {
    if (!isCartReady) return;

    if (items.length === 0 && isMinimized) {
      restore();
    }

    if (items.length === 0) {
      open();
    }
  }, [isCartReady, items.length, isMinimized, restore, open]);

  if (!isReady) return null;

  if (!items.length) return null;

  if (isClosed) return null;

  if (isMinimized) {
    return (
      <>
        <div className="hidden lg:block fixed right-5 top-1/2 z-50 -translate-y-1/2">
          <div className="w-[220px] rounded-xl border border-[#E6E6E6] bg-white shadow-lg overflow-hidden">
            <button
              onClick={restore}
              className="flex w-full items-center justify-between bg-[#FAFAFA] px-4 py-3 hover:bg-[#F5F5F5]"
            >
              <div className="flex items-center gap-2">
                <div className="relative">
                  <FileText size={16} className="text-[#E31E24]" />
                  <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E31E24] text-[8px] font-bold text-white">
                    {items.length}
                  </span>
                </div>

                <span className="text-[12.5px] font-semibold text-ink">
                  {t("ui.quote.cartTitle")}
                </span>
              </div>

              <ChevronRight size={16} className="-rotate-90 text-[#6B6B6B]" />
            </button>
          </div>
        </div>

        <QuoteCartDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      </>
    );
  }

  return (
    <>
      {/* Desktop sticky sidebar */}
      <div className="hidden lg:block fixed right-5 top-1/2 z-50 -translate-y-1/2">
        <div className="w-[220px] rounded-xl border border-[#E6E6E6] bg-white shadow-lg overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#F0F0F0] bg-[#FAFAFA] px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="relative">
                <FileText size={16} className="text-[#E31E24]" />
                <span className="absolute -right-1.5 -top-1.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#E31E24] text-[8px] font-bold text-white">
                  {items.length}
                </span>
              </div>

              <span className="text-[12.5px] font-semibold text-ink">
                {t("ui.quote.cartTitle")}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={minimize}
                className="rounded p-1 text-[#6B6B6B] hover:bg-gray-100"
                aria-label="Minimize Quote Cart"
              >
                <Minus size={16} />
              </button>

              <button
                onClick={close}
                className="rounded p-1 text-[#6B6B6B] hover:bg-gray-100"
                aria-label="Close Quote Cart"
              >
                <X size={16} />
              </button>
            </div>
          </div>
          <div className="px-4 py-3 space-y-1.5">
            {hasUnavailableItems && (
              <div className="rounded border border-red-200 bg-red-50 px-2 py-2">
                <p className="text-[11px] font-semibold text-red-700">
                  Price unavailable
                </p>

                <p className="mt-1 text-[10px] text-red-600">
                  Selected country has no configured pricing.
                </p>
              </div>
            )}
            <div className="flex justify-between text-[12px] text-[#6B6B6B]">
              <span>{t("ui.quote.variants")}</span>
              <span className="font-medium text-ink">{items.length}</span>
            </div>
            <div className="flex justify-between text-[12px] text-[#6B6B6B]">
              <span>{t("ui.quote.totalUnits")}</span>
              <span className="font-medium text-ink">
                {totals.totalQuantity}
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-[#6B6B6B]">
              <span>{t("ui.quote.estimatedValue")}</span>
              <span className="font-semibold text-ink">
                {hasUnavailableItems || totals.grandTotal <= 0
                  ? "Upon Request"
                  : fmt(totals.currencySymbol, totals.grandTotal)}
              </span>
            </div>
            {!hasUnavailableItems && totals.grandTotal > 0 && totals.discountPercentage > 0 && (
              <div className="rounded bg-emerald-50 px-2 py-1 text-[10.5px] font-medium text-emerald-700">
                {t("ui.quote.volumeDiscountApplied", {
                  percent: totals.discountPercentage,
                })}
              </div>
            )}
          </div>

          <div className="p-4 pt-0 space-y-2">
            <button
              onClick={() => setDrawerOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#E31E24] py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              <FileText size={15} />
              {t("ui.quote.submitRfq")}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile sticky bar */}
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
                {t("ui.quote.mobileSummary", {
                  variants: items.length,
                  variantLabel:
                    items.length === 1
                      ? t("ui.quote.variantSingular")
                      : t("ui.quote.variantPlural"),
                  units: totals.totalQuantity,
                })}
              </p>
              <p className="text-[11.5px] text-[#9A9A9A]">
                {hasUnavailableItems || totals.grandTotal <= 0
                  ? "Price Upon Request"
                  : fmt(totals.currencySymbol, totals.grandTotal)}
                {!hasUnavailableItems && totals.grandTotal > 0 && totals.discountPercentage > 0 && (
                  <span className="ml-1 text-emerald-600">
                    (
                    {t("ui.quote.discountOff", {
                      percent: totals.discountPercentage,
                    })}
                    )
                  </span>
                )}
              </p>
            </div>
          </div>
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded bg-[#E31E24] px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
          >
            {t("ui.quote.viewQuote")}
          </button>
        </div>
      </div>

      <QuoteCartDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </>
  );
}
