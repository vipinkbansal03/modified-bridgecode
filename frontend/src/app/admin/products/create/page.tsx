"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useCreateProduct, useAdminCategories } from "@/hooks/admin/useAdminHooks";
import { cn } from "@/utils/cn";

const schema = Yup.object({
  title: Yup.string().required("Title is required"),
  categoryId: Yup.string().required("Category is required"),
  status: Yup.string().required("Status is required"),
  productCode: Yup.string(),
  sku: Yup.string(),
  brand: Yup.string(),
  shortDescription: Yup.string().max(300),
  description: Yup.string(),
  seoTitle: Yup.string().max(60),
  seoDescription: Yup.string().max(160),
  seoKeywords: Yup.string(),
  isFeatured: Yup.boolean(),
  hasVariants: Yup.boolean(),
});

const TABS = ["Basic Info", "SEO", "Options"];

export default function CreateProductPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState(0);
  const { showToast, ToastComponent } = useToast();
  const createProduct = useCreateProduct();
  const { data: categories = [] } = useAdminCategories();

  const formik = useFormik({
    initialValues: {
      title: "", categoryId: "", status: "DRAFT", productCode: "", sku: "", brand: "Modern Orthodontics",
      shortDescription: "", description: "", seoTitle: "", seoDescription: "", seoKeywords: "",
      isFeatured: false, hasVariants: false,
    },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        const product = await createProduct.mutateAsync(values);
        showToast("Product created. Redirecting to edit page…");
        setTimeout(() => router.push(`/admin/products/${(product as { data: { id: string } }).data.id}/edit`), 1000);
      } catch (err: unknown) {
        showToast((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed to create.", "error");
      } finally {
        setSubmitting(false);
      }
    },
  });

  const catOptions = [{ value: "", label: "Select category…" }, ...categories.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name }))];

  return (
    <AdminLayout title="New Product" breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "Create" }]}>
      <form onSubmit={formik.handleSubmit}>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex border border-[#E6E6E6] rounded-lg overflow-hidden bg-white">
            {TABS.map((tab, i) => (
              <button key={tab} type="button" onClick={() => setActiveTab(i)} className={cn("px-4 py-2 text-[13px] font-medium transition-colors", activeTab === i ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]")}>
                {tab}
              </button>
            ))}
          </div>
          <button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
            {formik.isSubmitting ? "Creating…" : "Create Product"}
          </button>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 space-y-5">
          {activeTab === 0 && (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <AdminInput label="Product Title *" placeholder="e.g. Sapphire True Twin" {...formik.getFieldProps("title")} error={formik.touched.title ? (formik.errors.title as string) : ""} />
                </div>
                <AdminSelect label="Category *" options={catOptions} {...formik.getFieldProps("categoryId")} error={formik.touched.categoryId ? (formik.errors.categoryId as string) : ""} />
                <AdminSelect label="Status" options={[{ value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} {...formik.getFieldProps("status")} />
                <AdminInput label="Product Code" placeholder="MO-MB-STT" {...formik.getFieldProps("productCode")} />
                <AdminInput label="SKU" placeholder="MO-MB-STT-001" {...formik.getFieldProps("sku")} />
                <AdminInput label="Brand" {...formik.getFieldProps("brand")} />
                <div className="flex gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...formik.getFieldProps("isFeatured")} checked={formik.values.isFeatured} className="rounded" />
                    <span className="text-[13.5px] text-[#1A1A1A]">Featured</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" {...formik.getFieldProps("hasVariants")} checked={formik.values.hasVariants} className="rounded" />
                    <span className="text-[13.5px] text-[#1A1A1A]">Has Variants</span>
                  </label>
                </div>
              </div>
              <AdminTextarea label="Short Description" rows={2} maxLength={300} placeholder="Up to 300 characters…" {...formik.getFieldProps("shortDescription")} />
              <AdminTextarea label="Full Description" rows={6} placeholder="Full product description…" {...formik.getFieldProps("description")} />
            </>
          )}

          {activeTab === 1 && (
            <>
              <AdminInput label="SEO Title" placeholder="Max 60 characters" maxLength={60} {...formik.getFieldProps("seoTitle")} />
              <AdminTextarea label="SEO Description" rows={3} placeholder="Max 160 characters" maxLength={160} {...formik.getFieldProps("seoDescription")} />
              <AdminInput label="SEO Keywords" placeholder="Comma-separated keywords" {...formik.getFieldProps("seoKeywords")} />
            </>
          )}

          {activeTab === 2 && (
            <div className="py-4 text-[13.5px] text-[#9A9A9A] text-center">
              Save the product first, then manage Media, Attributes, Variants, Pricing, and Inventory on the edit page.
            </div>
          )}
        </div>
      </form>

      {ToastComponent}
    </AdminLayout>
  );
}
