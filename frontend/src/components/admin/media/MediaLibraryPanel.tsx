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
  Folder,
  FolderOpen,
  ArrowLeft,
  Layers,
  Box,
  Tag,
  Users,
  ShoppingCart,
  Layout,
  BookOpen,
  Info,
  CornerLeftUp,
} from "lucide-react";
import { ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { mediaService, type MediaItem, type MediaFolderItem } from "@/services/mediaService";
import { getAdminErrorMessage } from "@/services/adminApi";

type Props = {
  mode?: "select" | "manage";
  value?: string;
  initialType?: "all" | "image" | "document" | "video";
  initialEntityType?: string;
  initialEntityId?: string;
  initialPurpose?: string;
  initialFolderName?: string;
  onSelect?: (media: MediaItem) => void;
  multiple?: boolean;
  onSelectMultiple?: (mediaList: MediaItem[]) => void;
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
    /\.(mp4|webm|ogg|mov|m4v)$/i.test(media.url || media.filename || "")
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

export default function MediaLibraryPanel({
  mode = "select",
  value = "",
  initialType,
  initialEntityType,
  initialEntityId,
  initialPurpose,
  initialFolderName,
  onSelect,
  multiple = false,
  onSelectMultiple,
}: Props) {
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

  const [type, setType] = useState<"all" | "image" | "document" | "video">(
    initialType || (mode === "select" ? "all" : "all")
  );
  // Folder Hierarchy States
  const [currentEntityType, setCurrentEntityType] = useState<string | undefined>(initialEntityType);
  const [currentEntityId, setCurrentEntityId] = useState<string | undefined>(initialEntityId);
  const [currentEntityName, setCurrentEntityName] = useState<string | undefined>(initialFolderName);
  const [currentPurpose, setCurrentPurpose] = useState<string | undefined>(initialPurpose);
  const [subfolders, setSubfolders] = useState<MediaFolderItem[]>([]);
  const [foldersLoading, setFoldersLoading] = useState(false);

  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState("");
  const [selectedItemsMap, setSelectedItemsMap] = useState<Map<string, MediaItem>>(new Map());
  const [detailsOpen, setDetailsOpen] = useState(mode === "select");
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);

  const selectedList = useMemo(() => Array.from(selectedItemsMap.values()), [selectedItemsMap]);

  const toggleSelect = (item: MediaItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItemsMap((prev) => {
      const next = new Map(prev);
      if (next.has(item.id)) {
        next.delete(item.id);
      } else {
        next.set(item.id, item);
      }
      return next;
    });
  };

  const [meta, setMeta] = useState({
    title: "",
    altText: "",
    description: "",
    tags: "",
  });

  const { showToast, ToastComponent } = useToast();

  const selectedMedia = useMemo(
    () => selectedItemsMap.get(selectedId) || items.find((item) => item.id === selectedId) || null,
    [selectedItemsMap, items, selectedId]
  );

  const carouselItems = useMemo(() => {
    if (multiple && selectedList.length > 0) {
      return selectedList;
    }
    return selectedMedia ? [selectedMedia] : [];
  }, [multiple, selectedList, selectedMedia]);

  const currentIndex = useMemo(
    () => carouselItems.findIndex((item) => item.id === selectedId),
    [carouselItems, selectedId]
  );

  const handlePrev = () => {
    if (carouselItems.length <= 1) return;
    const safeIdx = currentIndex >= 0 ? currentIndex : 0;
    const newIdx = safeIdx > 0 ? safeIdx - 1 : carouselItems.length - 1;
    setSelectedId(carouselItems[newIdx].id);
  };

  const handleNext = () => {
    if (carouselItems.length <= 1) return;
    const safeIdx = currentIndex >= 0 ? currentIndex : 0;
    const newIdx = safeIdx < carouselItems.length - 1 && safeIdx !== -1 ? safeIdx + 1 : 0;
    setSelectedId(carouselItems[newIdx].id);
  };

  useEffect(() => {
    if (multiple && selectedList.length > 0) {
      if (!selectedItemsMap.has(selectedId)) {
        setSelectedId(selectedList[0].id);
      }
    }
  }, [multiple, selectedList, selectedId, selectedItemsMap]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable
      ) {
        return;
      }
      if (carouselItems.length <= 1) return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [carouselItems, currentIndex]);

  // Sync initial props if they change
  useEffect(() => {
    if (initialEntityType !== undefined) setCurrentEntityType(initialEntityType);
    if (initialEntityId !== undefined) setCurrentEntityId(initialEntityId);
    if (initialPurpose !== undefined) setCurrentPurpose(initialPurpose);
    if (initialFolderName !== undefined) setCurrentEntityName(initialFolderName);
  }, [initialEntityType, initialEntityId, initialPurpose, initialFolderName]);

  const loadSubfolders = async () => {
    if (currentEntityType && currentEntityId && currentPurpose) {
      setSubfolders([]);
      return;
    }
    try {
      setFoldersLoading(true);
      const res = await mediaService.getFolders({
        entityType: currentEntityType && currentEntityType !== "ALL" ? currentEntityType : undefined,
        entityId: currentEntityId || undefined,
      });
      setSubfolders(res || []);
    } catch {
      setSubfolders([]);
    } finally {
      setFoldersLoading(false);
    }
  };

  useEffect(() => {
    void loadSubfolders();
  }, [currentEntityType, currentEntityId, currentPurpose]);

  const loadMedia = async (targetPage = page) => {
    try {
      setLoading(true);
      setError("");
      const res = await mediaService.list({
        page: targetPage,
        limit: 24,
        search: deferredSearch,
        type: type === "all" ? undefined : type,
        entityType: currentEntityType && currentEntityType !== "ALL" ? currentEntityType : undefined,
        entityId: currentEntityId || undefined,
        purpose: currentPurpose || undefined,
      });

      setItems(res.items);
      setTotalPages(res.pagination.totalPages || 1);
      setTotalItems(res.pagination.total || 0);
      setPage(res.pagination.page || 1);

      // Select active or first item
      const preferredId =
        (selectedId && (res.items.some((item) => item.id === selectedId) || selectedItemsMap.has(selectedId))
          ? selectedId
          : null) ||
        res.items.find((item) => item.url === value)?.id ||
        res.items[0]?.id ||
        "";
      if (preferredId) {
        setSelectedId(preferredId);
      }
      if (mode === "select" && preferredId) {
        setDetailsOpen(true);
      }

      if (value && multiple) {
        const matched = res.items.find((item) => item.url === value || item.id === value);
        if (matched) {
          setSelectedItemsMap((prev) => {
            if (!prev.has(matched.id)) {
              const next = new Map(prev);
              next.set(matched.id, matched);
              return next;
            }
            return prev;
          });
        }
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
  }, [deferredSearch, type, currentEntityType, currentEntityId, currentPurpose]);

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
        entityType: currentEntityType && currentEntityType !== "ALL" && currentEntityType !== "UNCATEGORIZED" ? currentEntityType : undefined,
        entityId: currentEntityId || undefined,
        purpose: currentPurpose || undefined,
      });

      const count = res.length;
      setSuccess(`Uploaded ${count} file${count === 1 ? "" : "s"} successfully.`);
      showToast(`Uploaded ${count} file${count === 1 ? "" : "s"}.`);

      const hasVideo = fileArray.some((f) => f.type.startsWith("video/") || /\.(mp4|webm|ogg|mov|m4v)$/i.test(f.name));
      const hasDoc = fileArray.some((f) => !f.type.startsWith("image/") && !f.type.startsWith("video/"));
      if (hasVideo && type !== "all" && type !== "video") {
        setType("all");
      } else if (hasDoc && type !== "all" && type !== "document") {
        setType("all");
      }

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
      setSelectedItemsMap((prev) => {
        if (prev.has(updated.id)) {
          const next = new Map(prev);
          next.set(updated.id, { ...prev.get(updated.id)!, ...updated });
          return next;
        }
        return prev;
      });
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

  const getFolderIcon = (iconName?: string) => {
    switch (iconName) {
      case "box": return <Box size={14} className="text-amber-600" />;
      case "layers": return <Layers size={14} className="text-indigo-600" />;
      case "folder": return <Folder size={14} className="text-blue-600" />;
      case "tag": return <Tag size={14} className="text-emerald-600" />;
      case "users": return <Users size={14} className="text-purple-600" />;
      case "shopping-cart": return <ShoppingCart size={14} className="text-cyan-600" />;
      case "video": return <Video size={14} className="text-rose-600" />;
      case "layout": return <Layout size={14} className="text-teal-600" />;
      case "book-open": return <BookOpen size={14} className="text-orange-600" />;
      case "info": return <Info size={14} className="text-sky-600" />;
      case "image": return <ImageIcon size={14} className="text-pink-600" />;
      case "file-text":
      case "file": return <FileText size={14} className="text-slate-600" />;
      default: return <Folder size={14} className="text-amber-500" />;
    }
  };

  const getModuleLabel = (typeKey?: string) => {
    switch (typeKey?.toUpperCase()) {
      case "PRODUCT": return "Products";
      case "VARIANT": return "Variants";
      case "CATEGORY": return "Categories";
      case "BRAND": return "Brands";
      case "CUSTOMER": return "Customers";
      case "ORDER": return "Orders";
      case "VIDEO": return "Videos";
      case "SYSTEM": return "System";
      case "CMS": return "CMS Pages";
      case "BLOG": return "Blogs";
      case "AUTHOR": return "Authors";
      case "BANNER": return "Banners";
      case "UNCATEGORIZED": return "Uncategorized";
      default: return typeKey || "Root";
    }
  };

  const getPurposeLabel = (purp?: string) => {
    switch (purp?.toLowerCase()) {
      case "gallery": return "Gallery Images";
      case "specifications": return "Specifications & Diagrams";
      case "catalogs": return "Catalogs & Brochures";
      case "basic-info": return "Basic Info Image";
      case "clinical-guidelines": return "Clinical Guidelines";
      default: return purp ? purp.charAt(0).toUpperCase() + purp.slice(1) : "General";
    }
  };

  return (
    <div className={`flex flex-col gap-4 font-sans text-[#1A1A1A] ${mode === "select" ? "h-full min-h-0 flex-1 overflow-hidden" : ""}`}>
      {/* ─── Top Toolbar ─── */}
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-xl border border-[#E6E6E6] shadow-xs">
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
                { id: "all", label: "All" },
                { id: "image", label: "Images" },
                { id: "video", label: "Videos" },
                { id: "document", label: "Documents" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setType(opt.id)}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
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
              value={currentEntityType || "ALL"}
              onChange={(e) => {
                const val = e.target.value;
                setCurrentEntityType(val === "ALL" ? undefined : val);
                setCurrentEntityId(undefined);
                setCurrentEntityName(undefined);
                setCurrentPurpose(undefined);
              }}
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
            onClick={() => {
              void loadMedia(page);
              void loadSubfolders();
            }}
            className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-[#E6E6E6] bg-white hover:bg-[#F9F9F9] text-[#6B6B6B] hover:text-[#1A1A1A] text-[13px] font-medium transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw size={14} className={loading || foldersLoading ? "animate-spin" : ""} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* ─── Breadcrumb & Subfolder Navigation Bar ─── */}
      <div className="shrink-0 flex flex-col gap-2.5 bg-[#FBFBFB] p-3 rounded-xl border border-[#E6E6E6]">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {/* Breadcrumb Path */}
          <div className="flex flex-wrap items-center gap-1.5 text-[12.5px]">
            {/* Level 0: Media Root */}
            <button
              type="button"
              onClick={() => {
                setCurrentEntityType(undefined);
                setCurrentEntityId(undefined);
                setCurrentEntityName(undefined);
                setCurrentPurpose(undefined);
              }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                !currentEntityType
                  ? "bg-white text-[#1A1A1A] font-bold shadow-2xs border border-[#E0E0E0]"
                  : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-white/80"
              }`}
            >
              <FolderOpen size={14} className="text-[#E31E24]" />
              <span>Media Library</span>
            </button>

            {/* Level 1: Module */}
            {currentEntityType && (
              <>
                <span className="text-[#9A9A9A]">/</span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentEntityId(undefined);
                    setCurrentEntityName(undefined);
                    setCurrentPurpose(undefined);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    !currentEntityId
                      ? "bg-white text-[#1A1A1A] font-bold shadow-2xs border border-[#E0E0E0]"
                      : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-white/80"
                  }`}
                >
                  <span>{getModuleLabel(currentEntityType)}</span>
                </button>
              </>
            )}

            {/* Level 2: Entity */}
            {currentEntityType && currentEntityId && (
              <>
                <span className="text-[#9A9A9A]">/</span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentPurpose(undefined);
                  }}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md font-medium transition-colors cursor-pointer ${
                    !currentPurpose
                      ? "bg-white text-[#1A1A1A] font-bold shadow-2xs border border-[#E0E0E0]"
                      : "text-[#6B6B6B] hover:text-[#1A1A1A] hover:bg-white/80"
                  }`}
                >
                  <span className="max-w-[180px] truncate">{currentEntityName || currentEntityId}</span>
                </button>
              </>
            )}

            {/* Level 3: Purpose */}
            {currentEntityType && currentEntityId && currentPurpose && (
              <>
                <span className="text-[#9A9A9A]">/</span>
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white text-[#E31E24] font-bold shadow-2xs border border-[#E0E0E0]">
                  <span>{getPurposeLabel(currentPurpose)}</span>
                </div>
              </>
            )}
          </div>

          {/* Up One Level button if not at root */}
          {Boolean(currentEntityType) && (
            <button
              type="button"
              onClick={() => {
                if (currentPurpose) {
                  setCurrentPurpose(undefined);
                } else if (currentEntityId) {
                  setCurrentEntityId(undefined);
                  setCurrentEntityName(undefined);
                } else if (currentEntityType) {
                  setCurrentEntityType(undefined);
                }
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-white hover:bg-[#F0F0F0] text-[#4A4A4A] hover:text-[#1A1A1A] text-[11.5px] font-semibold border border-[#E0E0E0] transition-colors cursor-pointer shadow-2xs ml-auto"
            >
              <CornerLeftUp size={13} />
              <span>Up Level</span>
            </button>
          )}
        </div>

        {/* Subfolder Chips */}
        {subfolders.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#EDEDED]">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#9A9A9A] mr-1">
              Folders:
            </span>
            {subfolders.map((folder) => (
              <button
                key={folder.id}
                type="button"
                onClick={() => {
                  if (!currentEntityType) {
                    // Clicking module folder
                    setCurrentEntityType(folder.id);
                  } else if (!currentEntityId) {
                    // Clicking entity folder
                    setCurrentEntityId(folder.id);
                    setCurrentEntityName(folder.name);
                  } else {
                    // Clicking purpose folder
                    setCurrentPurpose(folder.id);
                  }
                }}
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white hover:bg-[#F2F4F8] hover:border-[#1E5AF9]/40 border border-[#E6E6E6] text-[12px] font-medium text-[#1A1A1A] transition-all cursor-pointer shadow-2xs hover:shadow-xs group"
              >
                {getFolderIcon(folder.icon)}
                <span className="group-hover:text-[#1E5AF9] transition-colors font-medium">
                  {folder.name}
                </span>
                <span className="px-1.5 py-0.2 rounded-full bg-[#F0F0F0] group-hover:bg-blue-50 group-hover:text-[#1E5AF9] text-[#6B6B6B] text-[10.5px] font-bold">
                  {folder.count}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Alerts */}
      {error && (
        <div className="shrink-0 flex items-center gap-2 p-3 bg-red-50 border border-red-200 text-red-700 text-[13px] rounded-lg">
          <AlertCircle size={16} className="shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {success && (
        <div className="shrink-0 flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-[13px] rounded-lg">
          <Check size={16} className="shrink-0" />
          <span>{success}</span>
        </div>
      )}

      {/* ─── Main Content Layout ─── */}
      <div
        className={`grid grid-cols-1 gap-4 items-stretch ${
          mode === "select"
            ? "md:grid-cols-12 flex-1 min-h-0 overflow-hidden"
            : "xl:grid-cols-12"
        }`}
      >
        {/* Left: Media Grid Column */}
        <div
          className={`flex flex-col gap-3 bg-white p-3 sm:p-4 rounded-xl border border-[#E6E6E6] transition-all ${
            mode === "select"
              ? "md:col-span-6 lg:col-span-6 xl:col-span-6 h-full min-h-0 overflow-hidden"
              : detailsOpen && selectedMedia
              ? "xl:col-span-7 2xl:col-span-8"
              : "xl:col-span-12"
          }`}
        >
          {/* Header Status */}
          <div className="shrink-0 flex items-center justify-between text-[12.5px] text-[#6B6B6B] border-b border-[#F0F0F0] pb-2.5">
            <div className="flex items-center gap-2.5">
              <span>
                <strong>{totalItems}</strong> items
              </span>
              {multiple && selectedList.length > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-[#1E5AF9] bg-blue-50 px-2 py-0.5 rounded">
                    {selectedList.length} selected
                  </span>
                  <button
                    type="button"
                    onClick={() => setSelectedItemsMap(new Map())}
                    className="text-xs text-[#6B6B6B] hover:text-[#D32F2F] underline cursor-pointer"
                  >
                    Clear
                  </button>
                </div>
              )}
            </div>
            <span>
              Page <strong>{page}</strong> of <strong>{totalPages}</strong>
            </span>
          </div>

          {/* Grid or Empty/Loading State */}
          <div className={mode === "select" ? "flex-1 min-h-0 overflow-y-auto pr-1" : ""}>
            {loading ? (
              <div
                className={`grid gap-3 py-1 ${
                  mode === "select"
                    ? "grid-cols-2"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6"
                }`}
              >
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
                className={`grid gap-3 py-1 ${
                  mode === "select"
                    ? "grid-cols-2"
                    : detailsOpen && selectedMedia
                    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-5"
                    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8"
                }`}
              >
                {items.map((item) => {
                  const active = item.id === selectedId;
                  const isSelected = selectedItemsMap.has(item.id);
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
                        if (multiple && !selectedItemsMap.has(item.id)) {
                          toggleSelect(item);
                        }
                      }}
                      onDoubleClick={() => {
                        if (mode === "select" && !multiple && onSelect) onSelect(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setSelectedId(item.id);
                          setDetailsOpen(true);
                          if (multiple && !selectedItemsMap.has(item.id)) {
                            toggleSelect(item);
                          }
                        }
                      }}
                      className={`group relative flex flex-col rounded-lg border bg-white overflow-hidden text-left cursor-pointer transition-all ${
                        multiple && isSelected
                          ? "border-[#1E5AF9] ring-2 ring-[#1E5AF9]/30 shadow-sm"
                          : active
                          ? "border-[#1E5AF9] ring-2 ring-[#1E5AF9]/25 shadow-sm"
                          : "border-[#E6E6E6] hover:border-[#9A9A9A] hover:shadow-xs"
                      }`}
                    >
                      {/* Multi-select Checkbox Badge */}
                      {multiple && (
                        <button
                          type="button"
                          aria-label={isSelected ? "Deselect item" : "Select item"}
                          onClick={(e) => toggleSelect(item, e)}
                          className={`absolute top-2 left-2 z-10 w-5 h-5 rounded flex items-center justify-center transition-all ${
                            isSelected
                              ? "bg-[#1E5AF9] text-white shadow-xs"
                              : "bg-white/90 border border-[#D1D5DB] text-transparent hover:border-[#1E5AF9]"
                          }`}
                        >
                          <Check size={12} strokeWidth={3} className={isSelected ? "opacity-100" : "opacity-0"} />
                        </button>
                      )}

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
                          <div className="relative w-full h-full bg-neutral-900 flex items-center justify-center overflow-hidden">
                            <video
                              src={`${item.url}#t=0.001`}
                              preload="metadata"
                              muted
                              playsInline
                              className="w-full h-full object-cover pointer-events-none transition-transform duration-300 group-hover:scale-105"
                            />
                            <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/65 backdrop-blur-xs text-white text-[10px] font-bold px-1.5 py-0.5 rounded shadow-xs z-10">
                              <Video size={11} />
                              <span>{formatLabel}</span>
                            </div>
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
          </div>

          {/* Bottom Pagination */}
          <div className="shrink-0 flex items-center justify-between pt-2.5 border-t border-[#F0F0F0]">
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
            className={`bg-white p-3 sm:p-4 rounded-xl border border-[#E6E6E6] shadow-xs flex flex-col ${
              mode === "select"
                ? "md:col-span-6 lg:col-span-6 xl:col-span-6 h-full min-h-0 max-h-full overflow-hidden"
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
                <div className="flex items-center justify-between border-b border-[#F0F0F0] pb-2.5 shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-[14px] font-bold text-[#1A1A1A]">Media Details</h3>
                    {multiple && selectedList.length > 1 && (
                      <span className="text-[11px] font-semibold text-[#1E5AF9] bg-blue-50 px-2 py-0.5 rounded">
                        {selectedList.length} Selected
                      </span>
                    )}
                  </div>
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
                <form onSubmit={handleSaveDetails} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                  {/* Scrollable Content Area */}
                  <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1.5 pt-3 pb-2 space-y-3">

                    {/* ─── Carousel Preview Box ─── */}
                    <div className="relative group h-44 sm:h-48 w-full rounded-xl bg-[#0D1117]/5 border border-[#E6E6E6] flex items-center justify-center overflow-hidden shrink-0 select-none">
                      {/* Media Display */}
                      <div className="w-full h-full flex items-center justify-center p-2">
                        {isImage(selectedMedia) ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            key={selectedMedia.id}
                            src={selectedMedia.url}
                            alt={selectedMedia.altText || selectedMedia.title || selectedMedia.originalName}
                            className="max-h-full max-w-full object-contain rounded transition-all duration-200"
                          />
                        ) : isVideo(selectedMedia) ? (
                          <video
                            key={selectedMedia.id}
                            src={selectedMedia.url}
                            controls
                            className="max-h-full max-w-full rounded object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center gap-2 text-[#9A9A9A]">
                            <FileText size={36} />
                            <span className="text-[11px] font-semibold text-[#6B6B6B] truncate max-w-[200px]">
                              {selectedMedia.originalName}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Carousel Arrow: Prev */}
                      {carouselItems.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handlePrev();
                          }}
                          aria-label="Previous image"
                          className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95 z-20"
                          title="Previous image (←)"
                        >
                          <ChevronLeft size={18} />
                        </button>
                      )}

                      {/* Carousel Arrow: Next */}
                      {carouselItems.length > 1 && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            handleNext();
                          }}
                          aria-label="Next image"
                          className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center transition-all shadow-md cursor-pointer hover:scale-105 active:scale-95 z-20"
                          title="Next image (→)"
                        >
                          <ChevronRight size={18} />
                        </button>
                      )}

                      {/* Carousel Top Badges: Counter + Select Toggle */}
                      <div className="absolute top-2 left-2 flex items-center gap-1.5 z-10">
                        {carouselItems.length > 1 && (
                          <span className="px-2 py-0.5 rounded-md bg-black/70 text-white text-[10.5px] font-semibold tracking-wider backdrop-blur-xs">
                            {(currentIndex >= 0 ? currentIndex : 0) + 1} / {carouselItems.length}
                          </span>
                        )}
                        {multiple && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              toggleSelect(selectedMedia);
                            }}
                            className={`px-2 py-0.5 rounded-md text-[10.5px] font-semibold tracking-wide flex items-center gap-1 cursor-pointer transition-colors shadow-xs ${
                              selectedItemsMap.has(selectedMedia.id)
                                ? "bg-[#1E5AF9] text-white"
                                : "bg-white/90 text-[#4B5563] hover:bg-white hover:text-[#1A1A1A]"
                            }`}
                          >
                            <Check size={11} strokeWidth={3} className={selectedItemsMap.has(selectedMedia.id) ? "opacity-100" : "opacity-0"} />
                            <span>{selectedItemsMap.has(selectedMedia.id) ? "Selected" : "Select"}</span>
                          </button>
                        )}
                      </div>

                      {/* Carousel Bottom Label */}
                      <div className="absolute bottom-2 inset-x-2 flex items-center justify-center pointer-events-none">
                        <span className="px-2.5 py-0.5 rounded-full bg-black/60 text-white text-[10.5px] font-medium truncate max-w-[85%] backdrop-blur-xs shadow-xs text-center">
                          {selectedMedia.title || selectedMedia.originalName}
                        </span>
                      </div>
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
                  <div className="shrink-0 pt-3 border-t border-[#F0F0F0] bg-white flex flex-col gap-2 mt-auto">
                    {canEdit && (
                      <button
                        type="submit"
                        disabled={saving}
                        className="w-full h-9 rounded bg-[#102A43] hover:bg-[#0B1E30] text-white text-[12px] font-bold tracking-wider uppercase transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                      >
                        {saving ? "Saving..." : "Save Details"}
                      </button>
                    )}

                    <div className="grid grid-cols-2 gap-2 w-full">
                      {mode === "select" && (onSelect || onSelectMultiple) && (
                        <button
                          type="button"
                          disabled={multiple ? selectedList.length === 0 : !selectedMedia}
                          onClick={() => {
                            if (multiple && onSelectMultiple) {
                              if (selectedList.length > 0) {
                                onSelectMultiple(selectedList);
                              } else if (selectedMedia) {
                                onSelectMultiple([selectedMedia]);
                              }
                            } else if (onSelect && selectedMedia) {
                              onSelect(selectedMedia);
                            }
                          }}
                          className="w-full h-9 rounded bg-[#1E5AF9] hover:bg-[#1546CC] text-white text-[12px] font-bold tracking-wider uppercase transition-colors shadow-2xs cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {multiple && selectedList.length > 0
                            ? `Attach Selected (${selectedList.length})`
                            : "Attach Selected"}
                        </button>
                      )}

                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => setDeleting(selectedMedia.id)}
                          className={`h-9 rounded bg-[#D32F2F] hover:bg-[#B71C1C] text-white text-[12px] font-bold tracking-wider uppercase transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs ${
                            mode === "select" && (onSelect || onSelectMultiple) ? "w-full" : "w-full col-span-2"
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
