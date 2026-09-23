"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { BlogCard } from "@/components/ui/BlogCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { useBlogs } from "@/hooks/api/useBlogs";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

interface BlogSectionProps {
  data?: {
    title?: string;
    description?: string;
  };
}

export function BlogSection({ data: cmsData }: BlogSectionProps = {}) {
  const { t } = useStaticTranslations();
  const { data = [], isLoading } = useBlogs();
  const [startIndex, setStartIndex] = useState(0);

  const blogs = data || [];
  const total = blogs.length;

  const prev = () => {
    if (total === 0) return;
    setStartIndex((i) => (i - 1 + total) % total);
  };

  const next = () => {
    if (total === 0) return;
    setStartIndex((i) => (i + 1) % total);
  };

  if (!isLoading && total === 0) {
    return null;
  }

  const headingTitle = cmsData?.title?.trim() || t("ui.home.fromResourceCenter");
  const headingSubtitle = cmsData?.description?.trim() || "Explore our latest clinical studies, product announcements, and orthodontic guides";

  // Show 3 cards on desktop
  const countToShow = Math.min(3, total);
  const visibleBlogs = Array.from({ length: countToShow }, (_, i) => {
    return blogs[(startIndex + i) % total];
  }).filter((item): item is NonNullable<typeof item> => Boolean(item));

  return (
    <section id="resources" className="py-8 sm:py-10 lg:py-12 border-t border-gray-100 bg-white">
      <Container>
        <Reveal>
          {/* Header Row matching Testimonials & Certifications */}
          <div className="mb-6 sm:mb-8 flex items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-gray-900">
                {headingTitle}
              </h2>
              {headingSubtitle && (
                <p className="mt-1.5 text-sm text-gray-500">
                  {headingSubtitle}
                </p>
              )}
            </div>

            <Link
              href="/blog"
              className="hidden sm:inline-flex items-center text-[13.5px] font-semibold text-[#E31E24] hover:text-[#B5151B] transition-colors"
            >
              View all articles »
            </Link>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
              <Skeleton className="h-96 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
              <Skeleton className="h-96 rounded-2xl" />
            </div>
          ) : (
            <div className="relative">
              {/* Outer Left Navigation Arrow matching Testimonials section */}
              {total > 3 && (
                <button
                  type="button"
                  aria-label="Previous Article"
                  onClick={prev}
                  className="absolute -left-3 sm:-left-4 lg:-left-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 shadow-md hover:border-red-200 hover:text-[#E31E24] hover:bg-red-50/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Previous"
                >
                  <ChevronLeft size={20} />
                </button>
              )}

              {/* 3-Card Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 lg:gap-7">
                {visibleBlogs.map((b, idx) => (
                  <div key={b.slug + idx} className="h-full">
                    <BlogCard {...b} />
                  </div>
                ))}
              </div>

              {/* Outer Right Navigation Arrow matching Testimonials section */}
              {total > 3 && (
                <button
                  type="button"
                  aria-label="Next Article"
                  onClick={next}
                  className="absolute -right-3 sm:-right-4 lg:-right-5 top-1/2 -translate-y-1/2 z-20 flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-full bg-white border border-gray-200 text-gray-700 shadow-md hover:border-red-200 hover:text-[#E31E24] hover:bg-red-50/50 hover:scale-105 active:scale-95 transition-all cursor-pointer"
                  title="Next"
                >
                  <ChevronRight size={20} />
                </button>
              )}
            </div>
          )}

          {/* Mobile View All Link */}
          <div className="mt-6 sm:hidden text-center">
            <Link
              href="/blog"
              className="inline-flex items-center text-sm font-semibold text-[#E31E24] hover:text-[#B5151B]"
            >
              View all articles »
            </Link>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}


