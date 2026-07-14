"use client";

import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ProductCreateForm } from "@/components/admin/products/ProductCreateForm";

export default function CreateProductPage() {
  const router = useRouter();

  return (
    <AdminLayout title="New Product" breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "New Product" }]}>
      <div className="w-full">
        <ProductCreateForm
          onCancel={() => router.push("/admin/products")}
          onCreated={(productId) => router.push(`/admin/products/${productId}/edit`)}
        />
      </div>
    </AdminLayout>
  );
}
