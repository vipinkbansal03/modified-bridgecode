import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsListingClient } from "@/components/sections/ProductsListingClient";
import { buildCmsMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";

export async function generateMetadata(): Promise<Metadata> {
  return buildCmsMetadata("products", seoData.products, "/products");
}

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsListingClient />
    </Suspense>
  );
}
