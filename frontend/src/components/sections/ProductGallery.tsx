"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/utils/cn";

interface ProductGalleryProps {
  images: string[];
  title: string;
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const safeImages = useMemo(() => {
    if (!images || !Array.isArray(images) || images.length === 0) return [];
    return images
      .filter(Boolean)
      .map((img) => img.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):4000(\/uploads\/)/i, "$1"));
  }, [images]);

  const [index, setIndex] = useState(0);

  const go = (delta: number) => {
    if (!safeImages.length) return;
    setIndex((i) => (i + delta + safeImages.length) % safeImages.length);
  };

  if (!safeImages.length) {
    return (
      <div className="flex min-h-[260px] flex-col items-center justify-center rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-5 text-center text-[#9CA3AF] sm:min-h-[360px] lg:min-h-[440px]">
        <ImageOff size={28} className="mx-auto mb-2 text-[#9CA3AF]" />
        <p className="font-medium text-[#374151]">No product image uploaded</p>
        <p className="mt-1 text-[12px] text-[#9CA3AF]">Images added from admin media will appear here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:gap-4.5">
      {/* Thumbnail Strip (Vertical on Desktop, Horizontal on Mobile) */}
      <div className="custom-scrollbar-x order-2 flex gap-2.5 overflow-x-auto pb-2 sm:order-1 sm:flex-col sm:gap-3.5 sm:overflow-visible sm:pb-0">
        {safeImages.map((img: string, i: number) => (
          <button
            key={img}
            type="button"
            onClick={() => setIndex(i)}
            className={cn(
              "relative flex h-[72px] w-[72px] flex-none items-center justify-center overflow-hidden rounded-md border bg-[#FAFAFA] p-1 transition-all",
              index === i ? "border-[#E31E24] shadow-2xs scale-105" : "border-[#E5E7EB] opacity-75 hover:opacity-100"
            )}
          >
            {img.startsWith("data:") ? (
              <img src={img} alt={`${title} thumbnail ${i + 1}`} className="h-full w-full object-contain p-0.5" />
            ) : (
              <Image src={img} alt={`${title} thumbnail ${i + 1}`} fill sizes="72px" className="object-contain p-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* Main Image Box */}
      <div className="relative order-1 flex min-h-[280px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:order-2 sm:min-h-[360px] lg:min-h-[440px]">
        {/* Previous Arrow */}
        {safeImages.length > 1 && (
          <button
            aria-label="Previous image"
            type="button"
            onClick={() => go(-1)}
            className="absolute left-3.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1A1A1A] shadow-2xs transition-all hover:bg-white hover:scale-105"
          >
            <ChevronLeft size={16} />
          </button>
        )}

        {/* Main Image Preview */}
        <div className="relative h-[260px] w-[84%] sm:h-[340px] lg:h-[400px] lg:w-[80%]">
          {safeImages[index]?.startsWith("data:") ? (
            <img src={safeImages[index]} alt={title} className="h-full w-full object-contain transition-all duration-300" />
          ) : (
            <Image
              src={safeImages[index]}
              alt={title}
              fill
              sizes="(max-width: 768px) 84vw, 500px"
              className="object-contain transition-all duration-300"
              priority
            />
          )}
        </div>

        {/* Next Arrow */}
        {safeImages.length > 1 && (
          <button
            aria-label="Next image"
            type="button"
            onClick={() => go(1)}
            className="absolute right-3.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1A1A1A] shadow-2xs transition-all hover:bg-white hover:scale-105"
          >
            <ChevronRight size={16} />
          </button>
        )}
      </div>
    </div>
  );
}
