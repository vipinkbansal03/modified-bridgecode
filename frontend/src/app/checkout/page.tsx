"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Lock, ShoppingCart } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { useCart } from "@/contexts/CartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import {
  createCustomerOrder,
  getCustomerErrorMessage,
  listCustomerAddresses,
  type CustomerAddress,
  type CustomerOrderSummary,
} from "@/services/customerApi";

const DEMO_SHIPPING_LABEL = "Free Standard Shipping";
const DEMO_PAYMENT_LABEL = "Pay on Delivery";

function formatMoney(symbol: string, amount: number) {
  return `${symbol}${Math.round(amount || 0).toLocaleString("en-IN")}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totals, updateQuantity, removeItem, clearCart } = useCart();
  const { currentCustomer, isLoading } = useCustomerAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrderSummary | null>(null);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [form, setForm] = useState({
    fullName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    countryCode: "IN",
    notes: "",
  });

  useEffect(() => {
    if (!isLoading && !currentCustomer) {
      router.replace("/login?returnTo=/checkout");
    }
  }, [currentCustomer, isLoading, router]);

  useEffect(() => {
    if (currentCustomer) {
      setForm((current) => ({
        ...current,
        fullName: current.fullName || `${currentCustomer.firstName} ${currentCustomer.lastName}`.trim(),
        phone: current.phone || currentCustomer.phone || "",
      }));
      listCustomerAddresses()
        .then((saved) => {
          setAddresses(saved);
          const defaultAddress = saved.find((address) => address.isDefault) ?? saved[0];
          if (defaultAddress) applySavedAddress(defaultAddress);
        })
        .catch(() => setAddresses([]));
    }
  }, [currentCustomer]);

  useEffect(() => {
    const countryCode = items[0]?.countryCode;
    if (countryCode) {
      setForm((current) => ({ ...current, countryCode }));
    }
  }, [items]);

  const canSubmit = useMemo(() => {
    return Boolean(
      items.length &&
        form.fullName.trim() &&
        form.phone.trim() &&
        form.addressLine1.trim() &&
        form.city.trim() &&
        form.state.trim() &&
        form.postalCode.trim()
    );
  }, [form, items.length]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Complete the shipping address before placing the order.");
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createCustomerOrder({
        items: items.map((item) => ({ variantId: item.variantId, quantity: item.quantity })),
        shippingAddress: {
          fullName: form.fullName.trim(),
          phone: form.phone.trim(),
          addressLine1: form.addressLine1.trim(),
          addressLine2: form.addressLine2.trim() || undefined,
          city: form.city.trim(),
          state: form.state.trim(),
          postalCode: form.postalCode.trim(),
          countryCode: form.countryCode.trim().toUpperCase() || undefined,
        },
        notes: form.notes.trim() || undefined,
      });
      setOrder(created);
      clearCart();
    } catch (err) {
      setError(getCustomerErrorMessage(err, "Could not place order."));
    } finally {
      setIsSubmitting(false);
    }
  }

  function applySavedAddress(address: CustomerAddress) {
    setForm((current) => ({
      ...current,
      fullName: address.fullName,
      phone: address.phone,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 ?? "",
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      countryCode: address.country.code,
    }));
  }

  if (isLoading || (!currentCustomer && !order)) {
    return (
      <Container>
        <div className="py-20 text-center text-steel">Preparing checkout...</div>
      </Container>
    );
  }

  if (order) {
    const symbol = order.currency?.symbol ?? totals.currencySymbol;
    const shippingCharge = Number(order.shippingCharge ?? 0);
    return (
      <Container>
        <section className="py-16">
          <div className="mx-auto max-w-2xl rounded-md border border-line bg-white p-8 text-center shadow-[0_16px_50px_rgba(31,24,18,0.08)]">
            <CheckCircle2 size={36} className="mx-auto mb-4 text-[#2A6A40]" />
            <h1 className="text-[30px] font-normal tracking-tight text-ink">Order received</h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-steel">
              Your order is confirmed for demo checkout. You will pay on delivery; no online payment has been charged.
            </p>
            <div className="mt-6 rounded-md bg-grey p-4 text-left">
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Order number</span>
                <strong className="text-ink">{order.orderNumber}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between text-[14px]">
                <span className="text-steel">Shipping</span>
                <strong className="text-ink">{DEMO_SHIPPING_LABEL} ({formatMoney(symbol, shippingCharge)})</strong>
              </div>
              <div className="mt-2 flex items-center justify-between text-[14px]">
                <span className="text-steel">Payment method</span>
                <strong className="text-ink">{DEMO_PAYMENT_LABEL}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between text-[14px]">
                <span className="text-steel">Payment status</span>
                <strong className="text-ink">{order.paymentStatus}</strong>
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-3 text-[15px]">
                <span className="font-semibold text-ink">Total due on delivery</span>
                <strong className="text-ink">{formatMoney(symbol, Number(order.total))}</strong>
              </div>
            </div>
            <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
              <Button href="/products" variant="outline">Continue shopping</Button>
              <Button href="/account" variant="primary">View my account</Button>
            </div>
          </div>
        </section>
      </Container>
    );
  }

  return (
    <Container>
      <section className="py-12">
        <div className="mb-8 flex flex-col gap-3 border-b border-line pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 inline-flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-steel-2">
              <Lock size={14} />
              Secure checkout
            </p>
            <h1 className="text-[34px] font-normal tracking-tight text-ink">Checkout</h1>
          </div>
          <Link href="/products" className="text-[14px] font-medium text-ink hover:text-brand">
            Continue shopping
          </Link>
        </div>

        {items.length ? (
          <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_390px]" noValidate>
            <div className="space-y-6">
              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-5 text-[18px] font-semibold text-ink">Shipping address</h2>
                {addresses.length > 0 && (
                  <div className="mb-5">
                    <label htmlFor="savedAddress" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">
                      Saved address
                    </label>
                    <select
                      id="savedAddress"
                      onChange={(event) => {
                        const address = addresses.find((entry) => entry.id === event.target.value);
                        if (address) applySavedAddress(address);
                      }}
                      className="w-full rounded-md border border-line bg-white px-4 py-3 text-[14.5px] text-ink outline-none transition-colors focus:border-steel-2"
                    >
                      {addresses.map((address) => (
                        <option key={address.id} value={address.id}>
                          {address.label ?? (address.isDefault ? "Default address" : address.fullName)} - {address.city}, {address.country.code}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <div className="grid gap-5 sm:grid-cols-2">
                  <Input label="Full name" value={form.fullName} onChange={(event) => setForm((current) => ({ ...current, fullName: event.target.value }))} />
                  <Input label="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                  <Input className="sm:col-span-2" label="Address line 1" value={form.addressLine1} onChange={(event) => setForm((current) => ({ ...current, addressLine1: event.target.value }))} />
                  <Input className="sm:col-span-2" label="Address line 2 (optional)" value={form.addressLine2} onChange={(event) => setForm((current) => ({ ...current, addressLine2: event.target.value }))} />
                  <Input label="City" value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
                  <Input label="State" value={form.state} onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))} />
                  <Input label="Postal code" value={form.postalCode} onChange={(event) => setForm((current) => ({ ...current, postalCode: event.target.value }))} />
                  <Input label="Country code" maxLength={2} value={form.countryCode} onChange={(event) => setForm((current) => ({ ...current, countryCode: event.target.value.toUpperCase() }))} />
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">Shipping method</h2>
                <div className="rounded-md border border-line bg-grey px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{DEMO_SHIPPING_LABEL}</p>
                      <p className="mt-1 text-[12.5px] text-steel">Demo checkout uses free standard shipping. Real carrier rates come later.</p>
                    </div>
                    <strong className="text-[14px] text-ink">{formatMoney(totals.currencySymbol, 0)}</strong>
                  </div>
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">Order notes</h2>
                <textarea
                  value={form.notes}
                  onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
                  className="min-h-[110px] w-full rounded-md border border-line bg-white px-4 py-3 text-[14.5px] text-ink outline-none transition-colors placeholder:text-steel-2 focus:border-steel-2"
                  placeholder="Delivery instructions or internal purchase reference"
                />
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">Payment method</h2>
                <div className="rounded-md border border-line bg-grey px-4 py-3">
                  <p className="text-[14px] font-semibold text-ink">{DEMO_PAYMENT_LABEL}</p>
                  <p className="mt-1 text-[12.5px] leading-relaxed text-steel">
                    No online payment is captured in this demo flow. The order is saved with pending payment and the amount is due on delivery.
                  </p>
                </div>
              </div>
            </div>

            <aside className="h-fit rounded-md border border-line bg-white p-5 shadow-[0_16px_50px_rgba(31,24,18,0.08)]">
              <div className="mb-5 flex items-center gap-2">
                <ShoppingCart size={17} className="text-brand" />
                <h2 className="text-[18px] font-semibold text-ink">Order summary</h2>
              </div>

              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.variantId} className="border-b border-line pb-4 last:border-0">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[14px] font-semibold text-ink">{item.productTitle}</p>
                        <p className="mt-1 text-[12.5px] text-steel">{item.variantTitle}</p>
                      </div>
                      <button type="button" onClick={() => removeItem(item.variantId)} className="text-[12px] font-medium text-brand">
                        Remove
                      </button>
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                      <input
                        type="number"
                        min={1}
                        value={item.quantity}
                        onChange={(event) => updateQuantity(item.variantId, Math.max(1, Number(event.target.value) || 1))}
                        className="w-20 rounded-md border border-line px-3 py-2 text-center text-[13px] outline-none"
                      />
                      <p className="text-[14px] font-semibold text-ink">{formatMoney(item.currencySymbol, item.unitPrice * item.quantity)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Subtotal</span>
                  <strong className="text-ink">{formatMoney(totals.currencySymbol, totals.subtotal)}</strong>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Shipping</span>
                  <strong className="text-ink">{DEMO_SHIPPING_LABEL}</strong>
                </div>
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Payment</span>
                  <strong className="text-ink">{DEMO_PAYMENT_LABEL}</strong>
                </div>
                <div className="flex items-center justify-between border-t border-line pt-3 text-[16px]">
                  <span className="font-semibold text-ink">Total due on delivery</span>
                  <strong className="text-ink">{formatMoney(totals.currencySymbol, totals.subtotal)}</strong>
                </div>
              </div>

              {error && <p className="mt-4 rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-[13px] text-brand">{error}</p>}
              <Button type="submit" variant="primary" size="lg" fullWidth className="mt-5" disabled={isSubmitting || !canSubmit}>
                {isSubmitting ? "Placing order..." : "Place order"}
              </Button>
              <p className="mt-3 text-center text-[12px] leading-relaxed text-steel">
                Demo checkout uses pay on delivery. Stripe/Razorpay capture is intentionally not connected yet.
              </p>
            </aside>
          </form>
        ) : (
          <div className="rounded-md border border-line bg-white p-10 text-center">
            <ShoppingCart size={30} className="mx-auto mb-3 text-steel-2" />
            <h2 className="text-[20px] font-semibold text-ink">Your cart is empty</h2>
            <p className="mt-2 text-[14px] text-steel">Add a product variant before checkout.</p>
            <Button href="/products" variant="primary" className="mt-6">Browse products</Button>
          </div>
        )}
      </section>
    </Container>
  );
}
