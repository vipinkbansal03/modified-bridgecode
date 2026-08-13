"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Edit2, Save, X, Languages, Upload } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminTextarea, AdminSelect, useToast, ConfirmModal, toastMessages, LoadingButton } from "@/components/admin/AdminComponents";
import {
  useAdminCmsPage, useAdminCmsPages, useUpdateCmsPage, useCreateCmsSection, useUpdateCmsSection, useDeleteCmsSection,
  useCreateCmsBlock, useUpdateCmsBlock, useDeleteCmsBlock, useAdminLanguages,
} from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";

type CmsTranslationField = "title" | "subtitle" | "description" | "linkLabel" | "seoTitle" | "seoDescription";
type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;
type Language = { id: string; name: string; code: string; isDefault?: boolean };
type Block = { id: string; blockType: string; title?: string | null; subtitle?: string | null; description?: string | null; image?: string | null; icon?: string | null; linkLabel?: string | null; linkUrl?: string | null; dataJson?: unknown; sortOrder: number; translations?: CmsTranslations };
type Section = { id: string; sectionKey: string; title?: string | null; subtitle?: string | null; description?: string | null; sortOrder: number; blocks: Block[]; translations?: CmsTranslations };
type Page = { id: string; title: string; slug: string; pageKey: string; status: string; seoTitle?: string | null; seoDescription?: string | null; sections: Section[]; translations?: CmsTranslations };

type EditorTab = "content" | "translations";

const fieldLabels: Record<CmsTranslationField, string> = {
  title: "Title",
  subtitle: "Subtitle",
  description: "Description",
  linkLabel: "Button / link label",
  seoTitle: "SEO title",
  seoDescription: "SEO description",
};

function translationValue(translations: CmsTranslations | undefined, field: string, languageId: string) {
  return translations?.[field]?.find((item) => item.languageId === languageId)?.value ?? "";
}

function englishReference(value: string | null | undefined) {
  if (!value?.trim()) return null;
  return value.trim();
}

function TranslationField({
  label,
  rows = 1,
  defaultValue,
  placeholder,
  onSave,
}: {
  label: string;
  rows?: number;
  defaultValue: string;
  placeholder?: string | null;
  onSave: (value: string) => Promise<void>;
}) {
  const { showToast } = useToast();

  return (
    <div className="space-y-1">
      <AdminTextarea
        label={label}
        rows={rows}
        defaultValue={defaultValue}
        placeholder={placeholder ?? ""}
        onBlur={async (e) => {
          const value = e.currentTarget.value.trim();
          const saved = defaultValue.trim();
          if (value === saved) {
            showToast(toastMessages.noChanges, "info");
            return;
          }
          await onSave(value);
        }}
      />
      {placeholder && (
        <p className="text-[11.5px] text-[#9A9A9A]">
          English: <span className="text-[#6B6B6B]">{placeholder}</span>
        </p>
      )}
    </div>
  );
}

