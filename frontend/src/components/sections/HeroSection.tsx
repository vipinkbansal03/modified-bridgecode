"use client";

import Link from "next/link";
import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
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

export function HeroSection({ data }: HeroSectionProps) {
  const { t } = useStaticTranslations();
  const { slides } = data;
  const [index, setIndex] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const pauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Touch gesture refs
  const touchStartXRef = useRef<number | null>(null);
  const touchStartYRef = useRef<number | null>(null);
  const touchTimeRef = useRef<number>(0);

  // Cleanup pause timer on component unmount
  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    };
  }, []);

  // Auto-slide effect with pause support
  useEffect(() => {
    if (isPaused || slides.length <= 1) return;
    const timer = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, AUTOPLAY_MS);
    return () => clearInterval(timer);
  }, [isPaused, slides.length]);

  // Handle manual navigation with temporary pause
  const go = useCallback(
    (delta: number) => {
      if (slides.length <= 1) return;
      setIndex((i) => (i + delta + slides.length) % slides.length);
      setIsPaused(true);
      if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
      pauseTimerRef.current = setTimeout(() => {
        setIsPaused(false);
      }, 7000);
    },
    [slides.length],
  );

  const goToSlide = useCallback((targetIndex: number) => {
    setIndex(targetIndex);
    setIsPaused(true);
    if (pauseTimerRef.current) clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = setTimeout(() => {
      setIsPaused(false);
    }, 7000);
  }, []);

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
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
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

      <div className="absolute bottom-4 sm:bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3.5 sm:left-auto sm:right-10 sm:translate-x-0 pointer-events-auto">
        <div className="flex gap-2 items-center">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={t("ui.common.goToSlide", { number: i + 1 })}
              onClick={(e) => {
                e.stopPropagation();
                goToSlide(i);
              }}
              className={`h-2 rounded-full bg-white transition-all duration-300 ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
        <button
          type="button"
          aria-label={t("ui.common.previousSlide")}
          onClick={(e) => {
            e.stopPropagation();
            go(-1);
          }}
          className="hidden sm:flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          type="button"
          aria-label={t("ui.common.nextSlide")}
          onClick={(e) => {
            e.stopPropagation();
            go(1);
          }}
          className="hidden sm:flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
