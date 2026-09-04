import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ProductGallery } from "@/components/sections/ProductGallery";
import { ProductTabs } from "@/components/sections/ProductTabs";
import { ProductFeedbackSection } from "@/components/sections/ProductFeedbackSection";
import { ProductHeaderRating } from "@/components/product/ProductHeaderRating";
import { SimpleInquiryPanel } from "@/components/sections/SimpleInquiryPanel";
import { VariantConfigurator } from "@/components/product/VariantConfigurator";
import { BaseProductConfigurator } from "@/components/product/BaseProductConfigurator";
import { BundleSection } from "@/components/sections/BundleSection";
import { RecentlySeenSection } from "@/components/sections/RecentlySeenSection";
import { ContactCTASection } from "@/components/sections/ContactCTASection";
import { WishlistButton } from "@/components/product/WishlistButton";
import { ShareButton } from "@/components/product/ShareButton";

import { ViewSpecsLink } from "@/components/product/ViewSpecsLink";
import { DownloadCatalogueButton } from "@/components/product/DownloadCatalogueButton";
import { ConfigureButton } from "@/components/product/ConfigureButton";
import { buildMetadata } from "@/lib/seo";
import homeContent from "@/data/home.json";
import productsData from "@/data/products.json";
import type { ProductDetail } from "@/types/product.types";
import type { ApiProductDetail, ApiProductPrice } from "@/types/api.types";

export const dynamic = "force-dynamic";

const API_ORIGIN =
  process.env.API_BASE_URL ??
  (process.env.NEXT_PUBLIC_API_URL
    ? process.env.NEXT_PUBLIC_API_URL.replace(/\/api(?:\/admin)?$/, "")
    : "http://localhost:4000");

