"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
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
  const [productImageIndex, setProductImageIndex] = useState(0);

  const [imageError, setImageError] = useState(false);
  const [mobileImageError, setMobileImageError] = useState(false);

  const promoBanner = promoBanners[0];
  const hasDesktopPromo = Boolean(promoBanner?.image && promoBanner.image.trim() && !imageError);
  const hasMobilePromo = Boolean(
    promoBanner?.mobileImage && promoBanner.mobileImage.trim() && !mobileImageError,
  );

  const activeIndex = index >= featuredProducts.length || index < 0 ? 0 : index;
  const product = featuredProducts[activeIndex];

  // Reset product image carousel index when featured product switches
  useEffect(() => {
    setProductImageIndex(0);
  }, [activeIndex]);

  if (featuredLoading || promoLoading) {
    return (
      <section>
        <Skeleton className="h-[420px] w-full rounded-none" />
      </section>
    );
  }

  // Zero featured products exist -> Section does not render at all.
  if (!featuredProducts || featuredProducts.length === 0 || !product) {
    return null;
  }

  const go = (delta: number) =>
    setIndex((i) => (i + delta + featuredProducts.length) % featuredProducts.length);

  const productImages: string[] = Array.from(
    new Set(
      [
        ...(product.images || []),
        product.thumbnail,
        product.informationImage,
      ].filter((img): img is string => Boolean(img && img.trim()))
    )
  );

  const activeProductImage =
    productImages.length > 0 ? productImages[productImageIndex % productImages.length] : null;

  const nextProductImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (productImages.length > 1) {
      setProductImageIndex((prev) => (prev + 1) % productImages.length);
    }
  };

  const prevProductImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (productImages.length > 1) {
      setProductImageIndex((prev) => (prev - 1 + productImages.length) % productImages.length);
    }
  };

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
      <div className="bg-[#141414] py-8 sm:py-10 text-white border-t border-b border-neutral-800 min-h-[250px] flex items-center">
        <div className="mx-auto w-full max-w-[1480px] px-4 sm:px-6 md:px-8 lg:px-10">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-8 lg:gap-12">
            
            {/* Left Column: Product Information & Controls */}
            <div className="flex-1 max-w-2xl space-y-3">
              <div className="flex items-center gap-2.5">
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-red-600/20 text-[#E31E24] border border-red-500/30">
                  {t("ui.home.featuredProduct")}
                </span>
                {product.category?.name && (
                  <span className="text-[12px] font-medium text-neutral-400">
                    {product.category.name}
                  </span>
                )}
              </div>

              <h3 className="text-[22px] sm:text-[25px] lg:text-[28px] font-normal text-white leading-snug tracking-tight">
                {product.title}
              </h3>

              <p className="max-w-[620px] text-[13px] sm:text-[13.5px] text-neutral-300 leading-relaxed line-clamp-2">
                {product.shortDescription || captions[product.slug] || "Precision-engineered orthodontic appliances crafted for orthodontic professionals worldwide."}
              </p>

              <div className="pt-2 flex flex-wrap items-center gap-4">
                <Link
                  href={`/products/${product.slug}`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs cursor-pointer"
                >
                  <span>View Product Details</span>
                  <ChevronRight size={14} />
                </Link>

                {featuredProducts.length > 1 && (
                  <div className="flex items-center gap-2.5 border-l border-neutral-700 pl-3.5">
                    <button
                      type="button"
                      aria-label={t("ui.home.previousProduct")}
                      onClick={() => go(-1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer"
                      title="Previous Featured Product"
                    >
                      <ChevronLeft size={15} />
                    </button>
                    <span className="text-[12px] text-neutral-400 font-mono px-0.5">
                      {activeIndex + 1} / {featuredProducts.length}
                    </span>
                    <button
                      type="button"
                      aria-label={t("ui.home.nextProduct")}
                      onClick={() => go(1)}
                      className="flex h-8 w-8 items-center justify-center rounded-full border border-neutral-600 text-neutral-300 hover:text-white hover:border-white transition-colors cursor-pointer"
                      title="Next Featured Product"
                    >
                      <ChevronRight size={15} />
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Right Column: Product Image Showcase / Carousel (Locked Fixed Height) */}
            <div className="w-full lg:w-auto shrink-0 flex justify-center lg:justify-end">
              <div className="relative group h-[230px] w-full sm:w-[380px] lg:w-[400px] rounded-xl border border-neutral-800 bg-neutral-900/90 p-2.5 overflow-hidden shadow-lg flex flex-col justify-between">
                {activeProductImage ? (
                  <>
                    <Link
                      href={`/products/${product.slug}`}
                      className={`relative block w-full overflow-hidden rounded-lg bg-white p-2 cursor-pointer ${
                        productImages.length > 1 ? "h-[162px]" : "h-full"
                      }`}
                    >
                      <Image
                        src={activeProductImage}
                        alt={product.title}
                        fill
                        sizes="(min-width: 1024px) 400px, 100vw"
                        className="object-contain transition-transform duration-300 group-hover:scale-105"
                      />

                      {/* Multiple Images Next/Prev Overlays */}
                      {productImages.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={prevProductImage}
                            className="absolute left-2 top-1/2 -translate-y-1/2 flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 hover:bg-black/90 transition-all cursor-pointer z-10"
                            aria-label="Previous image"
                            title="Previous image"
                          >
                            <ChevronLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={nextProductImage}
                            className="absolute right-2 top-1/2 -translate-y-1/2 flex h-6.5 w-6.5 items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-xs opacity-0 group-hover:opacity-100 hover:bg-black/90 transition-all cursor-pointer z-10"
                            aria-label="Next image"
                            title="Next image"
                          >
                            <ChevronRight size={13} />
                          </button>
                        </>
                      )}
                    </Link>

                    {/* Image Thumbnails Strip (Fixed height reserved when multiple images) */}
                    {productImages.length > 1 && (
                      <div className="h-[36px] flex items-center justify-center gap-1.5 overflow-x-auto pt-1">
                        {productImages.map((img, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => setProductImageIndex(i)}
                            className={`relative h-8 w-8 rounded-md border overflow-hidden bg-white p-0.5 transition-all cursor-pointer shrink-0 ${
                              i === (productImageIndex % productImages.length)
                                ? "border-[#E31E24] ring-2 ring-[#E31E24]/30 scale-105"
                                : "border-neutral-700 opacity-60 hover:opacity-100"
                            }`}
                          >
                            <Image src={img} alt="" fill sizes="32px" className="object-contain" />
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="h-full w-full flex flex-col items-center justify-center rounded-lg bg-neutral-800/80 p-6 text-center text-neutral-400">
                    <span className="text-xs font-medium">{product.title}</span>
                    <span className="mt-1 text-[11px] text-neutral-500">No preview image available</span>
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </section>
  );
}
