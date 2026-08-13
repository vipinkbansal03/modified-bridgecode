"use client";

import Link from "next/link";
import { useState } from "react";
import { Edit2, Plus, Trash2 } from "lucide-react";
import {
  AdminListToolbar,
  ConfirmModal,
  DataTable,
  LoadingButton,
  Pagination,
  StatusBadge,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import { useAdminBlogs, useBulkBlogs, useDeleteBlog } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Blog = {
  id: string;
  title: string;
  slug: string;
  status: string;
  publishedAt?: string | null;
  author?: { name: string } | null;
  category?: { name: string } | null;
};

const statusTabs = ["", "PUBLISHED", "DRAFT", "SCHEDULED"];

export function BlogPostsTab() {
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

  const toggle = (id: string) =>
    setSelected((rows) => (rows.includes(id) ? rows.filter((row) => row !== id) : [...rows, id]));

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
    {
      key: "select",
      label: "",
      width: "34px",
      render: (row) => (
        <input
          type="checkbox"
          checked={selected.includes(row.id)}
          onChange={() => toggle(row.id)}
        />
      ),
    },
    {
      key: "title",
      label: "Title",
      render: (row) => (
        <div>
          <div className="font-medium">{row.title}</div>
          <div className="text-[12px] text-[#9A9A9A]">/blog/{row.slug}</div>
        </div>
      ),
    },
    { key: "author", label: "Author", render: (row) => row.author?.name ?? "-" },
    { key: "category", label: "Category", render: (row) => row.category?.name ?? "-" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "publishedAt",
      label: "Published Date",
      render: (row) => (row.publishedAt ? new Date(row.publishedAt).toLocaleString() : "-"),
    },
    {
      key: "actions",
      label: "",
      width: "90px",
      render: (row) => (
        <div className="flex gap-1.5">
          <Link
            href={`/admin/blogs/${row.id}/edit`}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] hover:bg-gray-50"
            title="Edit Post"
          >
            <Edit2 size={13} />
          </Link>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
            title="Delete Post"
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
          onChange: (val) => {
            setSearch(val);
            setPage(1);
          },
          placeholder: "Search title...",
          widthClassName: "max-w-[260px]",
        }}
        leftExtra={
          <div className="flex flex-wrap items-center gap-1.5">
            {statusTabs.map((tab) => (
              <button
                key={tab || "ALL"}
                onClick={() => {
                  setStatus(tab);
                  setPage(1);
                }}
                className={`h-9 rounded-md border px-3 text-[13px] font-semibold transition-colors ${
                  status === tab
                    ? "border-[#E31E24] bg-[#E31E24] text-white"
                    : "border-[#E6E6E6] bg-white text-[#555] hover:border-gray-300"
                }`}
              >
                {tab ? tab.charAt(0) + tab.slice(1).toLowerCase() : "All"}
              </button>
            ))}
          </div>
        }
        primaryAction={{
          href: "/admin/blogs/new",
          label: "New Blog Post",
          icon: <Plus size={14} />,
        }}
      />

      {selected.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-[#E31E24]/30 bg-[#FFF5F5]/30 p-4">
          <span className="text-[13px] text-[#6B6B6B]">{selected.length} selected</span>
          <LoadingButton
            onClick={() => runBulk("publish")}
            loading={bulkBlogs.isPending}
            loadingText="Publishing..."
            className="rounded-md border px-3 py-2 text-[13px] bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Publish
          </LoadingButton>
          <LoadingButton
            onClick={() => runBulk("unpublish")}
            loading={bulkBlogs.isPending}
            loadingText="Unpublishing..."
            className="rounded-md border px-3 py-2 text-[13px] bg-white hover:bg-gray-50 disabled:opacity-50"
          >
            Unpublish
          </LoadingButton>
          <LoadingButton
            onClick={() => runBulk("delete")}
            loading={bulkBlogs.isPending}
            loadingText="Deleting..."
            className="rounded-md border border-red-200 px-3 py-2 text-[13px] text-red-600 bg-white hover:bg-red-50 disabled:opacity-50"
          >
            Delete
          </LoadingButton>
        </div>
      )}

      <DataTable
        columns={columns}
        data={blogs}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No blog posts yet."
      />

      <Pagination
        page={page}
        totalPages={data?.pagination?.totalPages || 1}
        onPageChange={setPage}
      />

      <ConfirmModal
        open={!!deleting}
        title="Delete blog post?"
        message="This permanently deletes the blog post."
        onCancel={() => setDeleting(null)}
        isLoading={deleteBlog.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteBlog.mutateAsync(deleting);
            showToast("Blog post deleted.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete blog post."), "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      {ToastComponent}
    </div>
  );
}
