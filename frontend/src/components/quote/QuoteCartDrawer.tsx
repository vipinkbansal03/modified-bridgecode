"use client";

import { useState, useEffect, useRef } from "react";
import { X, Trash2, CheckCircle, FileText } from "lucide-react";
import { useQuoteCart } from "@/contexts/QuoteCartContext";
import { useQuoteSubmit } from "@/hooks/api";

interface Props {
  open: boolean;
  onClose: () => void;
}

function fmt(sym: string, val: number) {
  return `${sym}${val.toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

export function QuoteCartDrawer({ open, onClose }: Props) {
  const { items, totals, removeItem, clearCart } = useQuoteCart();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const { mutate: submitQuote, isPending } = useQuoteSubmit();

  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) document.body.style.overflow = "hidden";
    else document.body.style.overflow = "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name || !email || !items.length) return;

    submitQuote(
      {
        customerName: name,
        customerEmail: email,
        customerPhone: phone || undefined,
        companyName: company || undefined,
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
        onSuccess: () => {
          setSubmitted(true);
          clearCart();
        },
      }
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
            <h2 className="text-[16px] font-semibold text-ink">Quote Cart</h2>
            {items.length > 0 && (
              <span className="rounded-full bg-[#E31E24] px-2 py-0.5 text-[11px] font-semibold text-white">
                {items.length}
              </span>
            )}
          </div>
          <button onClick={onClose} className="rounded p-1 text-[#9A9A9A] hover:bg-[#F5F5F5] hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {submitted ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle size={32} className="text-emerald-600" />
            </div>
            <h3 className="text-[18px] font-semibold text-ink">Quote Submitted!</h3>
            <p className="text-[14px] text-[#6B6B6B]">
              Our team will review your request and get back to you within 24 hours.
            </p>
            <button
              onClick={() => { setSubmitted(false); onClose(); }}
              className="mt-2 rounded bg-[#E31E24] px-6 py-2.5 text-[14px] font-semibold text-white hover:bg-[#B5151B]"
            >
              Close
            </button>
          </div>
        ) : (
          <>
            {/* Cart items */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {items.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <p className="text-[14px] text-[#9A9A9A]">Your quote cart is empty.</p>
                  <p className="mt-1 text-[12px] text-[#B0B0B0]">Add variants from a product page to get started.</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {items.map((item) => (
                      <div key={item.variantId} className="flex items-start justify-between gap-3 rounded-lg border border-[#E6E6E6] p-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[12px] text-[#9A9A9A] truncate">{item.productTitle}</p>
                          <p className="text-[13.5px] font-medium text-ink truncate">{item.variantTitle}</p>
                          {item.sku && <p className="mt-0.5 font-mono text-[11px] text-[#B0B0B0]">{item.sku}</p>}
                          <div className="mt-1 flex flex-wrap gap-1">
                            {Object.entries(item.selectedAttributes).map(([k, v]) => (
                              <span key={k} className="rounded bg-[#F5F5F5] px-1.5 py-0.5 text-[10.5px] text-[#6B6B6B]">
                                {k}: {v}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-[13.5px] font-semibold text-ink">
                            {item.currencySymbol}{(item.unitPrice * item.quantity).toLocaleString("en-IN")}
                          </p>
                          <p className="text-[11.5px] text-[#9A9A9A]">
                            {item.quantity} × {item.currencySymbol}{item.unitPrice.toLocaleString("en-IN")}
                          </p>
                          <button
                            onClick={() => removeItem(item.variantId)}
                            className="mt-1.5 text-[#9A9A9A] hover:text-[#E31E24]"
                            aria-label="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Totals */}
                  <div className="mt-4 rounded-lg border border-[#E6E6E6] p-4">
                    <div className="space-y-1.5 text-[13px]">
                      <div className="flex justify-between text-[#6B6B6B]">
                        <span>Subtotal ({totals.totalQuantity} units)</span>
                        <span>{fmt(totals.currencySymbol, totals.subtotal)}</span>
                      </div>
                      {totals.discountPercentage > 0 && (
                        <div className="flex justify-between text-emerald-600">
                          <span>Volume discount ({totals.discountPercentage}%)</span>
                          <span>−{fmt(totals.currencySymbol, totals.discountAmount)}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-t border-[#F0F0F0] pt-2 text-[14.5px] font-semibold text-ink">
                        <span>Estimated Total</span>
                        <span>{fmt(totals.currencySymbol, totals.grandTotal)}</span>
                      </div>
                    </div>
                  </div>

                  {/* RFQ form */}
                  <form onSubmit={handleSubmit} className="mt-5 space-y-3">
                    <p className="text-[13px] font-medium text-ink">Submit Request for Quote</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">Full Name *</label>
                        <input
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder="Dr. John Smith"
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">Email *</label>
                        <input
                          required
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="you@clinic.com"
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">Phone</label>
                        <input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+91 9876543210"
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">Company / Clinic</label>
                        <input
                          value={company}
                          onChange={(e) => setCompany(e.target.value)}
                          placeholder="Clinic name"
                          className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-[11.5px] font-medium text-[#6B6B6B]">Additional Notes</label>
                      <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder="Delivery timeline, special requirements..."
                        rows={2}
                        className="w-full rounded border border-[#E6E6E6] px-3 py-2 text-[13px] focus:border-[#E31E24] focus:outline-none resize-none"
                      />
                    </div>
                    <button
                      type="submit"
                      disabled={isPending || !name || !email}
                      className="w-full rounded bg-[#E31E24] py-3 text-[14px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                    >
                      {isPending ? "Submitting…" : "Submit Quote Request"}
                    </button>
                  </form>

                  <button
                    type="button"
                    onClick={clearCart}
                    className="mt-3 w-full text-center text-[12px] text-[#9A9A9A] hover:text-[#E31E24]"
                  >
                    Clear cart
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
