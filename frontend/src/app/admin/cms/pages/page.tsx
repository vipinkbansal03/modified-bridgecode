"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Edit2, Eye, Plus, RotateCcw, Save, Trash2, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminCmsPage,
  useAdminCmsPages,
  useCreateCmsBlock,
  useCreateCmsSection,
  useDeleteCmsBlock,
  useDeleteCmsPage,
  useDeleteCmsSection,
  useReorderCmsSections,
  useUpdateCmsBlock,
  useUpdateCmsSection,
  useUpdateCmsPage,
} from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";
import { uploadMediaFiles } from "@/utils/uploadMedia";

type CmsPageRow = {
  id: string;
  title: string;
  slug: string;
  pageKey: string;
  status: string;
  _count?: { sections: number };
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

type CmsTab = "orders" | "content" | "seo";

type SectionOrderRow = {
  id: string;
  sectionKey: string;
  title: string;
  status: string;
  sortOrder: number;
  blockCount: number;
  maxItems: string;
  settingsJson: Record<string, unknown>;
};

const DEFAULT_SECTION_ORDER_BY_PAGE_KEY: Record<string, string[]> = {
  home: ["home.hero", "home.about", "home.stats", "home.certifications", "home.contactCta"],
  about: ["about.hero", "about.mission", "about.manufacture", "about.different", "about.faqs"],
  manufacturing: [
    "manufacturing.hero",
    "manufacturing.teaser",
    "manufacturing.expertise",
    "manufacturing.mim",
    "manufacturing.benefits",
    "manufacturing.process",
    "manufacturing.niti",
    "manufacturing.faqs",
  ],
  contact: ["contact.hero", "contact.forms", "contact.offices"],
  products: ["products.hero", "products.highlights", "products.support"],
  "quality-certifications": ["quality.hero", "quality.management", "quality.certifications", "quality.symbols", "quality.faqs"],
};

function readMaxItems(settingsJson: unknown) {
  if (!settingsJson || typeof settingsJson !== "object") return "";
  const maxItems = (settingsJson as Record<string, unknown>).maxItems;
  if (typeof maxItems === "number" && Number.isFinite(maxItems)) return String(maxItems);
  if (typeof maxItems === "string" && maxItems.trim()) return maxItems;
  return "";
}

function normalizeSectionOrderRows(sections: Section[]): SectionOrderRow[] {
  return [...sections]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((section) => ({
      id: section.id,
      sectionKey: section.sectionKey,
      title: section.title || section.sectionKey,
      status: section.status || "ACTIVE",
      sortOrder: section.sortOrder,
      blockCount: section.blocks.length,
      maxItems: readMaxItems(section.settingsJson),
      settingsJson: section.settingsJson && typeof section.settingsJson === "object" ? { ...(section.settingsJson as Record<string, unknown>) } : {},
    }));
}

function buildDefaultSectionOrder(page: Page) {
  const preferredKeys = DEFAULT_SECTION_ORDER_BY_PAGE_KEY[page.pageKey] ?? [];
  const sectionMap = new Map(page.sections.map((section) => [section.sectionKey, section]));
  const ordered = preferredKeys
    .map((key) => sectionMap.get(key))
    .filter((section): section is Section => !!section);
  const remaining = page.sections
    .filter((section) => !preferredKeys.includes(section.sectionKey))
    .sort((a, b) => a.sortOrder - b.sortOrder);
  return normalizeSectionOrderRows([...ordered, ...remaining]);
}

function OrdersTab({
  page,
  onSaved,
}: {
  page: Page;
  onSaved: () => void;
}) {
  const { showToast } = useToast();
  const reorderSections = useReorderCmsSections(page.id);
  const updateSection = useUpdateCmsSection(page.id);
  const [rows, setRows] = useState<SectionOrderRow[]>(() => normalizeSectionOrderRows(page.sections));
  const [draggingId, setDraggingId] = useState("");
  const [dropTargetId, setDropTargetId] = useState("");
  const [savingSectionId, setSavingSectionId] = useState("");
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    setRows(normalizeSectionOrderRows(page.sections));
  }, [page]);

  function moveRow(draggedId: string, targetId: string) {
    if (!draggedId || !targetId || draggedId === targetId) return null;
    const current = [...rows];
    const draggedIndex = current.findIndex((row) => row.id === draggedId);
    const targetIndex = current.findIndex((row) => row.id === targetId);
    if (draggedIndex === -1 || targetIndex === -1) return null;
    const [dragged] = current.splice(draggedIndex, 1);
    current.splice(targetIndex, 0, dragged);
    return current.map((row, index) => ({ ...row, sortOrder: index + 1 }));
  }

  async function persistOrder(nextRows: SectionOrderRow[]) {
    const previousRows = rows;
    setRows(nextRows);
    try {
      await reorderSections.mutateAsync(nextRows.map((row) => row.id));
      showToast("Section order updated.", "success");
      onSaved();
    } catch {
      setRows(previousRows);
      showToast("Failed to update section order.", "error");
    }
  }

  async function handleDrop(targetId: string) {
    if (!draggingId) return;
    const nextRows = moveRow(draggingId, targetId);
    setDraggingId("");
    setDropTargetId("");
    if (!nextRows) return;
    await persistOrder(nextRows);
  }

  async function handleToggleStatus(row: SectionOrderRow) {
    const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    const previousRows = rows;
    setSavingSectionId(row.id);
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, status: nextStatus } : item));
    try {
      await updateSection.mutateAsync({ id: row.id, status: nextStatus });
      showToast(`${row.title} ${nextStatus === "ACTIVE" ? "enabled" : "disabled"}.`, "success");
      onSaved();
    } catch {
      setRows(previousRows);
      showToast("Failed to update section status.", "error");
    } finally {
      setSavingSectionId("");
    }
  }

  async function handleSaveMaxItems(row: SectionOrderRow) {
    const maxItems = row.maxItems.trim();
    const parsedValue = maxItems ? Number(maxItems) : null;
    if (maxItems && (parsedValue === null || !Number.isFinite(parsedValue) || parsedValue < 1)) {
      showToast("Max items must be a positive number.", "error");
      return;
    }
    const nextSettingsJson = parsedValue
      ? { ...row.settingsJson, maxItems: parsedValue }
      : Object.fromEntries(Object.entries(row.settingsJson).filter(([key]) => key !== "maxItems"));
    setSavingSectionId(row.id);
    try {
      await updateSection.mutateAsync({
        id: row.id,
        settingsJson: nextSettingsJson,
      });
      setRows((current) => current.map((item) => item.id === row.id ? { ...item, settingsJson: nextSettingsJson } : item));
      showToast("Section settings saved.", "success");
      onSaved();
    } catch {
      showToast("Failed to save section settings.", "error");
    } finally {
      setSavingSectionId("");
    }
  }

  async function handleResetDefaults() {
    const nextRows = buildDefaultSectionOrder(page);
    setResetting(true);
    try {
      await persistOrder(nextRows);
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-[#E6E6E6] bg-white shadow-[0_8px_28px_rgba(15,45,82,0.04)]">
      <div className="border-b border-[#E6E6E6] px-6 py-6">
        <h3 className="text-[18px] font-semibold text-[#1A1A1A]">Landing Page Section Order</h3>
      </div>
      <div className="flex flex-col gap-4 border-b border-[#E6E6E6] bg-[#FCFCFC] px-6 py-4 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center gap-3 text-[13px] text-[#9A9A9A]">
          <span>Grab any row to move sections in the current project theme.</span>
          <span>Layout {page.pageKey}</span>
        </div>
        <button
          type="button"
          onClick={handleResetDefaults}
          disabled={resetting || reorderSections.isPending}
          className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] px-4 py-2 text-[12px] font-semibold tracking-wide text-[#1A1A1A] hover:bg-[#F8F8F8] disabled:opacity-50"
        >
          <RotateCcw size={13} />
          {resetting ? "RESETTING..." : "RESET DEFAULTS"}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-[#F8F4EE]">
            <tr className="text-left text-[12px] font-semibold uppercase tracking-[0.18em] text-[#9A9A9A]">
              <th className="w-[56px] px-6 py-4" />
              <th className="px-6 py-4">Section</th>
              <th className="px-6 py-4">Order</th>
              <th className="px-6 py-4">Max Items</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={row.id}
                draggable
                onDragStart={(event) => {
                  setDraggingId(row.id);
                  setDropTargetId(row.id);
                  event.dataTransfer.effectAllowed = "move";
                  event.dataTransfer.setData("text/plain", row.id);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "move";
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (draggingId && draggingId !== row.id) {
                    setDropTargetId(row.id);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  void handleDrop(row.id);
                }}
                onDragEnd={() => {
                  setDraggingId("");
                  setDropTargetId("");
                }}
                className={cn(
                  "border-t border-[#EDE6DA] align-top transition-colors",
                  draggingId === row.id && "cursor-grabbing bg-[#FFF7F2]",
                  dropTargetId === row.id && draggingId !== row.id && "bg-[#F8FBFF] shadow-[inset_4px_0_0_#12314F]",
                  !draggingId && (index % 2 === 0 ? "bg-[#F9FCFC]" : "bg-white"),
                  "cursor-grab"
                )}
              >
                <td className="px-6 py-5 text-[#B6AA98]">
                  <div className="flex h-5 w-5 flex-col items-center justify-center gap-[2px]">
                    <span className="grid grid-cols-2 gap-[2px]">
                      <span className="h-[2px] w-[2px] rounded-full bg-[#C8B9A4]" />
                      <span className="h-[2px] w-[2px] rounded-full bg-[#C8B9A4]" />
                      <span className="h-[2px] w-[2px] rounded-full bg-[#C8B9A4]" />
                      <span className="h-[2px] w-[2px] rounded-full bg-[#C8B9A4]" />
                      <span className="h-[2px] w-[2px] rounded-full bg-[#C8B9A4]" />
                      <span className="h-[2px] w-[2px] rounded-full bg-[#C8B9A4]" />
                    </span>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="space-y-1">
                    <p className="text-[16px] font-semibold text-[#1A1A1A]">{row.title}</p>
                    <p className="text-[13px] text-[#B9A78F]">{row.sectionKey}</p>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="inline-flex items-center rounded-full bg-[#F7F8FA] px-3 py-1 text-[13px] font-semibold text-[#6B7280]">
                    {index + 1}
                  </div>
                </td>
                <td className="px-6 py-5">
                  <div className="max-w-[150px]">
                    <input
                      type="number"
                      min={1}
                      placeholder="-"
                      value={row.maxItems}
                      onChange={(event) => {
                        const value = event.target.value;
                        setRows((current) => current.map((item) => item.id === row.id ? { ...item, maxItems: value } : item));
                      }}
                      onBlur={() => void handleSaveMaxItems(row)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void handleSaveMaxItems(row);
                        }
                      }}
                      className="w-full rounded-md border border-[#E6E6E6] px-3 py-2 text-[13px] text-[#1A1A1A] outline-none focus:border-[#0F2D52]"
                    />
                    <p className="mt-2 text-[11px] text-[#9A9A9A]">{row.blockCount} item{row.blockCount !== 1 ? "s" : ""} currently</p>
                  </div>
                </td>
                <td className="px-6 py-5">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-6 py-5">
                  <button
                    type="button"
                    onClick={() => void handleToggleStatus(row)}
                    disabled={savingSectionId === row.id}
                    className={cn(
                      "min-w-[64px] rounded-md border px-3 py-2 text-[13px] font-medium transition-colors disabled:opacity-50",
                      row.status === "ACTIVE"
                        ? "border-[#D7E8DA] bg-[#F6FFFA] text-[#1E8E3E] hover:bg-[#ECFFF3]"
                        : "border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F8F8F8]"
                    )}
                  >
                    {savingSectionId === row.id ? "..." : row.status === "ACTIVE" ? "On" : "Off"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function SectionContentEditor({
  pageId,
  section,
  onDeleteSection,
  onSaved,
}: {
  pageId: string;
  section: Section;
  onDeleteSection: () => void;
  onSaved: () => void;
}) {
  const { hasPermission } = useAdminAuth();
  const canUpdate = hasPermission("cms.update");
  const canDelete = hasPermission("cms.delete");

  const { showToast } = useToast();
  const updateSection = useUpdateCmsSection(pageId);
  const updateBlock = useUpdateCmsBlock(pageId);
  const createBlock = useCreateCmsBlock(pageId, section.id);
  const deleteBlock = useDeleteCmsBlock(pageId);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [uploadingBlockIndex, setUploadingBlockIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const isHero = `${section.sectionKey} ${section.title ?? ""}`.toLowerCase().includes("hero");
  const initialPrimary = section.blocks[0];
  const initialSecondary = section.blocks[1];
  const initialGallery = section.blocks.slice(isHero ? 2 : 0);

  const [form, setForm] = useState({
    title: section.title ?? "",
    subtitle: section.subtitle ?? "",
    description: section.description ?? "",
    heroTitleBottom: initialPrimary?.title ?? "",
    heroButtonText: initialPrimary?.linkLabel ?? "",
    heroButtonLink: initialPrimary?.linkUrl ?? "",
    heroSecondaryButtonText: initialSecondary?.linkLabel ?? "",
    heroSecondaryButtonLink: initialSecondary?.linkUrl ?? "",
    heroImage: initialPrimary?.image ?? "",
  });
  const [blockForms, setBlockForms] = useState(() =>
    (isHero ? initialGallery : section.blocks).map((block) => ({
      id: block.id,
      blockType: block.blockType,
      title: block.title ?? "",
      subtitle: block.subtitle ?? "",
      description: block.description ?? "",
      image: block.image ?? "",
      icon: block.icon ?? "",
      linkLabel: block.linkLabel ?? "",
      linkUrl: block.linkUrl ?? "",
      sortOrder: block.sortOrder,
      isNew: false,
    }))
  );

  useEffect(() => {
    setForm({
      title: section.title ?? "",
      subtitle: section.subtitle ?? "",
      description: section.description ?? "",
      heroTitleBottom: section.blocks[0]?.title ?? "",
      heroButtonText: section.blocks[0]?.linkLabel ?? "",
      heroButtonLink: section.blocks[0]?.linkUrl ?? "",
      heroSecondaryButtonText: section.blocks[1]?.linkLabel ?? "",
      heroSecondaryButtonLink: section.blocks[1]?.linkUrl ?? "",
      heroImage: section.blocks[0]?.image ?? "",
    });
    setBlockForms((isHero ? section.blocks.slice(2) : section.blocks).map((block) => ({
      id: block.id,
      blockType: block.blockType,
      title: block.title ?? "",
      subtitle: block.subtitle ?? "",
      description: block.description ?? "",
      image: block.image ?? "",
      icon: block.icon ?? "",
      linkLabel: block.linkLabel ?? "",
      linkUrl: block.linkUrl ?? "",
      sortOrder: block.sortOrder,
      isNew: false,
    })));
  }, [section, isHero]);

  async function uploadImageFile(file: File) {
    const formData = new FormData();
    formData.append("entityType", "CMS");
    if (section?.id) formData.append("entityId", section.id);
    formData.append("files", file);
    const response = await adminApi.post("/media", formData);
    const uploaded = response.data?.data;
    if (Array.isArray(uploaded) && uploaded[0]?.url) {
      return uploaded[0].url as string;
    }
    return undefined;
  }

  async function handleHeroImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingImage(true);
      const url = await uploadImageFile(file);
      if (url) {
        setForm((prev) => ({ ...prev, heroImage: url }));
        showToast("Image uploaded.", "success");
      } else {
        showToast("Upload finished, but image URL was not found.", "error");
      }
    } catch {
      showToast("Image upload failed.", "error");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  async function handleBlockImageUpload(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setUploadingBlockIndex(index);
      const url = await uploadImageFile(file);
      if (url) {
        setBlockForms((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, image: url } : item));
        showToast("Image uploaded.", "success");
      } else {
        showToast("Upload finished, but image URL was not found.", "error");
      }
    } catch {
      showToast("Image upload failed.", "error");
    } finally {
      setUploadingBlockIndex(null);
      e.target.value = "";
    }
  }

  async function ensurePrimaryHeroBlock() {
    if (section.blocks[0]) return section.blocks[0].id;
    const created = await createBlock.mutateAsync({
      blockType: "hero-primary",
      sortOrder: 0,
    });
    return created.id as string;
  }

  async function ensureSecondaryHeroBlock() {
    if (section.blocks[1]) return section.blocks[1].id;
    const created = await createBlock.mutateAsync({
      blockType: "hero-secondary-button",
      sortOrder: 1,
    });
    return created.id as string;
  }

  function updateBlockForm(index: number, field: string, value: string) {
    setBlockForms((prev) => prev.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item));
  }

  function addBlockItem() {
    setBlockForms((prev) => [
      ...prev,
      {
        id: `new-${Date.now()}-${prev.length}`,
        blockType: isHero ? "hero-image" : `${section.sectionKey}-item`,
        title: "",
        subtitle: "",
        description: "",
        image: "",
        icon: "",
        linkLabel: "",
        linkUrl: "",
        sortOrder: prev.length + (isHero ? 2 : 0),
        isNew: true,
      },
    ]);
  }

  async function removeBlockItem(index: number) {
    const block = blockForms[index];
    if (!block) return;
    if (!block.isNew) {
      try {
        await deleteBlock.mutateAsync(block.id);
        showToast("Item removed.", "success");
        onSaved();
      } catch {
        showToast("Failed to remove item.", "error");
        return;
      }
    }
    setBlockForms((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  }

  async function saveSection() {
    try {
      setSaving(true);
      await updateSection.mutateAsync({
        id: section.id,
        title: form.title,
        subtitle: form.subtitle,
        description: form.description,
      });

      if (isHero) {
        const primaryHeroId = await ensurePrimaryHeroBlock();
        await updateBlock.mutateAsync({
          id: primaryHeroId,
          title: form.heroTitleBottom,
          subtitle: form.subtitle,
          description: form.description,
          image: form.heroImage,
          linkLabel: form.heroButtonText,
          linkUrl: form.heroButtonLink,
        });

        if (form.heroSecondaryButtonText || form.heroSecondaryButtonLink) {
          const secondaryId = await ensureSecondaryHeroBlock();
          await updateBlock.mutateAsync({
            id: secondaryId,
            title: "Secondary Button",
            linkLabel: form.heroSecondaryButtonText,
            linkUrl: form.heroSecondaryButtonLink,
          });
        }
      }

      for (let index = 0; index < blockForms.length; index += 1) {
        const block = blockForms[index];
        const payload = {
          blockType: block.blockType,
          title: block.title,
          subtitle: block.subtitle,
          description: block.description,
          image: block.image,
          icon: block.icon,
          linkLabel: block.linkLabel,
          linkUrl: block.linkUrl,
          sortOrder: index + (isHero ? 2 : 0),
        };

        if (block.isNew) {
          await createBlock.mutateAsync(payload);
        } else {
          await updateBlock.mutateAsync({
            id: block.id,
            ...payload,
          });
        }
      }

      showToast("Section saved.", "success");
      onSaved();
    } catch {
      showToast("Failed to save section.", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
      <div className="mb-5 flex flex-col gap-3 border-b border-[#EFEFEF] pb-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h3 className="text-[16px] font-semibold uppercase tracking-wide text-[#1A1A1A]">{section.title || section.sectionKey}</h3>
          <p className="mt-1 text-[12px] text-[#9A9A9A]">{section.sectionKey}</p>
        </div>
        {canDelete && (
          <button
            type="button"
            onClick={onDeleteSection}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50"
          >
            <Trash2 size={13} />
            Delete Section
          </button>
        )}
      </div>

      <div className="space-y-6">
        <AdminInput
          label={isHero ? "TITLE TOP" : "SECTION TITLE"}
          value={form.title}
          onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
          disabled={!canUpdate}
        />

        {isHero && (
          <AdminInput
            label="TITLE BOTTOM"
            value={form.heroTitleBottom}
            onChange={(e) => setForm((prev) => ({ ...prev, heroTitleBottom: e.target.value }))}
            disabled={!canUpdate}
          />
        )}

        <AdminInput
          label="SUBTITLE"
          value={form.subtitle}
          onChange={(e) => setForm((prev) => ({ ...prev, subtitle: e.target.value }))}
          disabled={!canUpdate}
        />
        <AdminTextarea
          label="DESCRIPTION"
          rows={5}
          value={form.description}
          onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
          disabled={!canUpdate}
        />

        {isHero && (
          <>
            <AdminInput
              label="BUTTON TEXT"
              value={form.heroButtonText}
              onChange={(e) => setForm((prev) => ({ ...prev, heroButtonText: e.target.value }))}
              disabled={!canUpdate}
            />
            <AdminInput
              label="BUTTON LINK"
              value={form.heroButtonLink}
              onChange={(e) => setForm((prev) => ({ ...prev, heroButtonLink: e.target.value }))}
              disabled={!canUpdate}
            />
            <AdminInput
              label="SECONDARY BUTTON TEXT"
              value={form.heroSecondaryButtonText}
              onChange={(e) => setForm((prev) => ({ ...prev, heroSecondaryButtonText: e.target.value }))}
              disabled={!canUpdate}
            />
            <AdminInput
              label="SECONDARY BUTTON LINK"
              value={form.heroSecondaryButtonLink}
              onChange={(e) => setForm((prev) => ({ ...prev, heroSecondaryButtonLink: e.target.value }))}
              disabled={!canUpdate}
            />

            <div className="space-y-3">
              <label className="block text-[13px] font-medium text-[#1A1A1A]">IMAGE</label>
              <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-[#FCFCFC] p-5 text-center">
                {form.heroImage ? (
                  <div className="space-y-4">
                    <img src={form.heroImage} alt="Hero" className="mx-auto h-52 w-full max-w-[340px] rounded-lg object-cover border border-[#E6E6E6]" />
                    <p className="text-[13px] text-[#6B6B6B]">Change image</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[13px] text-[#1A1A1A]">Upload or select image</p>
                    <p className="text-[12px] text-[#9A9A9A]">Open Media Library to reuse existing assets or upload a new file</p>
                  </div>
                )}
                {canUpdate && (
                  <div className="mt-4 flex justify-center">
                    <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-white", uploadingImage ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                      <Upload size={13} />
                      {uploadingImage ? "Uploading..." : form.heroImage ? "Change Image" : "Upload Image"}
                      <input type="file" accept="image/*" className="hidden" onChange={handleHeroImageUpload} disabled={uploadingImage} />
                    </label>
                  </div>
                )}
              </div>
              <AdminInput label="" placeholder="Or paste an image URL..." value={form.heroImage} onChange={(e) => setForm((prev) => ({ ...prev, heroImage: e.target.value }))} disabled={!canUpdate} />
            </div>
          </>
        )}

        <div className="rounded-xl border border-[#E6E6E6] p-5">
          <div className="mb-4 flex items-center justify-between">
            <h4 className="text-[14px] font-semibold uppercase tracking-wide text-[#1A1A1A]">
              {isHero ? "HERO IMAGES" : "SECTION ITEMS"}
            </h4>
            {canUpdate && (
              <button
                type="button"
                onClick={addBlockItem}
                className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F8F8F8]"
              >
                ADD ITEM
              </button>
            )}
          </div>

          {blockForms.length === 0 ? (
            <div className="rounded-lg border border-dashed border-[#E6E6E6] bg-[#FAFAFA] px-4 py-8 text-center text-[13px] text-[#9A9A9A]">
              No items added yet.
            </div>
          ) : (
            <div className="space-y-5">
              {blockForms.map((block, index) => (
                <div key={block.id} className="rounded-lg border border-[#E6E6E6] p-4">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <p className="text-[12px] text-[#9A9A9A]">Item {index + 1}</p>
                      <p className="mt-1 text-[13px] font-semibold uppercase tracking-wide text-[#1A1A1A]">{block.blockType}</p>
                    </div>
                    {canUpdate && (
                      <button
                        type="button"
                        onClick={() => removeBlockItem(index)}
                        className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F8F8F8]"
                      >
                        REMOVE
                      </button>
                    )}
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <AdminInput label="TITLE" value={block.title} onChange={(e) => updateBlockForm(index, "title", e.target.value)} disabled={!canUpdate} />
                    <AdminInput label="SUBTITLE" value={block.subtitle} onChange={(e) => updateBlockForm(index, "subtitle", e.target.value)} disabled={!canUpdate} />
                    <div className="md:col-span-2">
                      <AdminTextarea label="DESCRIPTION" rows={4} value={block.description} onChange={(e) => updateBlockForm(index, "description", e.target.value)} disabled={!canUpdate} />
                    </div>
                    <AdminInput label="BUTTON TEXT" value={block.linkLabel} onChange={(e) => updateBlockForm(index, "linkLabel", e.target.value)} disabled={!canUpdate} />
                    <AdminInput label="BUTTON LINK" value={block.linkUrl} onChange={(e) => updateBlockForm(index, "linkUrl", e.target.value)} disabled={!canUpdate} />
                    <AdminInput label="ICON" value={block.icon} onChange={(e) => updateBlockForm(index, "icon", e.target.value)} disabled={!canUpdate} />
                    <div className="md:col-span-2 space-y-3">
                      {block.image ? (
                        <img src={block.image} alt={block.title || `Item ${index + 1}`} className="h-44 w-full max-w-[340px] rounded-lg object-cover border border-[#E6E6E6]" />
                      ) : null}
                      {canUpdate && (
                        <div className="flex flex-wrap items-center gap-2">
                          <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-white", uploadingBlockIndex === index ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                            <Upload size={13} />
                            {uploadingBlockIndex === index ? "Uploading..." : block.image ? "Change Image" : "Upload Image"}
                            <input type="file" accept="image/*" className="hidden" onChange={(e) => handleBlockImageUpload(index, e)} disabled={uploadingBlockIndex === index} />
                          </label>
                          {block.image && (
                            <button
                              type="button"
                              onClick={() => updateBlockForm(index, "image", "")}
                              className="inline-flex items-center gap-1 rounded-md border border-[#E6E6E6] px-3 py-2 text-[12px] font-medium text-[#6B6B6B] hover:bg-[#F8F8F8]"
                            >
                              <X size={13} />
                              Remove Image
                            </button>
                          )}
                        </div>
                      )}
                      <AdminInput label="IMAGE URL" value={block.image} onChange={(e) => updateBlockForm(index, "image", e.target.value)} disabled={!canUpdate} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {canUpdate && (
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={saveSection}
              disabled={saving || updateSection.isPending || updateBlock.isPending || createBlock.isPending}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#E31E24] px-5 py-2.5 text-[13px] font-medium text-white hover:bg-[#B5151B] disabled:opacity-50"
            >
              <Save size={13} />
              {saving ? "Saving..." : "Save Section"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function CmsPagesPageContent() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("cms.create");
  const canUpdate = hasPermission("cms.update");
  const canDelete = hasPermission("cms.delete");

  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const [tab, setTab] = useState<CmsTab>("content");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState("");
  const [addingBlock, setAddingBlock] = useState(false);
  const [newBlockType, setNewBlockType] = useState("generic");
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const [deletePageId, setDeletePageId] = useState<string | null>(null);
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
    faqSchemaJson: [] as Array<{ question: string; answer: string }>,
  });
  const [uploadingSeoAsset, setUploadingSeoAsset] = useState<null | "favicon" | "ogImage" | "twitterImage">(null);

  const { data: pagesData, isLoading: isPagesLoading, refetch: refetchPages } = useAdminCmsPages({ page: 1 });
  const pages: CmsPageRow[] = pagesData?.data ?? [];
  const selectedPageId = searchParams.get("pageId") || pages[0]?.id || "";

  const { data: pageData, isLoading: isPageLoading, refetch: refetchPage } = useAdminCmsPage(selectedPageId);
  const selectedPage = pageData as Page | undefined;
  const selectedSection = selectedPage?.sections.find((section) => section.id === selectedSectionId) ?? selectedPage?.sections[0];

  const updatePage = useUpdateCmsPage(selectedPageId);
  const createSection = useCreateCmsSection(selectedPageId);
  const deleteSection = useDeleteCmsSection(selectedPageId);
  const createBlock = useCreateCmsBlock(selectedPageId, selectedSection?.id ?? "");
  const deleteBlock = useDeleteCmsBlock(selectedPageId);
  const deletePage = useDeleteCmsPage();

  useEffect(() => {
    if (!selectedPageId && pages[0]?.id) {
      router.replace(`/admin/cms/pages?pageId=${pages[0].id}`);
    }
  }, [pages, router, selectedPageId]);

  useEffect(() => {
    if (!selectedPage) return;
    const faqItems = Array.isArray(selectedPage.faqSchemaJson) ? selectedPage.faqSchemaJson : [];
    setSeoForm({
      seoTitle: selectedPage.seoTitle ?? "",
      seoDescription: selectedPage.seoDescription ?? "",
      seoKeywords: selectedPage.seoKeywords ?? "",
      robotsTag: selectedPage.robotsTag ?? "index,follow",
      canonicalUrl: selectedPage.canonicalUrl ?? "",
      favicon: selectedPage.favicon ?? "",
      ogTitle: selectedPage.ogTitle ?? "",
      ogDescription: selectedPage.ogDescription ?? "",
      ogImage: selectedPage.ogImage ?? "",
      twitterTitle: selectedPage.twitterTitle ?? "",
      twitterDescription: selectedPage.twitterDescription ?? "",
      twitterImage: selectedPage.twitterImage ?? "",
      faqSchemaJson: faqItems.filter((item): item is { question: string; answer: string } => {
        return !!item && typeof item === "object" && "question" in item && "answer" in item;
      }),
    });
    setSelectedSectionId((current) => {
      if (!selectedPage.sections.length) return "";
      if (selectedPage.sections.some((section) => section.id === current)) return current;
      return selectedPage.sections[0]?.id ?? "";
    });
  }, [selectedPage]);

  async function handleSaveSeo(e: React.FormEvent) {
    e.preventDefault();
    try {
      await updatePage.mutateAsync(seoForm);
      showToast("SEO saved.", "success");
      refetchPage();
    } catch {
      showToast("Failed to save SEO.", "error");
    }
  }

  async function uploadSeoImage(field: "favicon" | "ogImage" | "twitterImage", file: File) {
    try {
      setUploadingSeoAsset(field);
      const results = await uploadMediaFiles([file], {
        entityType: "CMS",
        entityId: selectedPage?.id || undefined
      });
      const url = results[0]?.url;
      if (url) {
        setSeoForm((prev) => ({ ...prev, [field]: url }));
        showToast("Image uploaded.", "success");
      } else {
        showToast("Upload finished, but image URL was not found.", "error");
      }
    } catch {
      showToast("Failed to upload image.", "error");
    } finally {
      setUploadingSeoAsset(null);
    }
  }

  function updateFaq(index: number, field: "question" | "answer", value: string) {
    setSeoForm((prev) => ({
      ...prev,
      faqSchemaJson: prev.faqSchemaJson.map((item, itemIndex) => itemIndex === index ? { ...item, [field]: value } : item),
    }));
  }

  function addFaq() {
    setSeoForm((prev) => ({
      ...prev,
      faqSchemaJson: [...prev.faqSchemaJson, { question: "", answer: "" }],
    }));
  }

  function removeFaq(index: number) {
    setSeoForm((prev) => ({
      ...prev,
      faqSchemaJson: prev.faqSchemaJson.filter((_, itemIndex) => itemIndex !== index),
    }));
  }

  async function handleAddSection() {
    if (!newSectionKey.trim() || !selectedPage) return;
    try {
      await createSection.mutateAsync({
        sectionKey: newSectionKey.trim(),
        title: newSectionKey.trim(),
        sortOrder: selectedPage.sections.length,
      });
      showToast("Section created.", "success");
      setNewSectionKey("");
      setAddingSection(false);
      refetchPage();
    } catch {
      showToast("Failed to create section.", "error");
    }
  }

  async function handleAddBlock() {
    if (!selectedSection) return;
    try {
      await createBlock.mutateAsync({
        blockType: newBlockType.trim() || "generic",
        sortOrder: selectedSection.blocks.length,
      });
      showToast("Block created.", "success");
      setAddingBlock(false);
      setNewBlockType("generic");
      refetchPage();
    } catch {
      showToast("Failed to create block.", "error");
    }
  }

  async function handleDeleteSection() {
    if (!deleteSectionId) return;
    try {
      await deleteSection.mutateAsync(deleteSectionId);
      showToast("Section deleted.", "success");
      setDeleteSectionId(null);
      refetchPage();
    } catch {
      showToast("Failed to delete section.", "error");
    }
  }

  async function handleDeleteBlock() {
    if (!deleteBlockId) return;
    try {
      await deleteBlock.mutateAsync(deleteBlockId);
      showToast("Block deleted.", "success");
      setDeleteBlockId(null);
      refetchPage();
    } catch {
      showToast("Failed to delete block.", "error");
    }
  }

  async function handleDeletePage() {
    if (!deletePageId) return;
    try {
      await deletePage.mutateAsync(deletePageId);
      showToast("Page deleted.", "success");
      setDeletePageId(null);
      refetchPages();
      const remainingPages = pages.filter((page) => page.id !== deletePageId);
      if (remainingPages[0]?.id) {
        router.replace(`/admin/cms/pages?pageId=${remainingPages[0].id}`);
      } else {
        router.replace("/admin/cms/pages");
      }
    } catch {
      showToast("Failed to delete page.", "error");
    }
  }

  const tabs: Array<{ key: CmsTab; label: string }> = [
    { key: "orders", label: "ORDERS" },
    { key: "content", label: "CONTENT" },
    { key: "seo", label: "SEO" },
  ];

  return (
    <AdminLayout title="CMS Pages" breadcrumb={[{ label: "Content" }, { label: "Pages" }]}>
      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">{pages.length} page{pages.length !== 1 ? "s" : ""}</p>
        {canCreate && (
          <Link href="/admin/cms/pages/create" className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand/90">
            <Plus size={16} /> New Page
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-[#E6E6E6] bg-white">
        <div className="border-b border-[#E6E6E6]">
          <div className="flex flex-wrap gap-2 px-6 pt-5">
            {tabs.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTab(item.key)}
                className={cn(
                  "border-b-2 px-4 py-3 text-[13px] font-semibold tracking-wide transition-colors",
                  tab === item.key ? "border-[#1A1A1A] text-[#0F2D52]" : "border-transparent text-[#9A9A9A] hover:text-[#1A1A1A]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-6 p-6">
          {tab === "orders" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelect
                label="PAGE"
                value={selectedPageId}
                onChange={(e) => router.replace(`/admin/cms/pages?pageId=${e.target.value}`)}
                options={pages.map((page) => ({
                  value: page.id,
                  label: `${page.title} (${page.pageKey})`,
                }))}
              />
              <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] px-4 py-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Sections</p>
                <p className="mt-2 text-[15px] font-semibold text-[#1A1A1A]">{selectedPage?.sections.length ?? 0} managed section{(selectedPage?.sections.length ?? 0) !== 1 ? "s" : ""}</p>
                <p className="mt-1 text-[12px] text-[#9A9A9A]">Reorder sections for the selected page and switch each one on or off.</p>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <AdminSelect
                label="PAGE"
                value={selectedPageId}
                onChange={(e) => router.replace(`/admin/cms/pages?pageId=${e.target.value}`)}
                options={pages.map((page) => ({
                  value: page.id,
                  label: `${page.title} (${page.pageKey})`,
                }))}
              />
              <AdminSelect
                label="SECTION"
                value={selectedSection?.id ?? ""}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                options={
                  selectedPage?.sections.length
                    ? selectedPage.sections.map((section, index) => ({
                        value: section.id,
                        label: `${index + 1}. ${section.title || section.sectionKey}`,
                      }))
                    : [{ value: "", label: "No sections yet" }]
                }
                disabled={!selectedPage || selectedPage.sections.length === 0}
              />
            </div>
          )}

          {isPagesLoading || isPageLoading ? (
            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] px-5 py-12 text-center text-sm text-[#9A9A9A]">
              Loading CMS content...
            </div>
          ) : !selectedPage ? (
            <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] px-5 py-12 text-center text-sm text-[#9A9A9A]">
              No page selected.
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-3 rounded-xl border border-[#E6E6E6] bg-[#FCFCFC] px-4 py-4 md:flex-row md:items-center md:justify-between">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[15px] font-semibold text-[#1A1A1A]">{selectedPage.title}</span>
                  <code className="rounded bg-[#F3F3F3] px-2 py-0.5 text-[11px] text-[#6B6B6B]">{selectedPage.pageKey}</code>
                  <span className="text-[12px] text-[#9A9A9A]">/{selectedPage.slug}</span>
                  <StatusBadge status={selectedPage.status} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <a href={`/${selectedPage.slug}`} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[12px] font-medium text-[#6B6B6B] hover:bg-white">
                    <Eye size={13} />
                    View Page
                  </a>
                  {canUpdate && (
                    <Link href={`/admin/cms/pages/${selectedPage.id}`} className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[12px] font-medium text-[#6B6B6B] hover:bg-white">
                      <Edit2 size={13} />
                      Open Old Editor
                    </Link>
                  )}
                  {canDelete && (
                    <button
                      type="button"
                      onClick={() => setDeletePageId(selectedPage.id)}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 py-2 text-[12px] font-medium text-red-500 hover:bg-red-50"
                    >
                      <Trash2 size={13} />
                      Delete Page
                    </button>
                  )}
                </div>
              </div>

              {tab === "orders" && (
                <OrdersTab page={selectedPage} onSaved={refetchPage} />
              )}

              {tab === "content" && (
                <div className="space-y-5">
                  {selectedSection ? (
                    <SectionContentEditor
                      pageId={selectedPage.id}
                      section={selectedSection}
                      onDeleteSection={() => setDeleteSectionId(selectedSection.id)}
                      onSaved={refetchPage}
                    />
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-white px-4 py-10 text-center text-[13px] text-[#9A9A9A]">
                      No section selected yet.
                    </div>
                  )}

                  {addingSection ? (
                    <div className="flex flex-col gap-3 rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 md:flex-row md:items-end">
                      <div className="flex-1">
                        <AdminInput label="Section Key" value={newSectionKey} onChange={(e) => setNewSectionKey(e.target.value)} placeholder="hero, about, services" />
                      </div>
                      <div className="flex gap-2">
                        <button type="button" onClick={handleAddSection} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-medium text-white hover:bg-[#B5151B]">
                          Create Section
                        </button>
                        <button type="button" onClick={() => setAddingSection(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:bg-white">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setAddingSection(true)}
                      className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-[#E6E6E6] px-4 py-3 text-[13px] font-medium text-[#6B6B6B] transition-colors hover:border-[#E31E24] hover:text-[#E31E24]"
                    >
                      <Plus size={14} />
                      Add Section
                    </button>
                  )}
                </div>
              )}

              {tab === "seo" && (
                <form onSubmit={handleSaveSeo} className="space-y-8 rounded-xl border border-[#E6E6E6] bg-white p-5">
                  <div>
                    <h3 className="text-[14px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Core SEO</h3>
                    <div className="mt-4 space-y-5 border-t border-[#E6E6E6] pt-4">
                      <div>
                        <AdminInput label="META TITLE" maxLength={120} value={seoForm.seoTitle} onChange={(e) => setSeoForm((prev) => ({ ...prev, seoTitle: e.target.value }))} disabled={!canUpdate} />
                        <div className="mt-2 flex justify-between text-[12px] text-[#9A9A9A]">
                          <span>Ideal: 50-60 characters. Shown as the blue link in Google results.</span>
                          <span>{seoForm.seoTitle.length} / 120</span>
                        </div>
                      </div>

                      <div>
                        <AdminTextarea label="META DESCRIPTION" rows={5} maxLength={320} value={seoForm.seoDescription} onChange={(e) => setSeoForm((prev) => ({ ...prev, seoDescription: e.target.value }))} disabled={!canUpdate} />
                        <div className="mt-2 flex justify-between text-[12px] text-[#9A9A9A]">
                          <span>Ideal: 140-160 characters.</span>
                          <span className={seoForm.seoDescription.length > 160 ? "text-[#C53030]" : ""}>{seoForm.seoDescription.length} / 320</span>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div>
                          <AdminInput label="META KEYWORDS" maxLength={500} placeholder="keyword1, keyword2, keyword3" value={seoForm.seoKeywords} onChange={(e) => setSeoForm((prev) => ({ ...prev, seoKeywords: e.target.value }))} disabled={!canUpdate} />
                          <div className="mt-2 text-right text-[12px] text-[#9A9A9A]">{seoForm.seoKeywords.length} / 500</div>
                        </div>
                        <AdminSelect
                          label="ROBOTS TAG"
                          value={seoForm.robotsTag}
                          onChange={(e) => setSeoForm((prev) => ({ ...prev, robotsTag: e.target.value }))}
                          options={[
                            { value: "index,follow", label: "Index, Follow (default)" },
                            { value: "noindex,follow", label: "No Index, Follow" },
                            { value: "index,nofollow", label: "Index, No Follow" },
                            { value: "noindex,nofollow", label: "No Index, No Follow" },
                          ]}
                          disabled={!canUpdate}
                        />
                      </div>

                      <div>
                        <AdminInput label="CANONICAL URL" value={seoForm.canonicalUrl} onChange={(e) => setSeoForm((prev) => ({ ...prev, canonicalUrl: e.target.value }))} disabled={!canUpdate} />
                        <p className="mt-2 text-[12px] text-[#9A9A9A]">Leave blank to use the page&apos;s default URL.</p>
                      </div>

                      <div className="space-y-3">
                        <label className="block text-[13px] font-medium text-[#1A1A1A]">FAVICON</label>
                        {seoForm.favicon ? (
                          <img src={seoForm.favicon} alt="Favicon" className="h-28 w-28 rounded-lg border border-[#E6E6E6] object-contain bg-white" />
                        ) : null}
                        {canUpdate && (
                          <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-[#FCFCFC] p-5 text-center">
                            <p className="text-[13px] text-[#1A1A1A]">{seoForm.favicon ? "Change image" : "Upload or select image"}</p>
                            <p className="mt-1 text-[12px] text-[#9A9A9A]">Open Media Library to reuse existing assets or upload a new file</p>
                            <div className="mt-4 flex justify-center">
                              <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-white", uploadingSeoAsset === "favicon" ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                                <Upload size={13} />
                                {uploadingSeoAsset === "favicon" ? "Uploading..." : seoForm.favicon ? "Change Image" : "Upload Image"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadSeoImage("favicon", file); e.target.value = ""; }} disabled={uploadingSeoAsset === "favicon"} />
                              </label>
                            </div>
                          </div>
                        )}
                        <AdminInput label="" value={seoForm.favicon} onChange={(e) => setSeoForm((prev) => ({ ...prev, favicon: e.target.value }))} disabled={!canUpdate} />
                        <p className="text-[12px] text-[#9A9A9A]">Site tab icon. Recommended square image at least 64x64.</p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Google Preview</h3>
                    <div className="mt-4 rounded-xl border border-[#E6E6E6] bg-white p-6">
                      <p className="text-[12px] uppercase tracking-wide text-[#9A9A9A]">Search Result Preview</p>
                      <p className="mt-4 text-[14px] text-[#188038]">/{selectedPage.slug}</p>
                      <p className="mt-2 cursor-pointer text-[32px] leading-tight text-[#1A0DAB] hover:underline">{seoForm.seoTitle || selectedPage.title}</p>
                      <p className="mt-2 max-w-[900px] text-[14px] leading-relaxed text-[#4D5156]">{seoForm.seoDescription || "No meta description yet."}</p>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Open Graph (Social Media)</h3>
                    <div className="mt-4 grid gap-5 border-t border-[#E6E6E6] pt-4 md:grid-cols-[1fr_1fr]">
                      <div className="space-y-5">
                        <div>
                          <AdminInput label="OG TITLE" maxLength={120} placeholder="Inherits Meta Title if blank" value={seoForm.ogTitle} onChange={(e) => setSeoForm((prev) => ({ ...prev, ogTitle: e.target.value }))} disabled={!canUpdate} />
                          <div className="mt-2 text-right text-[12px] text-[#9A9A9A]">{seoForm.ogTitle.length} / 120</div>
                        </div>
                        <div>
                          <AdminTextarea label="OG DESCRIPTION" rows={5} maxLength={320} placeholder="Inherits Meta Description if blank" value={seoForm.ogDescription} onChange={(e) => setSeoForm((prev) => ({ ...prev, ogDescription: e.target.value }))} disabled={!canUpdate} />
                          <div className="mt-2 text-right text-[12px] text-[#9A9A9A]">{seoForm.ogDescription.length} / 320</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="block text-[13px] font-medium text-[#1A1A1A]">OG IMAGE</label>
                        {seoForm.ogImage ? (
                          <img src={seoForm.ogImage} alt="OG" className="h-56 w-full max-w-[280px] rounded-lg border border-[#E6E6E6] object-contain bg-white" />
                        ) : null}
                        {canUpdate && (
                          <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-[#FCFCFC] p-5 text-center">
                            <p className="text-[13px] text-[#1A1A1A]">{seoForm.ogImage ? "Change image" : "Upload or select image"}</p>
                            <p className="mt-1 text-[12px] text-[#9A9A9A]">Open Media Library to reuse existing assets or upload a new file</p>
                            <div className="mt-4 flex justify-center">
                              <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-white", uploadingSeoAsset === "ogImage" ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                                <Upload size={13} />
                                {uploadingSeoAsset === "ogImage" ? "Uploading..." : seoForm.ogImage ? "Change Image" : "Upload Image"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadSeoImage("ogImage", file); e.target.value = ""; }} disabled={uploadingSeoAsset === "ogImage"} />
                              </label>
                            </div>
                          </div>
                        )}
                        <AdminInput label="" value={seoForm.ogImage} onChange={(e) => setSeoForm((prev) => ({ ...prev, ogImage: e.target.value }))} disabled={!canUpdate} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold uppercase tracking-wide text-[#9A9A9A]">Twitter Card</h3>
                    <div className="mt-4 grid gap-5 border-t border-[#E6E6E6] pt-4 md:grid-cols-[1fr_1fr]">
                      <div className="space-y-5">
                        <div>
                          <AdminInput label="TWITTER TITLE" maxLength={120} placeholder="Inherits OG Title if blank" value={seoForm.twitterTitle} onChange={(e) => setSeoForm((prev) => ({ ...prev, twitterTitle: e.target.value }))} disabled={!canUpdate} />
                          <div className="mt-2 text-right text-[12px] text-[#9A9A9A]">{seoForm.twitterTitle.length} / 120</div>
                        </div>
                        <div>
                          <AdminTextarea label="TWITTER DESCRIPTION" rows={5} maxLength={320} placeholder="Inherits OG Description if blank" value={seoForm.twitterDescription} onChange={(e) => setSeoForm((prev) => ({ ...prev, twitterDescription: e.target.value }))} disabled={!canUpdate} />
                          <div className="mt-2 text-right text-[12px] text-[#9A9A9A]">{seoForm.twitterDescription.length} / 320</div>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <label className="block text-[13px] font-medium text-[#1A1A1A]">TWITTER IMAGE</label>
                        {seoForm.twitterImage ? (
                          <img src={seoForm.twitterImage} alt="Twitter" className="h-56 w-full max-w-[280px] rounded-lg border border-[#E6E6E6] object-contain bg-white" />
                        ) : null}
                        {canUpdate && (
                          <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-[#FCFCFC] p-5 text-center">
                            <p className="text-[13px] text-[#1A1A1A]">{seoForm.twitterImage ? "Change image" : "Upload or select image"}</p>
                            <p className="mt-1 text-[12px] text-[#9A9A9A]">Open Media Library to reuse existing assets or upload a new file</p>
                            <div className="mt-4 flex justify-center">
                              <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md px-3 py-2 text-[12px] font-medium text-white", uploadingSeoAsset === "twitterImage" ? "bg-gray-400" : "bg-[#E31E24] hover:bg-[#B5151B]")}>
                                <Upload size={13} />
                                {uploadingSeoAsset === "twitterImage" ? "Uploading..." : seoForm.twitterImage ? "Change Image" : "Upload Image"}
                                <input type="file" accept="image/*" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) uploadSeoImage("twitterImage", file); e.target.value = ""; }} disabled={uploadingSeoAsset === "twitterImage"} />
                              </label>
                            </div>
                          </div>
                        )}
                        <AdminInput label="" placeholder="Or paste an image URL..." value={seoForm.twitterImage} onChange={(e) => setSeoForm((prev) => ({ ...prev, twitterImage: e.target.value }))} disabled={!canUpdate} />
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-[14px] font-semibold uppercase tracking-wide text-[#9A9A9A]">FAQ Schema (Structured Data)</h3>
                    <div className="mt-4 border-t border-[#E6E6E6] pt-4">
                      <p className="mb-4 text-[12px] text-[#9A9A9A]">FAQ schema helps Google display rich results. Add question/answer pairs below.</p>
                      <div className="space-y-4">
                        {seoForm.faqSchemaJson.map((faq, index) => (
                          <div key={`faq-${index}`} className="rounded-lg border border-[#E6E6E6] p-4">
                            <div className="mb-3 flex justify-between">
                              <p className="text-[13px] font-semibold text-[#1A1A1A]">FAQ {index + 1}</p>
                              {canUpdate && (
                                <button type="button" onClick={() => removeFaq(index)} className="rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F8F8F8]">REMOVE</button>
                              )}
                            </div>
                            <div className="space-y-4">
                              <AdminInput label="QUESTION" value={faq.question} onChange={(e) => updateFaq(index, "question", e.target.value)} disabled={!canUpdate} />
                              <AdminTextarea label="ANSWER" rows={4} value={faq.answer} onChange={(e) => updateFaq(index, "answer", e.target.value)} disabled={!canUpdate} />
                            </div>
                          </div>
                        ))}
                      </div>
                      {canUpdate && (
                        <button type="button" onClick={addFaq} className="mt-4 rounded-md border border-[#E6E6E6] px-4 py-2 text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F8F8F8]">
                          + ADD FAQ
                        </button>
                      )}
                    </div>
                  </div>

                  {canUpdate && (
                    <div className="flex justify-end border-t border-[#E6E6E6] pt-6">
                      <button type="submit" disabled={updatePage.isPending} className="inline-flex items-center gap-1.5 rounded-md bg-[#12314F] px-6 py-3 text-[13px] font-medium text-white hover:bg-[#0E2740] disabled:opacity-50">
                        <Save size={13} />
                        {updatePage.isPending ? "Saving..." : "Save SEO"}
                      </button>
                    </div>
                  )}
                </form>
              )}

            </>
          )}
        </div>
      </div>

      <ConfirmModal
        open={!!deleteSectionId}
        title="Delete section"
        message="This will permanently delete the selected section and all of its blocks."
        onConfirm={handleDeleteSection}
        onCancel={() => setDeleteSectionId(null)}
        danger
      />
      <ConfirmModal
        open={!!deleteBlockId}
        title="Delete block"
        message="This will permanently delete the selected block."
        onConfirm={handleDeleteBlock}
        onCancel={() => setDeleteBlockId(null)}
        danger
      />
      <ConfirmModal
        open={!!deletePageId}
        title="Delete page"
        message="This will permanently delete the selected page and all its sections and blocks."
        onConfirm={handleDeletePage}
        onCancel={() => setDeletePageId(null)}
        danger
      />
    </AdminLayout>
  );
}

export default function CmsPagesPage() {
  return (
    <Suspense
      fallback={
        <AdminLayout title="CMS Pages" breadcrumb={[{ label: "Content" }, { label: "Pages" }]}>
          <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] px-5 py-12 text-center text-sm text-[#9A9A9A]">
            Loading CMS pages...
          </div>
        </AdminLayout>
      }
    >
      <CmsPagesPageContent />
    </Suspense>
  );
}
