"use client";

import { useState } from "react";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { Container } from "@/components/ui/Container";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { useCategories } from "@/hooks/api/useCategories";
import { cn } from "@/utils/cn";

export function CategoriesSection() {
  const { data: categories, isLoading } = useCategories();
  const [view, setView] = useState<"doctor" | "dealer">("doctor");

  return (
    <section id="categories" className="py-24 sm:py-32">
      <Container>
        <SectionHeading
          title="Shop by category"
          action={
            <div className="flex gap-2.5">
              {(["doctor", "dealer"] as const).map((v) => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "rounded-pill px-5 py-2.5 text-[14.5px] font-medium transition-colors",
                    view === v ? "bg-ink text-white" : "bg-grey text-steel"
                  )}
                >
                  {v === "doctor" ? "Doctor" : "Dealer"}
                </button>
              ))}
            </div>
          }
        />

        {isLoading ? (
          <SkeletonGrid count={8} columns={4} />
        ) : (
          <div className="grid grid-cols-1 gap-5.5 sm:grid-cols-2 lg:grid-cols-4">
            {categories?.map((cat, i) => (
              <Reveal key={cat.slug} delay={i * 0.04}>
                <CategoryCard
                  title={cat.title}
                  image={cat.image ?? ""}
                  slug={cat.slug}
                  productCount={cat.productCount}
                  meta={view === "doctor" ? (cat.doctorMeta ?? "") : (cat.dealerMeta ?? "")}
                />
              </Reveal>
            ))}
          </div>
        )}
      </Container>
    </section>
  );
}
