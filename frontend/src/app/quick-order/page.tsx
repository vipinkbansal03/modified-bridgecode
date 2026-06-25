"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, LayoutDashboard, TableProperties } from "lucide-react";
import { BulkOrderBuilder } from "@/components/product/BulkOrderBuilder";
import { Container } from "@/components/ui/Container";
import { useProduct } from "@/hooks/api/useProducts";

function QuickOrderContent() {
  const searchParams = useSearchParams();
  const slug = searchParams.get("product") ?? "";
  const { data: product, isLoading } = useProduct(slug);

  return (
    <section className="min-h-[70vh] bg-[linear-gradient(180deg,#F8F4EE_0%,#FFFDFC_28%,#FFFFFF_100%)] py-10 sm:py-14">
      <Container>
        <Link href={slug ? `/products/${slug}` : "/products"} className="inline-flex items-center gap-2 text-[13px] font-medium text-[#7C6857] hover:text-[#A44C17]">
          <ArrowLeft size={14} />
          Back to product page
        </Link>

        <div className="mt-5 rounded-[28px] border border-[#E6D9CB] bg-white p-6 shadow-[0_24px_80px_rgba(21,16,12,0.08)] sm:p-8">
          <div className="flex flex-col gap-4 border-b border-[#EFE4D8] pb-6 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-[700px]">
              <span className="mb-2 inline-flex items-center gap-2 rounded-full border border-[#E7D2BF] bg-[#FCF8F3] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#A44C17]">
                <TableProperties size={12} />
                Quick Order Workspace
              </span>
              <h1 className="text-[clamp(28px,3vw,40px)] font-normal tracking-[-0.03em] text-[#201914]">
                Spreadsheet-style bulk ordering lives here
              </h1>
              <p className="mt-2 text-[14.5px] leading-relaxed text-[#6C6258]">
                Use this workspace when you need matrix or table entry across many variants. The PDP stays focused on a guided configurator experience.
              </p>
            </div>

            <div className="rounded-[20px] border border-[#EFE4D8] bg-[#FCF9F4] px-4 py-3 text-[12.5px] text-[#6D5B4B]">
              <div className="flex items-center gap-2 font-semibold text-[#3A2F28]">
                <LayoutDashboard size={14} />
                Bulk entry workspace
              </div>
              <p className="mt-1">Best for large dealers, repeat SKU entry, and fast quote batching.</p>
            </div>
          </div>

          {!slug && (
            <div className="mt-8 rounded-[22px] border border-dashed border-[#D9C6B3] bg-[#FBF6F0] p-6 text-[14px] text-[#6C6258]">
              Choose a product first. Open Quick Order from any variant PDP, or append `?product=your-slug` to this URL.
            </div>
          )}

          {slug && isLoading && (
            <div className="mt-8 rounded-[22px] border border-[#EFE4D8] bg-[#FBF7F2] p-6 text-[14px] text-[#6C6258]">
              Loading quick-order workspace…
            </div>
          )}

          {slug && !isLoading && (!product || !product.variants.length) && (
            <div className="mt-8 rounded-[22px] border border-[#F2D5C6] bg-[#FFF5F0] p-6 text-[14px] text-[#8A4D2A]">
              This product either does not exist or does not expose backend variants for spreadsheet ordering.
            </div>
          )}

          {product && product.variants.length > 0 && <BulkOrderBuilder apiProduct={product} />}
        </div>
      </Container>
    </section>
  );
}

export default function QuickOrderPage() {
  return (
    <Suspense fallback={null}>
      <QuickOrderContent />
    </Suspense>
  );
}
