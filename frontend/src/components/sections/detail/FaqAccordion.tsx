"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import type { FaqItem } from "@/types/common.types";

interface FaqAccordionProps {
  items: FaqItem[];
}

export function FaqAccordion({ items }: FaqAccordionProps) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section id="faqs" className="py-16">
      <Container>
        <Reveal>
          <h2 className="mb-2 text-[clamp(24px,2.6vw,32px)] font-normal text-ink">Frequently asked questions</h2>
          <div className="mt-2">
            {items.map((item, i) => {
              const open = openIndex === i;
              return (
                <div key={item.question} className="border-b border-line">
                  <button
                    onClick={() => setOpenIndex(open ? null : i)}
                    className="flex w-full items-center justify-between gap-5 py-6 text-left text-base font-medium text-ink"
                  >
                    <span>{item.question}</span>
                    <ChevronDown
                      size={18}
                      className={`flex-none text-steel transition-transform duration-200 ${open ? "rotate-180 text-brand" : ""}`}
                    />
                  </button>
                  {open && <p className="max-w-[760px] pb-6 text-[14.5px] leading-relaxed text-steel">{item.answer}</p>}
                </div>
              );
            })}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
