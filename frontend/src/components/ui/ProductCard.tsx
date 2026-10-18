"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, ImageOff } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

import { WishlistButton } from "@/components/product/WishlistButton";

export interface ProductCardProps {
  id?: string;
  image?: string | null;
  title: string;
  slug: string;
  category?: string;
  shortDescription?: string;
  price?: string;
  taxLabel?: string;
  badge?: string;
  ctaLabel?: string;
  actionSlot?: React.ReactNode;
}

export function ProductCard({ id, image, title, slug, category, shortDescription, price, taxLabel = "Inclusive of all taxes", badge, ctaLabel, actionSlot }: ProductCardProps) {
  const [imageError, setImageError] = useState(false);
  const rawImage = image?.trim() || null;
  let imageSrc: string | null = null;
  if (rawImage && !imageError) {
    if (rawImage.startsWith("data:")) {
      imageSrc = rawImage;
    } else {
      let trimmed = rawImage.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):4000(\/uploads\/)/i, "$1");
      if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
        imageSrc = trimmed;
      } else {
        imageSrc = `/${trimmed}`;
      }
    }
  }

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }} className="group">
      <div className="relative h-full">
        <Link href={`/products/${slug}`} className="block h-full">
          <Card className="clinical-product-card h-full flex flex-col">
            <div className="clinical-product-image relative h-[210px] w-full overflow-hidden sm:h-[248px]">
              {imageSrc ? (
                imageSrc.startsWith("data:") ? (
                  <img src={imageSrc} alt={title} className="h-full w-full object-contain p-6 transition-transform duration-300 ease-out group-hover:scale-[1.04]" />
                ) : (
                  <Image
                    src={imageSrc}
                    alt={title}
                    fill
                    className="object-contain p-6 transition-transform duration-300 ease-out group-hover:scale-[1.04]"
                    sizes="(max-width: 768px) 100vw, 33vw"
                    onError={() => setImageError(true)}
                    unoptimized={imageSrc.startsWith("http://") || imageSrc.startsWith("https://")}
                  />
                )
              ) : (
                <div className="flex h-full items-center justify-center px-4 text-center text-sm text-steel-2">
                  <div>
                    <ImageOff size={24} className="mx-auto mb-2 text-steel-2" />
                    <span>No image uploaded</span>
                  </div>
                </div>
              )}
              {badge && (
                <span className="absolute top-3 left-3">
                  <Badge tone="brand">{badge}</Badge>
                </span>
              )}
            </div>
            <div className="p-4 sm:p-5 flex flex-col justify-between flex-1">
              <div>
                {category && <span className="clinical-eyebrow">{category}</span>}
                <h5 className="mt-2 text-[16px] font-bold leading-snug text-ink transition-colors duration-300 group-hover:text-[var(--color-primary)]">{title}</h5>
                {shortDescription && <p className="mt-2 line-clamp-2 text-[13px] leading-relaxed text-steel">{shortDescription}</p>}
                {price ? (
                  <div className="mt-3 flex items-end justify-between gap-3">
                    <div>
                      <p className="text-[17px] font-extrabold text-ink">{price}</p>
                      <p className="mt-0.5 text-[11px] font-medium text-steel">{taxLabel}</p>
                    </div>
                    <span className="clinical-spec-chip rounded-md px-2 py-1 text-[10px] font-bold uppercase tracking-wide">Clinical supply</span>
                  </div>
                ) : (
                  <span className="clinical-spec-chip mt-3 inline-block rounded-md px-2.5 py-1 text-xs font-semibold">
                    Price Upon Request
                  </span>
                )}
              </div>
              <div className="mt-5 pt-4 border-t border-line/60">
                <span className="clinical-cta inline-flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[13px] font-bold shadow-sm transition-colors duration-200">
                  {ctaLabel || "View clinical options"}
                  <ArrowRight size={15} aria-hidden="true" />
                </span>
              </div>
            </div>
          </Card>
        </Link>
        {actionSlot ? (
          <div className="absolute top-3 right-3 z-10">{actionSlot}</div>
        ) : id ? (
          <div className="absolute top-3 right-3 z-10">
            <WishlistButton productId={id} />
          </div>
        ) : null}
      </div>
    </motion.div>
  );
}
