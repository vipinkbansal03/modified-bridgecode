"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useCurrencies } from "@/hooks/api/useCurrencies";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { cn } from "@/utils/cn";

export function CurrencySwitcher() {
  const { data: currencies = [] } = useCurrencies();
  const { selectedCurrency, setSelectedCurrency } = useCurrencyContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const active = currencies.find((c) => c.code === selectedCurrency) ?? currencies[0];
  if (!active) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[13.5px] font-medium text-ink hover:text-brand"
      >
        <span>{active.symbol}</span>
        <span>{active.code}</span>
        <ChevronDown size={11} className={cn("opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[148px] rounded-md border border-line bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          {currencies.map((c) => (
            <button
              key={c.id}
              onClick={() => { setSelectedCurrency(c.code); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between px-3.5 py-2 text-[13.5px] hover:bg-offwhite",
                c.code === selectedCurrency ? "font-semibold text-brand" : "text-ink"
              )}
            >
              <span>{c.symbol} {c.code}</span>
              <span className="text-xs text-steel-2">{c.name.split(" ")[0]}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
