"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductFilters } from "@/components/sections/ProductFilters";
import { ProductCard } from "@/components/ui/ProductCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useProducts } from "@/hooks/api/useProducts";
import { useCategories } from "@/hooks/api/useCategories";
import { cn } from "@/utils/cn";

export function ProductsListingClient() {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category") ?? undefined;
  const searchQuery = searchParams.get("search") ?? undefined;

  // Fully wired: passes structured params to useProducts
  const { data: result, isLoading } = useProducts({
    category: categorySlug,
    search: searchQuery,
    limit: 48,
  });

  const { data: categories = [] } = useCategories();

  const [showFilters, setShowFilters] = useState(true);
  const [view, setView] = useState<"doctor" | "dealer">("doctor");
  const [sort, setSort] = useState<"newest" | "name_asc" | "name_desc">("newest");

  const products = result?.data ?? [];
  const category = categories.find((c) => c.slug === categorySlug);
  const title = category ? category.name : "All Products";

  return (
    <div className="pb-20">
      <Container className="pt-12 pb-7">
        <nav className="mb-1.5 text-[13px] text-steel-2">
          <Link href="/" className="hover:text-brand">Home</Link>{" "}/ Products
          {category && (
            <>{" "}/ <span className="text-ink">{category.name}</span></>
          )}
        </nav>
        <h1 className="text-[clamp(26px,3.4vw,40px)] font-bold uppercase tracking-tight text-ink">{title}</h1>
        <p className="mt-4 max-w-[880px] text-[15px] leading-relaxed text-steel">
          {category?.description ?? "Precision orthodontic hardware manufactured in-house since 1994 — brackets, wires, bands and tubes, available as single packs or full dealer cases."}
        </p>
      </Container>

      <div className="border-y border-line">
        <Container className="flex flex-wrap items-center justify-between gap-5 py-5.5">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2.5 rounded-pill bg-grey px-6 py-3 text-[13.5px] font-semibold tracking-wide text-ink"
          >
            <SlidersHorizontal size={14} /> {showFilters ? "Hide Filters" : "Show Filters"}
          </button>

          <div className="flex items-center gap-3.5">
            {/* Doctor / Dealer toggle */}
            <div className="flex gap-2">
              {(["doctor", "dealer"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-pill px-4.5 py-2.5 text-[13.5px] font-medium transition-colors",
                    view === v ? "bg-ink text-white" : "bg-grey text-steel"
                  )}
                >
                  {v === "doctor" ? "Doctor" : "Dealer"}
                </button>
              ))}
            </div>

            {/* Sort dropdown */}
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                className="inline-flex items-center gap-2.5 appearance-none cursor-pointer rounded-pill border border-line bg-white px-6 py-3 text-[13.5px] text-ink pr-9 outline-none"
              >
                <option value="newest">Newest</option>
                <option value="name_asc">Name A–Z</option>
                <option value="name_desc">Name Z–A</option>
              </select>
              <ChevronDown size={12} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-steel" />
            </div>
          </div>
        </Container>
      </div>

      <Container className="grid grid-cols-1 gap-12.5 pt-8.5 sm:grid-cols-[250px_1fr]">
        {showFilters && <ProductFilters />}

        <div>
          {/* Result summary */}
          {!isLoading && result?.pagination && (
            <p className="mb-5 text-[13px] text-steel">
              {result.pagination.total} product{result.pagination.total !== 1 ? "s" : ""}
              {categorySlug ? ` in ${title}` : ""}
            </p>
          )}

          {isLoading ? (
            <SkeletonGrid count={6} columns={3} />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[15px] font-medium text-ink">No products found</p>
              <p className="mt-1.5 text-[13.5px] text-steel">
                {searchQuery ? `No results for "${searchQuery}".` : "No products in this category yet."}
              </p>
              <Link href="/products" className="mt-5 text-[13.5px] font-medium text-brand hover:underline">
                View all products →
              </Link>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-7.5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => (
                <ProductCard
                  key={p.slug}
                  image={p.thumbnail ?? p.images[0] ?? ""}
                  title={p.title}
                  slug={p.slug}
                  category={p.category.name}
                  shortDescription={
                    view === "dealer"
                      ? "Tiered dealer pricing available — contact us."
                      : (p.shortDescription?.slice(0, 72) ?? "") + (p.shortDescription && p.shortDescription.length > 72 ? "…" : "")
                  }
                />
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
