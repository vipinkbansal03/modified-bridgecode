"use client";

import { useState } from "react";
import { Container } from "@/components/ui/Container";
import { CategoryCard } from "@/components/ui/CategoryCard";
import { SkeletonGrid } from "@/components/ui/Skeleton";
import { Reveal } from "@/components/ui/Reveal";
import { useCategories } from "@/hooks/api/useCategories";
import { useStaticTranslations } from "@/hooks/api/useStaticTranslations";
import { cn } from "@/utils/cn";

const CATEGORY_STOCK_IMAGES: Record<string, string> = {
  "aesthetic-brackets": "https://images.unsplash.com/photo-1728102197400-0648e058fddd?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "metal-brackets": "https://images.unsplash.com/photo-1643216790495-ed36d21b05c0?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "niti-wires": "https://images.unsplash.com/photo-1759846865520-7ebe2baaa759?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "ss-wires": "https://images.unsplash.com/photo-1770219792093-85830ce757b7?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "molar-bands": "https://images.unsplash.com/photo-1769147339214-076740872485?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "molar-tubes": "https://images.unsplash.com/photo-1770321119305-f191c09c5801?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "elastomerics": "https://images.unsplash.com/photo-1738162837438-92ff852619a1?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "tooth-color-wire": "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "begg-appliances": "https://images.unsplash.com/photo-1758873263563-5ba4aa330799?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "special-wires": "https://images.unsplash.com/photo-1759846865520-7ebe2baaa759?fm=jpg&q=75&w=600&auto=format&fit=crop",
  "miscellaneous-items": "https://images.unsplash.com/photo-1759272840712-c7e5ea852367?fm=jpg&q=75&w=600&auto=format&fit=crop",
};

export function CategoriesSection() {
  const { t } = useStaticTranslations();
  const { data: categories, isLoading } = useCategories();
  const [view, setView] = useState<"doctor" | "dealer">("doctor");

  return (
    <section id="categories" className="py-16 lg:py-20">
      <Container>
        <div className="mb-10">
          <h2 className="text-[clamp(28px,3.4vw,40px)] font-light text-ink">{t("ui.home.shopByCategory")}</h2>
        </div>
        {/* <div className="mb-10 flex gap-2.5">
          {(["doctor", "dealer"] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={cn(
                "rounded-pill px-5 py-2.5 text-[14.5px] font-medium transition-colors",
                view === v ? "bg-ink text-white" : "bg-grey text-steel"
              )}
            >
              {v === "doctor" ? t("ui.home.forDoctors") : t("ui.home.forDealers")}
            </button>
          ))}
        </div> */}

        {isLoading ? (
          <SkeletonGrid count={8} columns={4} />
        ) : (
          <div className="grid grid-cols-1 gap-5.5 sm:grid-cols-2 lg:grid-cols-4">
            {categories?.map((cat, i) => (
              <Reveal key={cat.slug} delay={i * 0.04}>
                <CategoryCard
                  title={cat.title}
                  image={CATEGORY_STOCK_IMAGES[cat.slug] ?? cat.image ?? ""}
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
