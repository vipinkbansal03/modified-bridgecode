"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Search, ArrowUp, ArrowDown, Globe, Link2, FolderTree, ExternalLink, X, Settings, ChevronRight } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, DataTable, type Column, useToast } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminCategories, useAdminCmsMenus, useAdminCmsPages, useAdminLanguages } from "@/hooks/admin/useAdminHooks";
import { CMS_MENU_LOCATIONS, type CmsMenuCategoryGroup } from "@/lib/cmsNavigation";
import { adminApi } from "@/services/adminApi";
import { cn } from "@/utils/cn";

type CmsTranslations = Record<string, Array<{ languageId: string; value: string }>>;
type Language = { id: string; name: string; code: string; isDefault?: boolean; isEnabled?: boolean };

const NAV_LABEL_KEYS: Record<string, string> = {
  Products: "ui.nav.products",
  "Quality Certifications": "ui.nav.qualityCertifications",
  "Contact Us": "ui.nav.contactUs",
  "Design & Engineering": "ui.nav.designEngineering",
  "Manufacturing Services": "ui.nav.manufacturingServices",
  "OEM Services": "ui.nav.oemServices",
  "Custom Packaging": "ui.nav.customPackaging",
  "Become a Dealer": "ui.nav.becomeDealer",
  "Quick Order": "ui.nav.quickOrder",
};
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

