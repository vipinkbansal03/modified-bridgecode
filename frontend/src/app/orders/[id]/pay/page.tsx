"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, AlertCircle, ShoppingBag, ShieldCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import {
  fetchCustomerPaymentSession,
  getCustomerErrorMessage,
  type CustomerPaymentSession,
  type CustomerOrderSummary,
} from "@/services/customerApi";
import { RazorpayPaymentButton } from "@/components/checkout/RazorpayPaymentButton";
import { CashfreePaymentButton } from "@/components/checkout/CashfreePaymentButton";
import { PaymentCountdownTimer } from "@/components/checkout/PaymentCountdownTimer";
import { useCart } from "@/contexts/CartContext";

export default function OrderPayPage() {
  const params = useParams();
  const router = useRouter();
  const { clearCart } = useCart();
  const orderId = String(params.id);

  const [session, setSession] = useState<CustomerPaymentSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successOrder, setSuccessOrder] = useState<CustomerOrderSummary | null>(null);
  const [isExpiredLocally, setIsExpiredLocally] = useState(false);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setError(null);

    const loadSession = () => {
      fetchCustomerPaymentSession(orderId)
        .then((data) => {
          if (!isMounted) return;
          setSession(data);
          if (data.isExpired || data.status === "CANCELLED" || data.secondsRemaining <= 0) {
            setIsExpiredLocally(true);
          }
        })
        .catch((err) => {
          if (!isMounted) return;
          setError(getCustomerErrorMessage(err, "Failed to load payment session."));
        })
        .finally(() => {
          if (isMounted) setIsLoading(false);
        });
    };

    loadSession();

    // Reconcile status every 10 seconds while pending
    const interval = setInterval(loadSession, 10000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [orderId]);

  if (isLoading) {
    return (
      <Container>
        <div className="py-24 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          <p className="mt-4 text-[14px] text-steel">Loading payment session...</p>
        </div>
      </Container>
    );
  }

  if (error || !session) {
    return (
      <Container>
        <div className="mx-auto max-w-lg py-20 text-center">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6">
            <AlertCircle size={36} className="mx-auto text-red-600 mb-3" />
            <h2 className="text-[18px] font-semibold text-red-900">Unable to load payment</h2>
            <p className="mt-2 text-[14px] text-red-700">{error || "Order not found."}</p>
            <div className="mt-6 flex justify-center gap-3">
              <Button href="/account" variant="outline">
                Go to My Account
              </Button>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const isPaid = session.paymentStatus === "PAID" || successOrder?.paymentStatus === "PAID";

  if (isPaid) {
    return (
      <Container>
        <div className="mx-auto max-w-xl py-16 text-center">
          <div className="rounded-2xl border border-line bg-white p-8 shadow-sm">
            <CheckCircle2 size={48} className="mx-auto text-emerald-600 mb-4" />
            <h1 className="text-[26px] font-semibold text-ink">Payment Successful!</h1>
            <p className="mt-2 text-[14.5px] text-steel">
              Your payment for Order #{session.orderNumber} has been verified and confirmed.
            </p>
            <div className="mt-6 rounded-xl bg-offwhite p-4 text-left text-[14px] space-y-2">
              <div className="flex justify-between">
                <span className="text-steel">Order Number</span>
                <span className="font-semibold text-ink">{session.orderNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-steel">Total Paid</span>
                <span className="font-semibold text-ink">
                  {session.currencySymbol} {session.total.toFixed(2)}
                </span>
              </div>
            </div>
            <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
              <Button href="/account" variant="primary">
                View in My Account
              </Button>
              <Button href="/products" variant="outline">
                Continue Shopping
              </Button>
            </div>
          </div>
        </div>
      </Container>
    );
  }

  const isExpired = session.isExpired || isExpiredLocally;

  return (
    <Container>
      <div className="py-10">
        <div className="mb-6 flex items-center gap-2">
          <Link
            href="/account"
            className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-steel hover:text-ink transition-colors"
          >
            <ArrowLeft size={16} />
            Back to Account
          </Link>
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          {/* Left Column: Order Summary & Items */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-4">
                <div>
                  <h1 className="text-[22px] font-bold text-ink">
                    Payment for Order #{session.orderNumber}
                  </h1>
                  <p className="mt-1 text-[13px] text-steel">
                    Customer: {session.customerName} ({session.customerEmail})
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                    isExpired
                      ? "bg-red-50 text-red-700 border border-red-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}
                >
                  {isExpired ? "EXPIRED" : "PAYMENT PENDING"}
                </span>
              </div>

              {/* Items List */}
              <div className="mt-5 divide-y divide-line">
                {session.items.map((item) => (
                  <div key={item.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-ink">{item.title}</p>
                      {item.sku && <p className="text-[12px] text-steel">SKU: {item.sku}</p>}
                      <p className="text-[12.5px] text-steel-2">Qty: {item.quantity}</p>
                    </div>
                    <span className="text-[14px] font-semibold text-ink">
                      {session.currencySymbol} {item.total.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Previous attempt info if any */}
            {session.latestTransaction && session.latestTransaction.status === "FAILED" && !isExpired && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-[13.5px] text-amber-900">
                <p className="font-semibold">Previous payment attempt was not completed:</p>
                <p className="mt-1 text-[13px] text-amber-800">
                  {session.latestTransaction.errorMessage || "The transaction was cancelled or declined by your bank."}
                </p>
                <p className="mt-2 text-[12px] text-amber-700">
                  You can retry payment below while your 4-minute reservation window is active.
                </p>
              </div>
            )}
          </div>

          {/* Right Column: Timer & Pay Action */}
          <div className="space-y-5">
            <div className="rounded-2xl border border-line bg-white p-6 shadow-sm space-y-5">
              <h2 className="text-[17px] font-semibold text-ink">Order Breakdown</h2>

              <div className="space-y-2 text-[14px]">
                <div className="flex justify-between text-steel">
                  <span>Subtotal</span>
                  <span className="text-ink font-medium">
                    {session.currencySymbol} {session.subtotal.toFixed(2)}
                  </span>
                </div>
                {session.discount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount</span>
                    <span>-{session.currencySymbol} {session.discount.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-steel">
                  <span>Shipping</span>
                  <span className="text-ink font-medium">
                    {session.shippingCharge > 0
                      ? `${session.currencySymbol} ${session.shippingCharge.toFixed(2)}`
                      : "Free"}
                  </span>
                </div>
                <div className="flex justify-between text-steel">
                  <span>Tax</span>
                  <span className="text-ink font-medium">
                    {session.currencySymbol} {session.taxAmount.toFixed(2)}
                  </span>
                </div>
                <div className="border-t border-line pt-3 flex justify-between text-[16px] font-bold text-ink">
                  <span>Total Amount</span>
                  <span className="text-brand">
                    {session.currencySymbol} {session.total.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Countdown Timer */}
              {!isExpired && (
                <div className="pt-2">
                  <PaymentCountdownTimer
                    expiresAt={session.paymentExpiresAt}
                    initialSecondsRemaining={session.secondsRemaining}
                    onExpire={() => setIsExpiredLocally(true)}
                  />
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                {isExpired ? (
                  <div className="space-y-3">
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-center text-red-700 text-[13.5px]">
                      <p className="font-semibold">Payment window has expired.</p>
                      <p className="mt-1 text-[12.5px] text-red-600">
                        Reserved warehouse stock was returned. Please create a new order to proceed.
                      </p>
                    </div>
                    <Button href="/products" variant="primary" fullWidth>
                      <ShoppingBag size={16} className="mr-1.5" />
                      Browse Catalog to Reorder
                    </Button>
                  </div>
                ) : session.paymentMethod === "CASHFREE" ? (
                    <CashfreePaymentButton
                      orderId={session.orderId}
                      buttonText="Pay Now with Cashfree"
                      onError={(msg) => {
                        if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("cancelled")) {
                          setIsExpiredLocally(true);
                          setError("Payment window has expired. Reserved warehouse stock was returned.");
                        } else {
                          setError(msg);
                        }
                      }}
                    />
                  ) : (
                    <RazorpayPaymentButton
                      orderId={session.orderId}
                      customerName={session.customerName}
                      customerEmail={session.customerEmail}
                      customerPhone={session.customerPhone || ""}
                      buttonText="Pay Now with Razorpay"
                      onSuccess={(verified) => {
                        setSuccessOrder(verified);
                        clearCart();
                      }}
                      onError={(msg) => {
                        if (msg.toLowerCase().includes("expired") || msg.toLowerCase().includes("cancelled")) {
                          setIsExpiredLocally(true);
                          setError("Payment window has expired. Reserved warehouse stock was returned.");
                        } else {
                          setError(msg);
                        }
                      }}
                    />
                  )}
              </div>

              <div className="flex items-center justify-center gap-1.5 text-[12px] text-steel">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>256-bit encrypted secure checkout</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Container>
  );
}
