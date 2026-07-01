"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import type { ApiCurrency, ApiCountry } from "@/types/api.types";

const STATIC_CURRENCIES: ApiCurrency[] = [
  { id: "usd", name: "US Dollar", code: "USD", symbol: "$", exchangeRate: "1", isBase: true },
  { id: "inr", name: "Indian Rupee", code: "INR", symbol: "₹", exchangeRate: "83.5", isBase: false },
  { id: "eur", name: "Euro", code: "EUR", symbol: "€", exchangeRate: "0.92", isBase: false },
  { id: "gbp", name: "British Pound", code: "GBP", symbol: "£", exchangeRate: "0.79", isBase: false },
];

async function fetchCurrencies(): Promise<ApiCurrency[]> {
  if (!HAS_LIVE_API) return STATIC_CURRENCIES;

  try {
    const res = await apiClient.get("/currencies");
    return unwrapData<ApiCurrency[]>(res);
  } catch {
    return STATIC_CURRENCIES;
  }
}

async function fetchCountries(): Promise<ApiCountry[]> {
  if (!HAS_LIVE_API) return [];

  try {
    const res = await apiClient.get("/countries");
    return unwrapData<ApiCountry[]>(res);
  } catch {
    return [];
  }
}

export function useCurrencies() {
  return useQuery({ queryKey: qk.currencies.all, queryFn: fetchCurrencies, staleTime: STALE.long });
}

export function useCountries() {
  return useQuery({ queryKey: qk.countries.all, queryFn: fetchCountries, staleTime: STALE.long });
}

/** Convert a price from base currency to a target currency. */
export function useConvertPrice() {
  const { data: currencies = [] } = useCurrencies();
  return (amount: number, fromCode: string, toCode: string): number => {
    if (fromCode === toCode) return amount;
    const from = currencies.find((c) => c.code === fromCode);
    const to = currencies.find((c) => c.code === toCode);
    if (!from || !to) return amount;
    const inBase = amount / Number(from.exchangeRate);
    return parseFloat((inBase * Number(to.exchangeRate)).toFixed(2));
  };
}
