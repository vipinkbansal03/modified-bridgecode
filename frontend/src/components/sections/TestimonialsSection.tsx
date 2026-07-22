"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TestimonialCard } from "@/components/ui/TestimonialCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useTestimonials } from "@/hooks/api/useTestimonials";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { StaticMessageKey } from "@/i18n/staticMessages";

const testimonialQuoteKeys: Record<string, StaticMessageKey> = {
  "Dr. Mathew P. Sunny": "ui.home.testimonialMathewSunny",
  "Dr. Neil David Andrade": "ui.home.testimonialNeilAndrade",
  "Dr. Shiv Priya Aher": "ui.home.testimonialShivAher",
  "Dr. Aby Augustine": "ui.home.testimonialAbyAugustine",
  "Rohit Jain": "ui.home.testimonialRohitJain",
};

export function TestimonialsSection() {
  const { t } = useStaticTranslations();
  const { data, isLoading } = useTestimonials();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <section className="pt-1 pb-3 lg:pt-1 lg:pb-4">
      <Container>
        <SectionHeading
          title={t("ui.home.whatDoctorsSay")}
          action={
            <div className="flex gap-2.5">
              <button aria-label={t("ui.common.previous")} onClick={() => scrollBy(-360)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
                <ChevronLeft size={14} />
              </button>
              <button aria-label={t("ui.common.next")} onClick={() => scrollBy(360)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
                <ChevronRight size={14} />
              </button>
            </div>
          }
        />
        {isLoading ? (
          <SkeletonGrid count={3} columns={3} />
        ) : (
          <div ref={viewportRef} className="slider-viewport">
            <div className="flex gap-6">
              {data?.map((testimonial) => (
                <TestimonialCard
                  key={testimonial.name}
                  {...testimonial}
                  quote={testimonialQuoteKeys[testimonial.name] ? t(testimonialQuoteKeys[testimonial.name]) : testimonial.quote}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
