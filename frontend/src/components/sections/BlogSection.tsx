"use client";

import { useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { BlogCard } from "@/components/ui/BlogCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { useBlogs } from "@/hooks/api/useBlogs";

export function BlogSection() {
  const { data, isLoading } = useBlogs();
  const viewportRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) => viewportRef.current?.scrollBy({ left: delta, behavior: "smooth" });

  return (
    <section id="resources" className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          title="From the blog"
          action={
            <div className="flex gap-2.5">
              <button aria-label="Previous" onClick={() => scrollBy(-300)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
                <ChevronLeft size={14} />
              </button>
              <button aria-label="Next" onClick={() => scrollBy(300)} className="flex h-9.5 w-9.5 items-center justify-center rounded-full border border-line hover:border-steel-2">
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
                <BlogCard key={b.slug} {...b} />
              ))}
            </div>
          </div>
        )}
      </Container>
    </section>
  );
}
