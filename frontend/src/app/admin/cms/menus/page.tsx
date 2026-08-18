"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Search, ArrowUp, ArrowDown, Globe, Link2, FolderTree, ExternalLink, X, Settings, GripVertical, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminCategories, useAdminCmsMenus, useAdminCmsPages, useAdminLanguages, useAdminCollections, useAdminBlogs, useAdminProducts } from "@/hooks/admin/useAdminHooks";
import { CMS_MENU_LOCATIONS } from "@/lib/cmsNavigation";
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

interface MenuItemWithChildren extends MenuItem {
  children: MenuItemWithChildren[];
}

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

// ─── Shopify-like Link Picker Input Component ─────────────────────────────
function LinkPickerInput({
  label,
  value,
  onChange,
  onSelectLink,
  categories,
  collections,
  cmsPages,
  blogs,
  products,
  placeholder = "Search or paste link"
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  onSelectLink: (url: string, label: string) => void;
  categories: any[];
  collections: any[];
  cmsPages: any[];
  blogs: any[];
  products: any[];
  placeholder?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [tab, setTab] = useState<"main" | "collections" | "categories" | "pages" | "blogs" | "products">("main");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest(".link-picker-container")) {
        setIsOpen(false);
        setTab("main");
      }
    };
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [isOpen]);

  const filteredCollections = collections.filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()));
  const filteredCategories = categories.filter(c => (c.name || "").toLowerCase().includes(search.toLowerCase()));
  const filteredPages = cmsPages.filter(p => (p.title || "").toLowerCase().includes(search.toLowerCase()));
  const filteredBlogs = blogs.filter(b => (b.name || "").toLowerCase().includes(search.toLowerCase()));
  const filteredProducts = products.filter(p => (p.title || "").toLowerCase().includes(search.toLowerCase()));

  return (
    <div className="relative link-picker-container w-full">
      <AdminInput
        label={label}
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          if (!isOpen) setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
      />
      {isOpen && (
        <div className="absolute left-0 right-0 z-[100] mt-1 max-h-64 overflow-y-auto rounded-lg border border-[#E6E6E6] bg-white shadow-xl flex flex-col">
          {tab !== "main" && (
            <div className="flex items-center gap-2 border-b border-[#E6E6E6] px-3 py-2 bg-gray-50/50">
              <button
                type="button"
                onClick={() => { setTab("main"); setSearch(""); }}
                className="text-[12px] font-semibold text-[#E31E24] hover:underline"
              >
                ← Back
              </button>
              <input
                type="text"
                placeholder="Search..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="flex-1 rounded border border-[#E6E6E6] px-2 py-0.5 text-xs outline-none focus:border-[#E31E24]"
                autoFocus
              />
            </div>
          )}
          <div className="divide-y divide-[#F0F0F0]">
            {tab === "main" && (
              <>
                <button
                  type="button"
                  onClick={() => { onSelectLink("/", "Home page"); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A]"
                >
                  🏠 Home page
                </button>
                <button
                  type="button"
                  onClick={() => { onSelectLink("/search", "Search"); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A]"
                >
                  🔍 Search page
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("products"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📦 Products</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("collections"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📂 Collections</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("categories"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📁 Categories</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("pages"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📄 CMS Pages</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onClick={() => { setTab("blogs"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📰 Blogs</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
              </>
            )}
            {tab === "products" && (
              <>
                <button
                  type="button"
                  onClick={() => { onSelectLink("/products", "All Products"); setIsOpen(false); setTab("main"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-bold text-gray-700"
                >
                  All Products
                </button>
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelectLink(`/products/${p.slug}`, p.title); setIsOpen(false); setTab("main"); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] text-gray-600 truncate"
                  >
                    {p.title}
                  </button>
                ))}
                {filteredProducts.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No products found.</div>
                )}
              </>
            )}
            {tab === "collections" && (
              <>
                {filteredCollections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onSelectLink(`/products?collection=${c.slug}`, c.name); setIsOpen(false); setTab("main"); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] text-gray-600"
                  >
                    {c.name}
                  </button>
                ))}
                {filteredCollections.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No collections found.</div>
                )}
              </>
            )}
            {tab === "categories" && (
              <>
                {filteredCategories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => { onSelectLink(`/products?category=${c.slug}`, c.name); setIsOpen(false); setTab("main"); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] text-gray-600"
                  >
                    {c.name}
                  </button>
                ))}
                {filteredCategories.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No categories found.</div>
                )}
              </>
            )}
            {tab === "pages" && (
              <>
                {filteredPages.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => { onSelectLink(`/${p.slug}`, p.title); setIsOpen(false); setTab("main"); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] text-gray-600"
                  >
                    {p.title}
                  </button>
                ))}
                {filteredPages.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No pages found.</div>
                )}
              </>
            )}
            {tab === "blogs" && (
              <>
                <button
                  type="button"
                  onClick={() => { onSelectLink("/blog", "Blog"); setIsOpen(false); setTab("main"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-bold text-gray-700"
                >
                  All Blogs
                </button>
                {filteredBlogs.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => { onSelectLink(`/blog/${b.slug}`, b.name); setIsOpen(false); setTab("main"); }}
                    className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] text-gray-600"
                  >
                    {b.name}
                  </button>
                ))}
                {filteredBlogs.length === 0 && (
                  <div className="px-3 py-2 text-xs text-gray-400">No blogs found.</div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Menus Management Page Component ──────────────────────────────────
export default function CmsMenusPage() {
  const { data: menus, isLoading, refetch } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const activeTranslationLanguages = useMemo(() => {
    return (languages as Language[]).filter((lang) => lang.isEnabled && !lang.isDefault);
  }, [languages]);
  
  const { data: categories = [] } = useAdminCategories();
  const { data: cmsPagesResponse } = useAdminCmsPages();
  const cmsPages = cmsPagesResponse?.data ?? [];
  const { data: collectionsResponse } = useAdminCollections({ limit: 200 });
  const collections = collectionsResponse?.data ?? [];
  const { data: blogsResponse } = useAdminBlogs({ limit: 200 });
  const blogs = blogsResponse?.data ?? [];
  const { data: productsResponse } = useAdminProducts({ limit: 200 });
  const products = productsResponse?.data?.items ?? productsResponse?.data ?? [];

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string>("ALL");
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLocation, setNewLocation] = useState<string>(CMS_MENU_LOCATIONS[0].value);

  // Unsaved State Management
  const [localItems, setLocalItems] = useState<MenuItem[]>([]);
  const [deletedItemIds, setDeletedItemIds] = useState<string[]>([]);
  const [unsavedChanges, setUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);

  // Bulk Selection States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"ENABLE" | "DISABLE" | "DELETE" | "">("");

  // Search & Edit Modal States
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

  // Synchronize local items when switching menus
  useEffect(() => {
    if (activeMenu) {
      setMenuName(activeMenu.name);
      setMenuLocation(activeMenu.location);
      setMenuStatus(activeMenu.status ?? "ACTIVE");
      setLocalItems(activeMenu.items.map(normalizeItem));
      setDeletedItemIds([]);
      setUnsavedChanges(false);
      setSelectedIds([]);
    }
  }, [activeMenu]);

  const activeLocationMeta = useMemo(
    () => (activeMenu ? CMS_MENU_LOCATIONS.find((loc) => loc.value === activeMenu.location) : null),
    [activeMenu]
  );

  // ─── Nested Hierarchy Sorting Logic ──────────────────────────────────────
  const treeItems = useMemo(() => {
    const buildTree = (flatItems: MenuItem[]): MenuItemWithChildren[] => {
      const itemMap = new Map<string, MenuItemWithChildren>();
      const roots: MenuItemWithChildren[] = [];

      flatItems.forEach((item) => {
        itemMap.set(item.id, { ...item, children: [] });
      });

      flatItems.forEach((item) => {
        const mapped = itemMap.get(item.id)!;
        if (item.parentId && itemMap.has(item.parentId)) {
          itemMap.get(item.parentId)!.children.push(mapped);
        } else {
          roots.push(mapped);
        }
      });

      const sortTree = (list: MenuItemWithChildren[]) => {
        list.sort((a, b) => a.sortOrder - b.sortOrder);
        list.forEach((item) => sortTree(item.children));
      };
      sortTree(roots);
      return roots;
    };

    const flattenTree = (
      tree: MenuItemWithChildren[],
      depth = 0
    ): Array<{ item: MenuItem; depth: number }> => {
      const result: Array<{ item: MenuItem; depth: number }> = [];
      const traverse = (list: MenuItemWithChildren[], d: number) => {
        list.forEach((node) => {
          const { children, ...item } = node;
          result.push({ item, depth: d });
          traverse(children, d + 1);
        });
      };
      traverse(tree, depth);
      return result;
    };

    const tree = buildTree(localItems);
    return flattenTree(tree);
  }, [localItems]);

  const filteredTreeItems = useMemo(() => {
    if (!itemsSearchQuery.trim()) return treeItems;
    const q = itemsSearchQuery.toLowerCase().trim();
    return treeItems.filter(
      (node) =>
        node.item.label.toLowerCase().includes(q) ||
        node.item.url.toLowerCase().includes(q)
    );
  }, [treeItems, itemsSearchQuery]);

  const parentMap = useMemo(() => {
    const map = new Map<string, string>();
    localItems.forEach((item) => map.set(item.id, item.label));
    return map;
  }, [localItems]);

  const parentOptions = useMemo(
    () => [
      { value: "", label: "No Parent (Top-Level Link / Column)" },
      ...localItems.map((item) => ({ value: item.id, label: item.label })),
    ],
    [localItems]
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

  // Create Menu location
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

  // Update Location Settings
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

  // Add Item to Local State
  function addItem() {
    if (!addLabel.trim()) {
      showToast("Label is required.", "error");
      return;
    }

    const tempId = `temp-${Date.now()}`;
    const newItem: MenuItem = {
      id: tempId,
      label: addLabel.trim(),
      url: addUrl.trim(),
      parentId: addParentId || null,
      openInNewTab: addOpenInNewTab === "true",
      sortOrder: addSortOrder || localItems.length,
      status: "ACTIVE",
    };

    setLocalItems((prev) => [...prev, newItem]);
    setUnsavedChanges(true);
    setIsAddModalOpen(false);

    // Reset fields
    setAddLabel("");
    setAddUrl("");
    setAddParentId("");
    setAddOpenInNewTab("false");
    setAddTranslations({});
  }

  // Close editing modal
  const closeEditModal = () => {
    setEditingItem(null);
    setSelectedTranslationLangId("");
    setActiveTranslationValue("");
  };

  // Save Item Details to Local State
  function saveItem(nextItem: MenuItem) {
    setLocalItems((prev) =>
      prev.map((item) => (item.id === nextItem.id ? { ...nextItem } : item))
    );
    setUnsavedChanges(true);
    closeEditModal();
  }

  // Remove Item from Local State
  function removeItem() {
    if (!deleteItemId) return;
    if (!deleteItemId.startsWith("temp-")) {
      setDeletedItemIds((prev) => [...prev, deleteItemId]);
    }
    setLocalItems((prev) => prev.filter((item) => item.id !== deleteItemId));
    setUnsavedChanges(true);
    setDeleteItemId(null);
  }

  // Batch Save all local modifications to server
  async function saveMenuStructure() {
    if (!activeMenu) return;
    setSaving(true);
    try {
      // 1. Delete marked items
      for (const id of deletedItemIds) {
        await adminApi.delete(`/cms/menu-items/${id}`);
      }

      // To map temporary ids of parent items to new database ids
      const tempIdMap: Record<string, string> = {};

      // 2. Iterate and process creations and updates in index order
      for (const item of localItems) {
        // Resolve parent ID if it references a temp ID that was just created
        const parentId = item.parentId
          ? (tempIdMap[item.parentId] || (item.parentId.startsWith("temp-") ? null : item.parentId))
          : null;

        if (item.id.startsWith("temp-")) {
          // Create new record
          const response = await adminApi.post(`/cms/menus/${activeMenu.id}/items`, {
            label: item.label.trim(),
            url: item.url.trim(),
            parentId,
            openInNewTab: Boolean(item.openInNewTab),
            sortOrder: item.sortOrder,
            status: item.status || "ACTIVE",
          });
          const created = response.data.data;
          tempIdMap[item.id] = created.id;
        } else {
          // Update existing record
          await adminApi.put(`/cms/menu-items/${item.id}`, {
            label: item.label.trim(),
            url: item.url.trim(),
            parentId,
            openInNewTab: Boolean(item.openInNewTab),
            sortOrder: item.sortOrder,
            status: item.status || "ACTIVE",
          });
        }
      }

      showToast("Menu navigation saved successfully.", "success");
      setUnsavedChanges(false);
      setDeletedItemIds([]);
      setSelectedIds([]);
      refetch();
    } catch (error) {
      showToast("Failed to save menu changes.", "error");
    } finally {
      setSaving(false);
    }
  }

  // ─── Positional Reordering & Nesting Handlers ───────────────────────────
  const handleMoveUp = (itemId: string) => {
    const currentItem = localItems.find((i) => i.id === itemId);
    if (!currentItem) return;

    const siblings = localItems
      .filter((i) => i.parentId === currentItem.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx <= 0) return; // Already first sibling

    const prevSibling = siblings[idx - 1];
    const currentSort = currentItem.sortOrder;
    const prevSort = prevSibling.sortOrder;

    const targetSort = currentSort === prevSort ? currentSort - 1 : prevSort;

    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) return { ...item, sortOrder: targetSort };
        if (item.id === prevSibling.id) return { ...item, sortOrder: currentSort };
        return item;
      })
    );
    setUnsavedChanges(true);
  };

  const handleMoveDown = (itemId: string) => {
    const currentItem = localItems.find((i) => i.id === itemId);
    if (!currentItem) return;

    const siblings = localItems
      .filter((i) => i.parentId === currentItem.parentId)
      .sort((a, b) => a.sortOrder - b.sortOrder);

    const idx = siblings.findIndex((s) => s.id === itemId);
    if (idx < 0 || idx >= siblings.length - 1) return; // Already last sibling

    const nextSibling = siblings[idx + 1];
    const currentSort = currentItem.sortOrder;
    const nextSort = nextSibling.sortOrder;

    const targetSort = currentSort === nextSort ? currentSort + 1 : nextSort;

    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) return { ...item, sortOrder: targetSort };
        if (item.id === nextSibling.id) return { ...item, sortOrder: currentSort };
        return item;
      })
    );
    setUnsavedChanges(true);
  };

  const handleIndent = (itemId: string) => {
    const idx = treeItems.findIndex((node) => node.item.id === itemId);
    if (idx <= 0) return; // Cannot indent first item

    // Set parentId to the id of the previous item in flat tree listing
    const targetParent = treeItems[idx - 1].item;
    
    // Nest limit check: prevent nesting too deep (>3 levels)
    if (treeItems[idx - 1].depth >= 2) {
      showToast("Maximum nesting limit is 3 levels.", "warning");
      return;
    }

    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, parentId: targetParent.id };
        }
        return item;
      })
    );
    setUnsavedChanges(true);
  };

  const handleOutdent = (itemId: string) => {
    const currentItem = localItems.find((i) => i.id === itemId);
    if (!currentItem || !currentItem.parentId) return;

    const parentItem = localItems.find((i) => i.id === currentItem.parentId);
    const grandparentId = parentItem ? parentItem.parentId : null;

    setLocalItems((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          return { ...item, parentId: grandparentId };
        }
        return item;
      })
    );
    setUnsavedChanges(true);
  };

  // ─── Bulk Action Dispatcher ──────────────────────────────────────────────
  const handleBulkApply = () => {
    if (!bulkAction || selectedIds.length === 0) return;

    if (bulkAction === "DELETE") {
      selectedIds.forEach((id) => {
        if (!id.startsWith("temp-")) {
          setDeletedItemIds((prev) => [...prev, id]);
        }
      });
      setLocalItems((prev) => prev.filter((item) => !selectedIds.includes(item.id)));
      showToast("Selected items marked for removal.", "success");
    } else {
      const status = bulkAction === "ENABLE" ? "ACTIVE" : "INACTIVE";
      setLocalItems((prev) =>
        prev.map((item) => (selectedIds.includes(item.id) ? { ...item, status } : item))
      );
      showToast(`Selected items marked as ${status === "ACTIVE" ? "Active" : "Inactive"}.`, "success");
    }

    setUnsavedChanges(true);
    setSelectedIds([]);
    setBulkAction("");
  };

  // Handle Multi-Checkbox Selection
  const handleSelectToggle = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllToggle = () => {
    if (selectedIds.length === filteredTreeItems.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredTreeItems.map((node) => node.item.id));
    }
  };

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

      {/* Notice Banner */}
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
        <a href="/admin/cms/footer" className="shrink-0 font-semibold text-blue-700 hover:text-blue-900 text-xs hover:underline">
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

      {/* Unsaved Changes Warning Panel */}
      {unsavedChanges && (
        <div className="mb-5 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 p-3 shadow-xs">
          <div className="flex items-center gap-2 text-amber-800 text-xs font-semibold">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500"></span>
            </span>
            <span>You have unsaved changes in this menu. Remember to save changes before leaving.</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (activeMenu) {
                  setLocalItems(activeMenu.items.map(normalizeItem));
                  setDeletedItemIds([]);
                  setUnsavedChanges(false);
                  setSelectedIds([]);
                }
              }}
              className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Discard
            </button>
            <button
              onClick={saveMenuStructure}
              disabled={saving}
              className="rounded-md bg-[#E31E24] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 transition-colors"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </div>
      )}

      {/* Main Grid View */}
      <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)] items-start">
        {/* Sidebar Tabs List */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-3 space-y-3 shadow-2xs">
          {/* Group Category Filters */}
          <div className="flex flex-wrap items-center gap-1 border-b border-[#E6E6E6] pb-2.5">
            <button
              type="button"
              onClick={() => setActiveGroupFilter("ALL")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                activeGroupFilter === "ALL" ? "bg-[#1A1A1A] text-white" : "bg-[#F2F2F2] text-[#6B6B6B] hover:bg-[#E6E6E6]"
              )}
            >
              All ({groupCounts.all})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupFilter("header")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                activeGroupFilter === "header" ? "bg-indigo-600 text-white" : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100"
              )}
            >
              Header ({groupCounts.header})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupFilter("footer")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                activeGroupFilter === "footer" ? "bg-rose-600 text-white" : "bg-rose-50 text-rose-700 hover:bg-rose-100"
              )}
            >
              Footer ({groupCounts.footer})
            </button>
            <button
              type="button"
              onClick={() => setActiveGroupFilter("offices_legal")}
              className={cn(
                "rounded-md px-2.5 py-1 text-[11.5px] font-medium transition-colors",
                activeGroupFilter === "offices_legal" ? "bg-amber-600 text-white" : "bg-amber-50 text-amber-800 hover:bg-amber-100"
              )}
            >
              Offices ({groupCounts.offices})
            </button>
          </div>

          {/* Menus List */}
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

        {/* Selected Menu Workspace */}
        {activeMenu ? (
          <div className="space-y-5">
            {/* Top Config Card */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-4 border-b border-[#E6E6E6] pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-[17px] font-bold text-[#1A1A1A]">{activeMenu.name}</h3>
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
                    <span className="font-mono text-[11px] text-[#9A9A9A]">Handle: {activeMenu.location}</span>
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

              {editingMenuSettings && (
                <div className="grid gap-3 rounded-lg border border-[#E6E6E6] bg-[#FDFDFD] p-4 md:grid-cols-[1fr_1fr_120px_auto]">
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
            </div>

            {/* Shopify-like Menu Items Editor Panel */}
            <div className="rounded-xl border border-[#E6E6E6] bg-white shadow-xs flex flex-col overflow-hidden">
              {/* Card Header & Controls */}
              <div className="border-b border-[#E6E6E6] bg-white px-4 py-3 flex flex-wrap items-center justify-between gap-3 min-h-[56px]">
                <div className="flex items-center gap-2">
                  <h4 className="text-[14px] font-bold text-[#1A1A1A]">Menu items</h4>
                  <span className="rounded-full bg-[#EFEFEF] px-2 py-0.5 font-mono text-[10.5px] font-bold text-[#6B6B6B]">
                    {filteredTreeItems.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
                    <input
                      type="text"
                      placeholder="Search menu items..."
                      value={itemsSearchQuery}
                      onChange={(e) => setItemsSearchQuery(e.target.value)}
                      className="rounded-lg border border-[#E6E6E6] bg-white py-1 pl-7 pr-2.5 text-xs text-[#1A1A1A] outline-none focus:border-[#E31E24] w-48"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setAddLabel("");
                      setAddUrl("");
                      setAddParentId("");
                      setAddSortOrder(localItems.length);
                      setIsAddModalOpen(true);
                    }}
                    className="flex items-center gap-1 rounded-lg bg-[#E31E24] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all"
                  >
                    <Plus size={13} />
                    Add menu item
                  </button>
                </div>
              </div>

              {/* Bulk Actions Header Toolbar (Common Action Section) */}
              <div className="border-b border-[#E6E6E6] bg-[#FDFDFD] px-4 py-2 flex items-center justify-between text-xs min-h-[44px]">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={filteredTreeItems.length > 0 && selectedIds.length === filteredTreeItems.length}
                      onChange={handleSelectAllToggle}
                      className="rounded border-[#CCCCCC] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer"
                    />
                    <span className="font-medium text-[#6B6B6B]">{selectedIds.length} Selected</span>
                  </div>
                  {selectedIds.length > 0 && (
                    <div className="h-4 w-px bg-[#E6E6E6]" />
                  )}
                  {selectedIds.length > 0 && (
                    <div className="flex items-center gap-2">
                      <select
                        value={bulkAction}
                        onChange={(e) => setBulkAction(e.target.value as any)}
                        className="rounded border border-[#E6E6E6] bg-white px-2 py-1 text-xs text-[#1A1A1A] focus:border-[#E31E24] outline-none cursor-pointer"
                      >
                        <option value="">Choose Bulk Action</option>
                        <option value="ENABLE">Mark active</option>
                        <option value="DISABLE">Mark inactive</option>
                        <option value="DELETE">Delete selected</option>
                      </select>
                      <button
                        onClick={handleBulkApply}
                        className="rounded bg-[#E31E24] px-3 py-1 text-xs font-semibold text-white hover:bg-[#B5151B] transition-colors"
                      >
                        Apply
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Shopify-like Tree Cards */}
              <div className="divide-y divide-[#E6E6E6] bg-gray-50/20">
                {filteredTreeItems.map((node) => {
                  const { item, depth } = node;
                  const isChecked = selectedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      style={{ paddingLeft: `${Math.max(12, depth * 32)}px` }}
                      className={cn(
                        "flex items-center justify-between py-3 pr-4 hover:bg-white bg-transparent transition-colors border-l-4",
                        depth === 1 ? "border-l-indigo-300" : depth >= 2 ? "border-l-rose-300" : "border-l-transparent"
                      )}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Drag Handle Lookalike */}
                        <div className="text-gray-300 cursor-grab shrink-0">
                          <GripVertical size={15} />
                        </div>
                        {/* Row Checkbox */}
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleSelectToggle(item.id)}
                          className="rounded border-[#CCCCCC] text-[#E31E24] focus:ring-[#E31E24] cursor-pointer shrink-0"
                        />
                        {/* Label & URL */}
                        <div className="min-w-0">
                          <span className="text-[13px] font-bold text-[#1A1A1A] block truncate">
                            {item.label}
                          </span>
                          <span className="text-[11px] font-mono text-gray-500 block truncate max-w-[280px]">
                            {item.url || "/"}
                            {item.openInNewTab && <span className="ml-1 text-[10px] bg-gray-100 text-gray-600 px-1 rounded">New Tab</span>}
                          </span>
                        </div>
                      </div>

                      {/* Position & Action Buttons */}
                      <div className="flex items-center gap-2 shrink-0">
                        {/* Position controls */}
                        <div className="flex items-center gap-0.5 border border-[#E6E6E6] rounded-md bg-white p-0.5">
                          <button
                            type="button"
                            onClick={() => handleOutdent(item.id)}
                            disabled={!item.parentId}
                            className="p-1 text-gray-500 hover:bg-gray-100 hover:text-black rounded disabled:opacity-20 transition-all"
                            title="Outdent (Move left)"
                          >
                            <ArrowLeft size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleIndent(item.id)}
                            disabled={depth >= 2}
                            className="p-1 text-gray-500 hover:bg-gray-100 hover:text-black rounded disabled:opacity-20 transition-all"
                            title="Indent (Move right / nest)"
                          >
                            <ArrowRight size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveUp(item.id)}
                            className="p-1 text-gray-500 hover:bg-gray-100 hover:text-black rounded transition-all"
                            title="Move up"
                          >
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveDown(item.id)}
                            className="p-1 text-gray-500 hover:bg-gray-100 hover:text-black rounded transition-all"
                            title="Move down"
                          >
                            <ArrowDown size={13} />
                          </button>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase ${
                            item.status === "ACTIVE"
                              ? "bg-green-50 text-green-700 border border-green-200"
                              : "bg-gray-50 text-gray-500 border border-gray-200"
                          }`}
                        >
                          {item.status || "ACTIVE"}
                        </span>

                        {/* Edit & Delete Actions */}
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setEditingItem({ ...item })}
                            className="p-1.5 border border-[#E6E6E6] hover:bg-gray-50 text-[#1A1A1A] rounded-md transition-all"
                            title="Edit menu item"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleteItemId(item.id)}
                            className="p-1.5 border border-red-100 hover:bg-red-50 text-red-600 rounded-md transition-all"
                            title="Delete menu item"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {filteredTreeItems.length === 0 && (
                  <div className="py-12 text-center text-sm text-[#6B6B6B]">
                    No menu items configured for this location. Click "Add menu item" to start.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-[#E6E6E6] bg-white p-12 text-center text-sm text-[#6B6B6B]">
            No menu location selected.
          </div>
        )}
      </div>

      {/* Add Item Modal with Shopify Link Picker */}
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
              
              <LinkPickerInput
                label="URL / Target Link"
                value={addUrl}
                onChange={setAddUrl}
                onSelectLink={(url, label) => {
                  setAddUrl(url);
                  if (!addLabel.trim()) {
                    setAddLabel(label);
                  }
                }}
                categories={categories}
                collections={collections}
                cmsPages={cmsPages}
                blogs={blogs}
                products={products}
              />

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

      {/* Edit Item Modal with Shopify Link Picker */}
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
              
              <LinkPickerInput
                label="URL / Target Link"
                value={editingItem.url}
                onChange={(val) => setEditingItem({ ...editingItem, url: val })}
                onSelectLink={(url, label) => {
                  setEditingItem(prev => {
                    if (!prev) return null;
                    return {
                      ...prev,
                      url,
                      label: prev.label ? prev.label : label
                    };
                  });
                }}
                categories={categories}
                collections={collections}
                cmsPages={cmsPages}
                blogs={blogs}
                products={products}
              />

              <AdminSelect
                label="Parent Menu (Column Group)"
                value={editingItem.parentId ?? ""}
                onChange={(e) => setEditingItem({ ...editingItem, parentId: e.target.value || null })}
                options={[{ value: "", label: "No Parent (Top-Level Column)" }].concat(
                  localItems
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
                          onBlur={(e) => {
                            setLocalItems(prev =>
                              prev.map(item => {
                                if (item.id === editingItem.id) {
                                  const updatedTranslations = { ...item.translations };
                                  if (!updatedTranslations.label) {
                                    updatedTranslations.label = [];
                                  }
                                  const idx = updatedTranslations.label.findIndex(entry => entry.languageId === activeLangId);
                                  if (idx >= 0) {
                                    updatedTranslations.label[idx] = { languageId: activeLangId, value: e.target.value };
                                  } else {
                                    updatedTranslations.label.push({ languageId: activeLangId, value: e.target.value });
                                  }
                                  return { ...item, translations: updatedTranslations };
                                }
                                return item;
                              })
                            );
                            setUnsavedChanges(true);
                          }}
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
