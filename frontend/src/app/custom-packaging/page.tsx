import type { Metadata } from "next";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildMetadata } from "@/lib/seo";
import content from "@/data/custom-packaging.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export const metadata: Metadata = buildMetadata(content.seo, "/custom-packaging");

export default function CustomPackagingPage() {
  return (
    <>
      <DetailPageTemplate content={content as DetailPageContent} breadcrumbLabel="Custom Packaging" />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
