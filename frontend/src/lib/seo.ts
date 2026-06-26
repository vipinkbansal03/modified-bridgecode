import type { Metadata } from "next";
import type { SeoEntry } from "@/types/common.types";
import seoData from "@/data/seo.json";

const SITE_URL = "https://www.modortho.com";
const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000/api";

type CmsSeoPayload = {
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

/** Builds a Next.js Metadata object from a JSON-driven SEO entry. */
export function buildMetadata(entry: SeoEntry, path = ""): Metadata {
  const ogImage = entry.ogImage || seoData.defaultOgImage;
  const canonical = entry.canonical || `${SITE_URL}${path}`;

  return {
    title: entry.title,
    description: entry.description,
    keywords: entry.keywords,
    alternates: { canonical },
    robots: entry.robots || "index,follow",
    openGraph: {
      title: entry.title,
      description: entry.description,
      url: canonical,
      siteName: seoData.siteName,
      images: ogImage ? [{ url: ogImage }] : undefined,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: entry.title,
      description: entry.description,
      images: ogImage ? [ogImage] : undefined,
    },
  };
}

export async function buildCmsMetadata(pageKey: string, fallback: SeoEntry, path = ""): Promise<Metadata> {
  try {
    const response = await fetch(`${API_BASE}/cms/pages/key/${pageKey}`, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      return buildMetadata(fallback, path);
    }

    const payload = await response.json();
    const page = payload?.data as CmsSeoPayload | undefined;
    if (!page) {
      return buildMetadata(fallback, path);
    }

    const canonical = page.canonicalUrl || `${SITE_URL}${path}`;
    const title = page.seoTitle || fallback.title || page.title || "";
    const description = page.seoDescription || fallback.description || "";
    const keywords = page.seoKeywords
      ? page.seoKeywords.split(",").map((item) => item.trim()).filter(Boolean)
      : fallback.keywords;
    const ogTitle = page.ogTitle || title;
    const ogDescription = page.ogDescription || description;
    const ogImage = page.ogImage || fallback.ogImage || seoData.defaultOgImage;
    const twitterTitle = page.twitterTitle || ogTitle;
    const twitterDescription = page.twitterDescription || ogDescription;
    const twitterImage = page.twitterImage || ogImage;

    return {
      title,
      description,
      keywords,
      alternates: { canonical },
      robots: page.robotsTag || fallback.robots || "index,follow",
      icons: page.favicon ? { icon: page.favicon, shortcut: page.favicon, apple: page.favicon } : undefined,
      openGraph: {
        title: ogTitle,
        description: ogDescription,
        url: canonical,
        siteName: seoData.siteName,
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
