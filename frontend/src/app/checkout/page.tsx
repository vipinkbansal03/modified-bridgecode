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
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useDeliveryAddress } from "@/contexts/DeliveryAddressContext";
import {
  createCustomerOrder,
  calculateShipping,
  estimateCustomerOrder,
  getCustomerErrorMessage,
  listCustomerAddresses,
  validateCoupon,
  type CouponValidationResult,
  type CustomerAddress,
  type CustomerOrderEstimate,
  type CustomerOrderSummary,
  type ShippingEstimate,
} from "@/services/customerApi";
import { RazorpayPaymentButton } from "@/components/checkout/RazorpayPaymentButton";

const DEMO_PAYMENT_LABEL = "Pay on Delivery";
const SHIPPING_UNAVAILABLE_MESSAGE = "Shipping is not available to your country yet. Please contact support.";
const APPROVAL_MESSAGES: Record<string, string> = {
  PENDING_APPROVAL: "Your account is pending approval. You will be notified once approved.",
  SUSPENDED: "Your account has been suspended. Please contact support.",
};

function formatMoney(symbol: string, amount: number) {
  const val = amount || 0;
  const hasDecimals = val % 1 !== 0;
  return `${symbol}${val.toLocaleString("en-IN", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  })}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totals, updateQuantity, removeItem, clearCart } = useCart();
  const { currentCustomer, isLoading } = useCustomerAuth();
  const { selectedCountryCode, setSelectedCountryCode } = useCurrencyContext();
  const { selectedAddress: sessionAddress, setSelectedAddress } = useDeliveryAddress();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<CustomerOrderSummary | null>(null);
  const [pendingOrder, setPendingOrder] = useState<CustomerOrderSummary | null>(null);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<"RAZORPAY" | "COD">("RAZORPAY");
  const [estimate, setEstimate] = useState<CustomerOrderEstimate | null>(null);
  const [shippingEstimate, setShippingEstimate] = useState<ShippingEstimate | null>(null);
  const [shippingError, setShippingError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<CouponValidationResult | null>(null);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [isApplyingCoupon, setIsApplyingCoupon] = useState(false);
  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [taxIdInput, setTaxIdInput] = useState("");
  const [isVerifyingVat, setIsVerifyingVat] = useState(false);
  const [vatStatus, setVatStatus] = useState<"VALID" | "INVALID" | null>(null);
  const [vatMessage, setVatMessage] = useState("");
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
          
          // Prioritize sessionAddress from the header, fall back to default database address
          const preselected = sessionAddress || (saved.find((address) => address.isDefault) ?? saved[0]);
          if (preselected) applySavedAddress(preselected);
        })
        .catch(() => {
          setAddresses([]);
          if (sessionAddress) applySavedAddress(sessionAddress);
        });
    } else if (sessionAddress) {
      applySavedAddress(sessionAddress);
    }
  }, [currentCustomer, sessionAddress]);

  useEffect(() => {
    if (selectedCountryCode) {
      setForm((current) => ({ ...current, countryCode: selectedCountryCode }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCountryCode]);

  useEffect(() => {
    if (currentCustomer) {
      if ((currentCustomer as any).taxId) {
        setTaxIdInput((currentCustomer as any).taxId);
      }
      if ((currentCustomer as any).taxIdStatus) {
        setVatStatus((currentCustomer as any).taxIdStatus === "VALID" ? "VALID" : "INVALID");
      }
    }
  }, [currentCustomer]);

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

  const hasSpecificTaxes = useMemo(() => {
    if (!estimate?.items) return false;
    return (estimate.items as any[]).some((item) =>
      (item.appliedTaxes as any[])?.some((tax) => tax.isSpecific)
    );
  }, [estimate]);

  const taxEstimateLabel = useMemo(() => {
    if ((estimate?.taxAmount ?? 0) > 0) {
      return null;
    }
    if (vatStatus === "VALID" && estimate?.taxBreakdown?.[0]?.label) {
      return estimate.taxBreakdown[0].label;
    }
    return "Tax Exempt";
  }, [estimate, vatStatus]);

  const approvalBlockMessage = currentCustomer?.approvalStatus ? APPROVAL_MESSAGES[currentCustomer.approvalStatus] : null;
  const canPlaceOrder = canSubmit && Boolean(shippingEstimate?.available) && !approvalBlockMessage;

  const orderPayload = useMemo(() => ({
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
    couponCode: appliedCoupon?.code,
    notes: form.notes.trim() || undefined,
  }), [appliedCoupon?.code, form, items]);

  useEffect(() => {
    if (!currentCustomer || !canSubmit) {
      setEstimate(null);
      setShippingEstimate(null);
      setShippingError(null);
      return;
    }

    let cancelled = false;
    setShippingError(null);
    calculateShipping({ countryCode: form.countryCode.trim().toUpperCase(), orderValue: totals.subtotal })
      .then((nextShipping) => {
        if (cancelled) return;
        setShippingEstimate(nextShipping);
        setShippingError(nextShipping.available ? null : nextShipping.message ?? SHIPPING_UNAVAILABLE_MESSAGE);
      })
      .catch((err) => {
        if (!cancelled) {
          setShippingEstimate(null);
          setShippingError(getCustomerErrorMessage(err, SHIPPING_UNAVAILABLE_MESSAGE));
        }
      });
    estimateCustomerOrder(orderPayload)
      .then((nextEstimate) => {
        if (!cancelled) setEstimate(nextEstimate);
      })
      .catch((err) => {
        if (!cancelled) {
          setEstimate(null);
          if (appliedCoupon) {
            setCouponError(getCustomerErrorMessage(err, "Coupon could not be applied to this order."));
          } else {
            setShippingError(getCustomerErrorMessage(err, SHIPPING_UNAVAILABLE_MESSAGE));
          }
        }
      });
    return () => {
      cancelled = true;
    };
  }, [appliedCoupon, canSubmit, currentCustomer, form.countryCode, orderPayload, totals.subtotal]);

  async function handleVerifyVat() {
    if (!taxIdInput.trim()) return;
    setIsVerifyingVat(true);
    setVatStatus(null);
    setVatMessage("");
    try {
      const { customerApi } = await import("@/services/customerApi");
      const res = await customerApi.post("/tax-rules/identifiers/validate", {
        taxId: taxIdInput.trim(),
        taxIdType: "VAT",
        countryCode: form.countryCode.trim().toUpperCase(),
      });
      const data = res.data?.data || res.data;
      if (data && data.isValid) {
        setVatStatus("VALID");
        setVatMessage(data.legalName || "VAT format is valid");
        const nextEstimate = await estimateCustomerOrder(orderPayload);
        setEstimate(nextEstimate);
      } else {
        setVatStatus("INVALID");
        setVatMessage(data?.message || "Invalid format");
      }
    } catch (err: any) {
      setVatStatus("INVALID");
      const errMsg = err.response?.data?.message || err.message || "Failed to verify Tax ID.";
      setVatMessage(errMsg);
    } finally {
      setIsVerifyingVat(false);
    }
  }

  async function handleClearVat() {
    setTaxIdInput("");
    setVatStatus(null);
    setVatMessage("");
    try {
      const { customerApi } = await import("@/services/customerApi");
      await customerApi.post("/tax-rules/identifiers/validate", {
        taxId: "",
        taxIdType: "VAT",
        countryCode: form.countryCode.trim().toUpperCase(),
      });
      const nextEstimate = await estimateCustomerOrder(orderPayload);
      setEstimate(nextEstimate);
    } catch (err) {
      console.error("Error clearing VAT ID:", err);
    }
  }

  async function handleApplyCoupon() {
    const code = couponInput.trim();
    if (!code) {
      setCouponError("Enter a coupon code.");
      return;
    }

    setIsApplyingCoupon(true);
    setCouponError(null);
    try {
      const result = await validateCoupon({
        code,
        orderValue: estimate?.subtotal ?? totals.subtotal,
        countryCode: form.countryCode.trim().toUpperCase() || undefined,
      });
      setAppliedCoupon(result);
      setCouponInput(result.code);
    } catch (err) {
      setAppliedCoupon(null);
      setCouponError(getCustomerErrorMessage(err, "Coupon could not be applied."));
    } finally {
      setIsApplyingCoupon(false);
    }
  }

  function handleRemoveCoupon() {
    setAppliedCoupon(null);
    setCouponError(null);
    setCouponInput("");
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSubmit) {
      setError("Complete the shipping address before placing the order.");
      return;
    }
    if (!shippingEstimate?.available) {
      setError(shippingError ?? SHIPPING_UNAVAILABLE_MESSAGE);
      return;
    }
    if (approvalBlockMessage) {
      setError(approvalBlockMessage);
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      const created = await createCustomerOrder(orderPayload);
      if (selectedPaymentMethod === "RAZORPAY") {
        setPendingOrder(created);
      } else {
        setOrder(created);
        clearCart();
      }
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
    if (address.country.code) {
      setSelectedCountryCode(address.country.code.toUpperCase());
    }
    if (sessionAddress?.id !== address.id) {
      setSelectedAddress(address as any);
    }
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
    const taxAmount = Number(order.taxAmount ?? 0);
    const couponDiscount = Number(order.couponDiscount ?? order.discount ?? 0);
    const shippingLabel = order.shippingProvider || "Shipping";
    const isPaid = order.paymentStatus === "PAID";

    return (
      <Container>
        <section className="py-16">
          <div className="mx-auto max-w-2xl rounded-xl border border-line bg-white p-8 text-center shadow-[0_16px_50px_rgba(31,24,18,0.08)]">
            <CheckCircle2 size={42} className={`mx-auto mb-4 ${isPaid ? "text-[#2A6A40]" : "text-brand"}`} />
            <h1 className="text-[30px] font-semibold tracking-tight text-ink">
              {isPaid ? "Payment Successful & Order Confirmed!" : "Order Received"}
            </h1>
            <p className="mt-3 text-[14.5px] leading-relaxed text-steel">
              {isPaid
                ? "Your payment has been securely processed via Razorpay and your order is now in processing."
                : "Your order has been recorded. Payment will be collected on delivery."}
            </p>
            <div className="mt-6 rounded-xl bg-grey p-5 text-left space-y-2">
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Order number</span>
                <strong className="text-ink font-mono">{order.orderNumber}</strong>
              </div>
              {order.paymentId && (
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Razorpay Payment ID</span>
                  <strong className="text-ink font-mono text-xs">{order.paymentId}</strong>
                </div>
              )}
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Shipping</span>
                <strong className="text-ink">{shippingLabel} ({formatMoney(symbol, shippingCharge)})</strong>
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Tax</span>
                <strong className="text-ink">{formatMoney(symbol, taxAmount)}</strong>
              </div>
              {order.couponCode && couponDiscount > 0 && (
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Coupon ({order.couponCode})</span>
                  <strong className="text-[#2A6A40]">-{formatMoney(symbol, couponDiscount)}</strong>
                </div>
              )}
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Payment method</span>
                <strong className="text-ink">{order.paymentMethod === "RAZORPAY" ? "Razorpay Online Payment" : DEMO_PAYMENT_LABEL}</strong>
              </div>
              <div className="flex items-center justify-between text-[14px]">
                <span className="text-steel">Payment status</span>
                <span className={`inline-block rounded-md px-2 py-0.5 text-xs font-bold ${isPaid ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"}`}>
                  {order.paymentStatus}
                </span>
              </div>
              <div className="flex items-center justify-between border-t border-line pt-3 text-[15px]">
                <span className="font-semibold text-ink">{isPaid ? "Total Paid" : "Total Due on Delivery"}</span>
                <strong className="text-[17px] font-extrabold text-ink">{formatMoney(symbol, Number(order.total))}</strong>
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
                  <Input
                    label="Country code"
                    maxLength={2}
                    value={form.countryCode}
                    onChange={(event) => {
                      const nextCode = event.target.value.toUpperCase();
                      setForm((current) => ({ ...current, countryCode: nextCode }));
                    }}
                  />
                  {form.countryCode.toUpperCase() !== "IN" && (
                    <div className="sm:col-span-2 border-t border-line pt-4 mt-2">
                      <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">
                        Tax ID / VAT ID (Optional B2B)
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="text"
                          placeholder={form.countryCode.toUpperCase() === "US" ? "EIN (e.g. 12-3456789)" : "EU VAT ID (e.g. DE123456789)"}
                          value={taxIdInput}
                          onChange={(e) => {
                            setTaxIdInput(e.target.value);
                            setVatStatus(null);
                            setVatMessage("");
                          }}
                          className="flex-1 rounded-md border border-line bg-white px-4 py-2.5 text-[14.5px] text-ink outline-none transition-colors focus:border-steel-2"
                        />
                        <button
                          type="button"
                          onClick={handleVerifyVat}
                          disabled={isVerifyingVat || !taxIdInput.trim()}
                          className="rounded-md bg-brand px-5 py-2.5 text-[13.5px] font-bold text-white shadow-sm hover:bg-brand/90 disabled:opacity-50"
                        >
                          {isVerifyingVat ? "Verifying..." : "Verify/Validate"}
                        </button>
                        <button
                          type="button"
                          onClick={handleClearVat}
                          disabled={isVerifyingVat}
                          className="rounded-md border border-line px-4 py-2.5 text-[13.5px] font-medium text-steel hover:bg-grey disabled:opacity-50"
                        >
                          Clear
                        </button>
                      </div>
                      {vatStatus === "VALID" && (
                        <p className="mt-2 text-xs font-semibold text-green-600 flex items-center gap-1">
                          ✓ Status: VALID {vatMessage ? `(${vatMessage})` : ""}
                        </p>
                      )}
                      {vatStatus === "INVALID" && (
                        <p className="mt-2 text-xs font-semibold text-brand flex items-center gap-1">
                          ✗ Status: INVALID {vatMessage ? `(${vatMessage})` : ""}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="rounded-md border border-line bg-white p-5">
                <h2 className="mb-4 text-[18px] font-semibold text-ink">Shipping method</h2>
                <div className="rounded-md border border-line bg-grey px-4 py-3">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">
                        {shippingEstimate?.available ? shippingEstimate.provider ?? "Shipping" : "Shipping unavailable"}
                      </p>
                      <p className="mt-1 text-[12.5px] text-steel">
                        {shippingEstimate?.available
                          ? shippingEstimate.estimatedDays
                            ? `Estimated delivery: ${shippingEstimate.estimatedDays}`
                            : "Calculated from the selected shipping country."
                          : shippingError ?? "Complete the address to check shipping availability."}
                      </p>
                    </div>
                    <strong className="text-[14px] text-ink">
                      {shippingEstimate?.available
                        ? shippingEstimate.isFree
                          ? "Free"
                          : formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, estimate?.shippingCharge ?? shippingEstimate.charge)
                        : "-"}
                    </strong>
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
                {items.map((item) => {
                  const estimatedItem = estimate?.items?.find((ei) => ei.variantId === item.variantId);
                  const displayUnitPrice = estimatedItem ? estimatedItem.unitPrice : item.unitPrice;
                  const displayCurrencySymbol = estimate?.currency?.symbol ?? item.currencySymbol;
                  return (
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
                        <p className="text-[14px] font-semibold text-ink">{formatMoney(displayCurrencySymbol, displayUnitPrice * item.quantity)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="mt-5 space-y-3 border-t border-line pt-4">
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Subtotal</span>
                  <strong className="text-ink">{formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, estimate?.subtotal ?? totals.subtotal)}</strong>
                </div>
                <div className="rounded-md border border-line bg-grey/60 p-3">
                  <label htmlFor="couponCode" className="mb-2 block text-[12px] font-semibold uppercase tracking-wide text-steel-2">
                    Coupon code
                  </label>
                  {appliedCoupon ? (
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[13.5px] font-semibold text-[#2A6A40]">{appliedCoupon.code} applied</p>
                        <p className="mt-0.5 text-[12px] text-steel">
                          Discount: {formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, estimate?.couponDiscount ?? appliedCoupon.discountAmount)}
                        </p>
                      </div>
                      <button type="button" onClick={handleRemoveCoupon} className="text-[18px] leading-none text-steel hover:text-brand" aria-label="Remove coupon">
                        ×
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        id="couponCode"
                        value={couponInput}
                        onChange={(event) => {
                          setCouponInput(event.target.value.toUpperCase());
                          setCouponError(null);
                        }}
                        className="min-w-0 flex-1 rounded-md border border-line bg-white px-3 py-2 text-[13.5px] text-ink outline-none focus:border-steel-2"
                        placeholder="Enter code"
                      />
                      <button
                        type="button"
                        onClick={handleApplyCoupon}
                        disabled={isApplyingCoupon || !couponInput.trim()}
                        className="rounded-md bg-ink px-3 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
                      >
                        {isApplyingCoupon ? "Applying..." : "Apply"}
                      </button>
                    </div>
                  )}
                  {couponError && <p className="mt-2 text-[12.5px] text-brand">{couponError}</p>}
                </div>
                {(estimate?.couponCode || appliedCoupon) && Number(estimate?.couponDiscount ?? appliedCoupon?.discountAmount ?? 0) > 0 && (
                  <div className="flex items-center justify-between text-[14px]">
                    <span className="text-steel">Coupon ({estimate?.couponCode ?? appliedCoupon?.code})</span>
                    <strong className="text-[#2A6A40]">-{formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, Number(estimate?.couponDiscount ?? appliedCoupon?.discountAmount ?? 0))}</strong>
                  </div>
                )}
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">
                    {(estimate as any)?.isTaxInclusive
                      ? "Estimated tax (included)"
                      : "Estimated tax"}
                  </span>
                  <strong className="text-ink">
                    {(estimate?.taxAmount ?? 0) > 0
                      ? formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, estimate!.taxAmount)
                      : taxEstimateLabel}
                  </strong>
                </div>
                {estimate?.taxBreakdown && (estimate.taxBreakdown as any[]).length > 0 && (estimate?.taxAmount ?? 0) > 0 && (
                  <div className="space-y-1 pl-3 text-[12.5px] text-steel">
                    {(estimate.taxBreakdown as any[]).map((tax, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span>
                          {tax.label} ({tax.rate}%)
                        </span>
                        <span>
                          {formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, tax.taxAmount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex items-center justify-between text-[14px]">
                  <span className="text-steel">Shipping</span>
                  <strong className="text-ink">
                    {shippingEstimate?.available
                      ? shippingEstimate.isFree
                        ? "Free"
                        : formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, estimate?.shippingCharge ?? shippingEstimate.charge)
                      : "Unavailable"}
                  </strong>
                </div>
                <div className="mt-4 space-y-2 border-t border-line pt-3">
                  <span className="block text-xs uppercase tracking-wide text-steel-2 font-semibold">Payment Option</span>
                  <label className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${selectedPaymentMethod === "RAZORPAY" ? "border-brand bg-brand/5" : "border-line bg-white"}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={selectedPaymentMethod === "RAZORPAY"}
                        onChange={() => setSelectedPaymentMethod("RAZORPAY")}
                        className="text-brand focus:ring-brand"
                      />
                      <span className="text-[13.5px] font-semibold text-ink">Razorpay (UPI / Cards / NetBanking)</span>
                    </div>
                    <span className="rounded bg-[#E31E24] px-1.5 py-0.5 text-[10px] font-bold text-white uppercase">Online</span>
                  </label>

                  <label className={`flex items-center justify-between rounded-lg border p-3 cursor-pointer transition-colors ${selectedPaymentMethod === "COD" ? "border-brand bg-brand/5" : "border-line bg-white"}`}>
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="paymentMethod"
                        checked={selectedPaymentMethod === "COD"}
                        onChange={() => setSelectedPaymentMethod("COD")}
                        className="text-brand focus:ring-brand"
                      />
                      <span className="text-[13.5px] font-semibold text-ink">Pay on Delivery</span>
                    </div>
                  </label>
                </div>

                <div className="flex items-center justify-between border-t border-line pt-3 text-[16px]">
                  <span className="font-semibold text-ink">Total Payable</span>
                  <strong className="text-[18px] font-extrabold text-brand">{formatMoney(estimate?.currency?.symbol ?? totals.currencySymbol, estimate?.total ?? totals.subtotal)}</strong>
                </div>
              </div>

              {(error || approvalBlockMessage || shippingError) && <p className="mt-4 rounded-md border border-brand/20 bg-brand/5 px-3 py-2 text-[13px] text-brand">{error || approvalBlockMessage || shippingError}</p>}
              
              {pendingOrder ? (
                <div className="mt-5 space-y-3">
                  <div className="rounded-lg bg-green-50 border border-green-200 p-3 text-xs text-green-800 text-center">
                    Order #{pendingOrder.orderNumber} created! Click below to complete your payment.
                  </div>
                  <RazorpayPaymentButton
                    orderId={pendingOrder.id}
                    customerName={form.fullName}
                    customerEmail={currentCustomer?.email ?? ""}
                    customerPhone={form.phone}
                    onSuccess={(updated) => {
                      setOrder(updated);
                      setPendingOrder(null);
                      clearCart();
                    }}
                    onError={(errMsg) => setError(errMsg)}
                  />
                </div>
              ) : (
                <Button type="submit" variant="primary" size="lg" fullWidth className="mt-5" disabled={isSubmitting || !canPlaceOrder}>
                  {isSubmitting
                    ? "Processing..."
                    : selectedPaymentMethod === "RAZORPAY"
                    ? "Proceed to Pay with Razorpay"
                    : "Place Order (Pay on Delivery)"}
                </Button>
              )}
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
