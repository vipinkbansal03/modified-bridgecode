"use client";

import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ProductCreateForm } from "@/components/admin/products/ProductCreateForm";

export default function CreateProductPage() {
  const router = useRouter();

  return (
    <AdminLayout title="New Product" breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "Create" }]}>
      <div className="mx-auto max-w-2xl">
        <ProductCreateForm onCreated={(productId) => router.push(`/admin/products/${productId}/edit`)} />
      </div>
    </AdminLayout>
  );
}
