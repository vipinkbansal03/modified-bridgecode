import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CmsDetailPageRenderer } from "@/components/cms/CmsDetailPageRenderer";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { fetchCmsPageBySlug } from "@/lib/cmsPage";
import homeContent from "@/data/home.json";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const cmsPage = await fetchCmsPageBySlug(slug);
  if (!cmsPage) return {};

  return {
    title: cmsPage.seoTitle || `${cmsPage.title} | Modern Orthodontics`,
    description: cmsPage.seoDescription || undefined,
    keywords: cmsPage.seoKeywords ? cmsPage.seoKeywords.split(",").map((k) => k.trim()) : undefined,
  };
}

export default async function DynamicCmsPage({ params }: PageProps) {
  const { slug } = await params;
  const cmsPage = await fetchCmsPageBySlug(slug);

  if (!cmsPage || cmsPage.status !== "ACTIVE") {
    notFound();
  }

  return (
    <>
      <CmsDetailPageRenderer
        page={cmsPage}
        breadcrumbLabel={cmsPage.title}
      />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
