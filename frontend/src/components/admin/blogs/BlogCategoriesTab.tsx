"use client";

import { useState } from "react";
import { ArrowLeft, Edit2, Plus, Save, Trash2 } from "lucide-react";
import {
  AdminInput,
  AdminListToolbar,
  AdminTextarea,
  ConfirmModal,
  DataTable,
  LoadingButton,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminBlogCategories,
  useCreateBlogCategory,
  useDeleteBlogCategory,
  useUpdateBlogCategory,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { slugify } from "@/utils/slugify";

type CategoryRow = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { blogs: number };
};

const emptyForm = { id: "", name: "", slug: "", description: "" };

export function BlogCategoriesTab() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { showToast, ToastComponent } = useToast();
  const { data = [], isLoading } = useAdminBlogCategories();
  const createRow = useCreateBlogCategory();
  const updateRow = useUpdateBlogCategory();
  const deleteRow = useDeleteBlogCategory();

  const categories = (data as CategoryRow[]).filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.slug.toLowerCase().includes(q);
  });

  const openNew = () => {
    setForm(emptyForm);
    setSlugEdited(false);
    setShowModal(true);
  };

  const openEdit = (row: CategoryRow) => {
    setForm({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
    });
    setSlugEdited(true);
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
  };

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setForm((prev) => ({
      ...prev,
      name: val,
      slug: !slugEdited ? slugify(val) : prev.slug,
    }));
  };

  const handleSlugChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true);
    setForm((prev) => ({ ...prev, slug: slugify(e.target.value) }));
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      showToast("Category name is required.", "error");
      return;
    }
    try {
      if (form.id) {
        await updateRow.mutateAsync(form);
        showToast("Category updated successfully.");
      } else {
        await createRow.mutateAsync(form);
        showToast("Category created successfully.");
      }
      closeModal();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save category."), "error");
    }
  };

  const columns: Column<CategoryRow>[] = [
    {
      key: "name",
      label: "Category Name & Slug",
      render: (row) => (
        <div className="pr-3 min-w-0">
          <div className="font-semibold text-[#1A1A1A] text-[13.5px]">{row.name}</div>
          <div className="text-[11.5px] text-[#888]">/{row.slug}</div>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row) => (
        <span className="text-[13px] text-[#555] line-clamp-1">
          {row.description || "—"}
        </span>
      ),
    },
    {
      key: "blogs",
      label: "Post Count",
      width: "120px",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-gray-700">
          {row._count?.blogs ?? 0} {row._count?.blogs === 1 ? "post" : "posts"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "90px",
      render: (row) => (
        <div className="flex items-center justify-end gap-1.5">
          <button
            onClick={() => openEdit(row)}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#555] hover:bg-gray-50 hover:text-[#1A1A1A] transition-colors"
            title="Edit Category"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 transition-colors"
            title="Delete Category"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div>
      <AdminListToolbar
        search={{
          value: search,
          onChange: setSearch,
          placeholder: "Search category name or slug...",
          widthClassName: "max-w-[320px]",
        }}
        primaryAction={{
          onClick: openNew,
          label: "Add Category",
          icon: <Plus size={14} />,
        }}
      />

      <DataTable
        title="Blog Categories"
        description="Organize blog articles into thematic categories."
        columns={columns}
        data={categories}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No blog categories found."
      />

      {/* Unified Add/Edit Category Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        panelClassName="max-w-xl max-h-[90vh] overflow-y-auto"
      >
        <form onSubmit={save} className="flex flex-col h-full">
          <div className="sticky top-0 z-20 flex items-center justify-between border-b border-[#E6E6E6] bg-white px-6 py-4 shadow-xs">
            <div>
              <h3 className="text-[15.5px] font-bold text-ink">
                {form.id ? "Edit Blog Category" : "Add New Blog Category"}
              </h3>
              <p className="text-[11.5px] text-steel-2">
                Changes are not applied until you save.
              </p>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={closeModal}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 text-[13px] font-semibold text-[#555] hover:bg-gray-50 transition-colors"
              >
                <ArrowLeft size={14} /> Back
              </button>
              <LoadingButton
                type="submit"
                loading={createRow.isPending || updateRow.isPending}
                loadingText="Saving..."
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-[#E31E24] px-5 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors"
              >
                <Save size={14} /> Save Changes
              </LoadingButton>
            </div>
          </div>

          <div className="p-6 space-y-4">
            <AdminInput
              label="Category Name *"
              value={form.name}
              onChange={handleNameChange}
              placeholder="e.g. Clinical Research"
              required
            />
            <div>
              <AdminInput
                label="Slug *"
                value={form.slug}
                onChange={handleSlugChange}
                placeholder="clinical-research"
                required
              />
              <p className="mt-1 text-[11.5px] text-gray-500">
                Slug path: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">/{form.slug || "your-slug"}</code>
              </p>
            </div>
            <AdminTextarea
              label="Description"
              rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Brief description of articles covered in this category..."
            />
          </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        open={!!deleting}
        title="Delete category?"
        message="This will permanently delete the category. Articles under this category will remain, but will no longer be assigned to it."
        onCancel={() => setDeleting(null)}
        isLoading={deleteRow.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteRow.mutateAsync(deleting);
            showToast("Category deleted successfully.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete category."), "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      {ToastComponent}
    </div>
  );
}
