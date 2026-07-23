"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminInput, AdminSelect, AdminTextarea, useToast } from "@/components/admin/AdminComponents";
import { useAdminCategories, useCreateProduct } from "@/hooks/admin/useAdminHooks";
import { cn } from "@/utils/cn";
import { getAdminErrorMessage } from "@/services/adminApi";

const schema = Yup.object({
  title: Yup.string().required("Title is required"),
  categoryId: Yup.string().required("Category is required"),
  status: Yup.string().required("Status is required"),
  productCode: Yup.string(),
  sku: Yup.string(),
  brand: Yup.string(),
  shortDescription: Yup.string().max(300),
  description: Yup.string(),
  informationImage: Yup.string(),
  informationDescription: Yup.string().max(200),
  seoTitle: Yup.string().max(60),
  seoDescription: Yup.string().max(160),
  seoKeywords: Yup.string(),
  isFeatured: Yup.boolean(),
  hasVariants: Yup.boolean(),
});

const TABS = ["Basic Info", "SEO"];

type CreateProductResponse = {
  data?: {
    id?: string;
  };
};

interface ProductCreateFormProps {
  onCreated: (productId: string) => void;
  onCancel?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  compact?: boolean;
}

export function ProductCreateForm({
  onCreated,
  onCancel,
  submitLabel = "Create Product",
  cancelLabel = "Cancel",
  compact = false,
}: ProductCreateFormProps) {
  const [activeTab, setActiveTab] = useState(0);
  const { showToast, ToastComponent } = useToast();
  const createProduct = useCreateProduct();
  const { data: categories = [] } = useAdminCategories();

  const formik = useFormik({
    initialValues: {
      title: "",
      categoryId: "",
      status: "DRAFT",
      productCode: "",
      sku: "",
      brand: "Modern Orthodontics",
      shortDescription: "",
      description: "",
      informationImage: "",
      informationDescription: "",
      seoTitle: "",
      seoDescription: "",
      seoKeywords: "",
      isFeatured: false,
      hasVariants: false,
    },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        const product = (await createProduct.mutateAsync(values)) as CreateProductResponse;
        const productId = product.data?.id;

        if (!productId) {
          throw new Error("Product was created, but the new product ID was not returned.");
        }

        showToast("Product created successfully.");
        resetForm();
        onCreated(productId);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to create product."), "error");
      } finally {
        setSubmitting(false);
      }
    },
  });

  const hasSubmitted = formik.submitCount > 0;

  const categoryOptions = [{ value: "", label: "Select category..." }, ...categories.map((category: { id: string; name: string }) => ({ value: category.id, label: category.name }))];
  const wrapperClassName = compact ? "space-y-5" : "space-y-6";

  return (
    <>
      <form onSubmit={formik.handleSubmit} className={wrapperClassName}>
        <div
          className={cn(
            compact
              ? "rounded-none border-0 bg-transparent p-0 shadow-none"
              : "rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-[0_1px_0_rgba(0,0,0,0.02)] sm:p-6"
          )}
        >
          <div className="mb-5">
            <p className="text-[13px] leading-5 text-[#6B6B6B]">
              Create the base product here. Attributes, variants, inventory, pricing, and country controls are configured later on the edit page.
            </p>
            <div className="mt-4 inline-flex flex-wrap gap-1 rounded-lg border border-[#E6E6E6] bg-white p-1">
              {TABS.map((tab, index) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(index)}
                  className={cn(
                    "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                    activeTab === index ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]"
                  )}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>

          {activeTab === 0 && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <AdminInput
                    label="Product Title *"
                    placeholder="e.g. Sapphire True Twin"
                    {...formik.getFieldProps("title")}
                    error={formik.touched.title || hasSubmitted ? (formik.errors.title as string) : ""}
                  />
                </div>

                <AdminSelect
                  label="Category *"
                  options={categoryOptions}
                  {...formik.getFieldProps("categoryId")}
                  error={formik.touched.categoryId || hasSubmitted ? (formik.errors.categoryId as string) : ""}
                />

                <AdminSelect
                  label="Status *"
                  options={[
                    { value: "DRAFT", label: "Draft" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  {...formik.getFieldProps("status")}
                  error={formik.touched.status || hasSubmitted ? (formik.errors.status as string) : ""}
                />

                <AdminInput label="Product Code" placeholder="MO-MB-STT" {...formik.getFieldProps("productCode")} />
                <AdminInput label="SKU" placeholder="MO-MB-STT-001" {...formik.getFieldProps("sku")} />
                <AdminInput label="Brand" {...formik.getFieldProps("brand")} />

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formik.values.isFeatured}
                      onChange={(event) => formik.setFieldValue("isFeatured", event.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[13.5px] text-[#1A1A1A]">Featured Product</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={formik.values.hasVariants}
                      onChange={(event) => formik.setFieldValue("hasVariants", event.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[13.5px] text-[#1A1A1A]">Has Variants</span>
                  </label>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
                <div>
                  <label className="mb-1 block text-[13.5px] font-medium text-[#1A1A1A]">Information Image</label>
                  <div className="mt-1.5 flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/gif,image/webp"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = (event) => {
                            const result = event.target?.result as string;
                            formik.setFieldValue("informationImage", result);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      className="hidden"
                      id="create-information-image-upload"
                    />
                    <label
                      htmlFor="create-information-image-upload"
                      className="cursor-pointer rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F5F5F5]"
                    >
                      Upload Image
                    </label>
                    {formik.values.informationImage && (
                      <div className="relative h-12 w-12">
                        <img
                          src={formik.values.informationImage}
                          alt="Information preview"
                          className="h-full w-full rounded-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => formik.setFieldValue("informationImage", "")}
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-white hover:bg-[#B5151B]"
                        >
                          ×
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-[12px] text-[#6B6B6B]">Upload a small icon/image for information section.</p>
                </div>

                <AdminTextarea
                  label="Information Description (max 200)"
                  rows={3}
                  maxLength={200}
                  placeholder="Brief description related to the information image..."
                  {...formik.getFieldProps("informationDescription")}
                />
              </div>

              <AdminTextarea
                label="Short Description"
                rows={2}
                maxLength={300}
                placeholder="Brief summary shown in listings and internal views..."
                {...formik.getFieldProps("shortDescription")}
              />
              <AdminTextarea
                label="Full Description"
                rows={7}
                placeholder="Detailed product description..."
                {...formik.getFieldProps("description")}
              />
            </div>
          )}

          {activeTab === 1 && (
            <div className="space-y-4">
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">SEO settings</h4>
                <p className="mt-1 text-[12.5px] leading-5 text-[#6B6B6B]">
                  These fields help search engines and internal sharing, but they do not affect attributes, variants, or inventory.
                </p>
              </div>

              <AdminInput label="SEO Title" placeholder="Max 60 characters" maxLength={60} {...formik.getFieldProps("seoTitle")} />
              <AdminTextarea label="SEO Description" rows={3} placeholder="Max 160 characters" maxLength={160} {...formik.getFieldProps("seoDescription")} />
              <AdminInput label="SEO Keywords" placeholder="Comma-separated keywords" {...formik.getFieldProps("seoKeywords")} />
            </div>
          )}

          <div className={compact ? "mt-6 flex flex-wrap items-center justify-end gap-3" : "mt-5 flex flex-wrap items-center justify-end gap-3"}>
            {onCancel ? (
              <button
                type="button"
                onClick={onCancel}
                className="rounded-md border border-[#E6E6E6] px-4 py-2.5 text-[13.5px] font-medium text-[#555] hover:bg-[#F2F2F2]"
              >
                {cancelLabel}
              </button>
            ) : null}

            <button
              type="submit"
              disabled={formik.isSubmitting || createProduct.isPending}
              className="rounded-md bg-[#E31E24] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {formik.isSubmitting || createProduct.isPending ? "Creating..." : submitLabel}
            </button>
          </div>
        </div>
      </form>

      {ToastComponent}
    </>
  );
}
