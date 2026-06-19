"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import type { ApiCategory } from "@/types/api.types";

async function fetchCategories(): Promise<ApiCategory[]> {
  if (!HAS_LIVE_API) {
    const { default: raw } = await import("@/data/categories.json");
    return (raw as Record<string, unknown>[]).map((c) => {
      const name = (c.title ?? c.name ?? "") as string;
      return {
        id: c.slug as string,
        name,
        title: name,                             // backward compat
        slug: c.slug as string,
        description: (c.description as string) ?? null,
        image: (c.image as string) ?? null,
        productCount: (c.productCount as number) ?? 0,
        doctorMeta: (c.doctorMeta as string) ?? undefined,
        dealerMeta: (c.dealerMeta as string) ?? undefined,
      };
    });
  }
  const res = await apiClient.get("/categories");
  // Backend returns { name } — add title alias for component compat
  const cats = unwrapData<ApiCategory[]>(res);
  return cats.map((c) => ({ ...c, title: c.name }));
}

/** All active categories. Stale time: 30 min (categories change rarely). */
export function useCategories() {
  return useQuery({ queryKey: qk.categories.all, queryFn: fetchCategories, staleTime: STALE.long });
}
