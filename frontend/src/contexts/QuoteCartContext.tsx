"use client";

import React, {
  createContext,
  useCallback,
  useContext,
  useState,
  useEffect,
  useReducer,
  useRef,
} from "react";
import { discountPercentage } from "@/utils/discountRules";

import { apiClient } from "@/lib/apiClient";
import { useCurrencyContext } from "@/contexts/CurrencyContext";

export interface QuoteCartItem {
  productId: string;
  productSlug: string;
  productTitle: string;
  variantId: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  currencyCode: string;
  currencySymbol: string;
  selectedAttributes: Record<string, string>;
  priceUnavailable?: boolean;
  priceUnavailableMessage?: string;
}

export interface QuoteCartTotals {
  itemCount: number;
  totalQuantity: number;
  subtotal: number;
  discountPercentage: number;
  discountAmount: number;
  grandTotal: number;
  currencySymbol: string;
}

type Action =
  | { type: "LOAD"; payload: QuoteCartItem[] }
  | { type: "ADD_ITEMS"; payload: QuoteCartItem[] }
  | { type: "UPDATE_QTY"; variantId: string; quantity: number }
  | { type: "REMOVE"; variantId: string }
  | { type: "CLEAR" };

function reducer(state: QuoteCartItem[], action: Action): QuoteCartItem[] {
  switch (action.type) {
    case "LOAD":
      return action.payload;
    case "ADD_ITEMS": {
      const next = [...state];
      for (const incoming of action.payload) {
        const idx = next.findIndex((i) => i.variantId === incoming.variantId);
        if (idx >= 0) {
          next[idx] = {
            ...next[idx],
            quantity: next[idx].quantity + incoming.quantity,
          };
        } else {
          next.push(incoming);
        }
      }
      return next;
    }
    case "UPDATE_QTY":
      if (action.quantity <= 0)
        return state.filter((i) => i.variantId !== action.variantId);
      return state.map((i) =>
        i.variantId === action.variantId
          ? { ...i, quantity: action.quantity }
          : i,
      );
    case "REMOVE":
      return state.filter((i) => i.variantId !== action.variantId);
    case "CLEAR":
      return [];
  }
}

function computeTotals(items: QuoteCartItem[]): QuoteCartTotals {
  const subtotal = items.reduce((s, i) => s + i.unitPrice * i.quantity, 0);
  const pct = discountPercentage(subtotal);
  const discountAmount = (subtotal * pct) / 100;
  return {
    itemCount: items.length,
    totalQuantity: items.reduce((s, i) => s + i.quantity, 0),
    subtotal,
    discountPercentage: pct,
    discountAmount,
    grandTotal: subtotal - discountAmount,
    currencySymbol: items[0]?.currencySymbol ?? "₹",
  };
}

interface QuoteCartContextValue {
  isReady: boolean;
  items: QuoteCartItem[];
  totals: QuoteCartTotals;
  addItems: (items: QuoteCartItem[]) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
}

const QuoteCartContext = createContext<QuoteCartContextValue | null>(null);

const STORAGE_KEY = "quote_cart_v1";

export function QuoteCartProvider({ children }: { children: React.ReactNode }) {
  const [items, dispatch] = useReducer(reducer, []);
  const [isReady, setIsReady] = useState(false);
  const { selectedCountryCode } = useCurrencyContext();
  const itemsRef = useRef<QuoteCartItem[]>([]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (raw) {
        dispatch({
          type: "LOAD",
          payload: JSON.parse(raw),
        });
      }
    } catch {}

    setIsReady(true);
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => {
    if (!isReady) return;
    if (!itemsRef.current.length) return;
    if (!selectedCountryCode) return;

    let cancelled = false;

    async function refreshQuotePrices() {
      const customerToken = window.localStorage.getItem("customer_token");

      const groupedItems = itemsRef.current.reduce<
        Record<string, QuoteCartItem[]>
      >((acc, item) => {
        if (!acc[item.productSlug]) {
          acc[item.productSlug] = [];
        }

        acc[item.productSlug].push(item);
        return acc;
      }, {});

      let updatedItems = [...itemsRef.current];

      for (const [productSlug, productItems] of Object.entries(groupedItems)) {
        try {
          const response = await apiClient.post(
            `/products/${productSlug}/price-preview`,
            {
              items: productItems.map((item) => ({
                variantId: item.variantId,
                quantity: item.quantity,
              })),
            },
            {
              params: {
                countryCode: selectedCountryCode,
              },
              headers: customerToken
                ? {
                    Authorization: `Bearer ${customerToken}`,
                  }
                : undefined,
            },
          );

          const previews = response.data.data ?? [];

          updatedItems = updatedItems.map((item) => {
            const preview = previews.find(
              (p: { variantId: string; unitPrice: number }) =>
                p.variantId === item.variantId,
            );

            if (!preview) return item;

            return {
              ...item,
              unitPrice: preview.unitPrice,
              currencyCode: preview.currency.code,
              currencySymbol: preview.currency.symbol,
              priceUnavailable: false,
              priceUnavailableMessage: undefined,
            };
          });
        } catch (error: any) {
          const message = error?.message || "";

          if (message.includes("No active price is configured")) {
            updatedItems = updatedItems.map((item) =>
              item.productSlug === productSlug
                ? {
                    ...item,
                    priceUnavailable: true,
                    priceUnavailableMessage: message,
                  }
                : item,
            );

            continue;
          }

          console.error(`Failed to refresh prices for ${productSlug}`, error);
        }
      }

      if (cancelled) return;

      const hasChanges = updatedItems.some((updatedItem, index) => {
        const currentItem = itemsRef.current[index];

        if (!currentItem) return true;

        return (
          updatedItem.unitPrice !== currentItem.unitPrice ||
          updatedItem.currencyCode !== currentItem.currencyCode ||
          updatedItem.currencySymbol !== currentItem.currencySymbol ||
          updatedItem.priceUnavailable !== currentItem.priceUnavailable ||
          updatedItem.priceUnavailableMessage !==
            currentItem.priceUnavailableMessage
        );
      });

      if (hasChanges) {
        dispatch({
          type: "LOAD",
          payload: updatedItems,
        });
      }
    }

    refreshQuotePrices();

    return () => {
      cancelled = true;
    };
  }, [selectedCountryCode, isReady]);

  const addItems = useCallback(
    (newItems: QuoteCartItem[]) =>
      dispatch({ type: "ADD_ITEMS", payload: newItems }),
    [],
  );
  const updateQuantity = useCallback(
    (variantId: string, quantity: number) =>
      dispatch({ type: "UPDATE_QTY", variantId, quantity }),
    [],
  );
  const removeItem = useCallback(
    (variantId: string) => dispatch({ type: "REMOVE", variantId }),
    [],
  );
  const clearCart = useCallback(() => dispatch({ type: "CLEAR" }), []);

  return (
    <QuoteCartContext.Provider
      value={{
        isReady,
        items,
        totals: computeTotals(items),
        addItems,
        updateQuantity,
        removeItem,
        clearCart,
      }}
    >
      {children}
    </QuoteCartContext.Provider>
  );
}

export function useQuoteCart() {
  const ctx = useContext(QuoteCartContext);
  if (!ctx)
    throw new Error("useQuoteCart must be used inside QuoteCartProvider");
  return ctx;
}
