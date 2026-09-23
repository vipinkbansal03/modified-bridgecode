import type { Metadata } from "next";
import { CmsDetailPageRenderer, buildFallbackDetailRender } from "@/components/cms/CmsDetailPageRenderer";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { notFound } from "next/navigation";
import { buildCmsMetadata } from "@/lib/seo";
import content from "@/data/design-and-engineering.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("design-and-engineering", content.seo, "/design-and-engineering");
}

export default async function DesignAndEngineeringPage() {
  const cmsPage = await fetchCmsPageByKey("design-and-engineering");

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={content as DetailPageContent}
        breadcrumbLabel="Design & Engineering"
        fallbackRender={buildFallbackDetailRender(content as DetailPageContent, "Design & Engineering")}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
