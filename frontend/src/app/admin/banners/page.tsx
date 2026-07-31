"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, Upload, X } from "lucide-react";
import { AdminInput, AdminSelect, ConfirmModal, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { SortableList } from "@/components/admin/SortableList";
import { useAdminBanners, useAdminCountries, useBulkBanners, useCreateBanner, useDeleteBanner, useReorderBanners, useUpdateBanner } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type Banner = { id: string; title: string; image: string; mobileImage?: string | null; linkUrl?: string | null; linkText?: string | null; placement: string; countryId?: string | null; country?: { code: string; name: string } | null; sortOrder: number; status: boolean; startDate?: string | null; endDate?: string | null };
const placements = ["", "HOMEPAGE_HERO", "HOMEPAGE_PROMO", "CATEGORY_TOP", "PRODUCT_TOP", "SIDEBAR"];
const empty = { id: "", title: "", image: "", mobileImage: "", linkUrl: "", linkText: "", placement: "HOMEPAGE_HERO", countryId: "", countryIds: [] as string[], status: true, startDate: "", endDate: "" };

export default function BannersPage() {
  const [placement, setPlacement] = useState("");
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState<"image" | "mobileImage" | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data = [], isLoading } = useAdminBanners({ placement });
  const { data: countries = [] } = useAdminCountries();
  const createBanner = useCreateBanner();
  const updateBanner = useUpdateBanner();
  const deleteBanner = useDeleteBanner();
  const reorderBanners = useReorderBanners();
  const bulkBanners = useBulkBanners();
  const banners = useMemo(() => ((data ?? []) as Banner[]).slice().sort((a, b) => a.sortOrder - b.sortOrder), [data]);
  const set = (key: keyof typeof form, value: unknown) => setForm((prev) => ({ ...prev, [key]: value }));
  const edit = (row: Banner) => {
    setForm({ id: row.id, title: row.title, image: row.image, mobileImage: row.mobileImage ?? "", linkUrl: row.linkUrl ?? "", linkText: row.linkText ?? "", placement: row.placement, countryId: row.countryId ?? "", countryIds: row.countryId ? [row.countryId] : [], status: row.status, startDate: row.startDate?.slice(0, 10) ?? "", endDate: row.endDate?.slice(0, 10) ?? "" });
    setShowForm(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const selectedCountries = form.countryIds?.length ? form.countryIds : (form.countryId ? [form.countryId] : []);
    const basePayload = {
      title: form.title,
      image: form.image,
      mobileImage: form.mobileImage || null,
      linkUrl: form.linkUrl || null,
      linkText: form.linkText || null,
      placement: form.placement,
      countryIds: selectedCountries,
      countryId: selectedCountries[0] || null,
      status: form.status,
      startDate: form.startDate || null,
      endDate: form.endDate || null,
    };
    try {
      if (form.id) {
        await updateBanner.mutateAsync({ ...basePayload, id: form.id });
      } else {
        await createBanner.mutateAsync(basePayload);
      }
      setForm(empty); setShowForm(false); showToast("Banner saved.");
    } catch (error) { showToast(getAdminErrorMessage(error, "Failed to save banner."), "error"); }
  };
  const upload = async (field: "image" | "mobileImage", file?: File) => {
    if (!file) return;
    const payload = new FormData();
    payload.append("files", file);
    setUploading(field);
    try {
      const response = await adminApi.post("/media", payload, { headers: { "Content-Type": "multipart/form-data" } });
      const uploaded = response.data?.data?.[0];
      if (uploaded?.url) set(field, uploaded.url);
    } catch (error) { showToast(getAdminErrorMessage(error, "Upload failed."), "error"); }
    finally { setUploading(null); }
  };
  const runBulk = async (action: string) => {
    try { await bulkBanners.mutateAsync({ ids: selected, action }); setSelected([]); showToast("Bulk action completed."); }
    catch (error) { showToast(getAdminErrorMessage(error, "Bulk action failed."), "error"); }
  };
  return (
    <AdminLayout title="Banners" breadcrumb={[{ label: "Banners" }]}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">{placements.map((row) => <button key={row || "ALL"} onClick={() => setPlacement(row)} className={`h-9 rounded-md border px-3 text-[13px] font-semibold ${placement === row ? "border-[#E31E24] bg-[#E31E24] text-white" : "border-[#E6E6E6] bg-white text-[#555]"}`}>{row ? row.replace(/_/g, " ") : "All"}</button>)}</div>
        <button onClick={() => { setShowForm(!showForm); setForm(empty); }} className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white">{showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "New Banner"}</button>
      </div>
      {showForm && <form onSubmit={save} className="mb-5 rounded-lg border border-[#E6E6E6] bg-white p-5">
        <div className="grid gap-4 md:grid-cols-3">
          <AdminInput label="Title" value={form.title} onChange={(event) => set("title", event.target.value)} />
          <AdminSelect label="Placement" value={form.placement} onChange={(event) => set("placement", event.target.value)} options={placements.filter(Boolean).map((row) => ({ value: row, label: row.replace(/_/g, " ") }))} />
          <AdminMultiSearchableSelect
            label="Countries"
            values={form.countryIds ?? (form.countryId ? [form.countryId] : [])}
            onValuesChange={(values) => setForm((prev) => ({ ...prev, countryIds: values, countryId: values[0] ?? "" }))}
            options={(countries as any[]).map((country) => ({
              value: country.id,
              label: `${country.name} (${country.code})`,
            }))}
            placeholder="Select countries"
            allowSelectAll
            selectAllLabel="All countries"
          />
          <AdminInput label="Link URL" value={form.linkUrl} onChange={(event) => set("linkUrl", event.target.value)} />
          <AdminInput label="Link Text" value={form.linkText} onChange={(event) => set("linkText", event.target.value)} />
          <AdminSelect label="Status" value={form.status ? "true" : "false"} onChange={(event) => set("status", event.target.value === "true")} options={[{ value: "true", label: "Active" }, { value: "false", label: "Inactive" }]} />
          <AdminInput label="Start Date" type="date" value={form.startDate} onChange={(event) => set("startDate", event.target.value)} />
          <AdminInput label="End Date" type="date" value={form.endDate} onChange={(event) => set("endDate", event.target.value)} />
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {(["image", "mobileImage"] as const).map((field) => <div key={field} className="rounded-md border border-[#E6E6E6] p-3">
            <div className="mb-2 text-[13px] font-semibold">{field === "image" ? "Desktop Image" : "Mobile Override"}</div>
            {form[field] && <img src={form[field]} alt="" className="mb-2 h-32 w-full rounded object-cover" />}
            <AdminInput label="Image URL" value={String(form[field] ?? "")} onChange={(event) => set(field, event.target.value)} />
            <label className="mt-2 inline-flex cursor-pointer items-center gap-2 rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] font-semibold"><Upload size={14} />{uploading === field ? "Uploading..." : "Upload"}<input type="file" accept="image/*" className="hidden" onChange={(event) => upload(field, event.target.files?.[0])} /></label>
          </div>)}
        </div>
        <button className="mt-5 rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white">Save Banner</button>
      </form>}
      {selected.length > 0 && <div className="mb-4 flex flex-wrap items-center gap-2 rounded-md border border-[#E6E6E6] bg-white p-3"><span className="text-[13px]">{selected.length} selected</span><button onClick={() => runBulk("enable")} className="rounded-md border px-3 py-2 text-[13px]">Enable</button><button onClick={() => runBulk("disable")} className="rounded-md border px-3 py-2 text-[13px]">Disable</button><button onClick={() => runBulk("delete")} className="rounded-md border border-red-200 px-3 py-2 text-[13px] text-red-600">Delete</button></div>}
      {isLoading ? <div className="rounded-lg border bg-white p-5 text-[13px] text-[#9A9A9A]">Loading banners...</div> : <SortableList items={banners} onReorder={(items) => reorderBanners.mutateAsync(items.map((item) => item.id)).catch((error) => showToast(getAdminErrorMessage(error, "Failed to reorder banners."), "error"))} renderItem={(row) => (
        <div className="grid gap-3 md:grid-cols-[40px_90px_1fr_160px_90px_120px] md:items-center">
          <input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
          <img src={row.image} alt="" className="h-12 w-20 rounded object-cover" />
          <div><div className="font-medium">{row.title}</div><div className="text-[12px] text-[#9A9A9A]">{row.linkUrl || "No link"}</div></div>
          <div className="text-[12px]">{row.placement.replace(/_/g, " ")}</div>
          <div className="text-[12px]">{row.country?.code ?? "All"}</div>
          <div className="flex items-center gap-2"><StatusBadge status={row.status ? "ACTIVE" : "INACTIVE"} /><button onClick={() => edit(row)} className="flex h-7 w-7 items-center justify-center rounded border"><Edit2 size={13} /></button><button onClick={() => setDeleting(row.id)} className="flex h-7 w-7 items-center justify-center rounded border text-red-500"><Trash2 size={13} /></button></div>
        </div>
      )} />}
      <ConfirmModal open={!!deleting} title="Delete banner?" message="This permanently deletes the banner." onCancel={() => setDeleting(null)} onConfirm={async () => {
        if (!deleting) return;
        try { await deleteBanner.mutateAsync(deleting); showToast("Banner deleted."); } catch (error) { showToast(getAdminErrorMessage(error, "Failed to delete banner."), "error"); } finally { setDeleting(null); }
      }} />
      {ToastComponent}
    </AdminLayout>
  );
}
