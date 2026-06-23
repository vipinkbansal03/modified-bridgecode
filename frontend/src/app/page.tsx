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
import type { CmsPage, CmsSection } from "@/hooks/api/useCmsContent";
import { transformHeroSlides, transformStats, transformCertifications, transformAboutIntro, transformContactCta } from "@/utils/cmsTransform";

export const revalidate = 300;

const staticLocations = homeContent.locations as { subtitle: string; pins: LocationPin[] };

async function fetchCmsHomePage(): Promise<CmsPage | null> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiBase}/api/cms/pages/key/home`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

function findSection(cms: CmsPage, key: string): CmsSection | null {
  return cms.sections.find((s) => s.sectionKey === key) ?? null;
}

export default async function HomePage() {
  const cms = await fetchCmsHomePage();

  // Resolve each section from CMS or fall back to static JSON
  const heroSlides = cms
    ? transformHeroSlides(findSection(cms, "home.hero") ?? { id: "", sectionKey: "", sortOrder: 0, blocks: [] })
    : homeContent.hero.slides;

  const heroData = heroSlides.length > 0
    ? { slides: heroSlides }
    : homeContent.hero;

  const aboutData = (() => {
    if (!cms) return homeContent.about;
    const t = transformAboutIntro(findSection(cms, "home.about") ?? { id: "", sectionKey: "", sortOrder: 0, blocks: [] });
    if (!t) return homeContent.about;
    return { ...homeContent.about, title: t.title, description: t.description };
  })();

  const statsData = cms
    ? (() => {
        const t = transformStats(findSection(cms, "home.stats") ?? { id: "", sectionKey: "", sortOrder: 0, blocks: [] });
        return t.length > 0 ? t : homeContent.stats;
      })()
    : homeContent.stats;

  const certsData = cms
    ? (() => {
        const t = transformCertifications(findSection(cms, "home.certifications") ?? { id: "", sectionKey: "", sortOrder: 0, blocks: [] });
        return t.length > 0 ? t : homeContent.certifications;
      })()
    : homeContent.certifications;

  const contactCtaData = (() => {
    if (!cms) return homeContent.contactCta;
    const t = transformContactCta(findSection(cms, "home.contactCta") ?? { id: "", sectionKey: "", sortOrder: 0, blocks: [] });
    if (!t) return homeContent.contactCta;
    return { ...homeContent.contactCta, title: t.title, description: t.description, ctaLabel: t.ctaLabel, ctaHref: t.ctaHref, image: t.image || homeContent.contactCta.image };
  })();

  return (
    <>
      <HeroSection data={heroData} />
      <AboutSection data={aboutData} />
      <FeaturedProductsSection slugs={homeContent.featuredProductSlugs} captions={homeContent.featuredCaptions} />
      <CategoriesSection />
      <StatsSection data={statsData} />
      <LocationsSection data={staticLocations} />
      <CertificationsSection data={certsData} />
      <TestimonialsSection />
      <BlogSection />
      <ContactCTASection data={contactCtaData} />
    </>
  );
}
