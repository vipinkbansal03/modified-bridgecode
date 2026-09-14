"use client";

import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import {
  Image as ImageIcon,
  FileText,
  Video,
  Search,
  Upload,
  Trash2,
  RefreshCw,
  MoreVertical,
  Pencil,
  Copy,
  Check,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  X,
} from "lucide-react";
import { ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { mediaService, type MediaItem } from "@/services/mediaService";
import { getAdminErrorMessage } from "@/services/adminApi";

type Props = {
  mode?: "select" | "manage";
  value?: string;
  initialType?: "all" | "image" | "document";
  onSelect?: (media: MediaItem) => void;
};

function formatBytes(bytes?: number) {
  const size = Number(bytes || 0);
  if (!size) return "0 B";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(date?: string) {
  if (!date) return "";
  try {
    return new Date(date).toLocaleString();
  } catch {
    return date;
  }
}

function isImage(media?: MediaItem | null) {
  if (!media) return false;
  return (
    media.type === "IMAGE" ||
    media.mimeType?.startsWith("image/") ||
    /\.(jpe?g|png|webp|gif|svg)$/i.test(media.url || media.filename || "")
  );
}

function isVideo(media?: MediaItem | null) {
  if (!media) return false;
  return (
    media.type === "VIDEO" ||
    media.mimeType?.startsWith("video/") ||
    /\.(mp4|webm|ogg|mov)$/i.test(media.url || media.filename || "")
  );
}

function getFormat(media?: MediaItem | null) {
  if (!media) return "FILE";
  if (media.mimeType) {
    const parts = media.mimeType.split("/");
    if (parts[1]) return parts[1].toUpperCase().replace("VND.", "").replace("OCTET-STREAM", "FILE");
  }
  const ext = (media.filename || media.originalName || "").split(".").pop();
  return ext ? ext.toUpperCase() : "FILE";
}

export default function MediaLibraryPanel({ mode = "select", value = "", initialType, onSelect }: Props) {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("media.create") || hasPermission("media.manage") || hasPermission("*");
  const canEdit = hasPermission("media.update") || hasPermission("media.manage") || hasPermission("*");
  const canDelete = hasPermission("media.delete") || hasPermission("media.manage") || hasPermission("*");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(search);

  const [type, setType] = useState<"all" | "image" | "document">(
    initialType || (mode === "select" ? "image" : "all")
  );
  const [entityType, setEntityType] = useState<string>("ALL");

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState("");
  const [detailsOpen, setDetailsOpen] = useState(mode === "select");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const [meta, setMeta] = useState({
    title: "",
    altText: "",
    description: "",
    tags: "",
  });

  const { showToast, ToastComponent } = useToast();

  const selectedMedia = useMemo(
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const loadMedia = async (targetPage = page) => {
    try {
      setLoading(true);
      setError("");
      const res = await mediaService.list({
        page: targetPage,
        limit: 24,
        search: deferredSearch,
        type: type === "all" ? undefined : type,
        entityType: entityType === "ALL" ? undefined : entityType,
      });

      setItems(res.items);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
      setPage(res.pagination.page || 1);

      // Select active or first item
      const preferredId =
        res.items.find((item) => item.id === selectedId)?.id ||
        res.items.find((item) => item.url === value)?.id ||
        res.items[0]?.id ||
        "";
      setSelectedId(preferredId);
      if (mode === "select" && preferredId) {
        setDetailsOpen(true);
      }
    } catch (e: unknown) {
      const msg = getAdminErrorMessage(e, "Failed to load media");
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialType) {
      setType(initialType);
    }
  }, [initialType]);

  useEffect(() => {
    void loadMedia(1);
  }, [deferredSearch, type, entityType]);

  useEffect(() => {
    if (!selectedMedia) {
      setMeta({ title: "", altText: "", description: "", tags: "" });
      return;
    }
    setMeta({
      title: selectedMedia.title || "",
      altText: selectedMedia.altText || "",
      description: selectedMedia.description || "",
      tags: selectedMedia.tags || "",
    });
  }, [selectedMedia]);

  const handleUpload = async (files?: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      setUploading(true);
      setError("");
      setSuccess("");
      const fileArray = Array.from(files);
      const res = await mediaService.upload(fileArray, {
        entityType: entityType !== "ALL" ? entityType : undefined,
      });

      const count = res.length;
      setSuccess(`Uploaded ${count} file${count === 1 ? "" : "s"} successfully.`);
      showToast(`Uploaded ${count} file${count === 1 ? "" : "s"}.`);

      await loadMedia(1);
      if (res[0]?.mediaId) {
        setSelectedId(res[0].mediaId);
        setDetailsOpen(true);
      }
    } catch (e: unknown) {
      const msg = getAdminErrorMessage(e, "Upload failed");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedia) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");
      const updated = await mediaService.update(selectedMedia.id, meta);
      setItems((current) =>
        current.map((item) => (item.id === updated.id ? { ...item, ...updated } : item))
      );
      setSuccess("Media details updated successfully.");
      showToast("Media details updated successfully.");
    } catch (e: unknown) {
      const msg = getAdminErrorMessage(e, "Failed to update media details");
      setError(msg);
      showToast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      setError("");
      setSuccess("");
      await mediaService.remove(deleting);
      setDeleting(null);
      setSuccess("Media deleted successfully.");
      showToast("Media deleted successfully.");
      const nextPage = items.length === 1 && page > 1 ? page - 1 : page;
      await loadMedia(nextPage);
    } catch (e: unknown) {
      const msg = getAdminErrorMessage(e, "Failed to delete media");
      setError(msg);
      showToast(msg, "error");
    }
  };

  const copyUrl = (id: string, url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedId(id);
    showToast("URL copied to clipboard.");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openDetailsForItem = (item: MediaItem) => {
    setSelectedId(item.id);
    setDetailsOpen(true);
    setMenuOpenId(null);
  };

  return (
    <div className="flex flex-col gap-4 font-sans text-[#1A1A1A]">
      {/* ─── Top Toolbar ─── */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E6E6E6] shadow-xs">
        {/* Search */}
        <div className="relative flex-1 min-w-[240px] max-w-md">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A] pointer-events-none"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search media by name, title, tags..."
            className="w-full h-10 pl-9 pr-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] text-[13.5px] text-[#1A1A1A] placeholder-[#9A9A9A] focus:border-[#E31E24] focus:bg-white focus:outline-none transition-colors"
          />
        </div>

        {/* Filters & Actions */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Type Filter Pills */}
          <div className="inline-flex rounded-lg border border-[#E6E6E6] bg-[#F5F5F5] p-0.5 text-[12.5px] font-medium">
            {(
              [
                { id: "image", label: "Images" },
                { id: "document", label: "Documents" },
                { id: "all", label: "All" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`px-3 py-1.5 rounded-md transition-all ${
                  type === opt.id
                    ? "bg-white text-[#1A1A1A] shadow-xs font-semibold"
                    : "text-[#6B6B6B] hover:text-[#1A1A1A]"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Source Filter Dropdown (Manage mode only) */}
          {mode === "manage" && (
            <select
              value={entityType}
              onChange={(e) => setEntityType(e.target.value)}
              className="h-10 px-3 rounded-lg border border-[#E6E6E6] bg-white text-[12.5px] font-medium text-[#1A1A1A] focus:border-[#E31E24] focus:outline-none cursor-pointer"
            >
              <option value="ALL">All Sources</option>
              <option value="PRODUCT">Products</option>
              <option value="VARIANT">Variants</option>
              <option value="CATEGORY">Categories</option>
              <option value="BANNER">Banners</option>
              <option value="BLOG">Blogs</option>
              <option value="CMS">CMS Pages</option>
              <option value="UNCATEGORIZED">Uncategorized</option>
            </select>
          )}

          {/* Hidden File Input */}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp,image/gif,image/svg+xml,application/pdf,video/mp4,text/csv,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            className="hidden"
            onChange={(e) => void handleUpload(e.target.files)}
          />

          {/* Upload Button */}
          {canCreate && (
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-[#E31E24] hover:bg-[#B5151B] text-white text-[13px] font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-xs"
            >
              <Upload size={15} />
              <span>{uploading ? "Uploading..." : "Upload Files"}</span>
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            disabled={loading}
            onClick={() => void loadMedia(page)}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#E6E6E6] bg-white hover:bg-[#F9F9F9] text-[#6B6B6B] hover:text-[#1A1A1A] text-[13px] font-medium transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg">
          <Check size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ─── Main Content Layout ─── */}
      <div className={`grid grid-cols-1 gap-5 items-start ${mode === "select" ? "md:grid-cols-12" : "xl:grid-cols-12"}`}>
        {/* Left: Media Grid Column */}
        <div
          className={`flex flex-col gap-4 bg-white p-4 rounded-xl border border-[#E6E6E6] transition-all ${
            mode === "select"
              ? "md:col-span-6 lg:col-span-6 xl:col-span-6"
              : detailsOpen && selectedMedia ? "xl:col-span-7 2xl:col-span-8" : "xl:col-span-12"
          }`}
        >
          {/* Header Status */}
          <div className="flex items-center justify-between text-[12.5px] text-[#6B6B6B] border-b border-[#F0F0F0] pb-3">
            <span>
              <strong>{totalItems}</strong> items
            </span>
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
          </div>

          {/* Grid or Empty/Loading State */}
          {loading ? (
            <div className={`grid gap-3.5 py-4 ${mode === "select" ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"}`}>
              {[...Array(mode === "select" ? 8 : 18)].map((_, i) => (
                <div
                  key={i}
                  className="aspect-square animate-pulse rounded-lg bg-[#F2F2F2] border border-[#E6E6E6]"
                />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center border-2 border-dashed border-[#E6E6E6] rounded-xl bg-[#FAFAFA]">
              <div className="w-12 h-12 rounded-full bg-[#EEEEEE] flex items-center justify-center text-[#9A9A9A] mb-3">
                <ImageIcon size={24} />
              </div>
              <h4 className="text-[14px] font-semibold text-[#1A1A1A]">No media found</h4>
              <p className="text-[12.5px] text-[#6B6B6B] mt-1 max-w-sm">
                Upload files using the button above or broaden your search and filter criteria.
              </p>
              {canCreate && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#E31E24] hover:bg-[#B5151B] text-white text-[12.5px] font-semibold"
                >
                  <Upload size={14} /> Upload First File
                </button>
              )}
            </div>
          ) : (
            <div
              className={`grid gap-3.5 ${
                mode === "select"
                  ? "grid-cols-2"
                  : detailsOpen && selectedMedia
                  ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5"
                  : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
              }`}
            >
              {items.map((item) => {
                const active = item.id === selectedId;
                const isItemImage = isImage(item);
                const isItemVideo = isVideo(item);
                const formatLabel = getFormat(item);

                return (
                  <div
                    key={item.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => {
                      setSelectedId(item.id);
                      setDetailsOpen(true);
                    }}
                    onDoubleClick={() => {
                      if (mode === "select" && onSelect) onSelect(item);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedId(item.id);
                        setDetailsOpen(true);
                      }
                    }}
                    className={`group relative flex flex-col rounded-lg border bg-white overflow-hidden text-left cursor-pointer transition-all ${
                      active
                        ? "border-[#1E5AF9] ring-2 ring-[#1E5AF9]/25 shadow-sm"
                        : "border-[#E6E6E6] hover:border-[#9A9A9A] hover:shadow-xs"
                    }`}
                  >
                    {/* Top Action Menu (Manage Mode) */}
                    {mode === "manage" && (
                      <div className="absolute top-1.5 right-1.5 z-20">
                        <button
                          type="button"
                          aria-label="Open actions"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setSelectedId(item.id);
                            setMenuOpenId(menuOpenId === item.id ? null : item.id);
                          }}
                          className="flex items-center justify-center w-7 h-7 rounded-md bg-white/90 backdrop-blur-xs border border-[#E6E6E6] text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-white shadow-xs transition-colors"
                        >
                          <MoreVertical size={14} />
                        </button>

                        {menuOpenId === item.id && (
                          <>
                            <div
                              className="fixed inset-0 z-20"
                              onClick={(e) => {
                                e.stopPropagation();
                                setMenuOpenId(null);
                              }}
                            />
                            <div className="absolute right-0 top-8 w-32 bg-white rounded-lg shadow-lg border border-[#E6E6E6] py-1 z-30">
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDetailsForItem(item);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#1A1A1A] hover:bg-[#F5F5F5]"
                                >
                                  <Pencil size={13} className="text-[#6B6B6B]" /> Edit
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyUrl(item.id, item.url);
                                  setMenuOpenId(null);
                                }}
                                className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#1A1A1A] hover:bg-[#F5F5F5]"
                              >
                                {copiedId === item.id ? (
                                  <Check size={13} className="text-emerald-600" />
                                ) : (
                                  <Copy size={13} className="text-[#6B6B6B]" />
                                )}
                                <span>Copy Link</span>
                              </button>
                              {canDelete && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedId(item.id);
                                    setDetailsOpen(true);
                                    setMenuOpenId(null);
                                    setDeleting(item.id);
                                  }}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-[12.5px] text-[#E31E24] hover:bg-red-50"
                                >
                                  <Trash2 size={13} /> Delete
                                </button>
                              )}
                            </div>
                          </>
                        )}
                      </div>
                    )}

                    {/* Preview Thumbnail */}
                    <div className="relative aspect-square w-full bg-[#F8F8F8] flex items-center justify-center overflow-hidden border-b border-[#F0F0F0]">
                      {isItemImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt={item.altText || item.title || item.originalName}
                          loading="lazy"
                          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : isItemVideo ? (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-[#9A9A9A]">
                          <Video size={26} />
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/80 px-1.5 py-0.5 rounded border border-[#E6E6E6]">
                            {formatLabel}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-1.5 text-[#9A9A9A]">
                          <FileText size={26} />
                          <span className="text-[10px] font-bold uppercase tracking-wider bg-white/80 px-1.5 py-0.5 rounded border border-[#E6E6E6]">
                            {formatLabel}
                          </span>
                        </div>
                      )}

                      {/* Status indicator if pending */}
                      {item.status && item.status !== "READY" && (
                        <div className="absolute top-1.5 left-1.5 bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                          {item.status.replace("_", " ")}
                        </div>
                      )}
                    </div>

                    {/* Card Meta */}
                    <div className="p-2.5">
                      <p
                        className="text-[12.5px] font-medium text-[#1A1A1A] truncate"
                        title={item.title || item.originalName}
                      >
                        {item.title || item.originalName}
                      </p>
                      <div className="flex items-center justify-between text-[11px] text-[#9A9A9A] mt-1">
                        <span>{formatBytes(item.size)}</span>
                        <span>{formatLabel}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Bottom Pagination */}
          <div className="flex items-center justify-between pt-3 border-t border-[#F0F0F0]">
            <button
              type="button"
              disabled={loading || page <= 1}
              onClick={() => void loadMedia(page - 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E6E6E6] bg-white hover:bg-[#F9F9F9] text-[#1A1A1A] text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={15} /> Previous
            </button>
            <span className="text-[12px] text-[#6B6B6B]">
              Page {page} of {totalPages}
            </span>
            <button
              type="button"
              disabled={loading || page >= totalPages}
              onClick={() => void loadMedia(page + 1)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#E6E6E6] bg-white hover:bg-[#F9F9F9] text-[#1A1A1A] text-[12.5px] font-medium disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Next <ChevronRight size={15} />
            </button>
          </div>
        </div>

        {/* Right: Details Panel */}
        {detailsOpen && (
          <div
            className={`bg-white p-4 rounded-xl border border-[#E6E6E6] shadow-xs flex flex-col ${
              mode === "select"
                ? "md:col-span-6 lg:col-span-6 xl:col-span-6 md:sticky md:top-0 md:max-h-[calc(80vh-2rem)]"
                : "xl:col-span-5 2xl:col-span-4 xl:sticky xl:top-4 xl:max-h-[calc(100vh-6rem)] max-h-[85vh]"
            }`}
          >
            {!selectedMedia ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-[#9A9A9A]">
                <ImageIcon size={32} className="mb-2 opacity-50" />
                <h4 className="text-[13.5px] font-semibold text-[#1A1A1A]">Select Media</h4>
                <p className="text-[12px] mt-1">
                  Choose an item from the grid to preview and manage its details.
                </p>
              </div>
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-3 shrink-0">
                  <h3 className="text-[14px] font-bold text-[#1A1A1A]">Media Details</h3>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => copyUrl(selectedMedia.id, selectedMedia.url)}
                      className="p-1.5 rounded-md hover:bg-[#F5F5F5] text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                      title="Copy URL"
                    >
                      {copiedId === selectedMedia.id ? (
                        <Check size={15} className="text-emerald-600" />
                      ) : (
                        <Copy size={15} />
                      )}
                    </button>
                    <a
                      href={selectedMedia.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-md hover:bg-[#F5F5F5] text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
                      title="Open in new tab"
                    >
                      <ExternalLink size={15} />
                    </a>
                    {mode === "manage" && (
                      <button
                        type="button"
                        onClick={() => setDetailsOpen(false)}
                        className="p-1.5 rounded-md hover:bg-[#F5F5F5] text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors cursor-pointer"
                        title="Close Panel"
                      >
                        <X size={15} />
                      </button>
                    )}
                  </div>
                </div>

                {/* Form with scrollable content and pinned actions */}
                <form onSubmit={handleSaveDetails} className="flex flex-col flex-1 min-h-0">
                  {/* Scrollable Content Area */}
                  <div className="flex-1 overflow-y-auto overscroll-contain pr-1.5 pt-3.5 pb-1 space-y-3.5">
                    {/* Preview Box */}
                    <div className="aspect-16/10 w-full rounded-lg bg-[#F8F8F8] border border-[#E6E6E6] flex items-center justify-center overflow-hidden p-2 shrink-0">
                      {isImage(selectedMedia) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={selectedMedia.url}
                          alt={selectedMedia.altText || selectedMedia.title || selectedMedia.originalName}
                          className="max-h-full max-w-full object-contain"
                        />
                      ) : isVideo(selectedMedia) ? (
                        <div className="flex flex-col items-center justify-center gap-2 text-[#9A9A9A]">
                          <Video size={36} />
                          <span className="text-[11px] font-semibold text-[#6B6B6B] truncate max-w-[200px]">
                            {selectedMedia.originalName}
                          </span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center gap-2 text-[#9A9A9A]">
                          <FileText size={36} />
                          <span className="text-[11px] font-semibold text-[#6B6B6B] truncate max-w-[200px]">
                            {selectedMedia.originalName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Metadata Summary */}
                    <div className="flex flex-col gap-1.5 text-[12.5px] text-[#4A4A4A] py-1 border-b border-[#F0F0F0]">
                      <div><strong className="text-[#1A1A1A]">Name:</strong> <span className="text-[#6B6B6B] break-all">{selectedMedia.originalName}</span></div>
                      <div><strong className="text-[#1A1A1A]">Type:</strong> <span className="text-[#6B6B6B]">{selectedMedia.type.toLowerCase()}</span></div>
                      <div><strong className="text-[#1A1A1A]">Format:</strong> <span className="text-[#6B6B6B]">{getFormat(selectedMedia)}</span></div>
                      <div><strong className="text-[#1A1A1A]">Size:</strong> <span className="text-[#6B6B6B]">{formatBytes(selectedMedia.size)}</span></div>
                      <div><strong className="text-[#1A1A1A]">Added:</strong> <span className="text-[#6B6B6B]">{formatDate(selectedMedia.createdAt)}</span></div>
                      {selectedMedia.width && selectedMedia.height ? (
                        <div><strong className="text-[#1A1A1A]">Dimensions:</strong> <span className="text-[#6B6B6B]">{selectedMedia.width} × {selectedMedia.height} px</span></div>
                      ) : null}
                    </div>

                    {/* Editable Metadata Fields */}
                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">
                        TITLE
                      </label>
                      <input
                        type="text"
                        value={meta.title}
                        onChange={(e) => setMeta((prev) => ({ ...prev, title: e.target.value }))}
                        placeholder="Display title"
                        className="w-full h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-[13px] text-[#1A1A1A] focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">
                        ALT TEXT
                      </label>
                      <input
                        type="text"
                        value={meta.altText}
                        onChange={(e) => setMeta((prev) => ({ ...prev, altText: e.target.value }))}
                        placeholder="Required for images"
                        className="w-full h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-[13px] text-[#1A1A1A] focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">
                        DESCRIPTION
                      </label>
                      <textarea
                        rows={2}
                        value={meta.description}
                        onChange={(e) => setMeta((prev) => ({ ...prev, description: e.target.value }))}
                        placeholder="Optional notes or description"
                        className="w-full p-2.5 rounded-md border border-[#E6E6E6] bg-white text-[13px] text-[#1A1A1A] focus:border-[#E31E24] focus:outline-none resize-none"
                      />
                    </div>

                    <div>
                      <label className="block text-[11px] font-bold text-[#6B6B6B] uppercase tracking-wider mb-1">
                        TAGS
                      </label>
                      <input
                        type="text"
                        value={meta.tags}
                        onChange={(e) => setMeta((prev) => ({ ...prev, tags: e.target.value }))}
                        placeholder="hair, case-study, before-after"
                        className="w-full h-9 px-3 rounded-md border border-[#E6E6E6] bg-white text-[13px] text-[#1A1A1A] focus:border-[#E31E24] focus:outline-none"
                      />
                    </div>

                    {/* Admin Note */}
                    <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#FAFAFA] border border-[#EEEEEE] text-[11.5px] text-[#6B6B6B] leading-relaxed">
                      <ImageIcon size={14} className="shrink-0 mt-0.5 text-[#9A9A9A]" />
                      <span>
                        Admin delete can remove this media even if references still exist in website content,
                        SEO, or CMS blocks.
                      </span>
                    </div>
                  </div>

                  {/* Pinned Actions Footer */}
                  <div className="shrink-0 pt-3 border-t border-[#F0F0F0] bg-white flex flex-col gap-2.5">
                    {canEdit && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full h-10 rounded bg-[#102A43] hover:bg-[#0B1E30] text-white text-[12px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {saving ? "Saving..." : "Save Details"}
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2 w-full">
                      {mode === "select" && onSelect && (
                        <button
                          type="button"
                          disabled={!selectedMedia}
                          onClick={() => selectedMedia && onSelect(selectedMedia)}
                          className="w-full h-10 rounded bg-[#1E5AF9] hover:bg-[#1546CC] text-white text-[12px] font-bold tracking-wider uppercase transition-colors shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Attach Selected
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleting(selectedMedia.id)}
                          className={`h-10 rounded bg-[#D32F2F] hover:bg-[#B71C1C] text-white text-[12px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                            mode === "select" && onSelect ? "w-full" : "w-full col-span-2"
                          }`}
                        >
                          <Trash2 size={14} />
                          <span>Delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                </form>
              </>
            )}
          </div>
        )}
      </div>

      {/* ─── Delete Confirmation Modal ─── */}
      <ConfirmModal
        open={Boolean(deleting)}
        title="Delete media?"
        message="This permanently removes the file from storage and cannot be undone. Are you sure you want to proceed?"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleting(null)}
      />

      {ToastComponent}
    </div>
  );
}
