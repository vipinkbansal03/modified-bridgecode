"use client";

import { useRef, useState, useEffect, type ChangeEvent } from "react";
import { ImageIcon } from "lucide-react";
import * as Yup from "yup";
import { AdminInput, AdminSelect, AdminTextarea, AdminRichTextEditor, useToast, LoadingButton } from "@/components/admin/AdminComponents";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminCategories, useAdminCountries, useCreateProduct } from "@/hooks/admin/useAdminHooks";
import { cn } from "@/utils/cn";
import { getAdminErrorMessage } from "@/services/adminApi";
import { useAdminForm } from "@/hooks/admin/useAdminForm";

const schema = Yup.object({
  title: Yup.string().required("Title is required"),
  slug: Yup.string(),
  categoryId: Yup.string().required("Category is required"),
  activeCountryIds: Yup.array().of(Yup.string()),
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

function toSlug(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function generateSku(title: string): string {
  const base = toSlug(title).toUpperCase();
  return base ? `MO-${base}` : "";
}

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
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const slugEdited = useRef(false);
  const skuEdited = useRef(false);
  const { showToast, ToastComponent } = useToast();
  const createProduct = useCreateProduct();
  const { data: categories = [] } = useAdminCategories();
  const { data: countries = [] } = useAdminCountries({ includeInactive: false });

  const handleTitleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    form.setFieldValue("title", value);
    if (!slugEdited.current) form.setFieldValue("slug", toSlug(value));
    if (!skuEdited.current) form.setFieldValue("sku", generateSku(value));
  };

  const form = useAdminForm({
    initialValues: {
      title: "",
      slug: "",
      categoryId: "",
      activeCountryIds: [] as string[],
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
    onSubmit: async (values) => {
      try {
        const payload = {
          ...values,
          activeCountryIds: values.activeCountryIds?.length
            ? values.activeCountryIds
            : countries.map((c: any) => c.id),
        };
        const product = (await createProduct.mutateAsync(payload)) as CreateProductResponse;
        const productId = product.data?.id;

        if (!productId) {
          throw new Error("Product was created, but the new product ID was not returned.");
        }

        showToast("Product created successfully.");
        form.reset();
        onCreated(productId);
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to create product."), "error");
      }
    },
    onClose: onCancel
  });

  const categoryOptions = [{ value: "", label: "Select category..." }, ...categories.map((category: { id: string; name: string }) => ({ value: category.id, label: category.name }))];
  const countryOptions = [{ value: "", label: "Select active country..." }, ...countries.map((c: any) => ({ value: c.id, label: c.name }))];
  const wrapperClassName = compact ? "space-y-5" : "space-y-6";

  return (
    <>
      <form onSubmit={form.handleSubmit} className={wrapperClassName}>
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
                    id="field-title"
                    label="Product Title"
                    required
                    name="title"
                    value={form.values.title}
                    onChange={handleTitleChange}
                    onBlur={() => form.handleBlur("title")}
                    error={form.errors.title as string}
                  />
                </div>

                <div className="sm:col-span-2">
                  <AdminInput
                    id="field-slug"
                    label="URL Slug"
                    required
                    name="slug"
                    value={form.values.slug}
                    onChange={(e) => {
                      slugEdited.current = true;
                      form.handleChange("slug", e.target.value);
                    }}
                    onBlur={() => form.handleBlur("slug")}
                    error={form.errors.slug as string}
                    className="bg-gray-50 font-mono text-sm"
                  />
                </div>

                <AdminSelect
                  label="Category"
                  options={categoryOptions}
                  value={form.values.categoryId}
                  onChange={(e) => form.setFieldValue("categoryId", e.target.value)}
                  error={form.errors.categoryId as string}
                  required
                />

                <div className="z-[1000] relative">
                  <AdminMultiSearchableSelect
                    label="Active Country"
                    values={form.values.activeCountryIds ?? []}
                    onValuesChange={(values) => form.setFieldValue("activeCountryIds", values)}
                    options={countries.map((c: any) => ({ value: c.id, label: `${c.name} (${c.code || c.countryCode || ""})`.trim() }))}
                    placeholder="Select countries"
                    allowSelectAll
                    selectAllLabel="All countries"
                    error={form.errors.activeCountryIds as string}
                  />
                </div>

                <AdminSelect
                  label="Status"
                  options={[
                    { value: "DRAFT", label: "Draft" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  value={form.values.status}
                  onChange={(e) => form.setFieldValue("status", e.target.value)}
                  error={form.errors.status as string}
                  required
                />

                <AdminInput label="Product Code" value={form.values.productCode} onChange={(e) => form.setFieldValue("productCode", e.target.value)} />
                <AdminInput
                  label="SKU"
                  name="sku"
                  value={form.values.sku}
                  onChange={(e) => {
                    skuEdited.current = true;
                    form.setFieldValue("sku", e.target.value);
                  }}
                  onBlur={() => form.handleBlur("sku")}
                />
                <AdminInput label="Brand" value={form.values.brand} onChange={(e) => form.setFieldValue("brand", e.target.value)} />

                <div className="flex flex-wrap items-center gap-6 pt-2">
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.values.isFeatured}
                      onChange={(event) => form.setFieldValue("isFeatured", event.target.checked)}
                      className="rounded"
                    />
                    <span className="text-[13.5px] text-[#1A1A1A]">Featured Product</span>
                  </label>
                  <label className="flex cursor-pointer items-center gap-2">
                    <input
                      type="checkbox"
                      checked={form.values.hasVariants}
                      onChange={(event) => form.setFieldValue("hasVariants", event.target.checked)}
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
                    <button
                      type="button"
                      onClick={() => setMediaModalOpen(true)}
                      className="inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                    >
                      <ImageIcon size={14} /> Browse Media Library
                    </button>
                    {form.values.informationImage && (
                      <div className="relative h-12 w-12">
                        <img
                          src={form.values.informationImage}
                          alt="Information preview"
                          className="h-full w-full rounded-md object-cover"
                        />
                        <button
                          type="button"
                          onClick={() => form.setFieldValue("informationImage", "")}
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
                  value={form.values.informationDescription}
                  onChange={(e) => form.setFieldValue("informationDescription", e.target.value)}
                />
              </div>

              <AdminTextarea
                label="Short Description"
                rows={2}
                maxLength={300}
                placeholder="Brief summary shown in listings and internal views..."
                value={form.values.shortDescription}
                onChange={(e) => form.setFieldValue("shortDescription", e.target.value)}
              />
              <AdminRichTextEditor
                label="Full Description"
                placeholder="Enter detailed clinical product description..."
                value={form.values.description}
                onChange={(value) => form.setFieldValue("description", value)}
                className="min-h-[220px]"
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

              <AdminInput label="SEO Title" placeholder="Max 60 characters" maxLength={60} value={form.values.seoTitle} onChange={(e) => form.setFieldValue("seoTitle", e.target.value)} />
              <AdminTextarea label="SEO Description" rows={3} placeholder="Max 160 characters" maxLength={160} value={form.values.seoDescription} onChange={(e) => form.setFieldValue("seoDescription", e.target.value)} />
              <AdminInput label="SEO Keywords" placeholder="Comma-separated keywords" value={form.values.seoKeywords} onChange={(e) => form.setFieldValue("seoKeywords", e.target.value)} />
            </div>
          )}

          <div className={compact ? "mt-6 flex flex-wrap items-center justify-end gap-3" : "mt-5 flex flex-wrap items-center justify-end gap-3"}>
            {onCancel ? (
              <button type="button" onClick={form.handleClose} className="rounded-md px-4 py-2 text-sm font-medium text-[#6B6B6B] hover:text-[#1A1A1A]">
                {cancelLabel}
              </button>
            ) : null}

            <LoadingButton
              type="submit"
              loading={form.isSubmitting}
              loadingText="Creating..."
              className="rounded-md bg-[#E31E24] px-5 py-2 text-sm font-medium text-white transition hover:bg-[#C91A20]"
            >
              {submitLabel}
            </LoadingButton>
          </div>
        </div>
      </form>

      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={(media) => form.setFieldValue("informationImage", media.url)}
        title="Select Information Image"
        acceptTypes={["IMAGE"]}
      />

      {ToastComponent}
    </>
  );
}
