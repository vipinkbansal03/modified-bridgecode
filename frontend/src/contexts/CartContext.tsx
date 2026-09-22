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
import { useCountries } from "@/hooks/api/useCurrencies";
import { fetchPublicPaymentMethods } from "@/services/customerApi";
import { useCustomerAuth } from "@/contexts/CustomerAuthContext";
import { toast } from "react-toastify";

export interface CartItem {
  variantId: string;
  productId: string;
  productSlug: string;
  productTitle: string;
  variantTitle: string;
  image?: string | null;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  basePrice?: number;
  currencyCode: string;
  currencySymbol: string;
  countryCode?: string;
  countryName?: string;
  selectedAttributes: Record<string, string>;
  warehouseId?: string;
  warehouseName?: string;
  estimatedDeliveryDays?: number | string;
  isLocalWarehouse?: boolean;
  priceUnavailable?: boolean;
  priceUnavailableMessage?: string;
  availableStock?: number;
  isOutOfStock?: boolean;
  isInsufficientStock?: boolean;
  stockErrorMessage?: string;
  hasPaymentConflict?: boolean;
  paymentErrorMessage?: string;
}

interface CartTotals {
  itemCount: number;
  originalSubtotal: number;
  subtotal: number;
  roleDiscount: number;
  currencyCode: string;
  currencySymbol: string;
  hasInvalidStockItems: boolean;
}

interface CartContextValue {
  items: CartItem[];
  totals: CartTotals;
  isOpen: boolean;
  hydrated: boolean;
  addItem: (item: CartItem) => void;
  addItems: (items: CartItem[]) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  updateWarehouse: (variantId: string, warehouseId: string | undefined, warehouseName: string, estimatedDeliveryDays?: number | string, isLocalWarehouse?: boolean) => void;
  removeItem: (variantId: string) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
  revalidateCart: (countryCode: string) => Promise<void>;
}

const CartContext = createContext<CartContextValue | null>(null);
const STORAGE_KEY = "purchase_cart_v1";

