import type { SeoEntry } from "@/types/common.types";

interface SeoWrapperProps {
  seo: SeoEntry;
  type?: "WebPage" | "Product" | "Organization";
  extra?: Record<string, unknown>;
}

/**
 * Renders JSON-LD structured data for a page. Page-level <title>/<meta> tags
 * are handled by Next.js `generateMetadata`/`metadata` exports via
 * `lib/seo.ts#buildMetadata` — this wrapper covers the structured-data half
 * of SEO so rich results (breadcrumbs, product info) stay data-driven too.
 */
export function SeoWrapper({ seo, type = "WebPage", extra }: SeoWrapperProps) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": type,
    name: seo.title,
    description: seo.description,
    ...extra,
  };

  return (
    <script
      type="application/ld+json"
      // eslint-disable-next-line react/no-danger
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  );
}
