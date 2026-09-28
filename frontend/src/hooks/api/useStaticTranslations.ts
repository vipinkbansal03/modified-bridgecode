"use client";

import { useEffect, useState } from "react";
import { apiClient, HAS_LIVE_API, unwrapData } from "@/lib/apiClient";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { staticMessages, type StaticMessageKey } from "@/i18n/staticMessages";

type StaticTranslationMap = Partial<Record<StaticMessageKey, string>>;

const translationCache = new Map<string, StaticTranslationMap>();
const translationPromiseCache = new Map<string, Promise<StaticTranslationMap>>();

async function fetchStaticTranslations(language: string): Promise<StaticTranslationMap> {
  if (!HAS_LIVE_API || !language) return {};
  if (translationCache.has(language)) return translationCache.get(language)!;
  if (translationPromiseCache.has(language)) return translationPromiseCache.get(language)!;

  const promise = apiClient
    .get("/translations/static", { params: { lang: language } })
    .then((res) => {
      const data = unwrapData<StaticTranslationMap>(res);
      translationCache.set(language, data);
      return data;
    })
    .catch(() => ({}))
    .finally(() => {
      translationPromiseCache.delete(language);
    });

  translationPromiseCache.set(language, promise);
  return promise;
}

export function useStaticTranslations() {
  const { selectedLanguage } = useLanguageContext();
  const [translations, setTranslations] = useState<StaticTranslationMap>(
    () => translationCache.get(selectedLanguage) || {}
  );
  const [isLoading, setIsLoading] = useState(() => !translationCache.has(selectedLanguage));

  useEffect(() => {
    let isActive = true;

    if (!HAS_LIVE_API || !selectedLanguage) {
      setTranslations({});
      setIsLoading(false);
      return () => {
        isActive = false;
      };
    }

    if (translationCache.has(selectedLanguage)) {
      setTranslations(translationCache.get(selectedLanguage)!);
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
