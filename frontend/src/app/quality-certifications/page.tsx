import type { Metadata } from "next";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildCmsMetadata } from "@/lib/seo";
import qualityContent from "@/data/quality-certifications.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("quality-certifications", qualityContent.seo, "/quality-certifications");
}

export default function QualityCertificationsPage() {
  return (
    <>
      <DetailPageTemplate content={qualityContent as DetailPageContent} breadcrumbLabel="Quality Certifications" />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
