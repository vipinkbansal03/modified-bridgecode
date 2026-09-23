"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ImageOff } from "lucide-react";
import { Card } from "@/components/ui/Card";

export interface CategoryCardProps {
  title: string;
  image?: string | null;
  slug: string;
  description?: string;
  productCount?: number;
  /** Text shown for the active "doctor" / "dealer" view toggle on the Categories section. */
  meta?: string;
  ctaLabel?: string;
}

function stripHtml(html?: string | null): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, "").trim();
}

export function CategoryCard({ title, image, slug, description, productCount, meta, ctaLabel = "Buy Now" }: CategoryCardProps) {
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

  const cleanDescription =
    stripHtml(description) ||
    stripHtml(meta) ||
    "High-precision orthodontic appliances and components engineered for clinical efficacy.";

  return (
    <motion.div whileHover={{ y: -4 }} transition={{ duration: 0.2, ease: "easeOut" }} className="group h-full">
      <Link href={`/products?category=${slug}`} className="block h-full cursor-pointer">
        <div className="h-full flex flex-col justify-between rounded-2xl border border-gray-200/90 bg-white p-5 shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:border-gray-300 transition-all duration-300">
          <div className="flex flex-col flex-1">
            <div className="relative aspect-[4/3] w-full overflow-hidden rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center">
              {imageSrc ? (
                imageSrc.startsWith("data:") ? (
                  <img
                    src={imageSrc}
                    alt={title}
                    className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                  />
                ) : (
                  <Image
                    src={imageSrc}
                    alt={title}
                    fill
                    className="object-cover transition-transform duration-300 ease-out group-hover:scale-105"
                    sizes="(max-width: 768px) 100vw, 25vw"
                    onError={() => setImageError(true)}
                    unoptimized={imageSrc.startsWith("http://") || imageSrc.startsWith("https://")}
                  />
                )
              ) : (
                <div className="flex flex-col items-center justify-center gap-1.5 p-4 text-center text-steel-2">
                  <ImageOff size={26} className="text-steel-2/60" />
                  <span className="text-[11.5px] font-medium tracking-wider uppercase text-steel-2">No image</span>
                </div>
              )}
            </div>

            <h4
              className="mt-3.5 text-center text-[15px] sm:text-[16px] font-bold uppercase tracking-wide text-gray-900 group-hover:text-brand transition-colors duration-200 line-clamp-1"
              title={title}
            >
              {title}
            </h4>

            <p className="mt-2 text-center text-[12.5px] sm:text-[13px] leading-relaxed text-gray-600 line-clamp-2 flex-1">
              {cleanDescription}
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-line/60">
            <span className="inline-flex w-full items-center justify-center rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white shadow-xs transition-colors duration-200 group-hover:bg-[#C2181C]">
              {ctaLabel}
            </span>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

