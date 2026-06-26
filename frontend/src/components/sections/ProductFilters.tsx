"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { cn } from "@/utils/cn";
import type { StaticMessageKey } from "@/i18n/staticMessages";

interface FilterGroup {
  labelKey: StaticMessageKey;
  fallback: string;
  options: string[];
}

const FILTER_GROUPS: FilterGroup[] = [
  { labelKey: "ui.filters.bracketType", fallback: "Bracket Type", options: ["True Twin", "Low-Profile", "Self Ligating"] },
  { labelKey: "ui.filters.material", fallback: "Material", options: ["17-4 Low Nickel Stainless", "Ceramic", "Nickel Titanium"] },
  { labelKey: "ui.filters.prescriptionSystem", fallback: "Prescription System", options: ["MBT", "Roth"] },
  { labelKey: "ui.filters.slotSize", fallback: "Slot Size", options: [".018\"", ".022\""] },
  { labelKey: "ui.filters.orderQuantity", fallback: "Order Quantity", options: ["Loose Bracket", "Full Case"] },
  { labelKey: "ui.filters.countryOfOrigin", fallback: "Country of Origin", options: ["India"] },
];

export function ProductFilters() {
  const [openGroup, setOpenGroup] = useState<string | null>("Bracket Type");
  const { t } = useStaticTranslations();

  return (
    <aside>
      {FILTER_GROUPS.map((group) => {
        const label = t(group.labelKey);
        const open = openGroup === group.fallback;
        return (
          <div key={group.fallback} className="border-b border-line">
            <button
              onClick={() => setOpenGroup(open ? null : group.fallback)}
              className="flex w-full items-center justify-between py-4.5 text-left text-[15px] font-semibold text-ink"
            >
              {label}
              <ChevronDown size={12} className={cn("text-steel transition-transform duration-200", open && "rotate-180")} />
            </button>
            {open && (
              <div className="pb-3">
                {group.options.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2.5 py-1.5 text-[13.5px] text-steel">
                    <input type="checkbox" className="accent-brand" />
                    {opt}
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </aside>
  );
}
