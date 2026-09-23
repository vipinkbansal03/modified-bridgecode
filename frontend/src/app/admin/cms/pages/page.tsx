"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ChevronLeft,
  Edit2,
  ExternalLink,
  Eye,
  FileEdit,
  FileText,
  Globe,
  HelpCircle,
  Info,
  LayoutList,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  ImageIcon,
  CheckCircle,
  XCircle,
  Lock,
} from "lucide-react";
import { MediaSelectorModal } from "@/components/admin/media/MediaSelectorModal";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  AdminStatsGrid,
  ConfirmModal,
  DataTable,
  type Column,
  StatCard,
  StatusBadge,
  useToast,
  AdminStickySaveBar,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import {
  useAdminCmsPage,
  useAdminCmsPages,
  useCreateCmsBlock,
  useCreateCmsSection,
  useDeleteCmsBlock,
  useDeleteCmsSection,
  useUpdateCmsBlock,
  useUpdateCmsSection,
} from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { uploadMediaFiles } from "@/utils/uploadMedia";
import { DetailPageEditor } from "@/components/admin/cms/DetailPageEditor";
import { DETAIL_PAGE_CONFIGS } from "@/config/detailPageConfigs";

type CmsPageRow = {
  id: string;
  title: string;
  slug: string;
  pageKey: string;
  status: string;
  updatedAt?: string;
  _count?: { sections: number };
  sections?: Section[];
};

type Block = {
  id: string;
  blockType: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  image?: string | null;
  icon?: string | null;
  linkLabel?: string | null;
  linkUrl?: string | null;
  sortOrder: number;
};

type Section = {
  id: string;
  sectionKey: string;
  title?: string | null;
  subtitle?: string | null;
  description?: string | null;
  status: string;
  settingsJson?: unknown;
  sortOrder: number;
  blocks: Block[];
};

type Page = {
  id: string;
  title: string;
  slug: string;
  pageKey: string;
  status: string;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  robotsTag?: string | null;
  canonicalUrl?: string | null;
  favicon?: string | null;
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
  twitterTitle?: string | null;
  twitterDescription?: string | null;
  twitterImage?: string | null;
  faqSchemaJson?: unknown;
  sections: Section[];
};

type MainViewMode = "overview" | "studio";
type StudioTab = "content" | "seo";

// Canonical ordering of CMS pages in table
const PAGE_DISPLAY_ORDER: Record<string, number> = {
  "home": 1,
  "products": 2,
  "design-and-engineering": 3,
  "manufacturing": 4,
  "oem-services": 5,
  "custom-packaging": 6,
  "quality-certifications": 7,
  "contact": 8,
  "about": 9,
};

// Core system routes that cannot be unpublished or deleted
const CORE_SYSTEM_PAGES = new Set(["home", "about", "contact", "products"]);

function PageStatusButton({
  row,
  onToggle,
  disabled = false,
  size = "sm",
}: {
  row: CmsPageRow | Page;
  onToggle: () => void | Promise<void>;
  disabled?: boolean;
  size?: "sm" | "md";
}) {
  const isSystemPage = CORE_SYSTEM_PAGES.has(row.pageKey);
  const isPublished = row.status === "ACTIVE" || row.status === "PUBLISHED" || isSystemPage;

  if (isSystemPage) {
    return (
      <div
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full font-semibold select-none border shadow-2xs cursor-default bg-emerald-50 text-emerald-800 border-emerald-200",
          size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]"
        )}
        title="Core system page — always active. Section-level toggles control visibility."
      >
        <Lock size={size === "sm" ? 11 : 12.5} className="text-emerald-700 shrink-0" />
        <span>Published</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) void onToggle();
      }}
      disabled={disabled}
      title={
        isPublished
          ? "Page is Published live on the website. Click to unpublish."
          : "Page is Unpublished (Hidden from storefront). Click to publish live."
      }
      className={cn(
        "group inline-flex items-center gap-1.5 rounded-full font-semibold transition-all select-none border shadow-2xs",
        size === "sm" ? "px-2.5 py-1 text-[11.5px]" : "px-3.5 py-1.5 text-[12.5px]",
        isPublished
          ? "bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 hover:shadow-xs active:scale-95"
          : "bg-gray-100 text-gray-700 border-gray-200 hover:bg-gray-200 hover:border-gray-300 hover:shadow-xs active:scale-95",
        disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"
      )}
    >
      <span
        className={cn(
          "rounded-full transition-transform group-hover:scale-125",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
          isPublished ? "bg-emerald-500" : "bg-gray-400"
        )}
      />
      <span>{isPublished ? "Published" : "Unpublished"}</span>
    </button>
  );
}

function CmsPagesManagementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();
  const { hasPermission } = useAdminAuth();
  const { showToast } = useToast();

  const canUpdate = hasPermission("cms.edit");

  // Query state
  const pageIdParam = searchParams.get("pageId") ?? "";
  const tabParam = (searchParams.get("tab") as StudioTab) || "content";

  const [selectedPageId, setSelectedPageId] = useState<string>(pageIdParam);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");
  const [studioTab, setStudioTab] = useState<StudioTab>(tabParam);
  const [viewMode, setViewMode] = useState<MainViewMode>(pageIdParam ? "studio" : "overview");

  // Data fetching
  const { data: pagesData, isLoading: isPagesLoading } = useAdminCmsPages();
  const pages: CmsPageRow[] = useMemo(() => {
    const raw = pagesData as { data?: CmsPageRow[] } | CmsPageRow[] | undefined;
    const list: CmsPageRow[] = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.data) ? raw.data : []);
    return [...list].sort((a, b) => {
      const orderA = PAGE_DISPLAY_ORDER[a.pageKey] ?? 999;
      const orderB = PAGE_DISPLAY_ORDER[b.pageKey] ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      return a.title.localeCompare(b.title);
    });
  }, [pagesData]);

  // Handle URL param changes
  useEffect(() => {
    if (pageIdParam) {
      setSelectedPageId(pageIdParam);
      setViewMode("studio");
    } else {
      setSelectedPageId("");
      setViewMode("overview");
    }
  }, [pageIdParam]);

  const activePageId = selectedPageId || (pages[0]?.id ?? "");

  const { data: selectedPageData, isLoading: isPageLoading, refetch: refetchPage } = useAdminCmsPage(
    viewMode === "studio" && activePageId ? activePageId : ""
  );

  const selectedPage = useMemo(() => {
    if (!selectedPageData) return null;
    return selectedPageData as Page;
  }, [selectedPageData]);

  useEffect(() => {
    if (selectedPage?.sections?.length) {
      setSelectedSectionId((prev) => {
        if (prev && selectedPage.sections.some((s) => s.id === prev)) {
          return prev;
        }
        return selectedPage.sections[0].id;
      });
    } else {
      setSelectedSectionId("");
    }
  }, [selectedPage]);

  // Page level publish / unpublish toggle for non-system pages
  const togglePageStatus = async (page: CmsPageRow | Page) => {
    if (CORE_SYSTEM_PAGES.has(page.pageKey)) return;
    const nextStatus = page.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await adminApi.put(`/cms/pages/${page.id}`, {
        status: nextStatus,
      });
      showToast(
        nextStatus === "ACTIVE"
          ? `"${page.title}" is now Published on the live storefront.`
          : `"${page.title}" is now Unpublished (Draft mode).`,
        "success"
      );
      queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-page", page.id] });
    } catch (err) {
      console.error("Failed to toggle page status:", err);
      showToast("Failed to update page status. Please try again.", "error");
    }
  };

  // Create & Delete Page State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newPageTitle, setNewPageTitle] = useState("");
  const [newPageSlug, setNewPageSlug] = useState("");
  const [creatingPage, setCreatingPage] = useState(false);
  const [deletingPageId, setDeletingPageId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleCreatePage = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanTitle = newPageTitle.trim();
    const cleanSlug = newPageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

    if (!cleanTitle || !cleanSlug) {
      showToast("Please provide both a Page Title and a URL slug.", "error");
      return;
    }

    try {
      setCreatingPage(true);
      const res = await adminApi.post("/cms/pages", {
        title: cleanTitle,
        slug: cleanSlug,
        pageKey: cleanSlug,
        status: "ACTIVE",
      });

      const newPage = res.data?.data || res.data;

      // Create initial default hero section
      if (newPage?.id) {
        await adminApi.post(`/cms/pages/${newPage.id}/sections`, {
          sectionKey: `${cleanSlug}.hero`,
          title: cleanTitle,
          sortOrder: 0,
          status: "ACTIVE",
        });
      }

      showToast(`Page "${cleanTitle}" created successfully!`, "success");
      setShowCreateModal(false);
      setNewPageTitle("");
      setNewPageSlug("");

      await queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });

      if (newPage?.id) {
        setSelectedPageId(newPage.id);
        setViewMode("studio");
        router.push(`/admin/cms/pages?pageId=${newPage.id}`);
      }
    } catch (err) {
      console.error("Failed to create page:", err);
      showToast("Failed to create page. URL slug may already exist.", "error");
    } finally {
      setCreatingPage(false);
    }
  };

  const handleDeletePage = async () => {
    if (!deletingPageId) return;
    try {
      setIsDeleting(true);
      await adminApi.delete(`/cms/pages/${deletingPageId}`);
      showToast("Page deleted successfully.", "success");
      setDeletingPageId(null);
      await queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      if (selectedPageId === deletingPageId) {
        setSelectedPageId(pages[0]?.id || "");
        setViewMode("overview");
        router.push("/admin/cms/pages");
      }
    } catch (err) {
      console.error("Failed to delete page:", err);
      showToast("Failed to delete page.", "error");
    } finally {
      setIsDeleting(false);
    }
  };

  // Edit Page Info (Title & Slug) State
  const [showEditInfoModal, setShowEditInfoModal] = useState(false);
  const [editPageTitle, setEditPageTitle] = useState("");
  const [editPageSlug, setEditPageSlug] = useState("");
  const [savingPageInfo, setSavingPageInfo] = useState(false);

  const openEditInfoModal = () => {
    if (!selectedPage) return;
    setEditPageTitle(selectedPage.title);
    setEditPageSlug(selectedPage.slug);
    setShowEditInfoModal(true);
  };

  const handleUpdatePageInfo = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPage) return;
    const cleanTitle = editPageTitle.trim();
    const cleanSlug = editPageSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "");

    if (!cleanTitle || !cleanSlug) {
      showToast("Please provide both a Page Title and a URL slug.", "error");
      return;
    }

    try {
      setSavingPageInfo(true);
      await adminApi.put(`/cms/pages/${selectedPage.id}`, {
        title: cleanTitle,
        slug: cleanSlug,
      });

      showToast("Page title & URL slug updated successfully!", "success");
      setShowEditInfoModal(false);
      await queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      await queryClient.invalidateQueries({ queryKey: ["admin-cms-page", selectedPage.id] });
      refetchPage();
    } catch (err) {
      console.error("Failed to update page info:", err);
      showToast("Failed to update page info. URL slug may already be in use.", "error");
    } finally {
      setSavingPageInfo(false);
    }
  };

  // SEO Form State
  const [seoForm, setSeoForm] = useState({
    seoTitle: "",
    seoDescription: "",
    seoKeywords: "",
    robotsTag: "index,follow",
    canonicalUrl: "",
    favicon: "",
    ogTitle: "",
    ogDescription: "",
    ogImage: "",
    twitterTitle: "",
    twitterDescription: "",
    twitterImage: "",
  });

  const [savingSeo, setSavingSeo] = useState(false);
  const [uploadingSeoAsset, setUploadingSeoAsset] = useState<string | null>(null);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);

  useEffect(() => {
    if (selectedPage) {
      setSeoForm({
        seoTitle: selectedPage.seoTitle || "",
        seoDescription: selectedPage.seoDescription || "",
        seoKeywords: selectedPage.seoKeywords || "",
        robotsTag: selectedPage.robotsTag || "index,follow",
        canonicalUrl: selectedPage.canonicalUrl || "",
        favicon: selectedPage.favicon || "",
        ogTitle: selectedPage.ogTitle || "",
        ogDescription: selectedPage.ogDescription || "",
        ogImage: selectedPage.ogImage || "",
        twitterTitle: selectedPage.twitterTitle || "",
        twitterDescription: selectedPage.twitterDescription || "",
        twitterImage: selectedPage.twitterImage || "",
      });
    }
  }, [selectedPage]);

  const handleSaveSeo = async () => {
    if (!selectedPage) return;
    try {
      setSavingSeo(true);
      await adminApi.put(`/cms/pages/${selectedPage.id}`, seoForm);
      showToast("SEO & Metadata updated successfully!", "success");
      queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
      queryClient.invalidateQueries({ queryKey: ["admin-cms-page", selectedPage.id] });
    } catch (err) {
      console.error("Failed to save SEO:", err);
      showToast("Failed to save SEO settings.", "error");
    } finally {
      setSavingSeo(false);
    }
  };

  const uploadSeoImage = async (field: "favicon" | "ogImage" | "twitterImage", file: File) => {
    try {
      setUploadingSeoAsset(field);
      const results = await uploadMediaFiles([file]);
      if (results[0]?.url) {
        setSeoForm((prev) => ({ ...prev, [field]: results[0].url }));
        showToast("Image uploaded successfully!", "success");
      }
    } catch (err) {
      console.error("Failed to upload SEO image:", err);
      showToast("Failed to upload image.", "error");
    } finally {
      setUploadingSeoAsset(null);
    }
  };

  // Stats calculation
  const pageStats = useMemo(() => {
    const total = pages.length;
    const published = pages.filter((p) => p.status === "ACTIVE" || CORE_SYSTEM_PAGES.has(p.pageKey)).length;
    const draft = pages.filter((p) => p.status !== "ACTIVE" && !CORE_SYSTEM_PAGES.has(p.pageKey)).length;
    const totalSections = pages.reduce((sum, p) => sum + (p._count?.sections ?? p.sections?.length ?? 0), 0);
    return { total, published, draft, totalSections };
  }, [pages]);

  // Overview Table Columns
  const overviewColumns: Column<CmsPageRow>[] = [
    {
      key: "title",
      label: "Page",
      render: (row) => (
        <div className="flex flex-col gap-0.5 min-w-[180px]">
          <span className="font-semibold text-[14.5px] text-[#1A1A1A]">{row.title}</span>
          {row.pageKey === "products" && (
            <span className="text-[11.5px] text-[#8B8B8B]">
              Catalog & pricing managed in Products module
            </span>
          )}
        </div>
      ),
    },
    {
      key: "slug",
      label: "Storefront Route",
      render: (row) => (
        <a
          href={`/${row.slug === "home" ? "" : row.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-[13px] text-[#0F2D52] hover:text-[#E31E24] hover:underline font-mono"
        >
          <span>/{row.slug === "home" ? "" : row.slug}</span>
          <ExternalLink size={12} className="text-gray-400" />
        </a>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row) => (
        <PageStatusButton
          row={row}
          onToggle={() => togglePageStatus(row)}
          disabled={!canUpdate}
          size="sm"
        />
      ),
    },
    {
      key: "sections",
      label: "Sections",
      render: (row) => (
        row.pageKey === "products" ? (
          <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700 border border-blue-200">
            SEO & Metadata Only
          </span>
        ) : (
          <span className="text-[13px] text-[#555]">
            {(row._count?.sections ?? row.sections?.length ?? 0)} section{(row._count?.sections ?? row.sections?.length ?? 0) !== 1 ? "s" : ""}
          </span>
        )
      ),
    },
    {
      key: "updatedAt",
      label: "Updated",
      render: (row) => (
        <span className="text-[12.5px] text-[#8B8B8B]">
          {row.updatedAt ? new Date(row.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row) => {
        const isSystemPage = CORE_SYSTEM_PAGES.has(row.pageKey);
        return (
          <div className="flex items-center gap-1.5 justify-start">
            <button
              type="button"
              onClick={() => {
                setSelectedPageId(row.id);
                setViewMode("studio");
                router.push(`/admin/cms/pages?pageId=${row.id}`);
              }}
              className="inline-flex items-center justify-center rounded-lg border border-[#E6E6E6] bg-white p-2 text-[#555] hover:bg-gray-50 hover:text-[#E31E24] hover:border-red-200 transition-colors shadow-2xs"
              title="Edit in Page Studio"
              aria-label={`Edit ${row.title} in Page Studio`}
            >
              <Edit2 size={14} className="text-[#E31E24]" />
            </button>
            {!isSystemPage && canUpdate && (
              <button
                type="button"
                onClick={() => setDeletingPageId(row.id)}
                className="inline-flex items-center justify-center rounded-lg border border-[#E6E6E6] bg-white p-2 text-[#555] hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors shadow-2xs"
                title="Delete Page"
                aria-label={`Delete ${row.title}`}
              >
                <Trash2 size={14} className="text-red-500" />
              </button>
            )}
          </div>
        );
      },
    },
  ];

  return (
    <AdminLayout title="CMS Pages" breadcrumb={[{ label: "Content" }, { label: "Pages" }]}>
      {/* ── StatCards Row ── */}
      <AdminStatsGrid
        stats={[
          { title: "Total System Pages", value: pageStats.total, subtitle: "Core website architecture", icon: <FileText size={18} /> },
          { title: "Published Pages", value: pageStats.total, subtitle: "Live on storefront", icon: <Globe size={18} />, color: "bg-green-600" },
          { title: "Content Sections", value: pageStats.totalSections, subtitle: "Managed storefront sections", icon: <LayoutList size={18} />, color: "bg-[#0F6CBD]" },
        ]}
        isLoading={isPagesLoading}
      />

      {/* ── Main Top View Mode Switcher ── */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E6E6] pb-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setViewMode("overview");
              router.push("/admin/cms/pages");
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-all",
              viewMode === "overview"
                ? "bg-[#1A1A1A] text-white shadow-xs"
                : "bg-white text-[#555] border border-[#E6E6E6] hover:bg-gray-50 hover:text-[#1A1A1A]"
            )}
          >
            <LayoutList size={15} />
            <span>Overview</span>
          </button>

          <button
            type="button"
            onClick={() => {
              const targetId = selectedPageId || pages[0]?.id;
              if (targetId) {
                setSelectedPageId(targetId);
                setViewMode("studio");
                router.push(`/admin/cms/pages?pageId=${targetId}`);
              }
            }}
            className={cn(
              "flex items-center gap-2 rounded-lg px-4 py-2 text-[13.5px] font-semibold transition-all",
              viewMode === "studio"
                ? "bg-[#1A1A1A] text-white shadow-xs"
                : "bg-white text-[#555] border border-[#E6E6E6] hover:bg-gray-50 hover:text-[#1A1A1A]"
            )}
          >
            <Edit2 size={15} />
            <span>Page Studio</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {canUpdate && (
            <button
              type="button"
              onClick={() => {
                setNewPageTitle("");
                setNewPageSlug("");
                setShowCreateModal(true);
              }}
              className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-bold text-white hover:bg-[#B5151B] transition-colors shadow-xs cursor-pointer"
            >
              <Plus size={16} />
              <span>Create New Page</span>
            </button>
          )}

          {viewMode === "studio" && (
            <button
              type="button"
              onClick={() => {
                setViewMode("overview");
                router.push("/admin/cms/pages");
              }}
              className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#555] hover:text-[#1A1A1A] transition-colors cursor-pointer"
            >
              <ArrowLeft size={14} />
              <span>Back to All Pages</span>
            </button>
          )}
        </div>
      </div>

      {/* ── VIEW 1: CMS OVERVIEW TABLE ── */}
      {viewMode === "overview" && (
        <div className="space-y-4">
          <DataTable<CmsPageRow>
            title="Website Pages Overview"
            description="Manage core website pages, view live URLs, and toggle publish status."
            columns={overviewColumns}
            data={pages}
            rowKey="id"
            isLoading={isPagesLoading}
            emptyMessage="No CMS pages found."
          />
        </div>
      )}

      {/* ── VIEW 2: PAGE STUDIO ── */}
      {viewMode === "studio" && (
        <div className="space-y-5">
          {/* Top Page Selector & Live Status Header */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-xs">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              {/* Page Selector */}
              <div className="flex-1 max-w-md">
                <AdminSelect
                  label="SELECT PAGE TO EDIT"
                  value={selectedPageId || pages[0]?.id || ""}
                  onChange={(e) => {
                    setSelectedPageId(e.target.value);
                    router.push(`/admin/cms/pages?pageId=${e.target.value}`);
                  }}
                  options={pages.map((p) => ({
                    value: p.id,
                    label: p.title,
                  }))}
                />
              </div>

              {/* Status & Quick Actions */}
              {selectedPage && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <div className="flex items-center gap-1.5 rounded-lg bg-gray-100 border border-gray-200 px-3 py-1.5 text-xs text-gray-700 font-mono">
                    <span className="text-gray-400 font-sans text-[11px] uppercase tracking-wider font-semibold">Storefront:</span>
                    <a
                      href={`/${selectedPage.slug === "home" ? "" : selectedPage.slug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-bold text-[#0F2D52] hover:text-[#E31E24] hover:underline inline-flex items-center gap-1"
                      title="Open page live in new tab"
                    >
                      <span>/{selectedPage.slug === "home" ? "" : selectedPage.slug}</span>
                      <ExternalLink size={12} className="text-gray-400" />
                    </a>
                  </div>

                  {!CORE_SYSTEM_PAGES.has(selectedPage.pageKey) && canUpdate && (
                    <button
                      type="button"
                      onClick={openEditInfoModal}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12.5px] font-medium text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-2xs cursor-pointer"
                      title="Edit Page Title or URL Slug"
                    >
                      <Edit2 size={13} className="text-gray-600" />
                      <span>Edit Title & Slug</span>
                    </button>
                  )}

                  <PageStatusButton
                    row={selectedPage}
                    onToggle={() => togglePageStatus(selectedPage)}
                    disabled={!canUpdate}
                    size="md"
                  />
                </div>
              )}
            </div>

            {/* Studio Sub-Tabs (Content | SEO) */}
            <div className="mt-4 flex gap-2 border-t border-[#E6E6E6] pt-3">
              <button
                type="button"
                onClick={() => setStudioTab("content")}
                className={cn(
                  "border-b-2 px-4 py-2 text-[13px] font-semibold tracking-wide transition-colors",
                  studioTab === "content"
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]"
                )}
              >
                PAGE CONTENT
              </button>
              <button
                type="button"
                onClick={() => setStudioTab("seo")}
                className={cn(
                  "border-b-2 px-4 py-2 text-[13px] font-semibold tracking-wide transition-colors",
                  studioTab === "seo"
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]"
                )}
              >
                SEO & METADATA
              </button>
            </div>
          </div>

          {/* Loading or Missing Page */}
          {isPagesLoading || isPageLoading ? (
            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] px-5 py-16 text-center text-sm text-[#9A9A9A]">
              <div className="mx-auto mb-3 h-6 w-6 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
              <span>Loading Page Studio content...</span>
            </div>
          ) : !selectedPage ? (
            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] px-5 py-12 text-center text-sm text-[#9A9A9A]">
              No page selected.
            </div>
          ) : (
            <>
              {/* ── TAB 1: PAGE CONTENT ── */}
              {studioTab === "content" && (
                selectedPage.pageKey === "products" ? (
                  <div className="rounded-xl border border-[#E6E6E6] bg-white p-8 space-y-4">
                    <div className="flex items-start gap-4 rounded-xl border border-blue-200 bg-blue-50/70 p-5">
                      <Info size={24} className="text-blue-600 shrink-0 mt-0.5" />
                      <div className="space-y-1 text-sm text-blue-900">
                        <h4 className="font-bold text-[15px] text-blue-950">Product Catalog Management</h4>
                        <p className="leading-relaxed">
                          The product catalog, pricing, inventory, categories, and filter systems are managed dynamically through the dedicated <strong>Products & Catalog</strong> modules.
                        </p>
                        <p className="leading-relaxed">
                          To customize page titles, search engine descriptions, keywords, and OpenGraph social cards for <code className="bg-blue-100 px-1.5 py-0.5 rounded font-mono text-[12px]">/products</code>, switch to the <strong>SEO & METADATA</strong> tab above.
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pt-2">
                      <Link
                        href="/admin/products"
                        className="inline-flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-xs"
                      >
                        <span>Open Products Module</span>
                      </Link>
                      <button
                        type="button"
                        onClick={() => setStudioTab("seo")}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-semibold text-[#1A1A1A] hover:bg-gray-50 transition-colors shadow-2xs"
                      >
                        <span>Edit /products SEO</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <DetailPageEditor
                    page={selectedPage}
                    onSaved={() => {
                      refetchPage();
                      queryClient.invalidateQueries({ queryKey: ["admin-cms-pages"] });
                    }}
                  />
                )
              )}

              {/* ── TAB 2: SEO & METADATA ── */}
              {studioTab === "seo" && (
                <div className="space-y-5">
                  <AdminStickySaveBar
                    title={`${selectedPage.title} — SEO & Metadata`}
                    subtitle="Search engine optimization and Open Graph social sharing tags."
                    saving={savingSeo}
                    savingText="Saving SEO…"
                    saveLabel="Save SEO Settings"
                    onSave={handleSaveSeo}
                  />

                  <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 space-y-8">
                    {/* Core Meta Tags */}
                    <div>
                      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[#9A9A9A]">Core Search Engine Tags</h3>
                      <div className="mt-4 space-y-5 border-t border-[#E6E6E6] pt-5">
                        <div>
                          <AdminInput
                            label="META TITLE"
                            maxLength={120}
                            value={seoForm.seoTitle}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, seoTitle: e.target.value }))}
                            disabled={!canUpdate}
                            placeholder={`e.g. ${selectedPage.title} | Modern Orthodontics`}
                          />
                          <div className="mt-1.5 flex justify-between text-[11.5px] text-[#8B8B8B]">
                            <span>Recommended: 50-60 characters. Displayed as the primary clickable headline in search results.</span>
                            <span>{seoForm.seoTitle.length} / 120</span>
                          </div>
                        </div>

                        <div>
                          <AdminTextarea
                            label="META DESCRIPTION"
                            rows={4}
                            maxLength={320}
                            value={seoForm.seoDescription}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, seoDescription: e.target.value }))}
                            disabled={!canUpdate}
                            placeholder="A concise summary of this page's content for search snippets."
                          />
                          <div className="mt-1.5 flex justify-between text-[11.5px] text-[#8B8B8B]">
                            <span>Recommended: 140-160 characters.</span>
                            <span className={seoForm.seoDescription.length > 160 ? "text-[#C53030] font-semibold" : ""}>
                              {seoForm.seoDescription.length} / 320
                            </span>
                          </div>
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          <div>
                            <AdminInput
                              label="META KEYWORDS"
                              maxLength={500}
                              placeholder="orthodontics, brackets, buccal tubes, ISO 13485"
                              value={seoForm.seoKeywords}
                              onChange={(e) => setSeoForm((prev) => ({ ...prev, seoKeywords: e.target.value }))}
                              disabled={!canUpdate}
                            />
                            <div className="mt-1 text-right text-[11px] text-[#8B8B8B]">{seoForm.seoKeywords.length} / 500</div>
                          </div>
                          <AdminSelect
                            label="ROBOTS INDEXING TAG"
                            value={seoForm.robotsTag}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, robotsTag: e.target.value }))}
                            options={[
                              { value: "index,follow", label: "Index, Follow (Standard)" },
                              { value: "noindex,follow", label: "No Index, Follow" },
                              { value: "index,nofollow", label: "Index, No Follow" },
                              { value: "noindex,nofollow", label: "No Index, No Follow (Blocked)" },
                            ]}
                            disabled={!canUpdate}
                          />
                        </div>

                        <div>
                          <AdminInput
                            label="CANONICAL URL"
                            value={seoForm.canonicalUrl}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, canonicalUrl: e.target.value }))}
                            disabled={!canUpdate}
                            placeholder="Leave blank to use default canonical URL"
                          />
                          <p className="mt-1 text-[11.5px] text-[#8B8B8B]">Specifies the authoritative URL for search engines if duplicates exist.</p>
                        </div>
                      </div>
                    </div>

                    {/* Google Search Result Preview */}
                    <div>
                      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[#9A9A9A]">Google Search Preview</h3>
                      <div className="mt-4 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 font-sans">
                        <p className="text-[12px] text-[#188038] font-mono">https://modortho.com/{selectedPage.slug === "home" ? "" : selectedPage.slug}</p>
                        <p className="mt-1 text-[18px] font-semibold leading-snug text-[#1A0DAB] hover:underline cursor-pointer">
                          {seoForm.seoTitle || `${selectedPage.title} | Modern Orthodontics`}
                        </p>
                        <p className="mt-1 text-[13px] leading-relaxed text-[#4D5156] max-w-3xl">
                          {seoForm.seoDescription || "Certified orthodontic solutions manufactured to global precision standards. Explore catalog, certifications, and technical specifications."}
                        </p>
                      </div>
                    </div>

                    {/* Open Graph / Social Media Cards */}
                    <div>
                      <h3 className="text-[14px] font-bold uppercase tracking-wider text-[#9A9A9A]">Open Graph & Social Sharing</h3>
                      <div className="mt-4 grid gap-6 border-t border-[#E6E6E6] pt-5 md:grid-cols-2">
                        <div className="space-y-4">
                          <AdminInput
                            label="OG TITLE (SOCIAL SHARE)"
                            maxLength={120}
                            placeholder="Inherits Meta Title if blank"
                            value={seoForm.ogTitle}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, ogTitle: e.target.value }))}
                            disabled={!canUpdate}
                          />
                          <AdminTextarea
                            label="OG DESCRIPTION"
                            rows={3}
                            maxLength={300}
                            placeholder="Inherits Meta Description if blank"
                            value={seoForm.ogDescription}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, ogDescription: e.target.value }))}
                            disabled={!canUpdate}
                          />
                        </div>

                        <div className="space-y-3">
                          <label className="block text-[13px] font-bold text-[#1A1A1A]">OG SOCIAL SHARE IMAGE</label>
                          {seoForm.ogImage ? (
                            <div className="relative aspect-video max-w-xs overflow-hidden rounded-lg border border-[#E6E6E6] bg-gray-50">
                              <img src={seoForm.ogImage} alt="OG Preview" className="h-full w-full object-cover" />
                            </div>
                          ) : (
                            <div className="flex aspect-video max-w-xs items-center justify-center rounded-lg border border-dashed border-[#E6E6E6] bg-gray-50 text-xs text-gray-400">
                              No social share image configured
                            </div>
                          )}

                          {canUpdate && (
                            <button
                              type="button"
                              onClick={() => setMediaModalOpen(true)}
                              className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[#E31E24] px-3.5 py-2 text-[12.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors shadow-2xs"
                            >
                              <ImageIcon size={13} />
                              <span>Browse Media Library</span>
                            </button>
                          )}
                          <AdminInput
                            label="Image URL"
                            value={seoForm.ogImage}
                            onChange={(e) => setSeoForm((prev) => ({ ...prev, ogImage: e.target.value }))}
                            disabled={!canUpdate}
                            placeholder="https://.../og-image.jpg"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      <MediaSelectorModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        onSelect={(media) => setSeoForm((prev) => ({ ...prev, ogImage: media.url }))}
        title="Select Social Share Image"
        acceptTypes={["IMAGE"]}
      />

      {/* Create New Page Modal */}
      <Modal
        open={showCreateModal}
        onClose={() => !creatingPage && setShowCreateModal(false)}
        title="Create New CMS Page"
      >
        <form onSubmit={handleCreatePage} className="space-y-4 p-4">
          <p className="text-xs text-gray-600">
            Create a custom CMS page with its own URL route. You can immediately customize its hero banner, introduction, feature cards, and CTA sections in Page Studio.
          </p>

          <AdminInput
            label="PAGE TITLE *"
            placeholder="e.g. Clinical Research & Innovation"
            value={newPageTitle}
            onChange={(e) => {
              const val = e.target.value;
              setNewPageTitle(val);
              const autoSlug = val
                .toLowerCase()
                .trim()
                .replace(/[^a-z0-9\s-]/g, "")
                .replace(/\s+/g, "-");
              setNewPageSlug(autoSlug);
            }}
            required
            autoFocus
          />

          <div>
            <AdminInput
              label="URL SLUG *"
              placeholder="e.g. clinical-research"
              value={newPageSlug}
              onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              required
            />
            {newPageSlug && (
              <p className="mt-1 text-[11.5px] text-gray-500 font-mono">
                Storefront URL preview: <span className="font-semibold text-[#0F2D52]">/{newPageSlug}</span>
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowCreateModal(false)}
              disabled={creatingPage}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={creatingPage}
              className="rounded-lg bg-[#E31E24] px-5 py-2 text-xs font-bold text-white hover:bg-[#B5151B] cursor-pointer"
            >
              Create Page & Open Studio
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Edit Page Info (Title & Slug) Modal */}
      <Modal
        open={showEditInfoModal}
        onClose={() => !savingPageInfo && setShowEditInfoModal(false)}
        title="Edit Page Title & URL Slug"
      >
        <form onSubmit={handleUpdatePageInfo} className="space-y-4 p-4">
          <p className="text-xs text-gray-600">
            Update the page name and storefront route. Changing the URL slug will immediately change the public web address of this page.
          </p>

          <AdminInput
            label="PAGE TITLE *"
            placeholder="e.g. Our Mission"
            value={editPageTitle}
            onChange={(e) => setEditPageTitle(e.target.value)}
            required
            autoFocus
          />

          <div>
            <AdminInput
              label="URL SLUG *"
              placeholder="e.g. our-mission"
              value={editPageSlug}
              onChange={(e) => setEditPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              required
            />
            {editPageSlug && (
              <p className="mt-1 text-[11.5px] text-gray-500 font-mono">
                Storefront URL preview: <span className="font-semibold text-[#0F2D52]">/{editPageSlug}</span>
              </p>
            )}
          </div>

          <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={() => setShowEditInfoModal(false)}
              disabled={savingPageInfo}
              className="rounded-lg border border-gray-200 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              loading={savingPageInfo}
              className="rounded-lg bg-[#E31E24] px-5 py-2 text-xs font-bold text-white hover:bg-[#B5151B] cursor-pointer"
            >
              Save Page Info
            </LoadingButton>
          </div>
        </form>
      </Modal>

      {/* Delete Page Confirm Modal */}
      <ConfirmModal
        open={Boolean(deletingPageId)}
        onCancel={() => setDeletingPageId(null)}
        onConfirm={handleDeletePage}
        title="Delete CMS Page"
        message="Are you sure you want to delete this custom page? This action will remove the page and all its content from the live storefront. This action cannot be undone."
        confirmText="Yes, Delete Page"
        danger
        isLoading={isDeleting}
      />
    </AdminLayout>
  );
}

export default function CmsPagesPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout title="CMS Pages" breadcrumb={[{ label: "Content" }, { label: "Pages" }]}>
          <div className="flex h-64 items-center justify-center">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
          </div>
        </AdminLayout>
      }
    >
      <CmsPagesManagementContent />
    </Suspense>
  );
}
