"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { SlidersHorizontal, ChevronDown, ChevronRight, X, Search, ArrowLeft } from "lucide-react";
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

interface CategorySectionProps {
  category: {
    id: string;
    name: string;
    slug: string;
    description?: string | null;
  };
  products: Array<any>;
  selectedCurrency?: string;
  onCategoryClick?: (slug: string) => void;
}

function CategorySection({ category, products, selectedCurrency, onCategoryClick }: CategorySectionProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const description = category.description;
  const sanitizedHtml = useMemo(
    () => (description ? sanitizeCategoryDescription(description) : ""),
    [description]
  );
  const plainText = useMemo(
    () => (description ? stripHtmlTags(description) : ""),
    [description]
  );
  const isLong = plainText.length > 200;
  const collapsedPreview = useMemo(() => {
    if (!isLong) return sanitizedHtml;
    const sub = plainText.slice(0, 190);
    const lastSpace = sub.lastIndexOf(" ");
    const cleanSub = lastSpace > 140 ? sub.slice(0, lastSpace) : sub;
    return sanitizeCategoryDescription(cleanSub);
  }, [sanitizedHtml, plainText, isLong]);

  return (
    <div className="border-b border-line/60 pb-12 mb-12 last:border-b-0 last:pb-0 last:mb-0">
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {onCategoryClick ? (
            <button
              type="button"
              onClick={() => onCategoryClick(category.slug)}
              className="group inline-flex items-center gap-2 text-left cursor-pointer"
            >
              <h2 className="text-[20px] sm:text-[24px] font-bold text-ink uppercase tracking-tight group-hover:text-brand transition-colors flex items-center gap-2">
                {category.name}
                <ChevronRight size={18} className="text-steel-2 opacity-60 group-hover:opacity-100 group-hover:text-brand group-hover:translate-x-1 transition-all" />
              </h2>
            </button>
          ) : (
            <Link
              href={`/products?category=${category.slug}`}
              className="group inline-flex items-center gap-2 cursor-pointer"
            >
              <h2 className="text-[20px] sm:text-[24px] font-bold text-ink uppercase tracking-tight group-hover:text-brand transition-colors flex items-center gap-2">
                {category.name}
                <ChevronRight size={18} className="text-steel-2 opacity-60 group-hover:opacity-100 group-hover:text-brand group-hover:translate-x-1 transition-all" />
              </h2>
            </Link>
          )}
          <span className="text-[12px] font-semibold text-steel-2 bg-grey px-2.5 py-0.5 rounded-full">
            {products.length} {products.length === 1 ? "product" : "products"}
          </span>
        </div>

        {description && (
          <div className="mt-2 text-[14.5px] leading-relaxed text-steel max-w-[920px]">
            {isExpanded ? (
              <div className="[&_a]:text-brand [&_a]:underline [&_strong]:font-semibold [&_strong]:text-ink [&_b]:font-semibold [&_b]:text-ink [&_p]:mb-1.5 [&_p:last-child]:mb-0">
                <div dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
                {isLong && (
                  <button
                    type="button"
                    onClick={() => setIsExpanded(false)}
                    className="mt-1 inline-flex items-center text-[13px] font-semibold text-brand hover:underline cursor-pointer"
                  >
                    Show less
                  </button>
                )}
              </div>
            ) : (
              <p className="[&_a]:text-brand [&_a]:underline [&_strong]:font-semibold [&_strong]:text-ink [&_b]:font-semibold [&_b]:text-ink">
                <span dangerouslySetInnerHTML={{ __html: collapsedPreview }} />
                {isLong && (
                  <>
                    <span>... </span>
                    <button
                      type="button"
                      onClick={() => setIsExpanded(true)}
                      className="inline-flex items-center font-semibold text-brand hover:underline cursor-pointer ml-1"
                    >
                      Read more
                    </button>
                  </>
                )}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3">
        {products.map((p) => (
          <ProductCard
            key={p.slug}
            id={p.id}
            image={p.thumbnail?.trim() || p.images.find((img: string) => img?.trim()) || null}
            title={p.title}
            slug={p.slug}
            category={p.category?.name || category.name}
            shortDescription={
              (p.shortDescription?.slice(0, 72) ?? "") + (p.shortDescription && p.shortDescription.length > 72 ? "…" : "")
            }
            price={formatListingPrice(p.prices, selectedCurrency)}
            badge={p.isFeatured ? "Featured" : undefined}
          />
        ))}
      </div>
    </div>
  );
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
  const [filters, setFilters] = useState<ProductFilterState>(() => ({
    featuredOnly: false,
    categorySlugs: categorySlug ? [categorySlug] : [],
    attributeValues: [],
  }));

  useEffect(() => {
    if (categorySlug) {
      setFilters((prev) => {
        if (prev.categorySlugs.length !== 1 || prev.categorySlugs[0] !== categorySlug) {
          return { ...prev, categorySlugs: [categorySlug] };
        }
        return prev;
      });
    }
  }, [categorySlug]);

  const handleFilterChange = (nextFilters: ProductFilterState) => {
    setFilters(nextFilters);
    if (nextFilters.categorySlugs.length === 1 && nextFilters.categorySlugs[0] !== categorySlug) {
      router.replace(`/products?category=${nextFilters.categorySlugs[0]}`, { scroll: false });
    } else if (nextFilters.categorySlugs.length === 0 && categorySlug) {
      router.replace(`/products`, { scroll: false });
    }
  };

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
    limit: 100,
  });
  const { data: facetRows = [] } = useProductFacets();
  const { data: filterConfig } = useProductFiltersConfig();

  const products = useMemo(() => {
    const rows = result?.data ?? [];
    if (filters.categorySlugs.length <= 1) return rows;
    return rows.filter((product) => filters.categorySlugs.includes(product.category.slug));
  }, [filters.categorySlugs, result?.data]);

  const availableAttributeValues = facetRows;

  // Dynamic CMS Page Content for top hero
  const heroSection = cmsPage?.sections?.find(
    (s) => s.sectionKey === "products.hero" || s.sectionKey.endsWith(".hero")
  );
  const heroBlock = heroSection?.blocks?.[0];

  const pageTitle = heroBlock?.title || "Orthodontic products manufactured in-house.";
  const pageDescription = heroBlock?.description || "Browse product families built for orthodontists, dealers, and OEM distribution partners across global markets.";

  // Group products into category sections
  const categorySections = useMemo(() => {
    if (!products.length) return [];

    const sections: Array<{
      category: {
        id: string;
        name: string;
        slug: string;
        description?: string | null;
      };
      products: typeof products;
    }> = [];

    // Order by categories list
    for (const cat of categories) {
      // If a specific category or categories are filtered, check match
      if (effectiveCategory && cat.slug !== effectiveCategory) continue;
      if (filters.categorySlugs.length > 1 && !filters.categorySlugs.includes(cat.slug)) continue;

      const catProducts = products.filter(
        (p) => p.category?.slug === cat.slug
      );

      if (catProducts.length > 0) {
        sections.push({
          category: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
            description: cat.description,
          },
          products: catProducts,
        });
      }
    }

    // Capture any products belonging to categories not in the main categories query
    const assignedIds = new Set(
      sections.flatMap((s) => s.products.map((p) => p.id))
    );
    const unassigned = products.filter((p) => !assignedIds.has(p.id));

    if (unassigned.length > 0) {
      // Group unassigned by their product.category
      const groups = new Map<string, typeof products>();
      for (const p of unassigned) {
        const catName = p.category?.name || "General Products";
        const list = groups.get(catName) || [];
        list.push(p);
        groups.set(catName, list);
      }

      for (const [catName, catProds] of groups.entries()) {
        sections.push({
          category: {
            id: catProds[0]?.category?.slug || "general",
            name: catName,
            slug: catProds[0]?.category?.slug || "general",
            description: null,
          },
          products: catProds,
        });
      }
    }

    return sections;
  }, [categories, products, effectiveCategory, filters.categorySlugs]);

  const allProductDirectory = useMemo(() => {
    const result: Array<{
      category: { id: string; name: string; slug: string };
      products: Array<{ id: string; title: string; slug: string }>;
    }> = [];

    for (const cat of categories) {
      const catProducts = products.filter(
        (p) => p.category?.slug === cat.slug || p.category?.name === cat.name
      );
      if (catProducts.length > 0) {
        result.push({
          category: {
            id: cat.id,
            name: cat.name,
            slug: cat.slug,
          },
          products: catProducts.map((p) => ({
            id: p.id,
            title: p.title,
            slug: p.slug,
          })),
        });
      }
    }

    const assignedIds = new Set(result.flatMap((r) => r.products.map((p) => p.id)));
    const unassigned = products.filter((p) => !assignedIds.has(p.id));
    if (unassigned.length > 0) {
      const otherGroup: { [catName: string]: Array<{ id: string; title: string; slug: string }> } = {};
      for (const p of unassigned) {
        const cName = p.category?.name || "Other Products";
        if (!otherGroup[cName]) otherGroup[cName] = [];
        otherGroup[cName].push({ id: p.id, title: p.title, slug: p.slug });
      }
      for (const [cName, prods] of Object.entries(otherGroup)) {
        result.push({
          category: {
            id: cName,
            name: cName,
            slug: unassigned.find((p) => p.category?.name === cName)?.category?.slug || "",
          },
          products: prods,
        });
      }
    }

    return result;
  }, [categories, products]);

  const [sidebarSearch, setSidebarSearch] = useState("");
  const [visibleSidebarCount, setVisibleSidebarCount] = useState(30);

  const filteredSidebarProducts = useMemo(() => {
    const q = sidebarSearch.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => p.title.toLowerCase().includes(q));
  }, [products, sidebarSearch]);

  const displayedSidebarProducts = useMemo(() => {
    return filteredSidebarProducts.slice(0, visibleSidebarCount);
  }, [filteredSidebarProducts, visibleSidebarCount]);

  const handleSidebarScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      if (visibleSidebarCount < filteredSidebarProducts.length) {
        setVisibleSidebarCount((prev) => prev + 25);
      }
    }
  };

  const router = useRouter();

  const handleCategoryClick = (slug: string) => {
    if (effectiveCategory === slug) {
      setFilters((prev) => ({ ...prev, categorySlugs: [] }));
      router.push("/products", { scroll: false });
    } else {
      setFilters((prev) => ({ ...prev, categorySlugs: [slug] }));
      router.push(`/products?category=${slug}`, { scroll: false });
    }
  };

  const activeFiltersCount =
    (filters.featuredOnly ? 1 : 0) +
    filters.categorySlugs.length +
    filters.attributeValues.length;

  return (
    <div className="pb-20">
      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 xl:px-10 py-6 lg:py-[34px]">
        <div className="mb-2.5">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] shadow-2xs transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
          >
            <ArrowLeft size={14} className="text-[#E31E24]" />
            <span>Back to Home</span>
          </Link>
        </div>
        <nav className="mb-2 text-[13px] text-steel-2">
          <Link href="/" className="hover:text-brand">
            {t("ui.products.breadcrumbHome")}
          </Link>{" "}
          / {t("ui.products.breadcrumbProducts")}
          {effectiveCategory && (
            <>
              {" "}
              / <span className="text-ink font-semibold">{categories.find((c) => c.slug === effectiveCategory)?.name || effectiveCategory}</span>
            </>
          )}
        </nav>
        <h1 className="text-[clamp(26px,3.4vw,40px)] font-bold uppercase tracking-tight text-ink leading-tight">
          {pageTitle}
        </h1>
        {pageDescription && (
          <p className="mt-3 max-w-[1100px] text-[15px] leading-relaxed text-steel">
            {pageDescription}
          </p>
        )}
      </div>

      <div className="border-y border-line bg-white">
        <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 xl:px-10 flex items-center justify-between py-3.5">
          <div className="text-[14.5px] text-steel">
            <strong className="font-bold text-ink">{products.length}</strong> {products.length === 1 ? "product" : "products"}
          </div>

          <div className="flex items-center gap-2.5">
            <span className="text-[13.5px] text-steel">Sort by</span>
            <div className="relative">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as typeof sort)}
                aria-label="Sort products"
                className="appearance-none rounded-md border border-line bg-white py-1.5 pl-3 pr-8 text-[13px] font-medium text-ink outline-none cursor-pointer focus:border-ink"
              >
                <option value="newest">Newest</option>
                <option value="name_asc">Name (A-Z)</option>
                <option value="name_desc">Name (Z-A)</option>
              </select>
              <ChevronDown size={13} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-steel" />
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto w-full max-w-[1720px] px-4 sm:px-8 xl:px-10 flex flex-col lg:flex-row items-start gap-8 pt-6 lg:pt-[34px]">
        {/* Sidebar matching reference image */}
        <aside className="w-full lg:w-[280px] xl:w-[300px] shrink-0 lg:sticky lg:top-[135px] xl:top-[145px] lg:self-start lg:max-h-[calc(100vh-160px)] flex flex-col pr-2">
          {/* Pinned Static Header & Search - Never scrolls away */}
          <div className="shrink-0 bg-white pb-1">
            <div className="flex items-center justify-between pb-2.5 border-b border-line">
              <h2 className="text-[16px] font-bold text-ink tracking-tight">All products</h2>
              <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-bold text-steel">
                {filteredSidebarProducts.length}
              </span>
            </div>

            {/* Quick Search */}
            <div className="relative my-2.5">
              <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-steel" />
              <input
                type="text"
                value={sidebarSearch}
                onChange={(e) => {
                  setSidebarSearch(e.target.value);
                  setVisibleSidebarCount(30);
                }}
                placeholder="Search products..."
                className="w-full rounded-md border border-line bg-slate-50/70 py-1.5 pl-8 pr-7 text-[12.5px] text-ink placeholder:text-steel outline-none focus:border-ink focus:bg-white transition-colors"
              />
              {sidebarSearch && (
                <button
                  type="button"
                  onClick={() => {
                    setSidebarSearch("");
                    setVisibleSidebarCount(30);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-steel hover:text-ink cursor-pointer"
                  title="Clear search"
                >
                  <X size={13} />
                </button>
              )}
            </div>
          </div>

          {/* Scrollable Body: Product Directory & Filters */}
          <div className="flex-1 overflow-y-auto overscroll-contain pr-1 [scrollbar-width:thin] pb-6">
            {/* Product Names List */}
            <div className="divide-y divide-line">
              {displayedSidebarProducts.length === 0 ? (
                <div className="py-6 text-center text-[12.5px] text-steel">
                  No products found matching &ldquo;{sidebarSearch}&rdquo;
                </div>
              ) : (
                displayedSidebarProducts.map((p) => (
                  <div key={p.slug || p.id} className="py-2">
                    <Link
                      href={`/products/${p.slug}`}
                      title={p.title}
                      className="block border-l-2 border-[#E31E24] pl-3 text-[13px] font-semibold text-ink hover:text-[#E31E24] transition-colors leading-snug cursor-pointer"
                    >
                      {p.title}
                    </Link>
                  </div>
                ))
              )}
              {visibleSidebarCount < filteredSidebarProducts.length && (
                <div className="py-2 text-center text-[11px] font-medium text-steel">
                  Showing {displayedSidebarProducts.length} of {filteredSidebarProducts.length}
                </div>
              )}
            </div>

            {/* Filters section */}
            <div className="pt-4 border-t border-line mt-3">
              <ProductFilters
                value={filters}
                onChange={handleFilterChange}
                availableAttributeValues={availableAttributeValues}
                filterConfig={filterConfig ?? null}
              />
            </div>
          </div>
        </aside>

        <div className="flex-1 min-w-0">
          {effectiveCategory && (
            <div className="mb-5 flex flex-wrap items-center gap-2">
              <span className="text-[13px] text-steel">Active Category:</span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 px-3 py-1 text-[12.5px] font-semibold text-[#E31E24] border border-red-100">
                {categories.find((c) => c.slug === effectiveCategory)?.name || effectiveCategory}
                <button
                  type="button"
                  onClick={() => handleCategoryClick(effectiveCategory)}
                  className="ml-1 hover:text-red-900 cursor-pointer"
                  title="Clear filter"
                >
                  <X size={13} />
                </button>
              </span>
              <button
                type="button"
                onClick={() => {
                  setFilters((prev) => ({ ...prev, categorySlugs: [] }));
                  router.push("/products", { scroll: false });
                }}
                className="text-[12.5px] text-steel hover:text-ink hover:underline cursor-pointer ml-1"
              >
                Show All Categories
              </button>
            </div>
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
            <div className="space-y-4">
              {categorySections.map((section) => (
                <CategorySection
                  key={section.category.id || section.category.slug}
                  category={section.category}
                  products={section.products}
                  selectedCurrency={selectedCurrency}
                  onCategoryClick={handleCategoryClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
