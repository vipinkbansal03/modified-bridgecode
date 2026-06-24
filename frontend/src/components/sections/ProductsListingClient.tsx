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
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
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
  const { t } = useStaticTranslations();

  const [showFilters, setShowFilters] = useState(true);
  const [view, setView] = useState<"doctor" | "dealer">("doctor");
  const [sort, setSort] = useState<"newest" | "name_asc" | "name_desc">("newest");

  const products = result?.data ?? [];
  const category = categories.find((c) => c.slug === categorySlug);
  const title = category ? category.name : t("ui.products.allProducts");

  return (
    <div className="pb-20">
      <Container className="pt-12 pb-7">
        <nav className="mb-1.5 text-[13px] text-steel-2">
          <Link href="/" className="hover:text-brand">{t("ui.products.breadcrumbHome")}</Link>{" "}/ {t("ui.products.breadcrumbProducts")}
          {category && (
            <>{" "}/ <span className="text-ink">{category.name}</span></>
          )}
        </nav>
        <h1 className="text-[clamp(26px,3.4vw,40px)] font-bold uppercase tracking-tight text-ink">{title}</h1>
        <p className="mt-4 max-w-[880px] text-[15px] leading-relaxed text-steel">
          {category?.description ?? t("ui.products.description")}
        </p>
      </Container>

      <div className="border-y border-line">
        <Container className="flex flex-wrap items-center justify-between gap-5 py-5.5">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2.5 rounded-pill bg-grey px-6 py-3 text-[13.5px] font-semibold tracking-wide text-ink"
          >
            <SlidersHorizontal size={14} /> {showFilters ? t("ui.products.hideFilters") : t("ui.products.showFilters")}
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
                  {v === "doctor" ? t("ui.products.doctor") : t("ui.products.dealer")}
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
                <option value="newest">{t("ui.products.newest")}</option>
                <option value="name_asc">{t("ui.products.nameAsc")}</option>
                <option value="name_desc">{t("ui.products.nameDesc")}</option>
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
              {result.pagination.total} {result.pagination.total === 1 ? t("ui.products.resultSingular") : t("ui.products.resultPlural")}
              {categorySlug ? ` ${t("ui.products.inCategory")} ${title}` : ""}
            </p>
          )}

          {isLoading ? (
            <SkeletonGrid count={6} columns={3} />
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <p className="text-[15px] font-medium text-ink">{t("ui.products.emptyTitle")}</p>
              <p className="mt-1.5 text-[13.5px] text-steel">
                {searchQuery ? t("ui.products.emptySearch", { query: searchQuery }) : t("ui.products.emptyCategory")}
              </p>
              <Link href="/products" className="mt-5 text-[13.5px] font-medium text-brand hover:underline">
                {t("ui.products.viewAll")}
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
                      ? t("ui.products.dealerPricing")
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
