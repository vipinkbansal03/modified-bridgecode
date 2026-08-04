"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, Edit2, Trash2, Upload } from "lucide-react";
import { AdminInput, AdminTextarea, ConfirmModal, DataTable, useToast, type Column } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminBlogAuthors, useCreateBlogAuthor, useDeleteBlogAuthor, useUpdateBlogAuthor } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type Row = { id: string; name: string; bio?: string | null; avatar?: string | null; _count?: { blogs: number } };
const empty = { id: "", name: "", bio: "", avatar: "" };

export default function BlogAuthorsPage() {
  const [form, setForm] = useState(empty);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data = [], isLoading } = useAdminBlogAuthors();
  const createRow = useCreateBlogAuthor();
  const updateRow = useUpdateBlogAuthor();
  const deleteRow = useDeleteBlogAuthor();
  const upload = async (file?: File) => {
    if (!file) return;
    const payload = new FormData();
    payload.append("files", file);
    setUploading(true);
    try {
      const response = await adminApi.post("/media", payload);
      const uploaded = response.data?.data?.[0];
      if (uploaded?.url) setForm((prev) => ({ ...prev, avatar: uploaded.url }));
    } catch (error) { showToast(getAdminErrorMessage(error, "Upload failed."), "error"); }
    finally { setUploading(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      if (form.id) await updateRow.mutateAsync(form);
      else await createRow.mutateAsync(form);
      setForm(empty);
      showToast("Author saved.");
    } catch (error) { showToast(getAdminErrorMessage(error, "Failed to save author."), "error"); }
  };
  const columns: Column<Row>[] = [
    { key: "avatar", label: "Avatar", render: (row) => row.avatar ? <img src={row.avatar} alt="" className="h-10 w-10 rounded-full object-cover" /> : "-" },
    { key: "name", label: "Name", render: (row) => <div><div className="font-medium">{row.name}</div><div className="max-w-[420px] truncate text-[12px] text-[#9A9A9A]">{row.bio}</div></div> },
    { key: "blogs", label: "Blogs", render: (row) => row._count?.blogs ?? 0 },
    { key: "actions", label: "", width: "90px", render: (row) => <div className="flex gap-1.5"><button onClick={() => setForm({ id: row.id, name: row.name, bio: row.bio ?? "", avatar: row.avatar ?? "" })} className="flex h-7 w-7 items-center justify-center rounded border"><Edit2 size={13} /></button><button onClick={() => setDeleting(row.id)} className="flex h-7 w-7 items-center justify-center rounded border text-red-500"><Trash2 size={13} /></button></div> },
  ];
  return (
    <AdminLayout title="Blog Authors" breadcrumb={[{ label: "Blog", href: "/admin/blogs" }, { label: "Authors" }]}>
      <Link href="/admin/blogs" className="mb-4 inline-flex items-center gap-2 text-[13px] text-[#6B6B6B]"><ArrowLeft size={14} /> Back to blogs</Link>
      <form onSubmit={save} className="mb-5 rounded-lg border border-[#E6E6E6] bg-white p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <AdminInput label="Name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
          <AdminInput label="Avatar URL" value={form.avatar} onChange={(event) => setForm({ ...form, avatar: event.target.value })} />
          <label className="flex h-10 cursor-pointer items-center justify-center self-end rounded-md border border-[#E6E6E6] text-[13px] font-semibold"><Upload size={14} className="mr-2" />{uploading ? "Uploading..." : "Upload avatar"}<input type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0])} /></label>
        </div>
        <AdminTextarea label="Bio" rows={3} value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} className="mt-3" />
        <div className="mt-3 flex gap-2"><button className="h-10 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white">{form.id ? "Update" : "Add"}</button>{form.id && <button type="button" onClick={() => setForm(empty)} className="h-10 rounded-md border px-4 text-[13px]">Cancel</button>}</div>
      </form>
      <DataTable columns={columns} data={data as Row[]} rowKey="id" isLoading={isLoading} />
      <ConfirmModal open={!!deleting} title="Delete author?" message="Authors with blogs cannot be deleted." onCancel={() => setDeleting(null)} onConfirm={async () => {
        if (!deleting) return;
        try { await deleteRow.mutateAsync(deleting); showToast("Author deleted."); } catch (error) { showToast(getAdminErrorMessage(error, "Failed to delete author."), "error"); } finally { setDeleting(null); }
      }} />
      {ToastComponent}
    </AdminLayout>
  );
}
