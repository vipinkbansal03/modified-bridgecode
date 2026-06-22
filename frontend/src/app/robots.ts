import type { MetadataRoute } from "next";

export default async function robots(): Promise<MetadataRoute.Robots> {
  try {
    const apiBase = process.env.API_BASE_URL ?? "http://localhost:4000";
    const res = await fetch(`${apiBase}/api/settings/public/sitemap-config`, { next: { revalidate: 3600 } });
    const json = await res.json();
    const settings = json.data;
    if (settings?.robotsTxt) {
      // Custom robots.txt is served directly from the backend route
      // Return a permissive default while allowing the backend-served custom one
    }
  } catch { /* fallback */ }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://modortho.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
