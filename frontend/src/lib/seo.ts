import type { Metadata } from "next";
import type { SeoEntry } from "@/types/common.types";
import seoData from "@/data/seo.json";

const SITE_URL = "https://www.modortho.com";

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
