"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Edit2, ImageIcon, Plus, Save, Trash2, Upload, X } from "lucide-react";
import {
  AdminInput,
  AdminListToolbar,
  AdminRichTextEditor,
  AdminSelect,
  AdminTextarea,
  ConfirmModal,
  DataTable,
  LoadingButton,
  Pagination,
  StatusBadge,
  useToast,
  type Column,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminBlogs,
  useAdminBlogAuthors,
  useAdminBlogCategories,
  useBulkBlogs,
  useCreateBlog,
  useDeleteBlog,
  useUpdateBlog,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { slugify } from "@/utils/slugify";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";

type Blog = {
  id: string;
  title: string;
  slug: string;
  content: string;
  excerpt?: string | null;
  featuredImage?: string | null;
  authorId?: string | null;
  categoryId?: string | null;
  tags: string[];
  status: string;
  publishedAt?: string | null;
  scheduledAt?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  author?: { id: string; name: string } | null;
  category?: { id: string; name: string } | null;
};

const statusTabs = ["", "PUBLISHED", "DRAFT", "SCHEDULED"];

const initialForm = {
  id: "",
  title: "",
  slug: "",
  content: "",
  excerpt: "",
  featuredImage: "",
  authorId: "",
  categoryId: "",
  tags: [] as string[],
  status: "DRAFT",
  scheduledAt: "",
  seoTitle: "",
  seoDescription: "",
};

export function BlogPostsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<string>("publish");
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Modal form states
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(initialForm);
  const [tagInput, setTagInput] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [showSeo, setShowSeo] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const { data, isLoading } = useAdminBlogs({ page, limit: 20, status, search: debouncedSearch });
  const { data: authors = [] } = useAdminBlogAuthors();
  const { data: categories = [] } = useAdminBlogCategories();

  const createBlog = useCreateBlog();
  const updateBlog = useUpdateBlog();
  const deleteBlog = useDeleteBlog();
  const bulkBlogs = useBulkBlogs();

  const blogs = (data?.data ?? []) as Blog[];

  const setField = (key: keyof typeof form, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const openNew = () => {
    setForm(initialForm);
    setSlugEdited(false);
    setTagInput("");
    setShowSeo(false);
    setShowModal(true);
  };

  const openEdit = (blog: Blog) => {
    setForm({
      id: blog.id,
      title: blog.title ?? "",
      slug: blog.slug ?? "",
      content: blog.content ?? "",
      excerpt: blog.excerpt ?? "",
      featuredImage: blog.featuredImage ?? "",
      authorId: blog.authorId ?? blog.author?.id ?? "",
      categoryId: blog.categoryId ?? blog.category?.id ?? "",
      tags: blog.tags ?? [],
      status: blog.status ?? "DRAFT",
      scheduledAt: blog.scheduledAt ? blog.scheduledAt.slice(0, 16) : "",
      seoTitle: blog.seoTitle ?? "",
      seoDescription: blog.seoDescription ?? "",
    });
    setSlugEdited(true);
    setTagInput("");
    setShowSeo(Boolean(blog.seoTitle || blog.seoDescription));
    setShowModal(true);
  };

  const closeModal = () => {
    setShowModal(false);
    setForm(initialForm);
  };

  const save = async (statusOverride?: string) => {
    if (!form.title.trim()) {
      showToast("Blog title is required.", "error");
      return;
    }
    if (!form.content.trim()) {
      showToast("Blog content is required.", "error");
      return;
    }

    const currentStatus = statusOverride ?? form.status;
    const payload = {
      ...form,
      status: currentStatus,
      authorId: form.authorId || null,
      categoryId: form.categoryId || null,
      scheduledAt: currentStatus === "SCHEDULED" ? form.scheduledAt || null : null,
    };

    try {
      if (form.id) {
        await updateBlog.mutateAsync(payload);
        showToast("Blog post updated successfully.");
      } else {
        await createBlog.mutateAsync(payload);
        showToast("Blog post created successfully.");
      }
      closeModal();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save blog post."), "error");
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const results = await uploadMediaFiles([file], {
        entityType: "BLOG",
        entityId: form.id || undefined,
      });
      const uploaded = results[0];
      if (uploaded?.url) {
        setField("featuredImage", uploaded.url);
        showToast("Featured image uploaded.");
      } else {
        throw new Error("Upload completed, but no image URL was returned.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Image upload failed."), "error");
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || form.tags.includes(tag)) return;
    setField("tags", [...form.tags, tag]);
    setTagInput("");
  };

  const removeTag = (tagToRemove: string) => {
    setField(
      "tags",
      form.tags.filter((t) => t !== tagToRemove)
    );
  };

  const handleBulkAction = async () => {
    if (!selected.length) return;
    if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }
    try {
      await bulkBlogs.mutateAsync({ ids: selected, action: bulkAction });
      setSelected([]);
      showToast(
        bulkAction === "publish"
          ? "Selected blog posts published."
          : "Selected blog posts unpublished."
      );
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const handleConfirmBulkDelete = async () => {
    try {
      await bulkBlogs.mutateAsync({ ids: selected, action: "delete" });
      setSelected([]);
      showToast("Selected blog posts deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk delete failed."), "error");
    } finally {
      setShowBulkDeleteModal(false);
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelected([]);
      return;
    }
    try {
      const res = await adminApi.get("/blogs", {
        params: {
          search: debouncedSearch || undefined,
          status: status || undefined,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data?.data ?? []).map((b: any) => b.id);
      setSelected(allIds);
      showToast(`Selected all ${allIds.length} blog posts across all pages.`, "success");
    } catch {
      setSelected(blogs.map((b) => b.id));
    }
  };

  const columns: Column<Blog>[] = [
    {
      key: "featuredImage",
      label: "Preview",
      width: "70px",
      render: (row) =>
        row.featuredImage ? (
          <img
            src={row.featuredImage}
            alt=""
            className="h-10 w-14 rounded border border-[#E6E6E6] object-cover bg-[#F2F2F2]"
          />
        ) : (
          <div className="flex h-10 w-14 items-center justify-center rounded border border-[#E6E6E6] bg-gray-50 text-[10.5px] font-semibold text-gray-400">
            No image
          </div>
        ),
    },
    {
      key: "title",
      label: "Title & Slug",
      render: (row) => (
        <div className="pr-3 min-w-0">
          <div className="font-semibold text-[#1A1A1A] text-[13.5px] line-clamp-1">{row.title}</div>
          <div className="text-[11.5px] text-[#888] truncate">/blog/{row.slug}</div>
        </div>
      ),
    },
    {
      key: "author",
      label: "Author",
      width: "140px",
      render: (row) => (
        <span className="text-[13px] text-[#444] font-medium">{row.author?.name ?? "—"}</span>
      ),
    },
    {
      key: "category",
      label: "Category",
      width: "140px",
      render: (row) =>
        row.category?.name ? (
          <span className="inline-block rounded-md border border-blue-200 bg-blue-50/80 px-2 py-0.5 text-[11.5px] font-semibold text-blue-700">
            {row.category.name}
          </span>
        ) : (
          <span className="text-gray-400 text-[12.5px]">—</span>
        ),
    },
    {
      key: "status",
      label: "Status",
      width: "120px",
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: "publishedAt",
      label: "Published Date",
      width: "160px",
      render: (row) => (
        <div className="text-[12px] text-[#555]">
          {row.publishedAt ? (
            new Date(row.publishedAt).toLocaleDateString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
            })
          ) : row.scheduledAt ? (
            <span className="text-amber-600 font-medium">
              Sched: {new Date(row.scheduledAt).toLocaleDateString()}
            </span>
          ) : (
            <span className="text-gray-400">Unpublished</span>
          )}
        </div>
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
            title="Edit Post"
          >
            <Edit2 size={13} />
          </button>
          <button
            onClick={() => setDeleting(row.id)}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-red-500 hover:bg-red-50 transition-colors"
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
          placeholder: "Search blog title...",
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
                    ? "border-[#E31E24] bg-[#E31E24] text-white shadow-xs"
                    : "border-[#E6E6E6] bg-white text-[#555] hover:border-gray-300"
                }`}
              >
                {tab ? tab.charAt(0) + tab.slice(1).toLowerCase() : "All"}
              </button>
            ))}
          </div>
        }
        primaryAction={{
          onClick: openNew,
          label: "New Blog Post",
          icon: <Plus size={14} />,
        }}
      />

      <DataTable
        title="Blog Posts"
        description="Manage news, articles, and clinical guides."
        columns={columns}
        data={blogs}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No blog posts found."
        enableSelection={true}
        selectedIds={selected}
        onSelectionChange={setSelected}
        totalItems={data?.pagination?.total ?? 0}
        currentPage={page}
        pageSize={20}
        totalPages={data?.pagination?.totalPages || 1}
        onPageChange={setPage}
        onSelectAll={handleSelectAll}
        renderBulkActions={(selectedIds) => (
          <AdminBulkActionsBar
            selectedCount={selectedIds.length}
            onClear={() => setSelected([])}
            actionType={bulkAction}
            onActionTypeChange={(val) => setBulkAction(val)}
            actions={[
              { value: "publish", label: "Publish" },
              { value: "unpublish", label: "Unpublish" },
              { value: "delete", label: "Delete" },
            ]}
            onApply={handleBulkAction}
            applyLoading={bulkBlogs.isPending}
          />
        )}
      />

      <div className="mt-4">
        <Pagination
          page={page}
          totalPages={data?.pagination?.totalPages || 1}
          onPageChange={setPage}
        />
      </div>

      {/* Unified Add/Edit Blog Post Modal */}
      <Modal
        open={showModal}
        onClose={closeModal}
        title={form.id ? "Edit Blog Post" : "New Blog Post"}
        subtitle="Changes are not applied until you save."
        size="4xl"
        onSave={() => save()}
        saveText={form.id ? "Save Changes" : "Create Post"}
        cancelText="Cancel"
        isSaving={createBlog.isPending || updateBlog.isPending}
        bodyClassName="p-6 md:p-7"
      >
        <form
          id="blog-post-form"
          onSubmit={(e) => {
            e.preventDefault();
            save();
          }}
        >
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
            {/* Main Content Area */}
            <div className="space-y-4">
              <AdminInput
                label="Title *"
                value={form.title}
                onChange={(event) => {
                    setField("title", event.target.value);
                    if (!slugEdited) setField("slug", slugify(event.target.value));
                  }}
                  placeholder="Enter article title..."
                  className="text-[16px] font-semibold"
                  required
                />
                <div>
                  <AdminInput
                    label="Slug *"
                    value={form.slug}
                    onChange={(event) => {
                      setSlugEdited(true);
                      setField("slug", slugify(event.target.value));
                    }}
                    placeholder="article-slug"
                    required
                  />
                  <p className="mt-1 text-[11.5px] text-gray-500">
                    URL preview: <code className="bg-gray-100 px-1 py-0.5 rounded text-gray-700">/blog/{form.slug || "your-slug"}</code>
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-[13px] font-medium text-[#1A1A1A]">
                    Article Content *
                  </label>
                  <AdminRichTextEditor
                    value={form.content || ""}
                    onChange={(v) => setField("content", v)}
                    mediaContext={{ entityType: "BLOG", entityId: form.id || undefined }}
                  />
                </div>

                <AdminTextarea
                  label="Short Excerpt"
                  rows={3}
                  value={form.excerpt}
                  onChange={(event) => setField("excerpt", event.target.value)}
                  placeholder="A concise summary of the post for listing cards and previews..."
                />
              </div>

              {/* Sidebar Settings Area */}
              <div className="space-y-4">
                {/* Publishing Controls */}
                <div className="rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-4 space-y-3">
                  <h4 className="text-[13px] font-bold text-gray-900 border-b border-gray-200 pb-2">
                    Publishing
                  </h4>
                  <AdminSelect
                    label="Status"
                    value={form.status}
                    onChange={(event) => setField("status", event.target.value)}
                    options={[
                      { value: "DRAFT", label: "Draft" },
                      { value: "PUBLISHED", label: "Published" },
                      { value: "SCHEDULED", label: "Scheduled" },
                    ]}
                  />
                  {form.status === "SCHEDULED" && (
                    <AdminInput
                      label="Scheduled At"
                      type="datetime-local"
                      value={form.scheduledAt}
                      onChange={(event) => setField("scheduledAt", event.target.value)}
                    />
                  )}
                </div>

                {/* Featured Image */}
                <div className="rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-4 space-y-3">
                  <h4 className="text-[13px] font-bold text-gray-900 border-b border-gray-200 pb-2">
                    Featured Image
                  </h4>
                  {form.featuredImage ? (
                    <div className="relative overflow-hidden rounded-md border border-[#E6E6E6] bg-white">
                      <img src={form.featuredImage} alt="" className="h-32 w-full object-cover" />
                    </div>
                  ) : (
                    <div className="flex h-24 items-center justify-center rounded-md border border-dashed border-gray-300 bg-white text-[12px] text-gray-400">
                      No image selected
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setMediaModalOpen(true)}
                    className="inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-3.5 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                  >
                    <ImageIcon size={14} /> Browse Media Library
                  </button>
                  <AdminInput
                    label="Or Image URL"
                    value={form.featuredImage}
                    onChange={(event) => setField("featuredImage", event.target.value)}
                    placeholder="https://..."
                  />
                </div>

                {/* Taxonomy & Metadata */}
                <div className="rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-4 space-y-3">
                  <h4 className="text-[13px] font-bold text-gray-900 border-b border-gray-200 pb-2">
                    Taxonomy
                  </h4>
                  <AdminSelect
                    label="Author"
                    value={form.authorId}
                    onChange={(event) => setField("authorId", event.target.value)}
                    options={[
                      { value: "", label: "No author assigned" },
                      ...authors.map((author: { id: string; name: string }) => ({
                        value: author.id,
                        label: author.name,
                      })),
                    ]}
                  />
                  <AdminSelect
                    label="Category"
                    value={form.categoryId}
                    onChange={(event) => setField("categoryId", event.target.value)}
                    options={[
                      { value: "", label: "No category assigned" },
                      ...categories.map((category: { id: string; name: string }) => ({
                        value: category.id,
                        label: category.name,
                      })),
                    ]}
                  />
                  <div>
                    <label className="mb-1.5 block text-[12.5px] font-medium text-[#555]">Tags</label>
                    <input
                      value={tagInput}
                      onChange={(event) => setTagInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addTag();
                        }
                      }}
                      className="h-9 w-full rounded-md border border-[#E6E6E6] bg-white px-3 text-[13px] outline-none focus:border-[#E31E24]"
                      placeholder="Type & press Enter..."
                    />
                    {form.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {form.tags.map((tag) => (
                          <span
                            key={tag}
                            className="inline-flex items-center gap-1 rounded-full border border-gray-200 bg-white px-2 py-0.5 text-[11.5px] text-gray-700"
                          >
                            {tag}
                            <button
                              type="button"
                              onClick={() => removeTag(tag)}
                              className="text-gray-400 hover:text-red-500"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* SEO Settings */}
                <div className="rounded-lg border border-[#E6E6E6] bg-gray-50/50 p-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setShowSeo((prev) => !prev)}
                    className="flex w-full items-center justify-between text-[13px] font-bold text-gray-900"
                  >
                    <span>SEO Settings</span>
                    <span className="text-[11.5px] text-gray-500 font-normal">
                      {showSeo ? "Hide" : "Show"}
                    </span>
                  </button>
                  {showSeo && (
                    <div className="space-y-3 pt-2 border-t border-gray-200">
                      <AdminInput
                        label={`SEO Title (${form.seoTitle.length}/60)`}
                        maxLength={60}
                        value={form.seoTitle}
                        onChange={(event) => setField("seoTitle", event.target.value)}
                        placeholder="Meta title for search engines..."
                      />
                      <AdminTextarea
                        label={`SEO Description (${form.seoDescription.length}/160)`}
                        maxLength={160}
                        rows={3}
                        value={form.seoDescription}
                        onChange={(event) => setField("seoDescription", event.target.value)}
                        placeholder="Meta description for search snippets..."
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
        </form>
      </Modal>

      {/* Delete Confirmation Dialog */}
      <ConfirmModal
        open={!!deleting}
        title="Delete blog post?"
        message="This will permanently delete the selected blog post. This action cannot be undone."
        onCancel={() => setDeleting(null)}
        isLoading={deleteBlog.isPending}
        onConfirm={async () => {
          if (!deleting) return;
          try {
            await deleteBlog.mutateAsync(deleting);
            showToast("Blog post deleted successfully.");
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete blog post."), "error");
          } finally {
            setDeleting(null);
          }
        }}
      />

      {/* Bulk Delete Confirmation Dialog */}
      <ConfirmModal
        open={showBulkDeleteModal}
        title={`Delete ${selected.length} ${selected.length === 1 ? "blog post" : "blog posts"}?`}
        message="This will permanently delete the selected blog posts. This action cannot be undone."
        onCancel={() => setShowBulkDeleteModal(false)}
        isLoading={bulkBlogs.isPending}
        onConfirm={handleConfirmBulkDelete}
      />

      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={(media) => setField("featuredImage", media.url)}
        title="Select Blog Featured Image"
        acceptTypes={["IMAGE"]}
      />

      {ToastComponent}
    </div>
  );
}
