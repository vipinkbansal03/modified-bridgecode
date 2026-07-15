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
    document.cookie = `country=${selectedCountryCode}; path=/; max-age=31536000; SameSite=Lax`;
  }, [selectedCountryCode]);

  useEffect(() => {
    if (!countries.length) return;

    const storedCountry = localStorage.getItem("country");
    const validStoredCountry = storedCountry ? countries.find((country) => country.code === storedCountry.toUpperCase()) : null;
    const fallbackCountry = countries.find((country) => country.isDefault) ?? countries[0];
    const nextCountry = validStoredCountry ?? fallbackCountry;
    if (!nextCountry) return;

    if (!validStoredCountry || selectedCountryCode !== nextCountry.code) {
      setSelectedCountryCodeState(nextCountry.code);
      localStorage.setItem("country", nextCountry.code);
    }

    if (nextCountry.currency.code && selectedCurrency !== nextCountry.currency.code) {
      setSelectedCurrencyState(nextCountry.currency.code);
      localStorage.setItem("currency", nextCountry.currency.code);
    }
  }, [countries, selectedCountryCode, selectedCurrency]);

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
