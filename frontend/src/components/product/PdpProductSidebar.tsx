"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Loader2, Search, X } from "lucide-react";
import { useInfiniteProducts } from "@/hooks/api/useProducts";
import { cn } from "@/utils/cn";

interface PdpProductSidebarProps {
  currentSlug?: string;
}

export function PdpProductSidebar({ currentSlug }: PdpProductSidebarProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const activeItemRef = useRef<HTMLAnchorElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);

  // Debounce search query by 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Infinite products query with server-side pagination & dynamic search
  const {
    data,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
  } = useInfiniteProducts({
    limit: 50,
    sort: "name_asc",
    search: debouncedSearch || undefined,
  });

  const products = useMemo(() => {
    return data?.pages.flatMap((page) => page.data) ?? [];
  }, [data]);

  const totalCount = data?.pages[0]?.pagination?.total ?? products.length;

  // Auto-scroll the active product item into view on initial load
  useEffect(() => {
    if (activeItemRef.current && scrollContainerRef.current) {
      activeItemRef.current.scrollIntoView({
        block: "nearest",
        behavior: "smooth",
      });
    }
  }, [products.length, currentSlug]);

  // Infinite scroll trigger on near-bottom reaching
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 60) {
      if (hasNextPage && !isFetchingNextPage) {
        fetchNextPage();
      }
    }
  };

  return (
    <div className="w-full h-full min-h-[480px] lg:min-h-0 rounded-xl border border-[#E31E24] bg-white p-3.5 shadow-2xs flex flex-col">
      <div className="flex items-center justify-between pb-2.5 border-b border-[#E31E24] shrink-0">
        <h2 className="text-[14.5px] font-bold text-[#111827] tracking-tight">All Products</h2>
        <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-[#E31E24] border border-[#E31E24]">
          {isLoading ? "..." : totalCount}
        </span>
      </div>

      {/* Quick Search */}
      <div className="relative my-2.5 shrink-0">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-[#111827]" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full rounded-md border border-[#E31E24] bg-white py-1.5 pl-8 pr-7 text-[12px] text-[#111827] placeholder:text-[#6B7280] outline-none focus:ring-1 focus:ring-[#E31E24] transition-colors"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#111827] hover:text-[#E31E24] cursor-pointer p-0.5"
            title="Clear search"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* Scrollable Product Names List - Expands to cover full vertical height */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-[300px] overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] divide-y divide-red-100 rounded border border-[#E31E24] bg-red-50/10 p-1"
      >
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 10 }).map((_, idx) => (
              <div
                key={idx}
                className="h-6 w-full animate-pulse rounded bg-slate-200/70"
              />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-8 text-center text-[12px] text-[#111827]">
            No products found{debouncedSearch ? ` for "${debouncedSearch}"` : ""}.
          </div>
        ) : (
          products.map((p) => {
            const isActive = p.slug === currentSlug;
            return (
              <div key={p.slug || p.id} className="py-0.5">
                <Link
                  ref={isActive ? activeItemRef : undefined}
                  href={`/products/${p.slug}`}
                  title={p.title}
                  className={cn(
                    "block border-l-2 pl-2.5 py-1 text-[12px] font-semibold transition-all leading-snug cursor-pointer truncate rounded-r",
                    isActive
                      ? "border-[#E31E24] text-[#E31E24] bg-red-50 font-bold"
                      : "border-transparent text-[#111827] hover:text-[#E31E24] hover:border-[#E31E24] hover:bg-red-50/40"
                  )}
                >
                  {p.title}
                </Link>
              </div>
            );
          })
        )}

        {/* Loading next page indicator */}
        {isFetchingNextPage && (
          <div className="flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-steel">
            <Loader2 size={12} className="animate-spin text-[#E31E24]" />
            <span>Loading more...</span>
          </div>
        )}
      </div>
    </div>
  );
}
