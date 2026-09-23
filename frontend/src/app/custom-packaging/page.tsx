import type { Metadata } from "next";
import { CmsDetailPageRenderer, buildFallbackDetailRender } from "@/components/cms/CmsDetailPageRenderer";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { notFound } from "next/navigation";
import { buildCmsMetadata } from "@/lib/seo";
import content from "@/data/custom-packaging.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("custom-packaging", content.seo, "/custom-packaging");
}

export default async function CustomPackagingPage() {
  const cmsPage = await fetchCmsPageByKey("custom-packaging");

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={content as DetailPageContent}
        breadcrumbLabel="Custom Packaging"
        fallbackRender={buildFallbackDetailRender(content as DetailPageContent, "Custom Packaging")}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
