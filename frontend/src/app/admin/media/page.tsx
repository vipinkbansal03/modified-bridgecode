"use client";
import { useLayoutEffect, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { Pagination, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { adminApi } from "@/services/adminApi";
import { Upload, Trash2, Copy, Check, Folder, ChevronRight, Image as ImageIcon, FileText, Video, Box, Layers, Tag, Users, ShoppingCart, Settings, File } from "lucide-react";

interface Media { id: string; url: string; filename: string; originalName: string; mimeType: string; size: number; type: string; status: string; }
interface MediaFolder { id: string; name: string; count: number; icon?: string; }
interface PathSegment { id?: string; name: string; level: number; }

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

  const [path, setPath] = useState<PathSegment[]>([{ name: "Media Library", level: 0 }]);
  const [folders, setFolders] = useState<MediaFolder[]>([]);
  const [files, setFiles] = useState<{data: Media[], pagination: any}>({ data: [], pagination: {} });
  const [loading, setLoading] = useState(true);

  const currentLevel = path.length - 1;
  const entityType = currentLevel >= 1 ? path[1].id : undefined;
  const entityId = currentLevel >= 2 ? path[2].id : undefined;
  const purpose = currentLevel >= 3 ? path[3].id : undefined;

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch Folders
      const folderRes = await adminApi.get("/media/folders", {
        params: { entityType, entityId }
      });
      setFolders(folderRes.data.data || []);

      // Fetch Files
      if (currentLevel > 0) {
        const fileRes = await adminApi.get("/media", {
          params: {
            page,
            limit: 24,
            entityType,
            entityId,
            purpose
          }
        });
        setFiles({ 
          data: fileRes.data.data || [], 
          pagination: fileRes.data.pagination || {} 
        });
      } else {
        setFiles({ data: [], pagination: {} });
      }
    } catch (err) {
      console.error(err);
      showToast("Failed to load media", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading) fetchData();
  }, [path, page, authLoading]);

  const navigateToFolder = (folder: MediaFolder) => {
    setPath(prev => [...prev, { id: folder.id, name: folder.name, level: prev.length }]);
    setPage(1);
  };

  const navigateToBreadcrumb = (index: number) => {
    setPath(prev => prev.slice(0, index + 1));
    setPage(1);
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles?.length) return;
    setUploading(true);
    
    try {
      const configRes = await adminApi.get("/media/config");
      const storageProvider = configRes.data.data.storageProvider;

      if (storageProvider === "LOCAL") {
        const formData = new FormData();
        if (entityType) formData.append("entityType", entityType);
        if (entityId) formData.append("entityId", entityId);
        if (purpose) formData.append("purpose", purpose);
        Array.from(selectedFiles).forEach((f) => formData.append("files", f));
        
        await adminApi.post("/media", formData);
      } else {
        for (const file of Array.from(selectedFiles)) {
          const presignRes = await adminApi.post("/media/presign", {
            filename: file.name,
            mimeType: file.type || "application/octet-stream",
            size: file.size,
            entityType,
            entityId,
            purpose
          });

          const { uploadUrl, mediaId } = presignRes.data.data;

          const uploadResponse = await fetch(uploadUrl, {
            method: "PUT",
            body: file,
            headers: { "Content-Type": file.type || "application/octet-stream" },
          });

          if (!uploadResponse.ok) throw new Error("S3 Upload Failed");

          await adminApi.post("/media/confirm", { mediaId });
        }
      }

      showToast("Uploaded.");
      fetchData();
    } catch (err) {
      console.error(err);
      showToast("Upload failed.", "error");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try { await adminApi.delete(`/media/${deleting}`); showToast("File deleted successfully"); fetchData(); }
    catch { showToast("Failed to delete file", "error"); } finally { setDeleting(null); }
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getIcon = (iconName?: string) => {
    switch (iconName) {
      case 'box': return <Box size={24} className="text-[#6B6B6B]" />;
      case 'layers': return <Layers size={24} className="text-[#6B6B6B]" />;
      case 'folder': return <Folder size={24} className="text-[#6B6B6B]" />;
      case 'tag': return <Tag size={24} className="text-[#6B6B6B]" />;
      case 'users': return <Users size={24} className="text-[#6B6B6B]" />;
      case 'shopping-cart': return <ShoppingCart size={24} className="text-[#6B6B6B]" />;
      case 'video': return <Video size={24} className="text-[#6B6B6B]" />;
      case 'settings': return <Settings size={24} className="text-[#6B6B6B]" />;
      case 'file': return <File size={24} className="text-[#6B6B6B]" />;
      default: return <Folder size={24} className="text-[#6B6B6B]" fill="currentColor" opacity={0.2} />;
    }
  };

  if (authLoading || !hasPermission("media.view")) return null;

  return (
    <AdminLayout title="Media Library" breadcrumb={[{ label: "Media" }]}>
      
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center flex-wrap gap-1 text-[14px]">
          {path.map((segment, idx) => (
            <div key={idx} className="flex items-center gap-1">
              {idx > 0 && <ChevronRight size={16} className="text-[#9A9A9A]" />}
              <button 
                onClick={() => navigateToBreadcrumb(idx)}
                className={`hover:underline ${idx === path.length - 1 ? 'font-bold text-black' : 'text-[#6B6B6B]'}`}
              >
                {segment.name}
              </button>
            </div>
          ))}
        </div>

        {canCreate && (currentLevel === 0 || !!entityId) && (
          <label className={`flex items-center gap-1.5 rounded-md px-4 py-2 text-[13.5px] font-semibold text-white cursor-pointer shrink-0 ${uploading ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]"}`}>
            <Upload size={14} /> {uploading ? "Uploading…" : "Upload Files"}
            <input type="file" multiple accept="image/*,video/*,application/pdf" className="hidden" onChange={handleUpload} disabled={uploading} />
          </label>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-4">
          {[...Array(16)].map((_, i) => <div key={i} className="aspect-square animate-pulse rounded-xl bg-[#E6E6E6]" />)}
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* Folders Grid */}
          {folders.length > 0 && (
            <div>
              <h3 className="text-[12px] font-bold text-[#9A9A9A] uppercase tracking-wider mb-3">Folders</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
                {folders.map(f => (
                  <button 
                    key={f.id} 
                    onClick={() => navigateToFolder(f)}
                    className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border border-[#E6E6E6] bg-white hover:border-[#E31E24] hover:shadow-sm transition-all group"
                  >
                    {getIcon(f.icon)}
                    <span className="text-[13px] font-semibold text-center w-full truncate px-2 group-hover:text-[#E31E24]">{f.name}</span>
                    <span className="text-[11px] text-[#9A9A9A]">{f.count} items</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Files Grid */}
          {files.data.length > 0 && (
            <div>
              <h3 className="text-[12px] font-bold text-[#9A9A9A] uppercase tracking-wider mb-3">Files</h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                {files.data.map((m: Media) => (
                  <div key={m.id} className="group relative aspect-square rounded-lg border border-[#E6E6E6] overflow-hidden bg-[#F8F8F8]">
                    {m.type === "IMAGE" ? (
                      <img src={m.url} alt={m.originalName} className="h-full w-full object-cover" />
                    ) : m.type === "VIDEO" ? (
                      <div className="flex h-full flex-col items-center justify-center gap-1">
                        <Video size={24} className="text-[#9A9A9A]" />
                        <div className="text-[10px] text-[#9A9A9A] px-1 text-center truncate w-full">{m.originalName}</div>
                      </div>
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center gap-1">
                        <FileText size={24} className="text-[#9A9A9A]" />
                        <div className="text-[10px] font-bold text-[#6B6B6B] uppercase">{m.mimeType.split("/")[1]}</div>
                        <div className="text-[10px] text-[#9A9A9A] px-1 text-center truncate w-full">{m.originalName}</div>
                      </div>
                    )}
                    
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2">
                      <div className="flex gap-2">
                        <button onClick={() => copyUrl(m.id, m.url)} className="flex items-center justify-center h-7 w-7 rounded-full bg-white/20 text-white hover:bg-white/30" title="Copy URL">
                          {copiedId === m.id ? <Check size={13} /> : <Copy size={13} />}
                        </button>
                        {canDelete && (
                          <button onClick={() => setDeleting(m.id)} className="flex items-center justify-center h-7 w-7 rounded-full bg-white/20 text-white hover:bg-red-500" title="Delete">
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* File Info Footer */}
                    <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1.5 py-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <p className="text-[10px] text-white truncate">{m.originalName}</p>
                      <p className="text-[9px] text-white/60">{(m.size / 1024).toFixed(0)}KB</p>
                    </div>

                    {/* Status Badge */}
                    {m.status && m.status !== "READY" && (
                      <div className="absolute top-1 left-1 bg-yellow-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow">
                        {m.status.replace("_", " ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {folders.length === 0 && files.data.length === 0 && (
            <div className="flex flex-col items-center justify-center h-48 rounded-xl border-2 border-dashed border-[#E6E6E6] text-[#9A9A9A]">
              <Folder size={32} className="mb-2 opacity-50" />
              <div className="text-[13.5px]">This folder is empty.</div>
            </div>
          )}

          {files.pagination?.totalPages > 1 && (
            <div className="pt-4">
              <Pagination page={page} totalPages={files.pagination.totalPages} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      <ConfirmModal open={!!deleting} title="Delete file?" message="This permanently removes the file from storage and cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
