"use client";

import { useRef } from "react";
import Image from "next/image";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import type { ProductDetail } from "@/types/product.types";

interface RecentlySeenSectionProps {
  products: ProductDetail[];
}

export function RecentlySeenSection({ products }: RecentlySeenSectionProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  if (!products.length) return null;

  return (
    <section className="py-15 sm:py-17.5">
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
            {products.map((p) => (
              <Link key={p.slug} href={`/products/${p.slug}`} className="block w-[190px] flex-none snap-start text-ink">
                <div className="relative mb-3 h-[150px] w-full bg-offwhite">
                  <Image src={p.images[0]} alt={p.title} fill className="object-cover" sizes="190px" />
                </div>
                <h5 className="text-[13.5px] font-medium leading-snug">{p.title}</h5>
              </Link>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
