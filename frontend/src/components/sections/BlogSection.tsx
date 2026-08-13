"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BlogCard } from "@/components/ui/BlogCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useBlogs } from "@/hooks/api/useBlogs";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";

export function BlogSection() {
  const { t } = useStaticTranslations();
  const { data, isLoading } = useBlogs();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  if (!isLoading && (!data || data.length === 0)) {
    return null;
  }

  return (
    <section id="resources" className="border-t border-line py-6 lg:py-[34px]">
      <Container>
        <SectionHeading
          title={t("ui.home.fromResourceCenter")}
          action={
            <div className="flex gap-2.5">
              <button aria-label={t("ui.common.previous")} onClick={() => scrollBy(-300)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
                <ChevronLeft size={14} />
              </button>
              <button aria-label={t("ui.common.next")} onClick={() => scrollBy(300)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
                <ChevronRight size={14} />
              </button>
            </div>
          }
        />
        {isLoading ? (
          <SkeletonGrid count={4} columns={4} />
        ) : (
          <div ref={viewportRef} className="slider-viewport">
            <div className="flex gap-6">
              {data?.map((b) => (
                <BlogCard
                  key={b.slug}
                  {...b}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}