async function fetchProductFromApi(slug: string): Promise<ApiProductDetail | null> {
  try {
    const cookieStore = await cookies();
    const language = cookieStore.get("language")?.value;
    const countryCode = cookieStore.get("country")?.value?.toUpperCase();

    const queryOptions = [
      { lang: language, countryCode },
      { lang: undefined, countryCode },
      { lang: language, countryCode: undefined },
      { lang: undefined, countryCode: undefined },
    ];

    const tried = new Set<string>();
    for (const option of queryOptions) {
      const params = new URLSearchParams();
      if (option.lang) params.set("lang", option.lang);
      if (option.countryCode) params.set("countryCode", option.countryCode);
      const query = params.toString();
      if (tried.has(query)) continue;
      tried.add(query);

      const res = await fetch(`${API_ORIGIN}/api/products/${slug}${query ? `?${query}` : ""}`, {
        cache: "no-store",
      });
      if (!res.ok) continue;
      const json = await res.json();
      if (json.data) return json.data;
    }

    return null;
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
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return "";
  const val = Number(amount);
  const hasDecimals = Math.abs(val % 1) > 0.001;
  const formatted = val.toLocaleString("en-US", {
    minimumFractionDigits: hasDecimals ? 2 : 0,
    maximumFractionDigits: 2,
  });
  return `${symbol}${formatted}`;
}

function getPublicPrice(apiProduct?: ApiProductDetail | null) {
  if (!apiProduct) return null;
  const hasVariants = Boolean(apiProduct.hasVariants && (apiProduct.variants?.length ?? 0) > 0);
  if (!hasVariants) {
    return apiProduct.prices?.[0] ?? apiProduct.lowestPrice?.[0] ?? null;
  }
  return (
    apiProduct.lowestPrice?.[0] ??
    apiProduct.variants?.[0]?.prices?.[0] ??
    apiProduct.prices?.[0] ??
    null
  );
}

function getPublicDiscount(price?: ApiProductPrice | null) {
  if (!price || price.mrp <= price.sellingPrice) return null;
  const amount = price.mrp - price.sellingPrice;
  const percent = Math.round((amount / price.mrp) * 100);
  return { amount, percent };
}

function mergeProduct(api: ApiProductDetail): ProductDetail {
  const normalizeUrl = (url?: string | null) => {
    if (!url) return undefined;
    let trimmed = url.trim();
    if (!trimmed) return undefined;
    // Replace full http://localhost:4000/uploads/ or http://127.0.0.1:4000/uploads/ with /uploads/
    trimmed = trimmed.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):4000(\/uploads\/)/i, "$1");
    if (trimmed.startsWith("/")) return trimmed;
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) return trimmed;
    if (trimmed.startsWith("data:")) return trimmed;
    return `/${trimmed}`;
  };

  const apiImages = (api.images || [])
    .map((img) => (typeof img === "string" ? img : img.url))
    .map((url) => normalizeUrl(url) || "")
    .filter(Boolean);

  const resolveUrl = (url?: string | null) => normalizeUrl(url);

  return {
    slug: api.slug,
    title: api.title,
    category: api.category?.name ?? "",
    categorySlug: api.category?.slug ?? "",
    productCode: api.productCode ?? "",
    images: apiImages,
    information: api.shortDescription ?? "",
    informationImage: resolveUrl(api.informationImage),
    informationDescription: api.informationDescription ?? undefined,
    tagline: api.shortDescription || undefined,
    highlights: api.highlights ?? [],
    technicalSpecs: api.technicalSpecs ?? [],
    warranty: api.warranty ?? [],
    primaryFeatures: api.primaryFeatures ?? [],
    additionalInfo: api.additionalInfo ?? [],
    prescriptionOptions: undefined,
    slotOptions: undefined,
    packagingOptions: undefined,
    discountTiers: undefined,
    catalogueUrl: (api as any).documents?.[0]?.url || undefined,
    bundle: [],
    seo: {
      title: api.seoTitle ?? api.title,
      description: api.seoDescription ?? api.shortDescription ?? "",
      keywords: typeof api.seoKeywords === "string" ? api.seoKeywords.split(",").map((s) => s.trim()).filter(Boolean) : Array.isArray(api.seoKeywords) ? (api.seoKeywords as string[]).map(String) : [],
    },
  };
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const apiProduct = await fetchProductFromApi(slug);

  if (!apiProduct) return {};
  const product = mergeProduct(apiProduct);
  return buildMetadata(product.seo, `/products/${product.slug}`);
}