export default function CmsMenusPage() {
  const { data: menus, isLoading, refetch } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const activeTranslationLanguages = useMemo(() => {
    return (languages as Language[]).filter((lang) => lang.isEnabled && !lang.isDefault);
  }, [languages]);
  const { data: categories = [] } = useAdminCategories();
  const { data: cmsPagesResponse } = useAdminCmsPages();
  const cmsPages = cmsPagesResponse?.data ?? [];

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("ALL");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState<string>(CMS_MENU_LOCATIONS[0].value);

  // Active Menu Item Management State
  const [itemsSearchQuery, setItemsSearchQuery] = useState("");
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<MenuItem | null>(null);
  const [deleteItemId, setDeleteItemId] = useState<string | null>(null);
  const [editingMenuSettings, setEditingMenuSettings] = useState(false);

  // Add Item State
  const [addLabel, setAddLabel] = useState("");
  const [addUrl, setAddUrl] = useState("");
  const [addParentId, setAddParentId] = useState("");
  const [addOpenInNewTab, setAddOpenInNewTab] = useState<string>("false");
  const [addSortOrder, setAddSortOrder] = useState<number>(0);
  const [selectedTranslationLangId, setSelectedTranslationLangId] = useState<string>("");
  const [addTranslations, setAddTranslations] = useState<Record<string, string>>({});
  const [activeTranslationValue, setActiveTranslationValue] = useState<string>("");
  const [loadingTranslation, setLoadingTranslation] = useState<boolean>(false);

  const { showToast } = useToast();

  const menuList: Menu[] = useMemo(() => (menus as Menu[]) ?? [], [menus]);

  // Set default selected menu on load
  useEffect(() => {
    if (menuList.length > 0 && (!selectedMenuId || !menuList.some((m) => m.id === selectedMenuId))) {
      setSelectedMenuId(menuList[0].id);
    }
  }, [menuList, selectedMenuId]);

  const activeMenu = useMemo(
    () => menuList.find((m) => m.id === selectedMenuId) || menuList[0] || null,
    [menuList, selectedMenuId]
  );

  const [menuName, setMenuName] = useState("");
  const [menuLocation, setMenuLocation] = useState("");
  const [menuStatus, setMenuStatus] = useState("ACTIVE");
  const [items, setItems] = useState<MenuItem[]>([]);

  const activeLangId = selectedTranslationLangId || (activeTranslationLanguages[0]?.id ?? "");

  useEffect(() => {
    if (!editingItem || !activeLangId) {
      setActiveTranslationValue("");
      return;
    }

    const staticKey = NAV_LABEL_KEYS[editingItem.label];
    if (staticKey) {
      setLoadingTranslation(true);
      adminApi
        .get("/translations/keywords", { params: { languageId: activeLangId } })
        .then((res) => {
          const rows = res.data.data || [];
          const match = rows.find((r: any) => r.key === staticKey);
          setActiveTranslationValue(match?.value ?? "");
        })
        .catch(() => {
          setActiveTranslationValue("");
        })
        .finally(() => {
          setLoadingTranslation(false);
        });
    } else {
      setActiveTranslationValue(translationValue(editingItem.translations, "label", activeLangId));
      setLoadingTranslation(false);
    }
  }, [editingItem, activeLangId]);

  useEffect(() => {
    if (activeMenu) {
      setMenuName(activeMenu.name);
      setMenuLocation(activeMenu.location);
      setMenuStatus(activeMenu.status ?? "ACTIVE");
      setItems(activeMenu.items.map(normalizeItem));
    }
  }, [activeMenu]);

  const activeLocationMeta = useMemo(
    () => (activeMenu ? CMS_MENU_LOCATIONS.find((loc) => loc.value === activeMenu.location) : null),
    [activeMenu]
  );

  const sortedItems = useMemo(
    () => items.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label)),
    [items]
  );

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    if (!itemsSearchQuery.trim()) return sortedItems;
    const q = itemsSearchQuery.toLowerCase().trim();
    return sortedItems.filter(
      (item) => item.label.toLowerCase().includes(q) || item.url.toLowerCase().includes(q)
    );
  }, [sortedItems, itemsSearchQuery]);

  const parentOptions = useMemo(
    () => [
      { value: "", label: "No Parent (Top-Level Link / Column)" },
      ...sortedItems.map((item) => ({ value: item.id, label: item.label })),
    ],
    [sortedItems]
  );

  // Grouped Menu Tabs for Sidebar
  const filteredLocationTabs = useMemo(() => {
    if (activeGroupFilter === "ALL") return menuList;
    return menuList.filter((m) => {
      const g = CMS_MENU_LOCATIONS.find((loc) => loc.value === m.location)?.group;
      return g === activeGroupFilter;
    });
  }, [menuList, activeGroupFilter]);

  // Keep selected tab in view when filter changes
  useEffect(() => {
    if (filteredLocationTabs.length > 0 && !filteredLocationTabs.some((m) => m.id === selectedMenuId)) {
      setSelectedMenuId(filteredLocationTabs[0].id);
    }
  }, [filteredLocationTabs, selectedMenuId]);

  const groupCounts = useMemo(() => {
    const header = menuList.filter((m) => CMS_MENU_LOCATIONS.find((l) => l.value === m.location)?.group === "header").length;
    const footer = menuList.filter((m) => CMS_MENU_LOCATIONS.find((l) => l.value === m.location)?.group === "footer").length;
    const offices = menuList.filter((m) => CMS_MENU_LOCATIONS.find((l) => l.value === m.location)?.group === "offices_legal").length;
    return { all: menuList.length, header, footer, offices };
  }, [menuList]);

  async function createMenu() {
    if (!newName.trim()) {
      showToast("Name is required.", "error");
      return;
    }

    try {
      const response = await adminApi.post("/cms/menus", { name: newName.trim(), location: newLocation, status: "ACTIVE" });
      showToast("Menu created.", "success");
      setCreating(false);
      setNewName("");
      setNewLocation(CMS_MENU_LOCATIONS[0].value);
      if (response.data.data?.id) setSelectedMenuId(response.data.data.id);
      refetch();
    } catch {
      showToast("Failed to create menu.", "error");
    }
  }

  async function saveMenuSettings() {
    if (!activeMenu || !menuName.trim() || !menuLocation.trim()) {
      showToast("Name and location key are required.", "error");
      return;
    }

    try {
      await adminApi.put(`/cms/menus/${activeMenu.id}`, {
        name: menuName.trim(),
        location: menuLocation.trim(),
        status: menuStatus,
      });
      showToast("Menu settings saved.", "success");
      setEditingMenuSettings(false);
      refetch();
    } catch {
      showToast("Failed to save menu settings.", "error");
    }
  }

  async function addItem() {
    if (!activeMenu || !addLabel.trim()) {
      showToast("Label is required.", "error");
      return;
    }

    try {
      const response = await adminApi.post(`/cms/menus/${activeMenu.id}/items`, {
        label: addLabel.trim(),
        url: addUrl.trim(),
        parentId: addParentId || undefined,
        openInNewTab: addOpenInNewTab === "true",
        sortOrder: addSortOrder || items.length,
        status: "ACTIVE",
      });

      const createdItem = response.data.data;
      const translationPromises = Object.entries(addTranslations)
        .filter(([_, val]) => val.trim().length > 0)
        .map(([langId, val]) => {
          const staticKey = NAV_LABEL_KEYS[addLabel];
          if (staticKey) {
            return adminApi.put("/translations/keywords", {
              key: staticKey,
              languageId: langId,
              value: val.trim(),
            });
          } else {
            return adminApi.put(`/cms/translations/menuItem/${createdItem.id}/${langId}`, {
              label: val.trim(),
            });
          }
        });

      try {
        if (translationPromises.length > 0) {
          await Promise.all(translationPromises);
        }
      } catch {
        showToast("Menu item added, but failed to save translations.", "error");
      }

      setItems((prev) => [...prev, normalizeItem(createdItem)]);
      setAddLabel("");
      setAddUrl("");
      setAddParentId("");
      setAddOpenInNewTab("false");
      setAddTranslations({});
      setIsAddModalOpen(false);
      showToast("Menu item added.", "success");
      refetch();
    } catch {
      showToast("Failed to add menu item.", "error");
    }
  }

  const closeEditModal = () => {
    setEditingItem(null);
    setSelectedTranslationLangId("");
    setActiveTranslationValue("");
  };

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
      closeEditModal();
      showToast("Menu item updated.", "success");
      refetch();
    } catch {
      showToast("Failed to update menu item.", "error");
    }
  }

  async function moveItem(index: number, direction: "up" | "down") {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= sortedItems.length) return;

    const currentItem = sortedItems[index];
    const targetItem = sortedItems[targetIndex];

    const currentSort = currentItem.sortOrder;
    const targetSort = targetItem.sortOrder;

    const newCurrentSort = targetSort === currentSort ? currentSort + (direction === "up" ? -1 : 1) : targetSort;
    const newTargetSort = currentSort;

    try {
      await Promise.all([
        adminApi.put(`/cms/menu-items/${currentItem.id}`, {
          label: currentItem.label,
          url: currentItem.url,
          parentId: currentItem.parentId || null,
          sortOrder: newCurrentSort,
          openInNewTab: Boolean(currentItem.openInNewTab),
          status: currentItem.status ?? "ACTIVE",
        }),
        adminApi.put(`/cms/menu-items/${targetItem.id}`, {
          label: targetItem.label,
          url: targetItem.url,
          parentId: targetItem.parentId || null,
          sortOrder: newTargetSort,
          openInNewTab: Boolean(targetItem.openInNewTab),
          status: targetItem.status ?? "ACTIVE",
        }),
      ]);
      showToast("Item order updated.", "success");
      refetch();
    } catch {
      showToast("Failed to update item order.", "error");
    }
  }

  async function saveItemTranslation(itemId: string, languageId: string, value: string) {
    try {
      const itemLabel = editingItem?.id === itemId ? editingItem.label : (items.find((i) => i.id === itemId)?.label ?? "");
      const staticKey = NAV_LABEL_KEYS[itemLabel];

      const promises = [];
      if (staticKey) {
        promises.push(
          adminApi.put("/translations/keywords", {
            key: staticKey,
            languageId,
            value: value.trim(),
          })
        );
      } else {
        promises.push(
          adminApi.put(`/cms/translations/menuItem/${itemId}/${languageId}`, {
            label: value,
          })
        );
      }

      await Promise.all(promises);
      showToast("Translation saved.", "success");
      refetch();
    } catch {
      showToast("Failed to save translation.", "error");
    }
  }

  async function removeItem() {
    if (!deleteItemId) return;

    try {
      await adminApi.delete(`/cms/menu-items/${deleteItemId}`);
      setItems((prev) => prev.filter((item) => item.id !== deleteItemId));
      showToast("Menu item removed.", "success");
      refetch();
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
              <span className="font-mono text-xs text-[#9A9A9A] pl-3">└─</span>
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
      label: "Target Link / URL",
      render: (row) => (
        <div className="flex items-center gap-1.5 font-mono text-[12px] text-[#555]">
          <Link2 size={12} className="text-[#9A9A9A] shrink-0" />
          <span className="truncate max-w-[280px]">{row.url || "—"}</span>
          {row.openInNewTab && <ExternalLink size={11} className="text-[#9A9A9A] shrink-0" />}
        </div>
      ),
    },
    {
      key: "sortOrder",
      label: "Order",
      width: "130px",
      render: (row) => {
        const itemIdx = sortedItems.findIndex((i) => i.id === row.id);
        return (
          <div className="flex items-center gap-1.5">
            <span className="inline-flex rounded border border-[#E6E6E6] bg-[#F8F8F8] px-2 py-0.5 font-mono text-[11.5px] font-semibold text-[#1A1A1A]">
              #{row.sortOrder}
            </span>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                disabled={itemIdx === 0}
                onClick={() => moveItem(itemIdx, "up")}
                className="flex h-6 w-6 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] disabled:opacity-30 disabled:hover:bg-white transition-colors"
                title="Move item up"
              >
                <ArrowUp size={11} />
              </button>
              <button
                type="button"
                disabled={itemIdx === sortedItems.length - 1}
                onClick={() => moveItem(itemIdx, "down")}
                className="flex h-6 w-6 items-center justify-center rounded border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:bg-[#F5F5F5] hover:text-[#1A1A1A] disabled:opacity-30 disabled:hover:bg-white transition-colors"
                title="Move item down"
              >
                <ArrowDown size={11} />
              </button>
            </div>
          </div>
        );
      },
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
      width: "110px",
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
    <AdminLayout title="Menus" breadcrumb={[{ label: "Content" }, { label: "Menus" }]}>
      {/* Header */}
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-[17px] font-bold text-[#1A1A1A]">Header & Footer Navigation Menus</h2>
          <p className="text-xs text-[#6B6B6B]">Select a menu location tab from the left sidebar to view and manage its items.</p>
        </div>
        <button
          onClick={() => setCreating((value) => !value)}
          className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all shadow-xs"
        >
          <Plus size={14} />
          New Menu Location
        </button>
      </div>

      {/* Social Media Quick-Access Notice Banner */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-blue-200/80 bg-blue-50/60 px-4 py-2.5 text-[12.5px] text-blue-900">
        <div className="flex items-center gap-2">
          <Globe size={15} className="text-blue-600 shrink-0" />
          <span>
            <strong>Social Media Links:</strong> Footer social links are managed under{" "}
            <a href="/admin/cms/footer" className="font-semibold text-blue-800 underline hover:text-blue-950">
              CMS → Footer
            </a>
            .
          </span>
        </div>
        <a
          href="/admin/cms/footer"
          className="shrink-0 font-semibold text-blue-700 hover:text-blue-900 text-xs hover:underline"
        >
          Manage Social Links →
        </a>
      </div>

      {creating && (
        <div className="mb-5 grid items-end gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4 md:grid-cols-[1fr_1fr_auto_auto]">
          <AdminInput label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Footer About Column" />
          <AdminSelect
            label="Location"
            value={newLocation}
            onChange={(e) => setNewLocation(e.target.value)}
            options={CMS_MENU_LOCATIONS.map((option) => ({ value: option.value, label: `${option.label} (${option.value})` }))}
          />
          <button onClick={createMenu} className="mb-0.5 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B]">
            Create
          </button>
          <button onClick={() => setCreating(false)} className="mb-0.5 rounded-lg border border-gray-200 px-4 py-2 text-xs hover:bg-white">
            Cancel
          </button>
        </div>
      )}

      {/* Vertical Sidebar Sub-Tabs Layout */}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
        {/* Sidebar Sub-Tabs Panel */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-3 space-y-3 shadow-2xs">
          {/* Top Group Category Filter Pills */}
          <div className="flex flex-wrap items-center gap-1 border-b border-[#E6E6E6] pb-2.5">
            <button
              type="button"
              onClick={() => setActiveGroupFilter("ALL")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                activeGroupFilter === "ALL" ? "bg-[#1A1A1A] text-white" : "bg-[#F2F2F2] text-[#6B6B6B] hover:bg-[#E6E6E6]"
              )}
            >
              All ({groupCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupFilter("header")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                activeGroupFilter === "header" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              Header ({groupCounts.header})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupFilter("footer")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                activeGroupFilter === "footer" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              )}
            >
              Footer ({groupCounts.footer})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupFilter("offices_legal")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors flex items-center gap-1",
                activeGroupFilter === "offices_legal" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              )}
            >
              Offices ({groupCounts.offices})
            </button>
          </div>

          {/* Vertical Menu Location Sub-Tabs List */}
          {isLoading ? (
            <div className="py-6 text-center text-xs text-[#9A9A9A]">Loading tabs...</div>
          ) : (
            <div className="space-y-1 max-h-[70vh] overflow-y-auto pr-0.5">
              {filteredLocationTabs.map((tabMenu) => {
                const isSelected = tabMenu.id === selectedMenuId;
                return (
                  <button
                    key={tabMenu.id}
                    type="button"
                    onClick={() => {
                      setSelectedMenuId(tabMenu.id);
                      setEditingMenuSettings(false);
                    }}
                    className={cn(
                      "w-full text-left rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all flex items-center justify-between gap-2 border",
                      isSelected
                        ? "bg-[#E31E24] text-white border-[#E31E24] font-semibold shadow-2xs"
                        : "bg-transparent text-[#1A1A1A] border-transparent hover:bg-[#F5F5F5]"
                    )}
                  >
                    <span className="truncate">{tabMenu.name}</span>
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 font-mono text-[10.5px] font-bold shrink-0",
                        isSelected ? "bg-white/25 text-white" : "bg-[#EFEFEF] text-[#6B6B6B]"
                      )}
                    >
                      {tabMenu.items.length}
                    </span>
                  </button>
                );
              })}

              {filteredLocationTabs.length === 0 && (
                <div className="py-6 text-center text-xs text-[#9A9A9A]">No tabs found.</div>
              )}
            </div>
          )}
        </div>

        {/* Main View Area: Full Width Selected Menu Workspace */}
        {activeMenu ? (
          <div className="space-y-5">
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-6 shadow-xs">
              {/* Header Details */}
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E6E6E6] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[18px] font-bold text-[#1A1A1A]">{activeMenu.name}</h3>
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${
                        activeMenu.status === "ACTIVE"
                          ? "border border-green-200 bg-green-50 text-green-700"
                          : "border border-gray-200 bg-gray-50 text-gray-500"
                      }`}
                    >
                      {activeMenu.status ?? "ACTIVE"}
                    </span>
                  </div>
                  {activeLocationMeta?.description && (
                    <p className="mt-1 text-[13px] text-[#6B6B6B]">{activeLocationMeta.description}</p>
                  )}
                  <div className="mt-2 flex items-center gap-2 text-xs text-[#9A9A9A]">
                    <span className="font-mono text-[11px] text-[#9A9A9A]">Key: {activeMenu.location}</span>
                    <span>•</span>
                    <span className="font-semibold text-[#1A1A1A]">{items.length} item{items.length === 1 ? "" : "s"} configured</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setEditingMenuSettings((prev) => !prev)}
                  className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] transition-colors"
                >
                  <Settings size={13} />
                  {editingMenuSettings ? "Hide Settings" : "Edit Menu Settings"}
                </button>
              </div>

              {/* Inline Menu Settings Editor */}
              {editingMenuSettings && (
                <div className="mt-4 grid gap-3 rounded-lg border border-[#E6E6E6] bg-[#FDFDFD] p-4 md:grid-cols-[1fr_1fr_120px_auto]">
                  <AdminInput label="Menu Display Name" value={menuName} onChange={(e) => setMenuName(e.target.value)} />
                  <AdminSelect
                    label="Location Key"
                    value={menuLocation}
                    onChange={(e) => setMenuLocation(e.target.value)}
                    options={CMS_MENU_LOCATIONS.map((option) => ({ value: option.value, label: `${option.label} (${option.value})` }))}
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
                      onClick={saveMenuSettings}
                      className="w-full rounded-md bg-[#E31E24] py-2 px-4 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all"
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              )}

              {/* Action Toolbar */}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative w-full sm:max-w-xs">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                  <input
                    type="text"
                    placeholder="Search menu items..."
                    value={itemsSearchQuery}
                    onChange={(e) => setItemsSearchQuery(e.target.value)}
                    className="w-full rounded-lg border border-[#E6E6E6] bg-white py-1.5 pl-8 pr-3 text-xs text-[#1A1A1A] outline-none focus:border-[#E31E24]"
                  />
                </div>

                <div className="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto">
                  {categories.length > 0 && (
                    <div className="w-full sm:w-48">
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
                          { value: "", label: "⚡ Pick Category..." },
                          ...categories.map((c: { id: string; name: string }) => ({ value: c.id, label: c.name })),
                        ]}
                      />
                    </div>
                  )}
                  {cmsPages.length > 0 && (
                    <div className="w-full sm:w-48">
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
                          { value: "", label: "⚡ Pick CMS Page..." },
                          ...cmsPages.map((p: { id: string; title: string; slug: string }) => ({ value: p.id, label: p.title })),
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
                    className="flex w-full sm:w-auto items-center justify-center gap-1.5 rounded-lg bg-[#E31E24] px-4 py-2.5 sm:py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all shadow-xs"
                  >
                    <Plus size={14} /> Add Menu Item
                  </button>
                </div>
              </div>

              {/* Menu Items Table */}
              <div className="mt-4">
                <DataTable columns={columns} data={filteredItems} rowKey="id" emptyMessage="No menu items configured for this location." />
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-white p-12 text-center text-sm text-[#6B6B6B]">
            No menu location selected.
          </div>
        )}
      </div>

      {/* Add Item Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl bg-white p-6 shadow-xl space-y-4">
            <div className="flex items-center justify-between border-b border-[#E6E6E6] pb-3">
              <h3 className="text-[15px] font-bold text-[#1A1A1A]">Add Menu Item</h3>
              <button onClick={() => { setIsAddModalOpen(false); setAddTranslations({}); }} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <AdminInput label="Item Label" value={addLabel} onChange={(e) => setAddLabel(e.target.value)} placeholder="e.g. Metal Brackets" />
              <AdminInput label="URL / Target Link" value={addUrl} onChange={(e) => setAddUrl(e.target.value)} placeholder="/products?category=metal-brackets" />
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

              {activeTranslationLanguages.length > 0 && (
                <div className="pt-3 border-t border-[#E6E6E6] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A]">Multi-Language Translations</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <AdminSelect
                        label="Select Language to Translate"
                        value={selectedTranslationLangId || (activeTranslationLanguages[0]?.id ?? "")}
                        onChange={(e) => setSelectedTranslationLangId(e.target.value)}
                        options={activeTranslationLanguages.map((lang: Language) => ({
                          value: lang.id,
                          label: `${lang.name} (${lang.code})`,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="pt-1">
                    {(() => {
                      const activeLangId = selectedTranslationLangId || (activeTranslationLanguages[0]?.id ?? "");
                      const activeLang = activeTranslationLanguages.find((l: Language) => l.id === activeLangId);
                      return activeLang ? (
                        <AdminTextarea
                          key={activeLangId}
                          label={`Translation Value for ${activeLang.name}`}
                          value={addTranslations[activeLangId] ?? ""}
                          onChange={(e) => setAddTranslations((prev) => ({ ...prev, [activeLangId]: e.target.value }))}
                          rows={1}
                          placeholder={`Enter translation for ${addLabel || "Item"}...`}
                        />
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E6E6]">
              <button
                type="button"
                onClick={() => { setIsAddModalOpen(false); setAddTranslations({}); }}
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
              <button onClick={closeEditModal} className="text-[#9A9A9A] hover:text-[#1A1A1A]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <AdminInput
                label="Item Label"
                value={editingItem.label}
                onChange={(e) => setEditingItem({ ...editingItem, label: e.target.value })}
              />
              <AdminInput
                label="URL / Target Link"
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

              {activeTranslationLanguages.length > 0 && (
                <div className="pt-3 border-t border-[#E6E6E6] space-y-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-[#9A9A9A]">Multi-Language Translations</p>
                  <div className="flex items-center gap-3">
                    <div className="flex-1">
                      <AdminSelect
                        label="Select Language to Translate"
                        value={selectedTranslationLangId || (activeTranslationLanguages[0]?.id ?? "")}
                        onChange={(e) => setSelectedTranslationLangId(e.target.value)}
                        options={activeTranslationLanguages.map((lang: Language) => ({
                          value: lang.id,
                          label: `${lang.name} (${lang.code})`,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="pt-1">
                    {(() => {
                      const activeLangId = selectedTranslationLangId || (activeTranslationLanguages[0]?.id ?? "");
                      const activeLang = activeTranslationLanguages.find((l: Language) => l.id === activeLangId);
                      return activeLang ? (
                        <AdminTextarea
                          key={activeLangId}
                          label={`Translation Value for ${activeLang.name}`}
                          value={loadingTranslation ? "" : activeTranslationValue}
                          onChange={(e) => setActiveTranslationValue(e.target.value)}
                          rows={1}
                          onBlur={(e) => saveItemTranslation(editingItem.id, activeLangId, e.target.value)}
                          placeholder={loadingTranslation ? "Loading translation..." : `Enter translation for ${editingItem.label}...`}
                          disabled={loadingTranslation}
                        />
                      ) : null;
                    })()}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#E6E6E6]">
              <button
                type="button"
                onClick={closeEditModal}
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
    </AdminLayout>
  );
}
