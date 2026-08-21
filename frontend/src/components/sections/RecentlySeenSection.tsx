"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Container } from "@/components/ui/Container";
import { useRecentlySeenProducts } from "@/hooks/api/useProducts";
import { getRecentlySeenSlugs, recordProductView, removeRecentlySeenSlug } from "@/lib/recentlySeen";
import type { ApiProductDetail } from "@/types/api.types";

interface RecentlySeenSectionProps {
  currentSlug: string;
}

function getProductImage(product: ApiProductDetail) {
  if (product.thumbnail) return product.thumbnail;
  const first = product.images[0];
  return typeof first === "string" ? first : first?.url ?? null;
}

export function RecentlySeenSection({ currentSlug }: RecentlySeenSectionProps) {
  const queryClient = useQueryClient();
  const viewportRef = useRef<HTMLDivElement>(null);
  const [slugs, setSlugs] = useState<string[]>([]);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  useEffect(() => {
    setSlugs(getRecentlySeenSlugs(currentSlug));
    recordProductView(currentSlug);
  }, [currentSlug]);

  const queries = useRecentlySeenProducts(slugs);

  // Auto-prune any nonexistent (404) product slugs from localStorage, state, and query cache
  useEffect(() => {
    const invalidSlugs: string[] = [];
    queries.forEach((q, index) => {
      if (!q.isError) return;
      const err = q.error as any;
      const status = err?.status ?? err?.response?.status;
      const msg = String(err?.message ?? "");
      const is404 = status === 404 || msg.toLowerCase().includes("not found");

      if (is404 && slugs[index] && !invalidSlugs.includes(slugs[index])) {
        invalidSlugs.push(slugs[index]);
      }
    });

    if (invalidSlugs.length > 0) {
      invalidSlugs.forEach((slug) => {
        removeRecentlySeenSlug(slug);
        queryClient.removeQueries({ queryKey: ["products", "detail", slug], exact: false });
      });
      setSlugs((prev) => prev.filter((s) => !invalidSlugs.includes(s)));
    }
  }, [queries, slugs, queryClient]);

  const products = useMemo(
    () =>
      slugs
        .map((slug, index) => queries[index]?.data)
        .filter((product): product is ApiProductDetail => Boolean(product)),
    [slugs, queries],
  );

  if (!slugs.length || !products.length) return null;

  return (
    <section className="pb-15 pt-8">
      <Container>
        <div className="mb-6 flex items-end justify-between">
          <h3 className="text-[22px] font-light text-ink">Recently seen</h3>
          <div className="flex gap-2.5">
            <button aria-label="Previous" onClick={() => scrollBy(-220)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
              <ChevronLeft size={14} />
            </button>
            <button aria-label="Next" onClick={() => scrollBy(220)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
        <div ref={viewportRef} className="slider-viewport">
          <div className="flex gap-5.5">
            {products.map((p) => {
              const image = getProductImage(p);
              return (
                <Link key={p.slug} href={`/products/${p.slug}`} className="block w-[190px] flex-none snap-start text-ink">
                  <div className="relative mb-3 h-[150px] w-full bg-offwhite">
                    {image ? (
                      <Image src={image} alt={p.title} fill className="object-cover" sizes="190px" />
                    ) : (
                      <div className="flex h-full items-center justify-center px-3 text-center text-xs text-steel-2">No image</div>
                    )}
                  </div>
                  <h5 className="text-[13.5px] font-medium leading-snug">{p.title}</h5>
                </Link>
              );
            })}
          </div>
        </div>
      </Container>
    </section>
  );
}
