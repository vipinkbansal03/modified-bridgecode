"use client";

import { Accordion, type AccordionItemData } from "@/components/ui/Accordion";

type PrivacySection = {
  title: string;
  items: string[];
};

export function PrivacyAccordion({ sections }: { sections: PrivacySection[] }) {
  const items: AccordionItemData[] = sections.map((section, index) => ({
    id: `privacy-${index}`,
    title: section.title,
    badge: (
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F1] text-[13px] font-bold text-[#E31E24]">
        {String(index + 1).padStart(2, "0")}
      </span>
    ),
    content: (
      <ul className="space-y-3 pt-3">
        {section.items.map((item) => (
          <li key={item} className="flex gap-3 text-[14px] leading-6 text-steel">
            <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E31E24]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    ),
  }));

  return (
    <div className="lg:hidden">
      <Accordion items={items} variant="card" defaultOpenIndex={0} />
    </div>
  );
}
