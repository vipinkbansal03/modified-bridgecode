"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { useCountries, useCurrencies } from "@/hooks/api/useCurrencies";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { cn } from "@/utils/cn";

export function CurrencySwitcher() {
  const { data: currencies = [] } = useCurrencies();
  const { data: countries = [] } = useCountries();
  const { selectedCurrency, selectedCountryCode, setSelectedCountryCode } = useCurrencyContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const activeCountry = countries.find((country) => country.code === selectedCountryCode) ?? countries.find((country) => country.isDefault) ?? countries[0];
  const active = activeCountry?.currency ?? currencies.find((c) => c.code === selectedCurrency) ?? currencies[0];
  if (!active) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[13.5px] font-medium text-ink hover:text-brand"
      >
        {activeCountry && <span>{activeCountry.code}</span>}
        <span>{active.symbol}</span>
        <span>{active.code}</span>
        <ChevronDown size={11} className={cn("opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[190px] rounded-md border border-line bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          {countries.map((country) => (
            <button
              key={country.id}
              onClick={() => { setSelectedCountryCode(country.code); setOpen(false); }}
              className={cn(
                "flex w-full items-center justify-between px-3.5 py-2 text-[13.5px] hover:bg-offwhite",
                country.code === selectedCountryCode ? "font-semibold text-brand" : "text-ink"
              )}
            >
              <span>{country.name}</span>
              <span className="text-xs text-steel-2">{country.currency.symbol} {country.currency.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
