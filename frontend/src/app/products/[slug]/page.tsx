import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Share2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { ProductInfoAccordion } from "@/components/sections/ProductInfoAccordion";
import { BulkOrderPanel } from "@/components/sections/BulkOrderPanel";
import { SimpleInquiryPanel } from "@/components/sections/SimpleInquiryPanel";
import { VariantConfigurator } from "@/components/product/VariantConfigurator";
import { BundleSection } from "@/components/sections/BundleSection";
import { RecentlySeenSection } from "@/components/sections/RecentlySeenSection";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { buildMetadata } from "@/lib/seo";
import productsData from "@/data/products.json";
import homeContent from "@/data/home.json";
import type { ProductDetail } from "@/types/product.types";
import type { ApiProductDetail } from "@/types/api.types";

export const revalidate = 300;

const staticProducts = productsData as ProductDetail[];
const API_ORIGIN = process.env.API_BASE_URL
  ?? (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "")
    : "http://localhost:4000");

async function fetchProductFromApi(slug: string): Promise<ApiProductDetail | null> {
  try {
    const language = (await cookies()).get("language")?.value;
    const query = language ? `?lang=${encodeURIComponent(language)}` : "";
    const res = await fetch(`${API_ORIGIN}/api/products/${slug}${query}`, {
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json.data ?? null;
  } catch {
    return null;
  }
}

async function fetchSlugsFromApi(): Promise<string[]> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/products?limit=500`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = await res.json();
    return (json.data?.data ?? []).map((p: { slug: string }) => p.slug);
  } catch {
    return [];
  }
}

function formatMoney(symbol: string, amount: number | null | undefined) {
  if (amount === null || amount === undefined) return "";
  return `${symbol}${Math.round(amount).toLocaleString("en-IN")}`;
}

function getPublicPrice(apiProduct?: ApiProductDetail | null) {
  if (!apiProduct) return null;
  return apiProduct.prices?.[0] ?? apiProduct.variants?.[0]?.prices?.[0] ?? null;
}

function getPublicDiscount(price?: ApiProductPrice | null) {
  if (!price || price.mrp <= price.sellingPrice) return null;
  const amount = price.mrp - price.sellingPrice;
  const percent = Math.round((amount / price.mrp) * 100);
  return { amount, percent };
}

function mergeProduct(api: ApiProductDetail, staticProduct: ProductDetail | undefined): ProductDetail {
  const apiImages = api.images
    .map((img) => (typeof img === "string" ? img : img.url))
    .map((url) => url.trim())
    .filter(Boolean);

  return {
    slug: api.slug,
    title: api.title,
    category: api.category.name,
    categorySlug: api.category.slug,
    productCode: api.productCode ?? staticProduct?.productCode ?? "",
    images: apiImages,
    information: api.shortDescription ?? staticProduct?.information ?? "",
    tagline: staticProduct?.tagline,
    highlights: api.highlights ?? staticProduct?.highlights ?? [],
    technicalSpecs: api.technicalSpecs ?? staticProduct?.technicalSpecs ?? [],
    warranty: api.warranty ?? staticProduct?.warranty ?? [],
    primaryFeatures: api.primaryFeatures ?? staticProduct?.primaryFeatures ?? [],
    prescriptionOptions: staticProduct?.prescriptionOptions,
    slotOptions: staticProduct?.slotOptions,
    packagingOptions: staticProduct?.packagingOptions,
    discountTiers: staticProduct?.discountTiers,
    catalogueUrl: staticProduct?.catalogueUrl ?? "#",
    bundle: staticProduct?.bundle ?? [],
    seo: {
      title: api.seoTitle ?? staticProduct?.seo?.title ?? api.title,
      description: api.seoDescription ?? staticProduct?.seo?.description ?? api.shortDescription ?? "",
      keywords: api.seoKeywords ? api.seoKeywords.split(",").map((s) => s.trim()) : staticProduct?.seo?.keywords,
    },
  };
}

export async function generateStaticParams() {
  const apiSlugs = await fetchSlugsFromApi();
  const allSlugs = new Set([...staticProducts.map((p) => p.slug), ...apiSlugs]);
  return Array.from(allSlugs).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const staticProduct = staticProducts.find((p) => p.slug === slug);
  const apiProduct = await fetchProductFromApi(slug);

  if (!apiProduct && !staticProduct) return {};
  const product = apiProduct ? mergeProduct(apiProduct, staticProduct) : staticProduct!;
  return buildMetadata(product.seo, `/products/${product.slug}`);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const staticProduct = staticProducts.find((p) => p.slug === slug);
  const apiProduct = await fetchProductFromApi(slug);

  if (!apiProduct && !staticProduct) notFound();

  const publicPrice = apiProduct ? getPublicPrice(apiProduct) : null;
  const publicDiscount = getPublicDiscount(publicPrice);
  const product = apiProduct ? mergeProduct(apiProduct, staticProduct) : staticProduct!;
  const recentlySeen = staticProducts.filter((p) => p.slug !== slug);

  return (
    <>
      <section className="pt-6.5">
        <Container>
          <nav className="mb-6.5 text-[13px] text-steel-2">
            <Link href="/" className="hover:text-brand">
              Home
            </Link>{" "}
            /{" "}
            <Link href="/products" className="hover:text-brand">
              Products
            </Link>{" "}
            /{" "}
            <Link href={`/products?category=${product.categorySlug}`} className="hover:text-brand">
              {product.category}
            </Link>{" "}
            / {product.title}
          </nav>

          <div className="mb-8.5 flex items-center justify-between border-b border-line pb-4.5">
            <h6 className="text-[14.5px] font-medium text-ink">{product.title}</h6>
            <button aria-label="Share" className="text-steel">
              <Share2 size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-9 border-b border-line pb-12 sm:grid-cols-[1.1fr_1fr]">
            <ProductGallery images={product.images} title={product.title} />

            <div>
              <h1 className="mb-3 text-[30px] font-normal tracking-tight text-ink">{product.title}</h1>
              {publicPrice ? (
                <div className="mb-5">
                  <p className="text-[22px] font-semibold text-ink">{formatMoney(publicPrice.currencySymbol, publicPrice.sellingPrice)}</p>
                  {publicDiscount ? (
                    <p className="text-[13px] text-steel-2">
                      {formatMoney(publicPrice.currencySymbol, publicPrice.mrp)} list price · {publicDiscount.percent}% off
                    </p>
                  ) : null}
                </div>
              ) : null}

              <div>
                <span className="mb-2 block text-xs uppercase tracking-wide text-steel-2">Information</span>
                <p className="text-[14.5px] leading-relaxed text-steel">{product.information}</p>
                <span className="mt-4 block text-xs uppercase tracking-wide text-steel-2">Product Code: {product.productCode}</span>
              </div>

              <ProductInfoAccordion product={product} />
            </div>
          </div>

          {/* Variant PDP uses the premium configurator. Spreadsheet ordering lives in /quick-order. */}
          {apiProduct && apiProduct.variants.length > 0 ? (
            <VariantConfigurator apiProduct={apiProduct} />
          ) : product.prescriptionOptions && product.slotOptions && product.packagingOptions && product.discountTiers ? (
            <BulkOrderPanel product={product as Required<typeof product>} productId={apiProduct?.id} />
          ) : (
            <SimpleInquiryPanel product={product} productId={apiProduct?.id} />
          )}
        </Container>
      </section>

      <BundleSection product={product} />
      <RecentlySeenSection products={recentlySeen} />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
