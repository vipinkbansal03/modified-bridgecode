"use client";

import { useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/utils/cn";

interface ProductGalleryProps {
  images: string[];
  title: string;
}

export function ProductGallery({ images, title }: ProductGalleryProps) {
  const [index, setIndex] = useState(0);
  const go = (delta: number) => setIndex((i) => (i + delta + images.length) % images.length);

  return (
    <div className="flex gap-4.5">
      <div className="flex flex-col gap-3.5">
        {images.map((img, i) => (
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

      <div className="relative flex min-h-[440px] flex-1 items-center justify-center overflow-hidden bg-offwhite">
        <button
          aria-label="Previous"
          onClick={() => go(-1)}
          className="absolute left-3.5 top-1/2 z-10 flex h-9.5 w-9.5 -translate-y-1/2 items-center justify-center rounded-full border border-line bg-white"
        >
          <ChevronLeft size={14} />
        </button>
        <div className="relative h-[400px] w-[78%]">
          <Image src={images[index]} alt={title} fill className="object-contain" sizes="500px" />
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
