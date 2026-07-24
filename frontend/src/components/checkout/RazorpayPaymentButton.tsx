"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  getCustomerErrorMessage,
  type CustomerOrderSummary,
} from "@/services/customerApi";

interface RazorpayPaymentButtonProps {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  onSuccess: (updatedOrder: CustomerOrderSummary) => void;
  onError: (errorMessage: string) => void;
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export function RazorpayPaymentButton({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onError,
}: RazorpayPaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = async () => {
    setIsProcessing(true);
    try {
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        onError("Razorpay SDK failed to load. Please check your internet connection.");
        setIsProcessing(false);
        return;
      }

      const rzpData = await createRazorpayOrder(orderId);

      const options = {
        key: rzpData.keyId,
        amount: rzpData.amount,
        currency: rzpData.currency,
        name: "Modern Orthodontics",
        description: `Payment for Order #${rzpData.orderNumber}`,
        order_id: rzpData.razorpayOrderId,
        prefill: {
          name: customerName,
          email: customerEmail,
          contact: customerPhone,
        },
        theme: {
          color: "#E31E24",
        },
        handler: async function (response: {
          razorpay_payment_id: string;
          razorpay_order_id: string;
          razorpay_signature: string;
        }) {
          try {
            const verifiedOrder = await verifyRazorpayPayment(orderId, {
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_signature: response.razorpay_signature,
            });
            onSuccess(verifiedOrder);
          } catch (err) {
            onError(getCustomerErrorMessage(err, "Payment signature verification failed."));
          } finally {
            setIsProcessing(false);
          }
        },
        modal: {
          ondismiss: function () {
            setIsProcessing(false);
          },
        },
      };

      const razorpayInstance = new (window as any).Razorpay(options);
      razorpayInstance.open();
    } catch (err) {
      onError(getCustomerErrorMessage(err, "Failed to initialize Razorpay checkout."));
      setIsProcessing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handlePayNow}
      disabled={isProcessing}
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E31E24] px-6 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:bg-[#B5151B] disabled:opacity-60"
    >
      {isProcessing ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Processing Payment...
        </>
      ) : (
        <>
          <CreditCard size={18} />
          Pay Now with Razorpay (UPI / Cards / NetBanking)
          <ShieldCheck size={16} className="ml-1 opacity-80" />
        </>
      )}
    </button>
  );
}
