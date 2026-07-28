"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Edit2, Trash2, Search, ArrowUpDown, Globe, Link2, FolderTree, ExternalLink, X } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, DataTable, type Column, useToast } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminCategories, useAdminCmsMenus, useAdminCmsPages, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { CMS_MENU_LOCATIONS } from "@/lib/cmsNavigation";
import { adminApi } from "@/services/adminApi";

type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;
type Language = { id: string; name: string; code: string };
type MenuItem = {
  id: string;
  parentId?: string | null;
  label: string;
  url: string;
  sortOrder: number;
  openInNewTab?: boolean;
  status?: string;
  translations?: CmsTranslations;
};
type Menu = { id: string; name: string; location: string; status: string; items: MenuItem[] };

function translationValue(translations: CmsTranslations | undefined, field: string, languageId: string) {
  return translations?.[field]?.find((entry) => entry.languageId === languageId)?.value ?? "";
}

function normalizeItem(item: MenuItem): MenuItem {
  return {
    ...item,
    parentId: item.parentId ?? null,
    url: item.url ?? "",
    openInNewTab: Boolean(item.openInNewTab),
    status: item.status ?? "ACTIVE",
  };
}

function MenuCard({
  menu,
  languages,
  categories = [],
  cmsPages = [],
  onDeleted,
  onUpdated,
}: {
  menu: Menu;
  languages: Language[];
  categories?: any[];
  cmsPages?: any[];
  onDeleted: () => void;
  onUpdated: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const [menuName, setMenuName] = useState(menu.name);
  const [menuLocation, setMenuLocation] = useState(menu.location);
  const [menuStatus, setMenuStatus] = useState(menu.status ?? "ACTIVE");
  const [items, setItems] = useState<MenuItem[]>(menu.items.map(normalizeItem));
  const [searchQuery, setSearchQuery] = useState("");

  // Add Item State
  const [addLabel, setAddLabel] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addParentId, setAddParentId] = useState("");
  const [addOpenInNewTab, setAddOpenInNewTab] = useState<string>("false");
  const [addSortOrder, setAddSortOrder] = useState<number>(0);

  const { showToast } = useToast();

  useEffect(() => {
    setMenuName(menu.name);
    setMenuLocation(menu.location);
    setMenuStatus(menu.status ?? "ACTIVE");
    setItems(menu.items.map(normalizeItem));
  }, [menu]);

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [items],
  );

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return sortedItems;
    const q = searchQuery.toLowerCase().trim();
    return sortedItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.url.toLowerCase().includes(q),
    );
  }, [sortedItems, searchQuery]);

  const parentOptions = [
    { value: "", label: "No Parent (Top-Level Column)" },
    ...sortedItems.map((item) => ({ value: item.id, label: item.label })),
  ];

  async function addItem() {
    if (!addLabel.trim()) {
      showToast("Label is required.", "error");
      return;
    }

    try {
      const response = await adminApi.post(`/cms/menus/${menu.id}/items`, {
        label: addLabel.trim(),
        url: addUrl.trim(),
        parentId: addParentId || undefined,
        openInNewTab: addOpenInNewTab === "true",
        sortOrder: addSortOrder || items.length,
        status: "ACTIVE",
      });

      setItems((prev) => [...prev, normalizeItem(response.data.data)]);
      setAddLabel("");
      setAddUrl("");
      setAddParentId("");
      setAddOpenInNewTab("false");
      setIsAddModalOpen(false);
      showToast("Item added successfully.", "success");
      onUpdated();
    } catch {
      showToast("Failed to add item.", "error");
    }
  }

  async function saveMenu() {
    if (!menuName.trim() || !menuLocation.trim()) {
      showToast("Name and location are required.", "error");
      return;
    }

    try {
      await adminApi.put(`/cms/menus/${menu.id}`, {
        name: menuName.trim(),
        location: menuLocation.trim(),
        status: menuStatus,
      });
      showToast("Menu settings saved.", "success");
      onUpdated();
    } catch {
      showToast("Failed to save menu.", "error");
    }
  }

  async function saveItem(nextItem: MenuItem) {
    try {
      const response = await adminApi.put(`/cms/menu-items/${nextItem.id}`, {
        label: nextItem.label.trim(),
        url: nextItem.url.trim(),
        parentId: nextItem.parentId || null,
        sortOrder: Number(nextItem.sortOrder || 0),
        openInNewTab: Boolean(nextItem.openInNewTab),
        status: nextItem.status ?? "ACTIVE",
      });
      const saved = normalizeItem(response.data.data);
      setItems((prev) => prev.map((item) => (item.id === nextItem.id ? saved : item)));
      setEditingItem(null);
      showToast("Item updated successfully.", "success");
      onUpdated();
    } catch {
      showToast("Failed to update item.", "error");
    }
  }

  async function saveItemTranslation(itemId: string, languageId: string, value: string) {
    try {
      await adminApi.put(`/cms/translations/menuItem/${itemId}/${languageId}`, {
        label: value,
      });
      showToast("Translation saved.", "success");
      onUpdated();
    } catch {
      showToast("Failed to save translation.", "error");
    }
  }

  async function removeItem() {
    if (!deleteItemId) return;

    try {
      await adminApi.delete(`/cms/menu-items/${deleteItemId}`);
      setItems((prev) => prev.filter((item) => item.id !== deleteItemId));
      showToast("Item removed.", "success");
      onUpdated();
    } catch {
      showToast("Failed to remove item.", "error");
    } finally {
      setDeleteItemId(null);
    }
  }

  const columns: Column<MenuItem>[] = [
    {
      key: "label",
      label: "Menu Label",
      render: (row) => {
        const isChild = Boolean(row.parentId);
        const parentName = row.parentId ? parentMap.get(row.parentId) : null;
        return (
          <div className="flex items-center gap-2">
            {isChild ? (
              <span className="text-[#9A9A9A] font-mono text-xs pl-3">└─</span>
            ) : (
              <FolderTree size={14} className="text-[#E31E24] shrink-0" />
            )}
            <div className="flex flex-col">
              <span className={`font-semibold text-[#1A1A1A] ${isChild ? "text-[13px]" : "text-[13.5px]"}`}>
                {row.label}
              </span>
              {parentName && (
                <span className="text-[11px] text-[#9A9A9A]">Parent: {parentName}</span>
              )}
            </div>
          </div>
        );
      },
    },
    {
      key: "url",
      label: "URL / Target Link",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#555]">
          <Link2 size={12} className="text-[#9A9A9A] shrink-0" />
          <span className="truncate max-w-[240px]">{row.url || "—"}</span>
          {row.openInNewTab && <ExternalLink size={11} className="text-[#9A9A9A] shrink-0" />}
        </div>
      ),
    },
    {
      key: "sortOrder",
      label: "Order",
      width: "90px",
      render: (row) => (
        <span className="inline-flex rounded border border-[#E6E6E6] bg-[#F8F8F8] px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[#1A1A1A]">
          #{row.sortOrder}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "110px",
      render: (row) => (
        <span
          className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
            row.status === "ACTIVE"
              ? "border border-green-200 bg-green-50 text-green-700"
              : "border border-gray-200 bg-gray-50 text-gray-500"
          }`}
        >
          {row.status ?? "ACTIVE"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setEditingItem({ ...row })}
            className="flex h-8 w-8 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#1A1A1A] hover:bg-[#F5F5F5] hover:border-[#CCCCCC] transition-all"
            title="Edit Item"
          >
            <Edit2 size={13} />
          </button>
          <button
            type="button"
            onClick={() => setDeleteItemId(row.id)}
            className="flex h-8 w-8 items-center justify-center rounded border border-red-200 bg-white text-red-600 hover:bg-red-50 hover:border-red-300 transition-all"
            title="Delete Item"
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-[#E6E6E6] bg-white shadow-sm transition-all">
      {/* Menu Header Card */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E6E6E6] bg-[#FAFAFA] px-5 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="flex items-center gap-2 text-left hover:opacity-80"
          >
            {expanded ? <ChevronUp size={18} className="text-[#6B6B6B]" /> : <ChevronDown size={18} className="text-[#6B6B6B]" />}
            <div>
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">{menu.name}</h3>
              <div className="mt-0.5 flex items-center gap-2 text-xs text-[#9A9A9A]">
                <span className="rounded bg-[#EFEFEF] px-1.5 py-0.5 font-mono text-[10.5px] text-[#6B6B6B]">
                  {menu.location}
                </span>
                <span>•</span>
                <span className="font-semibold text-[#1A1A1A]">{items.length} items</span>
              </div>
            </div>
          </button>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
              menu.status === "ACTIVE"
                ? "border border-green-200 bg-green-50 text-green-700"
                : "border border-gray-200 bg-gray-50 text-gray-500"
            }`}
          >
            {menu.status ?? "ACTIVE"}
          </span>

          <button
            type="button"
            onClick={() => setExpanded((prev) => !prev)}
            className="rounded-lg border border-[#E6E6E6] bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
          >
            {expanded ? "Collapse Table" : "Manage Menu Items"}
          </button>
        </div>
      </div>

      {/* Expanded Table & Management Section */}
      {expanded && (
        <div className="space-y-4 p-5">
          {/* Menu Settings */}
          <div className="grid gap-3 rounded-lg border border-[#E6E6E6] bg-[#FDFDFD] p-3.5 md:grid-cols-[1fr_1fr_120px_auto]">
            <AdminInput label="Menu Display Name" value={menuName} onChange={(e) => setMenuName(e.target.value)} />
            <AdminSelect
              label="Location Key"
              value={menuLocation}
              onChange={(e) => setMenuLocation(e.target.value)}
              options={CMS_MENU_LOCATIONS.map((option) => ({ value: option.value, label: option.label }))}
            />
            <AdminSelect
              label="Status"
              value={menuStatus}
              onChange={(e) => setMenuStatus(e.target.value)}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <div className="flex items-end">
              <button
                type="button"
                onClick={saveMenu}
                className="w-full rounded-md border border-[#E6E6E6] bg-white py-2 px-3 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] transition-all"
              >
                Save Settings
              </button>
            </div>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-xs flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                type="text"
                placeholder="Search menu items..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-[#E6E6E6] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {categories.length > 0 && (
                <div className="w-52">
                  <AdminSelect
                    label=""
                    value=""
                    onChange={(e) => {
                      const cat = categories.find((c: { id: string }) => c.id === e.target.value);
                      if (cat) {
                        setAddLabel(cat.name);
                        setAddUrl(`/products?category=${cat.slug}`);
                        setAddSortOrder(items.length);
                        setIsAddModalOpen(true);
                      }
                    }}
                    options={[
                      { value: "", label: "⚡ Quick Link Category..." },
                      ...categories.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })),
                    ]}
                  />
                </div>
              )}
              {cmsPages.length > 0 && (
                <div className="w-52">
                  <AdminSelect
                    label=""
                    value=""
                    onChange={(e) => {
                      const page = cmsPages.find((p: { id: string }) => p.id === e.target.value);
                      if (page) {
                        setAddLabel(page.title);
                        setAddUrl(`/${page.slug}`);
                        setAddSortOrder(items.length);
                        setIsAddModalOpen(true);
                      }
                    }}
                    options={[
                      { value: "", label: "⚡ Quick Link CMS Page..." },
                      ...cmsPages.map((p: { id: string; title: string; slug: string }) => ({ value: p.id, label: `${p.title} (/${p.slug})` })),
                    ]}
                  />
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  setAddLabel("");
                  setAddUrl("");
                  setAddParentId("");
                  setAddSortOrder(items.length);
                  setIsAddModalOpen(true);
                }}
                className="flex items-center gap-1.5 rounded-lg bg-[#E31E24] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all shadow-sm"
              >
                <Plus size={14} /> Add Menu Item
              </button>
            </div>
          </div>

          {/* Tabular Menu Items */}
          <DataTable columns={columns} data={filteredItems} rowKey="id" emptyMessage="No menu items found for this menu." />
        </div>
      )}

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Add Menu Item</h3>
              <button onClick={() => setIsAddModalOpen(false)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <AdminInput label="Item Label *" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="e.g. Metal Brackets" />
              <AdminInput label="URL / Slug Target *" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="/products?category=metal-brackets" />
              <AdminSelect label="Parent Menu (Column Group)" value={addParentId} onChange={(e) => setAddParentId(e.target.value)} options={parentOptions} />
              <div className="grid grid-cols-2 gap-3">
                <AdminInput label="Sort Order" type="number" value={String(addSortOrder)} onChange={(e) => setAddSortOrder(Number(e.target.value || 0))} />
                <AdminSelect
                  label="Open in New Tab"
                  value={addOpenInNewTab}
                  onChange={(e) => setAddOpenInNewTab(e.target.value)}
                  options={[
                    { value: "false", label: "No (Same Window)" },
                    { value: "true", label: "Yes (New Tab)" },
                  ]}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E6E6]">
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={addItem}
                className="rounded-md bg-[#E31E24] px-5 py-2 text-xs font-semibold text-white hover:bg-[#B5151B]"
              >
                Create Item
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Item Modal */}
      {editingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Edit Menu Item</h3>
              <button onClick={() => setEditingItem(null)} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <AdminInput
                label="Item Label *"
                value={editingItem.label}
                onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
              />
              <AdminInput
                label="URL / Slug Target *"
                value={editingItem.url}
                onChange={(e) => setEditingItem({ ...editingItem, url: e.target.value })}
              />
              <AdminSelect
                label="Parent Menu (Column Group)"
                value={editingItem.parentId ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem, parentId: e.target.value || null })}
                options={[{ value: "", label: "No Parent (Top-Level Column)" }].concat(
                  sortedItems
                    .filter((candidate) => candidate.id !== editingItem.id)
                    .map((candidate) => ({ value: candidate.id, label: candidate.label })),
                )}
              />
              <div className="grid grid-cols-3 gap-3">
                <AdminInput
                  label="Sort Order"
                  type="number"
                  value={String(editingItem.sortOrder)}
                  onChange={(e) => setEditingItem({ ...editingItem, sortOrder: Number(e.target.value || 0) })}
                />
                <AdminSelect
                  label="Status"
                  value={editingItem.status ?? "ACTIVE"}
                  onChange={(e) => setEditingItem({ ...editingItem, status: e.target.value })}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                <AdminSelect
                  label="New Tab"
                  value={editingItem.openInNewTab ? "true" : "false"}
                  onChange={(e) => setEditingItem({ ...editingItem, openInNewTab: e.target.value === "true" })}
                  options={[
                    { value: "false", label: "No" },
                    { value: "true", label: "Yes" },
                  ]}
                />
              </div>

              {languages.length > 0 && (
                <div className="pt-3 border-t border-[#E6E6E6] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A]">Multi-Language Translations</p>
                  <div className="grid gap-2 md:grid-cols-2">
                    {languages.map((language) => (
                      <AdminTextarea
                        key={language.id}
                        label={`${language.name} (${language.code})`}
                        defaultValue={translationValue(editingItem.translations, "label", language.id)}
                        rows={1}
                        onBlur={(e) => saveItemTranslation(editingItem.id, language.id, e.target.value)}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E6E6]">
              <button
                type="button"
                onClick={() => setEditingItem(null)}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => saveItem(editingItem)}
                className="rounded-md bg-[#E31E24] px-5 py-2 text-xs font-semibold text-white hover:bg-[#B5151B]"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal open={!!deleteItemId} title="Remove item" message="Are you sure you want to remove this menu item?" onConfirm={removeItem} onCancel={() => setDeleteItemId(null)} danger />
    </div>
  );
}

export default function CmsMenusPage() {
  const { data: menus, isLoading, refetch } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const { data: categories = [] } = useAdminCategories();
  const { data: cmsPagesResponse } = useAdminCmsPages();
  const cmsPages = cmsPagesResponse?.data ?? [];
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState<string>(CMS_MENU_LOCATIONS[0].value);
  const { showToast } = useToast();

  async function createMenu() {
    if (!newName.trim()) {
      showToast("Name is required.", "error");
      return;
    }

    try {
      await adminApi.post("/cms/menus", { name: newName.trim(), location: newLocation, status: "ACTIVE" });
      showToast("Menu created.", "success");
      setCreating(false);
      setNewName("");
      setNewLocation(CMS_MENU_LOCATIONS[0].value);
      refetch();
    } catch {
      showToast("Failed to create menu.", "error");
    }
  }

  const menuList: Menu[] = (menus as Menu[]) ?? [];

  return (
    <AdminLayout title="Menus" breadcrumb={[{ label: "Content" }, { label: "Menus" }]}>
      <div className="mb-5 flex items-center justify-between">
        <div>
          <h2 className="text-[17px] font-bold text-[#1A1A1A]">Header & Navigation Menus</h2>
          <p className="text-xs text-[#6B6B6B]">Manage storefront header mega menus, capabilities, primary links, and footer columns in a clean tabular view.</p>
        </div>
        <button onClick={() => setCreating((value) => !value)} className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all shadow-sm">
          <Plus size={14} />
          New Menu Location
        </button>
      </div>

      {creating && (
        <div className="mb-5 grid items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_1fr_auto_auto]">
          <AdminInput label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Footer About Column" />
          <AdminSelect
            label="Location"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            options={CMS_MENU_LOCATIONS.map((option) => ({ value: option.value, label: option.label }))}
          />
          <button onClick={createMenu} className="mb-0.5 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B]">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="mb-0.5 rounded-lg border border-gray-200 px-4 py-2 text-xs hover:bg-white">
            Cancel
          </button>
        </div>
      )}

      {isLoading && <div className="py-12 text-center text-sm text-gray-500">Loading menu configurations...</div>}

      <div className="space-y-4">
        {menuList.map((menu) => (
          <MenuCard
            key={menu.id}
            menu={menu}
            languages={languages as Language[]}
            categories={categories}
            cmsPages={cmsPages}
            onDeleted={refetch}
            onUpdated={refetch}
          />
        ))}
      </div>
    </AdminLayout>
  );
}
