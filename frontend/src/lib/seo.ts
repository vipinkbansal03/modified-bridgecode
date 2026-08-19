import type { Metadata } from "next";
import type { SeoEntry } from "@/types/common.types";
import seoData from "@/data/seo.json";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

export type CmsSeoPayload = {
  title?: string | null;
  slug?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  robotsTag?: string | null;
  canonicalUrl?: string | null;
  favicon?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
};

/** Resolves the master base URL dynamically from settings or environment without hardcoding. */
export function resolveBaseUrl(globalSettings?: any): string {
  const candidate =
    globalSettings?.seo?.canonicalDomain?.trim() ||
    globalSettings?.general?.siteUrl?.trim() ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    "https://modortho.com";
  return candidate.replace(/\/+$/, "");
}

/** Resolves a canonical URL safely, preserving explicit absolute URLs and normalizing relative paths. */
export function resolveCanonicalUrl(pageCanonical?: string | null, path = "", baseUrl = ""): string {
  const trimmed = pageCanonical?.trim();
  if (trimmed && (trimmed.startsWith("http://") || trimmed.startsWith("https://"))) {
    return trimmed;
  }
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, "") : resolveBaseUrl();
  if (trimmed) {
    const cleanRelative = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
    return `${cleanBase}${cleanRelative}`;
  }
  const cleanPath = path ? (path.startsWith("/") ? path : `/${path}`) : "";
  return `${cleanBase}${cleanPath}`;
}

/** Resolves an absolute image or asset URL for social metadata scrapers. */
export function resolveAbsoluteUrl(url?: string | null, baseUrl = ""): string | undefined {
  if (!url) return undefined;
  const trimmed = url.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
    return trimmed;
  }
  const cleanBase = baseUrl ? baseUrl.replace(/\/+$/, "") : resolveBaseUrl();
  const cleanPath = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  return `${cleanBase}${cleanPath}`;
}

/** Builds a Next.js Metadata object from a static or fallback SEO entry. */
export function buildMetadata(entry: SeoEntry, path = "", globalSettings?: any): Metadata {
  const baseUrl = resolveBaseUrl(globalSettings);
  const rawOgImage = entry.ogImage || globalSettings?.seo?.ogImage || seoData.defaultOgImage;
  const ogImage = resolveAbsoluteUrl(rawOgImage, baseUrl);
  const canonical = resolveCanonicalUrl(entry.canonical, path, baseUrl);
  const siteName = globalSettings?.general?.siteName || seoData.siteName || "Modern Orthodontics";
  const title = entry.title || globalSettings?.seo?.defaultTitle || siteName;
  const description = entry.description || globalSettings?.seo?.defaultDescription || "";
  const keywords = entry.keywords || (globalSettings?.seo?.defaultKeywords ? globalSettings.seo.defaultKeywords.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined);

  return {
    title,
    description,
    keywords,
    alternates: { canonical },
    robots: entry.robots || "index,follow",
    openGraph: {
      title,
      description,
      url: canonical,
      siteName,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

/**
 * Builds metadata with strict 3-tier precedence:
 * Tier 1: Page-Specific CMS / Product SEO
 * Tier 2: Global Admin Settings (Admin > Settings > SEO)
 * Tier 3: Static seo.json Fallback
 */
export async function buildCmsMetadata(pageKey: string, fallback: SeoEntry, path = ""): Promise<Metadata> {
  try {
    const [pageRes, globalRes] = await Promise.allSettled([
      fetch(`${API_BASE}/cms/pages/key/${pageKey}`, { next: { revalidate: 60 } }),
      fetch(`${API_BASE}/settings/public/tracking`, { next: { revalidate: 60 } }),
    ]);

    let page: CmsSeoPayload | undefined;
    if (pageRes.status === "fulfilled" && pageRes.value.ok) {
      const payload = await pageRes.value.json();
      page = payload?.data;
    }

    let globalSettings: any;
    if (globalRes.status === "fulfilled" && globalRes.value.ok) {
      const payload = await globalRes.value.json();
      globalSettings = payload?.data;
    }

    const baseUrl = resolveBaseUrl(globalSettings);
    const siteName = globalSettings?.general?.siteName || seoData.siteName || "Modern Orthodontics";
    const globalFavicon = globalSettings?.general?.faviconUrl || null;

    // ─── 3-Tier Precedence Resolution ───
    const title =
      page?.seoTitle?.trim() ||
      fallback?.title?.trim() ||
      globalSettings?.seo?.defaultTitle?.trim() ||
      page?.title?.trim() ||
      siteName;

    const description =
      page?.seoDescription?.trim() ||
      fallback?.description?.trim() ||
      globalSettings?.seo?.defaultDescription?.trim() ||
      "";

    const rawKeywords =
      (page?.seoKeywords?.trim()
        ? page.seoKeywords.split(",").map((item) => item.trim()).filter(Boolean)
        : undefined) ||
      (fallback?.keywords && fallback.keywords.length > 0
        ? fallback.keywords
        : undefined) ||
      (globalSettings?.seo?.defaultKeywords?.trim()
        ? globalSettings.seo.defaultKeywords.split(",").map((item: string) => item.trim()).filter(Boolean)
        : undefined);

    const canonical = resolveCanonicalUrl(page?.canonicalUrl || fallback?.canonical, path, baseUrl);

    const ogTitle =
      page?.ogTitle?.trim() ||
      globalSettings?.seo?.ogTitle?.trim() ||
      title;

    const ogDescription =
      page?.ogDescription?.trim() ||
      globalSettings?.seo?.ogDescription?.trim() ||
      description;

    const rawOgImage =
      page?.ogImage?.trim() ||
      globalSettings?.seo?.ogImage?.trim() ||
      fallback?.ogImage?.trim() ||
      seoData.defaultOgImage;
    const ogImage = resolveAbsoluteUrl(rawOgImage, baseUrl);

    const twitterTitle =
      page?.twitterTitle?.trim() ||
      ogTitle;

    const twitterDescription =
      page?.twitterDescription?.trim() ||
      ogDescription;

    const rawTwitterImage =
      page?.twitterImage?.trim() ||
      globalSettings?.seo?.twitterImage?.trim() ||
      rawOgImage;
    const twitterImage = resolveAbsoluteUrl(rawTwitterImage, baseUrl);

    const favicon = page?.favicon?.trim() || globalFavicon;
    const resolvedFavicon = resolveAbsoluteUrl(favicon, baseUrl);

    return {
      title,
      description,
      keywords: rawKeywords,
      alternates: { canonical },
      robots: page?.robotsTag?.trim() || fallback?.robots || "index,follow",
      icons: resolvedFavicon ? { icon: resolvedFavicon, shortcut: resolvedFavicon, apple: resolvedFavicon } : undefined,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: canonical,
        siteName,
        images: ogImage ? [{ url: ogImage }] : undefined,
        type: "website",
      },
      twitter: {
        card: "summary_large_image",
        title: twitterTitle,
        description: twitterDescription,
        images: twitterImage ? [twitterImage] : undefined,
      },
    };
  } catch {
    return buildMetadata(fallback, path);
  }
}
