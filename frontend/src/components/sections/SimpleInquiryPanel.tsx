import { FileText, ArrowRight, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ORDERS_EMAIL } from "@/utils/constants";
import type { ProductDetail } from "@/types/product.types";

interface SimpleInquiryPanelProps {
  product: ProductDetail;
}

export function SimpleInquiryPanel({ product }: SimpleInquiryPanelProps) {
  const subject = encodeURIComponent(`Pricing Request - ${product.title}`);
  const body = encodeURIComponent(
    `Hello,\n\nPlease send pricing, MOQ and lead time for ${product.title} (${product.category}).\n\nQuantity required: \nShip to: \n\nThank you.`
  );
  const mailto = `mailto:${ORDERS_EMAIL}?subject=${subject}&body=${body}`;

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
        <div className="flex flex-col gap-2.5 sm:max-w-[360px]">
          <Button href={mailto} variant="primary" size="md" fullWidth>
            <Mail size={15} className="mr-1.5 inline" /> Request Pricing <ArrowRight size={14} className="ml-1.5 inline" />
          </Button>
          <a
            href={product.catalogueUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-2.5 rounded-pill border border-line bg-offwhite px-4 py-3 text-[13.5px] font-medium text-ink hover:border-steel-2"
          >
            <FileText size={15} className="text-brand" /> Download Product Catalogue
          </a>
        </div>
        <p className="mt-4 max-w-[480px] text-xs leading-relaxed text-steel-2">
          Includes product code {product.productCode} so our team can confirm specification, stock and pricing
          immediately.
        </p>
      </div>
    </section>
  );
}
