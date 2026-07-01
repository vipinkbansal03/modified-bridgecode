"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

type PrivacySection = {
  title: string;
  items: string[];
};

export function PrivacyAccordion({ sections }: { sections: PrivacySection[] }) {
  const [openIndex, setOpenIndex] = useState(0);

  return (
    <div className="space-y-3 lg:hidden">
      {sections.map((section, index) => {
        const isOpen = openIndex === index;

        return (
          <section key={section.title} className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? -1 : index)}
              className="flex w-full items-center justify-between gap-4 px-4 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#FFF1F1] text-[13px] font-bold text-[#E31E24]">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="break-words text-[17px] font-semibold leading-tight tracking-[-0.01em] text-ink">
                  {section.title}
                </span>
              </span>
              <ChevronDown
                size={18}
                className={`shrink-0 text-steel transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-line px-4 pb-5 pt-4">
                <ul className="space-y-3">
                  {section.items.map((item) => (
                    <li key={item} className="flex gap-3 text-[14px] leading-6 text-steel">
                      <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#E31E24]" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        );
      })}
    </div>
  );
}
