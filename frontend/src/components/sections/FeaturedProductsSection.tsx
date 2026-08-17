"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { useFeaturedProducts } from "@/hooks/api/useProducts";
import { usePublicBanners } from "@/hooks/api/usePublicBanners";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

interface FeaturedProductsSectionProps {
  slugs?: string[];
  captions?: Record<string, string>;
}

export function FeaturedProductsSection({
  captions = {},
}: FeaturedProductsSectionProps) {
  const { t } = useStaticTranslations();
  const { data: promoBanners = [], isLoading: promoLoading } = usePublicBanners("HOMEPAGE_PROMO");
  const { data: featuredProducts = [], isLoading: featuredLoading } = useFeaturedProducts();
  const [index, setIndex] = useState(0);

  const [imageError, setImageError] = useState(false);
  const [mobileImageError, setMobileImageError] = useState(false);

  const promoBanner = promoBanners[0];
  const hasDesktopPromo = Boolean(promoBanner?.image && promoBanner.image.trim() && !imageError);
  const hasMobilePromo = Boolean(
    promoBanner?.mobileImage && promoBanner.mobileImage.trim() && !mobileImageError,
  );

  if (featuredLoading || promoLoading) {
    return (
      <section>
        <Skeleton className="h-[420px] w-full rounded-none" />
      </section>
    );
  }

  // Case 2: Zero featured products exist -> Section does not render at all.
  if (!featuredProducts || featuredProducts.length === 0) {
    return null;
  }

  const activeIndex = index >= featuredProducts.length || index < 0 ? 0 : index;
  const product = featuredProducts[activeIndex];
  const go = (delta: number) =>
    setIndex((i) => (i + delta + featuredProducts.length) % featuredProducts.length);

  const renderPromoImage = () => {
    if (!promoBanner) return null;

    const imgContent = (
      <>
        {hasMobilePromo && (
          <Image
            src={promoBanner.mobileImage!}
            alt={promoBanner.title || "Promotional Banner"}
            fill
            className="object-cover sm:hidden"
            sizes="100vw"
            onError={() => setMobileImageError(true)}
          />
        )}
        {hasDesktopPromo ? (
          <Image
            src={promoBanner.image}
            alt={promoBanner.title || "Promotional Banner"}
            fill
            className={`object-cover ${hasMobilePromo ? "hidden sm:block" : "block"}`}
            sizes="100vw"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-grey text-steel-2 p-6 text-center">
            <span className="text-[12px] font-semibold uppercase tracking-wider">
              {promoBanner.title || "Modern Orthodontics Promotion"}
            </span>
          </div>
        )}
      </>
    );

    if (promoBanner.linkUrl) {
      return (
        <Link href={promoBanner.linkUrl} className="absolute inset-0 block cursor-pointer">
          {imgContent}
        </Link>
      );
    }

    return imgContent;
  };

  return (
    <section className="relative">
      {promoBanner && (
        <div className="relative h-[220px] w-full bg-grey sm:h-[260px] md:h-[300px]">
          {renderPromoImage()}
        </div>
      )}
      <div className="bg-ink py-7 lg:py-[34px] text-white">
        <Container className="flex flex-wrap items-end justify-between gap-7">
          <div>
            <span className="mb-2.5 block text-[13px] font-medium tracking-[0.03em] text-[#9A9A9A]">
              {t("ui.home.featuredProduct")}
            </span>
            <h3 className="max-w-[600px] text-[clamp(26px,3.2vw,36px)] font-light text-white leading-[1.2]">
              {product.title}
            </h3>
            <p className="mt-3.5 max-w-[520px] text-[15px] text-[#B9B9B9]">
              {product.shortDescription || captions[product.slug] || ""}
            </p>
          </div>
          {featuredProducts.length > 1 && (
            <div className="flex flex-none gap-2.5">
              <button
                aria-label={t("ui.home.previousProduct")}
                onClick={() => go(-1)}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <button
                aria-label={t("ui.home.nextProduct")}
                onClick={() => go(1)}
                className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </Container>
      </div>
    </section>
  );
}
