"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ImageOff } from "lucide-react";
import type { PublicBannerItem } from "@/hooks/api/usePublicBanners";

export interface StorefrontBannerProps {
  banner: PublicBannerItem;
  className?: string;
  aspectRatioClassName?: string;
  variant?: "full" | "compact" | "sidebar";
}

function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  return Boolean(
    url.toLowerCase().match(/\.(mp4|webm|ogg|mov|m4v)($|\?)/) ||
    url.toLowerCase().includes("/video/")
  );
}

export function StorefrontBanner({
  banner,
  className = "",
  aspectRatioClassName = "aspect-[21/9] sm:aspect-[24/7]",
  variant = "full",
}: StorefrontBannerProps) {
  const [imageError, setImageError] = useState(false);
  const [mobileImageError, setMobileImageError] = useState(false);

  const isDesktopVideo = isVideoUrl(banner.image);
  const isMobileVideo = isVideoUrl(banner.mobileImage);

  const hasDesktopImage = Boolean(banner.image && banner.image.trim() && !imageError);
  const hasMobileImage = Boolean(
    banner.mobileImage && banner.mobileImage.trim() && !mobileImageError,
  );

  const ContentOverlay = () => {
    if (!banner.title && !banner.linkText) return null;

    if (variant === "sidebar") {
      return (
        <div className="mt-3 space-y-2">
          {banner.title && (
            <h4 className="text-[14px] font-semibold leading-snug text-ink">{banner.title}</h4>
          )}
          {banner.linkUrl && (
            <Link
              href={banner.linkUrl}
              className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[#E31E24] hover:underline"
            >
              {banner.linkText || "Learn more"} <ArrowRight size={13} />
            </Link>
          )}
        </div>
      );
    }

    return (
      <div className="absolute inset-0 flex flex-col justify-end p-6 sm:p-8 bg-gradient-to-t from-black/75 via-black/25 to-transparent text-white rounded-2xl">
        {banner.title && (
          <h3 className="text-[20px] sm:text-[28px] font-bold leading-tight max-w-[640px] drop-shadow-sm">
            {banner.title}
          </h3>
        )}
        {banner.linkUrl && (
          <Link
            href={banner.linkUrl}
            className="mt-4 inline-flex items-center gap-2 self-start rounded-full bg-[#E31E24] px-5 py-2.5 text-[13px] font-semibold text-white transition-all hover:bg-[#B5151B] hover:shadow-md"
          >
            {banner.linkText || "Explore"} <ArrowRight size={14} />
          </Link>
        )}
      </div>
    );
  };

  if (variant === "sidebar") {
    return (
      <div className={`overflow-hidden rounded-xl border border-line bg-white p-4 ${className}`}>
        {hasDesktopImage ? (
          <div className="relative aspect-[16/9] w-full overflow-hidden rounded-lg bg-neutral-900">
            {isDesktopVideo ? (
              <video
                src={banner.image}
                autoPlay
                muted
                loop
                playsInline
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src={banner.image}
                alt={banner.title || "Promotional Banner"}
                fill
                className="object-cover"
                sizes="(min-width: 768px) 300px, 100vw"
                onError={() => setImageError(true)}
                unoptimized={banner.image?.startsWith("http://") || banner.image?.startsWith("https://")}
              />
            )}
          </div>
        ) : (
          <div className="flex h-28 items-center justify-center rounded-lg bg-grey text-steel">
            <ImageOff size={24} />
          </div>
        )}
        <ContentOverlay />
      </div>
    );
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-neutral-900 ${className}`}>
      <div className={`relative w-full ${aspectRatioClassName}`}>
        {/* Mobile override image/video */}
        {hasMobileImage && (
          isMobileVideo ? (
            <video
              src={banner.mobileImage!}
              autoPlay
              muted
              loop
              playsInline
              className="absolute inset-0 h-full w-full object-cover sm:hidden"
            />
          ) : (
            <Image
              src={banner.mobileImage!}
              alt={banner.title || "Banner"}
              fill
              className="object-cover sm:hidden"
              sizes="100vw"
              onError={() => setMobileImageError(true)}
              unoptimized={banner.mobileImage?.startsWith("http://") || banner.mobileImage?.startsWith("https://")}
            />
          )
        )}

        {/* Desktop / Default image/video */}
        {hasDesktopImage ? (
          isDesktopVideo ? (
            <video
              src={banner.image}
              autoPlay
              muted
              loop
              playsInline
              className={`absolute inset-0 h-full w-full object-cover ${hasMobileImage ? "hidden sm:block" : "block"}`}
            />
          ) : (
            <Image
              src={banner.image}
              alt={banner.title || "Banner"}
              fill
              className={`object-cover ${hasMobileImage ? "hidden sm:block" : "block"}`}
              sizes="100vw"
              onError={() => setImageError(true)}
              unoptimized={banner.image?.startsWith("http://") || banner.image?.startsWith("https://")}
            />
          )
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-grey text-steel-2 p-6 text-center">
            <ImageOff size={32} className="text-steel/50" />
            <span className="text-[12px] font-semibold uppercase tracking-wider">
              {banner.title || "Modern Orthodontics Promotion"}
            </span>
          </div>
        )}

        <ContentOverlay />
      </div>
    </div>
  );
}
