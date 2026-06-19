import type { Metadata } from "next";
import { Suspense } from "react";
import { ProductsListingClient } from "@/components/sections/ProductsListingClient";
import { buildMetadata } from "@/lib/seo";
import seoData from "@/data/seo.json";

export const metadata: Metadata = buildMetadata(seoData.products, "/products");

export default function ProductsPage() {
  return (
    <Suspense fallback={null}>
      <ProductsListingClient />
    </Suspense>
  );
}
