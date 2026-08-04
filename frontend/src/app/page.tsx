import dynamic from "next/dynamic";
import { cookies } from "next/headers";
import { HeroSection } from "@/components/sections/HeroSection";
import { AboutSection } from "@/components/sections/AboutSection";
import homeContent from "@/data/home.json";
import type { LocationPin } from "@/types/common.types";
import type { CmsPage, CmsSection } from "@/hooks/api/useCmsContent";
import {
  transformHeroSlides,
  transformStats,
  transformCertifications,
  transformAboutIntro,
  transformContactCta,
} from "@/utils/cmsTransform";
import type { HeroSlide } from "@/components/sections/HeroSection";

// Code-split below-the-fold sections for instant initial JS execution & low TBT
const FeaturedProductsSection = dynamic(
  () => import("@/components/sections/FeaturedProductsSection").then((m) => m.FeaturedProductsSection),
  { ssr: true }
);
const CategoriesSection = dynamic(
  () => import("@/components/sections/CategoriesSection").then((m) => m.CategoriesSection),
  { ssr: true }
);
const StatsSection = dynamic(
  () => import("@/components/sections/StatsSection").then((m) => m.StatsSection),
  { ssr: true }
);
const LocationsSection = dynamic(
  () => import("@/components/sections/LocationsSection").then((m) => m.LocationsSection),
  { ssr: true }
);
const CertificationsSection = dynamic(
  () => import("@/components/sections/CertificationsSection").then((m) => m.CertificationsSection),
  { ssr: true }
);
const TestimonialsSection = dynamic(
  () => import("@/components/sections/TestimonialsSection").then((m) => m.TestimonialsSection),
  { ssr: true }
);
const BlogSection = dynamic(
  () => import("@/components/sections/BlogSection").then((m) => m.BlogSection),
  { ssr: true }
);
const ContactCTASection = dynamic(
  () => import("@/components/sections/ContactCTASection").then((m) => m.ContactCTASection),
  { ssr: true }
);

export const revalidate = 300;

const staticLocations = homeContent.locations as { subtitle: string; pins: LocationPin[] };

async function fetchCmsHomePage(): Promise<CmsPage | null> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const language = (await cookies()).get("language")?.value;
    const query = language ? `?lang=${encodeURIComponent(language)}` : "";
    const res = await fetch(`${apiBase}/api/cms/pages/key/home${query}`, { next: { revalidate: 300 } });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function fetchHomepageHeroBanners(countryCode?: string): Promise<HeroSlide[]> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const params = new URLSearchParams({ placement: "HOMEPAGE_HERO" });
    if (countryCode) params.set("countryCode", countryCode);
    const res = await fetch(`${apiBase}/api/banners?${params.toString()}`, { next: { revalidate: 300 } });
    if (!res.ok) return [];
    const json = await res.json();
    const banners = (json.data ?? []) as { image: string; title: string; linkText?: string | null; linkUrl?: string | null }[];
    return banners.map((banner) => ({
      image: banner.image,
      kicker: "Modern Orthodontics",
      title: banner.title,
      ctaLabel: banner.linkText || "Explore",
      ctaHref: banner.linkUrl || "/products",
    }));
  } catch {
    return [];
  }
}

function renderCmsHomeSection(section: CmsSection, bannerSlides: HeroSlide[]) {
  if (section.sectionKey === "home.hero") {
    const heroSlides = transformHeroSlides(section);
    const heroData = bannerSlides.length > 0 ? { slides: bannerSlides } : heroSlides.length > 0 ? { slides: heroSlides } : homeContent.hero;
    return [
      <HeroSection key="home.hero" data={heroData} />,
    ];
  }

  if (section.sectionKey === "home.about") {
    const transformed = transformAboutIntro(section);
    const aboutData = transformed
      ? {
          heading: transformed.title,
          lede: transformed.description,
          ctaLabel: transformed.ctaLabel,
          ctaHref: transformed.ctaHref,
        }
      : homeContent.about;

    return [
      <AboutSection key="home.about" data={aboutData} />,
      <FeaturedProductsSection key="home.featuredProducts" slugs={homeContent.featuredProductSlugs} captions={homeContent.featuredCaptions} />,
      <CategoriesSection key="home.categories" />,
    ];
  }

  if (section.sectionKey === "home.stats") {
    const stats = transformStats(section);
    return [
      <StatsSection key="home.stats" data={stats.length > 0 ? stats : homeContent.stats} />,
      <LocationsSection key="home.locations" data={staticLocations} />,
    ];
  }

  if (section.sectionKey === "home.certifications") {
    const certifications = transformCertifications(section);
    return [
      <CertificationsSection key="home.certifications" data={certifications.length > 0 ? certifications : homeContent.certifications} />,
      <TestimonialsSection key="home.testimonials" />,
      <BlogSection key="home.blog" />,
    ];
  }

  if (section.sectionKey === "home.contactCta") {
    const transformed = transformContactCta(section);
    const contactCtaData = transformed
      ? {
          heading: transformed.title,
          body: transformed.description,
          ctaLabel: transformed.ctaLabel,
          ctaHref: transformed.ctaHref,
          image: transformed.image || homeContent.contactCta.image,
        }
      : homeContent.contactCta;

    return [
      <ContactCTASection key="home.contactCta" data={contactCtaData} />,
    ];
  }

  return [];
}

export default async function HomePage() {
  const cookieStore = await cookies();
  const cms = await fetchCmsHomePage();
  const bannerSlides = await fetchHomepageHeroBanners(cookieStore.get("country")?.value ?? "IN");

  const heroSlides = bannerSlides.length > 0 ? bannerSlides : homeContent.hero.slides;
  const heroLcpImage = heroSlides[0]?.image;

  if (cms?.sections?.length) {
    const renderedSections = cms.sections.flatMap((section) => renderCmsHomeSection(section, bannerSlides));
    if (renderedSections.length > 0) {
      return (
        <>
          {heroLcpImage && (
            <link rel="preload" as="image" href={heroLcpImage} fetchPriority="high" />
          )}
          {renderedSections}
        </>
      );
    }
  }

  return (
    <>
      {heroLcpImage && (
        <link rel="preload" as="image" href={heroLcpImage} fetchPriority="high" />
      )}
      <HeroSection data={bannerSlides.length > 0 ? { slides: bannerSlides } : homeContent.hero} />
      <AboutSection data={homeContent.about} />
      <FeaturedProductsSection slugs={homeContent.featuredProductSlugs} captions={homeContent.featuredCaptions} />
      <CategoriesSection />
      <StatsSection data={homeContent.stats} />
      <LocationsSection data={staticLocations} />
      <CertificationsSection data={homeContent.certifications} />
      <TestimonialsSection />
      <BlogSection />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