export default async function ProductDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const apiProduct = await fetchProductFromApi(slug);

  if (!apiProduct) notFound();

  const publicPrice = getPublicPrice(apiProduct);
  const publicDiscount = getPublicDiscount(publicPrice);
  const product = mergeProduct(apiProduct);
  const hasVariants = Boolean(apiProduct.hasVariants && (apiProduct.variants?.length ?? 0) > 0);

  return (
    <>
      <section className="pt-6 lg:pt-8.5 pb-4">
        <Container>
          {/* Breadcrumbs */}
          <nav className="mb-3 text-[13px] text-steel-2">
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

          <div className="mb-6 flex items-center justify-between border-b border-line pb-3">

            <h6 className="text-[14.5px] font-medium text-ink">{product.title}</h6>
            <div className="flex items-center gap-3">
              {apiProduct?.id && <WishlistButton productId={apiProduct.id} />}
              <ShareButton title={product.title} />
            </div>
          </div>

          {/* Top Fold: Gallery Left, Header & Description Right */}
          <div className="grid grid-cols-1 gap-8 border-b border-line pb-8 sm:grid-cols-[1.1fr_1fr] items-start">
            <ProductGallery images={product.images} title={product.title} />

            <div>
              <h1 className="mb-2 text-[28px] font-normal tracking-tight text-ink sm:text-[32px]">{product.title}</h1>

              {product.informationImage || product.informationDescription ? (
                <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center">
                  {product.informationImage ? (
                    <img
                      src={product.informationImage}
                      alt={product.informationDescription || product.title}
                      className="max-h-24 w-auto max-w-full shrink-0 object-contain sm:max-w-[260px]"
                    />
                  ) : null}
                  {product.informationDescription ? (
                    <p className="max-w-2xl text-[13.5px] leading-relaxed text-steel sm:pt-0.5">
                      {product.informationDescription}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {/* Rating Header */}
              <div className="mb-4 flex items-center gap-3">
                <ProductHeaderRating slug={product.slug} />
              </div>

              {publicPrice ? (
                <div className="mb-4 space-y-1">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-[13px] font-bold uppercase tracking-wider text-[#6B7280]">Starting at</span>
                    <span className="text-[26px] font-extrabold text-[#E31E24]">
                      {formatMoney(publicPrice.currencySymbol, publicPrice.sellingPrice)}
                    </span>
                    {publicDiscount ? (
                      <span className="rounded-md bg-[#DCFCE7] px-2 py-0.5 text-[12px] font-bold text-[#15803D]">
                        {publicDiscount.percent}% OFF
                      </span>
                    ) : null}
                  </div>

                  {publicDiscount ? (
                    <p className="text-[13px] text-[#6B7280]">
                      M.R.P.: <span className="line-through">{formatMoney(publicPrice.currencySymbol, publicPrice.mrp)}</span>
                    </p>
                  ) : null}

                  {(publicPrice as any)?.taxMode === "EXEMPT" ? (
                    <div className="pt-1">
                      <span className="inline-block rounded bg-[#F3F4F6] px-2 py-0.5 text-[11.5px] font-semibold text-[#374151]">
                        Tax Exempt
                      </span>
                    </div>
                  ) : (publicPrice as any)?.taxMode === "INCLUSIVE" ? (
                    <p className="text-[12px] text-[#6B7280]">Inclusive of all taxes</p>
                  ) : (
                    <p className="text-[12px] text-[#6B7280]">Taxes calculated at checkout</p>
                  )}
                </div>
              ) : (
                <div className="mb-4 flex flex-col gap-1.5">
                  <span className="inline-block w-fit rounded-pill border border-[#E5E7EB] bg-[#F3F4F6] px-3.5 py-1 text-sm font-semibold text-[#E31E24]">
                    Price Upon Request
                  </span>
                  <p className="text-[13px] text-[#6B7280]">
                    Pricing for this region is provided via custom quote.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <span className="mb-1 block text-xs uppercase tracking-wide text-steel-2 font-semibold">Information</span>
                  <p className="text-[14.5px] leading-relaxed text-steel">{product.information}</p>
                </div>
                {product.productCode && (
                  <span className="block text-xs uppercase tracking-wide text-steel-2 font-semibold">
                    Product Code: {product.productCode}
                  </span>
                )}
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <DownloadCatalogueButton catalogueUrl={product.catalogueUrl} title={product.title} />
                  {hasVariants && (
                    <ConfigureButton />
                  )}
                  <ViewSpecsLink />
                </div>
              </div>

              {apiProduct && !hasVariants && (apiProduct.prices?.length ?? 0) > 0 && (
                <div className="mt-8 pt-6 border-t border-line">
                  <BaseProductConfigurator apiProduct={apiProduct} />
                </div>
              )}
            </div>
          </div>

          {/* Variant Configurator Flow (First: Configurator / Matrix / Inquiry) */}
          <div id="configurator-section">
            {hasVariants ? (
              <VariantConfigurator apiProduct={apiProduct} />
            ) : (
              <SimpleInquiryPanel product={product} productId={apiProduct?.id} />
            )}
          </div>

          {/* Full Width Horizontal Tabs Section (Second) */}
          <ProductTabs product={product} apiProduct={apiProduct} />

          {/* Dentalkart Style Feedback Section */}
          <ProductFeedbackSection product={product} />
        </Container>
      </section>

      <BundleSection product={product} />
      <RecentlySeenSection currentSlug={slug} />
      <ContactCTASection data={homeContent.contactCta} />
    </>
  );
}
