"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutGrid } from "lucide-react";
import { VariantConfigurator } from "@/components/product/VariantConfigurator";
import { Container } from "@/components/ui/Container";
import { useProduct } from "@/hooks/api/useProducts";

function QuickOrderPageContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("product") ?? "";
  const { data: product, isLoading } = useProduct(slug);

  return (
    <section className="min-h-[70vh] bg-[linear-gradient(180deg,#FAFAFA_0%,#FFFFFF_42%,#FFFFFF_100%)] py-8 sm:py-10 lg:py-12">
      <Container>
        <div>
          <Link
            href={slug ? `/products/${slug}` : "/products"}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-1.5 text-[12.5px] font-semibold text-[#374151] shadow-2xs transition-colors hover:border-[#D1D5DB] hover:bg-[#F9FAFB] hover:text-[#111827]"
          >
            <ArrowLeft size={14} className="text-[#E31E24]" />
            <span>Back to Product</span>
          </Link>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_70px_rgba(0,0,0,0.06)]">
          <div className="border-b border-line bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF7F7_100%)] p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[720px]">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E31E24]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E31E24]">
                  <LayoutGrid size={12} />
                  Bulk Order Grid
                </span>
                <h1 className="text-[clamp(28px,4vw,48px)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                  Order every size in one view
                </h1>
                <p className="mt-3 max-w-[680px] text-[14.5px] leading-relaxed text-[#6B6B6B] sm:text-[15px]">
                  Choose the dropdown options, then enter quantities directly where each row and column meet.
                  All matching sizes stay visible together for faster dealer and clinic ordering.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-white px-4 py-3 text-[12.5px] text-[#6B6B6B] shadow-sm lg:max-w-[360px]">
                Attribute roles control this layout: Dropdown filters, Grid X Axis columns, and Grid Y Axis rows.
              </div>
            </div>
          </div>

          <div className="p-5 sm:p-7 lg:p-8">
            {!slug && (
              <div className="rounded-xl border border-dashed border-line bg-offwhite p-5 text-[14px] text-[#6B6B6B]">
                Choose a product first. Open Quick Order from any variant PDP, or append `?product=your-slug` to this URL.
              </div>
            )}

            {slug && isLoading && (
              <div className="rounded-xl border border-line bg-offwhite p-5 text-[14px] text-[#6B6B6B]">
                Loading quick-order workspace…
              </div>
            )}

            {slug && !isLoading && (!product || !product.variants.length) && (
              <div className="rounded-xl border border-[#F2D5C6] bg-[#FFF5F0] p-5 text-[14px] text-[#8A4D2A]">
                This product either does not exist or does not have active variants available for bulk ordering.
              </div>
            )}

            {product && product.variants.length > 0 && <VariantConfigurator apiProduct={product} />}
          </div>
        </div>
      </Container>
    </section>
  );
}

export default function QuickOrderPage() {
  return (
    <Suspense
      fallback={
        <section className="min-h-[70vh] bg-[linear-gradient(180deg,#FAFAFA_0%,#FFFFFF_42%,#FFFFFF_100%)] py-8 sm:py-10 lg:py-12">
          <Container>
            <div className="rounded-2xl border border-line bg-white p-5 text-[14px] text-[#6B6B6B] shadow-[0_20px_70px_rgba(0,0,0,0.06)] sm:p-7">
              Loading quick-order workspace...
            </div>
          </Container>
        </section>
      }
    >
      <QuickOrderPageContent />
    </Suspense>
  );
}
