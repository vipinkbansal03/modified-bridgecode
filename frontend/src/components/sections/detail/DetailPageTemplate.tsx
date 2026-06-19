import { PageHero } from "@/components/sections/detail/PageHero";
import { SubNav } from "@/components/sections/detail/SubNav";
import { DetailSection } from "@/components/sections/detail/DetailSection";
import { FaqAccordion } from "@/components/sections/detail/FaqAccordion";
import type { DetailPageContent } from "@/types/common.types";

interface DetailPageTemplateProps {
  content: DetailPageContent;
  breadcrumbLabel: string;
}

/** Shared template for the About / Manufacturing Services / Quality Certifications pages. */
export function DetailPageTemplate({ content, breadcrumbLabel }: DetailPageTemplateProps) {
  return (
    <>
      <PageHero
        kicker={content.kicker}
        title={content.title}
        lede={content.lede}
        heroImage={content.heroImage}
        breadcrumb={[{ label: "Home", href: "/" }, { label: breadcrumbLabel }]}
      />
      <SubNav items={content.subnav} />
      {content.sections.map((section) => (
        <DetailSection key={section.id} section={section} />
      ))}
      <FaqAccordion items={content.faqs} />
    </>
  );
}
