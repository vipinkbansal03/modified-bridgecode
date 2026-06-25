"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";
import { useCountries } from "@/hooks/api/useCurrencies";

interface CurrencyContextValue {
  selectedCurrency: string;
  setSelectedCurrency: (code: string) => void;
  selectedCountryCode: string;
  setSelectedCountryCode: (code: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  selectedCurrency: "INR",
  setSelectedCurrency: () => {},
  selectedCountryCode: "IN",
  setSelectedCountryCode: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const { data: countries = [] } = useCountries();
  const [selectedCurrency, setSelectedCurrencyState] = useState("INR");
  const [selectedCountryCode, setSelectedCountryCodeState] = useState("IN");

  useEffect(() => {
    const stored = localStorage.getItem("currency");
    const storedCountry = localStorage.getItem("country");
    if (stored) setSelectedCurrencyState(stored);
    if (storedCountry) setSelectedCountryCodeState(storedCountry);
  }, []);

  useEffect(() => {
    if (!countries.length || localStorage.getItem("country")) return;
    const defaultCountry = countries.find((country) => country.isDefault) ?? countries[0];
    if (!defaultCountry) return;
    setSelectedCountryCodeState(defaultCountry.code);
    setSelectedCurrencyState(defaultCountry.currency.code);
    localStorage.setItem("country", defaultCountry.code);
    localStorage.setItem("currency", defaultCountry.currency.code);
  }, [countries]);

  function setSelectedCurrency(code: string) {
    setSelectedCurrencyState(code);
    localStorage.setItem("currency", code);
  }

  function setSelectedCountryCode(code: string) {
    const normalizedCode = code.toUpperCase();
    const country = countries.find((item) => item.code === normalizedCode);
    setSelectedCountryCodeState(normalizedCode);
    localStorage.setItem("country", normalizedCode);
    if (country?.currency?.code) {
      setSelectedCurrencyState(country.currency.code);
      localStorage.setItem("currency", country.currency.code);
    }
  }

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency, selectedCountryCode, setSelectedCountryCode }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext() {
  return useContext(CurrencyContext);
}
