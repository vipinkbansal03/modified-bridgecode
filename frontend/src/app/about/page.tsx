import type { Metadata } from "next";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildCmsMetadata } from "@/lib/seo";
import aboutContent from "@/data/about-us.json";
import homeContent from "@/data/home.json";
import type { DetailPageContent } from "@/types/common.types";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("about", aboutContent.seo, "/about");
}

export default function AboutPage() {
  return (
    <>
      <DetailPageTemplate content={aboutContent as DetailPageContent} breadcrumbLabel="About Us" />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
