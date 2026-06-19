"use client";

import { useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, StatusBadge, useToast, ConfirmModal, DataTable, Column } from "@/components/admin/AdminComponents";
import { useAdminProduct, useUpdateProduct, useAdminCategories, useAdminAttributes, useGenerateVariants, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { Upload, Trash2, RefreshCw, Plus, Zap } from "lucide-react";

const TABS = ["Basic Info", "Media", "Attributes", "Variants", "Pricing", "Inventory", "Translations", "SEO"];

const basicSchema = Yup.object({
  title: Yup.string().required("Required"),
  categoryId: Yup.string().required("Required"),
  status: Yup.string().required(),
  productCode: Yup.string(),
  sku: Yup.string(),
  brand: Yup.string(),
  shortDescription: Yup.string().max(300),
  description: Yup.string(),
  isFeatured: Yup.boolean(),
  hasVariants: Yup.boolean(),
  seoTitle: Yup.string().max(60),
  seoDescription: Yup.string().max(160),
  seoKeywords: Yup.string(),
});

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const [activeTab, setActiveTab] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [deletingMedia, setDeletingMedia] = useState<string | null>(null);
  const [generatingVariants, setGeneratingVariants] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const { data: product, isLoading, refetch } = useAdminProduct(id);
  const { data: categories = [] } = useAdminCategories();
  const { data: attributes = [] } = useAdminAttributes();
  const { data: languages = [] } = useAdminLanguages();
  const updateProduct = useUpdateProduct(id);
  const generateVariantsMutation = useGenerateVariants(id);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      title: product?.title || "",
      categoryId: product?.categoryId || "",
      status: product?.status || "DRAFT",
      productCode: product?.productCode || "",
      sku: product?.sku || "",
      brand: product?.brand || "Modern Orthodontics",
      shortDescription: product?.shortDescription || "",
      description: product?.description || "",
      isFeatured: product?.isFeatured || false,
      hasVariants: product?.hasVariants || false,
      seoTitle: product?.seoTitle || "",
      seoDescription: product?.seoDescription || "",
      seoKeywords: product?.seoKeywords || "",
    },
    validationSchema: basicSchema,
    onSubmit: async (values, { setSubmitting }) => {
      try {
        await updateProduct.mutateAsync(values);
        showToast("Product saved.");
      } catch {
        showToast("Save failed.", "error");
      } finally {
        setSubmitting(false);
      }
    },
  });

  // ─── Media upload ─────────────────────────────────────
  const handleMediaUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploadingMedia(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try {
      await adminApi.post(`/products/${id}/media`, formData, { headers: { "Content-Type": "multipart/form-data" } });
      showToast("Media uploaded.");
      refetch();
    } catch {
      showToast("Upload failed.", "error");
    } finally {
      setUploadingMedia(false);
      e.target.value = "";
    }
  };

  const handleDeleteMedia = async (mediaId: string) => {
    try {
      await adminApi.delete(`/products/${id}/media/${mediaId}`);
      showToast("Media deleted.");
      refetch();
    } catch {
      showToast("Delete failed.", "error");
    } finally {
      setDeletingMedia(null);
    }
  };

  // ─── Assign attributes ────────────────────────────────
  const initialSelectedAttribs = useMemo(
    () => product?.attributes?.map((a: { attributeId: string }) => a.attributeId) ?? [],
    [product?.attributes]
  );
  const [selectedAttribs, setSelectedAttribs] = useState<string[] | null>(null);
  const effectiveSelectedAttribs = selectedAttribs ?? initialSelectedAttribs;

  const handleSaveAttributes = async () => {
    try {
      await adminApi.post(`/products/${id}/attributes`, {
        attributes: effectiveSelectedAttribs.map((attributeId: string) => ({ attributeId, required: false })),
      });
      showToast("Attributes saved.");
      refetch();
    } catch {
      showToast("Failed to save attributes.", "error");
    }
  };

  // ─── Generate variants ────────────────────────────────
  const handleGenerateVariants = async () => {
    setGeneratingVariants(true);
    try {
      const result = await generateVariantsMutation.mutateAsync();
      showToast((result as { message: string }).message || "Variants generated.");
      refetch();
    } catch (err: unknown) {
      showToast((err as { response?: { data?: { message?: string } } })?.response?.data?.message || "Failed.", "error");
    } finally {
      setGeneratingVariants(false);
    }
  };

  const catOptions = [
    { value: "", label: "Select category…" },
    ...categories.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })),
  ];

  if (isLoading) {
    return (
      <AdminLayout title="Edit Product">
        <div className="space-y-4">
          {[...Array(4)].map((_, i) => <div key={i} className="h-12 animate-pulse rounded-lg bg-[#E6E6E6]" />)}
        </div>
      </AdminLayout>
    );
  }

  if (!product) {
    return <AdminLayout title="Product not found"><p className="text-[#9A9A9A]">Product not found.</p></AdminLayout>;
  }

  // ─── Variant table columns ────────────────────────────
  const variantCols: Column<{ id: string; title: string; sku: string; status: string; inventory?: { stock: number } }>[] = [
    { key: "title", label: "Variant" },
    { key: "sku", label: "SKU" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "stock", label: "Stock", render: (r) => r.inventory?.stock ?? "—" },
  ];

  // ─── Pricing table columns ────────────────────────────
  const pricingCols: Column<{ id: string; country: { name: string; code: string }; currency: { symbol: string }; mrp: number; sellingPrice: number; status: string }>[] = [
    { key: "country", label: "Country", render: (r) => `${r.country.name} (${r.country.code})` },
    { key: "mrp", label: "MRP", render: (r) => `${r.currency.symbol}${r.mrp}` },
    { key: "sellingPrice", label: "Selling Price", render: (r) => `${r.currency.symbol}${r.sellingPrice}` },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];

  return (
    <AdminLayout title={product.title} breadcrumb={[{ label: "Products", href: "/admin/products" }, { label: "Edit" }]}>
      {/* Tabs + Save button */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-1 rounded-lg border border-[#E6E6E6] bg-white p-1">
          {TABS.map((tab, i) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(i)}
              className={cn(
                "rounded-md px-3.5 py-1.5 text-[12.5px] font-medium transition-colors",
                activeTab === i ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:bg-[#F2F2F2]"
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        {activeTab === 0 || activeTab === 7 ? (
          <button
            type="button"
            onClick={() => formik.handleSubmit()}
            disabled={formik.isSubmitting}
            className="rounded-md bg-[#E31E24] px-5 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
          >
            {formik.isSubmitting ? "Saving…" : "Save Changes"}
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-[#E6E6E6] bg-white">
        {/* ── Tab 0: Basic Info ── */}
        {activeTab === 0 && (
          <div className="p-6 space-y-5">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AdminInput label="Product Title *" {...formik.getFieldProps("title")} error={formik.touched.title ? (formik.errors.title as string) : ""} />
              </div>
              <AdminSelect label="Category *" options={catOptions} {...formik.getFieldProps("categoryId")} error={formik.touched.categoryId ? (formik.errors.categoryId as string) : ""} />
              <AdminSelect
                label="Status"
                options={[{ value: "DRAFT", label: "Draft" }, { value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }, { value: "ARCHIVED", label: "Archived" }]}
                {...formik.getFieldProps("status")}
              />
              <AdminInput label="Product Code" {...formik.getFieldProps("productCode")} />
              <AdminInput label="SKU" {...formik.getFieldProps("sku")} />
              <AdminInput label="Brand" {...formik.getFieldProps("brand")} />
              <div className="flex items-center gap-6 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formik.values.isFeatured} onChange={(e) => formik.setFieldValue("isFeatured", e.target.checked)} className="rounded" />
                  <span className="text-[13.5px]">Featured Product</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formik.values.hasVariants} onChange={(e) => formik.setFieldValue("hasVariants", e.target.checked)} className="rounded" />
                  <span className="text-[13.5px]">Has Variants</span>
                </label>
              </div>
            </div>
            <AdminTextarea label="Short Description (max 300)" rows={2} maxLength={300} {...formik.getFieldProps("shortDescription")} />
            <AdminTextarea label="Full Description" rows={7} {...formik.getFieldProps("description")} />
          </div>
        )}

        {/* ── Tab 1: Media ── */}
        {activeTab === 1 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Images &amp;amp; Files</h3>
              <label className={cn("flex items-center gap-1.5 rounded-md px-4 py-2 text-[13px] font-medium text-white cursor-pointer", uploadingMedia ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                <Upload size={14} />
                {uploadingMedia ? "Uploading…" : "Upload Files"}
                <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleMediaUpload} disabled={uploadingMedia} />
              </label>
            </div>
            {product.media?.length === 0 ? (
              <div className="flex h-40 items-center justify-center rounded-lg border-2 border-dashed border-[#E6E6E6] text-[13.5px] text-[#9A9A9A]">
                No media uploaded yet.
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
                {product.media?.map((m: { id: string; url: string; altText: string; type: string }) => (
                  <div key={m.id} className="group relative aspect-square rounded-lg border border-[#E6E6E6] overflow-hidden bg-[#F8F8F8]">
                    {m.type === "IMAGE" ? (
                      <img src={m.url} alt={m.altText || ""} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-[11px] text-[#6B6B6B]">PDF</div>
                    )}
                    <button
                      onClick={() => setDeletingMedia(m.id)}
                      className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 size={18} className="text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <p className="mt-3 text-[12px] text-[#9A9A9A]">Supported: JPEG, PNG, WebP, PDF. Max 20MB per file.</p>
          </div>
        )}

        {/* ── Tab 2: Attributes ── */}
        {activeTab === 2 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Assign Attributes</h3>
              <button onClick={handleSaveAttributes} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                Save Attributes
              </button>
            </div>
            <p className="mb-4 text-[13px] text-[#6B6B6B]">Select which attributes apply to this product. Variants will be generated from the combinations of all selected attribute values.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3">
              {attributes.map((attr: { id: string; name: string; values: { id: string; value: string }[] }) => (
                <label key={attr.id} className={cn("flex cursor-pointer items-start gap-3 rounded-lg border p-3.5 transition-colors", effectiveSelectedAttribs.includes(attr.id) ? "border-[#E31E24] bg-red-50" : "border-[#E6E6E6] hover:border-[#CACACA]")}>
                  <input
                    type="checkbox"
                    checked={effectiveSelectedAttribs.includes(attr.id)}
                    onChange={(e) => {
                      const next = selectedAttribs ?? initialSelectedAttribs;
                      if (e.target.checked) setSelectedAttribs([...next, attr.id]);
                      else setSelectedAttribs(next.filter((a: string) => a !== attr.id));
                    }}
                    className="mt-0.5 rounded"
                  />
                  <div>
                    <div className="text-[13.5px] font-medium text-[#1A1A1A]">{attr.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {attr.values.slice(0, 4).map((v: { id: string; value: string }) => (
                        <span key={v.id} className="rounded-full bg-[#F2F2F2] px-2 py-0.5 text-[11px] text-[#6B6B6B]">{v.value}</span>
                      ))}
                      {attr.values.length > 4 && <span className="text-[11px] text-[#9A9A9A]">+{attr.values.length - 4}</span>}
                    </div>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 3: Variants ── */}
        {activeTab === 3 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Product Variants</h3>
                <p className="text-[12.5px] text-[#9A9A9A] mt-0.5">Generated from attribute combinations.</p>
              </div>
              <button
                onClick={handleGenerateVariants}
                disabled={generatingVariants || !product.hasVariants}
                className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333] disabled:opacity-40"
              >
                <Zap size={14} />
                {generatingVariants ? "Generating…" : "Generate Variants"}
              </button>
            </div>
            {!product.hasVariants && (
              <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-[13px] text-yellow-700">
                Enable &quot;Has Variants&quot; in Basic Info first, then assign attributes, then generate.
              </div>
            )}
            <DataTable
              columns={variantCols}
              data={product.variants || []}
              rowKey="id"
              emptyMessage="No variants generated yet."
            />
          </div>
        )}

        {/* ── Tab 4: Pricing ── */}
        {activeTab === 4 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Country-wise Pricing</h3>
                <p className="text-[12.5px] text-[#9A9A9A] mt-0.5">Set prices per country. Use Generate to auto-convert from base price.</p>
              </div>
              <button
                onClick={async () => {
                  const base = prompt("Enter base price in USD:");
                  if (!base) return;
                  try {
                    await adminApi.post("/pricing/generate-country-prices", { productId: id, basePrice: parseFloat(base), baseCurrencyId: "usd" });
                    showToast("Country prices generated.");
                    refetch();
                  } catch { showToast("Failed.", "error"); }
                }}
                className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
              >
                <RefreshCw size={14} /> Generate All Country Prices
              </button>
            </div>
            <DataTable
              columns={pricingCols}
              data={product.prices || []}
              rowKey="id"
              emptyMessage="No pricing set. Use Generate to auto-fill all countries."
            />
          </div>
        )}

        {/* ── Tab 5: Inventory ── */}
        {activeTab === 5 && (
          <div className="p-6">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A] mb-4">Inventory</h3>
            <div className="space-y-3">
              {(product.variants?.length ? product.variants : [{ id: "main", title: "Main Stock", inventory: null }]).map((v: { id: string; title: string; inventory: { id: string; stock: number; reservedStock: number; lowStockThreshold: number; status: string } | null }) => (
                <div key={v.id} className="flex flex-wrap items-center gap-3 rounded-lg border border-[#E6E6E6] p-4">
                  <span className="min-w-[160px] text-[13.5px] font-medium text-[#1A1A1A]">{v.title}</span>
                  <div className="flex items-center gap-2 ml-auto">
                    <div className="text-center">
                      <div className="text-[11px] text-[#9A9A9A] mb-1">Stock</div>
                      <input
                        type="number"
                        min="0"
                        defaultValue={v.inventory?.stock || 0}
                        className="w-20 rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13.5px] outline-none focus:border-[#E31E24]"
                        onBlur={async (e) => {
                          if (!v.inventory?.id) return;
                          await adminApi.put(`/inventory/${v.inventory.id}`, { stock: parseInt(e.target.value) });
                          showToast("Stock updated.");
                        }}
                      />
                    </div>
                    <div className="text-center">
                      <div className="text-[11px] text-[#9A9A9A] mb-1">Low Stock</div>
                      <input
                        type="number"
                        min="0"
                        defaultValue={v.inventory?.lowStockThreshold || 10}
                        className="w-20 rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13.5px] outline-none focus:border-[#E31E24]"
                        onBlur={async (e) => {
                          if (!v.inventory?.id) return;
                          await adminApi.put(`/inventory/${v.inventory.id}`, { lowStockThreshold: parseInt(e.target.value) });
                        }}
                      />
                    </div>
                    {v.inventory && <StatusBadge status={v.inventory.status} />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Tab 6: Translations ── */}
        {activeTab === 6 && (
          <div className="p-6">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Translations</h3>
              <button
                onClick={async () => {
                  try {
                    await adminApi.post("/translations/generate", { productId: id });
                    showToast("AI generation started.");
                    refetch();
                  } catch { showToast("Failed.", "error"); }
                }}
                className="flex items-center gap-1.5 rounded-md bg-[#1A1A1A] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#333]"
              >
                <Zap size={14} /> AI Generate All
              </button>
            </div>
            <div className="space-y-4">
              {languages.map((lang: { id: string; name: string; code: string }) => {
                const t = product.translations?.find((tr: { languageId: string }) => tr.languageId === lang.id);
                return (
                  <details key={lang.id} className="rounded-lg border border-[#E6E6E6] overflow-hidden">
                    <summary className="flex items-center justify-between px-4 py-3 cursor-pointer bg-[#F8F8F8] hover:bg-[#F2F2F2]">
                      <span className="text-[13.5px] font-medium text-[#1A1A1A]">{lang.name} ({lang.code.toUpperCase()})</span>
                      {t?.isAiGenerated && <span className="text-[11px] text-blue-600 bg-blue-50 border border-blue-200 rounded-full px-2 py-0.5">AI Generated</span>}
                    </summary>
                    <div className="p-4 space-y-3">
                      <AdminInput
                        label="Title"
                        defaultValue={t?.title || ""}
                        placeholder={product.title}
                        onBlur={async (e) => {
                          if (!t?.id) return;
                          await adminApi.put(`/translations/${t.id}`, { title: e.target.value });
                          showToast("Saved.");
                        }}
                      />
                      <AdminTextarea
                        label="Short Description"
                        rows={2}
                        defaultValue={t?.shortDescription || ""}
                        onBlur={async (e) => {
                          if (!t?.id) return;
                          await adminApi.put(`/translations/${t.id}`, { shortDescription: e.target.value });
                        }}
                      />
                      <AdminTextarea
                        label="Description"
                        rows={5}
                        defaultValue={t?.description || ""}
                        onBlur={async (e) => {
                          if (!t?.id) return;
                          await adminApi.put(`/translations/${t.id}`, { description: e.target.value });
                        }}
                      />
                    </div>
                  </details>
                );
              })}
              {languages.length === 0 && (
                <p className="text-[13.5px] text-[#9A9A9A]">No languages configured. Add languages in the Translations module.</p>
              )}
            </div>
          </div>
        )}

        {/* ── Tab 7: SEO ── */}
        {activeTab === 7 && (
          <div className="p-6 space-y-4">
            <AdminInput label="SEO Title (max 60 chars)" maxLength={60} {...formik.getFieldProps("seoTitle")}
              error={formik.touched.seoTitle ? (formik.errors.seoTitle as string) : ""}
            />
            <div className="text-[12px] text-[#9A9A9A]">{formik.values.seoTitle.length}/60 characters</div>
            <AdminTextarea label="SEO Description (max 160 chars)" rows={3} maxLength={160} {...formik.getFieldProps("seoDescription")} />
            <div className="text-[12px] text-[#9A9A9A]">{formik.values.seoDescription.length}/160 characters</div>
            <AdminInput label="SEO Keywords" placeholder="Comma-separated" {...formik.getFieldProps("seoKeywords")} />

            {/* Preview */}
            <div className="mt-4 rounded-lg border border-[#E6E6E6] p-4 bg-[#F8F8F8]">
              <p className="text-[11.5px] uppercase text-[#9A9A9A] mb-2 font-medium">Google Preview</p>
              <p className="text-[#1A0DAB] text-[16px] font-medium hover:underline cursor-pointer">{formik.values.seoTitle || product.title}</p>
              <p className="text-[#006621] text-[13px]">modortho.com › products › {product.slug}</p>
              <p className="text-[#545454] text-[13.5px] mt-1 line-clamp-2">{formik.values.seoDescription || product.shortDescription || "No meta description."}</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete media confirm */}
      <ConfirmModal
        open={!!deletingMedia}
        title="Delete this image?"
        message="This will permanently remove the file from storage."
        onConfirm={() => deletingMedia && handleDeleteMedia(deletingMedia)}
        onCancel={() => setDeletingMedia(null)}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