function computeTotals(
  items: CartItem[],
  fallbackCurrencyCode = "USD",
  fallbackCurrencySymbol = "$"
): CartTotals {
  const first = items[0];
  const originalSubtotal = items.reduce(
    (sum, item) => sum + item.quantity * (item.basePrice ?? item.unitPrice),
    0,
  );
  const subtotal = items.reduce(
    (sum, item) => sum + item.quantity * item.unitPrice,
    0,
  );
  const roleDiscount = Math.max(0, originalSubtotal - subtotal);
  const hasInvalidStockItems = items.some(
    (item) => item.isOutOfStock || item.isInsufficientStock || item.priceUnavailable || item.hasPaymentConflict,
  );

  return {
    itemCount: items.length,
    originalSubtotal,
    subtotal,
    roleDiscount,
    currencyCode: first?.currencyCode ?? fallbackCurrencyCode,
    currencySymbol: first?.currencySymbol ?? fallbackCurrencySymbol,
    hasInvalidStockItems,
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

  const { currentCustomer } = useCustomerAuth();
  const { selectedCountryCode } = useCurrencyContext();
  const { data: countries = [] } = useCountries();
  const activeCountry = countries.find((c) => c.code === selectedCountryCode);
  const fallbackCurrencyCode = activeCountry?.currency?.code ?? "USD";
  const fallbackCurrencySymbol = activeCountry?.currency?.symbol ?? "$";

  const totals = useMemo(
    () => computeTotals(items, fallbackCurrencyCode, fallbackCurrencySymbol),
    [items, fallbackCurrencyCode, fallbackCurrencySymbol],
  );

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
          if (!productSlug || productSlug === "undefined") {
            continue;
          }

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

              if (index !== -1 && preview.unitPrice > 0) {
                updatedItems[index] = {
                  ...updatedItems[index],
                  unitPrice: preview.unitPrice,
                  basePrice: preview.basePrice ?? preview.unitPrice,
                  currencyCode: preview.currency.code,
                  currencySymbol: preview.currency.symbol,
                  priceUnavailable: false,
                  priceUnavailableMessage: undefined,
                };
              }
            }
          } catch (error: any) {
            const message = error?.message || "";

            updatedItems.forEach((item, index) => {
              if (item.productSlug === productSlug) {
                updatedItems[index] = {
                  ...item,
                  priceUnavailable: true,
                  priceUnavailableMessage: message || "Item unavailable in selected country.",
                };
              }
            });
          }
        }

        const variantIds = updatedItems.map((item) => item.variantId);
        if (variantIds.length > 0) {
          try {
            const invRes = await apiClient.get("/inventory", {
              params: {
                variantIds: variantIds.join(","),
                countryCode: selectedCountryCode,
              },
            });

            const inventoryRecords: Array<{
              variantId: string;
              available: number;
              status: string;
              productTitle?: string;
              variantTitle?: string;
            }> = invRes.data?.data ?? [];

            const invMap = new Map(inventoryRecords.map((r) => [r.variantId, r]));

            updatedItems = updatedItems.map((item) => {
              const inv = invMap.get(item.variantId);
              if (!inv) return item;

              const isOutOfStock = inv.available <= 0 || inv.status === "OUT_OF_STOCK";
              const isInsufficientStock = item.quantity > inv.available;
              const pTitle = inv.productTitle || item.productTitle;
              const vTitle = inv.variantTitle || item.variantTitle;
              const displayName = `${pTitle}${vTitle ? ` - ${vTitle}` : ""}`;

              let stockErrorMessage: string | undefined = undefined;
              if (isOutOfStock) {
                stockErrorMessage = `"${displayName}" is currently out of stock.`;
              } else if (isInsufficientStock) {
                stockErrorMessage = `Only ${inv.available} unit${inv.available === 1 ? "" : "s"} available for "${displayName}".`;
              }

              return {
                ...item,
                availableStock: inv.available,
                isOutOfStock,
                isInsufficientStock,
                stockErrorMessage,
              };
            });
          } catch (invErr) {
            console.warn("Failed to refresh cart inventory status", invErr);
          }
        }

        if (updatedItems.length > 0 && selectedCountryCode) {
          try {
            const cartItemsPayload = updatedItems.map((i) => ({
              productId: i.productId,
              variantId: i.variantId,
            }));
            const pmRes = await fetchPublicPaymentMethods(selectedCountryCode, cartItemsPayload);
            const conflictingSet = new Set(pmRes.conflictingVariantIds || []);

            updatedItems = updatedItems.map((item) => {
              const hasPaymentConflict = conflictingSet.has(item.variantId);
              return {
                ...item,
                hasPaymentConflict,
                paymentErrorMessage: hasPaymentConflict
                  ? "Payment conflict - Requires a different payment method."
                  : undefined,
              };
            });
          } catch (pmErr) {
            console.warn("Failed to refresh cart payment methods resolution", pmErr);
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
  }, [selectedCountryCode, hydrated, currentCustomer?.id]);

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

      const existing = next[existingIndex];
      const newQty = existing.quantity + item.quantity;
      const available = existing.availableStock;
      const isOutOfStock =
        Boolean(existing.isOutOfStock) || (available !== undefined && available <= 0);
      const isInsufficientStock =
        available !== undefined && newQty > available;

      let stockErrorMessage: string | undefined = undefined;
      if (isOutOfStock) {
        const displayName = `${item.productTitle}${item.variantTitle ? ` - ${item.variantTitle}` : ""}`;
        stockErrorMessage = `"${displayName}" is currently out of stock.`;
      } else if (isInsufficientStock) {
        const displayName = `${item.productTitle}${item.variantTitle ? ` - ${item.variantTitle}` : ""}`;
        stockErrorMessage = `Only ${available} unit${available === 1 ? "" : "s"} available for "${displayName}".`;
      }

      next[existingIndex] = {
        ...existing,
        quantity: newQty,
        unitPrice: item.unitPrice,
        isInsufficientStock,
        stockErrorMessage,
      };
    }
    return next;
  };

  const addItem = (item: CartItem) => {
    if (!item.unitPrice || item.unitPrice <= 0 || item.priceUnavailable) {
      if (typeof window !== "undefined") {
        toast.warning("This item requires a custom quote for your selected country.");
      }
      return;
    }
    setItems((current) => mergeCartItems(current, [item]));
  };

  const addItems = (incomingItems: CartItem[]) => {
    const valid = incomingItems.filter((i) => i.unitPrice && i.unitPrice > 0 && !i.priceUnavailable);
    if (valid.length < incomingItems.length && typeof window !== "undefined") {
      toast.warning("This item requires a custom quote for your selected country.");
    }
    if (!valid.length) return;
    setItems((current) => mergeCartItems(current, valid));
  };

  const updateQuantity = (variantId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems((current) =>
      current.map((item) => {
        if (item.variantId !== variantId) return item;

        const available = item.availableStock;
        const isOutOfStock =
          Boolean(item.isOutOfStock) || (available !== undefined && available <= 0);
        const isInsufficientStock =
          available !== undefined && quantity > available;

        let stockErrorMessage: string | undefined = undefined;
        if (isOutOfStock) {
          const displayName = `${item.productTitle}${item.variantTitle ? ` - ${item.variantTitle}` : ""}`;
          stockErrorMessage = `"${displayName}" is currently out of stock.`;
        } else if (isInsufficientStock) {
          const displayName = `${item.productTitle}${item.variantTitle ? ` - ${item.variantTitle}` : ""}`;
          stockErrorMessage = `Only ${available} unit${available === 1 ? "" : "s"} available for "${displayName}".`;
        }

        return {
          ...item,
          quantity,
          isInsufficientStock,
          stockErrorMessage,
        };
      }),
    );
  };

  const updateWarehouse = (
    variantId: string,
    warehouseId: string | undefined,
    warehouseName: string,
    estimatedDeliveryDays?: number | string,
    isLocalWarehouse?: boolean
  ) => {
    setItems((current) =>
      current.map((item) => {
        if (item.variantId !== variantId) return item;
        return {
          ...item,
          warehouseId,
          warehouseName,
          estimatedDeliveryDays,
          isLocalWarehouse,
        };
      })
    );
  };

  const removeItem = (variantId: string) => {
    setItems((current) =>
      current.filter((item) => item.variantId !== variantId),
    );
  };

  const clearCart = () => {
    setItems([]);
    if (typeof window !== "undefined") {
      window.localStorage.removeItem("applied_coupon");
    }
  };
  const openCart = () => setIsOpen(true);
  const closeCart = () => setIsOpen(false);
  const revalidateCart = async (countryCode: string) => {
    // Triggered by checkout when address changes
    // Update each item's warehouse if it's no longer eligible
    const updatedItems = await Promise.all(items.map(async (item) => {
      try {
        const res = await apiClient.post(`/products/${item.productSlug}/warehouses`, {
          variantId: item.variantId,
          countryCode
        });
        const warehouses = res.data?.data || [];
        if (warehouses.length > 0) {
          const best = warehouses[0];
          return {
            ...item,
            warehouseId: best.id === "default" ? undefined : best.id,
            warehouseName: best.name,
            estimatedDeliveryDays: best.estimatedDeliveryDays,
            isLocalWarehouse: best.isLocal
          };
        }
      } catch {
        // ignore
      }
      return item;
    }));
    setItems(updatedItems);
  };

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
        updateWarehouse,
        removeItem,
        clearCart,
        openCart,
        closeCart,
        revalidateCart,
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
