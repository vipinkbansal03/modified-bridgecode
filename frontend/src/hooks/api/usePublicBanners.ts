"use client";

import { useQuery } from "@tanstack/react-query";
import { apiClient } from "@/lib/apiClient";
import { STALE } from "@/lib/queryConfig";
import { useCurrencyContext } from "@/contexts/CurrencyContext";

export type PublicBannerItem = {
  id: string;
  title: string;
  image: string;
  mobileImage?: string | null;
  linkUrl?: string | null;
  linkText?: string | null;
  placement: string;
  sortOrder: number;
};

export type BannerPlacementType =
  | "HOMEPAGE_HERO"
  | "HOMEPAGE_PROMO"
  | "CATEGORY_TOP"
  | "PRODUCT_TOP"
  | "SIDEBAR";

async function fetchPublicBanners(
  placement: BannerPlacementType,
  countryCode?: string,
): Promise<PublicBannerItem[]> {
  const params: Record<string, string> = { placement };
  if (countryCode) params.countryCode = countryCode;

  const response = await apiClient.get("/banners", { params });
  return (response.data.data ?? []) as PublicBannerItem[];
}

export function usePublicBanners(placement: BannerPlacementType, countryCodeOverride?: string) {
  const { selectedCountryCode } = useCurrencyContext();
  const countryCode = countryCodeOverride || selectedCountryCode || "IN";

  return useQuery({
    queryKey: ["publicBanners", placement, countryCode],
    queryFn: () => fetchPublicBanners(placement, countryCode),
    staleTime: STALE.short,
  });
}
