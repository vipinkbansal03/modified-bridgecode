"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, CheckCircle, FileText } from "lucide-react";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useQuoteSubmit } from "@/hooks/api";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { useToast } from "@/components/ui/ToastProvider";
import LoadingButton from "@/components/ui/LoadingSpinner/LoadingButton";

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmt(sym: string, val: number) {
  return `${sym}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function getQuoteErrorMessage(error: unknown) {
  if (typeof error === "object" && error && "response" in error) {
    const apiMessage = (error as { response?: { data?: { message?: string } } })
      .response?.data?.message;
    if (apiMessage) return apiMessage;
  }

  return error instanceof Error && error.message
    ? error.message
    : "Quote request could not be submitted. Please try again.";
}

export function QuoteCartDrawer({ open, onClose }: Props) {
  const { items, totals, removeItem, clearCart } = useQuoteCart();
  const { t } = useStaticTranslations();
  const { showToast } = useToast();
  const { currentCustomer } = useCustomerAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const { mutate: submitQuote, isPending } = useQuoteSubmit();

  const hasUnavailableItems = items.some((item) => item.priceUnavailable);

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!currentCustomer || !open) return;

    setName((prev) => {
      if (prev.trim()) return prev;

      return [currentCustomer.firstName, currentCustomer.lastName]
        .filter(Boolean)
        .join(" ");
    });

    setEmail((prev) => prev || currentCustomer.email || "");

    setPhone((prev) => prev || currentCustomer.phone || "");

    setCompany((prev) => prev || currentCustomer.companyName || "");
  }, [currentCustomer, open]);

  const { selectedCountryCode } = useCurrencyContext();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !items.length) return;
    setSubmitError("");

    submitQuote(
      {
        customerName: name,
        customerEmail: email,
        customerPhone: phone || undefined,
        companyName: company || undefined,
        countryCode: selectedCountryCode,
        items: items.map((i) => ({
          productId: i.productId,
          variantId: i.variantId,
          productTitle: i.variantTitle,
          sku: i.sku ?? undefined,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
        })),
        message: message || undefined,
      },
      {
        onSuccess: (result) => {
          setSubmitted(true);
          clearCart();
          showToast({
            type: "success",
            title: "Quote Request Submitted",
            message: "We'll review your request and contact you soon.",
          });
        },
        onError: (error) => {
          const errorMessage = getQuoteErrorMessage(error);
          setSubmitError(errorMessage);
          showToast({
            type: "error",
            title: "Quote request failed",
            message: errorMessage,
          });
        },
      },
    );
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        ref={overlayRef}
        className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />
      {/* Drawer */}
      <div className="fixed right-0 top-0 z-[61] flex h-full w-full max-w-[480px] flex-col bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#E6E6E6] px-5 py-4">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-[#E31E24]" />
            <h2 className="text-[16px] font-semibold text-ink">
              {t("ui.quote.cartTitle")}
            </h2>
            {items.length > 0 && (
              <span className="rounded-full bg-[#E31E24] px-2 py-0.5 text-[11px] font-semibold text-white">
                {items.length}
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            className="rounded p-1 text-[#9A9A9A] hover:bg-[#F5F5F5] hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-[18px] font-semibold text-ink">
              {t("ui.quote.submittedTitle")}
            </h3>
            <p className="text-[14px] text-[#6B6B6B]">
              {t("ui.quote.submittedBody")}
            </p>
            <button
              onClick={() => {
                setSubmitted(false);
                onClose();
              }}
              className="mt-2 rounded bg-[#E31E24] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#B5151B]"
            >
              {t("ui.quote.close")}
            </button>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="custom-scrollbar flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[14px] text-[#9A9A9A]">
                    {t("ui.quote.emptyTitle")}
                  </p>
                  <p className="mt-1 text-[12px] text-[#B0B0B0]">
                    {t("ui.quote.emptyBody")}
                  </p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div
                        key={item.variantId}
                        className="flex items-start justify-between gap-3 rounded-lg border border-[#E6E6E6] p-3"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[#9A9A9A] truncate">
                            {item.productTitle}
                          </p>
                          <p className="text-[13.5px] font-medium text-ink truncate">
                            {item.variantTitle}
                          </p>
                          {item.sku && (
                            <p className="mt-0.5 font-mono text-[11px] text-[#B0B0B0]">
                              {item.sku}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(item.selectedAttributes).map(
                              ([k, v]) => (
                                <span
                                  key={k}
                                  className="rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10.5px] text-[#6B6B6B]"
                                >
                                  {k}: {v}
                                </span>
                              ),
                            )}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13.5px] font-semibold text-ink">
                            {item.priceUnavailable || item.unitPrice <= 0
                              ? "Price Upon Request"
                              : fmt(
                                  item.currencySymbol,
                                  item.unitPrice * item.quantity,
                                )}
                          </p>

                          <p className="text-[11.5px] text-[#9A9A9A]">
                            {item.priceUnavailable || item.unitPrice <= 0
                              ? `${item.quantity} units`
                              : `${item.quantity} × ${fmt(item.currencySymbol, item.unitPrice)}`}
                          </p>
                          <button
                            onClick={() => removeItem(item.variantId)}
                            className="mt-1.5 text-[#9A9A9A] hover:text-[#E31E24]"
                            aria-label={t("ui.quote.remove")}
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {hasUnavailableItems && (
                    <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-4 py-3">
                      <p className="text-[13px] font-semibold text-red-700">
                        Price unavailable
                      </p>

                      <p className="mt-1 text-[12px] leading-relaxed text-red-600">
                        {items.find((item) => item.priceUnavailable)
                          ?.priceUnavailableMessage ??
                          "One or more products do not have pricing configured for the selected country."}
                      </p>
                    </div>
                  )}

                  {/* Totals */}
                  <div className="mt-4 rounded-lg border border-[#E6E6E6] p-4">
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between text-[#6B6B6B]">
                        <span>
                          {t("ui.quote.subtotalUnits", {
                            units: totals.totalQuantity,
                          })}
                        </span>
                        <span>
                          {hasUnavailableItems || totals.subtotal <= 0
                            ? "Price Upon Request"
                            : fmt(totals.currencySymbol, totals.subtotal)}
                        </span>
                      </div>
                      {!hasUnavailableItems &&
                        totals.subtotal > 0 &&
                        totals.discountPercentage > 0 && (
                          <div className="flex justify-between text-emerald-600">
                            <span>
                              {t("ui.quote.volumeDiscount", {
                                percent: totals.discountPercentage,
                              })}
                            </span>
                            <span>
                              −
                              {fmt(
                                totals.currencySymbol,
                                totals.discountAmount,
                              )}
                            </span>
                          </div>
                        )}
                      <div className="mt-2 border-t border-[#E6E6E6] pt-2 font-semibold text-ink flex justify-between text-[14px]">
                        <span>{t("ui.quote.estimatedTotal")}</span>
                        <span>
                          {hasUnavailableItems || totals.grandTotal <= 0
                            ? "Price Upon Request"
                            : fmt(totals.currencySymbol, totals.grandTotal)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* RFQ form */}
                  <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                    <p className="text-[13px] font-medium text-ink">
                      {t("ui.quote.submitRequestTitle")}
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">
                          {t("ui.quote.fullName")}
                        </label>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={t("ui.quote.fullNamePlaceholder")}
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">
                          {t("ui.quote.email")}
                        </label>
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder={t("ui.quote.emailPlaceholder")}
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">
                          {t("ui.quote.phone")}
                        </label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder={t("ui.quote.phonePlaceholder")}
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">
                          {t("ui.quote.companyClinic")}
                        </label>
                        <input
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder={t("ui.quote.companyPlaceholder")}
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">
                        {t("ui.quote.additionalNotes")}
                      </label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={t("ui.quote.notesPlaceholder")}
                        rows={2}
                        className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none resize-none"
                      />
                    </div>
                    {submitError && (
                      <div
                        role="alert"
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[12.5px] leading-relaxed text-[#E31E24]"
                      >
                        {submitError}
                      </div>
                    )}
                    <LoadingButton
                      type="submit"
                      loading={isPending}
                      loadingText={t("ui.quote.submitting")}
                      disabled={
                        !name ||
                        !email ||
                        items.some((item) => item.priceUnavailable)
                      }
                      className="w-full rounded bg-[#E31E24] py-3 text-[14px] font-semibold text-white enabled:hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:bg-gray-400 disabled:opacity-100"
                    >
                      {t("ui.quote.submitQuoteRequest")}
                    </LoadingButton>
                  </form>

                  <button
                    type="button"
                    onClick={clearCart}
                    className="mt-3 w-full text-center text-[12px] text-[#9A9A9A] hover:text-[#E31E24]"
                  >
                    {t("ui.quote.clearCart")}
                  </button>
                </>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}
