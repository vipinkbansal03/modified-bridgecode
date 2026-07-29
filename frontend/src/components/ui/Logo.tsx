"use client";

import { useState } from "react";
import { cn } from "@/utils/cn";
import { Skeleton } from "@/components/ui/Skeleton";

interface LogoProps {
  variant?: "dark" | "light";
  className?: string;
  src?: string | null;
  mobileSrc?: string | null;
  alt?: string | null;
  isMobile?: boolean;
  isLoading?: boolean;
}

/** Dynamic branding logo with automatic fallback to inline SVG monogram + wordmark. */
export function Logo({
  variant = "dark",
  className,
  src,
  mobileSrc,
  alt = "Modern Orthodontics",
  isMobile = false,
  isLoading = false,
}: LogoProps) {
  const [imgError, setImgError] = useState(false);

  if (isLoading) {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <Skeleton
          className={cn(
            "h-9 w-[150px] rounded-md",
            variant === "light" && "bg-white/20"
          )}
        />
      </div>
    );
  }

  const rawImage = isMobile ? (mobileSrc?.trim() || src?.trim()) : src?.trim();

  let resolvedImage: string | null = null;
  if (rawImage && !imgError) {
    let trimmed = rawImage.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):4000(\/uploads\/)/i, "$1");
    if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
      resolvedImage = trimmed;
    } else {
      resolvedImage = `/${trimmed}`;
    }
  }

  const altText = alt?.trim() || "Modern Orthodontics";
  const stroke = variant === "light" ? "#fff" : "#E31E24";

  if (resolvedImage) {
    return (
      <div className={cn("flex items-center gap-2.5", className)}>
        <img
          src={resolvedImage}
          alt={altText}
          onError={() => setImgError(true)}
          className="h-9 w-auto max-h-9 object-contain shrink-0"
        />
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <svg viewBox="0 0 40 40" fill="none" className="h-9 w-9 flex-none">
        <circle cx="20" cy="20" r="18" stroke={stroke} strokeWidth="2" />
        <path d="M12 27V13l8 9 8-9v14" stroke={stroke} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      {variant === "dark" ? (
        <span className="leading-tight">
          <b className="block text-[19px] font-semibold tracking-tight text-ink">Modern</b>
          <span className="block text-[13px] font-normal tracking-wide text-steel">Orthodontics</span>
        </span>
      ) : (
        <span className="text-[22px] tracking-tight text-white">{altText}</span>
      )}
    </div>
  );
}
