import type { Metadata } from "next";
import { CmsDetailPageRenderer, buildFallbackDetailRender } from "@/components/cms/CmsDetailPageRenderer";
import { ManufacturingSection } from "@/components/sections/ManufacturingSection";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { notFound } from "next/navigation";
import { buildCmsMetadata } from "@/lib/seo";
import manufacturingContent from "@/data/manufacturing-services.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  const cmsPage = await fetchCmsPageByKey("manufacturing");
  if (!cmsPage) {
    return {
      title: "Page Not Found | Modern Orthodontics",
      robots: { index: false, follow: false },
    };
  }
  return buildCmsMetadata("manufacturing", manufacturingContent.seo, "/manufacturing-services");
}

const manufacturingTeaser = {
  kicker: "OEM & Private Label",
  heading: "One of the few orthodontic manufacturers building everything in-house.",
  body: "From MIM brackets to drawn NiTi wire, every process below happens on our own floor in Ludhiana — which is what lets us hold tolerances and lead times that outsourced supply chains can't match.",
  image: "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=80&w=1200&auto=format&fit=crop",
};

export default async function ManufacturingServicesPage() {
  const cmsPage = await fetchCmsPageByKey("manufacturing");
  if (!cmsPage) {
    notFound();
  }

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        fallbackContent={manufacturingContent as DetailPageContent}
        breadcrumbLabel="Manufacturing Services"
        fallbackRender={
          <>
            <ManufacturingSection data={manufacturingTeaser} />
            {buildFallbackDetailRender(manufacturingContent as DetailPageContent, "Manufacturing Services")}
          </>
        }
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
