import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Reveal } from "@/components/ui/Reveal";
import { TestimonialCard } from "@/components/ui/TestimonialCard";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { buildCmsMetadata } from "@/lib/seo";
import { BackButton } from "@/components/ui/BackButton";
import staticTestimonials from "@/data/testimonials.json";
import homeContent from "@/data/home.json";

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await fetchCmsPageByKey("testimonials");
  if (cmsPage?.seoTitle || cmsPage?.seoDescription) {
    return buildCmsMetadata("testimonials", {
      title: cmsPage.seoTitle || "What our client say - Modern Orthodontics",
      description: cmsPage.seoDescription || "Clinical experiences and feedback from orthodontists worldwide.",
      keywords: ["orthodontic testimonials", "doctor reviews", "dental clinic feedback", "modern orthodontics testimonials"],
    }, "/testimonials");
  }

  return {
    title: "What our client say - Modern Orthodontics",
    description: "Clinical experiences and feedback from orthodontists worldwide on Modern Orthodontics precision products.",
    alternates: {
      canonical: "/testimonials",
    },
  };
}

export default async function TestimonialsPage() {
  const cmsPage = await fetchCmsPageByKey("testimonials");

  let testimonialsList: Array<{ name: string; quote: string; image?: string }> = [];

  if (cmsPage && Array.isArray(cmsPage.sections)) {
    const listSec = cmsPage.sections.find(
      (s) => s.sectionKey === "testimonials.list" || s.sectionKey.includes("list") || s.sectionKey.includes("card")
    );
    if (listSec && Array.isArray(listSec.blocks) && listSec.blocks.length > 0) {
      const activeBlocks = listSec.blocks.filter((b) => b.status !== "INACTIVE");
      if (activeBlocks.length > 0) {
        testimonialsList = activeBlocks.map((b) => ({
          name: b.title || "Orthodontic Specialist",
          quote: b.description || "",
          image: b.image || undefined,
        }));
      }
    }
  }

  if (testimonialsList.length === 0) {
    testimonialsList = staticTestimonials;
  }

  const heroTitle = cmsPage?.title || "What our client say";
  const heroDescription =
    cmsPage?.sections?.find((s) => s.sectionKey.endsWith(".hero"))?.blocks?.[0]?.description ||
    "Clinical experiences and feedback from orthodontists worldwide";

  return (
    <>
      <main className="min-h-screen bg-[#FDFDFD] py-10 sm:py-14 lg:py-16">
        <Container>
          {/* Back Button */}
          <div className="mb-2.5">
            <BackButton />
          </div>

          {/* Breadcrumbs */}
          <nav aria-label="Breadcrumb" className="mb-6 text-[13px] text-steel-2">
            <Link href="/" className="hover:text-brand">
              Home
            </Link>{" "}
            / <span className="font-semibold text-ink">Testimonials</span>
          </nav>

          {/* Section Header */}
          <Reveal>
            <div className="mb-10 sm:mb-12 max-w-3xl">
              <h1 className="text-3xl sm:text-4xl lg:text-[40px] font-bold tracking-tight text-gray-900">
                {heroTitle}
              </h1>
              <p className="mt-3 text-base sm:text-lg text-gray-600 leading-relaxed">
                {heroDescription}
              </p>
            </div>
          </Reveal>

          {/* 2-Column Testimonials Grid matching original layout */}
          <Reveal>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8 lg:gap-9">
              {testimonialsList.map((item, idx) => (
                <div key={item.name + idx} className="h-full">
                  <TestimonialCard
                    name={item.name}
                    quote={item.quote}
                    image={item.image}
                  />
                </div>
              ))}
            </div>
          </Reveal>
        </Container>
      </main>

      {/* Bottom CTA */}
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}