"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { cn } from "@/utils/cn";

interface ProductGalleryProps {
  images: string[];
  title: string;
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const safeImages = images.map((image) => image.trim()).filter(Boolean);
  const [index, setIndex] = useState(0);
  const go = (delta: number) => {
    if (!safeImages.length) return;
    setIndex((i) => (i + delta + safeImages.length) % safeImages.length);
  };

  if (!safeImages.length) {
    return (
      <div className="flex min-h-[260px] items-center justify-center rounded-lg border border-dashed border-line bg-offwhite px-5 text-center text-sm text-steel-2 sm:min-h-[360px] lg:min-h-[440px]">
        <div>
          <ImageOff size={28} className="mx-auto mb-2 text-steel-2" />
          <p className="font-medium text-steel">No product image uploaded</p>
          <p className="mt-1 text-[12px] text-steel-2">Images added from admin media will appear here.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5 sm:flex-row sm:gap-4.5">
      <div className="custom-scrollbar-x order-2 flex gap-2.5 overflow-x-auto pb-3 sm:order-1 sm:flex-col sm:gap-3.5 sm:overflow-visible sm:pb-0">
        {safeImages.map((img, i) => (
          <button
            key={img}
            onClick={() => setIndex(i)}
            className={cn(
              "flex h-[78px] w-[78px] flex-none items-center justify-center overflow-hidden border bg-offwhite",
              index === i ? "border-brand" : "border-line"
            )}
          >
            <Image src={img} alt={`${title} thumbnail ${i + 1}`} width={78} height={78} className="h-full w-full object-cover" />
          </button>
        ))}
      </div>

      <div className="relative order-1 flex min-h-[280px] flex-1 items-center justify-center overflow-hidden rounded-lg bg-offwhite sm:order-2 sm:min-h-[360px] lg:min-h-[440px]">
        <button
          aria-label="Previous"
          onClick={() => go(-1)}
          className="absolute left-3.5 top-1/2 z-10 flex h-9.5 w-9.5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="relative h-[260px] w-[84%] sm:h-[340px] lg:h-[400px] lg:w-[78%]">
          <Image src={safeImages[index]} alt={title} fill className="object-contain" sizes="500px" />
        </div>
        <button
          aria-label="Next"
          onClick={() => go(1)}
          className="absolute right-3.5 top-1/2 z-10 flex h-9.5 w-9.5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}
