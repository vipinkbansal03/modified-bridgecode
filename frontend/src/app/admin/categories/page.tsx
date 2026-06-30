"use client";

import { useMemo, useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Image as ImageIcon, Pencil, Plus, Trash2, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, StatusBadge, toastMessages, useToast } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  filterTranslationLanguages,
  NoTranslationLanguagesMessage,
  TranslationBlurField,
  TranslationBlurInput,
  TranslationEditorBanner,
  TranslationModeBar,
} from "@/components/admin/TranslationEditorUi";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import {
  useAdminCategories,
  useAdminCategoryCountries,
  useAdminLanguages,
  useCreateCategory,
  useReorderCategories,
  useUpdateCategory,
  useUpdateCategoryCountries,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { slugify } from "@/utils/slugify";

interface CategoryTranslation {
  id: string;
  languageId: string;
  name: string | null;
  description: string | null;
}

interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  parentId: string | null;
  parent?: { id: string; name: string } | null;
  image: string | null;
  status: "ACTIVE" | "INACTIVE";
  sortOrder: number;
  translations?: CategoryTranslation[];
  _count: { products: number };
}

interface CountryAvailability {
  id: string;
  name: string;
  code: string;
  status: string;
  enabled: boolean;
}

type CategoryRow = Category & { depth: number };

const schema = Yup.object({
  name: Yup.string().trim().required("Name is required"),
  slug: Yup.string().trim().required("Slug is required"),
  description: Yup.string(),
  seoTitle: Yup.string(),
  seoDescription: Yup.string(),
  image: Yup.string(),
  parentId: Yup.string(),
  status: Yup.string().oneOf(["ACTIVE", "INACTIVE"]).required("Status is required"),
});

function flattenCategories(categories: Category[]) {
  const byParent = new Map<string | null, Category[]>();
  categories.forEach((category) => {
    const key = category.parentId ?? null;
    byParent.set(key, [...(byParent.get(key) ?? []), category]);
  });
  byParent.forEach((items) => items.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)));

  const rows: CategoryRow[] = [];
  const visit = (parentId: string | null, depth: number, seen = new Set<string>()) => {
    for (const category of byParent.get(parentId) ?? []) {
      if (seen.has(category.id)) continue;
      rows.push({ ...category, depth });
      visit(category.id, depth + 1, new Set([...seen, category.id]));
    }
  };
  visit(null, 0);
  categories
    .filter((category) => !rows.some((row) => row.id === category.id))
    .forEach((category) => rows.push({ ...category, depth: 0 }));
  return rows;
}

function collectDescendantIds(categories: Category[], id: string) {
  const descendants = new Set<string>();
  const visit = (parentId: string) => {
    categories.filter((category) => category.parentId === parentId).forEach((child) => {
      descendants.add(child.id);
      visit(child.id);
    });
  };
  visit(id);
  return descendants;
}

