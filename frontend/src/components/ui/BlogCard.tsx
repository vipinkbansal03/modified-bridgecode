"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Newspaper, Calendar } from "lucide-react";
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

export function BlogCard({ image, title, excerpt, date, category, url, ctaLabel = "Read article" }: BlogCardProps) {
  const { t } = useStaticTranslations();
  const [imageError, setImageError] = useState(false);
  const label = ctaLabel === "Read more" ? t("ui.blog.readMore") : ctaLabel;

  const hasImage = Boolean(image && image.trim() && !imageError);

  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="group flex h-full w-full flex-col overflow-hidden rounded-xl sm:rounded-2xl border border-gray-200 bg-white shadow-[0_2px_12px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.07)] hover:border-gray-300 transition-all duration-300"
    >
      <Link href={url} className="relative block h-48 sm:h-52 w-full bg-gray-50 overflow-hidden shrink-0 border-b border-gray-100">
        {hasImage ? (
          <Image
            src={image!}
            alt={title}
            fill
            className="object-cover group-hover:scale-105 transition-transform duration-500"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            onError={() => setImageError(true)}
            unoptimized={image?.startsWith("http://") || image?.startsWith("https://")}
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 p-4 text-center text-gray-400 bg-gray-50">
            <Newspaper size={36} className="text-[#E31E24]/60" />
            <span className="text-[11px] font-semibold tracking-wider uppercase text-gray-500">Modern Orthodontics</span>
          </div>
        )}
        {category && (
          <span className="absolute top-3 left-3 rounded-full bg-white/95 backdrop-blur-xs px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-[#E31E24] shadow-2xs border border-gray-100">
            {category}
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col justify-between p-5 sm:p-6">
        <div>
          {date && (
            <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500">
              <Calendar size={13} className="text-gray-400 shrink-0" />
              <span>{date}</span>
            </div>
          )}
          <Link href={url}>
            <h3 className="mt-2 text-[16px] sm:text-[17px] font-bold leading-snug text-gray-900 line-clamp-2 group-hover:text-[#E31E24] transition-colors">
              {title}
            </h3>
          </Link>
          <p className="mt-2 text-[13px] sm:text-[13.5px] leading-relaxed text-gray-600 line-clamp-3">
            {excerpt}
          </p>
        </div>

        <div className="pt-4 mt-auto">
          <Link
            href={url}
            className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#E31E24] group-hover:text-[#B5151B] transition-colors"
          >
            <span>{label}</span>
            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </motion.div>
  );
}

