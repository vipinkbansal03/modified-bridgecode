"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProducts } from "@/hooks/api/useProducts";
import staticProducts from "@/data/products.json";

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
  const { data: allProducts, isLoading } = useProducts({ limit: 200 });
  const [index, setIndex] = useState(0);

  const products = useMemo(() => {
    const liveProducts = allProducts?.data ?? [];
    return slugs
      .map((slug) => {
        const live = liveProducts.find((p) => p.slug === slug);
        if (live) return live;

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
      .filter(Boolean) as NonNullable<(typeof allProducts.data)[number]>[];
  }, [allProducts, slugs]);

  if (isLoading) {
    return (
      <section>
        <Skeleton className="h-[420px] w-full rounded-none" />
      </section>
    );
  }

  if (!products.length) return null;
  const product = products[index];
  const imageUrl =
    FEATURED_STOCK_IMAGES[product.slug] ?? product.images[0] ?? "";
  const go = (delta: number) =>
    setIndex((i) => (i + delta + products.length) % products.length);

  return (
    <section className="relative">
      <div className="relative h-[calc(100vh-80px-300px)] md:h-[calc(100vh-131.6px-241.5px)] w-full bg-grey">
        <AnimatePresence mode="wait">
          <motion.div
            key={product.slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            {imageUrl ? (
              <Image
                src={imageUrl}
                alt={product.title}
                fill
                className="object-cover"
                sizes="100vw"
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="bg-ink py-13.5 sm:py-16 text-white">
        <Container className="flex flex-wrap items-end justify-between gap-7">
          <div>
            <span className="mb-2.5 block text-[13px] font-medium tracking-[0.03em] text-[#9A9A9A]">
              Featured Product
            </span>
            <h3 className="max-w-[600px] text-[clamp(26px,3.2vw,36px)] font-light leading-tight text-white">
              {product.title}
            </h3>
            <p className="mt-3.5 max-w-[520px] text-[15px] text-[#B9B9B9]">
              {captions[product.slug] ?? product.shortDescription}
            </p>
          </div>
          <div className="flex flex-none gap-2.5">
            <button
              aria-label="Previous product"
              onClick={() => go(-1)}
              className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white"
            >
              <ChevronLeft size={14} />
            </button>
            <button
              aria-label="Next product"
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
