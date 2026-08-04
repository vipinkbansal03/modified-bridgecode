"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { PillCTA } from "../ui/PillCTA";

export interface HeroSlide {
  image: string;
  kicker: string;
  title: string;
  ctaLabel: string;
  ctaHref: string;
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

  const slide = slides[index];
  const kicker = slide.kicker === "Since 1994" ? t("ui.home.since1994") : slide.kicker;
  const ctaLabel = slide.ctaLabel === "Shop by category" ? t("ui.home.shopByCategory") : slide.ctaLabel;

  return (
    <section
      className="relative h-[calc(100vh-80px)] min-h-[460px] max-h-[700px] overflow-hidden sm:h-[420px]"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
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
              quality={85}
              className="object-cover"
              style={{
                filter: "grayscale(100%) contrast(1.08) brightness(0.6)",
              }}
            />
          </div>
          <Container className="relative flex h-full flex-col justify-center items-start text-left py-12">
            <div className="flex min-h-[200px] w-full max-w-[820px] flex-col justify-center text-left">
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.05, ease: "easeOut" }}
                className="flex flex-col items-start text-left"
              >
                <span className="mb-3 block text-left text-[13px] font-medium tracking-[0.04em] uppercase text-white/90">
                  {kicker}
                </span>
                <h1 className="max-w-[780px] text-left text-[clamp(38px,5.5vw,72px)] font-light leading-[1.06] text-white">
                  {slide.title}
                </h1>
                <div className="mt-6 flex justify-start">
                  <PillCTA href={slide.ctaHref} label={ctaLabel} />
                </div>
              </motion.div>
            </div>
          </Container>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3.5 sm:left-auto sm:right-10 sm:translate-x-0">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={t("ui.common.goToSlide", { number: i + 1 })}
              onClick={() => goToSlide(i)}
              className={`h-2 rounded-full bg-white transition-all duration-300 ${
                i === index ? "w-6 bg-white" : "w-2 bg-white/40 hover:bg-white/70"
              }`}
            />
          ))}
        </div>
        <button
          aria-label={t("ui.common.previousSlide")}
          onClick={() => go(-1)}
          className="hidden sm:flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          aria-label={t("ui.common.nextSlide")}
          onClick={() => go(1)}
          className="hidden sm:flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white transition-colors hover:border-white hover:bg-white/10"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
