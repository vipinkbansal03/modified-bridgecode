import type { Metadata } from "next";
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

export default async function AboutPage() {
  const cmsPage = await fetchCmsPageByKey("about");

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={aboutContent as DetailPageContent}
        breadcrumbLabel="About Us"
        fallbackRender={buildFallbackDetailRender(aboutContent as DetailPageContent, "About Us")}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
