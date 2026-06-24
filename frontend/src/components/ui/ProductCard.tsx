"use client";

import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";

export interface ProductCardProps {
  image?: string | null;
  title: string;
  slug: string;
  category?: string;
  shortDescription?: string;
  price?: string;
  badge?: string;
  ctaLabel?: string;
}

export function ProductCard({ image, title, slug, category, shortDescription, price, badge }: ProductCardProps) {
  const imageSrc = image?.trim() || null;

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }}>
      <Link href={`/products/${slug}`} className="block">
        <Card className="h-full">
          <div className="relative h-[230px] w-full bg-offwhite">
            {imageSrc ? (
              <Image src={imageSrc} alt={title} fill className="object-cover" sizes="(max-width: 768px) 100vw, 33vw" />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-steel-2">No image</div>
            )}
            {badge && (
              <span className="absolute top-3 left-3">
                <Badge tone="brand">{badge}</Badge>
              </span>
            )}
          </div>
          <div className="p-5">
            {category && <span className="text-xs uppercase tracking-wide text-steel-2">{category}</span>}
            <h5 className="mt-1.5 text-[15px] font-medium text-ink">{title}</h5>
            {shortDescription && <p className="mt-1.5 text-sm text-steel">{shortDescription}</p>}
            {price && <p className="mt-2 text-sm font-semibold text-ink">{price}</p>}
          </div>
        </Card>
      </Link>
    </motion.div>
  );
}
