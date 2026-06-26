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
  return section.blocks.map((b) => ({
    title: b.title ?? "",
    description: b.description ?? "",
    icon: b.icon ?? "",
    href: b.linkUrl ?? "",
  }));
}

// ── About intro ────────────────────────────────────────────────────────────────
export function transformAboutIntro(section: CmsSection) {
  const first = section.blocks[0];
  if (!first) return null;
  return {
    title: first.title ?? section.title ?? "",
    description: first.description ?? "",
    ctaLabel: first.linkLabel ?? "Know more",
    ctaHref: first.linkUrl ?? "/about",
  };
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
