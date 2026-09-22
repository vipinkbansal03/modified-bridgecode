"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Minus,
  Plus,
  ShoppingCart,
  Trash2,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Truck,
  AlertCircle,
  Package,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useCart, type CartItem } from "@/contexts/CartContext";
import { CartItemWarehouseSelector } from "@/components/cart/CartItemWarehouseSelector";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { useToast } from "@/components/ui/ToastProvider";
import { useProduct } from "@/hooks/api/useProducts";

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

function CartItemThumbnail({ image, productSlug, title }: { image?: string | null; productSlug: string; title: string }) {
  const { data: productData } = useProduct(image ? "" : productSlug);
  const [imageError, setImageError] = useState(false);

  const rawImage =
    image?.trim() ||
    productData?.thumbnail?.trim() ||
    (typeof productData?.images?.[0] === "string" ? productData.images[0] : (productData?.images?.[0] as any)?.url) ||
    null;

  let imageSrc: string | null = null;
  if (rawImage && !imageError) {
    if (rawImage.startsWith("data:")) {
      imageSrc = rawImage;
    } else {
      let trimmed = rawImage.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):4000(\/uploads\/)/i, "$1");
      if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        imageSrc = trimmed;
      } else {
        imageSrc = `/${trimmed}`;
      }
    }
  }

  return (
    <div className="relative flex h-24 w-24 sm:h-28 sm:w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-line bg-white shadow-2xs">
      {imageSrc ? (
        <img
          src={imageSrc}
          alt={title}
          onError={() => setImageError(true)}
          className="h-full w-full object-contain p-2 transition-transform duration-300 hover:scale-105"
        />
      ) : (
        <div className="flex flex-col items-center justify-center text-steel-2">
          <Package size={28} />
        </div>
      )}
    </div>
  );
}

