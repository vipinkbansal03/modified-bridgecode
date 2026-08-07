"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Upload, X } from "lucide-react";
import { AdminInput, AdminRichTextEditor, AdminSelect, AdminTextarea, useToast } from "@/components/admin/AdminComponents";
import { useAdminBlogAuthors, useAdminBlogCategories, useCreateBlog, useUpdateBlog } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { slugify } from "@/utils/slugify";

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
};

const initialForm = {
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

function getInitialForm(blog?: Blog) {
  if (!blog) return initialForm;
  return {
    title: blog.title ?? "",
    slug: blog.slug ?? "",
    content: blog.content ?? "",
    excerpt: blog.excerpt ?? "",
    featuredImage: blog.featuredImage ?? "",
    authorId: blog.authorId ?? "",
    categoryId: blog.categoryId ?? "",
    tags: blog.tags ?? [],
    status: blog.status ?? "DRAFT",
    scheduledAt: blog.scheduledAt ? blog.scheduledAt.slice(0, 16) : "",
    seoTitle: blog.seoTitle ?? "",
    seoDescription: blog.seoDescription ?? "",
  };
}

export function BlogEditor({ blog }: { blog?: Blog }) {
  const router = useRouter();
  const { showToast, ToastComponent } = useToast();
  const { data: authors = [] } = useAdminBlogAuthors();
  const { data: categories = [] } = useAdminBlogCategories();
  const createBlog = useCreateBlog();
  const updateBlog = useUpdateBlog(blog?.id);
  const [form, setForm] = useState(() => getInitialForm(blog));
  const [tagInput, setTagInput] = useState("");
  const [slugEdited, setSlugEdited] = useState(Boolean(blog?.slug));
  const [showSeo, setShowSeo] = useState(false);
  const [uploading, setUploading] = useState(false);

  const set = (key: keyof typeof form, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const save = async (statusOverride?: string) => {
    const status = statusOverride ?? form.status;
    const payload = { ...form, status, authorId: form.authorId || null, categoryId: form.categoryId || null, scheduledAt: status === "SCHEDULED" ? form.scheduledAt : null };
    try {
      if (blog?.id) await updateBlog.mutateAsync(payload);
      else await createBlog.mutateAsync(payload);
      showToast("Blog saved.");
      router.push("/admin/blogs");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save blog."), "error");
    }
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const formData = new FormData();
    formData.append("entityType", "BLOG");
    if (blog?.id) formData.append("entityId", blog.id);
    formData.append("files", file);
    setUploading(true);
    try {
      const response = await adminApi.post("/media", formData);
      const uploaded = response.data?.data?.[0];
      if (uploaded?.url) set("featuredImage", uploaded.url);
      else throw new Error("Upload completed, but no image URL was returned.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Image upload failed."), "error");
    } finally {
      setUploading(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag || form.tags.includes(tag)) return;
    set("tags", [...form.tags, tag]);
    setTagInput("");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
      <section className="space-y-4 rounded-lg border border-[#E6E6E6] bg-white p-5">
        <AdminInput label="Title" value={form.title} onChange={(event) => { set("title", event.target.value); if (!slugEdited) set("slug", slugify(event.target.value)); }} className="text-[20px]" />
        <AdminInput label="Slug" value={form.slug} onChange={(event) => { setSlugEdited(true); set("slug", slugify(event.target.value)); }} />
        <p className="-mt-2 text-[12px] text-[#9A9A9A]">/blog/{form.slug || "your-slug"}</p>
        <AdminRichTextEditor
          value={form.content || ""}
          onChange={(v) => set("content", v)}
          mediaContext={{ entityType: "BLOG", entityId: blog?.id }}
        />
        <AdminTextarea label="Excerpt" rows={3} value={form.excerpt} onChange={(event) => set("excerpt", event.target.value)} />
      </section>

      <aside className="space-y-4">
        <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <AdminSelect label="Status" value={form.status} onChange={(event) => set("status", event.target.value)} options={[{ value: "DRAFT", label: "Draft" }, { value: "PUBLISHED", label: "Published" }, { value: "SCHEDULED", label: "Scheduled" }]} />
          {form.status === "SCHEDULED" && <AdminInput label="Scheduled At" type="datetime-local" value={form.scheduledAt} onChange={(event) => set("scheduledAt", event.target.value)} />}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={() => save("DRAFT")} className="rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-semibold">Save Draft</button>
            <button type="button" onClick={() => form.status === "SCHEDULED" ? save() : save("PUBLISHED")} className="rounded-md bg-[#E31E24] px-3 py-2 text-[13px] font-semibold text-white">{form.status === "SCHEDULED" ? "Schedule" : "Publish"}</button>
          </div>
        </section>
        <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <h3 className="mb-3 text-[14px] font-semibold">Featured Image</h3>
          {form.featuredImage && <img src={form.featuredImage} alt="" className="mb-3 h-36 w-full rounded-md object-cover" />}
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-semibold">
            <Upload size={14} /> {uploading ? "Uploading..." : "Upload image"}
            <input type="file" accept="image/*" className="hidden" onChange={(event) => upload(event.target.files?.[0])} disabled={uploading} />
          </label>
          <AdminInput label="Image URL" value={form.featuredImage} onChange={(event) => set("featuredImage", event.target.value)} className="mt-3" />
        </section>
        <section className="space-y-3 rounded-lg border border-[#E6E6E6] bg-white p-5">
          <AdminSelect label="Author" value={form.authorId} onChange={(event) => set("authorId", event.target.value)} options={[{ value: "", label: "No author" }, ...authors.map((author: { id: string; name: string }) => ({ value: author.id, label: author.name }))]} />
          <AdminSelect label="Category" value={form.categoryId} onChange={(event) => set("categoryId", event.target.value)} options={[{ value: "", label: "No category" }, ...categories.map((category: { id: string; name: string }) => ({ value: category.id, label: category.name }))]} />
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-[#555]">Tags</label>
            <input value={tagInput} onChange={(event) => setTagInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); addTag(); } }} className="h-10 w-full rounded-md border border-[#E6E6E6] px-3 text-[13px]" placeholder="Type and press Enter" />
            <div className="mt-2 flex flex-wrap gap-2">
              {form.tags.map((tag) => <button key={tag} type="button" onClick={() => set("tags", form.tags.filter((row) => row !== tag))} className="inline-flex items-center gap-1 rounded-full bg-[#F2F2F2] px-2 py-1 text-[12px]">{tag}<X size={12} /></button>)}
            </div>
          </div>
        </section>
        <section className="rounded-lg border border-[#E6E6E6] bg-white p-5">
          <button type="button" onClick={() => setShowSeo((value) => !value)} className="text-[14px] font-semibold">SEO</button>
          {showSeo && <div className="mt-3 space-y-3">
            <AdminInput label={`SEO Title (${form.seoTitle.length}/60)`} maxLength={60} value={form.seoTitle} onChange={(event) => set("seoTitle", event.target.value)} />
            <AdminTextarea label={`SEO Description (${form.seoDescription.length}/160)`} maxLength={160} rows={3} value={form.seoDescription} onChange={(event) => set("seoDescription", event.target.value)} />
          </div>}
        </section>
      </aside>
      {ToastComponent}
    </div>
  );
}
