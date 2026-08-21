"use client";

import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";
import type { ProductDetail } from "@/types/product.types";
import { ORDERS_EMAIL } from "@/utils/constants";

interface ProductInfoAccordionProps {
  product: ProductDetail;
}

function RichText({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ProductInfoAccordion({ product }: ProductInfoAccordionProps) {
  const items: AccordionItemData[] = [
    {
      id: "highlights",
      title: "Highlights",
      content: (
        <ul className="space-y-3">
          {product.highlights.map((h) => (
            <li key={h.title} className="text-[14.5px] leading-relaxed text-steel">
              <strong className="text-ink">{h.title}</strong> — <RichText html={h.description} />
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "technical-specs",
      title: "Technical Specifications",
      content: (
        <table className="w-full border-collapse">
          <tbody>
            {product.technicalSpecs.map((spec) => (
              <tr key={spec.label} className="border-b border-line">
                <td className="w-[46%] py-2.5 text-[13.5px] font-medium text-ink">{spec.label}</td>
                <td className="py-2.5 text-[13.5px] text-steel">{spec.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ),
    },
    {
      id: "warranty",
      title: "Warranty",
      content: (
        <ul className="space-y-3">
          {product.warranty.map((line, i) => (
            <li key={i} className="text-[14.5px] leading-relaxed text-steel">
              {line.includes(ORDERS_EMAIL) && !line.includes("<") ? (
                <>
                  {line.split(ORDERS_EMAIL)[0]}
                  <a href={`mailto:${ORDERS_EMAIL}`} className="font-semibold text-brand">
                    {ORDERS_EMAIL}
                  </a>
                  {line.split(ORDERS_EMAIL)[1]}
                </>
              ) : (
                <RichText html={line} />
              )}
            </li>
          ))}
        </ul>
      ),
    },
    {
      id: "primary-features",
      title: "Primary Features",
      content: (
        <ul className="space-y-3">
          {product.primaryFeatures.map((f) => (
            <li key={f.title} className="text-[14.5px] leading-relaxed text-steel">
              <strong className="text-ink">{f.title}</strong> — <RichText html={f.description} />
            </li>
          ))}
        </ul>
      ),
    },
  ];

  return (
    <div className="mt-9">
      <Accordion
        items={items}
        defaultOpenIndex={0}
        variant="clean"
        headerClassName="py-5 sm:py-6 text-base font-medium text-ink"
        contentClassName="max-w-[600px] pb-6"
      />
    </div>
  );
}
