import { HeroSection } from "@/components/sections/HeroSection";
import { AboutSection } from "@/components/sections/AboutSection";
import { FeaturedProductsSection } from "@/components/sections/FeaturedProductsSection";
import { CategoriesSection } from "@/components/sections/CategoriesSection";
import { StatsSection } from "@/components/sections/StatsSection";
import { LocationsSection } from "@/components/sections/LocationsSection";
import { CertificationsSection } from "@/components/sections/CertificationsSection";
import { TestimonialsSection } from "@/components/sections/TestimonialsSection";
import { BlogSection } from "@/components/sections/BlogSection";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import homeContent from "@/data/home.json";
import type { LocationPin } from "@/types/common.types";

const locationsData = homeContent.locations as { subtitle: string; pins: LocationPin[] };

// Header and Footer are rendered globally by src/app/layout.tsx — this page
// only composes the homepage-specific sections, each fed by data/home.json
// (or, for the API-driven sections, their own React Query hook).
export default function HomePage() {
  return (
    <>
      <HeroSection data={homeContent.hero} />
      <AboutSection data={homeContent.about} />
      <FeaturedProductsSection slugs={homeContent.featuredProductSlugs} captions={homeContent.featuredCaptions} />
      <CategoriesSection />
      <StatsSection data={homeContent.stats} />
      <LocationsSection data={locationsData} />
      <CertificationsSection data={homeContent.certifications} />
      <TestimonialsSection />
      <BlogSection />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
