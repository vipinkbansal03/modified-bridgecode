"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageOff } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { Button } from "@/components/ui/Button";
import type { ProductDetail } from "@/types/product.types";

interface BundleSectionProps {
  product: ProductDetail;
}

export function BundleSection({ product }: BundleSectionProps) {
  if (!product.bundle.length) return null;

  const items = [{ slug: product.slug, title: product.title, image: product.images[0] }, ...product.bundle];

  return (
    <section className="py-16 sm:py-18">
      <Container>
        <h3 className="mb-6 text-xl font-light text-ink">Frequently purchased together</h3>
        <div className="grid grid-cols-1 items-center gap-6 rounded-lg border border-line bg-white p-6 sm:grid-cols-[1.3fr_0.7fr]">
          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-3">
            {items.map((item) => (
              <Link key={item.slug} href={`/products/${item.slug}`} className="min-h-[145px] rounded-md border border-line bg-offwhite p-3.5 transition hover:border-steel-2">
                <div className="relative mb-2.5 h-[78px] w-full overflow-hidden rounded bg-grey flex items-center justify-center">
                  {item.image && typeof item.image === "string" && item.image.trim() !== "" ? (
                    <Image src={item.image} alt={item.title} fill className="object-cover" sizes="200px" />
                  ) : (
                    <ImageOff size={20} className="text-steel-2/60" />
                  )}
                </div>
                <h5 className="text-[13.5px] font-medium leading-snug text-ink">{item.title}</h5>
              </Link>
            ))}
          </div>
          <div className="text-left sm:text-right">
            <p className="mb-2 text-[13.5px] text-steel">Recommended clinic starter combination</p>
            <strong className="mb-4 block text-[22px] font-light text-ink">Build your quote faster</strong>
            <Button href={`/contact?subject=${encodeURIComponent(`Bundle Quote Request - ${product.title}`)}`} variant="primary">
              Request Bundle Quote <ArrowRight size={14} className="ml-1.5 inline" />
            </Button>
          </div>
        </div>
      </Container>
    </section>
  );
}
