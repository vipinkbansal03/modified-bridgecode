"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { ChevronDown, ChevronUp, Plus, Trash2, GripVertical, Edit2, Save, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, AdminSelect, useToast, ConfirmModal } from "@/components/admin/AdminComponents";
import {
  useAdminCmsPage, useUpdateCmsPage, useCreateCmsSection, useUpdateCmsSection, useDeleteCmsSection,
  useCreateCmsBlock, useUpdateCmsBlock, useDeleteCmsBlock,
} from "@/hooks/admin/useAdminHooks";

type Block = { id: string; blockType: string; title?: string | null; subtitle?: string | null; description?: string | null; image?: string | null; icon?: string | null; linkLabel?: string | null; linkUrl?: string | null; dataJson?: unknown; sortOrder: number };
type Section = { id: string; sectionKey: string; title?: string | null; sortOrder: number; blocks: Block[] };
type Page = { id: string; title: string; slug: string; pageKey: string; status: string; seoTitle?: string | null; seoDescription?: string | null; sections: Section[] };

function BlockRow({ block, pageId, sectionId, onDelete }: { block: Block; pageId: string; sectionId: string; onDelete: (id: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ title: block.title ?? "", subtitle: block.subtitle ?? "", description: block.description ?? "", image: block.image ?? "", icon: block.icon ?? "", linkLabel: block.linkLabel ?? "", linkUrl: block.linkUrl ?? "" });
  const updateBlock = useUpdateCmsBlock(pageId);
  const { showToast } = useToast();

  async function save() {
    try {
      await updateBlock.mutateAsync({ id: block.id, ...form });
      showToast("Block saved.", "success");
      setEditing(false);
    } catch { showToast("Save failed.", "error"); }
  }

  return (
    <div className="border border-gray-100 rounded-lg p-3 bg-white">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300" />
          <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-600">{block.blockType}</code>
          {block.title && <span className="text-sm font-medium text-gray-700 truncate max-w-[220px]">{block.title}</span>}
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setEditing((e) => !e)} className="p-1.5 text-gray-400 hover:text-blue-600 transition-colors"><Edit2 size={13} /></button>
          <button onClick={() => onDelete(block.id)} className="p-1.5 text-gray-400 hover:text-red-600 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>

      {editing && (
        <div className="mt-3 space-y-3 pt-3 border-t border-gray-100">
          <AdminInput label="Title" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
          <AdminInput label="Subtitle" value={form.subtitle} onChange={(e) => setForm((f) => ({ ...f, subtitle: e.target.value }))} />
          <AdminTextarea label="Description" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
          <AdminInput label="Image URL" value={form.image} onChange={(e) => setForm((f) => ({ ...f, image: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <AdminInput label="Icon" value={form.icon} onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))} placeholder="e.g. BadgeCheck" />
            <AdminInput label="Link Label" value={form.linkLabel} onChange={(e) => setForm((f) => ({ ...f, linkLabel: e.target.value }))} />
          </div>
          <AdminInput label="Link URL" value={form.linkUrl} onChange={(e) => setForm((f) => ({ ...f, linkUrl: e.target.value }))} />
          <div className="flex gap-2">
            <button onClick={save} disabled={updateBlock.isPending} className="flex items-center gap-1.5 bg-brand text-white px-3 py-1.5 rounded text-xs font-medium hover:bg-brand/90 disabled:opacity-50"><Save size={12} />{updateBlock.isPending ? "Saving…" : "Save"}</button>
            <button onClick={() => setEditing(false)} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-gray-200 hover:bg-gray-50"><X size={12} />Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionPanel({ section, pageId, onDelete }: { section: Section; pageId: string; onDelete: (id: string) => void }) {
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
    } catch { showToast("Failed to add block.", "error"); }
  }

  async function handleDeleteBlock() {
    if (!deleteBlockId) return;
    try {
      await deleteBlock.mutateAsync(deleteBlockId);
      showToast("Block deleted.", "success");
    } catch { showToast("Delete failed.", "error"); }
    finally { setDeleteBlockId(null); }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-gray-300" />
          <code className="text-xs bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-600">{section.sectionKey}</code>
          {section.title && <span className="text-sm font-medium text-gray-800">{section.title}</span>}
          <span className="text-xs text-gray-400">{section.blocks.length} block{section.blocks.length !== 1 ? "s" : ""}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button onClick={() => setExpanded((e) => !e)} className="p-1.5 text-gray-400 hover:text-gray-700">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          <button onClick={() => onDelete(section.id)} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-2">
          {section.blocks.map((b) => (
            <BlockRow key={b.id} block={b} pageId={pageId} sectionId={section.id} onDelete={setDeleteBlockId} />
          ))}

          {addingBlock ? (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-gray-100">
              <input
                value={blockType}
                onChange={(e) => setBlockType(e.target.value)}
                placeholder="Block type (e.g. slide, stat, card)"
                className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
              />
              <button onClick={handleAddBlock} disabled={createBlock.isPending} className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50 whitespace-nowrap">{createBlock.isPending ? "Adding…" : "Add Block"}</button>
              <button onClick={() => setAddingBlock(false)} className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Cancel</button>
            </div>
          ) : (
            <button onClick={() => setAddingBlock(true)} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-brand mt-1 transition-colors"><Plus size={13} />Add Block</button>
          )}
        </div>
      )}

      <ConfirmModal open={!!deleteBlockId} title="Delete block" message="Delete this block permanently?" onConfirm={handleDeleteBlock} onCancel={() => setDeleteBlockId(null)} danger />
    </div>
  );
}

