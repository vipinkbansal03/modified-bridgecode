"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { useSearch } from "@/hooks/api/useSearch";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { cn } from "@/utils/cn";

function useDebounce(value: string, delay: number) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(value), delay);
    return () => window.clearTimeout(timer);
  }, [delay, value]);

  return debounced;
}

export function HeaderSearch({ fullWidth = false, onNavigate }: { fullWidth?: boolean; onNavigate?: () => void }) {
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debouncedQuery = useDebounce(query.trim(), 300);
  const { data, isFetching } = useSearch(debouncedQuery);
  const { t } = useStaticTranslations();

  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setFocused(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, []);

  const showPanel = focused && debouncedQuery.length >= 2;
  const hasResults = (data?.products.length ?? 0) > 0 || (data?.categories.length ?? 0) > 0;

  const close = () => {
    setFocused(false);
    onNavigate?.();
  };

  return (
    <div ref={wrapperRef} className={cn("relative", fullWidth ? "w-full" : "w-[210px] 2xl:w-[270px]")}>
      <div className="flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3 transition-colors focus-within:border-[#E31E24]">
        <Search size={16} className="flex-none text-steel-2" />
        <input
          value={query}
          onFocus={() => setFocused(true)}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("ui.search.placeholder")}
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-steel-2"
        />
        {query && (
          <button
            type="button"
            aria-label={t("ui.search.close")}
            onClick={() => setQuery("")}
            className="flex-none text-steel-2 hover:text-ink"
          >
            <X size={15} />
          </button>
        )}
      </div>

      {showPanel && (
        <div className={cn("absolute top-full z-[70] mt-2 max-h-[420px] overflow-y-auto rounded-xl border border-line bg-white shadow-[0_16px_40px_rgba(0,0,0,0.12)]", fullWidth ? "left-0 right-0" : "right-0 w-[360px]")}>
          {isFetching && <p className="px-4 py-4 text-[13px] text-steel">{t("ui.search.searching")}</p>}

          {!hasResults && !isFetching && (
            <p className="px-4 py-5 text-center text-[13px] text-steel">
              {t("ui.search.noResults", { query: debouncedQuery })}
            </p>
          )}

          {(data?.categories.length ?? 0) > 0 && (
            <div className="border-b border-line px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-steel-2">{t("ui.search.categories")}</p>
              {data!.categories.map((category) => (
                <Link
                  key={category.id}
                  href={`/products?category=${category.slug}`}
                  onClick={close}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-[13px] text-ink hover:bg-offwhite"
                >
                  {category.name}
                  <ArrowRight size={13} className="text-steel-2" />
                </Link>
              ))}
            </div>
          )}

          {(data?.products.length ?? 0) > 0 && (
            <div className="px-4 py-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-steel-2">{t("ui.search.products")}</p>
              {data!.products.map((product) => (
                <Link
                  key={product.id}
                  href={`/products/${product.slug}`}
                  onClick={close}
                  className="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-offwhite"
                >
                  {product.thumbnail ? (
                    <img src={product.thumbnail} alt={product.title} className="h-9 w-9 flex-none rounded-md border border-line object-cover" />
                  ) : (
                    <div className="h-9 w-9 flex-none rounded-md border border-line bg-grey" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-ink">{product.title}</p>
                    <p className="truncate text-[11.5px] text-steel">{product.category.name}{product.productCode ? ` · ${product.productCode}` : ""}</p>
                  </div>
                  <ArrowRight size={13} className="flex-none text-steel-2" />
                </Link>
              ))}
            </div>
          )}

          {hasResults && (
            <div className="border-t border-line px-4 py-3">
              <Link
                href={`/products?search=${encodeURIComponent(debouncedQuery)}`}
                onClick={close}
                className="flex items-center gap-1.5 text-[13px] font-medium text-brand hover:underline"
              >
                {t("ui.search.seeAll", { query: debouncedQuery })} <ArrowRight size={13} />
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
