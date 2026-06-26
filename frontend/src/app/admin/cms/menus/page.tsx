"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminTextarea, useToast, ConfirmModal } from "@/components/admin/AdminComponents";
import { useAdminCmsMenus, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";

type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;
type Language = { id: string; name: string; code: string };
type MenuItem = { id: string; label: string; url: string; sortOrder: number; translations?: CmsTranslations };
type Menu = { id: string; name: string; location: string; status: string; items: MenuItem[] };

function translationValue(translations: CmsTranslations | undefined, field: string, languageId: string) {
  return translations?.[field]?.find((entry) => entry.languageId === languageId)?.value ?? "";
}

function MenuCard({ menu, languages, onDeleted }: { menu: Menu; languages: Language[]; onDeleted: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [addLabel, setAddLabel] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [items, setItems] = useState<MenuItem[]>(menu.items);
  const { showToast } = useToast();

  async function addItem() {
    if (!addLabel || !addUrl) return;
    try {
      const r = await adminApi.post(`/cms/menus/${menu.id}/items`, { label: addLabel, url: addUrl, sortOrder: items.length });
      setItems((prev) => [...prev, r.data.data]);
      setAddLabel(""); setAddUrl("");
      showToast("Item added.", "success");
    } catch { showToast("Failed.", "error"); }
  }

  async function removeItem() {
    if (!deleteItemId) return;
    try {
      await adminApi.delete(`/cms/menu-items/${deleteItemId}`);
      setItems((prev) => prev.filter((i) => i.id !== deleteItemId));
      showToast("Item removed.", "success");
    } catch { showToast("Failed.", "error"); }
    finally { setDeleteItemId(null); }
  }

  async function deleteMenu() {
    try {
      await adminApi.delete(`/cms/menus/${menu.id}`);
      showToast("Menu deleted.", "success");
      onDeleted();
    } catch { showToast("Failed.", "error"); }
  }

  async function saveItemTranslation(itemId: string, languageId: string, value: string) {
    try {
      await adminApi.put(`/cms/translations/menuItem/${itemId}/${languageId}`, { label: value });
      showToast("Translation saved.", "success");
    } catch {
      showToast("Failed to save translation.", "error");
    }
  }

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm text-gray-800">{menu.name}</span>
          <code className="text-xs bg-white border border-gray-200 px-1.5 py-0.5 rounded text-gray-500">{menu.location}</code>
          <span className="text-xs text-gray-400">{items.length} items</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setExpanded((e) => !e)} className="p-1.5 text-gray-400 hover:text-gray-700">{expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
          <button onClick={deleteMenu} className="p-1.5 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
        </div>
      </div>

      {expanded && (
        <div className="p-4 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="py-2 px-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-gray-700">{item.label}</span>
                  <span className="text-xs text-gray-400 ml-2">{item.url}</span>
                </div>
                <button onClick={() => setDeleteItemId(item.id)} className="text-gray-300 hover:text-red-500 transition-colors"><Trash2 size={13} /></button>
              </div>
              {languages.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {languages.map((language) => (
                    <AdminTextarea
                      key={language.id}
                      label={`${language.name} (${language.code}) label`}
                      defaultValue={translationValue(item.translations, "label", language.id)}
                      rows={1}
                      onBlur={(e) => saveItemTranslation(item.id, language.id, e.target.value)}
                    />
                  ))}
                </div>
              )}
            </div>
          ))}

          <div className="flex gap-2 pt-2 border-t border-gray-100">
            <input value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="Label" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand" />
            <input value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="URL" className="flex-1 px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-brand" />
            <button onClick={addItem} className="bg-brand text-white px-3 py-1.5 rounded-lg text-sm font-medium hover:bg-brand/90 whitespace-nowrap"><Plus size={13} className="inline mr-1" />Add</button>
          </div>
        </div>
      )}
      <ConfirmModal open={!!deleteItemId} title="Remove item" message="Remove this menu item?" onConfirm={removeItem} onCancel={() => setDeleteItemId(null)} danger />
    </div>
  );
}

export default function CmsMenusPage() {
  const { data: menus, isLoading, refetch } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState("header");
  const { showToast } = useToast();

  async function createMenu() {
    if (!newName.trim()) return;
    try {
      await adminApi.post("/cms/menus", { name: newName, location: newLocation });
      showToast("Menu created.", "success");
      setCreating(false); setNewName(""); setNewLocation("header");
      refetch();
    } catch { showToast("Failed.", "error"); }
  }

  const menuList: Menu[] = (menus as Menu[]) ?? [];

  return (
    <AdminLayout title="Menus" breadcrumb={[{ label: "Content" }, { label: "Menus" }]}>
      <div className="flex justify-between items-center mb-5">
        <p className="text-sm text-gray-500">{menuList.length} menu{menuList.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setCreating((c) => !c)} className="flex items-center gap-2 bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90"><Plus size={15} />New Menu</button>
      </div>

      {creating && (
        <div className="mb-5 p-4 border border-gray-200 rounded-xl bg-gray-50 flex gap-3 items-end">
          <AdminInput label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Header Navigation" />
          <AdminInput label="Location" value={newLocation} onChange={(e) => setNewLocation(e.target.value)} placeholder="e.g. header, footer" />
          <button onClick={createMenu} className="bg-brand text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-brand/90 whitespace-nowrap mb-0.5">Create</button>
          <button onClick={() => setCreating(false)} className="px-4 py-2 rounded-lg text-sm border border-gray-200 hover:bg-white mb-0.5">Cancel</button>
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Loading…</div>}
      <div className="space-y-4">
        {menuList.map((m) => <MenuCard key={m.id} menu={m} languages={languages as Language[]} onDeleted={refetch} />)}
      </div>
    </AdminLayout>
  );
}
