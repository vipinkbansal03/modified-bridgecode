"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { apiClient } from "@/lib/apiClient";
import { useCurrencyContext } from "@/contexts/CurrencyContext";

export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  currencyCode: string;
  currencySymbol: string;
  countryCode?: string;
  countryName?: string;
  selectedAttributes: Record<string, string>;
  priceUnavailable?: boolean;
  priceUnavailableMessage?: string;
}

interface CartTotals {
  itemCount: number;
  subtotal: number;
  currencyCode: string;
  currencySymbol: string;
}

interface CartContextValue {
  items: CartItem[];
  totals: CartTotals;
  isOpen: boolean;
  hydrated: boolean;
  addItem: (item: CartItem) => void;
  addItems: (items: CartItem[]) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "purchase_cart_v1";

function computeTotals(items: CartItem[]): CartTotals {
  const first = items[0];
  return {
    itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    subtotal: items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0,
    ),
    currencyCode: first?.currencyCode ?? "INR",
    currencySymbol: first?.currencySymbol ?? "Rs ",
  };
}

function isValidCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== "object") return false;
  const item = value as CartItem;
  return Boolean(
    item.variantId && item.productId && item.productSlug && item.quantity > 0,
  );
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  const { selectedCountryCode } = useCurrencyContext();

  const totals = useMemo(() => computeTotals(items), [items]);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          setItems(parsed.filter(isValidCartItem));
        }
      }
    } catch {
      // Ignore corrupted cart storage.
    } finally {
      setHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items, hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    if (!items.length) return;
    if (!selectedCountryCode) return;

    let cancelled = false;

    async function refreshCartPrices() {
      try {
        const customerToken = window.localStorage.getItem("customer_token");

        const groupedItems = items.reduce<Record<string, CartItem[]>>(
          (acc, item) => {
            if (!acc[item.productSlug]) {
              acc[item.productSlug] = [];
            }

            acc[item.productSlug].push(item);
            return acc;
          },
          {},
        );

        let updatedItems = [...items];

        for (const [productSlug, productItems] of Object.entries(
          groupedItems,
        )) {
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

            for (const preview of previews) {
              const index = updatedItems.findIndex(
                (item) => item.variantId === preview.variantId,
              );

              if (index !== -1) {
                updatedItems[index] = {
                  ...updatedItems[index],
                  unitPrice: preview.unitPrice,
                  currencyCode: preview.currency.code,
                  currencySymbol: preview.currency.symbol,
                  priceUnavailable: false,
                  priceUnavailableMessage: undefined,
                };
              }
            }
          } catch (error: any) {
            const message = error?.message || "";

            if (message.includes("Product not found")) {
              console.warn(`Removing non-existent product ${productSlug} from cart.`);
              updatedItems = updatedItems.filter((item) => item.productSlug !== productSlug);
              continue;
            }

            if (message.includes("No active price is configured")) {
              updatedItems.forEach((item, index) => {
                if (item.productSlug === productSlug) {
                  updatedItems[index] = {
                    ...item,
                    priceUnavailable: true,
                    priceUnavailableMessage: message,
                  };
                }
              });

              continue;
            }

            console.warn(`Failed to refresh prices for ${productSlug}`, error);
          }
        }

        if (!cancelled) {
          setItems(updatedItems);
        }
      } catch (error) {
        console.error("Unexpected error while refreshing cart prices", error);
      }
    }

    refreshCartPrices();

    return () => {
      cancelled = true;
    };
  }, [selectedCountryCode, hydrated]);

  const mergeCartItems = (current: CartItem[], incomingItems: CartItem[]) => {
    const next = [...current];
    for (const item of incomingItems) {
      const existingIndex = next.findIndex(
        (entry) => entry.variantId === item.variantId,
      );
      if (existingIndex === -1) {
        next.push(item);
        continue;
      }
      next[existingIndex] = {
        ...next[existingIndex],
        quantity: next[existingIndex].quantity + item.quantity,
        unitPrice: item.unitPrice,
      };
    }
    return next;
  };

  const addItem = (item: CartItem) => {
    setItems((current) => mergeCartItems(current, [item]));
  };

  const addItems = (incomingItems: CartItem[]) => {
    if (!incomingItems.length) return;
    setItems((current) => mergeCartItems(current, incomingItems));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    setItems((current) =>
      quantity <= 0
        ? current.filter((item) => item.variantId !== variantId)
        : current.map((item) =>
            item.variantId === variantId ? { ...item, quantity } : item,
          ),
    );
  };

  const removeItem = (variantId: string) => {
    setItems((current) =>
      current.filter((item) => item.variantId !== variantId),
    );
  };

  const clearCart = () => setItems([]);
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);

  return (
    <CartContext.Provider
      value={{
        items,
        totals,
        isOpen,
        hydrated,
        addItem,
        addItems,
        updateQuantity,
        removeItem,
        clearCart,
        openCart,
        closeCart,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used inside CartProvider");
  return ctx;
}
