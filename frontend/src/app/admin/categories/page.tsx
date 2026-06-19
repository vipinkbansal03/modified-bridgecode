"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, ConfirmModal, AdminInput, AdminTextarea, useToast } from "@/components/admin/AdminComponents";
import { useAdminCategories, useCreateCategory, useUpdateCategory } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, Pencil, Trash2, X } from "lucide-react";

interface Category { id: string; name: string; slug: string; description: string; status: string; _count: { products: number }; parent?: { name: string } }

const schema = Yup.object({ name: Yup.string().required("Name is required"), description: Yup.string() });

export default function CategoriesPage() {
  const [editing, setEditing] = useState<Category | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();

  const { data: categories = [], isLoading, refetch } = useAdminCategories();
  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();

  const formik = useFormik({
    enableReinitialize: true,
    initialValues: { name: editing?.name || "", description: editing?.description || "" },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try {
        if (editing) {
          await updateCategory.mutateAsync({ id: editing.id, ...values });
          showToast("Category updated.");
          setEditing(null);
        } else {
          await createCategory.mutateAsync(values);
          showToast("Category created.");
          setShowCreate(false);
        }
        resetForm();
      } catch { showToast("Failed.", "error"); }
      finally { setSubmitting(false); }
    },
  });

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await adminApi.delete(`/categories/${deleting}`);
      showToast("Category deleted.");
      refetch();
    } catch { showToast("Failed.", "error"); }
    finally { setDeleting(null); }
  };

  const columns: Column<Category>[] = [
    { key: "name", label: "Name", render: (r) => <span className="font-medium text-[#1A1A1A]">{r.name}</span> },
    { key: "slug", label: "Slug", render: (r) => <span className="font-mono text-[12px] text-[#6B6B6B]">{r.slug}</span> },
    { key: "products", label: "Products", render: (r) => r._count.products },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions", label: "", width: "80px",
      render: (r) => (
        <div className="flex gap-1.5">
          <button onClick={() => { setEditing(r); setShowCreate(false); }} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"><Pencil size={13} /></button>
          <button onClick={() => setDeleting(r.id)} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button>
        </div>
      ),
    },
  ];

  const showForm = showCreate || !!editing;

  return (
    <AdminLayout title="Categories" breadcrumb={[{ label: "Categories" }]}>
      <div className="flex justify-end mb-5">
        <button onClick={() => { setShowCreate(!showCreate); setEditing(null); formik.resetForm(); }}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          {showCreate ? <X size={14} /> : <Plus size={14} />}
          {showCreate ? "Cancel" : "New Category"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={formik.handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5 space-y-4">
          <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{editing ? `Edit: ${editing.name}` : "New Category"}</h3>
          <AdminInput label="Category Name *" placeholder="e.g. Metal Brackets" {...formik.getFieldProps("name")} error={formik.touched.name ? (formik.errors.name as string) : ""} />
          <AdminTextarea label="Description" rows={2} {...formik.getFieldProps("description")} />
          <div className="flex gap-2.5">
            <button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
              {formik.isSubmitting ? "Saving…" : editing ? "Update Category" : "Create Category"}
            </button>
            <button type="button" onClick={() => { setEditing(null); setShowCreate(false); formik.resetForm(); }} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] hover:bg-[#F2F2F2]">Cancel</button>
          </div>
        </form>
      )}

      <DataTable<Category> columns={columns} data={categories} rowKey="id" isLoading={isLoading} emptyMessage="No categories yet." />
      <ConfirmModal open={!!deleting} title="Delete category?" message="Products in this category won't be deleted, but they'll lose their category assignment." onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
