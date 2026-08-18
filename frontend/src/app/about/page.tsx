import type { Metadata } from "next";
import { cookies } from "next/headers";
import { CmsDetailPageRenderer, buildFallbackDetailRender } from "@/components/cms/CmsDetailPageRenderer";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { buildCmsMetadata } from "@/lib/seo";
import aboutContent from "@/data/about-us.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("about", aboutContent.seo, "/about");
}

async function fetchAboutHeroBanner(countryCode?: string): Promise<string | null> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const params = new URLSearchParams({ placement: "ABOUT_HERO" });
    if (countryCode) params.set("countryCode", countryCode);
    const res = await fetch(`${apiBase}/api/banners?${params.toString()}`, {
      cache: "no-store",
      next: { revalidate: 0 },
    });
    if (!res.ok) return null;
    const json = await res.json();
    const banners = json.data ?? [];
    return banners[0]?.image || null;
  } catch {
    return null;
  }
}

export default async function AboutPage() {
  const cookieStore = await cookies();
  const countryCode = cookieStore.get("country")?.value ?? "IN";
  const [cmsPage, dynamicBannerImage] = await Promise.all([
    fetchCmsPageByKey("about"),
    fetchAboutHeroBanner(countryCode),
  ]);

  const fallbackData = {
    ...aboutContent,
    heroImage: dynamicBannerImage || aboutContent.heroImage,
  } as DetailPageContent;

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={fallbackData}
        breadcrumbLabel="About Us"
        heroImageOverride={dynamicBannerImage || undefined}
        fallbackRender={buildFallbackDetailRender(fallbackData, "About Us")}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
