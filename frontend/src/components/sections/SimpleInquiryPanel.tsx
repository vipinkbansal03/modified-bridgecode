"use client";

import { useState } from "react";
import { FileText, ArrowRight, Mail, CheckCircle, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ORDERS_EMAIL } from "@/utils/constants";
import { useQuoteSubmit } from "@/hooks/api/useQuoteSubmit";
import { useToast } from "@/components/ui/ToastProvider";
import type { ProductDetail } from "@/types/product.types";

interface SimpleInquiryPanelProps {
  product: ProductDetail;
  productId?: string;
}

export function SimpleInquiryPanel({ product, productId }: SimpleInquiryPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState("");
  const [success, setSuccess] = useState(false);
  const [quoteError, setQuoteError] = useState("");
  const { mutate: submitQuote, isPending } = useQuoteSubmit();
  const { showToast } = useToast();

  const subject = encodeURIComponent(`Pricing Request - ${product.title}`);
  const body = encodeURIComponent(
    `Hello,\n\nPlease send pricing, MOQ and lead time for ${product.title} (${product.category}).\n\nQuantity required: \nShip to: \n\nThank you.`
  );
  const mailto = `mailto:${ORDERS_EMAIL}?subject=${subject}&body=${body}`;

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setQuoteError("");

    if (!name.trim() || !email.trim()) return;

    if (!productId) {
      const errorMessage = "This product is not connected to the backend RFQ catalogue yet. Please sync the product before submitting a quote.";
      setQuoteError(errorMessage);
      showToast({ type: "error", title: "Quote request unavailable", message: errorMessage });
      return;
    }

    submitQuote(
      {
        customerName: name.trim(),
        customerEmail: email.trim(),
        items: [
          {
            productId,
            productTitle: product.title,
            quantity: Math.max(1, quantity),
            unitPrice: 0,
          },
        ],
        message: message.trim() || `Pricing, MOQ and lead time request for ${product.title} (${product.category}).`,
      },
      {
        onSuccess: (result) => {
          setSuccess(true);
          setFormOpen(false);
          setName("");
          setEmail("");
          setQuantity(1);
          setMessage("");
          showToast({
            type: "success",
            title: "Quote request submitted",
            message: result.quoteNumber
              ? `Reference ${result.quoteNumber} has been sent to the admin quote desk.`
              : "Your RFQ has been sent to the admin quote desk.",
          });
        },
        onError: () => {
          const errorMessage = "Quote request could not be submitted. Please try again.";
          setQuoteError(errorMessage);
          showToast({ type: "error", title: "Quote request failed", message: errorMessage });
        },
      },
    );
  }

  return (
    <section className="pt-16">
      <div className="mb-7.5 max-w-[680px]">
        <span className="mb-2.5 block text-[13px] font-medium uppercase tracking-wide text-brand">Pricing &amp; Availability</span>
        <h2 className="text-[clamp(24px,2.8vw,32px)] font-normal tracking-tight text-ink">Request pricing for {product.title}</h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-steel">
          Specifications for this item vary by case requirement, so pricing and minimum order quantities are
          confirmed directly with our team rather than calculated online. Send a request and we&apos;ll reply with
          current pricing and lead time.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white p-7">
        <div className="flex flex-col gap-2.5 sm:max-w-[420px]">
          {success ? (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50 p-4 text-center">
              <CheckCircle size={26} className="mx-auto mb-2 text-emerald-600" />
              <p className="text-[14px] font-semibold text-ink">Quote request submitted.</p>
              <p className="mt-1 text-[12.5px] leading-relaxed text-steel">Our team will review it from Admin Quote Requests and reply with pricing.</p>
              <button type="button" onClick={() => setSuccess(false)} className="mt-2 text-xs font-medium text-brand hover:underline">
                Submit another request
              </button>
            </div>
          ) : formOpen ? (
            <form onSubmit={handleSubmit} className="rounded-lg border border-line bg-offwhite p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <span className="text-[13px] font-semibold text-ink">Your quote details</span>
                <button type="button" onClick={() => setFormOpen(false)} className="text-steel-2 hover:text-ink" aria-label="Close quote form">
                  <X size={15} />
                </button>
              </div>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Your name"
                className="mb-2 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel-2"
              />
              <input
                required
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="Work email"
                className="mb-2 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel-2"
              />
              <input
                min={1}
                type="number"
                value={quantity}
                onChange={(event) => setQuantity(Math.max(1, Number(event.target.value) || 1))}
                placeholder="Quantity required"
                className="mb-2 w-full rounded-md border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel-2"
              />
              <textarea
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                placeholder="Notes, ship-to country, or specification details"
                rows={3}
                className="mb-3 w-full resize-none rounded-md border border-line bg-white px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel-2"
              />
              {quoteError && <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-xs leading-relaxed text-brand">{quoteError}</p>}
              <button
                type="submit"
                disabled={isPending}
                className="flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 py-3 text-[13.5px] font-semibold text-white transition hover:bg-[#B5151B] disabled:opacity-60"
              >
                {isPending ? "Submitting..." : <>Send Quote Request <ArrowRight size={14} /></>}
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="flex w-full items-center justify-center gap-2 rounded-pill bg-brand px-4 py-3 text-[13.5px] font-semibold text-white transition hover:bg-[#B5151B]"
            >
              <Mail size={15} /> Request Pricing <ArrowRight size={14} />
            </button>
          )}
          <a
            href={product.catalogueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 rounded-pill border border-line bg-offwhite px-4 py-3 text-[13.5px] font-medium text-ink hover:border-steel-2"
          >
            <FileText size={15} className="text-brand" /> Download Product Catalogue
          </a>
        </div>
        {!productId && (
          <p className="mt-3 max-w-[480px] text-xs leading-relaxed text-steel-2">
            Backend RFQ submission needs this product to exist in the synced catalogue. Until then, use{" "}
            <a href={mailto} className="font-medium text-brand hover:underline">
              email request
            </a>{" "}
            as a fallback.
          </p>
        )}
        <p className="mt-4 max-w-[480px] text-xs leading-relaxed text-steel-2">
          Includes product code {product.productCode} so our team can confirm specification, stock and pricing
          immediately.
        </p>
      </div>
    </section>
  );
}
