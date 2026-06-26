"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface LanguageContextValue {
  selectedLanguage: string;
  setSelectedLanguage: (code: string) => void;
}

const DEFAULT_LANGUAGE = "en";

const LanguageContext = createContext<LanguageContextValue>({
  selectedLanguage: DEFAULT_LANGUAGE,
  setSelectedLanguage: () => {},
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [selectedLanguage, setSelectedLanguageState] = useState(DEFAULT_LANGUAGE);

  useEffect(() => {
    const stored = localStorage.getItem("language");
    if (stored) setSelectedLanguageState(stored);
  }, []);

  function setSelectedLanguage(code: string) {
    setSelectedLanguageState(code);
    localStorage.setItem("language", code);
    document.cookie = `language=${code}; path=/; max-age=31536000; SameSite=Lax`;
  }

  return (
    <LanguageContext.Provider value={{ selectedLanguage, setSelectedLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguageContext() {
  return useContext(LanguageContext);
}
