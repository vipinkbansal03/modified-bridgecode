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
  useAdminBlogAuthors,
  useCreateBlogAuthor,
  useDeleteBlogAuthor,
  useUpdateBlogAuthor,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type AuthorRow = {
  id: string;
  name: string;
  bio?: string | null;
  _count?: { blogs: number };
};

const emptyForm = { id: "", name: "", bio: "" };

export function BlogAuthorsTab() {
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [deleting, setDeleting] = useState<string | null>(null);

  const { showToast, ToastComponent } = useToast();
  const { data = [], isLoading } = useAdminBlogAuthors();
  const createRow = useCreateBlogAuthor();
  const updateRow = useUpdateBlogAuthor();
  const deleteRow = useDeleteBlogAuthor();

  const authors = (data as AuthorRow[]).filter((a) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return a.name.toLowerCase().includes(q) || (a.bio && a.bio.toLowerCase().includes(q));
  });

  const openNew = () => {
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (row: AuthorRow) => {
    setForm({
      id: row.id,
      name: row.name,
      bio: row.bio ?? "",
    });
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(emptyForm);
  };

  const save = async (event?: React.FormEvent) => {
    if (event) event.preventDefault();
    if (!form.name.trim()) {
      showToast("Author name is required.", "error");
      return;
    }
    try {
      if (form.id) {
        await updateRow.mutateAsync(form);
        showToast("Author updated successfully.");
      } else {
        await createRow.mutateAsync(form);
        showToast("Author created successfully.");
      }
      closeModal();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save author."), "error");
    }
  };

  const columns: Column<AuthorRow>[] = [
    {
      key: "name",
      label: "Name & Bio",
      render: (row) => (
        <div className="pr-3 min-w-0">
          <div className="font-semibold text-[#1A1A1A] text-[13.5px]">{row.name}</div>
          {row.bio ? (
            <div className="text-[12px] text-[#888] line-clamp-1">{row.bio}</div>
          ) : (
            <div className="text-[12px] text-gray-400 italic">No biography provided</div>
          )}
        </div>
      ),
    },
    {
      key: "blogs",
      label: "Articles Written",
      width: "160px",
      render: (row) => (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-gray-700">
          {row._count?.blogs ?? 0} {row._count?.blogs === 1 ? "article" : "articles"}
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
            title="Edit Author"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 transition-colors"
            title="Delete Author"
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
          placeholder: "Search author name or bio...",
          widthClassName: "max-w-[320px]",
        }}
        primaryAction={{
          onClick: openNew,
          label: "Add Author",
          icon: <Plus size={14} />,
        }}
      />

      <DataTable
        title="Blog Authors"
        description="Manage contributing writers and clinical author profiles."
        columns={columns}
        data={authors}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No blog authors found."
      />

      {/* Unified Add/Edit Author Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={form.id ? "Edit Author Profile" : "Add New Blog Author"}
        subtitle="Changes are not applied until you save."
        size="md"
        onSave={() => save()}
        saveText={form.id ? "Save Changes" : "Create Author"}
        cancelText="Cancel"
        isSaving={createRow.isPending || updateRow.isPending}
        bodyClassName="p-6 space-y-4"
      >
        <form id="blog-author-form" onSubmit={save} className="space-y-4">
          <AdminInput
            label="Author Full Name *"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            placeholder="e.g. Dr. Jane Smith"
            required
          />
          <AdminTextarea
            label="Biography"
            rows={4}
            value={form.bio}
            onChange={(e) => setForm({ ...form, bio: e.target.value })}
            placeholder="Professional qualifications, specialty, and background..."
          />
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        open={!!deleting}
        title="Delete author?"
        message="This will permanently delete the author profile. Articles by this author will remain, but will no longer show an author attribution."
        onCancel={() => setDeleting(null)}
        isLoading={deleteRow.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteRow.mutateAsync(deleting);
            showToast("Author deleted successfully.");
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
