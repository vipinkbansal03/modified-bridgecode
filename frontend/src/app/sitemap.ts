import type { MetadataRoute } from "next";

const API_BASE = process.env.API_BASE_URL ?? (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "") : "http://localhost:4000");

const defaultSitemapConfig = {
  includeProducts: true,
  includeCategories: true,
  includeBlogs: false,
  includeCmsPages: true,
};

async function getSitemapConfigAndSiteUrl() {
  let siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://modortho.com").replace(/\/+$/, "");
  let config = defaultSitemapConfig;

  try {
    const [configRes, trackingRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/settings/public/sitemap-config`, { next: { revalidate: 60 } }),
      fetch(`${API_BASE}/api/settings/public/tracking`, { next: { revalidate: 60 } }),
    ]);

    if (configRes.status === "fulfilled" && configRes.value.ok) {
      const json = await configRes.value.json();
      config = json.data ?? defaultSitemapConfig;
    }

    if (trackingRes.status === "fulfilled" && trackingRes.value.ok) {
      const json = await trackingRes.value.json();
      const tracking = json.data;
      siteUrl = (tracking?.seo?.canonicalDomain || tracking?.general?.siteUrl || siteUrl).replace(/\/+$/, "");
    }
  } catch {
    // safe fallback
  }

  return { config, siteUrl };
}

async function getProductSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/products?limit=500&status=ACTIVE`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.data ?? []).map((p: { slug: string }) => p.slug).filter(Boolean);
  } catch {
    return [];
  }
}

async function getCategorySlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/categories`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []).map((c: { slug: string }) => c.slug).filter(Boolean);
  } catch {
    return [];
  }
}

async function getBlogSlugs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE}/api/blogs?limit=500`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.data ?? []).map((b: { slug: string }) => b.slug).filter(Boolean);
  } catch {
    return [];
  }
}

async function getCmsPages(): Promise<Array<{ slug: string; pageKey: string; updatedAt?: string }>> {
  try {
    const res = await fetch(`${API_BASE}/api/cms/pages`, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data ?? []).map((p: any) => ({
      slug: p.slug,
      pageKey: p.pageKey,
      updatedAt: p.updatedAt,
    })).filter((p: any) => p.slug || p.pageKey);
  } catch {
    return [];
  }
}

const staticCoreRoutes = [
  { path: "", priority: 1.0, changeFrequency: "weekly" as const },
  { path: "/products", priority: 0.9, changeFrequency: "daily" as const },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
  { path: "/manufacturing-services", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/oem-services", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/design-and-engineering", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/custom-packaging", priority: 0.6, changeFrequency: "monthly" as const },
  { path: "/quality-certifications", priority: 0.7, changeFrequency: "monthly" as const },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const { config, siteUrl } = await getSitemapConfigAndSiteUrl();

  const [productSlugs, categorySlugs, blogSlugs, cmsPages] = await Promise.all([
    config.includeProducts !== false ? getProductSlugs() : Promise.resolve([]),
    config.includeCategories !== false ? getCategorySlugs() : Promise.resolve([]),
    config.includeBlogs === true ? getBlogSlugs() : Promise.resolve([]),
    config.includeCmsPages !== false ? getCmsPages() : Promise.resolve([]),
  ]);

  const urls: MetadataRoute.Sitemap = [];
  const seenUrls = new Set<string>();

  function addUrl(fullUrl: string, priority: number, changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never", lastModified?: Date | string) {
    const normalized = fullUrl.replace(/\/+$/, "") || fullUrl;
    if (seenUrls.has(normalized)) return;
    seenUrls.add(normalized);
    urls.push({
      url: normalized,
      priority,
      changeFrequency,
      lastModified: lastModified ? new Date(lastModified) : new Date(),
    });
  }

  // 1. CMS Pages & Core static routes (deduplicated)
  if (config.includeCmsPages !== false) {
    // Dynamic CMS pages
    cmsPages.forEach((p) => {
      const isHome = p.pageKey === "home" || p.slug === "home" || p.slug === "/";
      const rawPath = isHome ? "" : (p.slug.startsWith("/") ? p.slug : `/${p.slug}`);
      const fullUrl = `${siteUrl}${rawPath}`;
      addUrl(fullUrl, isHome ? 1.0 : 0.7, "weekly", p.updatedAt);
    });

    // Static core system routes (preserves any not covered by CMS)
    staticCoreRoutes.forEach((route) => {
      const fullUrl = `${siteUrl}${route.path}`;
      addUrl(fullUrl, route.priority, route.changeFrequency);
    });
  } else {
    // Minimal root fallback
    addUrl(`${siteUrl}`, 1.0, "weekly");
  }

  // 2. Products
  if (config.includeProducts !== false) {
    productSlugs.forEach((slug) => {
      const fullUrl = `${siteUrl}/products/${slug.replace(/^\//, "")}`;
      addUrl(fullUrl, 0.8, "weekly");
    });
  }

  // 3. Categories
  if (config.includeCategories !== false) {
    categorySlugs.forEach((slug) => {
      const fullUrl = `${siteUrl}/products?category=${slug.replace(/^\//, "")}`;
      addUrl(fullUrl, 0.7, "weekly");
    });
  }

  // 4. Blogs
  if (config.includeBlogs === true) {
    blogSlugs.forEach((slug) => {
      const fullUrl = `${siteUrl}/blog/${slug.replace(/^\//, "")}`;
      addUrl(fullUrl, 0.7, "weekly");
    });
  }

  return urls;
}
