"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import {
  createRazorpayOrder,
  verifyRazorpayPayment,
  recordCustomerPaymentFailure,
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
  onDismiss?: () => void;
  sdkPayload?: Record<string, unknown>;
  buttonText?: string;
}

export function loadRazorpayScript(): Promise<boolean> {
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

export async function launchRazorpayModal(params: {
  orderId: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  sdkPayload?: Record<string, unknown>;
  onSuccess: (updatedOrder: CustomerOrderSummary) => void;
  onError: (errorMessage: string) => void;
  onDismiss?: () => void;
}) {
  const {
    orderId,
    customerName,
    customerEmail,
    customerPhone,
    sdkPayload,
    onSuccess,
    onError,
    onDismiss,
  } = params;

  const scriptLoaded = await loadRazorpayScript();
  if (!scriptLoaded) {
    onError("Razorpay SDK failed to load. Please check your internet connection.");
    return;
  }

  let rzpData = sdkPayload as any;
  if (!rzpData || !rzpData.order_id) {
    const res = await createRazorpayOrder(orderId);
    rzpData = res.sdkPayload || {
      key: res.keyId,
      amount: res.amount,
      currency: res.currency,
      name: "Modern Orthodontics",
      description: `Payment for Order #${res.orderNumber}`,
      order_id: res.razorpayOrderId,
      prefill: {
        name: customerName,
        email: customerEmail,
        contact: customerPhone,
      },
    };
  }

  const options = {
    key: rzpData.key,
    amount: rzpData.amount,
    currency: rzpData.currency || "INR",
    name: rzpData.name || "Modern Orthodontics",
    description: rzpData.description || `Payment for Order`,
    order_id: rzpData.order_id,
    prefill: {
      name: customerName || rzpData.prefill?.name || "",
      email: customerEmail || rzpData.prefill?.email || "",
      contact: customerPhone || rzpData.prefill?.contact || "",
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
      }
    },
    modal: {
      ondismiss: function () {
        if (onDismiss) onDismiss();
      },
    },
  };

  const razorpayInstance = new (window as any).Razorpay(options);

  razorpayInstance.on("payment.failed", function (response: any) {
    const gatewayOrderId = response?.error?.metadata?.order_id || rzpData.order_id;
    const errorCode = response?.error?.code || "PAYMENT_FAILED";
    const errorMessage = response?.error?.description || response?.error?.reason || "Payment attempt failed.";

    recordCustomerPaymentFailure(orderId, {
      gatewayOrderId,
      errorCode,
      errorMessage,
    }).catch(console.error);

    onError(errorMessage);
  });

  razorpayInstance.open();
}

export function RazorpayPaymentButton({
  orderId,
  customerName,
  customerEmail,
  customerPhone,
  onSuccess,
  onError,
  onDismiss,
  sdkPayload,
  buttonText,
}: RazorpayPaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = async () => {
    setIsProcessing(true);
    try {
      await launchRazorpayModal({
        orderId,
        customerName,
        customerEmail,
        customerPhone,
        sdkPayload,
        onSuccess: (order) => {
          setIsProcessing(false);
          onSuccess(order);
        },
        onError: (msg) => {
          setIsProcessing(false);
          onError(msg);
        },
        onDismiss: () => {
          setIsProcessing(false);
          if (onDismiss) onDismiss();
        },
      });
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
      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E31E24] px-6 py-3.5 text-[15px] font-bold text-white shadow-md transition-all hover:bg-[#B5151B] disabled:opacity-60 cursor-pointer"
    >
      {isProcessing ? (
        <>
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
          Processing Payment...
        </>
      ) : (
        <>
          <CreditCard size={18} />
          {buttonText || "Pay Now with Razorpay (UPI / Cards / NetBanking)"}
          <ShieldCheck size={16} className="ml-1 opacity-80" />
        </>
      )}
    </button>
  );
}

