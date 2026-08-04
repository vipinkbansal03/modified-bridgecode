"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

function formatMoney(symbol: string, amount: number) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  const val = Number(amount);
  const hasDecimals = Math.abs(val % 1) > 0.001;
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

export function CartDrawer() {
  const { items, totals, isOpen, closeCart, updateQuantity, removeItem } =
    useCart();
  const { t } = useStaticTranslations();
  const hasUnavailableItems = items.some(
    (item) => item.priceUnavailable || item.isOutOfStock || item.isInsufficientStock || item.hasPaymentConflict,
  );

  // Lock body scroll when Cart Drawer is open
  useEffect(() => {
    if (isOpen) {
      const originalStyle = window.getComputedStyle(document.body).overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isOpen]);

  // Close Cart Drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        closeCart();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeCart]);

  return (
    <>
      {/* Backdrop overlay with smooth fade transition */}
      <div
        aria-hidden="true"
        onClick={closeCart}
        className={`fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px] transition-opacity duration-300 ease-in-out ${
          isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      />

      {/* Slide-out Drawer Panel with smooth slide transition */}
      <aside
        className={`fixed right-0 top-0 z-[80] flex h-screen w-full max-w-[420px] flex-col bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand" />
            <div>
              <p className="text-[15px] font-semibold text-ink">
                {t("ui.cart.title")}
              </p>
              <p className="text-[12px] text-steel">
                {totals.itemCount}{" "}
                {totals.itemCount === 1
                  ? t("ui.cart.itemSingular")
                  : t("ui.cart.itemPlural")}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label={t("ui.cart.close")}
            onClick={closeCart}
            className="rounded-full border border-line p-2 text-ink hover:border-brand hover:text-brand"
          >
            <X size={16} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-5">
          {hasUnavailableItems && (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 p-3">
              <p className="text-sm font-semibold text-red-700">
                Action required in cart
              </p>
              <p className="mt-1 text-xs text-red-600">
                Please remove or adjust unavailable, out-of-stock, or payment-conflicting items before proceeding to checkout.
              </p>
            </div>
          )}
          {items.length ? (
            <div className="space-y-4">
              {items.map((item) => {
                const hasError =
                  Boolean(item.stockErrorMessage) ||
                  Boolean(item.paymentErrorMessage) ||
                  Boolean(item.priceUnavailable);

                return (
                  <div
                    key={item.variantId}
                    className={`rounded-md border p-4 transition-all ${
                      hasError ? "border-red-300 bg-red-50/50" : "border-line bg-white"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={closeCart}
                          className="text-[14px] font-semibold text-ink hover:text-brand"
                        >
                          {item.productTitle}
                        </Link>
                        <p className="mt-1 text-[12.5px] text-steel">
                          {item.variantTitle}
                        </p>
                        {item.sku && (
                          <p className="mt-1 text-[11.5px] uppercase tracking-wide text-steel-2">
                            {t("ui.cart.sku")} {item.sku}
                          </p>
                        )}
                        {item.countryCode && (
                          <p className="mt-1 text-[11.5px] text-steel-2">
                            {t("ui.cart.pricing")}:{" "}
                            {item.countryName ?? item.countryCode}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        aria-label={t("ui.cart.removeItem")}
                        onClick={() => removeItem(item.variantId)}
                        className="text-steel hover:text-brand"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    {item.stockErrorMessage && (
                      <div className="mt-2.5 rounded-md border border-red-200 bg-red-50 p-2 text-[11.5px] font-medium text-red-700">
                        {item.stockErrorMessage}
                      </div>
                    )}
                    {item.paymentErrorMessage && !item.stockErrorMessage && (
                      <div className="mt-2.5 rounded-md border border-red-200 bg-red-50 p-2 text-[11.5px] font-medium text-red-700">
                        ⚠️ {item.paymentErrorMessage}
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {Object.entries(item.selectedAttributes).map(
                        ([key, value]) => (
                          <span
                            key={key}
                            className="rounded-full bg-grey px-2.5 py-1 text-[10.5px] text-steel"
                          >
                            {key}: {value}
                          </span>
                        ),
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="flex items-center rounded-full border border-line p-1">
                        <button
                          type="button"
                          aria-label={t("ui.cart.decreaseQuantity")}
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity - 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-grey"
                        >
                          <Minus size={13} />
                        </button>
                        <span className="w-10 text-center text-[13px] font-semibold">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label={t("ui.cart.increaseQuantity")}
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                          className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-grey"
                        >
                          <Plus size={13} />
                        </button>
                      </div>
                      <div className="text-right">
                        <p className="text-[11px] uppercase tracking-wide text-steel-2">
                          {t("ui.cart.lineTotal")}
                        </p>

                        {item.priceUnavailable ? (
                          <>
                            <p className="text-[15px] font-semibold leading-none text-red-600">
                              —
                            </p>
                            <p className="mt-1 text-[11px] text-red-600">
                              Price unavailable
                            </p>
                          </>
                        ) : (
                          <div>
                            {item.basePrice && item.basePrice > item.unitPrice && (
                              <p className="text-[11.5px] text-steel line-through">
                                {formatMoney(
                                  item.currencySymbol,
                                  item.basePrice * item.quantity,
                                )}
                              </p>
                            )}
                            <div className="mt-0.5">
                              <p className="text-[15px] font-semibold text-ink">
                                {formatMoney(
                                  item.currencySymbol,
                                  item.unitPrice * item.quantity,
                                )}
                              </p>
                              <p className="text-[10px] text-steel">Tax calculated at checkout</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingCart size={28} className="mb-3 text-steel-2" />
              <p className="text-[15px] font-semibold text-ink">
                {t("ui.cart.emptyTitle")}
              </p>
              <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-steel">
                {t("ui.cart.emptyBody")}
              </p>
            </div>
          )}
        </div>

        <div className="border-t border-line p-5">
          {totals.roleDiscount > 0 && !hasUnavailableItems && (
            <>
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="text-steel">Base Subtotal</span>
                <span className="text-steel line-through">
                  {formatMoney(totals.currencySymbol, totals.originalSubtotal)}
                </span>
              </div>
              <div className="mb-2 flex items-center justify-between text-[13px]">
                <span className="font-semibold text-[#2A6A40]">Customer Discount</span>
                <span className="font-semibold text-[#2A6A40]">
                  -{formatMoney(totals.currencySymbol, totals.roleDiscount)}
                </span>
              </div>
            </>
          )}
          <div className="mb-4 flex items-center justify-between text-[15px]">
            <span className="text-steel">{t("ui.cart.subtotal")}</span>
            <strong
              className={hasUnavailableItems ? "text-red-600" : "text-ink"}
            >
              {hasUnavailableItems
                ? "Unavailable"
                : formatMoney(totals.currencySymbol, totals.subtotal)}
            </strong>
          </div>
          <Link
            href={hasUnavailableItems ? "#" : "/checkout"}
            onClick={(e) => {
              if (hasUnavailableItems) {
                e.preventDefault();
                return;
              }
              closeCart();
            }}
            className={`inline-flex w-full items-center justify-center rounded-pill px-5 py-3 text-[14px] font-semibold transition ${
              items.length && !hasUnavailableItems
                ? "bg-brand text-white hover:bg-brand-deep"
                : "pointer-events-none bg-grey text-steel"
            }`}
          >
            {t("ui.cart.checkout")}
          </Link>
        </div>
      </aside>
    </>
  );
}
