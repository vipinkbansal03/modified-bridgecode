"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { PillCTA } from "../ui/PillCTA";

export interface HeroSlide {
  image: string;
  kicker?: string | null;
  title?: string | null;
  ctaLabel?: string | null;
  ctaHref?: string | null;
}

interface HeroSectionProps {
  data: { slides: HeroSlide[] };
}

const AUTOPLAY_MS = 5500;

export function isVideoUrl(url?: string | null): boolean {
  if (!url) return false;
  const clean = url.split("?")[0].toLowerCase();
  return (
    clean.endsWith(".mp4") ||
    clean.endsWith(".webm") ||
    clean.endsWith(".ogg") ||
    clean.endsWith(".mov") ||
    clean.endsWith(".m4v") ||
    url.includes("/video/") ||
    url.includes("video/upload")
  );
}

export function HeroSection({ data }: HeroSectionProps) {
  const { t } = useStaticTranslations();
  const { slides } = data;
  const [index, setIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isTempPaused, setIsTempPaused] = useState(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Touch gesture refs
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchTimeRef = useRef<number>(0);

  // Sync video play/pause with isPlaying state
  useEffect(() => {
    if (!videoRef.current) return;
    if (isPlaying) {
      videoRef.current.play().catch(() => {});
    } else {
      videoRef.current.pause();
    }
  }, [isPlaying, index]);

  // Cleanup pause timer on component unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  // Auto-slide effect with play/pause support
  useEffect(() => {
    if (!isPlaying || isHovered || isTempPaused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [isPlaying, isHovered, isTempPaused, slides.length]);

  // Handle manual navigation with temporary pause
  const go = useCallback(
    (delta: number) => {
      if (slides.length <= 1) return;
      setIndex((i) => (i + delta + slides.length) % slides.length);
      if (isPlaying) {
        setIsTempPaused(true);
        if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
        pauseTimerRef.current = setTimeout(() => {
          setIsTempPaused(false);
        }, 7000);
      }
    },
    [isPlaying, slides.length],
  );

  const goToSlide = useCallback((targetIndex: number) => {
    setIndex(targetIndex);
    if (isPlaying) {
      setIsTempPaused(true);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => {
        setIsTempPaused(false);
      }, 7000);
    }
  }, [isPlaying]);

  // Touch gesture handlers (swipe left -> next, swipe right -> prev)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (slides.length <= 1) return;
    touchStartXRef.current = e.touches[0].clientX;
    touchStartYRef.current = e.touches[0].clientY;
    touchTimeRef.current = Date.now();
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    // If vertical scroll is dominant, let the browser handle natural vertical scroll
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const deltaX = e.touches[0].clientX - touchStartXRef.current;
    const deltaY = e.touches[0].clientY - touchStartYRef.current;
    if (Math.abs(deltaY) > Math.abs(deltaX)) {
      return;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartXRef.current === null || touchStartYRef.current === null) return;
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;
    const deltaX = touchEndX - touchStartXRef.current;
    const deltaY = touchEndY - touchStartYRef.current;
    const elapsedTime = Date.now() - touchTimeRef.current;

    // Reset touch coordinates
    touchStartXRef.current = null;
    touchStartYRef.current = null;

    // Trigger swipe if horizontal displacement is >= 40px, predominantly horizontal, and reasonably quick
    if (
      Math.abs(deltaX) >= 40 &&
      Math.abs(deltaX) > Math.abs(deltaY) * 1.2 &&
      elapsedTime < 700
    ) {
      if (deltaX < 0) {
        // Swiped left -> Next slide
        go(1);
      } else {
        // Swiped right -> Previous slide
        go(-1);
      }
    }
  };

  if (!slides || slides.length === 0) {
    return (
      <section className="relative flex h-[260px] sm:h-[340px] md:h-[400px] lg:h-[460px] xl:h-[480px] items-center overflow-hidden bg-gradient-to-br from-[#0F2D52] via-[#1A1A1A] to-[#0D0D0D]">
        <Container className="relative flex h-full flex-col justify-center items-start py-8">
          <div className="flex w-full max-w-[820px] flex-col justify-center text-left">
            <span className="mb-2.5 inline-flex w-fit items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-[11px] sm:text-[12px] font-semibold tracking-wider uppercase text-white backdrop-blur-sm shadow-xs">
              <span className="h-1.5 w-1.5 rounded-full bg-brand" />
              Modern Orthodontics
            </span>
            <h1 className="max-w-[780px] text-left text-[clamp(24px,4.5vw,40px)] sm:text-[clamp(30px,3.8vw,48px)] xl:text-[clamp(36px,3.2vw,56px)] font-light leading-[1.12] text-white drop-shadow-sm">
              Engineering precision orthodontic hardware, since 1994.
            </h1>
            <p className="mt-2.5 max-w-[620px] text-[14px] sm:text-[15px] text-white/80 leading-relaxed line-clamp-2 sm:line-clamp-none">
              Global manufacturer of premium orthodontic brackets, molar tubes, archwires, and OEM solutions.
            </p>
            <div className="mt-4 sm:mt-5 flex justify-start">
              <PillCTA href="/products" label="Explore Products" />
            </div>
          </div>
        </Container>
      </section>
    );
  }

  const slide = slides[index];
  const kicker = slide.kicker === "Since 1994" ? t("ui.home.since1994") : slide.kicker;
  const ctaLabel = slide.ctaLabel === "Shop by category" ? t("ui.home.shopByCategory") : slide.ctaLabel;
  const hasKicker = Boolean(kicker?.trim());
  const hasTitle = Boolean(slide.title?.trim());
  const hasCta = Boolean(slide.ctaHref?.trim() && ctaLabel?.trim());
  const hasTextOverlay = hasKicker || hasTitle || hasCta;

  return (
    <section
      className="relative h-[260px] sm:h-[340px] md:h-[400px] lg:h-[460px] xl:h-[480px] overflow-hidden select-none touch-pan-y"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >

      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          initial={index === 0 ? { opacity: 1 } : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.25, 1, 0.5, 1] }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0">
            {isVideoUrl(slide.image) ? (
              <video
                ref={videoRef}
                src={slide.image}
                autoPlay={isPlaying}
                muted
                loop
                playsInline
                className="h-full w-full object-cover object-center pointer-events-none"
              />
            ) : (
              <Image
                src={slide.image}
                alt={slide.title || "Modern Orthodontics Hero Banner"}
                fill
                priority={index === 0}
                fetchPriority={index === 0 ? "high" : "auto"}
                sizes="100vw"
                quality={90}
                className="object-cover object-center"
              />
            )}
          </div>

          {hasTextOverlay ? (
            <Container className="relative flex h-full flex-col justify-center items-start py-8">
              <div className="flex w-full max-w-[820px] flex-col justify-center text-left">
                <motion.div
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
                  className="flex flex-col items-start text-left"
                >
                  {hasKicker ? (
                    <span className="mb-2.5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-0.5 text-[11px] sm:text-[12px] font-semibold tracking-wider uppercase text-white backdrop-blur-sm shadow-xs">
                      <span className="h-1.5 w-1.5 rounded-full bg-brand" />
                      {kicker}
                    </span>
                  ) : null}
                  {hasTitle ? (
                    <h1 className="max-w-[780px] text-left text-[clamp(24px,4.5vw,40px)] sm:text-[clamp(30px,3.8vw,48px)] xl:text-[clamp(36px,3.2vw,56px)] font-light leading-[1.12] text-white drop-shadow-sm">
                      {slide.title}
                    </h1>
                  ) : null}
                  {hasCta ? (
                    <div className="mt-4 sm:mt-5 flex justify-start">
                      <PillCTA href={slide.ctaHref!} label={ctaLabel!} />
                    </div>
                  ) : null}
                </motion.div>
              </div>
            </Container>
          ) : slide.ctaHref ? (
            <Link
              href={slide.ctaHref}
              className="absolute inset-0 z-[1]"
              aria-label={slide.title || "Promotional banner link"}
            />
          ) : null}
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/70 px-3 py-1.5 shadow-[0_4px_20px_rgba(0,0,0,0.4)] backdrop-blur-md sm:left-auto sm:right-10 sm:translate-x-0 pointer-events-auto">
        <div className="flex gap-1.5 items-center px-1">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("ui.common.goToSlide", { number: i + 1 })}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(i);
              }}
              className={`h-2 rounded-full transition-all duration-300 cursor-pointer ${
                i === index ? "w-5 bg-white shadow-xs" : "w-2 bg-white/40 hover:bg-white/80"
              }`}
            />
          ))}
        </div>

        {slides.length > 1 && (
          <div className="flex items-center gap-1 border-l border-white/20 pl-2">
            <button
              type="button"
              aria-label={isPlaying ? "Pause banner autoplay" : "Play banner autoplay"}
              title={isPlaying ? "Pause banner" : "Play banner"}
              onClick={(e) => {
                e.stopPropagation();
                setIsPlaying((prev) => !prev);
                setIsTempPaused(false);
                if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
              }}
              className="flex h-7 w-7 sm:h-8 sm:w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20 hover:text-white cursor-pointer"
            >
              {isPlaying ? (
                <Pause size={13} className="fill-white text-white" />
              ) : (
                <Play size={13} className="fill-white text-white translate-x-0.5" />
              )}
            </button>

            <button
              type="button"
              aria-label={t("ui.common.previousSlide")}
              title="Previous slide"
              onClick={(e) => {
                e.stopPropagation();
                go(-1);
              }}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20 hover:text-white cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>

            <button
              type="button"
              aria-label={t("ui.common.nextSlide")}
              title="Next slide"
              onClick={(e) => {
                e.stopPropagation();
                go(1);
              }}
              className="hidden sm:flex h-8 w-8 items-center justify-center rounded-full text-white/90 transition-colors hover:bg-white/20 hover:text-white cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
