"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProducts } from "@/hooks/api/useProducts";
import { useFeaturedProducts } from "@/hooks/api/useProducts";
import { usePublicBanners } from "@/hooks/api/usePublicBanners";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import staticProducts from "@/data/products.json";
import type { ApiProductSummary } from "@/types/api.types";

interface FeaturedProductsSectionProps {
  slugs: string[];
  captions: Record<string, string>;
}

const FEATURED_STOCK_IMAGES: Record<string, string> = {
  "sapphire-true-twin":
    "https://images.unsplash.com/photo-1728102197400-0648e058fddd?fm=jpg&q=80&w=1400&auto=format&fit=crop",
  "niti-super-elastic":
    "https://images.unsplash.com/photo-1759846865520-7ebe2baaa759?fm=jpg&q=80&w=1400&auto=format&fit=crop",
  "curio-mono-crystalline-ceramic":
    "https://images.unsplash.com/photo-1643216790495-ed36d21b05c0?fm=jpg&q=80&w=1400&auto=format&fit=crop",
};

export function FeaturedProductsSection({
  slugs,
  captions,
}: FeaturedProductsSectionProps) {
  const { t } = useStaticTranslations();
  const { data: promoBanners = [], isLoading: promoLoading } = usePublicBanners("HOMEPAGE_PROMO");
  const { data: featuredProducts = [], isLoading: featuredLoading } = useFeaturedProducts();
  const { data: allProducts, isLoading: allProductsLoading } = useProducts({ limit: 12 });
  const [index, setIndex] = useState(0);

  const [imageError, setImageError] = useState(false);
  const [mobileImageError, setMobileImageError] = useState(false);

  const promoBanner = promoBanners[0];
  const hasDesktopPromo = Boolean(promoBanner?.image && promoBanner.image.trim() && !imageError);
  const hasMobilePromo = Boolean(
    promoBanner?.mobileImage && promoBanner.mobileImage.trim() && !mobileImageError,
  );

  const products = useMemo(() => {
    if (featuredProducts.length) return featuredProducts;

    const liveProducts = allProducts?.data ?? [];
    const liveMatches = slugs
      .map((slug) => liveProducts.find((p) => p.slug === slug))
      .filter(Boolean) as ApiProductSummary[];

    if (liveMatches.length) return liveMatches;
    if (liveProducts.length) return liveProducts.slice(0, Math.max(slugs.length, 3));

    return slugs
      .map((slug) => {
        const fallback = (staticProducts as Record<string, unknown>[]).find(
          (p) => p.slug === slug,
        );
        if (!fallback) return null;

        return {
          id: fallback.slug as string,
          slug: fallback.slug as string,
          title: fallback.title as string,
          productCode: (fallback.productCode as string) ?? null,
          brand: "Modern Orthodontics",
          shortDescription: (fallback.shortDescription as string) ?? null,
          category: {
            name: (fallback.category as string) ?? "",
            slug: (fallback.categorySlug as string) ?? "",
          },
          images: (fallback.images as string[]) ?? [],
          thumbnail: ((fallback.images as string[]) ?? [])[0] ?? null,
          isFeatured: true,
          hasVariants: false,
          variantCount: 0,
          prices: [],
        };
      })
      .filter(Boolean) as ApiProductSummary[];
  }, [allProducts, slugs]);

  if (featuredLoading || allProductsLoading || promoLoading) {
    return (
      <section>
        <Skeleton className="h-[420px] w-full rounded-none" />
      </section>
    );
  }

  if (!products.length) return null;
  const product = products[index];
  const productImage = product.thumbnail?.trim() || product.images.find((image) => image?.trim()) || "";
  const imageUrl = FEATURED_STOCK_IMAGES[product.slug] ?? productImage;
  const go = (delta: number) =>
    setIndex((i) => (i + delta + products.length) % products.length);

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
              {product.shortDescription || captions[product.slug]}
            </p>
          </div>
          <div className="flex flex-none gap-2.5">
            <button
              aria-label={t("ui.home.previousProduct")}
              onClick={() => go(-1)}
              className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              aria-label={t("ui.home.nextProduct")}
              onClick={() => go(1)}
              className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        </Container>
      </div>
    </section>
  );
}
