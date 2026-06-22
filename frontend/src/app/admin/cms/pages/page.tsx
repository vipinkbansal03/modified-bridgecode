"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Edit2, Trash2, Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, Pagination, StatusBadge, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminCmsPages, useDeleteCmsPage } from "@/hooks/admin/useAdminHooks";

type CmsPage = { id: string; title: string; slug: string; pageKey: string; status: string; updatedAt: string; _count?: { sections: number } };

export default function CmsPagesPage() {
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const { showToast } = useToast();

  const { data, isLoading, refetch } = useAdminCmsPages({ page });
  const deletePage = useDeleteCmsPage();

  const pages: CmsPage[] = data?.data ?? [];
  const pagination = data?.pagination ?? { total: 0, page: 1, limit: 20 };

  async function handleDelete() {
    if (!deleteId) return;
    try {
      await deletePage.mutateAsync(deleteId);
      showToast("Page deleted.", "success");
      refetch();
    } catch {
      showToast("Delete failed.", "error");
    } finally {
      setDeleteId(null);
    }
  }

  const columns: Column<CmsPage>[] = [
    { key: "title", label: "Title", render: (r) => <div className="font-medium text-sm">{r.title}</div> },
    { key: "pageKey", label: "Key", render: (r) => <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded">{r.pageKey}</code> },
    { key: "slug", label: "Slug", render: (r) => <span className="text-xs text-gray-500">/{r.slug}</span> },
    { key: "sections", label: "Sections", render: (r) => <span className="text-sm text-gray-600">{r._count?.sections ?? 0}</span> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "actions" as keyof CmsPage,
      label: "Actions",
      render: (r) => (
        <div className="flex items-center gap-2">
          <Link href={`/admin/cms/pages/${r.id}`} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors" title="Edit"><Edit2 size={14} /></Link>
          <a href={`/${r.slug}`} target="_blank" rel="noopener" className="p-1.5 text-gray-400 hover:text-green-600 transition-colors" title="View"><Eye size={14} /></a>
          <button onClick={() => setDeleteId(r.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors" title="Delete"><Trash2 size={14} /></button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="CMS Pages" breadcrumb={[{ label: "Content" }, { label: "Pages" }]}>
      <div className="flex items-center justify-between mb-5">
        <p className="text-sm text-gray-500">{pagination.total} page{pagination.total !== 1 ? "s" : ""}</p>
        <Link href="/admin/cms/pages/create" className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors">
          <Plus size={16} /> New Page
        </Link>
      </div>

      <DataTable data={pages} columns={columns} rowKey="id" isLoading={isLoading} emptyMessage="No pages yet. Create one to get started." />

      {pagination.total > pagination.limit && (
        <Pagination page={page} totalPages={Math.ceil(pagination.total / pagination.limit)} onPageChange={setPage} />
      )}

      <ConfirmModal
        open={!!deleteId}
        title="Delete page"
        message="This will permanently delete the page and all its sections and blocks. This cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeleteId(null)}
        danger
      />
    </AdminLayout>
  );
}
