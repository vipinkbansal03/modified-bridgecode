"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { CartItemWarehouseSelector } from "./CartItemWarehouseSelector";
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
  const { items, totals, isOpen, closeCart, updateQuantity, removeItem, updateWarehouse } =
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
        className={`fixed right-0 top-0 z-[80] flex h-screen w-full max-w-[600px] flex-col bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)] transition-transform duration-300 ease-in-out ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-line px-6 py-4">
          <div className="flex items-center gap-2.5">
            <ShoppingCart size={20} className="text-brand" />
            <div>
              <p className="text-[16px] font-semibold text-ink">
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
            className="rounded-full border border-line p-2 text-ink hover:border-brand hover:text-brand transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="custom-scrollbar flex-1 overflow-y-auto px-6 py-5">
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
            <div className="rounded-xl border border-line bg-white overflow-hidden shadow-2xs">
              {/* Single Header Row for Cart Items */}
              <div className="grid grid-cols-[minmax(0,1.8fr)_85px_95px_85px_36px] items-center gap-2 border-b border-line bg-[#FAFAFA] px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-steel-2">
                <div>Product Details</div>
                <div className="text-center">Price / Pc</div>
                <div className="text-center">Quantity</div>
                <div className="text-right">Total</div>
                <div></div>
              </div>

              <div className="divide-y divide-line">
                {items.map((item) => {
                  const hasError =
                    Boolean(item.stockErrorMessage) ||
                    Boolean(item.paymentErrorMessage) ||
                    Boolean(item.priceUnavailable);

                  return (
                    <div
                      key={item.variantId}
                      className={`grid grid-cols-[minmax(0,1.8fr)_85px_95px_85px_36px] items-start gap-2 p-4 transition-colors ${
                        hasError ? "bg-red-50/50" : "hover:bg-[#FAFAFA]/60"
                      }`}
                    >
                      {/* Product Details */}
                      <div className="min-w-0 pr-1">
                        <Link
                          href={`/products/${item.productSlug}`}
                          onClick={closeCart}
                          className="text-[13.5px] font-semibold text-ink hover:text-brand transition-colors line-clamp-2 block leading-snug"
                        >
                          {item.productTitle}
                        </Link>
                        <p className="mt-0.5 text-[12px] text-steel">
                          {item.variantTitle}
                        </p>
                        {item.warehouseName && (
                          <div className="mt-1.5 max-w-[210px]">
                            <CartItemWarehouseSelector 
                              item={item} 
                              updateWarehouse={updateWarehouse} 
                            />
                          </div>
                        )}
                        {item.stockErrorMessage && (
                          <div className="mt-1.5 rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            {item.stockErrorMessage}
                          </div>
                        )}
                        {item.paymentErrorMessage && !item.stockErrorMessage && (
                          <div className="mt-1.5 rounded bg-red-100 px-2 py-0.5 text-[11px] font-medium text-red-700">
                            ⚠️ {item.paymentErrorMessage}
                          </div>
                        )}
                        {Object.keys(item.selectedAttributes || {}).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1">
                            {Object.entries(item.selectedAttributes).map(([k, v]) => (
                              <span key={k} className="rounded bg-grey px-1.5 py-0.5 text-[10px] text-steel">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Price per Piece */}
                      <div className="text-center pt-0.5 text-[13px] font-medium text-ink">
                        {item.priceUnavailable ? (
                          <span className="text-red-600 font-semibold">—</span>
                        ) : (
                          formatMoney(item.currencySymbol, item.unitPrice)
                        )}
                      </div>

                      {/* Quantity Selector */}
                      <div className="flex justify-center pt-0.5">
                        <div className="inline-flex items-center rounded-full border border-line bg-white p-0.5 shadow-2xs">
                          <button
                            type="button"
                            aria-label={t("ui.cart.decreaseQuantity")}
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity - 1)
                            }
                            disabled={item.quantity <= 1}
                            className="flex h-6 w-6 items-center justify-center rounded-full text-ink hover:bg-grey disabled:opacity-30 transition-colors"
                          >
                            <Minus size={11} />
                          </button>
                          <span className="w-7 text-center text-[12.5px] font-bold text-ink">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            aria-label={t("ui.cart.increaseQuantity")}
                            onClick={() =>
                              updateQuantity(item.variantId, item.quantity + 1)
                            }
                            className="flex h-6 w-6 items-center justify-center rounded-full text-ink hover:bg-grey transition-colors"
                          >
                            <Plus size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Total Price */}
                      <div className="text-right pt-0.5">
                        {item.priceUnavailable ? (
                          <span className="text-[13px] font-semibold text-red-600">—</span>
                        ) : (
                          <div>
                            {item.basePrice && item.basePrice > item.unitPrice && (
                              <p className="text-[10.5px] text-steel line-through">
                                {formatMoney(item.currencySymbol, item.basePrice * item.quantity)}
                              </p>
                            )}
                            <p className="text-[13.5px] font-bold text-ink">
                              {formatMoney(item.currencySymbol, item.unitPrice * item.quantity)}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Remove Action */}
                      <div className="flex justify-center pt-0.5">
                        <button
                          type="button"
                          aria-label={t("ui.cart.removeItem")}
                          onClick={() => removeItem(item.variantId)}
                          className="text-steel hover:text-brand transition-colors p-1"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
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
