"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Skeleton } from "@/components/ui/Skeleton";
import { useProducts } from "@/hooks/api/useProducts";

interface FeaturedProductsSectionProps {
  slugs: string[];
  captions: Record<string, string>;
}

export function FeaturedProductsSection({ slugs, captions }: FeaturedProductsSectionProps) {
  const { data: allProducts, isLoading } = useProducts();
  const [index, setIndex] = useState(0);

  const products = useMemo(() => {
    if (!allProducts?.data) return [];
    return slugs.map((slug) => allProducts.data.find((p) => p.slug === slug)).filter(Boolean) as NonNullable<(typeof allProducts.data)[number]>[];
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
  const go = (delta: number) => setIndex((i) => (i + delta + products.length) % products.length);

  return (
    <section className="relative">
      <div className="relative h-[420px] w-full bg-grey">
        <AnimatePresence mode="wait">
          <motion.div
            key={product.slug}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="absolute inset-0"
          >
            <Image src={product.images[0] ?? ""} alt={product.title} fill className="object-cover" sizes="100vw" />
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="bg-ink py-13.5 text-white">
        <Container className="flex flex-wrap items-end justify-between gap-7">
          <div>
            <h3 className="max-w-[600px] text-[clamp(26px,3.2vw,36px)] font-light leading-tight text-white">
              {product.title}
            </h3>
            <p className="mt-3.5 max-w-[520px] text-[15px] text-[#B9B9B9]">{captions[product.slug] ?? product.shortDescription}</p>
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
