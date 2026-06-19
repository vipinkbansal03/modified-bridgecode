"use client";

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

interface CurrencyContextValue {
  selectedCurrency: string;
  setSelectedCurrency: (code: string) => void;
}

const CurrencyContext = createContext<CurrencyContextValue>({
  selectedCurrency: "USD",
  setSelectedCurrency: () => {},
});

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [selectedCurrency, setSelectedCurrencyState] = useState("USD");

  useEffect(() => {
    const stored = localStorage.getItem("currency");
    if (stored) setSelectedCurrencyState(stored);
  }, []);

  function setSelectedCurrency(code: string) {
    setSelectedCurrencyState(code);
    localStorage.setItem("currency", code);
  }

  return (
    <CurrencyContext.Provider value={{ selectedCurrency, setSelectedCurrency }}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrencyContext() {
  return useContext(CurrencyContext);
}
