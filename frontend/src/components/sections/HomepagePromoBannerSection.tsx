"use client";

import { Container } from "@/components/ui/Container";
import { StorefrontBanner } from "@/components/ui/StorefrontBanner";
import { usePublicBanners } from "@/hooks/api/usePublicBanners";

export function HomepagePromoBannerSection() {
  const { data: banners = [], isLoading } = usePublicBanners("HOMEPAGE_PROMO");

  if (isLoading || banners.length === 0) {
    return null;
  }

  const promoBanner = banners[0];

  return (
    <section className="py-8 bg-white">
      <Container>
        <StorefrontBanner banner={promoBanner} variant="full" />
      </Container>
    </section>
  );
}
