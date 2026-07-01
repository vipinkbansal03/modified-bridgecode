"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BlogCard } from "@/components/ui/BlogCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useBlogs } from "@/hooks/api/useBlogs";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import type { StaticMessageKey } from "@/i18n/staticMessages";

const blogTranslationKeys: Record<string, { title: StaticMessageKey; excerpt: StaticMessageKey }> = {
  "patients-now-expect-high-quality-orthodontics-that-is-also-aesthetically-pleasing-from-their-orthodontists": {
    title: "ui.home.blogPatientsTitle",
    excerpt: "ui.home.blogPatientsExcerpt",
  },
  "how-orthodontics-can-improve-your-patients-teeth-alignment": {
    title: "ui.home.blogAlignmentTitle",
    excerpt: "ui.home.blogAlignmentExcerpt",
  },
  "oem-services-offered-by-original-equipment-manufacturers": {
    title: "ui.home.blogOemTitle",
    excerpt: "ui.home.blogOemExcerpt",
  },
};

export function BlogSection() {
  const { t } = useStaticTranslations();
  const { data, isLoading } = useBlogs();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <section id="resources" className="border-t border-line py-16 lg:py-20">
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
                  title={blogTranslationKeys[b.slug] ? t(blogTranslationKeys[b.slug].title) : b.title}
                  excerpt={blogTranslationKeys[b.slug] ? t(blogTranslationKeys[b.slug].excerpt) : b.excerpt}
                />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
