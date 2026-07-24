"use client";
import { useLayoutEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { Pagination, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { useAdminMedia } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Upload, Trash2, Copy, Check } from "lucide-react";

interface Media { id: string; url: string; filename: string; originalName: string; mimeType: string; size: number; type: string }

export default function MediaPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const canCreate = hasPermission("media.create");
  const canDelete = hasPermission("media.delete");
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("media.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const [page, setPage] = useState(1);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading, refetch } = useAdminMedia({ page });

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    setUploading(true);
    const formData = new FormData();
    Array.from(files).forEach((f) => formData.append("files", f));
    try { await adminApi.post("/media", formData, { headers: { "Content-Type": "multipart/form-data" } }); showToast("Uploaded."); refetch(); }
    catch { showToast("Upload failed.", "error"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try { await adminApi.delete(`/media/${deleting}`); showToast("Deleted."); refetch(); }
    catch { showToast("Failed.", "error"); } finally { setDeleting(null); }
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (authLoading || !hasPermission("media.view")) {
    return null;
  }

  return (
    <AdminLayout title="Media Library" breadcrumb={[{ label: "Media" }]}>
      {canCreate && (
        <div className="mb-5 flex justify-end">
          <label className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13.5px] font-semibold text-white cursor-pointer ${uploading ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]"}`}>
            <Upload size={14} /> {uploading ? "Uploading…" : "Upload Files"}
            <input type="file" multiple accept="image/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        </div>
      )}

      {isLoading ? (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {[...Array(12)].map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-lg bg-[#E6E6E6]" />)}
        </div>
      ) : data?.data?.length === 0 ? (
        <div className="flex h-48 items-center justify-center rounded-xl border-2 border-dashed border-[#E6E6E6] text-[13.5px] text-[#9A9A9A]">No media files. Upload to get started.</div>
      ) : (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {(data?.data || []).map((m: Media) => (
            <div key={m.id} className="group relative aspect-square rounded-lg border border-[#E6E6E6] overflow-hidden bg-[#F8F8F8]">
              {m.type === "IMAGE" ? (
                <img src={m.url} alt={m.originalName} className="h-full w-full object-cover" />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-1">
                  <div className="text-[10px] font-bold text-[#6B6B6B] uppercase">{m.mimeType.split("/")[1]}</div>
                  <div className="text-[10px] text-[#9A9A9A] px-1 text-center truncate w-full">{m.originalName}</div>
                </div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                <button onClick={() => copyUrl(m.id, m.url)} className="flex items-center justify-center h-7 w-7 rounded-full bg-white/20 text-white hover:bg-white/30">
                  {copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}
                </button>
                {canDelete && (
                  <button onClick={() => setDeleting(m.id)} className="flex items-center justify-center h-7 w-7 rounded-full bg-white/20 text-white hover:bg-red-500">
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white truncate">{m.originalName}</p>
                <p className="text-[9px] text-white/60">{(m.size / 1024).toFixed(0)}KB</p>
              </div>
            </div>
          ))}
        </div>
      )}
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      <ConfirmModal open={!!deleting} title="Delete file?" message="This permanently removes the file from storage and cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
