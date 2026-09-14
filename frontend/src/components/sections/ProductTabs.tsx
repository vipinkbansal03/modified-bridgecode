"use client";

import { useState, useEffect, useMemo } from "react";
import {
  CheckCircle2,
  ShieldCheck,
  Box,
  FileText,
  Layers,
  Stethoscope,
  Info,
  Star,
  MessageSquareCheck,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Maximize2,
  X,
  ImageIcon,
} from "lucide-react";
import type { ProductDetail } from "@/types/product.types";
import type { ApiProductDetail } from "@/types/api.types";
import { fetchProductReviews } from "@/hooks/api/useProducts";

interface ProductTabsProps {
  product: ProductDetail;
  apiProduct?: ApiProductDetail | null;
}

interface ReviewItem {
  id: string;
  customerName?: string;
  customerEmail?: string;
  ratingQuality: number;
  ratingPrice: number;
  ratingOverall: number;
  feedbackText?: string;
  createdAt: string;
}

function cleanPublicHtml(html: string) {
  if (!html) return "";
  return html
    .replace(/<button[^>]*>[\s\S]*?<\/button>/gi, "")
    .replace(/<span[^>]*class="[^"]*truncate[^"]*"[^>]*>[\s\S]*?<\/span>/gi, "")
    .replace(/✓ Uploaded Image/gi, "")
    .replace(/Remove/gi, "");
}

function isNonEmptyText(text?: string | null): boolean {
  if (!text) return false;
  return text.replace(/<[^>]*>/g, "").replace(/&nbsp;/gi, "").trim().length > 0;
}

function formatRichText(content: string | null | undefined): string {
  if (!content) return "";
  const cleaned = cleanPublicHtml(content);
  if (!cleaned.includes("<p>") && !cleaned.includes("<div") && cleaned.includes("\n")) {
    return cleaned
      .split(/\n\s*\n/)
      .map((para) => `<p>${para.replace(/\n/g, "<br/>")}</p>`)
      .join("");
  }
  return cleaned;
}