export default function CategoriesPage() {
  const [editing, setEditing] = useState<Category | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [categoryEditorTab, setCategoryEditorTab] = useState<"content" | "translations">("content");
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [countrySearch, setCountrySearch] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const { showToast, ToastComponent } = useToast();

  const { data: categories = [], isLoading, refetch } = useAdminCategories();
  const { data: languages = [] } = useAdminLanguages();
  const { data: countries = [], isLoading: countriesLoading } = useAdminCategoryCountries(editing?.id);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const reorderCategories = useReorderCategories();
  const updateCountries = useUpdateCategoryCountries(editing?.id);

  const translationLanguages = filterTranslationLanguages(languages);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];
  const rows = useMemo(() => flattenCategories(categories), [categories]);
  const categoryGridClass = "grid gap-4 md:grid-cols-[minmax(360px,1fr)_220px_110px_130px_72px] md:items-center";
  const countryRows = useMemo(() => countries as CountryAvailability[], [countries]);
  const visibleCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return countryRows;
    return countryRows.filter((country) =>
      `${country.name} ${country.code} ${country.status}`.toLowerCase().includes(query)
    );
  }, [countryRows, countrySearch]);
  const enabledCountryCount = countryRows.filter((country) => countryOverrides[country.id] ?? country.enabled).length;
  const excludedParentIds = useMemo(() => editing ? collectDescendantIds(categories, editing.id) : new Set<string>(), [categories, editing]);
  const parentOptions = useMemo(() => [
    { value: "", label: "No parent" },
    ...flattenCategories(categories)
      .filter((category) => category.id !== editing?.id && !excludedParentIds.has(category.id))
      .map((category) => ({ value: category.id, label: `${"  ".repeat(category.depth)}${category.depth ? "- " : ""}${category.name}` })),
  ], [categories, editing?.id, excludedParentIds]);

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: {
      name: editing?.name || "",
      slug: editing?.slug || "",
      description: editing?.description || "",
      seoTitle: editing?.seoTitle || "",
      seoDescription: editing?.seoDescription || "",
      image: editing?.image || "",
      parentId: editing?.parentId || "",
      status: editing?.status || "ACTIVE",
    },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting, resetForm, setStatus }) => {
      setStatus("");
      try {
        const payload = {
          ...values,
          name: values.name.trim(),
          slug: values.slug.trim(),
          description: values.description.trim() || null,
          seoTitle: values.seoTitle.trim() || null,
          seoDescription: values.seoDescription.trim() || null,
          image: values.image.trim() || null,
          parentId: values.parentId || null,
        };
        if (editing) {
          await updateCategory.mutateAsync({ id: editing.id, ...payload });
          await updateCountries.mutateAsync((countries as CountryAvailability[]).map((country) => ({
            countryId: country.id,
            enabled: countryOverrides[country.id] ?? country.enabled,
          })));
          showToast("Category updated.");
          setEditing(null);
        } else {
          await createCategory.mutateAsync(payload);
          showToast("Category created. It is hidden in every country until enabled on edit.");
          setShowCreate(false);
        }
        setSlugEdited(false);
        resetForm();
      } catch (error) {
        const message = getAdminErrorMessage(error, "Failed to save category.");
        setStatus(message);
        showToast(message, "error");
      } finally {
        setSubmitting(false);
      }
    },
  });

  const openEditor = (category: Category) => {
    setEditing(category);
    setShowCreate(false);
    setCategoryEditorTab("content");
    setSlugEdited(false);
    setCountryOverrides({});
  };

  const closeEditor = () => {
    setEditing(null);
    setShowCreate(false);
    setCategoryEditorTab("content");
    setSlugEdited(false);
    setCountryOverrides({});
    formik.resetForm();
  };

  const handleNameChange = (value: string) => {
    formik.setFieldValue("name", value);
    if (!slugEdited) formik.setFieldValue("slug", slugify(value));
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("files", file);
    formData.append("folder", "modortho/categories");
    setUploadingImage(true);
    try {
      const response = await adminApi.post("/media", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const uploaded = response.data?.data?.[0];
      if (uploaded?.url) formik.setFieldValue("image", uploaded.url);
      else throw new Error("Upload completed, but no image URL was returned.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Image upload failed."), "error");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/categories/${deleting}`);
      showToast("Category deleted.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete category."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleReorder = async (next: CategoryRow[]) => {
    try {
      await reorderCategories.mutateAsync(toSortOrderPayload(next));
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder categories."), "error");
      refetch();
    }
  };

  const saveCategoryTranslation = async (categoryId: string, languageId: string, field: "name" | "description", value: string) => {
    try {
      await adminApi.put(`/translations/categories/${categoryId}/${languageId}`, { [field]: value.trim() });
      showToast(toastMessages.translationSaved);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, toastMessages.translationFailed), "error");
    }
  };

  const showEditor = !!editing;
  const showCreateModal = showCreate && !editing;

  const openCreateModal = () => {
    setEditing(null);
    setShowCreate(true);
    setCategoryEditorTab("content");
    setTranslationLanguageId("");
    setSlugEdited(false);
    setCountryOverrides({});
    setCountrySearch("");
    formik.resetForm();
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCategoryEditorTab("content");
    setTranslationLanguageId("");
    setSlugEdited(false);
    setCountryOverrides({});
    setCountrySearch("");
    formik.resetForm();
  };

  return (
    <AdminLayout title="Categories" breadcrumb={[{ label: "Categories" }]}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#6B6B6B]">Drag rows to reorder. Child categories are indented under their parent.</p>
        <button
          type="button"
          onClick={openCreateModal}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
        >
          <Plus size={14} />
          Add category
        </button>
      </div>

      <Modal
        open={showEditor}
        onClose={closeEditor}
        title={editing ? `Edit Category: ${editing.name}` : "Category Editor"}
        panelClassName="max-w-5xl max-h-[calc(100vh-2rem)] overflow-y-auto"
      >
        <form onSubmit={formik.handleSubmit} className="space-y-5">
          {editing && (
            <div className="flex justify-start">
              <TranslationModeBar
                editorTab={categoryEditorTab}
                onTabChange={setCategoryEditorTab}
                translationLanguages={translationLanguages}
                selectedLanguageId={translationLanguageId || activeTranslationLang?.id || ""}
                onLanguageChange={setTranslationLanguageId}
              />
            </div>
          )}

          {formik.status && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{formik.status}</div>}

          {(!editing || categoryEditorTab === "content") && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInput label="Name *" placeholder="e.g. Metal Brackets" value={formik.values.name} onChange={(e) => handleNameChange(e.target.value)} onBlur={formik.handleBlur} name="name" error={formik.touched.name ? (formik.errors.name as string) : ""} />
                <AdminInput label="Slug *" placeholder="metal-brackets" value={formik.values.slug} onChange={(e) => { setSlugEdited(true); formik.setFieldValue("slug", slugify(e.target.value)); }} onBlur={formik.handleBlur} name="slug" error={formik.touched.slug ? (formik.errors.slug as string) : ""} />
                <AdminSelect label="Parent category" options={parentOptions} {...formik.getFieldProps("parentId")} />
                <AdminSelect
                  label="Status"
                  options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
                  {...formik.getFieldProps("status")}
                />
              </div>
              <AdminTextarea label="Description" rows={3} {...formik.getFieldProps("description")} />
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <h4 className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">SEO</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminInput label="Meta Title" placeholder="Browser/search title" {...formik.getFieldProps("seoTitle")} />
                  <AdminTextarea label="Meta Description" rows={2} placeholder="Short search description" {...formik.getFieldProps("seoDescription")} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[120px_1fr]">
                <div className="flex h-[92px] w-[120px] items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
                  {formik.values.image ? <img src={formik.values.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-[#9A9A9A]" />}
                </div>
                <div className="space-y-2">
                  <AdminInput label="Image URL" placeholder="/uploads/category.jpg" {...formik.getFieldProps("image")} />
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]">
                    <Upload size={14} /> {uploadingImage ? "Uploading..." : "Upload image"}
                    <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                  </label>
                </div>
              </div>

              {editing ? (
                <section className="rounded-lg border border-[#E6E6E6] p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Country Availability</h4>
                      <p className="mt-0.5 text-[12.5px] text-[#6B6B6B]">
                        New categories start invisible everywhere until countries are enabled here. Use search for long country lists.
                      </p>
                    </div>
                    <span className="text-[12px] text-[#9A9A9A]">
                      {enabledCountryCount} enabled
                    </span>
                  </div>
                  {countriesLoading ? (
                    <div className="h-20 animate-pulse rounded-md bg-[#F2F2F2]" />
                  ) : countryRows.length === 0 ? (
                    <p className="text-[13px] text-[#9A9A9A]">No countries found.</p>
                  ) : (
                    <div className="space-y-3">
                      <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                        <AdminInput
                          aria-label="Search countries"
                          placeholder={`Search ${countryRows.length} countries by name or code`}
                          value={countrySearch}
                          onChange={(event) => setCountrySearch(event.target.value)}
                          className="h-9 lg:max-w-[360px]"
                        />
                        <div className="flex flex-wrap items-center gap-2 text-[12px] text-[#6B6B6B]">
                          <span>Showing {visibleCountries.length} of {countryRows.length}</span>
                          <button
                            type="button"
                            className="rounded border border-[#E6E6E6] px-2.5 py-1 font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]"
                            onClick={() => setCountryOverrides((current) => {
                              const next = { ...current };
                              visibleCountries.forEach((country) => { next[country.id] = true; });
                              return next;
                            })}
                          >
                            Enable visible
                          </button>
                          <button
                            type="button"
                            className="rounded border border-[#E6E6E6] px-2.5 py-1 font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]"
                            onClick={() => setCountryOverrides((current) => {
                              const next = { ...current };
                              visibleCountries.forEach((country) => { next[country.id] = false; });
                              return next;
                            })}
                          >
                            Disable visible
                          </button>
                        </div>
                      </div>
                      <div className="max-h-[320px] overflow-y-auto rounded-md border border-[#E6E6E6] p-2">
                        {visibleCountries.length === 0 ? (
                          <p className="px-2 py-8 text-center text-[13px] text-[#9A9A9A]">No countries match your search.</p>
                        ) : (
                          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                            {visibleCountries.map((country) => (
                              <label key={country.id} className="flex items-center justify-between gap-3 rounded-md border border-[#E6E6E6] px-3 py-2">
                                <span className="min-w-0">
                                  <span className="block truncate text-[13px] font-medium text-[#1A1A1A]">{country.name}</span>
                                  <span className="text-[11.5px] text-[#9A9A9A]">{country.code}{country.status !== "ACTIVE" ? ` · ${country.status}` : ""}</span>
                                </span>
                                <input
                                  type="checkbox"
                                  className="h-4 w-4 accent-[#E31E24]"
                                  checked={countryOverrides[country.id] ?? country.enabled}
                                  onChange={(e) => setCountryOverrides((current) => ({ ...current, [country.id]: e.target.checked }))}
                                />
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                      {countryRows.length > 30 && (
                        <p className="text-[12px] text-[#9A9A9A]">
                          Large country lists are capped in this panel. Search or use Enable/Disable visible to manage countries in batches.
                        </p>
                      )}
                    </div>
                  )}
                </section>
              ) : (
                <div className="rounded-md border border-[#E6E6E6] bg-[#F8F8F8] px-3 py-2 text-[13px] text-[#6B6B6B]">
                  Country Availability appears after creation. New categories are not enabled in any country by default.
                </div>
              )}
            </div>
          )}

          {editing && categoryEditorTab === "translations" && (
            translationLanguages.length === 0 ? (
              <NoTranslationLanguagesMessage />
            ) : activeTranslationLang ? (
              <div className="space-y-4">
                <TranslationEditorBanner language={activeTranslationLang} />
                {(() => {
                  const translation = editing.translations?.find((item) => item.languageId === activeTranslationLang.id);
                  return (
                    <>
                      <TranslationBlurInput
                        key={`name-${activeTranslationLang.id}-${translation?.name ?? ""}`}
                        label="Name"
                        defaultValue={translation?.name || ""}
                        englishReference={editing.name}
                        onSave={(value) => saveCategoryTranslation(editing.id, activeTranslationLang.id, "name", value)}
                      />
                      <TranslationBlurField
                        key={`description-${activeTranslationLang.id}-${translation?.description ?? ""}`}
                        label="Description"
                        rows={2}
                        defaultValue={translation?.description || ""}
                        englishReference={editing.description || ""}
                        onSave={(value) => saveCategoryTranslation(editing.id, activeTranslationLang.id, "description", value)}
                      />
                    </>
                  );
                })()}
              </div>
            ) : null
          )}

          <div className="flex gap-2.5 justify-end">
            {(!editing || categoryEditorTab === "content") && (
              <button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
                {formik.isSubmitting ? "Saving..." : editing ? "Update category" : "Create category"}
              </button>
            )}
            <button type="button" onClick={closeEditor} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] hover:bg-[#F2F2F2]">Cancel</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="Add Category"
        panelClassName="max-w-4xl max-h-[calc(100vh-2.5rem)] overflow-y-auto"
      >
        <form onSubmit={formik.handleSubmit} className="space-y-5">
          <p className="text-[13px] leading-5 text-[#6B6B6B]">
            Create the category now. Country availability and translation work can be refined after saving.
          </p>

          {formik.status && <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-[13px] text-red-700">{formik.status}</div>}

          <div className="grid gap-4 md:grid-cols-2">
            <AdminInput
              label="Name *"
              placeholder="e.g. Metal Brackets"
              value={formik.values.name}
              onChange={(e) => handleNameChange(e.target.value)}
              onBlur={formik.handleBlur}
              name="name"
              error={formik.touched.name ? (formik.errors.name as string) : ""}
            />
            <AdminInput
              label="Slug *"
              placeholder="metal-brackets"
              value={formik.values.slug}
              onChange={(e) => {
                setSlugEdited(true);
                formik.setFieldValue("slug", slugify(e.target.value));
              }}
              onBlur={formik.handleBlur}
              name="slug"
              error={formik.touched.slug ? (formik.errors.slug as string) : ""}
            />
            <AdminSelect label="Parent category" options={parentOptions} {...formik.getFieldProps("parentId")} />
            <AdminSelect
              label="Status"
              options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
              {...formik.getFieldProps("status")}
            />
          </div>

          <AdminTextarea label="Description" rows={3} {...formik.getFieldProps("description")} />

          <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
            <h4 className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">SEO</h4>
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput label="Meta Title" placeholder="Browser/search title" {...formik.getFieldProps("seoTitle")} />
              <AdminTextarea label="Meta Description" rows={2} placeholder="Short search description" {...formik.getFieldProps("seoDescription")} />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-[120px_1fr]">
            <div className="flex h-[92px] w-[120px] items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
              {formik.values.image ? <img src={formik.values.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-[#9A9A9A]" />}
            </div>
            <div className="space-y-2">
              <AdminInput label="Image URL" placeholder="/uploads/category.jpg" {...formik.getFieldProps("image")} />
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]">
                <Upload size={14} /> {uploadingImage ? "Uploading..." : "Upload image"}
                <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(e) => handleImageUpload(e.target.files?.[0])} />
              </label>
            </div>
          </div>

          <div className="flex gap-2.5 justify-end">
            <button type="button" onClick={closeCreateModal} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] hover:bg-[#F2F2F2]">
              Cancel
            </button>
            <button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
              {formik.isSubmitting ? "Creating..." : "Create category"}
            </button>
          </div>
        </form>
      </Modal>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, index) => <div key={index} className="h-20 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">No categories yet.</div>
      ) : (
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-3">
          <div className="mb-2 hidden items-center gap-2 px-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A] md:flex">
            <span className="w-8 shrink-0" />
            <div className={`${categoryGridClass} min-w-0 flex-1 pr-3`}>
              <span>Name</span>
              <span>Slug</span>
              <span>Products</span>
              <span>Status</span>
              <span className="text-right">Actions</span>
            </div>
          </div>
          <SortableList
            items={rows}
            onReorder={handleReorder}
            handleAriaLabel="Drag category to reorder"
            renderItem={(category) => (
              <div className={categoryGridClass}>
                <div className="flex min-w-0 items-center gap-3" style={{ paddingLeft: `${Math.min(category.depth, 4) * 18}px` }}>
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
                    {category.image ? <img src={category.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={17} className="text-[#9A9A9A]" />}
                  </div>
                  <div className="min-w-0">
                    <div className="truncate text-[14px] font-semibold text-[#1A1A1A]">{category.name}</div>
                    {category.parent && <div className="text-[12px] text-[#9A9A9A]">Child of {category.parent.name}</div>}
                  </div>
                </div>
                <span className="truncate font-mono text-[12px] text-[#6B6B6B]">{category.slug}</span>
                <span className="text-[13px] text-[#1A1A1A]">{category._count.products}</span>
                <StatusBadge status={category.status} />
                <div className="flex gap-1.5 md:justify-end">
                  <button type="button" onClick={() => openEditor(category)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Pencil size={13} /></button>
                  <button type="button" onClick={() => setDeleting(category.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
                </div>
              </div>
            )}
          />
        </div>
      )}

      <ConfirmModal
        open={!!deleting}
        title="Delete category?"
        message="This soft deletes the category. Products are not deleted."
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
