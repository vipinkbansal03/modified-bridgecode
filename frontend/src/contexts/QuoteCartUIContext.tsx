"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  useLayoutEffect,
  ReactNode,
} from "react";

interface QuoteCartUIContextType {
  isReady: boolean;

  isMinimized: boolean;
  isClosed: boolean;

  minimize: () => void;
  restore: () => void;

  close: () => void;
  open: () => void;
}

const QuoteCartUIContext = createContext<QuoteCartUIContextType | undefined>(
  undefined,
);

const STORAGE_KEY = "quote-cart-minimized";

const CLOSED_STORAGE_KEY = "quote-cart-closed";

export function QuoteCartUIProvider({ children }: { children: ReactNode }) {
  const [isMinimized, setIsMinimized] = useState(false);
  const [isClosed, setIsClosed] = useState(false);
  const [isReady, setIsReady] = useState(false);

  // Load saved state on first render
  useLayoutEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (saved !== null) {
      setIsMinimized(saved === "true");
    }

    const savedClosed = localStorage.getItem(CLOSED_STORAGE_KEY);

    if (savedClosed !== null) {
      setIsClosed(savedClosed === "true");
    }

    setIsReady(true);
  }, []);

  const minimize = () => {
    setIsMinimized(true);
    localStorage.setItem(STORAGE_KEY, "true");
  };

  const restore = () => {
    setIsMinimized(false);
    localStorage.setItem(STORAGE_KEY, "false");
  };

  const close = () => {
    setIsClosed(true);
    localStorage.setItem(CLOSED_STORAGE_KEY, "true");
  };

  const open = () => {
    setIsClosed(false);
    localStorage.setItem(CLOSED_STORAGE_KEY, "false");
  };

  const value = useMemo(
    () => ({
      isReady,
      isMinimized,
      isClosed,
      minimize,
      restore,
      close,
      open,
    }),
    [isReady, isMinimized, isClosed],
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
