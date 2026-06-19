"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/utils/cn";

interface FilterGroup {
  label: string;
  options: string[];
}

const FILTER_GROUPS: FilterGroup[] = [
  { label: "Bracket Type", options: ["True Twin", "Low-Profile", "Self Ligating"] },
  { label: "Material", options: ["17-4 Low Nickel Stainless", "Ceramic", "Nickel Titanium"] },
  { label: "Prescription System", options: ["MBT", "Roth"] },
  { label: "Slot Size", options: [".018\"", ".022\""] },
  { label: "Order Quantity", options: ["Loose Bracket", "Full Case"] },
  { label: "Country of Origin", options: ["India"] },
];

export function ProductFilters() {
  const [openGroup, setOpenGroup] = useState<string | null>("Bracket Type");

  return (
    <aside>
      {FILTER_GROUPS.map((group) => {
        const open = openGroup === group.label;
        return (
          <div key={group.label} className="border-b border-line">
            <button
              onClick={() => setOpenGroup(open ? null : group.label)}
              className="flex w-full items-center justify-between py-4.5 text-left text-[15px] font-semibold text-ink"
            >
              {group.label}
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
