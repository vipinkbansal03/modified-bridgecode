"use client";

import { useQuery, useQueries, useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
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
    informationImage: (p.informationImage as string) ?? null,
    informationDescription: (p.informationDescription as string) ?? null,
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
    informationImage: (p.informationImage as string) ?? null,
    informationDescription: (p.informationDescription as string) ?? null,
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
  attributeValues?: string;
  sort?: "default" | "sort_order" | "newest" | "name_asc" | "name_desc";
  lang?: string;
  countryCode?: string;
  ids?: string;
}

async function fetchProducts(params: ProductListParams = {}) {
  if (!HAS_LIVE_API) {
    const all = await loadStaticProducts();
    let filtered = params.category ? all.filter((p) => p.category.slug === params.category) : all;
    if (params.featured) filtered = filtered.filter((p) => p.isFeatured);
    const searched = params.search
      ? filtered.filter((p) => p.title.toLowerCase().includes(params.search!.toLowerCase()) || (p.productCode ?? "").toLowerCase().includes(params.search!.toLowerCase()))
      : filtered;
    const sorted = [...searched].sort((a, b) => {
      if (params.sort === "name_asc") return a.title.localeCompare(b.title);
      if (params.sort === "name_desc") return b.title.localeCompare(a.title);
      return 0;
    });
    const page = params.page ?? 1;
    const limit = params.limit ?? 20;
    const start = (page - 1) * limit;
    return { data: sorted.slice(start, start + limit), pagination: { page, limit, total: sorted.length, totalPages: Math.ceil(sorted.length / limit) } };
  }
  const res = await apiClient.get("/products", {
    params: {
      page: params.page,
      limit: params.limit,
      category: params.category,
      search: params.search,
      featured: params.featured ? "true" : undefined,
      attributeValues: params.attributeValues,
      sort: params.sort,
      lang: params.lang,
      countryCode: params.countryCode,
      ids: params.ids,
    },
  });
  return unwrapPaginated<ApiProductSummary>(res);
}

async function fetchProductFacets(lang?: string, countryCode?: string) {
  if (!HAS_LIVE_API) return [] as Array<{ attributeName: string; value: string }>;
  const res = await apiClient.get("/products/facets", { params: { lang, countryCode } });
  return unwrapData<Array<{ attributeName: string; value: string }>>(res);
}

async function fetchProductFiltersConfig(lang?: string, countryCode?: string) {
  if (!HAS_LIVE_API) return null;
  try {
    const res = await apiClient.get("/admin/product-filters/public", { params: { lang, countryCode } });
    return unwrapData<any>(res);
  } catch {
    return null;
  }
}

async function fetchProduct(slug: string, lang?: string, countryCode?: string): Promise<ApiProductDetail | null> {
  if (!HAS_LIVE_API) return loadStaticProduct(slug);
  const res = await apiClient.get(`/products/${slug}`, { params: { lang, countryCode } });
  return unwrapData<ApiProductDetail>(res);
}

async function fetchFeaturedProducts(lang?: string, countryCode?: string) {
  if (!HAS_LIVE_API) {
    const all = await loadStaticProducts();
    return all.filter((p) => p.isFeatured);
  }
  const res = await apiClient.get("/products", { params: { featured: "true", limit: 20, lang, countryCode } });
  return unwrapPaginated<ApiProductSummary>(res).data;
}

// ─── Hooks ────────────────────────────────────────────────

export function useProducts(params: ProductListParams = {}) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  const localizedParams = { ...params, lang: selectedLanguage, countryCode: selectedCountryCode };
  return useQuery({ queryKey: qk.products.list(localizedParams), queryFn: () => fetchProducts(localizedParams), staleTime: STALE.medium, placeholderData: keepPreviousData });
}

