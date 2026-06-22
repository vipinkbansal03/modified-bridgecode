"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useCreateCmsPage } from "@/hooks/admin/useAdminHooks";

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export default function CmsPageCreatePage() {
  const router = useRouter();
  const { showToast } = useToast();
  const createPage = useCreateCmsPage();

  const [form, setForm] = useState({ title: "", slug: "", pageKey: "", status: "ACTIVE", seoTitle: "", seoDescription: "" });

  function set(k: string, v: string) {
    setForm((f) => {
      const next = { ...f, [k]: v };
      if (k === "title") { next.slug = slugify(v); next.pageKey = slugify(v); }
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const p = await createPage.mutateAsync(form);
      showToast("Page created.", "success");
      router.push(`/admin/cms/pages/${(p as { id: string }).id}`);
    } catch {
      showToast("Failed to create page.", "error");
    }
  }

  return (
    <AdminLayout title="Create Page" breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }, { label: "Create" }]}>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <AdminInput label="Title" value={form.title} onChange={(e) => set("title", e.target.value)} required placeholder="e.g. Homepage" />
        <AdminInput label="Slug" value={form.slug} onChange={(e) => set("slug", e.target.value)} required placeholder="e.g. home" />
        <AdminInput label="Page Key" value={form.pageKey} onChange={(e) => set("pageKey", e.target.value)} required placeholder="e.g. home (unique identifier)" />
        <AdminSelect label="Status" value={form.status} onChange={(e) => set("status", e.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "DRAFT", label: "Draft" }, { value: "INACTIVE", label: "Inactive" }]} />
        <AdminInput label="SEO Title" value={form.seoTitle} onChange={(e) => set("seoTitle", e.target.value)} placeholder="Leave blank to use page title" />
        <AdminInput label="SEO Description" value={form.seoDescription} onChange={(e) => set("seoDescription", e.target.value)} placeholder="Meta description" />

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={createPage.isPending} className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50">
            {createPage.isPending ? "Creating…" : "Create Page"}
          </button>
          <button type="button" onClick={() => router.back()} className="px-6 py-2.5 rounded-lg text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </form>
    </AdminLayout>
  );
}
