"use client";

import { useEffect, useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useAdminCmsFooter, useUpsertCmsFooter } from "@/hooks/admin/useAdminHooks";

type FooterData = { title?: string; description?: string; email?: string; phone?: string; address?: string; status: string };

export default function CmsFooterPage() {
  const { data: footer, isLoading } = useAdminCmsFooter();
  const upsert = useUpsertCmsFooter();
  const { showToast } = useToast();

  const [form, setForm] = useState<FooterData>({ title: "", description: "", email: "", phone: "", address: "", status: "ACTIVE" });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (footer) { setForm({ title: footer.title ?? "", description: footer.description ?? "", email: footer.email ?? "", phone: footer.phone ?? "", address: footer.address ?? "", status: footer.status ?? "ACTIVE" }); }
  }, [footer]);

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); setDirty(true); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    try {
      await upsert.mutateAsync(form);
      showToast("Footer saved.", "success");
      setDirty(false);
    } catch { showToast("Save failed.", "error"); }
  }

  if (isLoading) return <AdminLayout title="Footer" breadcrumb={[{ label: "Content" }, { label: "Footer" }]}><div className="text-sm text-gray-500">Loading…</div></AdminLayout>;

  return (
    <AdminLayout title="Footer Settings" breadcrumb={[{ label: "Content" }, { label: "Footer" }]}>
      <form onSubmit={handleSubmit} className="max-w-2xl space-y-5">
        <AdminInput label="Site Name / Title" value={form.title ?? ""} onChange={(e) => set("title", e.target.value)} placeholder="Modern Orthodontics" />
        <AdminTextarea label="Tagline / Description" value={form.description ?? ""} onChange={(e) => set("description", e.target.value)} rows={2} />
        <AdminInput label="Email" value={form.email ?? ""} onChange={(e) => set("email", e.target.value)} placeholder="orders@modortho.com" />
        <AdminInput label="Phone" value={form.phone ?? ""} onChange={(e) => set("phone", e.target.value)} />
        <AdminTextarea label="Address" value={form.address ?? ""} onChange={(e) => set("address", e.target.value)} rows={2} />
        <AdminSelect label="Status" value={form.status} onChange={(e) => set("status", e.target.value)} options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} />

        <button type="submit" disabled={upsert.isPending || !dirty} className="bg-brand text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-brand/90 transition-colors disabled:opacity-50">
          {upsert.isPending ? "Saving…" : "Save Footer"}
        </button>
      </form>
    </AdminLayout>
  );
}
