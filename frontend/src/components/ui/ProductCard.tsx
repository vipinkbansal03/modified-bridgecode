"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ImageOff } from "lucide-react";
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
          <Card className="h-full">
            <div className="relative h-[190px] w-full overflow-hidden bg-offwhite sm:h-[230px]">
              {imageSrc ? (
                imageSrc.startsWith("data:") ? (
                  <img src={imageSrc} alt={title} className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-110" />
                ) : (
                  <Image
                    src={imageSrc}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-300 ease-out group-hover:scale-110"
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
            <div className="p-4 sm:p-5">
              {category && <span className="text-xs uppercase tracking-wide text-steel-2">{category}</span>}
              <h5 className="mt-1.5 text-[15px] font-medium text-ink transition-colors duration-300 group-hover:text-brand">{title}</h5>
              {shortDescription && <p className="mt-1.5 text-sm text-steel">{shortDescription}</p>}
              {price ? (
                <div className="mt-2">
                  <p className="text-sm font-semibold text-ink">{price}</p>
                  <p className="mt-0.5 text-[11px] font-normal text-steel">{taxLabel}</p>
                </div>
              ) : (
                <span className="mt-2 inline-block rounded-pill border border-[#E5E7EB] bg-[#F3F4F6] px-2.5 py-0.5 text-xs font-semibold text-[#E31E24]">
                  Price Upon Request
                </span>
              )}
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
