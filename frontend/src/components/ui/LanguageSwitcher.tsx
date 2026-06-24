"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useLanguages } from "@/hooks/api/useLanguages";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { cn } from "@/utils/cn";

export function LanguageSwitcher() {
  const { data: languages = [] } = useLanguages();
  const { selectedLanguage, setSelectedLanguage } = useLanguageContext();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const active = languages.find((l) => l.code === selectedLanguage) ?? languages.find((l) => l.isDefault) ?? languages[0];
  if (!active) return null;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 text-[13.5px] font-medium text-ink hover:text-brand"
      >
        <span>{active.code.toUpperCase()}</span>
        <ChevronDown size={11} className={cn("opacity-60 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1.5 w-[148px] rounded-md border border-line bg-white py-1 shadow-[0_8px_24px_rgba(0,0,0,0.08)]">
          {languages.map((language) => (
            <button
              key={language.id}
              onClick={() => {
                setSelectedLanguage(language.code);
                setOpen(false);
                router.refresh();
              }}
              className={cn(
                "flex w-full items-center justify-between px-3.5 py-2 text-[13.5px] hover:bg-offwhite",
                language.code === active.code ? "font-semibold text-brand" : "text-ink"
              )}
            >
              <span>{language.name}</span>
              <span className="text-xs uppercase text-steel-2">{language.code}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
