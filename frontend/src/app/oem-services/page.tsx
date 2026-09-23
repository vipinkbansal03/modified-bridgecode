import type { Metadata } from "next";
import { CmsDetailPageRenderer, buildFallbackDetailRender } from "@/components/cms/CmsDetailPageRenderer";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { notFound } from "next/navigation";
import { buildCmsMetadata } from "@/lib/seo";
import content from "@/data/oem-services.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("oem-services", content.seo, "/oem-services");
}

export default async function OemServicesPage() {
  const cmsPage = await fetchCmsPageByKey("oem-services");

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={content as DetailPageContent}
        breadcrumbLabel="OEM Services"
        fallbackRender={buildFallbackDetailRender(content as DetailPageContent, "OEM Services")}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