export function ProductTabs({ product, apiProduct }: ProductTabsProps) {
  const [activeTab, setActiveTab] = useState<
    "features" | "description" | "packaging" | "specs" | "usage" | "additional" | "warranty" | "reviews"
  >("features");

  const [reviewsData, setReviewsData] = useState<{
    reviews: ReviewItem[];
    averageRating: number;
    totalRatings: number;
  }>(
    {
      reviews: [],
      averageRating: 5.0,
      totalRatings: 0,
    }
  );
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [isEditingInformationImage, setIsEditingInformationImage] = useState(false);
  const [isEditingInformationDescription, setIsEditingInformationDescription] = useState(false);

  const highlightsList = useMemoHighlights(product, apiProduct);
  const specsMap = useMemoSpecs(product, apiProduct);

  const validHighlights = useMemo(
    () => highlightsList.filter((item: { title?: string; description?: string; image?: string }) => isNonEmptyText(item.title) || isNonEmptyText(item.description) || Boolean(item.image)),
    [highlightsList]
  );

  const validPrimaryFeatures = useMemo(
    () => (product.primaryFeatures || []).filter((item: { title?: string; description?: string }) => isNonEmptyText(item.title) || isNonEmptyText(item.description)),
    [product.primaryFeatures]
  );

  const displayedPackages = useMemo(() => {
    return apiProduct?.packages || [];
  }, [apiProduct?.packages]);

  const customInfoList = useMemo(() => {
    const raw = (apiProduct?.additionalInfo || product.additionalInfo) as Array<{ label: string; value: string }> | undefined;
    return Array.isArray(raw) ? raw : [];
  }, [apiProduct?.additionalInfo, product.additionalInfo]);

  const [activeSpecImageIndex, setActiveSpecImageIndex] = useState(0);
  const [isSpecZoomed, setIsSpecZoomed] = useState(false);

  const specImages = useMemo(() => {
    const list: Array<{ url: string; title: string }> = [];

    let rawSpecs = apiProduct?.technicalSpecs ?? product.technicalSpecs;
    if (typeof rawSpecs === "string") {
      try {
        rawSpecs = JSON.parse(rawSpecs);
      } catch {
        // ignore
      }
    }

    const normalizeUrl = (u?: string | null) => {
      if (!u) return "";
      let trimmed = u.trim();
      trimmed = trimmed.replace(/^http:\/\/(?:localhost|127\.0\.0\.1):4000(\/uploads\/)/i, "$1");
      if (trimmed.startsWith("/") || trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("data:")) {
        return trimmed;
      }
      return `/${trimmed}`;
    };

    // 1. Dedicated Specification Diagrams from { images: [...] }
    if (rawSpecs && typeof rawSpecs === "object" && Array.isArray((rawSpecs as any).images)) {
      (rawSpecs as any).images.forEach((img: any, idx: number) => {
        const url = typeof img === "string" ? img : img?.url;
        if (url && typeof url === "string" && url.trim()) {
          const cleanUrl = normalizeUrl(url);
          if (cleanUrl && !list.some((existing) => existing.url === cleanUrl)) {
            list.push({
              url: cleanUrl,
              title: (typeof img === "object" && img.title) || `Specification Diagram ${idx + 1}`,
            });
          }
        }
      });
    }

    // 2. Backwards-compatibility check for array items with image property
    if (Array.isArray(rawSpecs)) {
      rawSpecs.forEach((spec: any, idx: number) => {
        if (spec && typeof spec === "object" && spec.image && typeof spec.image === "string" && spec.image.trim()) {
          const cleanUrl = normalizeUrl(spec.image);
          if (cleanUrl && !list.some((existing) => existing.url === cleanUrl)) {
            list.push({
              url: cleanUrl,
              title: spec.label ? `${spec.label}: ${spec.value || "Diagram"}` : `Specification Diagram ${idx + 1}`,
            });
          }
        }
      });
    }

    return list;
  }, [product, apiProduct]);

  useEffect(() => {
    if (!isSpecZoomed) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsSpecZoomed(false);
      if (e.key === "ArrowLeft") {
        setActiveSpecImageIndex((prev) => (prev === 0 ? specImages.length - 1 : prev - 1));
      }
      if (e.key === "ArrowRight") {
        setActiveSpecImageIndex((prev) => (prev === specImages.length - 1 ? 0 : prev + 1));
      }
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [isSpecZoomed, specImages.length]);

  useEffect(() => {
    async function fetchReviews() {
      setLoadingReviews(true);
      try {
        const data = await fetchProductReviews(product.slug);
        if (data) {
          setReviewsData({
            reviews: (data.reviews as any) || [],
            averageRating: data.averageRating ?? 5.0,
            totalRatings: data.totalRatings ?? 0,
          });
        }
      } catch {
        // Fallback silently
      } finally {
        setLoadingReviews(false);
      }
    }

    fetchReviews();
  }, [product.slug]);

  const tabs = [
    { id: "features", label: "Features", icon: CheckCircle2 },
    { id: "description", label: "Description", icon: FileText },
    { id: "specs", label: "Key Specifications", icon: Layers },
    { id: "usage", label: "Direction To Use", icon: Stethoscope },
    { id: "additional", label: "Additional Info", icon: Info },
    // { id: "warranty", label: "Service & Warranty", icon: ShieldCheck },
    { id: "reviews", label: `Reviews & Feedback (${reviewsData.totalRatings})`, icon: Star },
  ] as const;

  return (
    <section id="product-specifications" className="mt-8 scroll-mt-28 rounded-xl border border-[#E5E7EB] bg-white shadow-2xs overflow-hidden">
      {/* Horizontal Tabs Header Bar */}
      <div className="border-b border-[#E5E7EB] bg-[#FAFAFA] overflow-x-auto scrollbar-none">
        <div className="flex min-w-max items-center px-2">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={`flex items-center gap-1.5 border-b-2 px-4 py-3 text-[13px] font-semibold transition-all ${
                  isActive
                    ? "border-[#E31E24] bg-white text-[#E31E24] shadow-2xs"
                    : "border-transparent text-[#6B7280] hover:border-[#D1D5DB] hover:text-[#1A1A1A]"
                }`}
              >
                <Icon size={15} className={isActive ? "text-[#E31E24]" : "text-[#9CA3AF]"} />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Active Tab Panel Content */}
      <div className="p-5 md:p-6 min-h-[180px]">

        {/* 1. FEATURES TAB */}
        {activeTab === "features" && (
          <div className="space-y-4">
            <h3 className="text-[16px] font-bold text-[#1A1A1A]">Key Features & Advantages</h3>
            {validHighlights.length > 0 ? (
              <div className="columns-1 sm:columns-2 gap-3 space-y-3">
                {validHighlights.map((item, idx) => (
                  <div key={idx} className="break-inside-avoid flex items-start gap-3 rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] p-3.5">
                    {item.image ? (
                      <img src={item.image} alt={item.title} className="h-16 w-16 md:h-20 md:w-20 rounded-lg border border-[#E5E7EB] bg-white p-1 object-contain shrink-0 shadow-2xs" />
                    ) : (
                      <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-[#E31E24]" />
                    )}
                    <div className="flex-1 min-w-0">
                      <strong className="block text-[13.5px] font-bold text-[#1A1A1A]">{item.title}</strong>
                      {item.description && (
                        <div
                          className="mt-1 text-[12.5px] leading-relaxed text-[#6B7280] [&_p]:m-0 [&_p]:my-1 [&_img]:inline-block [&_img]:my-2 [&_img]:max-h-44 [&_img]:md:max-h-52 [&_img]:max-w-full [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-[#E5E7EB] [&_img]:bg-white [&_img]:p-1.5 [&_img]:shadow-2xs [&_img]:align-middle"
                          dangerouslySetInnerHTML={{ __html: cleanPublicHtml(item.description) }}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : apiProduct?.shortDescription ? (
              <div className="rounded-lg border border-[#F3F4F6] bg-[#F9FAFB] p-4 text-[13.5px] text-[#374151] leading-relaxed">
                <p className="font-semibold text-[#1A1A1A] mb-1">{product.title}</p>
                <div dangerouslySetInnerHTML={{ __html: cleanPublicHtml(apiProduct.shortDescription) }} />
              </div>
            ) : (
              <ul className="space-y-2 text-[13.5px] text-[#374151]">
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#E31E24]" /> High-precision medical grade orthodontic material construction.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#E31E24]" /> Engineered for high clinical accuracy and patient comfort.
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 size={15} className="text-[#E31E24]" /> Rigorous ISO 13485 quality control and performance standards.
                </li>
              </ul>
            )}
          </div>
        )}

        {/* 2. DESCRIPTION TAB */}
        {activeTab === "description" && (
          <div className="space-y-3 max-w-4xl">
            <h3 className="text-[16px] font-bold text-[#1A1A1A]">Clinical Product Description</h3>
            <div
              className="text-[14px] leading-relaxed text-[#4B5563] [&_p]:mb-3.5 [&_p:last-child]:mb-0 [&_img]:my-2.5 [&_img]:inline-block [&_img]:max-h-56 [&_img]:max-w-full [&_img]:w-auto [&_img]:rounded-lg [&_img]:border [&_img]:border-[#E5E7EB] [&_img]:bg-white [&_img]:p-1 [&_img]:shadow-xs [&_img]:align-middle"
              dangerouslySetInnerHTML={{
                __html: formatRichText(apiProduct?.description || product.information || "Detailed orthodontic system engineered for high clinical accuracy and patient comfort during active treatment.")
              }}
            />
          </div>
        )}


        {/* 4. KEY SPECIFICATIONS TAB */}
        {activeTab === "specs" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h3 className="text-[16px] font-bold text-[#1A1A1A]">Technical Specifications & Clinical Geometry</h3>
              <span className="text-[12px] font-medium text-[#6B7280] bg-[#F3F4F6] px-2.5 py-1 rounded-md">
                ISO 13485 & CE Precision Engineering
              </span>
            </div>

            <div className="grid grid-cols-1 gap-6 lg:grid-cols-12 items-start">
              {/* Specs Key-Value Table (7 cols on desktop) */}
              <div className={specImages.length > 0 ? "lg:col-span-7 space-y-4" : "lg:col-span-12 space-y-4"}>
                <div className="overflow-hidden rounded-lg border border-[#E5E7EB] bg-white shadow-2xs">
                  <table className="w-full text-left text-[13px]">
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {Object.entries(specsMap).map(([key, val]) => (
                        <tr key={key} className="even:bg-[#F9FAFB] hover:bg-[#F3F4F6]/60 transition-colors">
                          <td className="w-2/5 px-3.5 py-3 font-semibold text-[#374151] bg-[#F3F4F6]/50 border-r border-[#E5E7EB]/50">{key}</td>
                          <td className="px-3.5 py-3 font-medium text-[#1A1A1A]">{String(val)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Additional Spec Notes */}
                <div className="rounded-lg border border-[#E5E7EB] bg-[#FAFAFA] p-3 text-[12.5px] text-[#4B5563] flex items-center gap-2">
                  <Info size={16} className="text-[#E31E24] shrink-0" />
                  <span>All bracket dimensions, slot tolerances (.018 / .022), torque, and angulation parameters adhere to international clinical standards.</span>
                </div>
              </div>

              {/* Technical Specification Image Carousel (5 cols on desktop) */}
              {specImages.length > 0 && (
                <div className="lg:col-span-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-4 shadow-2xs">
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="text-[13px] font-bold text-[#1A1A1A] flex items-center gap-1.5">
                      <Layers size={14} className="text-[#E31E24]" />
                      Specification Diagrams
                    </span>
                    <span className="text-[11.5px] font-semibold text-[#6B7280] bg-white px-2 py-0.5 rounded border border-[#E5E7EB]">
                      {activeSpecImageIndex + 1} / {specImages.length}
                    </span>
                  </div>

                  {/* Main Carousel Slide Display */}
                  <div className="relative flex h-[220px] sm:h-[260px] w-full items-center justify-center overflow-hidden rounded-lg border border-[#E5E7EB] bg-white p-3">
                    {/* Previous Arrow */}
                    {specImages.length > 1 && (
                      <button
                        type="button"
                        aria-label="Previous technical diagram"
                        onClick={() =>
                          setActiveSpecImageIndex((prev) =>
                            prev === 0 ? specImages.length - 1 : prev - 1
                          )
                        }
                        className="absolute left-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1A1A1A] shadow-2xs hover:bg-white hover:scale-105 transition-all"
                      >
                        <ChevronLeft size={16} />
                      </button>
                    )}

                    {/* Image Preview with Zoom */}
                    <div
                      role="button"
                      tabIndex={0}
                      aria-label="Zoom technical specification image"
                      onClick={() => setIsSpecZoomed(true)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") setIsSpecZoomed(true);
                      }}
                      className="group relative flex h-full w-full cursor-zoom-in items-center justify-center"
                    >
                      <img
                        src={specImages[activeSpecImageIndex]?.url}
                        alt={specImages[activeSpecImageIndex]?.title || "Technical specification diagram"}
                        className="h-full w-full object-contain transition-transform duration-300 group-hover:scale-105"
                      />
                      <span className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md bg-black/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur-xs opacity-80 group-hover:opacity-100 transition-opacity">
                        <Maximize2 size={12} />
                        Click to zoom
                      </span>
                    </div>

                    {/* Next Arrow */}
                    {specImages.length > 1 && (
                      <button
                        type="button"
                        aria-label="Next technical diagram"
                        onClick={() =>
                          setActiveSpecImageIndex((prev) =>
                            prev === specImages.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="absolute right-2 top-1/2 z-10 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-[#E5E7EB] bg-white/90 text-[#1A1A1A] shadow-2xs hover:bg-white hover:scale-105 transition-all"
                      >
                        <ChevronRight size={16} />
                      </button>
                    )}
                  </div>

                  {/* Caption */}
                  <p className="mt-2 text-center text-[12px] font-medium text-[#4B5563] truncate">
                    {specImages[activeSpecImageIndex]?.title}
                  </p>

                  {/* Thumbnail Selector Bar */}
                  {specImages.length > 1 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-1 custom-scrollbar-x justify-center">
                      {specImages.map((item, idx) => (
                        <button
                          key={`${item.url}-${idx}`}
                          type="button"
                          onClick={() => setActiveSpecImageIndex(idx)}
                          className={`relative h-12 w-12 flex-none overflow-hidden rounded-md border p-1 bg-white transition-all ${
                            activeSpecImageIndex === idx
                              ? "border-[#E31E24] shadow-2xs scale-105 ring-1 ring-[#E31E24]"
                              : "border-[#E5E7EB] opacity-70 hover:opacity-100"
                          }`}
                        >
                          <img
                            src={item.url}
                            alt={`Thumbnail ${idx + 1}`}
                            className="h-full w-full object-contain"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fullscreen Lightbox Modal for Technical Spec Diagrams */}
            {isSpecZoomed && (
              <div
                role="dialog"
                aria-modal="true"
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-xs"
                onClick={() => setIsSpecZoomed(false)}
              >
                <div
                  className="relative flex max-h-[90vh] max-w-[90vw] flex-col items-center justify-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    aria-label="Close zoomed view"
                    onClick={() => setIsSpecZoomed(false)}
                    className="absolute -top-10 right-0 flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white hover:bg-white/40 transition-all cursor-pointer"
                  >
                    <X size={20} />
                  </button>

                  <img
                    src={specImages[activeSpecImageIndex]?.url}
                    alt={specImages[activeSpecImageIndex]?.title || "Technical specification diagram"}
                    className="max-h-[80vh] max-w-[85vw] rounded-lg bg-white p-4 object-contain shadow-2xl"
                  />

                  <div className="mt-3 flex items-center gap-4 text-white">
                    {specImages.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSpecImageIndex((prev) =>
                            prev === 0 ? specImages.length - 1 : prev - 1
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 cursor-pointer"
                      >
                        <ChevronLeft size={18} />
                      </button>
                    )}
                    <span className="text-xs font-semibold">
                      {specImages[activeSpecImageIndex]?.title} ({activeSpecImageIndex + 1} / {specImages.length})
                    </span>
                    {specImages.length > 1 && (
                      <button
                        type="button"
                        onClick={() =>
                          setActiveSpecImageIndex((prev) =>
                            prev === specImages.length - 1 ? 0 : prev + 1
                          )
                        }
                        className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 hover:bg-white/40 cursor-pointer"
                      >
                        <ChevronRight size={18} />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. DIRECTION TO USE TAB */}
        {activeTab === "usage" && (
          <div className="space-y-3 max-w-4xl">
            <h3 className="text-[16px] font-bold text-[#1A1A1A]">Direction To Use & Clinical Guidelines</h3>
            {validPrimaryFeatures.length > 0 ? (
              <ol className="space-y-2.5 text-[13.5px] text-[#374151]">
                {validPrimaryFeatures.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2.5">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E31E24] text-[11px] font-bold text-white">
                      {idx + 1}
                    </span>
                    <div>
                      <strong className="font-bold text-[#1A1A1A]">{item.title}</strong>
                      {item.description && (
                        <div
                          className="mt-0.5 text-[13px] leading-relaxed text-[#6B7280] [&_p]:m-0 [&_p]:my-0.5 [&_img]:inline-block [&_img]:my-2 [&_img]:max-h-44 [&_img]:max-w-full [&_img]:rounded-lg"
                          dangerouslySetInnerHTML={{ __html: cleanPublicHtml(item.description) }}
                        />
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <ol className="space-y-2.5 text-[13.5px] text-[#374151]">
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E31E24] text-[11px] font-bold text-white">1</span>
                  <span>Inspect product packaging and verify specification suitability before clinical use.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E31E24] text-[11px] font-bold text-white">2</span>
                  <span>Prepare treatment site following standard clinical orthodontic protocols.</span>
                </li>
                <li className="flex items-start gap-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E31E24] text-[11px] font-bold text-white">3</span>
                  <span>Apply product according to clinical technique and manufacturer instructions.</span>
                </li>
              </ol>
            )}
          </div>
        )}

        {/* 6. ADDITIONAL INFO TAB */}
        {activeTab === "additional" && (
          <div className="space-y-3">
            <h3 className="text-[16px] font-bold text-[#1A1A1A]">Additional Information</h3>
            {((product.productCode || apiProduct?.productCode) || customInfoList.length > 0) ? (
              <div className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
                <div className="space-y-2 text-[13px] text-[#374151]">
                  {(product.productCode || apiProduct?.productCode) ? (
                    <p><strong>Product Code:</strong> {product.productCode || apiProduct?.productCode}</p>
                  ) : null}
                  {customInfoList.slice(0, Math.ceil(customInfoList.length / 2)).map((item, idx) => (
                    <p key={idx}><strong>{item.label}:</strong> {item.value}</p>
                  ))}
                </div>
                <div className="space-y-2 text-[13px] text-[#374151]">
                  {customInfoList.slice(Math.ceil(customInfoList.length / 2)).map((item, idx) => (
                    <p key={idx}><strong>{item.label}:</strong> {item.value}</p>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-[13.5px] text-[#6B7280]">No additional information available for this product.</p>
            )}
          </div>
        )}

        {/* 7. SERVICE & WARRANTY TAB (COMMENTED OUT FOR FUTURE USE) */}
        {/* {activeTab === "warranty" && (
          <div className="space-y-3">
            <h3 className="text-[16px] font-bold text-[#1A1A1A]">Service & Warranty Guarantee</h3>
            {product.warranty && product.warranty.length > 0 ? (
              <div className="space-y-2">
                {product.warranty.map((wLine, idx) => (
                  <div key={idx} className="flex items-start gap-2.5 rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] p-3 text-[13.5px] text-[#14532D]">
                    <ShieldCheck className="mt-0.5 text-[#16A34A] shrink-0" size={18} />
                    <div dangerouslySetInnerHTML={{ __html: wLine }} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border border-[#DCFCE7] bg-[#F0FDF4] p-3.5">
                  <ShieldCheck className="mb-1.5 text-[#16A34A]" size={22} />
                  <h4 className="text-[13.5px] font-bold text-[#14532D]">100% Quality Assurance</h4>
                  <p className="mt-0.5 text-[12px] text-[#166534]">Rigorous quality control and ISO 13485 clinical standards.</p>
                </div>
                <div className="rounded-lg border border-[#DBEAFE] bg-[#EFF6FF] p-3.5">
                  <Box className="mb-1.5 text-[#2563EB]" size={22} />
                  <h4 className="text-[13.5px] font-bold text-[#1E3A8A]">10-Day Return Policy</h4>
                  <p className="mt-0.5 text-[12px] text-[#1E40AF]">Hassle-free returns for unopened manufacturing packs.</p>
                </div>
                <div className="rounded-lg border border-[#FFE4E6] bg-[#FFF1F2] p-3.5">
                  <Info className="mb-1.5 text-[#E11D48]" size={22} />
                  <h4 className="text-[13.5px] font-bold text-[#881337]">Dedicated Support</h4>
                  <p className="mt-0.5 text-[12px] text-[#9F1239]">Direct technical support from orthodontic specialists.</p>
                </div>
              </div>
            )}
          </div>
        )} */}

        {/* 8. REVIEWS & FEEDBACK TAB */}
        {activeTab === "reviews" && (
          <div className="space-y-6">
            {/* Summary Box */}
            {reviewsData.totalRatings > 0 && (
              <div className="flex flex-col gap-5 rounded-xl border border-[#E5E7EB] bg-[#FAFAFA] p-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-4">
                  <div className="flex flex-col items-center justify-center rounded-xl bg-[#E31E24] px-5 py-3 text-white shadow-2xs">
                    <span className="text-[28px] font-extrabold leading-none">{reviewsData.averageRating.toFixed(1)}</span>
                    <span className="mt-1 text-[11px] font-bold uppercase tracking-wider text-white/90">out of 5</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          size={18}
                          className={
                            star <= Math.round(reviewsData.averageRating)
                              ? "fill-[#F59E0B] text-[#F59E0B]"
                              : "text-[#D1D5DB]"
                          }
                        />
                      ))}
                    </div>
                    <p className="mt-1 text-[13.5px] font-semibold text-[#1F2937]">
                      Based on {reviewsData.totalRatings} verified customer {reviewsData.totalRatings === 1 ? "review" : "reviews"}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4 text-[13px] font-semibold text-[#4B5563]">
                  <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 shadow-2xs">
                    Product Quality: <span className="font-bold text-[#16A34A]">5.0 ★</span>
                  </div>
                  <div className="rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 shadow-2xs">
                    Value for Money: <span className="font-bold text-[#2563EB]">5.0 ★</span>
                  </div>
                </div>
              </div>
            )}

            {/* List of Submitted Reviews */}
            {loadingReviews ? (
              <p className="py-6 text-center text-[13.5px] text-[#6B7280]">Loading reviews &amp; feedback...</p>
            ) : reviewsData.reviews.length > 0 ? (
              <div className="space-y-4">
                <h4 className="text-[15px] font-bold text-[#111827]">Customer Reviews &amp; Feedback</h4>
                <div className="grid gap-4">
                  {reviewsData.reviews.map((rev) => (
                    <div key={rev.id} className="rounded-xl border border-[#E5E7EB] bg-white p-4.5 shadow-2xs transition-all hover:border-[#D1D5DB]">
                      <div className="flex items-center justify-between border-b border-[#F3F4F6] pb-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E31E24]/10 text-[14px] font-bold text-[#E31E24]">
                            {(rev.customerName || "V")[0].toUpperCase()}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[14px] font-bold text-[#111827]">{rev.customerName || "Verified Buyer"}</span>
                              <span className="inline-flex items-center gap-1 rounded-full bg-[#DCFCE7] px-2 py-0.5 text-[11px] font-bold text-[#15803D]">
                                <UserCheck size={11} /> Verified Buyer
                              </span>
                            </div>
                            <span className="text-[11.5px] text-[#9CA3AF]">
                              {new Date(rev.createdAt).toLocaleDateString("en-US", {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                              })}
                            </span>
                          </div>
                        </div>

                        {/* Overall Rating Pill */}
                        <div className="flex items-center gap-1 rounded-lg bg-[#FEF3C7] px-2.5 py-1 text-[12.5px] font-bold text-[#B45309]">
                          <span>{rev.ratingOverall}.0</span>
                          <Star size={13} className="fill-[#F59E0B] text-[#F59E0B]" />
                        </div>
                      </div>

                      {/* Review Content */}
                      <div className="pt-3 space-y-2">
                        {rev.feedbackText ? (
                          <p className="text-[14px] leading-relaxed text-[#374151] font-normal">
                            &quot;{rev.feedbackText}&quot;
                          </p>
                        ) : (
                          <p className="text-[13px] italic text-[#9CA3AF]">No written comment provided.</p>
                        )}

                        <div className="flex items-center gap-4 pt-1 text-[12px] text-[#6B7280]">
                          <span>Quality: <strong>{rev.ratingQuality}/5 ★</strong></span>
                          <span>Price: <strong>{rev.ratingPrice}/5 ★</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-[#E5E7EB] bg-[#FAFAFA] p-8 text-center">
                <MessageSquareCheck size={32} className="mx-auto mb-2 text-[#9CA3AF]" />
                <h4 className="text-[15px] font-bold text-[#374151]">No Reviews Yet</h4>
                <p className="mt-1 text-[13px] text-[#6B7280]">Be the first logged-in verified customer to submit valuable feedback!</p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

function useMemoHighlights(product: ProductDetail, apiProduct?: ApiProductDetail | null) {
  let raw = apiProduct?.highlights ?? product.highlights;

  if (typeof raw === "string") {
    try {
      raw = JSON.parse(raw);
    } catch {
      raw = [];
    }
  }

  if (Array.isArray(raw)) {
    return raw
      .map((h: any) =>
        typeof h === "string"
          ? { title: h, description: "", image: "" }
          : { title: h.title ?? h.label ?? h.name ?? "", description: h.description ?? "", image: h.image ?? "" }
      )
      .filter((item) => item.title || item.description || item.image);
  }

  return [];
}

function useMemoSpecs(product: ProductDetail, apiProduct?: ApiProductDetail | null) {
  let rawSpecs = apiProduct?.technicalSpecs ?? product.technicalSpecs;
  if (typeof rawSpecs === "string") {
    try {
      rawSpecs = JSON.parse(rawSpecs);
    } catch {
      // ignore
    }
  }

  const specList = Array.isArray(rawSpecs)
    ? rawSpecs
    : Array.isArray((rawSpecs as any)?.specs)
      ? (rawSpecs as any).specs
      : null;

  const specs: Record<string, string> = {};

  if (Array.isArray(specList) && specList.length > 0) {
    specList.forEach((item: any) => {
      if (item && typeof item === "object") {
        const key = item.label || item.key || item.name;
        const val = item.value || item.val;
        if (key && val) {
          specs[String(key)] = String(val);
        }
      }
    });
  } else if (rawSpecs && typeof rawSpecs === "object") {
    Object.entries(rawSpecs).forEach(([key, val]) => {
      if (key !== "images" && key !== "specs") {
        if (val && typeof val === "object") {
          const item = val as any;
          const k = item.label || item.key || key;
          const v = item.value || item.val;
          if (k && v) specs[String(k)] = String(v);
        } else if (val !== undefined && val !== null) {
          specs[key] = String(val);
        }
      }
    });
  }

  if (Object.keys(specs).length === 0) {
    return {
      Brand: "Modern Orthodontics",
      Material: "Medical Grade Stainless Steel",
      "Base Type": "80-Mesh Contoured Base",
      System: "Roth / MBT Compatible",
      "Slot Size": '.018" / .022"',
    };
  }

  return specs;
}