export function CartClient() {
  const router = useRouter();
  const { items, totals, updateQuantity, removeItem, updateWarehouse, clearCart, addItem } = useCart();
  const { t } = useStaticTranslations();
  const { showToast } = useToast();

  const hasUnavailableItems = items.some(
    (item) => item.priceUnavailable || item.isOutOfStock || item.isInsufficientStock || item.hasPaymentConflict,
  );

  return (
    <div className="pb-24 pt-6 lg:pt-8 bg-[#FBFBFA] min-h-[85vh]">
      <Container>
        {/* Top Bar: Back Navigation and Breadcrumbs */}
        <div className="mb-4 space-y-2">
          <div>
            <Link
              href="/products"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] shadow-2xs transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
            >
              <ArrowLeft size={14} className="text-[#E31E24]" />
              <span>Back to Products</span>
            </Link>
          </div>

          <nav className="text-[13px] text-steel-2">
            <Link href="/" className="hover:text-brand transition-colors">
              Home
            </Link>{" "}
            /{" "}
            <Link href="/products" className="hover:text-brand transition-colors">
              Products
            </Link>{" "}
            / <span className="text-ink font-semibold">Shopping Cart</span>
          </nav>
        </div>

        {/* Page Header */}
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line/80 pb-5">
          <div>
            <h1 className="text-[clamp(26px,3vw,34px)] font-bold tracking-tight text-ink">
              Shopping cart
            </h1>
            <p className="mt-1 text-[14.5px] text-steel">
              {totals.itemCount} {totals.itemCount === 1 ? "item" : "items"} in your order
            </p>
          </div>
          {items.length > 0 && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={clearCart}
                className="text-[13.5px] font-medium text-steel hover:text-red-600 transition-colors cursor-pointer"
              >
                Clear cart
              </button>
            </div>
          )}
        </div>

        {items.length === 0 ? (
          <div className="mx-auto max-w-md my-16 rounded-2xl border border-line bg-white p-8 text-center shadow-xs">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-50 text-[#E31E24]">
              <ShoppingCart size={30} />
            </div>
            <h2 className="text-[20px] font-bold text-ink">Your cart is empty</h2>
            <p className="mt-2 text-[14px] leading-relaxed text-steel">
              Looks like you haven&rsquo;t added any orthodontic products or configurations to your cart yet.
            </p>
            <Link
              href="/products"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-pill bg-[#E31E24] px-6 py-3 text-[14px] font-bold text-white shadow-sm hover:bg-[#C2181C] transition-colors"
            >
              <Package size={16} />
              Explore Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 items-start">
            {/* Cart Items List */}
            <div className="lg:col-span-8 space-y-5">
              {hasUnavailableItems && (
                <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[14px] font-bold text-red-800">Action required in cart</p>
                    <p className="text-[13px] text-red-700 mt-0.5">
                      Some items are unavailable, out of stock, or require price verification before you can checkout.
                    </p>
                  </div>
                </div>
              )}

              {items.map((item) => {
                const hasError =
                  Boolean(item.stockErrorMessage) ||
                  Boolean(item.paymentErrorMessage) ||
                  Boolean(item.priceUnavailable);

                const attributeEntries = Object.entries(item.selectedAttributes || {});

                return (
                  <div
                    key={item.variantId}
                    className={`rounded-2xl border bg-white p-5 sm:p-6 transition-all shadow-xs ${
                      hasError ? "border-red-300 bg-red-50/30" : "border-line/90 hover:border-steel-2/60"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start gap-5">
                      {/* Product Thumbnail */}
                      <CartItemThumbnail
                        image={item.image}
                        productSlug={item.productSlug}
                        title={item.productTitle}
                      />

                      {/* Item Details */}
                      <div className="flex-1 min-w-0 w-full">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <Link
                              href={`/products/${item.productSlug}`}
                              className="text-[17px] font-bold text-ink hover:text-brand transition-colors leading-snug"
                            >
                              {item.productTitle}
                            </Link>
                            <p className="mt-1 text-[13.5px] font-medium text-steel">
                              {item.variantTitle}
                            </p>
                            {item.sku && (
                              <p className="mt-0.5 text-[11.5px] font-medium uppercase tracking-wider text-steel-2">
                                SKU: {item.sku}
                              </p>
                            )}
                          </div>
                          <button
                            type="button"
                            aria-label="Remove item"
                            onClick={() => removeItem(item.variantId)}
                            className="text-steel hover:text-red-600 transition-colors p-1.5 rounded-md hover:bg-slate-100 cursor-pointer"
                            title="Remove item"
                          >
                            <Trash2 size={17} />
                          </button>
                        </div>

                        {/* Attribute Grid Breakdown (matching reference) */}
                        {attributeEntries.length > 0 && (
                          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-t border-line/60 pt-3">
                            {attributeEntries.map(([key, value]) => (
                              <div key={key}>
                                <span className="block text-[11px] font-semibold uppercase tracking-wider text-steel">
                                  {key}
                                </span>
                                <span className="text-[13.5px] font-bold text-ink">
                                  {value}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        {/* Warehouse selector if applicable */}
                        {item.warehouseName && (
                          <div className="mt-3 max-w-sm">
                            <CartItemWarehouseSelector
                              item={item}
                              updateWarehouse={updateWarehouse}
                            />
                          </div>
                        )}

                        {/* Stock error message */}
                        {item.stockErrorMessage && (
                          <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-2.5 text-[12px] font-semibold text-red-700">
                            {item.stockErrorMessage}
                          </div>
                        )}

                        {/* Bottom Row: Quantity Stepper and Price */}
                        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 border-t border-line/60 pt-4">
                          <div className="inline-flex items-center rounded-pill border border-line bg-slate-50 p-1">
                            <button
                              type="button"
                              aria-label="Decrease quantity"
                              disabled={item.quantity <= 1}
                              onClick={() => updateQuantity(item.variantId, item.quantity - 1)}
                              className={`flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full border bg-white transition ${
                                item.quantity <= 1
                                  ? "border-line/40 text-steel-2/50 cursor-not-allowed"
                                  : "border-line text-ink hover:border-steel-2 cursor-pointer"
                              }`}
                            >
                              <Minus size={13} />
                            </button>
                            <span className="w-10 text-center text-[13.5px] font-bold text-ink">
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              aria-label="Increase quantity"
                              onClick={() => updateQuantity(item.variantId, item.quantity + 1)}
                              className="flex size-7 sm:size-8 shrink-0 items-center justify-center rounded-full border border-line bg-white text-ink transition hover:border-steel-2 cursor-pointer"
                            >
                              <Plus size={13} />
                            </button>
                          </div>

                          <div className="text-right">
                            <span className="block text-[22px] font-extrabold text-ink tracking-tight leading-none">
                              {item.priceUnavailable
                                ? "Price Upon Request"
                                : formatMoney(item.currencySymbol, item.unitPrice * item.quantity)}
                            </span>
                            {!item.priceUnavailable && (
                              <span className="mt-1 block text-[12px] font-medium text-steel">
                                {formatMoney(item.currencySymbol, item.unitPrice)} each
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Order Summary Sidebar */}
            <div className="lg:col-span-4">
              <div className="rounded-2xl border border-line bg-white p-6 shadow-xs sticky top-24 space-y-4">
                <h2 className="text-[17px] font-bold text-ink border-b border-line/80 pb-3.5">
                  Order summary
                </h2>

                <div className="space-y-3 text-[14px]">
                  <div className="flex items-center justify-between text-steel">
                    <span>Total items</span>
                    <strong className="font-semibold text-ink">{totals.itemCount} {totals.itemCount === 1 ? "unit" : "units"}</strong>
                  </div>

                  {totals.roleDiscount > 0 && !hasUnavailableItems && (
                    <>
                      <div className="flex items-center justify-between text-steel">
                        <span>Base Subtotal</span>
                        <span className="line-through text-steel">
                          {formatMoney(totals.currencySymbol, totals.originalSubtotal)}
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-emerald-700 font-semibold">
                        <span>Customer Discount</span>
                        <span>
                          -{formatMoney(totals.currencySymbol, totals.roleDiscount)}
                        </span>
                      </div>
                    </>
                  )}

                  <div className="flex items-center justify-between text-steel">
                    <span>Subtotal</span>
                    <strong className="font-semibold text-ink">
                      {hasUnavailableItems
                        ? "Price Upon Request"
                        : formatMoney(totals.currencySymbol, totals.subtotal)}
                    </strong>
                  </div>

                  <div className="flex items-center justify-between text-steel">
                    <span>Shipping & taxes</span>
                    <span className="text-[13px]">Calculated at checkout</span>
                  </div>
                </div>

                <div className="border-t border-line/80 pt-4">
                  <div className="flex items-baseline justify-between mb-5">
                    <div>
                      <span className="block text-[13.5px] font-bold text-ink">
                        Estimated total
                      </span>
                      <p className="text-[11.5px] text-steel">Excl. applicable shipping</p>
                    </div>
                    <span className="text-[26px] font-extrabold text-ink tracking-tight">
                      {hasUnavailableItems
                        ? "Price Upon Request"
                        : formatMoney(totals.currencySymbol, totals.subtotal)}
                    </span>
                  </div>

                  <Link
                    href={hasUnavailableItems ? "#" : "/checkout"}
                    onClick={(e) => {
                      if (hasUnavailableItems) e.preventDefault();
                    }}
                    className={`inline-flex w-full items-center justify-center gap-2 rounded-lg px-6 py-3.5 text-[15px] font-bold text-white shadow-sm transition-all ${
                      items.length && !hasUnavailableItems
                        ? "bg-[#E31E24] hover:bg-[#C2181C] cursor-pointer"
                        : "pointer-events-none bg-slate-300 text-slate-500"
                    }`}
                  >
                    Proceed to checkout
                    <ArrowRight size={16} />
                  </Link>

                  {/* Trust & Guarantee Badges */}
                  <div className="mt-5 space-y-2.5 border-t border-line/70 pt-4 text-[12.5px] text-steel">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
                      <span>Direct in-house manufacturer guarantee</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Truck size={16} className="text-blue-600 shrink-0" />
                      <span>Smart multi-warehouse fulfillment</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </Container>
    </div>
  );
}