function BlockRow({
  block,
  pageId,
  onDelete,
}: {
  block: Block;
  pageId: string;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    title: block.title ?? "",
    subtitle: block.subtitle ?? "",
    description: block.description ?? "",
    image: block.image ?? "",
    icon: block.icon ?? "",
    linkLabel: block.linkLabel ?? "",
    linkUrl: block.linkUrl ?? "",
  });
  const [uploadingImage, setUploadingImage] = useState(false);
  const updateBlock = useUpdateCmsBlock(pageId);
  const { showToast } = useToast();

  async function save() {
    try {
      await updateBlock.mutateAsync({ id: block.id, ...form });
      showToast("Block saved.", "success");
      setEditing(false);
    } catch {
      showToast("Save failed.", "error");
    }
  }

  async function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const formData = new FormData();
    formData.append("entityType", "CMS");
    if (pageId) formData.append("entityId", pageId);
    formData.append("files", file);
    try {
      setUploadingImage(true);
      const response = await adminApi.post("/media", formData);
      const uploaded = response.data?.data;
      const uploadedImage = Array.isArray(uploaded) ? uploaded.find((mediaItem: { url?: string }) => !!mediaItem?.url) : null;
      if (uploadedImage?.url) {
        setForm((f) => ({ ...f, image: uploadedImage.url }));
        showToast("Image uploaded and set.");
      } else {
        showToast("Uploaded. Please copy URL from Media library.", "error");
      }
    } catch {
      showToast("Upload failed.", "error");
    } finally {
      setUploadingImage(false);
      e.target.value = "";
    }
  }

  return (
    <div className="rounded-lg border border-gray-100 bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300" />
          <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">{block.blockType}</code>
          {block.title && <span className="max-w-[220px] truncate text-sm font-medium text-gray-700">{block.title}</span>}
          {form.image && (
            <img
              src={form.image}
              alt={block.title ?? "Block image"}
              className="h-8 w-12 rounded object-cover ring-1 ring-[#E6E6E6]"
            />
          )}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing((e) => !e)} className="p-1.5 text-gray-400 transition-colors hover:text-blue-600"><Edit2 size={13} /></button>
          <button onClick={() => onDelete(block.id)} className="p-1.5 text-gray-400 transition-colors hover:text-red-600"><Trash2 size={13} /></button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 border-t border-gray-100 pt-3">
          <AdminInput label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <AdminInput label="Subtitle" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          <AdminTextarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          <AdminInput
            label="Image URL"
            value={form.image}
            onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))}
          />
          <div className="flex items-center gap-2">
            <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded bg-gray-900 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90", uploadingImage ? "opacity-60" : "")}>
              <Upload size={12} />
              {uploadingImage ? "Uploading…" : "Upload image"}
              <input type="file" accept="image/*" className="hidden" onChange={handleImageUpload} disabled={uploadingImage} />
            </label>
            {form.image && (
              <button
                type="button"
                onClick={() => setForm((f) => ({ ...f, image: "" }))}
                className="rounded border border-gray-200 px-2.5 py-1.5 text-xs text-gray-500 hover:bg-gray-50"
              >
                Remove
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <AdminInput label="Icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="e.g. BadgeCheck" />
            <AdminInput label="Link Label" value={form.linkLabel} onChange={(e) => setForm((f) => ({ ...f, linkLabel: e.target.value }))} />
          </div>
          <AdminInput label="Link URL" value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={save} disabled={updateBlock.isPending} className="flex items-center gap-1.5 rounded bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand/90 disabled:opacity-50"><Save size={12} />{updateBlock.isPending ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 rounded border border-gray-200 px-3 py-1.5 text-xs font-medium hover:bg-gray-50"><X size={12} />Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionPanel({
  section,
  pageId,
  onDelete,
}: {
  section: Section;
  pageId: string;
  onDelete: (id: string) => void;
}) {
  const [expanded, setExpanded] = useState(true);
  const [addingBlock, setAddingBlock] = useState(false);
  const [blockType, setBlockType] = useState("generic");
  const [deleteBlockId, setDeleteBlockId] = useState<string | null>(null);
  const createBlock = useCreateCmsBlock(pageId, section.id);
  const deleteBlock = useDeleteCmsBlock(pageId);
  const { showToast } = useToast();

  async function handleAddBlock() {
    try {
      await createBlock.mutateAsync({ blockType, sortOrder: section.blocks.length });
      showToast("Block added.", "success");
      setAddingBlock(false);
    } catch {
      showToast("Failed to add block.", "error");
    }
  }

  async function handleDeleteBlock() {
    if (!deleteBlockId) return;
    try {
      await deleteBlock.mutateAsync(deleteBlockId);
      showToast("Block deleted.", "success");
    } catch {
      showToast("Delete failed.", "error");
    } finally {
      setDeleteBlockId(null);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300" />
          <code className="rounded border border-gray-200 bg-white px-2 py-0.5 text-xs text-gray-600">{section.sectionKey}</code>
          {section.title && <span className="text-sm font-medium text-gray-800">{section.title}</span>}
          <span className="text-xs text-gray-400">{section.blocks.length} block{section.blocks.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setExpanded((e) => !e)} className="p-1.5 text-gray-400 hover:text-gray-700">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          <button onClick={() => onDelete(section.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="space-y-2 p-4">
          {section.blocks.map((b) => (
            <BlockRow key={b.id} block={b} pageId={pageId} onDelete={setDeleteBlockId} />
          ))}

          {addingBlock ? (
            <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
              <input
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                placeholder="Block type (e.g. slide, stat, card)"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <LoadingButton onClick={handleAddBlock} loading={createBlock.isPending} loadingText="Adding…" className="whitespace-nowrap rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-white hover:bg-brand/90">Add Block</LoadingButton>
              <button onClick={() => setAddingBlock(false)} className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm hover:bg-gray-50">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingBlock(true)} className="mt-1 flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-brand"><Plus size={13} />Add Block</button>
          )}
        </div>
      )}

      <ConfirmModal open={!!deleteBlockId} title="Delete block" message="Delete this block permanently?" onConfirm={handleDeleteBlock} onCancel={() => setDeleteBlockId(null)} isLoading={deleteBlock.isPending} danger />
    </div>
  );
}

function CmsTranslationEditor({
  page,
  language,
  onSaved,
}: {
  page: Page;
  language: Language;
  onSaved: () => void;
}) {
  const { showToast } = useToast();

  async function savePageField(field: CmsTranslationField, value: string) {
    try {
      await adminApi.put(`/cms/translations/page/${page.id}/${language.id}`, { [field]: value });
      showToast(toastMessages.translationSaved, "success");
      onSaved();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  }

  async function saveSectionField(sectionId: string, field: CmsTranslationField, value: string) {
    try {
      await adminApi.put(`/cms/translations/section/${sectionId}/${language.id}`, { [field]: value });
      showToast(toastMessages.translationSaved, "success");
      onSaved();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  }

  async function saveBlockField(blockId: string, field: CmsTranslationField, value: string) {
    try {
      await adminApi.put(`/cms/translations/block/${blockId}/${language.id}`, { [field]: value });
      showToast(toastMessages.translationSaved, "success");
      onSaved();
    } catch {
      showToast(toastMessages.translationFailed, "error");
    }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#E6E6E6] bg-[#FFFBFB] px-4 py-3">
        <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
          <Languages size={15} className="text-[#E31E24]" />
          Editing <span className="font-semibold text-[#1A1A1A]">{language.name} ({language.code.toUpperCase()})</span> — click outside a field to save.
        </div>
      </div>

      <div className="rounded-xl border border-[#E6E6E6] bg-white p-5">
        <h3 className="mb-4 text-[14px] font-semibold text-[#1A1A1A]">Page</h3>
        <div className="grid gap-4 md:grid-cols-2">
          {(["title", "seoTitle", "seoDescription"] as CmsTranslationField[]).map((field) => (
            <TranslationField
              key={`page-${field}-${language.id}-${translationValue(page.translations, field, language.id)}`}
              label={fieldLabels[field]}
              rows={field === "seoDescription" ? 2 : 1}
              defaultValue={translationValue(page.translations, field, language.id)}
              placeholder={englishReference(String(page[field as keyof Page] ?? ""))}
              onSave={(value) => savePageField(field, value)}
            />
          ))}
        </div>
      </div>

      {page.sections.map((section) => (
        <div key={section.id} className="rounded-xl border border-[#E6E6E6] bg-white p-5">
          <div className="mb-4">
            <h3 className="text-[14px] font-semibold text-[#1A1A1A]">{section.title || section.sectionKey}</h3>
            <p className="text-[12px] text-[#9A9A9A]">{section.sectionKey}</p>
          </div>

          <div className="mb-5 grid gap-4 md:grid-cols-2">
            {(["title", "subtitle", "description"] as CmsTranslationField[]).map((field) => (
              <TranslationField
                key={`section-${section.id}-${field}-${translationValue(section.translations, field, language.id)}`}
                label={`Section ${fieldLabels[field].toLowerCase()}`}
                rows={field === "description" ? 2 : 1}
                defaultValue={translationValue(section.translations, field, language.id)}
                placeholder={englishReference(String(section[field as keyof Section] ?? ""))}
                onSave={(value) => saveSectionField(section.id, field, value)}
              />
            ))}
          </div>

          <div className="space-y-4">
            {section.blocks.map((block) => (
              <div key={block.id} className="rounded-lg border border-[#F0F0F0] bg-[#FAFAFA] p-4">
                <div className="mb-3 flex items-center gap-2">
                  <code className="rounded bg-white px-1.5 py-0.5 text-[11px] text-[#9A9A9A]">{block.blockType}</code>
                  <span className="text-[13px] font-medium text-[#1A1A1A]">{block.title || "Untitled block"}</span>
                </div>
                <div className="grid gap-4 md:grid-cols-2">
                  {(["title", "subtitle", "description", "linkLabel"] as CmsTranslationField[]).map((field) => (
                    <TranslationField
                      key={`block-${block.id}-${field}-${translationValue(block.translations, field, language.id)}`}
                      label={fieldLabels[field]}
                      rows={field === "description" ? 2 : 1}
                      defaultValue={translationValue(block.translations, field, language.id)}
                      placeholder={englishReference(String(block[field as keyof Block] ?? ""))}
                      onSave={(value) => saveBlockField(block.id, field, value)}
                    />
                  ))}
                </div>
              </div>
            ))}
            {section.blocks.length === 0 && (
              <p className="text-[13px] text-[#9A9A9A]">No blocks in this section.</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CmsPageEditorPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("cms.update")) {
      router.replace("/admin/cms/pages");
    }
  }, [authLoading, hasPermission, router]);

  const { data: page, isLoading } = useAdminCmsPage(id);
  const { data: languages = [] } = useAdminLanguages();
  const { data: pageListData } = useAdminCmsPages({ page: 1 });
  const updatePage = useUpdateCmsPage(id);
  const createSection = useCreateCmsSection(id);
  const deleteSection = useDeleteCmsSection(id);
  const { showToast } = useToast();

  const [editorTab, setEditorTab] = useState<EditorTab>("content");
  const [selectedLanguageId, setSelectedLanguageId] = useState("");
  const [seoForm, setSeoForm] = useState<{ seoTitle: string; seoDescription: string } | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState("");
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const allPages = pageListData?.data ?? [];

  const p = page as Page | undefined;
  const languageList = languages as Language[];
  const translationLanguages = languageList.filter((lang) => !lang.isDefault);
  const activeLanguage = translationLanguages.find((lang) => lang.id === selectedLanguageId) ?? translationLanguages[0];
  const selectedSection = p?.sections.find((section) => section.id === selectedSectionId) ?? p?.sections[0];

  useEffect(() => {
    if (!p) return;
    setSelectedSectionId((current) => {
      if (!p.sections.length) return "";
      return p.sections.some((s) => s.id === current) ? current : p.sections[0]?.id || "";
    });
  }, [p?.id, p?.sections.length]);

  useEffect(() => {
    if (allPages.length === 0) return;
    const exists = allPages.some((pageOption: { id: string }) => pageOption.id === id);
    if (!exists && allPages[0]?.id) {
      router.replace(`/admin/cms/pages/${allPages[0].id}`);
    }
  }, [allPages, id, router]);

  function refetchPage() {
    queryClient.invalidateQueries({ queryKey: ["admin-cms-page", id] });
  }

  async function handleSaveSeo(e: React.FormEvent) {
    e.preventDefault();
    if (!seoForm) return;
    try {
      await updatePage.mutateAsync(seoForm);
      showToast("SEO saved.", "success");
      setSeoForm(null);
    } catch {
      showToast("Save failed.", "error");
    }
  }

  async function handleAddSection() {
      if (!newSectionKey.trim()) return;
      try {
        await createSection.mutateAsync({ sectionKey: newSectionKey.trim(), sortOrder: (p?.sections.length ?? 0) });
        showToast("Section added.", "success");
        setAddingSection(false);
        setNewSectionKey("");
    } catch {
      showToast("Failed to add section.", "error");
    }
  }

  async function handleDeleteSection() {
    if (!deleteSectionId) return;
    try {
      await deleteSection.mutateAsync(deleteSectionId);
      showToast("Section deleted.", "success");
    } catch {
      showToast("Delete failed.", "error");
    } finally {
      setDeleteSectionId(null);
    }
  }

  if (isLoading || authLoading) return <AdminLayout title="Loading…" breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }]}><div className="text-sm text-gray-500">Loading page…</div></AdminLayout>;
  if (!p || !hasPermission("cms.update")) return <AdminLayout title="Not found" breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }]}><div className="text-sm text-red-500">Page not found.</div></AdminLayout>;

  return (
    <AdminLayout title={p.title} breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }, { label: p.title }]}>
      <div className="mb-6 flex flex-col gap-4 border-b border-gray-100 pb-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <code className="rounded bg-gray-100 px-2 py-1 text-xs text-gray-600">{p.pageKey}</code>
          <span className="text-xs text-gray-400">/{p.slug}</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${p.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {editorTab === "content" && allPages.length > 0 && (
            <div className="w-full md:w-56">
              <AdminSelect
                label="Page"
                value={p.id}
                onChange={(e) => {
                  const pageId = e.target.value;
                  if (pageId && pageId !== p.id) {
                    router.push(`/admin/cms/pages/${pageId}`);
                  }
                }}
                options={allPages.map((pageItem: { id: string; title: string }) => ({
                  value: pageItem.id,
                  label: pageItem.title,
                }))}
              />
            </div>
          )}
          {editorTab === "content" && p.sections.length > 0 && (
            <div className="w-full md:w-56">
              <AdminSelect
                label="Section"
                value={selectedSectionId}
                onChange={(e) => setSelectedSectionId(e.target.value)}
                options={p.sections.map((section) => ({
                  value: section.id,
                  label: section.title || section.sectionKey,
                }))}
              />
            </div>
          )}

          <div className="inline-flex rounded-lg border border-[#E6E6E6] bg-white p-1">
            <button
              type="button"
              onClick={() => setEditorTab("content")}
              className={cn(
                "rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
                editorTab === "content" ? "bg-[#1A1A1A] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
              )}
            >
              Content
            </button>
            <button
              type="button"
              onClick={() => {
                setEditorTab("translations");
                if (!selectedLanguageId && translationLanguages[0]) {
                  setSelectedLanguageId(translationLanguages[0].id);
                }
              }}
              className={cn(
                "rounded-md px-3.5 py-2 text-[13px] font-medium transition-colors",
                editorTab === "translations" ? "bg-[#E31E24] text-white" : "text-[#6B6B6B] hover:text-[#1A1A1A]",
              )}
            >
              Translations
            </button>
          </div>

          {editorTab === "translations" && translationLanguages.length > 0 && (
            <div className="w-[220px]">
              <AdminSelect
                label=""
                value={activeLanguage?.id ?? ""}
                onChange={(e) => setSelectedLanguageId(e.target.value)}
                options={translationLanguages.map((lang) => ({
                  value: lang.id,
                  label: `${lang.name} (${lang.code.toUpperCase()})`,
                }))}
              />
            </div>
          )}
        </div>
      </div>

      {editorTab === "content" && (
        <>
          <div className="mb-6 flex justify-end">
            <button onClick={() => setSeoForm({ seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "" })} className="flex items-center gap-1 text-xs text-gray-500 transition-colors hover:text-brand"><Edit2 size={11} />Edit default SEO</button>
          </div>

          {seoForm && (
            <form onSubmit={handleSaveSeo} className="mb-6 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
              <AdminInput label="SEO Title" value={seoForm.seoTitle} onChange={(e) => setSeoForm((f) => f && { ...f, seoTitle: e.target.value })} />
              <AdminInput label="SEO Description" value={seoForm.seoDescription} onChange={(e) => setSeoForm((f) => f && { ...f, seoDescription: e.target.value })} />
              <div className="flex gap-2">
                <button type="submit" disabled={updatePage.isPending} className="rounded bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50">{updatePage.isPending ? "Saving…" : "Save"}</button>
                <button type="button" onClick={() => setSeoForm(null)} className="rounded border border-gray-200 px-4 py-1.5 text-sm hover:bg-white">Cancel</button>
              </div>
            </form>
          )}

          <div className="space-y-4">
            {selectedSection ? (
              <SectionPanel key={selectedSection.id} section={selectedSection} pageId={p.id} onDelete={setDeleteSectionId} />
            ) : (
              <div className="rounded-lg border border-dashed border-[#E6E6E6] bg-white px-4 py-10 text-center text-sm text-[#9A9A9A]">
                No section selected. Use + Add Section to create one.
              </div>
            )}
          </div>

          {addingSection ? (
            <div className="mt-4 flex items-center gap-2">
              <input
                value={newSectionKey}
                onChange={(e) => setNewSectionKey(e.target.value)}
                placeholder="Section key (e.g. home.hero)"
                className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brand"
                autoFocus
              />
              <button onClick={handleAddSection} disabled={createSection.isPending} className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90 disabled:opacity-50">{createSection.isPending ? "Adding…" : "Add Section"}</button>
              <button onClick={() => setAddingSection(false)} className="rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingSection(true)} className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-200 px-4 py-3 text-sm text-gray-400 transition-colors hover:border-brand hover:text-brand">
              <Plus size={14} />Add Section
            </button>
          )}
        </>
      )}

      {editorTab === "translations" && (
        translationLanguages.length > 0 && activeLanguage ? (
          <CmsTranslationEditor page={p} language={activeLanguage} onSaved={refetchPage} />
        ) : (
          <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center">
            <p className="text-[14px] font-medium text-[#1A1A1A]">No translation languages yet</p>
            <p className="mt-1 text-[13px] text-[#9A9A9A]">Add a non-default language in Admin → Translations first.</p>
          </div>
        )
      )}

      <ConfirmModal open={!!deleteSectionId} title="Delete section" message="This will permanently delete the section and all its blocks." onConfirm={handleDeleteSection} onCancel={() => setDeleteSectionId(null)} isLoading={deleteSection.isPending} danger />
    </AdminLayout>
  );
}
