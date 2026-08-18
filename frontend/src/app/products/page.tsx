import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsListingClient } from "@/components/sections/ProductsListingClient";
import { fetchCmsPageByKey } from "@/lib/cmsPage";
import { buildCmsMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("products", seoData.products, "/products");
}

export default async function ProductsPage() {
  const cmsPage = await fetchCmsPageByKey("products");
  return (
    <Suspense fallback={null}>
      <ProductsListingClient cmsPage={cmsPage} />
    </Suspense>
  );
}
