import type { CmsSection, CmsBlock } from "@/hooks/api/useCmsContent";

function blockData(b: CmsBlock): Record<string, unknown> {
  return typeof b.dataJson === "object" && b.dataJson !== null ? (b.dataJson as Record<string, unknown>) : {};
}

// ── Hero slider ────────────────────────────────────────────────────────────────
export function transformHeroSlides(section: CmsSection) {
  return section.blocks.map((b) => {
    const d = blockData(b);
    return {
      image: (d.image as string) ?? b.image ?? "",
      kicker: b.subtitle ?? (d.kicker as string) ?? "",
      title: b.title ?? "",
      ctaLabel: b.linkLabel ?? (d.ctaLabel as string) ?? "Learn more",
      ctaHref: b.linkUrl ?? (d.ctaHref as string) ?? "/",
    };
  });
}

// ── Stats ──────────────────────────────────────────────────────────────────────
export function transformStats(section: CmsSection) {
  return section.blocks.map((b) => ({
    value: b.title ?? "",
    label: b.subtitle ?? "",
    description: b.description ?? "",
  }));
}

// ── Certifications ─────────────────────────────────────────────────────────────
export function transformCertifications(section: CmsSection) {
  if (!section.blocks || section.blocks.length === 0) return [];
  const activeBlocks = section.blocks.filter((b) => b.status !== "INACTIVE");
  return activeBlocks.map((b) => ({
    title: b.title ?? "",
    description: b.description ?? "",
    icon: b.icon ?? "ShieldCheck",
    image: b.image || "",
    href: b.linkUrl || "/quality-certifications",
    linkLabel: b.linkLabel || "View certificate »",
  }));
}

// ── About intro ────────────────────────────────────────────────────────────────
export function transformAboutIntro(section: CmsSection) {
  if (!section.blocks || section.blocks.length === 0) return null;
  const activeBlocks = section.blocks.filter((b) => b.status !== "INACTIVE");
  if (activeBlocks.length === 0) return null;
  return {
    cards: activeBlocks.map((b) => ({
      title: b.title ?? "",
      image: b.image || "",
      description: b.description ?? "",
      linkText: b.linkLabel || "Read more »",
      linkHref: b.linkUrl || "/about",
    })),
  };
}

// ── Capabilities ───────────────────────────────────────────────────────────────
export function transformCapabilities(section: CmsSection) {
  if (!section.blocks || section.blocks.length === 0) return null;
  const activeBlocks = section.blocks.filter((b) => b.status !== "INACTIVE");
  if (activeBlocks.length === 0) return null;
  return activeBlocks.map((b) => ({
    title: b.title ?? "",
    image: b.image || "",
    description: b.description ?? "",
    linkHref: b.linkUrl || "/",
    linkText: b.linkLabel || "Read more »",
  }));
}

// ── Contact CTA ────────────────────────────────────────────────────────────────
export function transformContactCta(section: CmsSection) {
  const first = section.blocks[0];
  if (!first) return null;
  return {
    title: first.title ?? "",
    description: first.description ?? "",
    ctaLabel: first.linkLabel ?? "Contact us",
    ctaHref: first.linkUrl ?? "/contact",
    image: first.image ?? "",
  };
}

// ── Generic block list (catch-all) ─────────────────────────────────────────────
export function transformBlockList(section: CmsSection) {
  return section.blocks.map((b) => ({
    blockType: b.blockType,
    title: b.title,
    subtitle: b.subtitle,
    description: b.description,
    image: b.image,
    icon: b.icon,
    linkLabel: b.linkLabel,
    linkUrl: b.linkUrl,
    data: blockData(b),
  }));
}
