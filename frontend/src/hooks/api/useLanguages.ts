"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import type { ApiLanguage } from "@/types/api.types";

const STATIC_LANGUAGES: ApiLanguage[] = [
  { id: "en", name: "English", code: "en", isDefault: true },
];

async function fetchLanguages(): Promise<ApiLanguage[]> {
  if (!HAS_LIVE_API) return STATIC_LANGUAGES;

  try {
    const res = await apiClient.get("/languages");
    return unwrapData<ApiLanguage[]>(res);
  } catch {
    return STATIC_LANGUAGES;
  }
}

export function useLanguages() {
  return useQuery({ queryKey: qk.languages.all, queryFn: fetchLanguages, staleTime: STALE.long });
}