export default function CmsPageEditorPage() {
  const { id } = useParams<{ id: string }>();
  const { data: page, isLoading } = useAdminCmsPage(id);
  const updatePage = useUpdateCmsPage(id);
  const createSection = useCreateCmsSection(id);
  const deleteSection = useDeleteCmsSection(id);
  const { showToast } = useToast();

  const [seoForm, setSeoForm] = useState<{ seoTitle: string; seoDescription: string } | null>(null);
  const [addingSection, setAddingSection] = useState(false);
  const [newSectionKey, setNewSectionKey] = useState("");
  const [deleteSectionId, setDeleteSectionId] = useState<string | null>(null);

  const p = page as Page | undefined;

  async function handleSaveSeo(e: React.FormEvent) {
    e.preventDefault();
    if (!seoForm) return;
    try {
      await updatePage.mutateAsync(seoForm);
      showToast("SEO saved.", "success");
      setSeoForm(null);
    } catch { showToast("Save failed.", "error"); }
  }

  async function handleAddSection() {
    if (!newSectionKey.trim()) return;
    try {
      await createSection.mutateAsync({ sectionKey: newSectionKey.trim(), sortOrder: (p?.sections.length ?? 0) });
      showToast("Section added.", "success");
      setAddingSection(false);
      setNewSectionKey("");
    } catch { showToast("Failed to add section.", "error"); }
  }

  async function handleDeleteSection() {
    if (!deleteSectionId) return;
    try {
      await deleteSection.mutateAsync(deleteSectionId);
      showToast("Section deleted.", "success");
    } catch { showToast("Delete failed.", "error"); }
    finally { setDeleteSectionId(null); }
  }

  if (isLoading) return <AdminLayout title="Loading…" breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }]}><div className="text-sm text-gray-500">Loading page…</div></AdminLayout>;
  if (!p) return <AdminLayout title="Not found" breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }]}><div className="text-sm text-red-500">Page not found.</div></AdminLayout>;

  return (
    <AdminLayout title={p.title} breadcrumb={[{ label: "Content" }, { label: "Pages", href: "/admin/cms/pages" }, { label: p.title }]}>
      {/* Meta strip */}
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-gray-100">
        <code className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-600">{p.pageKey}</code>
        <span className="text-xs text-gray-400">/{p.slug}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${p.status === "ACTIVE" ? "bg-green-50 text-green-700" : "bg-gray-100 text-gray-500"}`}>{p.status}</span>
        <button onClick={() => setSeoForm({ seoTitle: p.seoTitle ?? "", seoDescription: p.seoDescription ?? "" })} className="ml-auto text-xs text-gray-500 hover:text-brand transition-colors flex items-center gap-1"><Edit2 size={11} />Edit SEO</button>
      </div>

      {/* SEO editor inline */}
      {seoForm && (
        <form onSubmit={handleSaveSeo} className="mb-6 p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
          <AdminInput label="SEO Title" value={seoForm.seoTitle} onChange={(e) => setSeoForm((f) => f && { ...f, seoTitle: e.target.value })} />
          <AdminInput label="SEO Description" value={seoForm.seoDescription} onChange={(e) => setSeoForm((f) => f && { ...f, seoDescription: e.target.value })} />
          <div className="flex gap-2">
            <button type="submit" disabled={updatePage.isPending} className="bg-brand text-white px-4 py-1.5 rounded text-sm font-medium hover:bg-brand/90 disabled:opacity-50">{updatePage.isPending ? "Saving…" : "Save"}</button>
            <button type="button" onClick={() => setSeoForm(null)} className="px-4 py-1.5 rounded text-sm border border-gray-200 hover:bg-white">Cancel</button>
          </div>
        </form>
      )}

      {/* Sections */}
      <div className="space-y-4">
        {p.sections.map((s) => (
          <SectionPanel key={s.id} section={s} pageId={p.id} onDelete={setDeleteSectionId} />
        ))}
      </div>

      {/* Add section */}
      {addingSection ? (
        <div className="flex items-center gap-2 mt-4">
          <input
            value={newSectionKey}
            onChange={(e) => setNewSectionKey(e.target.value)}
            placeholder="Section key (e.g. home.hero)"
            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand"
            autoFocus
          />
          <button onClick={handleAddSection} disabled={createSection.isPending} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 disabled:opacity-50">{createSection.isPending ? "Adding…" : "Add Section"}</button>
          <button onClick={() => setAddingSection(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-gray-50">Cancel</button>
        </div>
      ) : (
        <button onClick={() => setAddingSection(true)} className="mt-4 flex items-center gap-2 text-sm text-gray-400 hover:text-brand transition-colors border border-dashed border-gray-200 hover:border-brand rounded-xl px-4 py-3 w-full justify-center">
          <Plus size={14} />Add Section
        </button>
      )}

      <ConfirmModal open={!!deleteSectionId} title="Delete section" message="This will permanently delete the section and all its blocks." onConfirm={handleDeleteSection} onCancel={() => setDeleteSectionId(null)} danger />
    </AdminLayout>
  );
}
