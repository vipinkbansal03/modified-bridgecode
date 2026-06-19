import type { Metadata } from "next";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildMetadata } from "@/lib/seo";
import content from "@/data/design-and-engineering.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export const metadata: Metadata = buildMetadata(content.seo, "/design-and-engineering");

export default function DesignAndEngineeringPage() {
  return (
    <>
      <DetailPageTemplate content={content as DetailPageContent} breadcrumbLabel="Design & Engineering" />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
