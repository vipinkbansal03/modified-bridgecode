import type { Metadata } from "next";
import { CmsDetailPageRenderer, buildFallbackDetailRender } from "@/components/cms/CmsDetailPageRenderer";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { notFound } from "next/navigation";
import { buildCmsMetadata } from "@/lib/seo";
import qualityContent from "@/data/quality-certifications.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await fetchCmsPageByKey("quality-certifications");
  if (!cmsPage) {
    return {
      title: "Page Not Found | Modern Orthodontics",
      robots: { index: false, follow: false },
    };
  }
  return buildCmsMetadata("quality-certifications", qualityContent.seo, "/quality-certifications");
}

export default async function QualityCertificationsPage() {
  const cmsPage = await fetchCmsPageByKey("quality-certifications");
  if (!cmsPage) {
    notFound();
  }

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={qualityContent as DetailPageContent}
        breadcrumbLabel="Quality Certifications"
        fallbackRender={buildFallbackDetailRender(qualityContent as DetailPageContent, "Quality Certifications")}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
