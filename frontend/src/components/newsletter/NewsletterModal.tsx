"use client";

import { useEffect, useState } from "react";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { apiClient } from "@/lib/apiClient";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";

export function NewsletterModal() {
  const { currentCustomer } = useCustomerAuth();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    // 1. Check if already subscribed
    const isSubscribed = localStorage.getItem("newsletter_subscribed") === "true";
    if (isSubscribed) return;

    // 2. Check if dismissed within the last 30 days
    const dismissedAt = localStorage.getItem("newsletter_dismissed_at");
    if (dismissedAt) {
      const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
      if (Date.now() - Number(dismissedAt) < THIRTY_DAYS_MS) {
        return;
      }
    }

    // 3. Determine if registration signup redirect trigger exists
    const showOnceImmediately = localStorage.getItem("show_newsletter_signup_modal_once") === "true";

    // Set delay accordingly to 7 seconds to feel less aggressive for B2B users
    const delayMs = 7000;

    const timer = setTimeout(() => {
      // Pre-fill email if logged-in customer exists
      if (currentCustomer?.email) {
        setEmail(currentCustomer.email);
      }
      setOpen(true);
      if (showOnceImmediately) {
        // Clear flag once shown
        localStorage.removeItem("show_newsletter_signup_modal_once");
      }
    }, delayMs);

    return () => clearTimeout(timer);
  }, [currentCustomer]);

  const handleDismiss = () => {
    localStorage.setItem("newsletter_dismissed_at", Date.now().toString());
    setOpen(false);
  };

  const handleSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      setStatus("error");
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setStatus("loading");
    try {
      await apiClient.post("/newsletter/subscribe", { email: email.trim() });
      localStorage.setItem("newsletter_subscribed", "true");
      localStorage.removeItem("newsletter_dismissed_at");
      setStatus("success");
      
      // Auto close success screen after 2.5s
      setTimeout(() => {
        setOpen(false);
      }, 2500);
    } catch (err: any) {
      setStatus("error");
      setErrorMessage(err.message || "Failed to subscribe. Please try again.");
    }
  };

  return (
    <Modal open={open} onClose={handleDismiss}>
      <div className="relative p-6 sm:p-8 flex flex-col items-center text-center">
        {status === "success" ? (
          <div className="py-6 flex flex-col items-center">
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 mb-6 animate-pulse">
              <CheckCircle2 size={36} />
            </span>
            <h3 className="text-xl font-bold text-[#111827] mb-2">Subscription Confirmed!</h3>
            <p className="text-[14px] leading-relaxed text-[#4B5563] max-w-[320px]">
              Thank you for joining. You will now receive product announcements and B2B pricing updates directly.
            </p>
          </div>
        ) : (
          <div className="w-full">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-[#E31E24] mb-6">
              <Mail size={24} />
            </span>
            <h3 className="text-xl font-bold text-[#111827] mb-2">Stay Updated with Modern Orthodontics</h3>
            <p className="text-[14px] leading-relaxed text-[#4B5563] mb-6 max-w-[380px] mx-auto">
              Subscribe to our B2B newsletter to receive the latest product release notes, catalog updates, and exclusive distributor promotions.
            </p>

            <form onSubmit={handleSubscribe} className="space-y-4">
              <div className="relative">
                <input
                  type="email"
                  required
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={status === "loading"}
                  className="h-11 w-full rounded-md border border-[#E0E0E0] bg-white px-4 text-[13.5px] text-[#1a1a1a] outline-none focus:border-[#E31E24] disabled:bg-[#EEF4FF]"
                />
              </div>

              {status === "error" && (
                <div className="flex items-center gap-1.5 justify-center text-[12px] font-semibold text-[#E31E24]">
                  <AlertCircle size={14} />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  type="button"
                  onClick={handleDismiss}
                  className="w-full h-11 flex items-center justify-center rounded-md border border-[#E0E0E0] text-[13px] font-semibold text-[#6B6B6B] hover:bg-[#F9FAFB] hover:text-[#111827] transition-colors order-2 sm:order-1"
                >
                  No, thanks
                </button>
                <button
                  type="submit"
                  disabled={status === "loading"}
                  className="w-full h-11 flex items-center justify-center rounded-md bg-[#E31E24] text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors disabled:opacity-60 order-1 sm:order-2"
                >
                  {status === "loading" ? "Subscribing..." : "Subscribe Now"}
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </Modal>
  );
}
