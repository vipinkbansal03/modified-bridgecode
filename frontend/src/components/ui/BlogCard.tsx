"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Newspaper } from "lucide-react";
import { motion } from "framer-motion";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

export interface BlogCardProps {
  image?: string;
  title: string;
  excerpt: string;
  date: string;
  category?: string;
  slug: string;
  url: string;
  ctaLabel?: string;
  primary?: boolean;
}

export function BlogCard({ image, title, excerpt, date, url, ctaLabel = "Read more", primary }: BlogCardProps) {
  const { t } = useStaticTranslations();
  const [imageError, setImageError] = useState(false);
  const label = ctaLabel === "Read more" ? t("ui.blog.readMore") : ctaLabel;

  const hasImage = Boolean(image && image.trim() && !imageError);

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: "easeOut" }} className="flex min-h-[100%] w-[280px] flex-none snap-start flex-col">
      <div className="relative mb-4.5 h-[220px] w-full rounded bg-grey overflow-hidden flex items-center justify-center border border-line/60">
        {hasImage ? (
          <Image
            src={image!}
            alt={title}
            fill
            className="object-cover"
            sizes="280px"
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 p-4 text-center text-steel-2">
            <Newspaper size={32} className="text-[#E31E24]/60" />
            <span className="text-[11px] font-semibold tracking-wider uppercase">Modern Orthodontics</span>
          </div>
        )}
      </div>
      <span className="text-[13px] tracking-wide text-steel-2">{date}</span>
      <h3 className="my-2.5 text-lg font-medium leading-snug text-ink">{title}</h3>
      <p className="mb-4.5 flex-1 text-[14.5px] text-steel line-clamp-3">{excerpt}</p>
      <Link
        href={url}
        className={
          primary
            ? "inline-flex items-center gap-1.5 self-start rounded-pill border border-brand bg-brand px-4 py-2.5 text-[13.5px] font-medium text-white transition-opacity hover:opacity-90"
            : "inline-flex items-center gap-1.5 self-start rounded-pill border border-line px-4 py-2.5 text-[13.5px] font-medium text-ink transition-colors hover:border-[#E31E24] hover:text-[#E31E24]"
        }
      >
        {label} <ArrowRight size={13} />
      </Link>
    </motion.div>
  );
}

