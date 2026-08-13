"use client";

import { useState } from "react";
import { Edit2, Trash2, Upload } from "lucide-react";
import {
  AdminInput,
  AdminTextarea,
  ConfirmModal,
  DataTable,
  LoadingButton,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import {
  useAdminBlogAuthors,
  useCreateBlogAuthor,
  useDeleteBlogAuthor,
  useUpdateBlogAuthor,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type Row = {
  id: string;
  name: string;
  bio?: string | null;
  avatar?: string | null;
  _count?: { blogs: number };
};

const emptyForm = { id: "", name: "", bio: "", avatar: "" };

export function BlogAuthorsTab() {
  const [form, setForm] = useState(emptyForm);
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
    payload.append("entityType", "AUTHOR");
    if (form.id) payload.append("entityId", form.id);
    payload.append("files", file);
    setUploading(true);
    try {
      const response = await adminApi.post("/media", payload);
      const uploaded = response.data?.data?.[0];
      if (uploaded?.url) setForm((prev) => ({ ...prev, avatar: uploaded.url }));
      showToast("Avatar uploaded successfully.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Upload failed."), "error");
    } finally {
      setUploading(false);
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!form.name.trim()) {
      showToast("Author name is required.", "error");
      return;
    }
    try {
      if (form.id) {
        await updateRow.mutateAsync(form);
        showToast("Author updated.");
      } else {
        await createRow.mutateAsync(form);
        showToast("Author created.");
      }
      setForm(emptyForm);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save author."), "error");
    }
  };

  const startEdit = (row: Row) => {
    setForm({
      id: row.id,
      name: row.name,
      bio: row.bio ?? "",
      avatar: row.avatar ?? "",
    });
  };

  const columns: Column<Row>[] = [
    {
      key: "avatar",
      label: "Avatar",
      width: "60px",
      render: (row) =>
        row.avatar ? (
          <img
            src={row.avatar}
            alt={row.name}
            className="h-10 w-10 rounded-full object-cover border border-[#E6E6E6]"
          />
        ) : (
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100 text-[12px] font-semibold text-gray-500">
            {row.name.charAt(0).toUpperCase()}
          </div>
        ),
    },
    {
      key: "name",
      label: "Name & Bio",
      render: (row) => (
        <div>
          <div className="font-medium">{row.name}</div>
          {row.bio && (
            <div className="max-w-[420px] truncate text-[12px] text-[#9A9A9A]">
              {row.bio}
            </div>
          )}
        </div>
      ),
    },
    {
      key: "blogs",
      label: "Blogs Count",
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
            title="Edit Author"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-7 w-7 items-center justify-center rounded border text-red-500 hover:bg-red-50"
            title="Delete Author"
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
          {form.id ? "Edit Blog Author" : "Add New Blog Author"}
        </h3>
        <div className="grid gap-4 md:grid-cols-3">
          <AdminInput
            label="Author Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="Dr. Sarah Jenkins"
          />
          <AdminInput
            label="Avatar Image URL"
            value={form.avatar}
            onChange={(e) => setForm({ ...form, avatar: e.target.value })}
            placeholder="https://..."
          />
          <div className="flex flex-col justify-end">
            <label
              className={`flex h-10 cursor-pointer items-center justify-center rounded-md border border-[#E6E6E6] bg-gray-50 text-[13px] font-semibold text-[#333] hover:bg-gray-100 ${
                uploading ? "opacity-50 pointer-events-none" : ""
              }`}
            >
              {uploading ? (
                <span
                  className="inline-block animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent w-3.5 h-3.5 mr-2"
                  aria-hidden="true"
                />
              ) : (
                <Upload size={14} className="mr-2" />
              )}
              {uploading ? "Uploading..." : "Upload Avatar"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => upload(e.target.files?.[0])}
                disabled={uploading}
              />
            </label>
          </div>
        </div>

        <AdminTextarea
          label="Bio"
          rows={3}
          value={form.bio}
          onChange={(e) => setForm({ ...form, bio: e.target.value })}
          placeholder="Brief author biography or background..."
          className="mt-3"
        />

        <div className="mt-4 flex items-center gap-2">
          <LoadingButton
            type="submit"
            loading={isSubmitting}
            loadingText={form.id ? "Updating..." : "Adding..."}
            className="h-10 rounded-md bg-[#E31E24] px-5 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
          >
            {form.id ? "Update Author" : "Add Author"}
          </LoadingButton>
          {form.id && (
            <button
              type="button"
              onClick={() => setForm(emptyForm)}
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
        emptyMessage="No blog authors found."
      />

      <ConfirmModal
        open={!!deleting}
        title="Delete author?"
        message="Authors currently linked to blog posts cannot be deleted."
        onCancel={() => setDeleting(null)}
        isLoading={deleteRow.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteRow.mutateAsync(deleting);
            showToast("Author deleted.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete author."), "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      {ToastComponent}
    </div>
  );
}
