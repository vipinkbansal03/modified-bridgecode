"use client";

import { useEffect, useState } from "react";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
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
  const [translations, setTranslations] = useState<StaticTranslationMap>({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isActive = true;

    if (!HAS_LIVE_API || selectedLanguage === "en") {
      setTranslations({});
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    setIsLoading(true);
    fetchStaticTranslations(selectedLanguage)
      .then((data) => {
        if (isActive) {
          setTranslations(data);
        }
      })
      .catch(() => {
        if (isActive) {
          setTranslations({});
        }
      })
      .finally(() => {
        if (isActive) {
          setIsLoading(false);
        }
      });

    return () => {
      isActive = false;
    };
  }, [selectedLanguage]);

  function t(key: StaticMessageKey, params?: Record<string, string | number>) {
    let value = translations[key] || staticMessages[key] || key;
    if (params) {
      for (const [name, paramValue] of Object.entries(params)) {
        value = value.replaceAll(`{${name}}`, String(paramValue));
      }
    }
    return value;
  }

  return { t, language: selectedLanguage, isLoading };
}
