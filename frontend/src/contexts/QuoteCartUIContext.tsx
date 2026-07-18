"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface QuoteCartUIContextType {
  isMinimized: boolean;
  minimize: () => void;
  restore: () => void;
}

const QuoteCartUIContext = createContext<QuoteCartUIContextType | undefined>(undefined);

const STORAGE_KEY = "quote-cart-minimized";

export function QuoteCartUIProvider({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);

  // Load saved state on first render
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      setIsMinimized(saved === "true");
    }
  }, []);

  const minimize = () => {
    setIsMinimized(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const restore = () => {
    setIsMinimized(false);
    localStorage.setItem(STORAGE_KEY, "false");
  };

  const value = useMemo(
    () => ({
      isMinimized,
      minimize,
      restore,
    }),
    [isMinimized]
  );

  return (
    <QuoteCartUIContext.Provider value={value}>
      {children}
    </QuoteCartUIContext.Provider>
  );
}

export function useQuoteCartUI() {
  const context = useContext(QuoteCartUIContext);

  if (!context) {
    throw new Error("useQuoteCartUI must be used within QuoteCartUIProvider");
  }

  return context;
}