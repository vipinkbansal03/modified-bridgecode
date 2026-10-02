"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight, ImageOff, Maximize2, X } from "lucide-react";
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
  const [zoomed, setZoomed] = useState(false);
  const thumbScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!zoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoomed(false);
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [zoomed]);

  // Keep thumbnail in view when navigating
  useEffect(() => {
    if (thumbScrollRef.current) {
      const activeBtn = thumbScrollRef.current.children[index] as HTMLElement | undefined;
      if (activeBtn) {
        activeBtn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [index]);

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
    <>
      <div className="flex flex-col gap-3.5 w-full min-w-0 max-w-full overflow-hidden">
        {/* Main Image Box */}
        <div className="relative flex min-h-[320px] sm:min-h-[400px] lg:min-h-[460px] aspect-square w-full items-center justify-center overflow-hidden rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 sm:p-6">
          {/* Previous Arrow */}
          {safeImages.length > 1 && (
            <button
              aria-label="Previous image"
              type="button"
              onClick={() => go(-1)}
              className="absolute left-3.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1A1A1A] shadow-2xs transition-all hover:bg-white hover:scale-105 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
          )}

          {/* Main Image Preview */}
          <div
            role="button"
            tabIndex={0}
            aria-label={`Zoom ${title}`}
            onClick={() => setZoomed(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") setZoomed(true);
            }}
            className="relative h-full w-full max-h-[420px] max-w-[95%] cursor-zoom-in flex items-center justify-center"
          >
            {safeImages[index]?.startsWith("data:") ? (
              <img src={safeImages[index]} alt={title} className="h-full w-full object-contain transition-all duration-300" />
            ) : (
              <Image
                src={safeImages[index]}
                alt={title}
                fill
                sizes="(max-width: 768px) 90vw, 600px"
                className="object-contain transition-all duration-300"
                priority
                unoptimized={safeImages[index]?.startsWith("http://") || safeImages[index]?.startsWith("https://")}
              />
            )}
          </div>

          {/* Next Arrow */}
          {safeImages.length > 1 && (
            <button
              aria-label="Next image"
              type="button"
              onClick={() => go(1)}
              className="absolute right-3.5 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1A1A1A] shadow-2xs transition-all hover:bg-white hover:scale-105 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          )}
        </div>

        {/* Thumbnail Strip - Downside (Horizontal underneath main image) */}
        {safeImages.length > 1 && (
          <div className="relative w-full min-w-0 group py-1">
            <div
              ref={thumbScrollRef}
              className="flex items-center gap-2 overflow-x-auto py-1 px-1 scroll-smooth no-scrollbar [scrollbar-width:none] [-ms-overflow-style:none]"
            >
              {safeImages.map((img: string, i: number) => (
                <button
                  key={`${img}-${i}`}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    "relative flex h-[62px] w-[62px] sm:h-[68px] sm:w-[68px] shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-[#FAFAFA] p-1 transition-all cursor-pointer",
                    index === i
                      ? "border-[#E31E24] shadow-xs ring-2 ring-[#E31E24]/30 scale-102 bg-white opacity-100"
                      : "border-[#E5E7EB] opacity-70 hover:opacity-100 hover:border-slate-300"
                  )}
                >
                  {img.startsWith("data:") ? (
                    <img src={img} alt={`${title} thumbnail ${i + 1}`} className="h-full w-full object-contain p-0.5" />
                  ) : (
                    <Image
                      src={img}
                      alt={`${title} thumbnail ${i + 1}`}
                      fill
                      sizes="72px"
                      className="object-contain p-0.5"
                      unoptimized={img?.startsWith("http://") || img?.startsWith("https://")}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Left & Right Chevron controls when multiple images exist */}
            {safeImages.length > 5 && (
              <>
                <button
                  type="button"
                  aria-label="Scroll thumbnails left"
                  onClick={() => {
                    if (thumbScrollRef.current) {
                      thumbScrollRef.current.scrollBy({ left: -180, behavior: "smooth" });
                    }
                  }}
                  className="absolute left-1 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white/95 border border-[#E5E7EB] text-[#1A1A1A] shadow-md hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronLeft size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Scroll thumbnails right"
                  onClick={() => {
                    if (thumbScrollRef.current) {
                      thumbScrollRef.current.scrollBy({ left: 180, behavior: "smooth" });
                    }
                  }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 z-10 hidden sm:flex h-7 w-7 items-center justify-center rounded-full bg-white/95 border border-[#E5E7EB] text-[#1A1A1A] shadow-md hover:bg-white hover:scale-105 transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                >
                  <ChevronRight size={14} />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {zoomed && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-8" onClick={() => setZoomed(false)}>
          <button
            type="button"
            aria-label="Close zoom"
            onClick={() => setZoomed(false)}
            className="absolute top-4 right-4 flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/25"
          >
            <X size={22} />
          </button>
          <img src={safeImages[index]} alt={title} onClick={(e) => e.stopPropagation()} className="max-h-full max-w-full object-contain" />
        </div>
      )}
    </>
  );
}