export function useInfiniteProducts(params: Omit<ProductListParams, "page"> = {}) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  const localizedParams = { ...params, lang: selectedLanguage, countryCode: selectedCountryCode };

  return useInfiniteQuery({
    queryKey: ["products", "infinite", localizedParams],
    queryFn: ({ pageParam = 1 }) => fetchProducts({ ...localizedParams, page: Number(pageParam) }),
    initialPageParam: 1,
    getNextPageParam: (lastPage) => {
      const { page, totalPages } = lastPage.pagination;
      return page < totalPages ? page + 1 : undefined;
    },
    staleTime: STALE.medium,
  });
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
  return useQuery({ queryKey: qk.products.featured(selectedLanguage, selectedCountryCode), queryFn: () => fetchFeaturedProducts(selectedLanguage, selectedCountryCode), staleTime: STALE.short });
}

export function useProductFacets() {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({
    queryKey: ["products", "facets", selectedLanguage, selectedCountryCode],
    queryFn: () => fetchProductFacets(selectedLanguage, selectedCountryCode),
    staleTime: STALE.long,
  });
}

export function useProductFiltersConfig() {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQuery({
    queryKey: ["products", "filters-config", selectedLanguage, selectedCountryCode],
    queryFn: () => fetchProductFiltersConfig(selectedLanguage, selectedCountryCode),
    staleTime: STALE.short,
  });
}

export function useRecentlySeenProducts(slugs: string[]) {
  const { selectedLanguage } = useLanguageContext();
  const { selectedCountryCode } = useCurrencyContext();
  return useQueries({
    queries: slugs.map((slug) => ({
      queryKey: qk.products.detail(slug, selectedLanguage, selectedCountryCode),
      queryFn: () => fetchProduct(slug, selectedLanguage, selectedCountryCode),
      enabled: Boolean(slug),
      staleTime: STALE.medium,
      retry: (failureCount: number, error: any) => {
        const status = error?.status ?? error?.response?.status;
        const msg = String(error?.message ?? "");
        if (status === 404 || msg.toLowerCase().includes("not found")) return false;
        return failureCount < 2;
      },
    })),
  });
}

export interface ProductWarehouse {
  id: string;
  name: string;
  countryId: string;
  countryName: string;
  stock: number;
  estimatedDeliveryDays: string;
  isLocal: boolean;
}

export async function fetchProductWarehouses(
  slug: string,
  variantId?: string,
  countryCode?: string,
  state?: string
): Promise<ProductWarehouse[]> {
  if (!HAS_LIVE_API || !countryCode) return [];
  const res = await apiClient.post(`/products/${slug}/warehouses`, {
    variantId,
    countryCode,
    state
  });
  return unwrapData<ProductWarehouse[]>(res);
}

export function useProductWarehouses(slug: string, variantId?: string, state?: string) {
  const { selectedCountryCode } = useCurrencyContext(); 
  
  return useQuery({
    queryKey: ["products", "warehouses", slug, variantId, selectedCountryCode, state],
    queryFn: () => fetchProductWarehouses(slug, variantId, selectedCountryCode, state),
    enabled: Boolean(slug && selectedCountryCode),
    staleTime: STALE.short,
  });
}

// ─── Product Reviews ──────────────────────────────────────

export interface ProductReviewItem {
  id: string;
  customerName?: string | null;
  customerEmail?: string | null;
  ratingQuality: number;
  ratingPrice: number;
  ratingOverall: number;
  feedbackText?: string | null;
  status: string;
  createdAt: string;
}

export interface ProductReviewsData {
  reviews: ProductReviewItem[];
  averageRating: number;
  totalRatings: number;
}

export interface SubmitProductReviewPayload {
  customerName?: string;
  customerEmail?: string;
  ratingQuality?: number;
  ratingPrice?: number;
  ratingOverall?: number;
  feedbackText?: string;
}

export async function fetchProductReviews(slug: string): Promise<ProductReviewsData> {
  const res = await apiClient.get(`/products/${encodeURIComponent(slug)}/reviews`);
  return unwrapData<ProductReviewsData>(res);
}

export async function submitProductReview(
  slug: string,
  payload: SubmitProductReviewPayload,
): Promise<{ review: ProductReviewItem; averageRating: number; totalRatings: number }> {
  const res = await apiClient.post(`/products/${encodeURIComponent(slug)}/reviews`, payload);
  return unwrapData<{ review: ProductReviewItem; averageRating: number; totalRatings: number }>(res);
}

