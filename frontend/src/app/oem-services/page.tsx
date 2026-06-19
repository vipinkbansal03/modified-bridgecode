import type { Metadata } from "next";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildMetadata } from "@/lib/seo";
import content from "@/data/oem-services.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export const metadata: Metadata = buildMetadata(content.seo, "/oem-services");

export default function OemServicesPage() {
  return (
    <>
      <DetailPageTemplate content={content as DetailPageContent} breadcrumbLabel="OEM Services" />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
