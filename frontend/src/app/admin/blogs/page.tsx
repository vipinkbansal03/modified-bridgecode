"use client";

import Link from "next/link";
import { useState } from "react";
import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ConfirmModal, DataTable, Pagination, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { useAdminBlogs, useBulkBlogs, useDeleteBlog } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Blog = { id: string; title: string; slug: string; status: string; publishedAt?: string | null; author?: { name: string } | null; category?: { name: string } | null };
const tabs = ["", "PUBLISHED", "DRAFT", "SCHEDULED"];

export default function AdminBlogsPage() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminBlogs({ page, limit: 20, status, search });
  const deleteBlog = useDeleteBlog();
  const bulkBlogs = useBulkBlogs();
  const blogs = (data?.data ?? []) as Blog[];

  const toggle = (id: string) => setSelected((rows) => rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id]);
  const runBulk = async (action: string) => {
    try {
      await bulkBlogs.mutateAsync({ ids: selected, action });
      setSelected([]);
      showToast("Bulk action completed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const columns: Column<Blog>[] = [
    { key: "select", label: "", width: "34px", render: (row) => <input type="checkbox" checked={selected.includes(row.id)} onChange={() => toggle(row.id)} /> },
    { key: "title", label: "Title", render: (row) => <div><div className="font-medium">{row.title}</div><div className="text-[12px] text-[#9A9A9A]">/blog/{row.slug}</div></div> },
    { key: "author", label: "Author", render: (row) => row.author?.name ?? "-" },
    { key: "category", label: "Category", render: (row) => row.category?.name ?? "-" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "publishedAt", label: "Published Date", render: (row) => row.publishedAt ? new Date(row.publishedAt).toLocaleString() : "-" },
    { key: "actions", label: "", width: "90px", render: (row) => (
      <div className="flex gap-1.5">
        <Link href={`/admin/blogs/${row.id}/edit`} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6]"><Edit2 size={13} /></Link>
        <button onClick={() => setDeleting(row.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500"><Trash2 size={13} /></button>
      </div>
    ) },
  ];

  return (
    <AdminLayout title="Blog" breadcrumb={[{ label: "Blog" }]}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {tabs.map((tab) => (
            <button key={tab || "ALL"} onClick={() => { setStatus(tab); setPage(1); }} className={`h-9 rounded-md border px-3 text-[13px] font-semibold ${status === tab ? "border-[#E31E24] bg-[#E31E24] text-white" : "border-[#E6E6E6] bg-white text-[#555]"}`}>
              {tab || "All"}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/blogs/categories" className="rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-semibold">Categories</Link>
          <Link href="/admin/blogs/authors" className="rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-semibold">Authors</Link>
          <Link href="/admin/blogs/new" className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white"><Plus size={14} /> New Blog</Link>
        </div>
      </div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
          <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search title" className="h-10 w-[260px] rounded-md border border-[#E6E6E6] pl-8 pr-3 text-[13px]" />
        </div>
        {selected.length > 0 && (
          <>
            <span className="text-[13px] text-[#6B6B6B]">{selected.length} selected</span>
            <button onClick={() => runBulk("publish")} className="rounded-md border px-3 py-2 text-[13px]">Publish</button>
            <button onClick={() => runBulk("unpublish")} className="rounded-md border px-3 py-2 text-[13px]">Unpublish</button>
            <button onClick={() => runBulk("delete")} className="rounded-md border border-red-200 px-3 py-2 text-[13px] text-red-600">Delete</button>
          </>
        )}
      </div>
      <DataTable columns={columns} data={blogs} rowKey="id" isLoading={isLoading} emptyMessage="No blog posts yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      <ConfirmModal open={!!deleting} title="Delete blog?" message="This permanently deletes the blog post." onCancel={() => setDeleting(null)} onConfirm={async () => {
        if (!deleting) return;
        try { await deleteBlog.mutateAsync(deleting); showToast("Blog deleted."); } catch (error) { showToast(getAdminErrorMessage(error, "Failed to delete blog."), "error"); } finally { setDeleting(null); }
      }} />
      {ToastComponent}
    </AdminLayout>
  );
}
