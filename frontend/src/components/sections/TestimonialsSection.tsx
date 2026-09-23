"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { TestimonialCard } from "@/components/ui/TestimonialCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { useTestimonials } from "@/hooks/api/useTestimonials";

export function TestimonialsSection() {
  const { data = [], isLoading } = useTestimonials();
  const [startIndex, setStartIndex] = useState(0);

  const testimonials = data || [];
  const total = testimonials.length;

  const prev = () => {
    if (total === 0) return;
    setStartIndex((i) => (i - 1 + total) % total);
  };

  const next = () => {
    if (total === 0) return;
    setStartIndex((i) => (i + 1) % total);
  };

  if (!isLoading && total === 0) return null;

  // Show 3 testimonials on desktop
  const countToShow = Math.min(3, total);
  const visibleTestimonials = Array.from({ length: countToShow }, (_, i) => {
    return testimonials[(startIndex + i) % total];
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <section className="py-8 sm:py-10 lg:py-12 border-t border-gray-100 bg-white">
      <Container>
        <Reveal>
          {/* Header Row matching Certifications style */}
          <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                What our client say
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Clinical experiences and feedback from orthodontists worldwide
              </p>
            </div>
            
            <Link
              href="/testimonials"
              className="hidden sm:inline-flex items-center text-[13.5px] font-semibold text-[#E31E24] hover:text-[#B5151B] transition-colors"
            >
              View all testimonials »
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
              <Skeleton className="h-64 rounded-2xl" />
            </div>
          ) : (
            <div className="relative">
              {/* Outer Left Navigation Arrow */}
              {total > 3 && (
                <button
                  type="button"
                  aria-label="Previous Testimonial"
                  onClick={prev}
                  className="absolute -left-3 sm:-left-4 lg:-left-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 shadow-md hover:border-red-200 hover:text-[#E31E24] hover:bg-red-50/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Previous"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* 3-Card Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
                {visibleTestimonials.map((testimonial, idx) => (
                  <div key={testimonial.name + idx} className="h-full">
                    <TestimonialCard
                      name={testimonial.name}
                      quote={testimonial.quote}
                      image={(testimonial as { image?: string }).image}
                    />
                  </div>
                ))}
              </div>

              {/* Outer Right Navigation Arrow */}
              {total > 3 && (
                <button
                  type="button"
                  aria-label="Next Testimonial"
                  onClick={next}
                  className="absolute -right-3 sm:-right-4 lg:-right-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 shadow-md hover:border-red-200 hover:text-[#E31E24] hover:bg-red-50/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Next"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          )}

          <div className="mt-6 text-center sm:hidden">
            <Link
              href="/testimonials"
              className="inline-flex items-center text-[13.5px] font-semibold text-[#E31E24] hover:text-[#B5151B] transition-colors"
            >
              View all testimonials »
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
