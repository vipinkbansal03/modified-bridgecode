import type { Metadata } from "next";
import { ManufacturingSection } from "@/components/sections/ManufacturingSection";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildMetadata } from "@/lib/seo";
import manufacturingContent from "@/data/manufacturing-services.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export const metadata: Metadata = buildMetadata(manufacturingContent.seo, "/manufacturing-services");

const manufacturingTeaser = {
  kicker: "OEM & Private Label",
  heading: "One of the few orthodontic manufacturers building everything in-house.",
  body: "From MIM brackets to drawn NiTi wire, every process below happens on our own floor in Ludhiana — which is what lets us hold tolerances and lead times that outsourced supply chains can't match.",
  image: "https://images.unsplash.com/photo-1769152683420-f4eff91cb30b?fm=jpg&q=80&w=1200&auto=format&fit=crop",
};

export default function ManufacturingServicesPage() {
  return (
    <>
      <ManufacturingSection data={manufacturingTeaser} />
      <DetailPageTemplate content={manufacturingContent as DetailPageContent} breadcrumbLabel="Manufacturing Services" />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
