"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, X, ArrowRight } from "lucide-react";
import { useSearch } from "@/hooks/api/useSearch";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { cn } from "@/utils/cn";

interface SearchOverlayProps {
  open: boolean;
  onClose: () => void;
}

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export function SearchOverlay({ open, onClose }: SearchOverlayProps) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const debouncedQuery = useDebounce(query, 300);
  const { data, isFetching } = useSearch(debouncedQuery);
  const { t } = useStaticTranslations();

  useEffect(() => {
    if (open) {
      setQuery("");
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (!open) return null;

  const hasResults = (data?.products.length ?? 0) > 0 || (data?.categories.length ?? 0) > 0;

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-white/95 backdrop-blur-sm">
      <div className="mx-auto w-full max-w-2xl px-5 pt-8">
        <div className="flex items-center gap-3 rounded-xl border border-line bg-white px-4 py-3.5 shadow-[0_4px_20px_rgba(0,0,0,0.07)]">
          <Search size={18} className="flex-none text-steel-2" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("ui.search.placeholder")}
            className="flex-1 border-0 bg-transparent text-[15px] text-ink outline-none placeholder:text-steel-2"
          />
          {isFetching && (
            <span className="flex-none text-[12px] text-steel-2">{t("ui.search.searching")}</span>
          )}
          <button onClick={onClose} aria-label={t("ui.search.close")} className="flex-none text-steel-2 hover:text-ink">
            <X size={18} />
          </button>
        </div>

        {debouncedQuery.length >= 2 && (
          <div className="mt-3 max-h-[70vh] overflow-y-auto rounded-xl border border-line bg-white shadow-[0_8px_32px_rgba(0,0,0,0.08)]">
            {!hasResults && !isFetching && (
              <p className="px-5 py-8 text-center text-[14px] text-steel">
                {t("ui.search.noResults", { query: debouncedQuery })}
              </p>
            )}

            {(data?.categories.length ?? 0) > 0 && (
              <div className="border-b border-line px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-steel-2">{t("ui.search.categories")}</p>
                {data!.categories.map((cat) => (
                  <Link
                    key={cat.id}
                    href={`/products?category=${cat.slug}`}
                    onClick={onClose}
                    className="flex items-center justify-between rounded-md px-2 py-2 text-[14px] text-ink hover:bg-offwhite"
                  >
                    {cat.name}
                    <ArrowRight size={13} className="text-steel-2" />
                  </Link>
                ))}
              </div>
            )}

            {(data?.products.length ?? 0) > 0 && (
              <div className="px-5 py-3">
                <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-steel-2">{t("ui.search.products")}</p>
                {data!.products.map((product) => (
                  <Link
                    key={product.id}
                    href={`/products/${product.slug}`}
                    onClick={onClose}
                    className="flex items-center gap-3.5 rounded-md px-2 py-2.5 hover:bg-offwhite"
                  >
                    {product.thumbnail ? (
                      <img src={product.thumbnail} alt={product.title} className="h-10 w-10 flex-none rounded-md border border-line object-cover" />
                    ) : (
                      <div className="h-10 w-10 flex-none rounded-md border border-line bg-grey" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[14px] font-medium text-ink">{product.title}</p>
                      <p className="text-[12px] text-steel">{product.category.name}{product.productCode ? ` · ${product.productCode}` : ""}</p>
                    </div>
                    <ArrowRight size={13} className="flex-none text-steel-2" />
                  </Link>
                ))}
              </div>
            )}

            {debouncedQuery.length >= 2 && hasResults && (
              <div className="border-t border-line px-5 py-3">
                <Link
                  href={`/products?search=${encodeURIComponent(debouncedQuery)}`}
                  onClick={onClose}
                  className="flex items-center gap-1.5 text-[13.5px] font-medium text-brand hover:underline"
                >
                  {t("ui.search.seeAll", { query: debouncedQuery })} <ArrowRight size={13} />
                </Link>
              </div>
            )}
          </div>
        )}

        {debouncedQuery.length < 2 && (
          <p className="mt-8 text-center text-[13.5px] text-steel">{t("ui.search.minChars")}</p>
        )}
      </div>

      <button className="mt-auto flex-1" onClick={onClose} aria-label={t("ui.search.close")} />
    </div>
  );
}
