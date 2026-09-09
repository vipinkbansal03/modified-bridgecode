"use client";

import { useState } from "react";
import { CreditCard, ShieldCheck } from "lucide-react";
import {
  initiateCustomerPayment,
  getCustomerErrorMessage,
} from "@/services/customerApi";

interface CashfreePaymentButtonProps {
  orderId: string;
  onError: (errorMessage: string) => void;
  buttonText?: string;
}

export function loadCashfreeScript(scriptUrl?: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && (window as any).Cashfree) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = scriptUrl || "https://sdk.cashfree.com/js/v3/cashfree.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export async function launchCashfreeCheckout(
  sdkPayload: Record<string, unknown> | undefined,
  clientScriptUrl?: string,
  onError?: (errorMessage: string) => void,
) {
  const payload = (sdkPayload || {}) as {
    paymentSessionId?: string;
    orderId?: string;
    mode?: "sandbox" | "production";
  };

  if (!payload.paymentSessionId) {
    if (onError) onError("Cashfree did not return a payment session. Please try again.");
    return;
  }

  const scriptLoaded = await loadCashfreeScript(clientScriptUrl);
  if (!scriptLoaded) {
    if (onError) onError("Cashfree SDK failed to load. Please check your internet connection.");
    return;
  }

  const mode = payload.mode === "sandbox" ? "sandbox" : "production";
  const cashfree = new (window as any).Cashfree({ mode });

  try {
    await cashfree.checkout({
      paymentSessionId: payload.paymentSessionId,
      redirectTarget: "_self",
    });
  } catch (err) {
    if (onError) onError(getCustomerErrorMessage(err, "Failed to open Cashfree checkout."));
  }
}

export function CashfreePaymentButton({
  orderId,
  onError,
  buttonText,
}: CashfreePaymentButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handlePayNow = async () => {
    setIsProcessing(true);
    try {
      const paymentRes = await initiateCustomerPayment(orderId, "CASHFREE");
      await launchCashfreeCheckout(paymentRes.sdkPayload, paymentRes.clientScriptUrl, (msg) => {
        setIsProcessing(false);
        onError(msg);
      });
    } catch (err) {
      onError(getCustomerErrorMessage(err, "Failed to initialize Cashfree checkout."));
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
          {buttonText || "Pay Now with Cashfree (Cards / UPI / NetBanking)"}
          <ShieldCheck size={16} className="ml-1 opacity-80" />
        </>
      )}
    </button>
  );
}