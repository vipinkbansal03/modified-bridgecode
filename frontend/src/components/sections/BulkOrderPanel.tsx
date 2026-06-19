"use client";

import { useMemo, useState } from "react";
import { FileText, ArrowRight, CheckCircle, Mail, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { formatCurrency } from "@/utils/formatCurrency";
import { ORDERS_EMAIL } from "@/utils/constants";
import { cn } from "@/utils/cn";
import { useQuoteSubmit } from "@/hooks/api/useQuoteSubmit";
import type { ProductDetail } from "@/types/product.types";

type FullConfigProduct = ProductDetail &
  Required<Pick<ProductDetail, "prescriptionOptions" | "slotOptions" | "packagingOptions" | "discountTiers">>;

interface BulkOrderPanelProps {
  product: FullConfigProduct;
  /** Backend product ID (cuid). When provided, quotes go via API; otherwise falls back to mailto. */
  productId?: string;
}

function buildOrderMailto(product: FullConfigProduct, config: { prescription: string; slot: string; packaging: string; qty: number; total: number }) {
  const subject = encodeURIComponent(`Order Request - ${product.title}`);
  const body = encodeURIComponent(
    `I would like to place an order for the configuration below.\n\n` +
      `Product: ${product.title}\n` +
      `Prescription: ${config.prescription}\n` +
      `Slot Size: ${config.slot}\n` +
      `Packaging: ${config.packaging}\n` +
      `Quantity: ${config.qty}\n` +
      `Estimated Total: ${formatCurrency(config.total)}\n`
  );
  return `mailto:${ORDERS_EMAIL}?subject=${subject}&body=${body}`;
}

export function BulkOrderPanel({ product, productId }: BulkOrderPanelProps) {
  const [prescription, setPrescription] = useState(product.prescriptionOptions[0]);
  const [slot, setSlot] = useState(product.slotOptions[0]);
  const [packagingIndex, setPackagingIndex] = useState(0);
  const [qty, setQty] = useState(10);

  const [quoteOpen, setQuoteOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [quoteSuccess, setQuoteSuccess] = useState(false);

  const { mutate: submitQuote, isPending: quoteSubmitting } = useQuoteSubmit();

  const packaging = product.packagingOptions[packagingIndex];

  const { subtotal, discount, total, activeTierIndex } = useMemo(() => {
    const sub = packaging.unitPriceInr * Math.max(1, qty);
    let tierIdx = 0;
    let rate = 0;
    product.discountTiers.forEach((tier, i) => {
      if (sub >= tier.thresholdInr) {
        rate = tier.rate;
        tierIdx = i;
      }
    });
    const disc = sub * rate;
    return { subtotal: sub, discount: disc, total: sub - disc, activeTierIndex: tierIdx };
  }, [packaging, qty, product.discountTiers]);

  const config = { prescription, slot, packaging: packaging.label, qty: Math.max(1, qty), total };

  function handleQuoteSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;

    if (!productId) {
      // Fallback: open mailto with filled config
      window.location.href = `mailto:${ORDERS_EMAIL}?subject=${encodeURIComponent(`Quote Request - ${product.title}`)}&body=${encodeURIComponent(
        `Name: ${name}\nEmail: ${email}\n\nProduct: ${product.title}\nPrescription: ${prescription}\nSlot Size: ${slot}\nPackaging: ${packaging.label}\nQuantity: ${qty}\nEstimated Total: ${formatCurrency(total)}`
      )}`;
      return;
    }

    submitQuote(
      {
        customerName: name,
        customerEmail: email,
        items: [
          {
            productId,
            productTitle: `${product.title} — ${prescription} / ${slot} / ${packaging.label}`,
            quantity: qty,
            unitPrice: packaging.unitPriceInr,
          },
        ],
        message: `Prescription: ${prescription} | Slot: ${slot} | Packaging: ${packaging.label}`,
      },
      {
        onSuccess: () => {
          setQuoteSuccess(true);
          setQuoteOpen(false);
          setName("");
          setEmail("");
        },
      }
    );
  }

  return (
    <section className="pt-16">
      <div className="mb-7.5 max-w-[680px]">
        <span className="mb-2.5 block text-[13px] font-medium uppercase tracking-wide text-brand">B2B Ordering</span>
        <h2 className="text-[clamp(24px,2.8vw,32px)] font-normal tracking-tight text-ink">
          Configure quantity and order, or request a quote
        </h2>
        <p className="mt-2.5 text-[14.5px] leading-relaxed text-steel">
          Select prescription, slot size and packaging below. Totals update automatically — place the order
          directly, or send the same configuration to our team as a formal quote request.
        </p>
      </div>

      <div className="rounded-lg border border-line bg-white">
        <div className="flex items-start justify-between gap-4.5 border-b border-line p-6">
          <div>
            <h3 className="mb-1.5 text-[19px] font-medium text-ink">{product.title} — Bulk Order</h3>
            <p className="text-[13.5px] text-steel">Stock availability and final dealer pricing are confirmed by our team before dispatch.</p>
          </div>
          <span className="flex flex-none items-center gap-1.5 whitespace-nowrap rounded-pill border border-line bg-grey px-3.5 py-1.5 text-xs font-semibold text-ink">
            <span className="h-1.5 w-1.5 flex-none rounded-full bg-brand" /> In Stock — Ludhiana
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5.5 p-7 sm:grid-cols-[1fr_320px]">
          <div>
            <div className="mb-5.5">
              <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">Prescription</span>
              <div className="flex flex-wrap gap-2">
                {product.prescriptionOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setPrescription(opt)}
                    className={cn(
                      "rounded-pill border px-4 py-2.5 text-[13.5px] font-medium transition-colors",
                      prescription === opt ? "border-brand text-brand bg-white" : "border-line bg-offwhite text-ink hover:bg-white hover:border-steel-2"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5.5">
              <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">Slot Size</span>
              <div className="flex flex-wrap gap-2">
                {product.slotOptions.map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSlot(opt)}
                    className={cn(
                      "rounded-pill border px-4 py-2.5 text-[13.5px] font-medium transition-colors",
                      slot === opt ? "border-brand text-brand bg-white" : "border-line bg-offwhite text-ink hover:bg-white hover:border-steel-2"
                    )}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-5.5">
              <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">Packaging</span>
              <div className="flex flex-wrap gap-2">
                {product.packagingOptions.map((opt, i) => (
                  <button
                    key={opt.label}
                    onClick={() => setPackagingIndex(i)}
                    className={cn(
                      "rounded-pill border px-4 py-2.5 text-[13.5px] font-medium transition-colors",
                      packagingIndex === i ? "border-brand text-brand bg-white" : "border-line bg-offwhite text-ink hover:bg-white hover:border-steel-2"
                    )}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="mb-2.5 block text-xs font-semibold uppercase tracking-wide text-steel-2">Quantity</span>
              <div className="flex max-w-[160px] items-center justify-between rounded-pill border border-line bg-white p-1.5">
                <button
                  aria-label="Decrease"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-offwhite text-ink"
                >
                  −
                </button>
                <input
                  type="number"
                  min={1}
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                  className="w-[60px] border-0 text-center text-[15px] font-semibold text-ink outline-none"
                />
                <button
                  aria-label="Increase"
                  onClick={() => setQty((q) => q + 1)}
                  className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-offwhite text-ink"
                >
                  +
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-lg border border-line bg-offwhite p-5.5">
            <div className="mb-4.5 grid grid-cols-2 gap-2.5">
              <div className="rounded-md border border-line bg-white p-3.5">
                <span className="mb-1 block text-[11.5px] uppercase tracking-wide text-steel-2">Unit Price</span>
                <strong className="text-[17px] font-semibold text-ink">{formatCurrency(packaging.unitPriceInr)}</strong>
              </div>
              <div className="rounded-md border border-line bg-white p-3.5">
                <span className="mb-1 block text-[11.5px] uppercase tracking-wide text-steel-2">Selected</span>
                <strong className="text-[17px] font-semibold text-ink">
                  {prescription} {slot}
                </strong>
              </div>
            </div>

            <div className="grid gap-2 border-t border-line pt-4">
              <div className="flex justify-between gap-4 text-[13.5px] text-steel">
                <span>Subtotal</span>
                <strong className="font-semibold text-ink">{formatCurrency(subtotal)}</strong>
              </div>
              <div className="flex justify-between gap-4 text-[13.5px] text-steel">
                <span>Volume Discount</span>
                <strong className="font-semibold text-ink">{formatCurrency(discount)}</strong>
              </div>
              <div className="mt-1 flex justify-between gap-4 border-t border-dashed border-line pt-2.5 text-lg text-ink">
                <span>Estimated Total</span>
                <strong>{formatCurrency(total)}</strong>
              </div>
            </div>

            <div className="my-4.5 grid gap-2">
              {product.discountTiers.map((tier, i) => (
                <div
                  key={tier.label}
                  className={cn(
                    "flex justify-between gap-2.5 rounded-md border px-3 py-2.5 text-xs text-steel",
                    activeTierIndex === i ? "border-brand bg-white" : "border-line bg-white"
                  )}
                >
                  <span>{tier.label}</span>
                  <strong className={cn("font-semibold", activeTierIndex === i ? "text-brand" : "text-ink")}>
                    {tier.rate ? `${Math.round(tier.rate * 100)}% off` : "No discount"}
                  </strong>
                </div>
              ))}
            </div>

            {quoteSuccess ? (
              <div className="flex flex-col items-center gap-2 rounded-lg border border-line bg-white p-5 text-center">
                <CheckCircle size={28} className="text-brand" />
                <p className="text-[14px] font-medium text-ink">Quote submitted!</p>
                <p className="text-[13px] text-steel">Our team will reply within 24 hours with pricing and availability.</p>
                <button onClick={() => setQuoteSuccess(false)} className="mt-1 text-xs text-steel-2 underline">
                  Submit another
                </button>
              </div>
            ) : quoteOpen ? (
              <form onSubmit={handleQuoteSubmit} className="rounded-lg border border-line bg-white p-4">
                <div className="mb-3 flex items-center justify-between">
                  <span className="text-[13px] font-semibold text-ink">Your contact details</span>
                  <button type="button" onClick={() => setQuoteOpen(false)} className="text-steel-2 hover:text-ink">
                    <X size={15} />
                  </button>
                </div>
                <input
                  required
                  placeholder="Your name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mb-2 w-full rounded-md border border-line px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel-2"
                />
                <input
                  required
                  type="email"
                  placeholder="Work email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mb-3 w-full rounded-md border border-line px-3 py-2.5 text-[13.5px] text-ink outline-none focus:border-steel-2"
                />
                <button
                  type="submit"
                  disabled={quoteSubmitting}
                  className="flex w-full items-center justify-center gap-2 rounded-md bg-ink px-4 py-2.5 text-[13.5px] font-medium text-white hover:bg-ink/90 disabled:opacity-60"
                >
                  {quoteSubmitting ? "Submitting…" : <>Send Quote Request <ArrowRight size={13} /></>}
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-2.5">
                <Button href={buildOrderMailto(product, config)} variant="primary" size="md" fullWidth>
                  Place Order <ArrowRight size={14} className="ml-1.5 inline" />
                </Button>
                <button
                  onClick={() => setQuoteOpen(true)}
                  className="flex w-full items-center justify-center gap-2 rounded-md border border-line bg-white px-4 py-2.5 text-[13.5px] font-medium text-ink hover:border-steel-2"
                >
                  <FileText size={15} className="text-brand" /> Request a Quote
                </button>
              </div>
            )}
            <p className="mt-3.5 text-xs leading-relaxed text-steel-2">
              Both options email our orders team with this exact configuration. Final confirmation and dealer
              pricing follow by reply.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <a
          href={product.catalogueUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 rounded-md border border-line bg-white px-4 py-3.5 text-[13.5px] font-medium text-ink hover:border-steel-2"
        >
          <FileText size={16} className="text-brand" /> Download Product Catalogue
        </a>
        <a
          href="/quality-certifications"
          className="flex items-center gap-2.5 rounded-md border border-line bg-white px-4 py-3.5 text-[13.5px] font-medium text-ink hover:border-steel-2"
        >
          <FileText size={16} className="text-brand" /> Instructions for Use &amp; Compliance
        </a>
      </div>
    </section>
  );
}
