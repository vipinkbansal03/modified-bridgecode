"use client";

import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

export interface BlogCardProps {
  image: string;
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
  const label = ctaLabel === "Read more" ? t("ui.blog.readMore") : ctaLabel;

  return (
    <motion.div whileHover={{ y: -3 }} transition={{ duration: 0.2, ease: "easeOut" }} className="flex min-h-[100%] w-[280px] flex-none snap-start flex-col">
      <div className="relative mb-4.5 h-[220px] w-full rounded bg-grey overflow-hidden">
        <Image src={image} alt={title} fill className="object-cover" sizes="280px" />
      </div>
      <span className="text-[13px] tracking-wide text-steel-2">{date}</span>
      <h3 className="my-2.5 text-lg font-medium leading-snug text-ink">{title}</h3>
      <p className="mb-4.5 flex-1 text-[14.5px] text-steel">{excerpt}</p>
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className={
          primary
            ? "inline-flex items-center gap-1.5 self-start rounded-pill border border-brand bg-brand px-4 py-2.5 text-[13.5px] font-medium text-white"
            : "inline-flex items-center gap-1.5 self-start rounded-pill border border-line px-4 py-2.5 text-[13.5px] font-medium text-ink"
        }
      >
        {label} <ArrowRight size={13} />
      </a>
    </motion.div>
  );
}
