import { Fragment, type ReactNode } from "react";
import { ManufacturingSection } from "@/components/sections/ManufacturingSection";
import { DetailPageTemplate } from "@/components/sections/detail/DetailPageTemplate";
import { DetailSection } from "@/components/sections/detail/DetailSection";
import { FaqAccordion } from "@/components/sections/detail/FaqAccordion";
import { PageHero } from "@/components/sections/detail/PageHero";
import { SubNav } from "@/components/sections/detail/SubNav";
import type { CmsBlock, CmsPage, CmsSection } from "@/hooks/api/useCmsContent";
import type { DetailPageContent } from "@/types/common.types";

function sectionAnchor(section: CmsSection) {
  return section.sectionKey.split(".").pop() || section.id;
}

function blockData(block: CmsBlock): Record<string, unknown> {
  return typeof block.dataJson === "object" && block.dataJson !== null ? (block.dataJson as Record<string, unknown>) : {};
}

function firstTextBlock(section: CmsSection) {
  return section.blocks.find((block) => block.blockType === "rich_text" || block.blockType === "intro") ?? section.blocks[0];
}

function buildSubnav(page: CmsPage, fallback: DetailPageContent) {
  const heroBlock = page.sections.find((section) => section.sectionKey.endsWith(".hero"))?.blocks[0];
  const heroData = heroBlock ? blockData(heroBlock) : {};
  const navItems = Array.isArray(heroData.subnav) ? heroData.subnav : null;
  if (navItems && navItems.length > 0) {
    return navItems
      .filter((item): item is { label: string; anchor: string } => !!item && typeof item === "object" && "label" in item && "anchor" in item)
      .map((item) => ({ label: item.label, anchor: item.anchor }));
  }

  const derived = page.sections
    .filter((section) => !section.sectionKey.endsWith(".hero") && !section.sectionKey.endsWith(".faqs"))
    .map((section) => {
      const anchor = sectionAnchor(section);
      const title = firstTextBlock(section)?.title || section.title || anchor;
      return { label: title, anchor };
    });

  return derived.length > 0 ? derived : fallback.subnav;
}

function buildHero(page: CmsPage, fallback: DetailPageContent, breadcrumbLabel: string) {
  const heroSection = page.sections.find((section) => section.sectionKey.endsWith(".hero"));
  const heroBlock = heroSection?.blocks[0];
  const heroData = heroBlock ? blockData(heroBlock) : {};

  return {
    kicker: heroBlock?.subtitle || fallback.kicker,
    title: heroBlock?.title || page.title || fallback.title,
    lede: heroBlock?.description || fallback.lede,
    heroImage: ((heroData.image as string) || heroBlock?.image || fallback.heroImage),
    breadcrumb: [{ label: "Home", href: "/" }, { label: breadcrumbLabel }],
  };
}

function buildFaqs(section: CmsSection, fallback: DetailPageContent) {
  const items = section.blocks
    .filter((block) => block.blockType === "faq")
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
  const textBlocks = section.blocks.filter((block) => block.blockType === "rich_text" || block.blockType === "intro");
  const symbolBlocks = section.blocks.filter((block) => block.blockType === "symbol");
  const gridBlocks = section.blocks.filter((block) => !["hero", "faq", "rich_text", "intro", "form", "office", "cta"].includes(block.blockType));

  const paragraphs = textBlocks.map((block) => block.description || "").filter(Boolean);
  const heading = textBlocks[0]?.title || section.title || fallbackSection?.heading || anchor;

  const capabilityGrid = symbolBlocks.length
    ? undefined
    : gridBlocks.length > 0
      ? gridBlocks.map((block) => ({
          icon: block.icon || "Circle",
          title: block.title || "",
          description: block.description || "",
          linkLabel: block.linkLabel || undefined,
          linkHref: block.linkUrl || undefined,
        }))
      : fallbackSection?.capabilityGrid;

  const symbolGrid = symbolBlocks.length > 0
    ? symbolBlocks.map((block) => ({
        icon: block.icon || "Circle",
        title: block.title || "",
        description: block.description || "",
      }))
    : fallbackSection?.symbolGrid;

  const nextSection = {
    id: anchor,
    heading,
    paragraphs: paragraphs.length > 0 ? paragraphs : fallbackSection?.paragraphs,
    capabilityGrid,
    symbolGrid,
    callout: fallbackSection?.callout,
  };

  if (!nextSection.heading && !nextSection.paragraphs?.length && !nextSection.capabilityGrid?.length && !nextSection.symbolGrid?.length) {
    return null;
  }

  return nextSection;
}

function buildManufacturingTeaser(section: CmsSection, fallback: { kicker: string; heading: string; body: string; image: string }) {
  const block = section.blocks[0];
  return {
    kicker: block?.subtitle || fallback.kicker,
    heading: block?.title || fallback.heading,
    body: block?.description || fallback.body,
    image: block?.image || fallback.image,
  };
}

interface CmsDetailPageRendererProps {
  page: CmsPage | null;
  fallbackContent: DetailPageContent;
  breadcrumbLabel: string;
  fallbackRender: ReactNode;
  manufacturingTeaserFallback?: { kicker: string; heading: string; body: string; image: string };
}

export function CmsDetailPageRenderer({
  page,
  fallbackContent,
  breadcrumbLabel,
  fallbackRender,
  manufacturingTeaserFallback,
}: CmsDetailPageRendererProps) {
  if (!page?.sections?.length) {
    return <>{fallbackRender}</>;
  }

  const hero = buildHero(page, fallbackContent, breadcrumbLabel);
  const subnav = buildSubnav(page, fallbackContent);

  const renderedSections = page.sections.map((section) => {
    if (section.sectionKey.endsWith(".hero")) {
      return (
        <Fragment key={section.id}>
          <PageHero {...hero} />
          <SubNav items={subnav} />
        </Fragment>
      );
    }

    if (section.sectionKey.endsWith(".faqs")) {
      return <FaqAccordion key={section.id} items={buildFaqs(section, fallbackContent)} />;
    }

    if (manufacturingTeaserFallback && section.sectionKey === "manufacturing.teaser") {
      return <ManufacturingSection key={section.id} data={buildManufacturingTeaser(section, manufacturingTeaserFallback)} />;
    }

    const transformedSection = buildDetailSection(section, fallbackContent);
    return transformedSection ? <DetailSection key={section.id} section={transformedSection} /> : null;
  });

  const hasVisibleSections = renderedSections.some(Boolean);
  if (!hasVisibleSections) {
    return <>{fallbackRender}</>;
  }

  return <>{renderedSections}</>;
}

export function buildFallbackDetailRender(content: DetailPageContent, breadcrumbLabel: string) {
  return <DetailPageTemplate content={content} breadcrumbLabel={breadcrumbLabel} />;
}
