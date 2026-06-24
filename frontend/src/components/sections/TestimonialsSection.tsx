"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { TestimonialCard } from "@/components/ui/TestimonialCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useTestimonials } from "@/hooks/api/useTestimonials";

export function TestimonialsSection() {
  const { data, isLoading } = useTestimonials();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <section className="py-12 lg:py-20">
      <Container>
        <SectionHeading
          title="What doctors say"
          action={
            <div className="flex gap-2.5">
              <button aria-label="Previous" onClick={() => scrollBy(-360)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
                <ChevronLeft size={14} />
              </button>
              <button aria-label="Next" onClick={() => scrollBy(360)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
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
              {data?.map((t) => (
                <TestimonialCard key={t.name} {...t} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
