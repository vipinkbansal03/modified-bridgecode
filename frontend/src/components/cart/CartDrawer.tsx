"use client";

import Link from "next/link";
import { Minus, Plus, ShoppingCart, Trash2, X } from "lucide-react";
import { useCart } from "@/contexts/CartContext";

function formatMoney(symbol: string, amount: number) {
  return `${symbol}${Math.round(amount || 0).toLocaleString("en-IN")}`;
}

export function CartDrawer() {
  const { items, totals, isOpen, closeCart, updateQuantity, removeItem } = useCart();

  if (!isOpen) return null;

  return (
    <>
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="fixed inset-0 z-[70] bg-black/45 backdrop-blur-[2px]"
      />
      <aside className="fixed right-0 top-0 z-[80] flex h-screen w-full max-w-[420px] flex-col bg-white shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <div className="flex items-center gap-2">
            <ShoppingCart size={18} className="text-brand" />
            <div>
              <p className="text-[15px] font-semibold text-ink">Cart</p>
              <p className="text-[12px] text-steel">{totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}</p>
            </div>
          </div>
          <button type="button" aria-label="Close cart" onClick={closeCart} className="rounded-full border border-line p-2 text-ink hover:border-brand hover:text-brand">
            <X size={16} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {items.length ? (
            <div className="space-y-4">
              {items.map((item) => (
                <div key={item.variantId} className="rounded-md border border-line bg-white p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link href={`/products/${item.productSlug}`} onClick={closeCart} className="text-[14px] font-semibold text-ink hover:text-brand">
                        {item.productTitle}
                      </Link>
                      <p className="mt-1 text-[12.5px] text-steel">{item.variantTitle}</p>
                      {item.sku && <p className="mt-1 text-[11.5px] uppercase tracking-wide text-steel-2">SKU {item.sku}</p>}
                      {item.countryCode && <p className="mt-1 text-[11.5px] text-steel-2">Pricing: {item.countryName ?? item.countryCode}</p>}
                    </div>
                    <button type="button" aria-label="Remove item" onClick={() => removeItem(item.variantId)} className="text-steel hover:text-brand">
                      <Trash2 size={16} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {Object.entries(item.selectedAttributes).map(([key, value]) => (
                      <span key={key} className="rounded-full bg-grey px-2.5 py-1 text-[10.5px] text-steel">
                        {key}: {value}
                      </span>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div className="flex items-center rounded-full border border-line p-1">
                      <button type="button" aria-label="Decrease quantity" onClick={() => updateQuantity(item.variantId, item.quantity - 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-grey">
                        <Minus size={13} />
                      </button>
                      <span className="w-10 text-center text-[13px] font-semibold">{item.quantity}</span>
                      <button type="button" aria-label="Increase quantity" onClick={() => updateQuantity(item.variantId, item.quantity + 1)} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-grey">
                        <Plus size={13} />
                      </button>
                    </div>
                    <div className="text-right">
                      <p className="text-[11px] uppercase tracking-wide text-steel-2">Line total</p>
                      <p className="text-[15px] font-semibold text-ink">{formatMoney(item.currencySymbol, item.unitPrice * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingCart size={28} className="mb-3 text-steel-2" />
              <p className="text-[15px] font-semibold text-ink">Your cart is empty.</p>
              <p className="mt-1 max-w-[260px] text-[13px] leading-relaxed text-steel">Choose a product variant to start a purchase order.</p>
            </div>
          )}
        </div>

        <div className="border-t border-line p-5">
          <div className="mb-4 flex items-center justify-between text-[15px]">
            <span className="text-steel">Subtotal</span>
            <strong className="text-ink">{formatMoney(totals.currencySymbol, totals.subtotal)}</strong>
          </div>
          <Link
            href="/checkout"
            onClick={closeCart}
            className={`inline-flex w-full items-center justify-center rounded-pill px-5 py-3 text-[14px] font-semibold transition ${
              items.length ? "bg-brand text-white hover:bg-brand-deep" : "pointer-events-none bg-grey text-steel"
            }`}
          >
            Checkout
          </Link>
        </div>
      </aside>
    </>
  );
}
