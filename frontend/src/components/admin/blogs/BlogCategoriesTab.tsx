"use client";

import { useState } from "react";
import { Edit2, Trash2 } from "lucide-react";
import {
  AdminInput,
  ConfirmModal,
  DataTable,
  LoadingButton,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import {
  useAdminBlogCategories,
  useCreateBlogCategory,
  useDeleteBlogCategory,
  useUpdateBlogCategory,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { slugify } from "@/utils/slugify";

type Row = {
  id: string;
  name: string;
  slug: string;
  description?: string | null;
  _count?: { blogs: number };
};

const emptyForm = { id: "", name: "", slug: "", description: "" };

export function BlogCategoriesTab() {
  const [form, setForm] = useState(emptyForm);
  const [slugEdited, setSlugEdited] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data = [], isLoading } = useAdminBlogCategories();
  const createRow = useCreateBlogCategory();
  const updateRow = useUpdateBlogCategory();
  const deleteRow = useDeleteBlogCategory();

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
        showToast("Category updated.");
      } else {
        await createRow.mutateAsync(form);
        showToast("Category created.");
      }
      setForm(emptyForm);
      setSlugEdited(false);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save category."), "error");
    }
  };

  const startEdit = (row: Row) => {
    setForm({
      id: row.id,
      name: row.name,
      slug: row.slug,
      description: row.description ?? "",
    });
    setSlugEdited(true);
  };

  const columns: Column<Row>[] = [
    {
      key: "name",
      label: "Category Name",
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          <div className="text-[12px] text-[#9A9A9A]">/{row.slug}</div>
        </div>
      ),
    },
    {
      key: "description",
      label: "Description",
      render: (row) => row.description || "-",
    },
    {
      key: "blogs",
      label: "Blog Count",
      render: (row) => row._count?.blogs ?? 0,
    },
    {
      key: "actions",
      label: "",
      width: "90px",
      render: (row) => (
        <div className="flex gap-1.5">
          <button
            onClick={() => startEdit(row)}
            className="flex h-7 w-7 items-center justify-center rounded border hover:bg-gray-50"
            title="Edit Category"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-7 w-7 items-center justify-center rounded border text-red-500 hover:bg-red-50"
            title="Delete Category"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  const isSubmitting = createRow.isPending || updateRow.isPending;

  return (
    <div>
      <form
        onSubmit={save}
        className="mb-6 rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-sm"
      >
        <h3 className="mb-4 text-[15px] font-semibold text-[#1A1A1A]">
          {form.id ? "Edit Blog Category" : "Add New Blog Category"}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <AdminInput
            label="Name *"
            value={form.name}
            onChange={handleNameChange}
            placeholder="e.g. Clinical"
          />
          <AdminInput
            label="Slug"
            value={form.slug}
            onChange={handleSlugChange}
            placeholder="clinical"
          />
          <AdminInput
            label="Description"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="Brief description"
          />
        </div>
        <div className="mt-4 flex items-center gap-2">
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText={form.id ? "Updating..." : "Adding..."}
            className="h-10 rounded-md bg-[#E31E24] px-5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
          >
            {form.id ? "Update Category" : "Add Category"}
          </LoadingButton>
          {form.id && (
            <button
              type="button"
              onClick={() => {
                setForm(emptyForm);
                setSlugEdited(false);
              }}
              className="h-10 rounded-md border border-[#E6E6E6] px-4 text-[13px] font-medium text-[#555] hover:bg-gray-50"
            >
              Cancel Edit
            </button>
          )}
        </div>
      </form>

      <DataTable
        columns={columns}
        data={data as Row[]}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No blog categories found."
      />

      <ConfirmModal
        open={!!deleting}
        title="Delete category?"
        message="Categories currently linked to blog posts cannot be deleted."
        onCancel={() => setDeleting(null)}
        isLoading={deleteRow.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteRow.mutateAsync(deleting);
            showToast("Category deleted.");
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
