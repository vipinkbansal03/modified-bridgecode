"use client";

import { StorefrontBanner } from "@/components/ui/StorefrontBanner";
import { usePublicBanners } from "@/hooks/api/usePublicBanners";

export function ProductTopBannerSection() {
  const { data: banners = [], isLoading } = usePublicBanners("PRODUCT_TOP");

  if (isLoading || banners.length === 0) {
    return null;
  }

  return (
    <div className="mb-6">
      <StorefrontBanner banner={banners[0]} />
    </div>
  );
}
