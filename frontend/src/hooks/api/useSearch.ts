"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import type { ApiSearchResult } from "@/types/api.types";

async function fetchSearch(q: string, lang?: string, countryCode?: string): Promise<ApiSearchResult> {
  if (!HAS_LIVE_API || q.length < 2) {
    // Client-side search over static data when no backend
    const { default: products } = await import("@/data/products.json");
    const term = q.toLowerCase();
    const matched = (products as Record<string, unknown>[])
      .filter((p) => (p.title as string).toLowerCase().includes(term) || (p.productCode as string ?? "").toLowerCase().includes(term))
      .slice(0, 8)
      .map((p) => ({
        id: p.slug as string, slug: p.slug as string, title: p.title as string,
        productCode: p.productCode as string ?? null, brand: "Modern Orthodontics",
        shortDescription: p.shortDescription as string ?? null,
        category: { name: p.category as string, slug: p.categorySlug as string },
        images: p.images as string[] ?? [], thumbnail: (p.images as string[])?.[0] ?? null,
        isFeatured: false, hasVariants: false, variantCount: 0, prices: [],
      }));
    return { products: matched, categories: [] };
  }
  const res = await apiClient.get("/search", { params: { q, lang, countryCode } });
  return unwrapData<ApiSearchResult>(res);
}

/** Live site search. Enabled only when query is at least 2 characters. */
export function useSearch(query: string) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({
    queryKey: qk.search.query(query, selectedLanguage, selectedCountryCode),
    queryFn: () => fetchSearch(query, selectedLanguage, selectedCountryCode),
    enabled: query.length >= 2,
    staleTime: STALE.short,
  });
}
