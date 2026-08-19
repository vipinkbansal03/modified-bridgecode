import type { MetadataRoute } from "next";

const API_BASE = process.env.API_BASE_URL ?? (process.env.NEXT_PUBLIC_API_URL ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "") : "http://localhost:4000");

function parseRobotsTxt(raw: string, defaultSiteUrl: string): MetadataRoute.Robots {
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const rules: Array<{
    userAgent: string | string[];
    allow?: string[];
    disallow?: string[];
    crawlDelay?: number;
  }> = [];
  const sitemaps: string[] = [];
  let host: string | undefined;

  let currentUserAgents: string[] = [];
  let currentAllow: string[] = [];
  let currentDisallow: string[] = [];
  let currentCrawlDelay: number | undefined;

  function flushCurrent() {
    if (currentUserAgents.length > 0) {
      rules.push({
        userAgent: currentUserAgents.length === 1 ? currentUserAgents[0]! : currentUserAgents,
        ...(currentAllow.length > 0 ? { allow: currentAllow } : {}),
        ...(currentDisallow.length > 0 ? { disallow: currentDisallow } : {}),
        ...(currentCrawlDelay !== undefined ? { crawlDelay: currentCrawlDelay } : {}),
      });
      currentUserAgents = [];
      currentAllow = [];
      currentDisallow = [];
      currentCrawlDelay = undefined;
    }
  }

  for (const line of lines) {
    const colonIndex = line.indexOf(":");
    if (colonIndex === -1) continue;

    const directive = line.slice(0, colonIndex).trim().toLowerCase();
    const value = line.slice(colonIndex + 1).trim();
    if (!value && directive !== "disallow") continue;

    if (directive === "user-agent") {
      if (currentAllow.length > 0 || currentDisallow.length > 0 || currentCrawlDelay !== undefined) {
        flushCurrent();
      }
      currentUserAgents.push(value);
    } else if (directive === "allow") {
      if (currentUserAgents.length === 0) currentUserAgents.push("*");
      currentAllow.push(value);
    } else if (directive === "disallow") {
      if (currentUserAgents.length === 0) currentUserAgents.push("*");
      if (value) currentDisallow.push(value);
    } else if (directive === "crawl-delay") {
      const delay = parseInt(value, 10);
      if (!isNaN(delay)) currentCrawlDelay = delay;
    } else if (directive === "sitemap") {
      sitemaps.push(value);
    } else if (directive === "host") {
      host = value;
    }
  }
  flushCurrent();

  const resolvedSitemap = sitemaps.length > 0 ? (sitemaps.length === 1 ? sitemaps[0] : sitemaps) : `${defaultSiteUrl}/sitemap.xml`;

  return {
    rules: rules.length > 0 ? rules : [{ userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] }],
    sitemap: resolvedSitemap,
    ...(host ? { host } : {}),
  };
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  let siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://modortho.com").replace(/\/+$/, "");

  try {
    const [sitemapRes, trackingRes] = await Promise.allSettled([
      fetch(`${API_BASE}/api/settings/public/sitemap-config`, { next: { revalidate: 60 } }),
      fetch(`${API_BASE}/api/settings/public/tracking`, { next: { revalidate: 60 } }),
    ]);

    let sitemapConfig: any;
    if (sitemapRes.status === "fulfilled" && sitemapRes.value.ok) {
      const json = await sitemapRes.value.json();
      sitemapConfig = json.data;
    }

    if (trackingRes.status === "fulfilled" && trackingRes.value.ok) {
      const json = await trackingRes.value.json();
      const tracking = json.data;
      siteUrl = (tracking?.seo?.canonicalDomain || tracking?.general?.siteUrl || siteUrl).replace(/\/+$/, "");
    }

    if (sitemapConfig?.robotsTxt && typeof sitemapConfig.robotsTxt === "string" && sitemapConfig.robotsTxt.trim()) {
      return parseRobotsTxt(sitemapConfig.robotsTxt.trim(), siteUrl);
    }
  } catch { /* fallback */ }

  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/admin/", "/api/"] },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
