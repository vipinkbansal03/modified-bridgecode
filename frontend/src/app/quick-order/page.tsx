"use client";

import { Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutDashboard, TableProperties } from "lucide-react";
import { BulkOrderBuilder } from "@/components/product/BulkOrderBuilder";
import { Container } from "@/components/ui/Container";
import { useProduct } from "@/hooks/api/useProducts";

function QuickOrderPageContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("product") ?? "";
  const { data: product, isLoading } = useProduct(slug);

  return (
    <section className="min-h-[70vh] bg-[linear-gradient(180deg,#FAFAFA_0%,#FFFFFF_42%,#FFFFFF_100%)] py-8 sm:py-10 lg:py-12">
      <Container>
        <Link
          href={slug ? `/products/${slug}` : "/products"}
          className="inline-flex items-center gap-2 text-[13px] font-medium text-[#6B6B6B] transition-colors hover:text-[#E31E24]"
        >
          <ArrowLeft size={14} />
          Back to product page
        </Link>

        <div className="mt-5 overflow-hidden rounded-2xl border border-line bg-white shadow-[0_20px_70px_rgba(0,0,0,0.06)]">
          <div className="border-b border-line bg-[linear-gradient(135deg,#FFFFFF_0%,#FFF7F7_100%)] p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-[720px]">
                <span className="mb-3 inline-flex items-center gap-2 rounded-full border border-[#E31E24]/20 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#E31E24]">
                  <TableProperties size={12} />
                  Quick Order Workspace
                </span>
                <h1 className="text-[clamp(28px,4vw,48px)] font-medium leading-[1.05] tracking-[-0.04em] text-ink">
                  Spreadsheet-style bulk ordering
                </h1>
                <p className="mt-3 max-w-[680px] text-[14.5px] leading-relaxed text-[#6B6B6B] sm:text-[15px]">
                  Enter quantities across product variants in one place. Ideal for repeat SKU entry, dealer ordering,
                  and fast RFQ batching.
                </p>
              </div>

              <div className="rounded-xl border border-line bg-white px-4 py-3 text-[12.5px] text-[#6B6B6B] shadow-sm lg:max-w-[360px]">
                <div className="flex items-center gap-2 font-semibold text-ink">
                  <LayoutDashboard size={14} />
                  Bulk entry workspace
                </div>
                <p className="mt-1">Selections are saved into the same Quote Cart used on product detail pages.</p>
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
                This product either does not exist or does not expose backend variants for spreadsheet ordering.
              </div>
            )}

            {product && product.variants.length > 0 && <BulkOrderBuilder apiProduct={product} />}
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
