"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import type { ApiCategory } from "@/types/api.types";

async function getStaticCategories(): Promise<ApiCategory[]> {
  const { default: raw } = await import("@/data/categories.json");
  return (raw as Record<string, unknown>[]).map((c) => {
    const name = (c.title ?? c.name ?? "") as string;
    return {
      id: c.slug as string,
      name,
      title: name,
      slug: c.slug as string,
      description: (c.description as string) ?? null,
      image: (c.image as string) ?? null,
      productCount: (c.productCount as number) ?? 0,
      doctorMeta: (c.doctorMeta as string) ?? undefined,
      dealerMeta: (c.dealerMeta as string) ?? undefined,
    };
  });
}

async function fetchCategories(lang?: string, countryCode?: string): Promise<ApiCategory[]> {
  if (!HAS_LIVE_API) return getStaticCategories();

  try {
    const res = await apiClient.get("/categories", { params: { lang, countryCode } });
    const cats = unwrapData<ApiCategory[]>(res);
    return cats.map((c) => ({ ...c, title: c.name }));
  } catch {
    return getStaticCategories();
  }
}

/** All active categories. Stale time: 30 min (categories change rarely). */
export function useCategories() {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({ queryKey: qk.categories.all(selectedLanguage, selectedCountryCode), queryFn: () => fetchCategories(selectedLanguage, selectedCountryCode), staleTime: STALE.long });
}
