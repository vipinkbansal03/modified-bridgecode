"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";
import type { ProductDetail } from "@/types/product.types";
import { ORDERS_EMAIL } from "@/utils/constants";

interface ProductInfoAccordionProps {
  product: ProductDetail;
}

function RichText({ html }: { html: string }) {
  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export function ProductInfoAccordion({ product }: ProductInfoAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const panels = [
    {
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
    <div className="mt-9 border-t border-line">
      {panels.map((panel, i) => {
        const open = openIndex === i;
        return (
          <div key={panel.title} className="border-b border-line">
            <button
              onClick={() => setOpenIndex(open ? null : i)}
              className="flex w-full items-center justify-between gap-5 py-6 text-left text-base font-medium text-ink"
            >
              <span>{panel.title}</span>
              <ChevronDown size={16} className={cn("flex-none text-steel transition-transform duration-200", open && "rotate-180 text-brand")} />
            </button>
            {open && <div className="max-w-[600px] pb-6">{panel.content}</div>}
          </div>
        );
      })}
    </div>
  );
}
