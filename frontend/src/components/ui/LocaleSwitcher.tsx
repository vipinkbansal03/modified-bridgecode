"use client";

import { useEffect, useRef, useState, useMemo } from "react";
import { Check, ChevronDown, Globe, Search, Lock, Info } from "lucide-react";
import { useCountries, useCurrencies } from "@/hooks/api/useCurrencies";
import { useLanguages } from "@/hooks/api/useLanguages";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/utils/cn";

interface LocaleSwitcherProps {
  openUp?: boolean;
  align?: "left" | "right";
}

export function LocaleSwitcher({ openUp = false, align = "right" }: LocaleSwitcherProps) {
  const router = useRouter();
  const { selectedCountryCode, setSelectedCountryCode } = useCurrencyContext();
  const { selectedLanguage, setSelectedLanguage } = useLanguageContext();

  const [open, setOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [isMobile, setIsMobile] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: countries = [], refetch: refetchCountries } = useCountries();
  const { data: currencies = [] } = useCurrencies();
  const { data: languages = [] } = useLanguages();

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const activeCountry = useMemo(() => {
    return (
      countries.find((country) => country.code === selectedCountryCode) ??
      countries.find((country) => country.isDefault) ??
      countries[0]
    );
  }, [countries, selectedCountryCode]);

  const activeLanguage = useMemo(() => {
    return (
      languages.find((language) => language.code === selectedLanguage) ??
      languages.find((language) => language.isDefault) ??
      languages[0]
    );
  }, [languages, selectedLanguage]);

  // Derived active currency code from currently selected country
  const activeCurrencyCode = activeCountry?.currency?.code || "USD";

  // Filtered countries for future-proof scaling (7, 15+ countries)
  const filteredCountries = useMemo(() => {
    if (!countrySearch.trim()) return countries;
    const query = countrySearch.toLowerCase().trim();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(query) ||
        c.code.toLowerCase().includes(query),
    );
  }, [countries, countrySearch]);

  // Dynamically collect unique currencies belonging ONLY to the active countries in the list
  const countryCurrencies = useMemo(() => {
    const map = new Map<string, { code: string; name: string; symbol: string; countryNames: string[] }>();

    countries.forEach((c) => {
      if (c.currency?.code) {
        const existing = map.get(c.currency.code);
        if (existing) {
          if (!existing.countryNames.includes(c.name)) {
            existing.countryNames.push(c.name);
          }
        } else {
          map.set(c.currency.code, {
            code: c.currency.code,
            name: c.currency.name || c.currency.code,
            symbol: c.currency.symbol || "$",
            countryNames: [c.name],
          });
        }
      }
    });

    return Array.from(map.values());
  }, [countries]);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const renderContent = (
    <div className="divide-y divide-line">
      {/* Country Section with Search & Scaling */}
      <div className="p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <h4 className="text-xs font-bold uppercase tracking-wider text-steel">
            Select Country
          </h4>
          <span className="rounded-full bg-grey px-2 py-0.5 text-[11px] font-normal text-steel">
            {countries.length} {countries.length === 1 ? "Country" : "Countries"}
          </span>
        </div>

        {/* Search Bar for 5+ countries */}
        {countries.length > 4 && (
          <div className="relative mb-2">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-steel"
            />
            <input
              type="text"
              placeholder="Search country..."
              value={countrySearch}
              onChange={(e) => setCountrySearch(e.target.value)}
              className="w-full rounded-md border border-line bg-white py-2 pl-8 pr-3 text-[13px] text-ink outline-none transition focus:border-brand"
            />
          </div>
        )}

        <div className="max-h-48 space-y-1 overflow-y-auto pr-0.5">
          {filteredCountries.length === 0 ? (
            <div className="py-3 text-center text-xs text-steel">
              No country found
            </div>
          ) : (
            filteredCountries.map((country) => {
              const isSelected = selectedCountryCode === country.code;
              return (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => {
                    setSelectedCountryCode(country.code);
                    setOpen(false);
                    router.refresh();
                  }}
                  className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-[13.5px] transition-all ${
                    isSelected
                      ? "bg-brand/10 font-semibold text-brand"
                      : "text-ink hover:bg-grey active:bg-grey/70"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    {country.flagEmoji ? (
                      <span className="text-base">{country.flagEmoji}</span>
                    ) : null}
                    <span>{country.name}</span>
                  </span>

                  {isSelected && (
                    <Check size={16} className="shrink-0 text-brand" />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Language Section */}
      <div className="p-4">
        <h4 className="mb-2.5 text-xs font-bold uppercase tracking-wider text-steel">
          Select Language
        </h4>

        <div className="max-h-36 space-y-1 overflow-y-auto pr-0.5">
          {languages.map((language) => {
            const isSelected = selectedLanguage === language.code;
            return (
              <button
                key={language.id}
                type="button"
                onClick={() => {
                  setSelectedLanguage(language.code);
                  setOpen(false);
                  router.refresh();
                }}
                className={`flex w-full items-center justify-between rounded-lg px-3.5 py-2.5 text-left text-[13.5px] transition-all ${
                  isSelected
                    ? "bg-brand/10 font-semibold text-brand"
                    : "text-ink hover:bg-grey active:bg-grey/70"
                }`}
              >
                <span>{language.name}</span>
                {isSelected && (
                  <Check size={16} className="shrink-0 text-brand" />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Currency Section (Informational Read-only list) */}
      <div className="bg-[#F8F9FA] p-4">
        <div className="mb-2.5 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-steel">
              Currency Overview
            </h4>
            <span title="Currency is tied directly to country for accurate regional pricing and tax compliance">
              <Info size={13} className="cursor-help text-steel" />
            </span>
          </div>
          <span className="flex items-center gap-1 rounded-full border border-line bg-grey px-2 py-0.5 text-[10.5px] font-medium text-steel">
            <Lock size={10} /> Bound to Country
          </span>
        </div>

        <div className="space-y-2">
          {countryCurrencies.map((currency) => {
            const isActive = activeCurrencyCode === currency.code;
            return (
              <div
                key={currency.code}
                className={`flex items-center justify-between rounded-lg border p-2.5 text-[12.5px] transition-all select-none ${
                  isActive
                    ? "border-brand bg-white shadow-sm ring-1 ring-brand/20"
                    : "border-line/60 bg-white/60 text-steel opacity-60"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-full font-mono text-xs font-bold ${
                      isActive
                        ? "bg-brand text-white"
                        : "bg-grey text-steel"
                    }`}
                  >
                    {currency.symbol}
                  </div>
                  <div className="flex flex-col">
                    <span
                      className={`font-medium ${
                        isActive ? "font-semibold text-ink" : "text-steel"
                      }`}
                    >
                      {currency.name} ({currency.code})
                    </span>
                    <span className="text-[10.5px] text-steel">
                      {isActive
                        ? `Active currency for ${activeCountry?.name || "selected country"}`
                        : `Used in ${currency.countryNames.join(", ")}`}
                    </span>
                  </div>
                </div>

                {isActive ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-brand/10 px-2 py-0.5 text-[10.5px] font-bold text-brand">
                    <Check size={11} /> Active
                  </span>
                ) : (
                  <span className="text-[10px] italic text-steel">
                    Informational
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => {
            if (!value) refetchCountries();
            return !value;
          });
        }}
        className="group flex w-full items-center justify-between gap-3 rounded-lg border border-line bg-white px-3 py-2 transition-all duration-200 hover:border-brand hover:shadow-sm"
      >
        <Globe size={18} className="shrink-0 text-brand" />

        <div className="flex flex-col items-start leading-tight">
          <span className="text-[11px] text-steel">Country / Language</span>

          <span className="flex items-center gap-1 text-[13px] font-semibold text-ink">
            {activeCountry?.name ?? selectedCountryCode}
            <span className="text-steel">|</span>
            {activeLanguage?.code.toUpperCase() ??
              selectedLanguage.toUpperCase()}
          </span>
        </div>

        <ChevronDown
          size={13}
          className={`transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Mobile Screen: Render centered Modal Popup */}
      {isMobile ? (
        <Modal
          open={open}
          onClose={() => setOpen(false)}
          title="Country & Preferences"
          panelClassName="max-w-md w-full max-h-[85vh] rounded-2xl"
        >
          {renderContent}
        </Modal>
      ) : (
        /* Desktop Screen: Render Dropdown Popover */
        open && (
          <div
            className={cn(
              "absolute z-50 w-[360px] overflow-hidden rounded-xl border border-line bg-white shadow-2xl transition-all",
              openUp ? "bottom-full mb-2.5" : "top-full mt-1",
              align === "left" ? "left-0" : "right-0"
            )}
          >
            {/* Header */}
            <div className="border-b border-line bg-[#FAFAFA] px-4 py-3">
              <h3 className="flex items-center justify-between text-[14px] font-bold text-ink">
                <span>Country & Preferences</span>
                <span className="rounded-full bg-grey px-2 py-0.5 text-[11px] font-normal text-steel">
                  {countries.length} {countries.length === 1 ? "Country" : "Countries"}
                </span>
              </h3>
              <p className="mt-0.5 text-[11.5px] text-steel">
                Regional pricing, shipping & taxes update automatically by country.
              </p>
            </div>

            <div className="max-h-[460px] overflow-y-auto">
              {renderContent}
            </div>
          </div>
        )
      )}
    </div>
  );
}
