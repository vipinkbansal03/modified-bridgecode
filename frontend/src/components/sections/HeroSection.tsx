"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
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

const AUTOPLAY_MS = 6000000;

export function HeroSection({ data }: HeroSectionProps) {
  const { slides } = data;
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = setInterval(
      () => setIndex((i) => (i + 1) % slides.length),
      AUTOPLAY_MS,
    );
    return () => clearInterval(id);
  }, [slides.length]);

  const slide = slides[index];
  const go = (delta: number) =>
    setIndex((i) => (i + delta + slides.length) % slides.length);

  return (
    <section className="relative h-[calc(100vh-80px)] overflow-hidden sm:h-[380px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={index}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <div className="absolute inset-0">
            <Image
              src={slide.image}
              alt=""
              fill
              priority={index === 0}
              className="object-cover"
              style={{
                filter: "grayscale(100%) contrast(1.08) brightness(0.6)",
              }}
            />
          </div>
          <Container className="relative flex h-full items-end pb-24">
            <motion.div
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.15, ease: "easeOut" }}
            >
              <span className="mb-5 block text-[13px] font-medium tracking-wide text-white">
                {slide.kicker}
              </span>
              <h1 className="max-w-[780px] text-[clamp(40px,6vw,76px)] font-light leading-[1.06] text-white">
                {slide.title}
              </h1>
              <PillCTA href={slide.ctaHref} label={slide.ctaLabel} className="mt-8" />
            </motion.div>
          </Container>
        </motion.div>
      </AnimatePresence>

      <div className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 items-center gap-3.5 sm:left-auto sm:right-10 sm:translate-x-0">
        <div className="flex gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setIndex(i)}
              className={`h-2 rounded-full bg-white transition-all ${i === index ? "w-6" : "w-2 bg-white/35"}`}
            />
          ))}
        </div>
        <button
          aria-label="Previous slide"
          onClick={() => go(-1)}
          className="hidden sm:flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white"
        >
          <ChevronLeft size={14} />
        </button>

        <button
          aria-label="Next slide"
          onClick={() => go(1)}
          className="hidden sm:flex h-9.5 w-9.5 items-center justify-center rounded-full border border-white/40 text-white hover:border-white"
        >
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
