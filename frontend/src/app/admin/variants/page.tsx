"use client";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
export default function VariantsPage() {
  return (
    <AdminLayout title="Variants" breadcrumb={[{ label: "Variants" }]}>
      <div className="rounded-xl border border-[#E6E6E6] bg-white p-8 text-center">
        <p className="text-[14px] font-medium text-[#1A1A1A] mb-2">Variants are managed per product.</p>
        <p className="text-[13.5px] text-[#6B6B6B]">Go to Products → Edit a product → Attributes tab to assign attributes, then Variants tab to generate combinations.</p>
      </div>
    </AdminLayout>
  );
}
