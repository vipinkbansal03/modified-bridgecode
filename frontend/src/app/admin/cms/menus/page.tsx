"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Plus, Save, Trash2 } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminCmsMenus, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
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

function MenuCard({ menu, languages, onDeleted, onUpdated }: { menu: Menu; languages: Language[]; onDeleted: () => void; onUpdated: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [menuName, setMenuName] = useState(menu.name);
  const [menuLocation, setMenuLocation] = useState(menu.location);
  const [menuStatus, setMenuStatus] = useState(menu.status ?? "ACTIVE");
  const [items, setItems] = useState<MenuItem[]>(menu.items.map(normalizeItem));
  const [addLabel, setAddLabel] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addParentId, setAddParentId] = useState("");
  const [addOpenInNewTab, setAddOpenInNewTab] = useState<string>("false");
  const [savingMenu, setSavingMenu] = useState(false);
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

  const parentOptions = [
    { value: "", label: "No parent" },
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
        sortOrder: items.length,
        status: "ACTIVE",
      });

      setItems((prev) => [...prev, normalizeItem(response.data.data)]);
      setAddLabel("");
      setAddUrl("");
      setAddParentId("");
      setAddOpenInNewTab("false");
      showToast("Item added.", "success");
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
      setSavingMenu(true);
      await adminApi.put(`/cms/menus/${menu.id}`, {
        name: menuName.trim(),
        location: menuLocation.trim(),
        status: menuStatus,
      });
      showToast("Menu saved.", "success");
      onUpdated();
    } catch {
      showToast("Failed to save menu.", "error");
    } finally {
      setSavingMenu(false);
    }
  }

  async function saveItem(itemId: string, nextItem: MenuItem) {
    try {
      const response = await adminApi.put(`/cms/menu-items/${itemId}`, {
        label: nextItem.label.trim(),
        url: nextItem.url.trim(),
        parentId: nextItem.parentId || null,
        sortOrder: nextItem.sortOrder,
        openInNewTab: Boolean(nextItem.openInNewTab),
        status: nextItem.status ?? "ACTIVE",
      });
      const saved = normalizeItem(response.data.data);
      setItems((prev) => prev.map((item) => (item.id === itemId ? saved : item)));
      showToast("Item saved.", "success");
      onUpdated();
    } catch {
      showToast("Failed to save item.", "error");
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

  async function deleteMenu() {
    try {
      await adminApi.delete(`/cms/menus/${menu.id}`);
      showToast("Menu deleted.", "success");
      onDeleted();
    } catch {
      showToast("Failed to delete menu.", "error");
    }
  }

  async function saveItemTranslation(itemId: string, languageId: string, value: string) {
    try {
      await adminApi.put(`/cms/translations/menuItem/${itemId}/${languageId}`, { label: value });
      showToast("Translation saved.", "success");
    } catch {
      showToast("Failed to save translation.", "error");
    }
  }

  function updateLocalItem(itemId: string, patch: Partial<MenuItem>) {
    setItems((prev) => prev.map((item) => (item.id === itemId ? normalizeItem({ ...item, ...patch }) : item)));
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200">
      <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-800">{menu.name}</span>
            <code className="rounded border border-gray-200 bg-white px-1.5 py-0.5 text-xs text-gray-500">{menu.location}</code>
            <span className="text-xs text-gray-400">{items.length} items</span>
          </div>
          <div className="flex gap-1">
            <button onClick={saveMenu} disabled={savingMenu} className="p-1.5 text-gray-400 hover:text-brand">
              <Save size={14} />
            </button>
            <button onClick={() => setExpanded((value) => !value)} className="p-1.5 text-gray-400 hover:text-gray-700">
              {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>
            <button onClick={deleteMenu} className="p-1.5 text-gray-400 hover:text-red-600">
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {expanded && (
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <AdminInput label="Menu Name" value={menuName} onChange={(e) => setMenuName(e.target.value)} />
            <AdminSelect
              label="Location"
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
          </div>
        )}
      </div>

      {expanded && (
        <div className="space-y-4 p-4">
          <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 p-4">
            <p className="mb-3 text-sm font-medium text-gray-700">Add item</p>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              <AdminInput label="Label" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="Menu item label" />
              <AdminInput label="URL" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="/about or https://..." />
              <AdminSelect label="Parent" value={addParentId} onChange={(e) => setAddParentId(e.target.value)} options={parentOptions} />
              <AdminSelect
                label="Open in New Tab"
                value={addOpenInNewTab}
                onChange={(e) => setAddOpenInNewTab(e.target.value)}
                options={[
                  { value: "false", label: "No" },
                  { value: "true", label: "Yes" },
                ]}
              />
              <div className="flex items-end">
                <button onClick={addItem} className="mb-0.5 w-full whitespace-nowrap rounded-lg bg-brand px-3 py-2 text-sm font-medium text-white hover:bg-brand/90">
                  <Plus size={13} className="mr-1 inline" />
                  Add Item
                </button>
              </div>
            </div>
            <p className="mt-2 text-xs text-gray-500">Leave URL blank for office/address rows that should render as plain text.</p>
          </div>

          <div className="space-y-3">
            {sortedItems.map((item) => {
              const childParentOptions = [{ value: "", label: "No parent" }].concat(
                sortedItems
                  .filter((candidate) => candidate.id !== item.id)
                  .map((candidate) => ({ value: candidate.id, label: candidate.label })),
              );

              return (
                <div key={item.id} className="rounded-lg bg-gray-50 px-3 py-3">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
                    <AdminInput
                      label="Label"
                      value={item.label}
                      onChange={(e) => updateLocalItem(item.id, { label: e.target.value })}
                    />
                    <AdminInput
                      label="URL"
                      value={item.url}
                      onChange={(e) => updateLocalItem(item.id, { url: e.target.value })}
                    />
                    <AdminSelect
                      label="Parent"
                      value={item.parentId ?? ""}
                      onChange={(e) => updateLocalItem(item.id, { parentId: e.target.value || null })}
                      options={childParentOptions}
                    />
                    <AdminInput
                      label="Sort Order"
                      type="number"
                      value={String(item.sortOrder)}
                      onChange={(e) => updateLocalItem(item.id, { sortOrder: Number(e.target.value || 0) })}
                    />
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-2">
                      <AdminSelect
                        label="New Tab"
                        value={item.openInNewTab ? "true" : "false"}
                        onChange={(e) => updateLocalItem(item.id, { openInNewTab: e.target.value === "true" })}
                        options={[
                          { value: "false", label: "No" },
                          { value: "true", label: "Yes" },
                        ]}
                      />
                      <AdminSelect
                        label="Status"
                        value={item.status ?? "ACTIVE"}
                        onChange={(e) => updateLocalItem(item.id, { status: e.target.value })}
                        options={[
                          { value: "ACTIVE", label: "Active" },
                          { value: "INACTIVE", label: "Inactive" },
                        ]}
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center justify-between gap-3">
                    <p className="text-xs text-gray-500">Use parent items for mega menu groups. Footer and office rows can stay parentless.</p>
                    <div className="flex gap-2">
                      <button onClick={() => saveItem(item.id, item)} className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-100">
                        Save Item
                      </button>
                      <button onClick={() => setDeleteItemId(item.id)} className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                        Delete
                      </button>
                    </div>
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
              );
            })}
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
      {/* <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Header navigation, footer columns, office info, and legal links are all controlled here by menu location.
      </div> */}

      <div className="mb-5 flex items-center justify-between">
        <p className="text-sm text-gray-500">{menuList.length} menu{menuList.length !== 1 ? "s" : ""}</p>
        <button onClick={() => setCreating((value) => !value)} className="flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
          <Plus size={15} />
          New Menu
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
          <button onClick={createMenu} className="mb-0.5 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand/90">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="mb-0.5 rounded-lg border border-gray-200 px-4 py-2 text-sm hover:bg-white">
            Cancel
          </button>
        </div>
      )}

      {isLoading && <div className="text-sm text-gray-500">Loading...</div>}

      <div className="space-y-4">
        {menuList.map((menu) => (
          <MenuCard key={menu.id} menu={menu} languages={languages as Language[]} onDeleted={refetch} onUpdated={refetch} />
        ))}
      </div>
    </AdminLayout>
  );
}
