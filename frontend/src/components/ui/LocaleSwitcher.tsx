"use client";
import { useEffect, useRef, useState } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";

import { useCountries } from "@/hooks/api/useCurrencies";
import { useLanguages } from "@/hooks/api/useLanguages";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { useRouter } from "next/navigation";

export function LocaleSwitcher() {
  const router = useRouter();
  const { selectedCountryCode, setSelectedCountryCode } = useCurrencyContext();

  const { selectedLanguage, setSelectedLanguage } = useLanguageContext();

  const [open, setOpen] = useState(false);

  const wrapperRef = useRef<HTMLDivElement>(null);

  const { data: countries = [] } = useCountries();
  const { data: languages = [] } = useLanguages();

  const activeCountry =
    countries.find((country) => country.code === selectedCountryCode) ??
    countries.find((country) => country.isDefault) ??
    countries[0];

  const activeLanguage =
    languages.find((language) => language.code === selectedLanguage) ??
    languages.find((language) => language.isDefault) ??
    languages[0];

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

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
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

      {open && (
        <div className="absolute right-0 top-full z-50 w-full sm:w-[340px] overflow-hidden rounded-xl border border-line bg-white shadow-xl">
          <div className="border-b border-line px-5 py-4">
            <h3 className="text-[15px] font-semibold text-ink">
              Country & Language
            </h3>

            <p className="mt-1 text-xs text-steel">
              Select your preferred locale.
            </p>
          </div>

          {/* Country */}
          <div className="border-b border-line p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-steel">
              Country
            </h4>

            <div className="space-y-1">
              {countries.map((country) => (
                <button
                  key={country.id}
                  type="button"
                  onClick={() => {
                    setSelectedCountryCode(country.code);
                    setOpen(false);
                    router.refresh();
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    selectedCountryCode === country.code
                      ? "bg-brand/5 text-brand"
                      : "hover:bg-grey"
                  }`}
                >
                  <span>{country.name}</span>

                  {selectedCountryCode === country.code && (
                    <Check size={15} className="text-brand" />
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Language */}
          <div className="p-4">
            <h4 className="mb-3 text-xs font-semibold uppercase tracking-wider text-steel">
              Language
            </h4>

            <div className="space-y-1">
              {languages.map((language) => (
                <button
                  key={language.id}
                  type="button"
                  onClick={() => {
                    setSelectedLanguage(language.code);
                    setOpen(false);
                    router.refresh();
                  }}
                  className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left transition-colors ${
                    selectedLanguage === language.code
                      ? "bg-brand/5 text-brand"
                      : "hover:bg-grey"
                  }`}
                >
                  <span>{language.name}</span>

                  {selectedLanguage === language.code && (
                    <Check size={15} className="text-brand" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
