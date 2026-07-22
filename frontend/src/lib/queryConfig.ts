"use client";

import { QueryClient } from "@tanstack/react-query";

// ─── Query key factory ────────────────────────────────────
// Centralise all query keys so invalidations are consistent across the app.

export const qk = {
  products: {
    all: ["products"] as const,
    list: (params?: object) => ["products", "list", params] as const,
    detail: (slug: string, language?: string, countryCode?: string) =>
      ["products", "detail", slug, language, countryCode] as const,
    featured: (language?: string, countryCode?: string) =>
      ["products", "featured", language, countryCode] as const,
    byCategory: (slug: string, language?: string, countryCode?: string) =>
      ["products", "category", slug, language, countryCode] as const,
    search: (q: string) => ["products", "search", q] as const,
  },
  categories: {
    all: (language?: string, countryCode?: string) =>
      ["categories", language, countryCode] as const,
  },
  currencies: {
    all: ["currencies"] as const,
  },
  countries: {
    all: ["countries"] as const,
  },
  customerAddresses: {
    all: ["customer-addresses"] as const,
  },
  languages: {
    all: ["languages"] as const,
  },
  translations: {
    static: (language?: string) =>
      ["translations", "static", language] as const,
  },
  inventory: {
    check: (ids: string[]) => ["inventory", ...ids] as const,
  },
  search: {
    query: (q: string, language?: string, countryCode?: string) =>
      ["search", q, language, countryCode] as const,
  },
} as const;

// ─── Default stale / cache times ─────────────────────────
export const STALE = {
  /** Rarely changing — categories, currencies, countries */
  long: 30 * 60 * 1000, // 30 min
  /** Product listings — change on publish/unpublish */
  medium: 5 * 60 * 1000, // 5 min
  /** Real-time-ish — inventory, search */
  short: 60 * 1000, // 1 min
  /** Never refetch unless explicitly invalidated */
  never: Infinity,
} as const;

// ─── Shared QueryClient factory ───────────────────────────
export function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: STALE.medium,
        gcTime: 10 * 60 * 1000,
        retry: (failureCount, error) => {
          // Never retry 404s or validation errors
          const msg = (error as Error)?.message ?? "";
          if (msg.includes("Too many requests") || msg.includes("429"))
            return false;
          if (msg.includes("not found") || msg.includes("404")) return false;
          return failureCount < 2;
        },
        refetchOnWindowFocus: false,
      },
    },
  });
}
