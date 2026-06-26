"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, Trash2 } from "lucide-react";
import { AdminInput, ConfirmModal, DataTable, useToast, type Column } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminBlogCategories, useCreateBlogCategory, useDeleteBlogCategory, useUpdateBlogCategory } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Row = { id: string; name: string; slug: string; description?: string | null; _count?: { blogs: number } };
const empty = { id: "", name: "", slug: "", description: "" };

export default function BlogCategoriesPage() {
  const [form, setForm] = useState(empty);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data = [], isLoading } = useAdminBlogCategories();
  const createRow = useCreateBlogCategory();
  const updateRow = useUpdateBlogCategory();
  const deleteRow = useDeleteBlogCategory();
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (form.id) await updateRow.mutateAsync(form);
      else await createRow.mutateAsync(form);
      setForm(empty);
      showToast("Category saved.");
    } catch (error) { showToast(getAdminErrorMessage(error, "Failed to save category."), "error"); }
  };
  const columns: Column<Row>[] = [
    { key: "name", label: "Name", render: (row) => <div><div className="font-medium">{row.name}</div><div className="text-[12px] text-[#9A9A9A]">{row.slug}</div></div> },
    { key: "blogs", label: "Blog Count", render: (row) => row._count?.blogs ?? 0 },
    { key: "actions", label: "", width: "90px", render: (row) => <div className="flex gap-1.5"><button onClick={() => setForm({ id: row.id, name: row.name, slug: row.slug, description: row.description ?? "" })} className="flex h-7 w-7 items-center justify-center rounded border"><Edit2 size={13} /></button><button onClick={() => setDeleting(row.id)} className="flex h-7 w-7 items-center justify-center rounded border text-red-500"><Trash2 size={13} /></button></div> },
  ];
  return (
    <AdminLayout title="Blog Categories" breadcrumb={[{ label: "Blog", href: "/admin/blogs" }, { label: "Categories" }]}>
      <Link href="/admin/blogs" className="mb-4 inline-flex items-center gap-2 text-[13px] text-[#6B6B6B]"><ArrowLeft size={14} /> Back to blogs</Link>
      <form onSubmit={save} className="mb-5 grid gap-3 rounded-lg border border-[#E6E6E6] bg-white p-4 md:grid-cols-4">
        <AdminInput label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
        <AdminInput label="Slug" value={form.slug} onChange={(event) => setForm({ ...form, slug: event.target.value })} />
        <AdminInput label="Description" value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} />
        <div className="flex items-end gap-2"><button className="h-10 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white">{form.id ? "Update" : "Add"}</button>{form.id && <button type="button" onClick={() => setForm(empty)} className="h-10 rounded-md border px-4 text-[13px]">Cancel</button>}</div>
      </form>
      <DataTable columns={columns} data={data as Row[]} rowKey="id" isLoading={isLoading} />
      <ConfirmModal open={!!deleting} title="Delete category?" message="Categories with blogs cannot be deleted." onCancel={() => setDeleting(null)} onConfirm={async () => {
        if (!deleting) return;
        try { await deleteRow.mutateAsync(deleting); showToast("Category deleted."); } catch (error) { showToast(getAdminErrorMessage(error, "Failed to delete category."), "error"); } finally { setDeleting(null); }
      }} />
      {ToastComponent}
    </AdminLayout>
  );
}
