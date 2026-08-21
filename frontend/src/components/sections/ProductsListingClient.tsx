"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, ChevronDown } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductFilters, type ProductFilterState } from "@/components/sections/ProductFilters";
import { ProductCard } from "@/components/ui/ProductCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useProducts, useProductFacets, useProductFiltersConfig } from "@/hooks/api/useProducts";
import { useCategories } from "@/hooks/api/useCategories";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import { cn } from "@/utils/cn";

import type { CmsPage } from "@/hooks/api/useCmsContent";

import { sanitizeCategoryDescription, stripHtmlTags } from "@/utils/sanitize";

function formatListingPrice(
  prices: Array<{ sellingPrice: number; currencySymbol?: string; currencyCode?: string }> | undefined,
  preferredCurrency?: string,
) {
  if (!prices?.length) return undefined;
  // Strictly match preferred currency. Do not fall back to INR or other currencies.
  const match = prices.find((price) => price.currencyCode === preferredCurrency);
  if (!match || match.sellingPrice == null) return undefined;
  const symbol = match.currencySymbol || "$";
  return `${symbol} ${Math.round(Number(match.sellingPrice)).toLocaleString()}`;
}

interface ProductsListingClientProps {
  cmsPage?: CmsPage | null;
}

export function ProductsListingClient({ cmsPage }: ProductsListingClientProps) {
  const searchParams = useSearchParams();
  const categorySlug = searchParams.get("category") ?? undefined;
  const searchQuery = searchParams.get("search") ?? undefined;
  const { selectedCurrency } = useCurrencyContext();
  const { t } = useStaticTranslations();
  const { data: categories = [] } = useCategories();

  const [showFilters, setShowFilters] = useState(true);
  const [sort, setSort] = useState<"newest" | "name_asc" | "name_desc">("newest");
  const [filters, setFilters] = useState<ProductFilterState>({
    featuredOnly: false,
    categorySlugs: [],
    attributeValues: [],
  });

  const isMultiCategory = filters.categorySlugs.length > 1;
  const effectiveCategory =
    filters.categorySlugs.length === 1
      ? filters.categorySlugs[0]
      : !filters.categorySlugs.length && categorySlug
        ? categorySlug
        : undefined;

  const { data: result, isLoading } = useProducts({
    category: effectiveCategory,
    search: searchQuery,
    featured: filters.featuredOnly || undefined,
    attributeValues: filters.attributeValues.length ? filters.attributeValues.join(",") : undefined,
    sort,
    limit: 48,
  });
  const { data: facetRows = [] } = useProductFacets();
  const { data: filterConfig } = useProductFiltersConfig();

  const products = useMemo(() => {
    const rows = result?.data ?? [];
    if (filters.categorySlugs.length <= 1) return rows;
    return rows.filter((product) => filters.categorySlugs.includes(product.category.slug));
  }, [filters.categorySlugs, result?.data]);

  const availableAttributeValues = facetRows;

  // Dynamic CMS Page Content
  const heroSection = cmsPage?.sections?.find(
    (s) => s.sectionKey === "products.hero" || s.sectionKey.endsWith(".hero")
  );
  const heroBlock = heroSection?.blocks?.[0];

  const category = effectiveCategory ? categories.find((c) => c.slug === effectiveCategory) : undefined;
  const title = category
    ? category.name
    : isMultiCategory
      ? t("ui.products.breadcrumbProducts")
      : heroBlock?.title || t("ui.products.allProducts");
  const description = category
    ? category.description
    : heroBlock?.description || t("ui.products.description");

  const sanitizedHtml = useMemo(
    () => (description ? sanitizeCategoryDescription(description) : ""),
    [description]
  );
  const plainText = useMemo(
    () => (description ? stripHtmlTags(description) : ""),
    [description]
  );
  const isLongDescription = plainText.length > 230;
  const [isDescExpanded, setIsDescExpanded] = useState(false);

  useEffect(() => {
    setIsDescExpanded(false);
  }, [effectiveCategory]);

  const collapsedPreview = useMemo(() => {
    if (!isLongDescription) return sanitizedHtml;
    const sub = plainText.slice(0, 220);
    const lastSpace = sub.lastIndexOf(" ");
    const cleanSub = lastSpace > 180 ? sub.slice(0, lastSpace) : sub;
    return sanitizeCategoryDescription(cleanSub);
  }, [sanitizedHtml, plainText, isLongDescription]);

  return (
    <div className="pb-20">
      <Container className="py-6 lg:py-[34px]">
        <nav className="mb-1.5 text-[13px] text-steel-2">
          <Link href="/" className="hover:text-brand">
            {t("ui.products.breadcrumbHome")}
          </Link>{" "}
          / {t("ui.products.breadcrumbProducts")}
          {category && (
            <>
              {" "}
              / <span className="text-ink">{category.name}</span>
            </>
          )}
        </nav>
        <h1 className="text-[clamp(26px,3.4vw,40px)] font-bold uppercase tracking-tight text-ink leading-tight">{title}</h1>
        {description && (
          <div className="mt-3 max-w-[950px] text-[15px] leading-relaxed text-steel">
            {isDescExpanded ? (
              <div className="[&_a]:text-brand [&_a]:underline [&_strong]:font-semibold [&_strong]:text-ink [&_b]:font-semibold [&_b]:text-ink [&_p]:mb-2 [&_p:last-child]:mb-0">
                <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                {isLongDescription && (
                  <button
                    type="button"
                    onClick={() => setIsDescExpanded(false)}
                    className="mt-1 inline-flex items-center text-[13px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    Show less
                  </button>
                )}
              </div>
            ) : (
              <p className="[&_a]:text-brand [&_a]:underline [&_strong]:font-semibold [&_strong]:text-ink [&_b]:font-semibold [&_b]:text-ink">
                <span dangerouslySetInnerHTML={{ __html: collapsedPreview }} />
                {isLongDescription && (
                  <>
                    <span>... </span>
                    <button
                      type="button"
                      onClick={() => setIsDescExpanded(true)}
                      className="inline-flex items-center font-semibold text-brand hover:underline cursor-pointer"
                    >
                      Read more
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </Container>


      <div className="border-y border-line">
        <Container className="flex flex-wrap items-center justify-between gap-5 py-4 lg:py-5">
          <button
            onClick={() => setShowFilters((v) => !v)}
            className="inline-flex items-center gap-2.5 rounded-pill bg-grey px-6 py-3 text-[13.5px] font-semibold tracking-wide text-ink"
          >
            <SlidersHorizontal size={14} /> {showFilters ? t("ui.products.hideFilters") : t("ui.products.showFilters")}
          </button>

          <div className="relative">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              className="inline-flex appearance-none cursor-pointer items-center gap-2.5 rounded-pill border border-line bg-white px-6 py-3 pr-9 text-[13.5px] text-ink outline-none"
            >
              <option value="newest">{t("ui.products.newest")}</option>
              <option value="name_asc">{t("ui.products.nameAsc")}</option>
              <option value="name_desc">{t("ui.products.nameDesc")}</option>
            </select>
            <ChevronDown size={12} className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-steel" />
          </div>
        </Container>
      </div>

      <Container
        className={cn(
          "grid grid-cols-1 gap-8 pt-6 lg:pt-[34px]",
          showFilters ? "sm:grid-cols-[250px_1fr]" : "sm:grid-cols-1",
        )}
      >
        {showFilters && (
          <ProductFilters value={filters} onChange={setFilters} availableAttributeValues={availableAttributeValues} filterConfig={filterConfig ?? null} />
        )}

        <div className="min-w-0">
          {!isLoading && result?.pagination && (
            <p className="mb-5 text-[13px] text-steel">
              {products.length}{" "}
              {products.length === 1 ? t("ui.products.resultSingular") : t("ui.products.resultPlural")}
              {effectiveCategory ? ` ${t("ui.products.inCategory")} ${title}` : ""}
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
                  id={p.id}
                  image={p.thumbnail?.trim() || p.images.find((image) => image?.trim()) || null}
                  title={p.title}
                  slug={p.slug}
                  category={p.category.name}
                  shortDescription={
                    (p.shortDescription?.slice(0, 72) ?? "") + (p.shortDescription && p.shortDescription.length > 72 ? "…" : "")
                  }
                  price={formatListingPrice(p.prices, selectedCurrency)}
                  badge={p.isFeatured ? "Featured" : undefined}
                />
              ))}
            </div>
          )}
        </div>
      </Container>
    </div>
  );
}
