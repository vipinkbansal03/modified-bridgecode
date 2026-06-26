"use client";

import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { apiClient, HAS_LIVE_API, unwrapPaginated, unwrapData } from "@/lib/apiClient";
import { qk, STALE } from "@/lib/queryConfig";
import { useLanguageContext } from "@/contexts/LanguageContext";
import { useCurrencyContext } from "@/contexts/CurrencyContext";
import type { ApiProductSummary, ApiProductDetail } from "@/types/api.types";

// ─── Static fallbacks ─────────────────────────────────────

async function loadStaticProducts(): Promise<ApiProductSummary[]> {
  const { default: raw } = await import("@/data/products.json");
  return (raw as Record<string, unknown>[]).map((p) => ({
    id: p.slug as string,
    slug: p.slug as string,
    title: p.title as string,
    productCode: (p.productCode as string) ?? null,
    brand: "Modern Orthodontics",
    shortDescription: (p.shortDescription as string) ?? null,
    category: { name: (p.category as string) ?? "", slug: (p.categorySlug as string) ?? "" },
    images: (p.images as string[]) ?? [],
    thumbnail: ((p.images as string[]) ?? [])[0] ?? null,
    isFeatured: false,
    hasVariants: false,
    variantCount: 0,
    prices: [],
  }));
}

async function loadStaticProduct(slug: string): Promise<ApiProductDetail | null> {
  const { default: raw } = await import("@/data/products.json");
  const p = (raw as Record<string, unknown>[]).find((x) => x.slug === slug);
  if (!p) return null;
  return {
    id: p.slug as string,
    slug: p.slug as string,
    title: p.title as string,
    productCode: (p.productCode as string) ?? null,
    brand: "Modern Orthodontics",
    shortDescription: (p.shortDescription as string) ?? null,
    description: (p.information as string) ?? null,
    category: { name: p.category as string, slug: p.categorySlug as string },
    images: ((p.images as string[]) ?? []).map((url) => ({ url, alt: p.title as string })),
    documents: [],
    packages: [],
    thumbnail: ((p.images as string[]) ?? [])[0] ?? null,
    isFeatured: false,
    hasVariants: false,
    variantCount: 0,
    prices: [],
    seoTitle: null,
    seoDescription: null,
    seoKeywords: null,
    attributes: [],
    variants: [],
  };
}

// ─── Fetch functions ──────────────────────────────────────

export interface ProductListParams {
  page?: number;
  limit?: number;
  category?: string;
  search?: string;
  featured?: boolean;
  sort?: "newest" | "name_asc" | "name_desc";
  lang?: string;
  countryCode?: string;
}

async function fetchProducts(params: ProductListParams = {}) {
  if (!HAS_LIVE_API) {
    const all = await loadStaticProducts();
    const filtered = params.category ? all.filter((p) => p.category.slug === params.category) : all;
    const searched = params.search
      ? filtered.filter((p) => p.title.toLowerCase().includes(params.search!.toLowerCase()) || (p.productCode ?? "").toLowerCase().includes(params.search!.toLowerCase()))
      : filtered;
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const start = (page - 1) * limit;
    return { data: searched.slice(start, start + limit), pagination: { page, limit, total: searched.length, totalPages: Math.ceil(searched.length / limit) } };
  }
  const res = await apiClient.get("/products", { params: { page: params.page, limit: params.limit, category: params.category, search: params.search, featured: params.featured, sort: params.sort, lang: params.lang, countryCode: params.countryCode } });
  return unwrapPaginated<ApiProductSummary>(res);
}

async function fetchProduct(slug: string, lang?: string, countryCode?: string): Promise<ApiProductDetail | null> {
  if (!HAS_LIVE_API) return loadStaticProduct(slug);
  const res = await apiClient.get(`/products/${slug}`, { params: { lang, countryCode } });
  return unwrapData<ApiProductDetail>(res);
}

async function fetchFeaturedProducts(lang?: string, countryCode?: string) {
  if (!HAS_LIVE_API) { const all = await loadStaticProducts(); return all.slice(0, 6); }
  const res = await apiClient.get("/products", { params: { featured: true, limit: 6, lang, countryCode } });
  return unwrapPaginated<ApiProductSummary>(res).data;
}

// ─── Hooks ────────────────────────────────────────────────

export function useProducts(params: ProductListParams = {}) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  const localizedParams = { ...params, lang: selectedLanguage, countryCode: selectedCountryCode };
  return useQuery({ queryKey: qk.products.list(localizedParams), queryFn: () => fetchProducts(localizedParams), staleTime: STALE.medium, placeholderData: keepPreviousData });
}

export function useProductsByCategory(categorySlug?: string) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({ queryKey: qk.products.byCategory(categorySlug ?? "", selectedLanguage, selectedCountryCode), queryFn: () => fetchProducts({ category: categorySlug, lang: selectedLanguage, countryCode: selectedCountryCode }), enabled: Boolean(categorySlug), staleTime: STALE.medium });
}

export function useProduct(slug: string) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({ queryKey: qk.products.detail(slug, selectedLanguage, selectedCountryCode), queryFn: () => fetchProduct(slug, selectedLanguage, selectedCountryCode), enabled: Boolean(slug), staleTime: STALE.medium });
}

export function useFeaturedProducts() {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({ queryKey: qk.products.featured(selectedLanguage, selectedCountryCode), queryFn: () => fetchFeaturedProducts(selectedLanguage, selectedCountryCode), staleTime: STALE.long });
}
