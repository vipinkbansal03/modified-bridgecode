"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { staticMessages, type StaticMessageKey } from "@/i18n/staticMessages";

type StaticTranslationMap = Partial<Record<StaticMessageKey, string>>;

async function fetchStaticTranslations(language: string): Promise<StaticTranslationMap> {
  if (!HAS_LIVE_API || language === "en") return {};
  try {
    const res = await apiClient.get("/translations/static", { params: { lang: language } });
    return unwrapData<StaticTranslationMap>(res);
  } catch {
    return {};
  }
}

export function useStaticTranslations() {
  const { selectedLanguage } = useLanguageContext();
  const { data = {} } = useQuery({
    queryKey: qk.translations.static(selectedLanguage),
    queryFn: () => fetchStaticTranslations(selectedLanguage),
    staleTime: STALE.long,
  });

  function t(key: StaticMessageKey, params?: Record<string, string | number>) {
    let value = data[key] || staticMessages[key] || key;
    if (params) {
      for (const [name, paramValue] of Object.entries(params)) {
        value = value.replaceAll(`{${name}}`, String(paramValue));
      }
    }
    return value;
  }

  return { t, language: selectedLanguage };
}
