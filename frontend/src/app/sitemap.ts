import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://modortho.com";
const API_BASE = process.env.API_BASE_URL ?? "http://localhost:4000";

async function getSitemapConfig() {
  try {
    const res = await fetch(`${API_BASE}/api/settings/public/sitemap-config`, { next: { revalidate: 3600 } });
    const json = await res.json();
    return json.data as { includeProducts: boolean; includeCategories: boolean; includeBlogs: boolean; includeCmsPages: boolean };
  } catch {
    return { includeProducts: true, includeCategories: true, includeBlogs: false, includeCmsPages: true };
  }
}

async function getProductSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/products?limit=500&status=ACTIVE`, { next: { revalidate: 3600 } });
    const json = await res.json();
    return (json.data?.data ?? []).map((p: { slug: string }) => p.slug);
  } catch {
    return [];
  }
}

async function getCategorySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/categories`, { next: { revalidate: 3600 } });
    const json = await res.json();
    return (json.data ?? []).map((c: { slug: string }) => c.slug);
  } catch {
    return [];
  }
}

async function getCmsPageSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/cms/pages/key/home`, { next: { revalidate: 3600 } });
    // Just return known public page slugs from CMS if available
    return [];
  } catch {
    return [];
  }
}

const staticPages = [
  { url: "/", priority: 1.0, changeFrequency: "weekly" as const },
  { url: "/products", priority: 0.9, changeFrequency: "daily" as const },
  { url: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
  { url: "/manufacturing-services", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/oem-services", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/design-and-engineering", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/custom-packaging", priority: 0.6, changeFrequency: "monthly" as const },
  { url: "/quality-certifications", priority: 0.7, changeFrequency: "monthly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [config, productSlugs, categorySlugs] = await Promise.all([getSitemapConfig(), getProductSlugs(), getCategorySlugs()]);

  const urls: MetadataRoute.Sitemap = staticPages.map((p) => ({
    url: `${SITE_URL}${p.url}`,
    priority: p.priority,
    changeFrequency: p.changeFrequency,
    lastModified: new Date(),
  }));

  if (config.includeProducts) {
    productSlugs.forEach((slug) => {
      urls.push({ url: `${SITE_URL}/products/${slug}`, changeFrequency: "weekly", priority: 0.8, lastModified: new Date() });
    });
  }

  if (config.includeCategories) {
    categorySlugs.forEach((slug) => {
      urls.push({ url: `${SITE_URL}/products?category=${slug}`, changeFrequency: "weekly", priority: 0.7, lastModified: new Date() });
    });
  }

  return urls;
}
