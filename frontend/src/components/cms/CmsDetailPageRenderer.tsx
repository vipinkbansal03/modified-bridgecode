import { Fragment, type ReactNode } from "react";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { DetailSection } from "@/components/sections/detail/DetailSection";
import { FaqAccordion } from "@/components/sections/detail/FaqAccordion";
import { PageHero } from "@/components/sections/detail/PageHero";
import type { CmsBlock, CmsPage, CmsSection } from "@/hooks/api/useCmsContent";
import type { DetailPageContent } from "@/types/common.types";

function sectionAnchor(section: CmsSection) {
  return section.sectionKey.split(".").pop() || section.id;
}

function blockData(block: CmsBlock): Record<string, unknown> {
  return typeof block.dataJson === "object" && block.dataJson !== null
    ? (block.dataJson as Record<string, unknown>)
    : {};
}

function buildHero(page: CmsPage, fallback: DetailPageContent, breadcrumbLabel: string, heroImageOverride?: string) {
  const heroSection = page.sections.find((section) => section.sectionKey.endsWith(".hero"));
  const heroBlock = heroSection?.blocks[0];
  const heroData = heroBlock ? blockData(heroBlock) : {};

  return {
    kicker: heroBlock?.subtitle || fallback.kicker,
    title: heroBlock?.title || page.title || fallback.title,
    lede: heroBlock?.description || fallback.lede,
    heroImage: heroImageOverride || (heroData.image as string) || heroBlock?.image || fallback.heroImage,
    breadcrumb: [{ label: "Home", href: "/" }, { label: breadcrumbLabel }],
  };
}

function buildFaqs(section: CmsSection, fallback: DetailPageContent) {
  const items = section.blocks
    .filter((block) => block.status !== "INACTIVE" && block.blockType === "faq")
    .map((block) => ({
      question: block.title || "",
      answer: block.description || "",
    }))
    .filter((item) => item.question && item.answer);

  return items.length > 0 ? items : fallback.faqs;
}

function buildDetailSection(section: CmsSection, fallback: DetailPageContent) {
  const anchor = sectionAnchor(section);
  const fallbackSection = fallback.sections.find((item) => item.id === anchor);
  const activeBlocks = section.blocks.filter((block) => block.status !== "INACTIVE");
  const textBlocks = activeBlocks.filter(
    (block) => block.blockType === "rich_text" || block.blockType === "intro"
  );
  const symbolBlocks = activeBlocks.filter((block) => block.blockType === "symbol");
  const gridBlocks = activeBlocks.filter(
    (block) => !["hero", "faq", "rich_text", "intro", "form", "office", "cta"].includes(block.blockType)
  );

  const paragraphs = textBlocks.map((block) => block.description || "").filter(Boolean);
  const heading = textBlocks[0]?.title || section.title || fallbackSection?.heading || anchor;

  const capabilityGrid = symbolBlocks.length
    ? undefined
    : gridBlocks.length > 0
      ? gridBlocks.map((block) => ({
          icon: block.icon || "Circle",
          image: block.image || undefined,
          title: block.title || "",
          description: block.description || "",
          linkLabel: block.linkLabel || undefined,
          linkHref: block.linkUrl || undefined,
        }))
      : fallbackSection?.capabilityGrid;

  const symbolGrid =
    symbolBlocks.length > 0
      ? symbolBlocks.map((block) => ({
          icon: block.icon || "Circle",
          title: block.title || "",
          description: block.description || "",
        }))
      : fallbackSection?.symbolGrid;

  const settings =
    typeof section.settingsJson === "object" && section.settingsJson !== null
      ? (section.settingsJson as Record<string, unknown>)
      : {};

  const calloutText = (settings.calloutText as string) || fallbackSection?.callout?.text;
  const callout = calloutText ? { text: calloutText } : undefined;

  const nextSection = {
    id: anchor,
    heading,
    paragraphs: paragraphs.length > 0 ? paragraphs : fallbackSection?.paragraphs,
    capabilityGrid,
    symbolGrid,
    callout,
  };

  if (
    !nextSection.heading &&
    !nextSection.paragraphs?.length &&
    !nextSection.capabilityGrid?.length &&
    !nextSection.symbolGrid?.length
  ) {
    return null;
  }

  return nextSection;
}

interface CmsDetailPageRendererProps {
  page: CmsPage | null;
  fallbackContent?: DetailPageContent;
  breadcrumbLabel: string;
  heroImageOverride?: string;
  fallbackRender?: ReactNode;
}

const emptyFallbackContent: DetailPageContent = {
  slug: "",
  title: "",
  kicker: "",
  lede: "",
  heroImage: "",
  subnav: [],
  sections: [],
  faqs: [],
  seo: {
    title: "",
    description: "",
  },
};

export function CmsDetailPageRenderer({
  page,
  fallbackContent = emptyFallbackContent,
  breadcrumbLabel,
  heroImageOverride,
  fallbackRender,
}: CmsDetailPageRendererProps) {
  const fallback = fallbackRender ?? <DetailPageTemplate content={fallbackContent} breadcrumbLabel={breadcrumbLabel} />;

  if (!page?.sections?.length) {
    return <>{fallback}</>;
  }

  const sortedSections = [...page.sections]
    .filter((s) => s.status !== "INACTIVE")
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const hero = buildHero(page, fallbackContent, breadcrumbLabel, heroImageOverride);

  let hasRenderedHero = false;

  const renderedSections = sortedSections.map((section) => {
    if (section.sectionKey.endsWith(".hero")) {
      if (hasRenderedHero) return null;
      hasRenderedHero = true;
      return (
        <Fragment key={section.id}>
          <PageHero {...hero} />
        </Fragment>
      );
    }

    if (section.sectionKey.endsWith(".faqs")) {
      return <FaqAccordion key={section.id} items={buildFaqs(section, fallbackContent)} />;
    }

    const transformedSection = buildDetailSection(section, fallbackContent);
    return transformedSection ? <DetailSection key={section.id} section={transformedSection} /> : null;
  });

  if (!hasRenderedHero) {
    renderedSections.unshift(
      <Fragment key="page-hero">
        <PageHero {...hero} />
      </Fragment>
    );
  }

  const hasVisibleSections = renderedSections.some(Boolean);
  if (!hasVisibleSections) {
    return <>{fallback}</>;
  }

  return <>{renderedSections}</>;
}

export function buildFallbackDetailRender(content: DetailPageContent, breadcrumbLabel: string) {
  return <DetailPageTemplate content={content} breadcrumbLabel={breadcrumbLabel} />;
}
