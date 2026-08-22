"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import * as Yup from "yup";
import { Archive, AlertCircle, CheckCircle2, Copy, Download, FolderTree, GitFork, Image as ImageIcon, Layers, Pencil, Plus, RotateCcw, Search, Trash2, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminListToolbar, AdminSelect, AdminStatsGrid, AdminTextarea, AdminRichTextEditor, ConfirmModal, StatCard, StatusBadge, toastMessages, useToast, LoadingButton, AdminBulkActionsBar, DataTable, TableStatusAction } from "@/components/admin/AdminComponents";
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
  useArchiveCategory,
  useDeleteCategory,
  useDuplicateCategory,
  useCreateCategory,
  useReorderCategories,
  useRestoreCategory,
  useUpdateCategory,
  useUpdateCategoryCountries,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { slugify } from "@/utils/slugify";
import { uploadMediaFiles } from "@/utils/uploadMedia";

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

type SpreadsheetIssue = { row: number; field: string; message: string };
type SpreadsheetPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: SpreadsheetIssue[];
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

import { CATEGORY_DESCRIPTION_MAX_LENGTH } from "@/constants/category.constants";
import { stripHtmlTags } from "@/utils/sanitize";

const schema = Yup.object({
  name: Yup.string().trim().required("Name is required"),
  slug: Yup.string().trim().required("Slug is required"),
  description: Yup.string().test(
    "max-description-chars",
    `Category description cannot exceed ${CATEGORY_DESCRIPTION_MAX_LENGTH} characters`,
    (val) => {
      if (!val) return true;
      return stripHtmlTags(val).length <= CATEGORY_DESCRIPTION_MAX_LENGTH;
    }
  ),
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
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("categories.create");
  const canUpdate = hasPermission("categories.update");
  const canDelete = hasPermission("categories.delete");

  const [editing, setEditing] = useState<Category | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<SpreadsheetPreview | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [categoryEditorTab, setCategoryEditorTab] = useState<"content" | "translations">("content");
  const [translationLanguageId, setTranslationLanguageId] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [countryOverrides, setCountryOverrides] = useState<Record<string, boolean>>({});
  const [countrySearch, setCountrySearch] = useState("");
  const [uploadingImage, setUploadingImage] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, ToastComponent } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;

    if (bulkAction === "delete") {
      if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected category(ies)? This action cannot be undone.`)) {
        return;
      }
    }

    setBulkSaving(true);
    try {
      if (bulkAction === "delete") {
        await Promise.all(selectedIds.map(id => deleteCategory.mutateAsync(id)));
        showToast(`Successfully deleted ${selectedIds.length} category(ies).`, "success");
      } else if (bulkAction === "activate") {
        await Promise.all(selectedIds.map(id => updateCategory.mutateAsync({ id, status: "ACTIVE" })));
        showToast(`Successfully activated ${selectedIds.length} category(ies).`, "success");
      } else if (bulkAction === "deactivate") {
        await Promise.all(selectedIds.map(id => updateCategory.mutateAsync({ id, status: "INACTIVE" })));
        showToast(`Successfully deactivated ${selectedIds.length} category(ies).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const { data: categories = [], isLoading, refetch } = useAdminCategories();

  const categoryStats = useMemo(() => {
    const total = categories.length;
    const active = categories.filter((c: Category) => c.status === "ACTIVE").length;
    const root = categories.filter((c: Category) => !c.parentId).length;
    const sub = categories.filter((c: Category) => !!c.parentId).length;
    return { total, active, root, sub };
  }, [categories]);
  const { data: languages = [] } = useAdminLanguages();
  const { data: countries = [], isLoading: countriesLoading } = useAdminCategoryCountries(editing?.id);
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();
  const duplicateCategory = useDuplicateCategory();
  const archiveCategory = useArchiveCategory();
  const restoreCategory = useRestoreCategory();
  const reorderCategories = useReorderCategories();
  const updateCountries = useUpdateCategoryCountries(editing?.id);

  const translationLanguages = filterTranslationLanguages(languages);
  const activeTranslationLang = translationLanguages.find((lang) => lang.id === translationLanguageId) ?? translationLanguages[0];
  const filteredCategories = useMemo(() => {
    const query = search.trim().toLowerCase();
    return (categories as Category[]).filter((category) => {
      const matchesSearch = !query || `${category.name} ${category.slug} ${category.parent?.name || ""}`.toLowerCase().includes(query);
      const matchesStatus = !statusFilter || category.status === statusFilter;
      return matchesSearch && matchesStatus;
    });
  }, [categories, search, statusFilter]);
  const rows = useMemo(() => flattenCategories(filteredCategories), [filteredCategories]);
  const categoryGridClass = "grid w-full min-w-0 gap-3 md:grid-cols-[40px_minmax(320px,1.2fr)_minmax(180px,220px)_90px_120px_168px] md:items-center";

  useEffect(() => {
    setSelectedIds([]);
  }, [search, statusFilter]);
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

  const form = useAdminForm({
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
        form.reset();
      } catch (error) {
        const message = getAdminErrorMessage(error, "Failed to save category.");
        setStatus(message);
        showToast(message, "error");
      } finally {
        
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
    form.reset();
  };

  const handleNameChange = (value: string) => {
    form.setFieldValue("name", value);
    if (!slugEdited) form.setFieldValue("slug", slugify(value));
  };

  const handleImageUpload = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    try {
      const results = await uploadMediaFiles([file], {
        entityType: "CATEGORY",
        entityId: editing?.id || undefined
      });
      const uploaded = results[0];
      if (uploaded?.url) form.setFieldValue("image", uploaded.url);
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
      await deleteCategory.mutateAsync(deleting);
      showToast("Category deleted.");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete category."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateCategory.mutateAsync(id);
      showToast("Category duplicated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate category."), "error");
    }
  };

  const handleArchiveToggle = async (category: Category) => {
    try {
      if (category.status === "ACTIVE") {
        await archiveCategory.mutateAsync(category.id);
        showToast("Category archived.");
      } else {
        await restoreCategory.mutateAsync(category.id);
        showToast("Category restored.");
      }
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update category status."), "error");
    }
  };

  const exportCategories = async () => {
    try {
      const response = await adminApi.get("/categories/export", { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "categories-export.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export categories."), "error");
    }
  };

  const openImportDialog = () => {
    setImportPreview(null);
    setImportMessage("");
    setImportFile(null);
    setImportOpen(true);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setImportFile(file);
    setImportMessage("Previewing spreadsheet...");
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await adminApi.post("/categories/import/preview", formData);
      const report = response.data?.data as SpreadsheetPreview;
      setImportPreview(report);
      setImportMessage(report.invalidRows > 0 ? "Fix the validation issues before importing." : "Preview looks good. You can import now.");
    } catch (error) {
      setImportMessage(getAdminErrorMessage(error, "Failed to preview spreadsheet."));
      setImportPreview(null);
    }
  };

  const confirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const response = await adminApi.post("/categories/import", formData);
      const result = response.data?.data as { created: number; updated: number; report: SpreadsheetPreview };
      showToast(`Imported ${result.created} created and ${result.updated} updated categories.`);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import spreadsheet."), "error");
    } finally {
      setImporting(false);
    }
  };

  const handleReorder = async (next: CategoryRow[]) => {
    if (!canUpdate) {
      showToast("You do not have permission to edit categories.", "error");
      refetch();
      return;
    }
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
    form.reset();
  };

  const closeCreateModal = () => {
    setShowCreate(false);
    setCategoryEditorTab("content");
    setTranslationLanguageId("");
    setSlugEdited(false);
    setCountryOverrides({});
    setCountrySearch("");
    form.reset();
  };

  const toggleStatus = async (category: CategoryRow) => {
    if (!canUpdate) {
      showToast("You do not have permission to update categories.", "error");
      return;
    }
    const nextStatus = category.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateCategory.mutateAsync({ id: category.id, status: nextStatus });
      showToast(`Category marked ${nextStatus.toLowerCase()}.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update category status."), "error");
    }
  };

  const runBulk = async (action: string) => {
    if (selectedIds.length === 0) return;

    if (action === "delete") {
      if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected category(ies)? This action cannot be undone.`)) {
        return;
      }
    }

    setBulkSaving(true);
    setBulkAction(action);
    try {
      if (action === "delete") {
        await Promise.all(selectedIds.map((id) => deleteCategory.mutateAsync(id)));
        showToast(`Successfully deleted ${selectedIds.length} category(ies).`);
      } else if (action === "activate") {
        await Promise.all(selectedIds.map((id) => updateCategory.mutateAsync({ id, status: "ACTIVE" })));
        showToast(`Successfully activated ${selectedIds.length} category(ies).`);
      } else if (action === "deactivate") {
        await Promise.all(selectedIds.map((id) => updateCategory.mutateAsync({ id, status: "INACTIVE" })));
        showToast(`Successfully deactivated ${selectedIds.length} category(ies).`);
      }
      setSelectedIds([]);
      setBulkAction("");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
      setBulkAction("");
    }
  };

  const columns = useMemo(
    () => [
      {
        key: "preview",
        label: "PREVIEW",
        width: "76px",
        render: (row: CategoryRow) => (
          <div className="flex h-10 w-14 items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
            {row.image ? (
              <img src={row.image} alt={row.name} className="h-full w-full object-cover" />
            ) : (
              <ImageIcon size={18} className="text-[#9A9A9A]" />
            )}
          </div>
        ),
      },
      {
        key: "title",
        label: "TITLE & SLUG",
        width: "auto",
        render: (row: CategoryRow) => (
          <div className="flex min-w-0 items-center gap-2" style={{ paddingLeft: `${Math.min(row.depth, 4) * 14}px` }}>
            <div className="min-w-0 space-y-0.5">
              <div className="truncate text-[13.5px] font-semibold text-[#1A1A1A]">{row.name}</div>
              <div className="flex items-center gap-2 text-[11.5px] text-[#888]">
                <code className="font-mono text-[#6B6B6B]">/{row.slug}</code>
                {row.parent && <span className="text-gray-400">• Child of {row.parent.name}</span>}
              </div>
            </div>
          </div>
        ),
      },
      {
        key: "products",
        label: "PRODUCTS",
        width: "120px",
        render: (row: CategoryRow) => (
          <span className="text-[12.5px] font-medium text-[#555]">
            {row._count.products} {row._count.products === 1 ? "product" : "products"}
          </span>
        ),
      },
      {
        key: "status",
        label: "STATUS",
        width: "110px",
      },
      {
        key: "actions",
        label: "ACTIONS",
        width: "140px",
        render: (row: CategoryRow) => (
          <div className="flex items-center justify-end gap-1.5">
            {canCreate && (
              <button
                type="button"
                onClick={() => handleDuplicate(row.id)}
                className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50 hover:text-[#1A1A1A] transition-colors"
                title="Duplicate category"
              >
                <Copy size={13} />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => handleArchiveToggle(row)}
                className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50 hover:text-[#1A1A1A] transition-colors"
                title={row.status === "ACTIVE" ? "Archive category" : "Restore category"}
              >
                {row.status === "ACTIVE" ? <Archive size={13} /> : <RotateCcw size={13} />}
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => openEditor(row)}
                className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50 hover:text-[#1A1A1A] transition-colors"
                title="Edit category"
              >
                <Pencil size={13} />
              </button>
            )}
            {canDelete && (
              <button
                type="button"
                onClick={() => setDeleting(row.id)}
                className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 transition-colors"
                title="Delete category"
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ),
      },
    ],
    [canCreate, canUpdate, canDelete, handleDuplicate, handleArchiveToggle, openEditor],
  );

  return (
    <AdminLayout title="Categories" breadcrumb={[{ label: "Categories" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Total Categories", value: categoryStats.total, subtitle: "Catalog taxonomy structure", icon: <FolderTree size={18} /> },
          { title: "Active Categories", value: categoryStats.active, subtitle: "Visible on navigation & catalog", icon: <CheckCircle2 size={18} />, color: "bg-green-600" },
          { title: "Top-Level Categories", value: categoryStats.root, subtitle: "Root catalog categories", icon: <Layers size={18} />, color: "bg-indigo-600" },
          { title: "Sub-Categories", value: categoryStats.sub, subtitle: "Child & nested categories", icon: <GitFork size={18} />, color: "bg-blue-600" }
        ]}
        isLoading={isLoading}
      />

      <AdminListToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search categories...",
          widthClassName: "w-[220px]",
        }}
        leftExtra={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="h-10 rounded-md border border-[#E6E6E6] bg-white px-3 text-[13.5px] outline-none hover:border-[#D1D1D1]"
          >
            <option value="">All status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        }
        exportAction={{
          onClick: exportCategories,
          label: "Export Excel",
        }}
        importAction={canCreate ? {
          onClick: openImportDialog,
          label: "Import Excel",
        } : undefined}
        refresh={{
          onRefresh: refetch,
          isRefreshing: isLoading,
        }}
        primaryAction={canCreate ? {
          onClick: openCreateModal,
          label: "Add category",
        } : undefined}
      />
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
      onChange={(event) => {
            void handleImportFile(event.target.files?.[0] || undefined);
            event.currentTarget.value = "";
          }}
        />
      <Modal
        open={showEditor}
        onClose={closeEditor}
        title={editing ? `Edit Category: ${editing.name}` : "Category Editor"}
        panelClassName="max-w-5xl max-h-[85vh]"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button type="button" onClick={closeEditor} className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors">
              Cancel
            </button>
            {(!editing || categoryEditorTab === "content") && (
              <LoadingButton
                type="submit"
                form="category-edit-form"
                loading={form.isSubmitting}
                loadingText="Saving..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
              >
                {editing ? "Update category" : "Create category"}
              </LoadingButton>
            )}
          </div>
        }
      >
        <form id="category-edit-form" onSubmit={form.handleSubmit} className="space-y-6 p-6">
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

          {form.status && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Unable to save category</p>
                <p className="mt-0.5">{form.status}</p>
              </div>
            </div>
          )}

          {(!editing || categoryEditorTab === "content") && (
            <div className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInput label="Name" placeholder="e.g. Metal Brackets" value={form.values.name} onChange={(e) => handleNameChange(e.target.value)} onBlur={form.handleBlur} name="name" error={form.errors.name as string} />
                <AdminInput label="Slug" placeholder="metal-brackets" value={form.values.slug} onChange={(e) => { setSlugEdited(true); form.setFieldValue("slug", slugify(e.target.value)); }} onBlur={form.handleBlur} name="slug" error={form.errors.slug as string} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <AdminSelect label="Parent category" options={parentOptions} {...form.getFieldProps("parentId")} />
                <AdminSelect
                  label="Status"
                  options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
                  {...form.getFieldProps("status")}
                />
              </div>
              <AdminRichTextEditor
                label="Description"
                value={form.values.description}
                onChange={(val) => form.setFieldValue("description", val)}
                maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
                showCharCount={true}
                hideImageUpload={true}
                compact={true}
                error={form.errors.description as string}
              />
              <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <h4 className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">SEO</h4>
                <div className="grid gap-4 md:grid-cols-2">
                  <AdminInput label="Meta Title" placeholder="Browser/search title" {...form.getFieldProps("seoTitle")} />
                  <AdminTextarea label="Meta Description" rows={2} placeholder="Short search description" {...form.getFieldProps("seoDescription")} />
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-[120px_1fr]">
                <div className="flex h-[92px] w-[120px] items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
                  {form.values.image ? <img src={form.values.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-[#9A9A9A]" />}
                </div>
                <div className="space-y-2">
                  <AdminInput label="Image URL" placeholder="/uploads/category.jpg" {...form.getFieldProps("image")} />
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
              ) : null}
            </div>
          )}

          {editing && categoryEditorTab === "translations" && (
            activeTranslationLang ? (
              <div className="space-y-4 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
                <div className="border-b border-[#E6E6E6] pb-3">
                  <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">
                    Editing {activeTranslationLang.name} Translation
                  </h4>
                  <p className="mt-0.5 text-[12px] text-[#6B6B6B]">
                    Values save automatically on blur. English reference values are shown above each field.
                  </p>
                </div>

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
                        maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
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
        </form>
      </Modal>

      <Modal
        open={showCreateModal}
        onClose={closeCreateModal}
        title="Add Category"
        panelClassName="max-w-4xl max-h-[85vh]"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button type="button" onClick={closeCreateModal} className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors">
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="category-create-form"
              loading={form.isSubmitting}
              loadingText="Creating..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
            >
              Create category
            </LoadingButton>
          </div>
        }
      >
        <form id="category-create-form" onSubmit={form.handleSubmit} className="space-y-5 p-6">
          <p className="text-[13px] leading-5 text-[#6B6B6B]">
            Create the category now. Country availability and translation work can be refined after saving.
          </p>

          {form.status && (
            <div className="rounded-md border border-red-200 bg-red-50 p-3 text-[13px] text-red-700 flex items-start gap-2.5">
              <AlertCircle size={16} className="text-red-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-red-800">Unable to save category</p>
                <p className="mt-0.5">{form.status}</p>
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput
                label="Name"
                placeholder="e.g. Metal Brackets"
                value={form.values.name}
                onChange={(e) => handleNameChange(e.target.value)}
                onBlur={form.handleBlur}
                name="name"
                error={form.errors.name as string}
              />
              <AdminInput
                label="Slug"
                placeholder="metal-brackets"
                value={form.values.slug}
                onChange={(e) => {
                  setSlugEdited(true);
                  form.setFieldValue("slug", slugify(e.target.value));
                }}
                onBlur={form.handleBlur}
                name="slug"
                error={form.errors.slug as string}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelect label="Parent category" options={parentOptions} {...form.getFieldProps("parentId")} />
              <AdminSelect
                label="Status"
                options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]}
                {...form.getFieldProps("status")}
              />
            </div>

            <AdminRichTextEditor
              label="Description"
              value={form.values.description}
              onChange={(val) => form.setFieldValue("description", val)}
              maxLength={CATEGORY_DESCRIPTION_MAX_LENGTH}
              showCharCount={true}
              hideImageUpload={true}
              compact={true}
              error={form.errors.description as string}
            />

            <div className="rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <h4 className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">SEO</h4>
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInput label="Meta Title" placeholder="Browser/search title" {...form.getFieldProps("seoTitle")} />
                <AdminTextarea label="Meta Description" rows={2} placeholder="Short search description" {...form.getFieldProps("seoDescription")} />
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-[120px_1fr]">
              <div className="flex h-[92px] w-[120px] items-center justify-center overflow-hidden rounded-md border border-[#E6E6E6] bg-[#F8F8F8]">
                {form.values.image ? <img src={form.values.image} alt="" className="h-full w-full object-cover" /> : <ImageIcon size={22} className="text-[#9A9A9A]" />}
              </div>
              <div className="space-y-2">
                <AdminInput label="Image URL" placeholder="/uploads/category.jpg" {...form.getFieldProps("image")} />
                <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]">
                  <Upload size={14} /> {uploadingImage ? "Uploading..." : "Upload image"}
                  <input type="file" accept="image/*" className="hidden" disabled={uploadingImage} onChange={(e) => handleImageUpload(e.target.files?.[0])} />
                </label>
              </div>
            </div>
          </div>
        </form>
      </Modal>

      <DataTable
        title="Categories List"
        columns={columns}
        data={rows}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No categories found."
        enableSelection={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        enableReorder={canUpdate && !search && !statusFilter}
        onReorder={handleReorder}
        disabledReorder={reorderCategories.isPending}
        onToggleStatus={toggleStatus}
        statusLoadingId={updateCategory.isPending ? ((updateCategory.variables as any)?.id ?? null) : null}
        renderBulkActions={(selectedIds) => (
          <AdminBulkActionsBar
            selectedCount={selectedIds.length}
            onClear={() => setSelectedIds([])}
            actionType={bulkAction}
            onActionTypeChange={setBulkAction}
            actions={[
              { value: "activate", label: "Enable" },
              { value: "deactivate", label: "Disable" },
              { value: "delete", label: "Delete" },
            ]}
            onApply={() => runBulk(bulkAction)}
            applyLoading={bulkSaving}
          />
        )}
      />

      <ConfirmModal
        open={!!deleting}
        title="Delete category?"
        message="This soft deletes the category. Deletion is blocked if products or child categories still reference it."
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteCategory.isPending}
      />

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Categories Excel"
        panelClassName="max-w-4xl max-h-[calc(100vh-2.5rem)] overflow-y-auto"
      >
        <div className="space-y-4 p-6">
          <p className="text-[13.5px] leading-5 text-[#6B6B6B]">
            Upload an `.xlsx` or `.csv` file. The first sheet is validated on the server before any category is created or updated.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
            >
              Choose File
            </button>
            <span className="text-[13px] text-[#6B6B6B]">{importFile ? importFile.name : "No file selected"}</span>
          </div>
          {importMessage ? <div className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#1A1A1A]">{importMessage}</div> : null}
          {importPreview ? (
            <div className="space-y-4 rounded-lg border border-[#E6E6E6] bg-white p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Rows</div>
                  <div className="mt-1 text-[20px] font-semibold text-[#1A1A1A]">{importPreview.totalRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Valid</div>
                  <div className="mt-1 text-[20px] font-semibold text-green-600">{importPreview.validRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Invalid</div>
                  <div className="mt-1 text-[20px] font-semibold text-red-600">{importPreview.invalidRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Warnings</div>
                  <div className="mt-1 text-[20px] font-semibold text-amber-600">{importPreview.duplicateWarnings.length}</div>
                </div>
              </div>
              {importPreview.issues.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">Validation Issues</h4>
                  <div className="max-h-48 overflow-y-auto rounded border border-[#E6E6E6]">
                    {importPreview.issues.map((issue, index) => (
                      <div key={`${issue.row}-${issue.field}-${index}`} className="border-b border-[#F0F0F0] px-3 py-2 text-[13px] last:border-b-0">
                        <span className="font-semibold text-[#E31E24]">Row {issue.row}</span> <span className="text-[#6B6B6B]">[{issue.field}]</span> {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2.5">
            <button type="button" onClick={() => setImportOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium text-[#555] hover:bg-[#F2F2F2]">
              Close
            </button>
            <LoadingButton
              type="button"
              onClick={confirmImport}
              loading={importing}
              loadingText="Importing..."
              disabled={!importFile || !!importPreview?.invalidRows}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
            >
              Import Categories
            </LoadingButton>
          </div>
        </div>
      </Modal>
      {ToastComponent}
    </AdminLayout>
  );
}
