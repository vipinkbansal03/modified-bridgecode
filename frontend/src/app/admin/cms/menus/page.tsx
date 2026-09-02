"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Edit2, Trash2, Search, ArrowUp, ArrowDown, Globe, Link2, FolderTree, ExternalLink, X, Settings, GripVertical, Check, ArrowRight, ArrowLeft } from "lucide-react";
import { AdminInput, AdminSelect, AdminTextarea, ConfirmModal, Modal, useToast } from "@/components/admin/AdminComponents";
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
                onMouseDown={(e) => { e.preventDefault(); setTab("main"); setSearch(""); }}
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
                  onMouseDown={(e) => { e.preventDefault(); onSelectLink("/", "Home page"); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A]"
                >
                  🏠 Home page
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelectLink("/search", "Search"); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A]"
                >
                  🔍 Search page
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTab("products"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📦 Products</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); onSelectLink("/products?collection=all", "All Products"); setIsOpen(false); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A]"
                >
                  🛍️ All Products
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTab("collections"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📂 Collections</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTab("categories"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📁 Categories</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTab("pages"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-medium text-[#1A1A1A] flex items-center justify-between"
                >
                  <span>📄 CMS Pages</span>
                  <span className="text-[#9A9A9A] text-[10px]">▶</span>
                </button>
                <button
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); setTab("blogs"); }}
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
                  onMouseDown={(e) => { e.preventDefault(); onSelectLink("/products", "All Products"); setIsOpen(false); setTab("main"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-bold text-gray-700"
                >
                  All Products
                </button>
                {filteredProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onSelectLink(`/products/${p.slug}`, p.title); setIsOpen(false); setTab("main"); }}
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
                    onMouseDown={(e) => { e.preventDefault(); onSelectLink(`/products?collection=${c.slug}`, c.name); setIsOpen(false); setTab("main"); }}
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
                    onMouseDown={(e) => { e.preventDefault(); onSelectLink(`/products?category=${c.slug}`, c.name); setIsOpen(false); setTab("main"); }}
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
                    onMouseDown={(e) => { e.preventDefault(); onSelectLink(`/${p.slug}`, p.title); setIsOpen(false); setTab("main"); }}
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
                  onMouseDown={(e) => { e.preventDefault(); onSelectLink("/blog", "Blog"); setIsOpen(false); setTab("main"); }}
                  className="w-full text-left px-3 py-2 text-xs hover:bg-[#F5F5F5] font-bold text-gray-700"
                >
                  All Blogs
                </button>
                {filteredBlogs.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); onSelectLink(`/blog/${b.slug}`, b.name); setIsOpen(false); setTab("main"); }}
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
const CORE_SYSTEM_PAGES = new Set(["home", "about", "contact", "products"]);
export default function CmsMenusPage() {
  const { data: menus, isLoading, refetch } = useAdminCmsMenus();
  const { data: languages = [] } = useAdminLanguages();
  const activeTranslationLanguages = useMemo(() => {
    return (languages as Language[]).filter((lang) => lang.isEnabled && !lang.isDefault);
  }, [languages]);
  
  const { data: categories = [] } = useAdminCategories();
  const { data: cmsPagesResponse } = useAdminCmsPages();
  const cmsPages = useMemo(() => {
    const raw = cmsPagesResponse as { data?: any[] } | any[] | undefined;
    if (Array.isArray(raw)) return raw;
    if (raw && Array.isArray(raw.data)) return raw.data;
    return [];
  }, [cmsPagesResponse]);

  const { data: collectionsResponse } = useAdminCollections({ limit: 200 });
  const collections = collectionsResponse?.data ?? [];
  const { data: blogsResponse } = useAdminBlogs({ limit: 200 });
  const blogs = blogsResponse?.data ?? [];
  const { data: productsResponse } = useAdminProducts({ limit: 200 });
  const products = productsResponse?.data?.items ?? productsResponse?.data ?? [];

  const pageStatusMap = useMemo(() => {
    const map = new Map<string, { status: string; title: string; pageKey: string }>();
    cmsPages.forEach((p: any) => {
      if (p.slug) {
        map.set(`/${p.slug.toLowerCase().trim()}`, {
          status: p.status ?? "ACTIVE",
          title: p.title,
          pageKey: p.pageKey,
        });
      }
      if (p.pageKey) {
        map.set(`/${p.pageKey.toLowerCase().trim()}`, {
          status: p.status ?? "ACTIVE",
          title: p.title,
          pageKey: p.pageKey,
        });
      }
    });
    return map;
  }, [cmsPages]);

  const [selectedMenuId, setSelectedMenuId] = useState<string | null>(null);

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
  const [deleteMenuTarget, setDeleteMenuTarget] = useState<Menu | null>(null);

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

  const activeMenu = useMemo(() => {
    if (selectedMenuId === "new") {
      return { id: "new", name: "New Menu", location: "", status: "ACTIVE", items: [] };
    }
    return menuList.find((m) => m.id === selectedMenuId) || null;
  }, [menuList, selectedMenuId]);

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
      setMenuName(activeMenu.id === "new" ? "" : activeMenu.name);
      setMenuLocation(activeMenu.id === "new" ? "" : activeMenu.location);
      setMenuStatus(activeMenu.status ?? "ACTIVE");
      setLocalItems(activeMenu.items.map(normalizeItem));
      setDeletedItemIds([]);
      setUnsavedChanges(false);
      setSelectedIds([]);
    } else {
      setMenuName("");
      setMenuLocation("");
      setMenuStatus("ACTIVE");
      setLocalItems([]);
      setDeletedItemIds([]);
      setUnsavedChanges(false);
      setSelectedIds([]);
    }
  }, [activeMenu]);

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

  // Remove whole Menu location
  async function removeMenu() {
    if (!deleteMenuTarget) return;
    try {
      await adminApi.delete(`/cms/menus/${deleteMenuTarget.id}`);
      showToast("Menu deleted successfully.", "success");
      setDeleteMenuTarget(null);
      refetch();
    } catch {
      showToast("Failed to delete menu.", "error");
    }
  }

  // Batch Save all local modifications to server
  async function saveMenuStructure() {
    if (!activeMenu) return;
    
    if (!menuName.trim() || !menuLocation.trim()) {
      showToast("Menu Name and Handle are required.", "error");
      return;
    }

    setSaving(true);
    try {
      let menuId = activeMenu.id;

      // 1. If it's a new menu, create it first
      if (activeMenu.id === "new") {
        const menuResponse = await adminApi.post("/cms/menus", {
          name: menuName.trim(),
          location: menuLocation.trim(),
          status: menuStatus,
        });
        menuId = menuResponse.data.data.id;
      } else {
        // Update menu details
        await adminApi.put(`/cms/menus/${activeMenu.id}`, {
          name: menuName.trim(),
          location: menuLocation.trim(),
          status: menuStatus,
        });
      }

      // 2. Delete marked items
      for (const id of deletedItemIds) {
        await adminApi.delete(`/cms/menu-items/${id}`);
      }

      // To map temporary ids of parent items to new database ids
      const tempIdMap: Record<string, string> = {};

      // 3. Iterate and process creations and updates in index order
      for (const item of localItems) {
        // Resolve parent ID if it references a temp ID that was just created
        const parentId = item.parentId
          ? (tempIdMap[item.parentId] || (item.parentId.startsWith("temp-") ? null : item.parentId))
          : null;

        if (item.id.startsWith("temp-")) {
          // Create new record
          const response = await adminApi.post(`/cms/menus/${menuId}/items`, {
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

      showToast("Menu saved successfully.", "success");
      setUnsavedChanges(false);
      setDeletedItemIds([]);
      setSelectedIds([]);
      setSelectedMenuId(null); // Redirect back to list
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
      
      {/* ─── CASE 1: Shopify-like Dedicated Menu Editor View ────────────────── */}
      {selectedMenuId !== null && activeMenu ? (
        <div className="space-y-5 pb-16 relative w-full">
          
          {/* Header Navigation Back-link */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setSelectedMenuId(null)}
                className="text-xs font-semibold text-[#6B6B6B] hover:text-[#1A1A1A] transition-colors"
              >
                ← Navigation
              </button>
              <span className="text-[#9A9A9A] text-xs">/</span>
              <h2 className="text-[17px] font-bold text-[#1A1A1A]">{menuName || "New Menu"}</h2>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedMenuId(null)}
                className="rounded-md border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveMenuStructure}
                disabled={saving}
                className="rounded-md bg-[#E31E24] px-4 py-1.5 text-xs font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50 transition-colors"
              >
                {saving ? "Saving..." : "Save Menu"}
              </button>
            </div>
          </div>


          {/* Shopify Unsaved Changes Black Banner */}
          {unsavedChanges && (
            <div className="flex items-center justify-between rounded-lg bg-neutral-900 text-white p-3.5 shadow-md">
              <span className="text-xs font-medium">Unsaved changes</span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (activeMenu.id === "new") {
                      setSelectedMenuId(null);
                    } else {
                      setLocalItems(activeMenu.items.map(normalizeItem));
                      setDeletedItemIds([]);
                      setUnsavedChanges(false);
                      setSelectedIds([]);
                    }
                  }}
                  className="rounded px-3 py-1 text-xs font-semibold text-white hover:bg-neutral-800 transition-colors border border-neutral-700"
                >
                  Discard
                </button>
                <button
                  onClick={saveMenuStructure}
                  disabled={saving}
                  className="rounded bg-white px-4 py-1 text-xs font-semibold text-neutral-950 hover:bg-gray-100 disabled:opacity-50 transition-colors"
                >
                  {saving ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          )}

          {/* Menu Details Card */}
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xs space-y-4">
            <h3 className="text-[14px] font-bold text-[#1A1A1A] border-b border-[#E6E6E6] pb-2">Menu details</h3>
            <div className="grid gap-4 md:grid-cols-2">
              <AdminInput
                label="Title"
                value={menuName}
                onChange={(e) => {
                  setMenuName(e.target.value);
                  setUnsavedChanges(true);
                }}
                placeholder="e.g. Main menu"
              />
              <AdminInput
                label="Handle (Location Key)"
                value={menuLocation}
                onChange={(e) => {
                  setMenuLocation(e.target.value.toLowerCase().replace(/\s+/g, "-"));
                  setUnsavedChanges(true);
                }}
                placeholder="e.g. main-menu"
              />
            </div>
            <div className="w-1/2">
              <AdminSelect
                label="Status"
                value={menuStatus}
                onChange={(e) => {
                  setMenuStatus(e.target.value);
                  setUnsavedChanges(true);
                }}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
            </div>
          </div>

          {/* Shopify-like Menu Items Panel */}
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
        // ─── CASE 2: Shopify-like Table Listing of All Navigation Menus ──────
        <div className="space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-[17px] font-bold text-[#1A1A1A]">Navigation Menus</h2>
              <p className="text-xs text-[#6B6B6B]">Manage the navigation menus that appear on your storefront header, footer, and sidebar zones.</p>
            </div>
            <button
              onClick={() => setSelectedMenuId("new")}
              className="flex items-center gap-2 rounded-lg bg-[#E31E24] px-4 py-2 text-xs font-semibold text-white hover:bg-[#B5151B] transition-all shadow-xs"
            >
              <Plus size={14} />
              Add menu
            </button>
          </div>

          <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
            {/* Header info bar */}
            <div className="border-b border-[#E6E6E6] bg-[#FDFDFD] px-4 py-3 flex items-center justify-between min-h-[56px]">
              <span className="text-[14px] font-bold text-[#1A1A1A]">Menus ({menuList.length})</span>
            </div>

            {/* List Table */}
            {isLoading ? (
              <div className="py-12 text-center text-sm text-gray-500">Loading menus...</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E6E6E6] bg-gray-50/50 font-semibold text-[#6B6B6B] uppercase tracking-wider">
                      <th className="px-4 py-3">Menu Title</th>
                      <th className="px-4 py-3">Handle / Location</th>
                      <th className="px-4 py-3">Items Count</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E6E6]">
                    {menuList.map((menu) => (
                      <tr key={menu.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-[#E31E24]">
                          <button
                            type="button"
                            onClick={() => setSelectedMenuId(menu.id)}
                            className="hover:underline text-[13px] font-bold text-left"
                          >
                            {menu.name}
                          </button>
                        </td>
                        <td className="px-4 py-3 font-mono text-gray-500">{menu.location}</td>
                        <td className="px-4 py-3 font-semibold text-[#1A1A1A]">{menu.items.length} items</td>
                        <td className="px-4 py-3">
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[10.5px] font-semibold uppercase tracking-wide ${
                              menu.status === "ACTIVE"
                                ? "bg-green-50 text-green-700 border border-green-200"
                                : "bg-gray-50 text-gray-500 border border-gray-200"
                            }`}
                          >
                            {menu.status ?? "ACTIVE"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => setSelectedMenuId(menu.id)}
                              className="p-1.5 border border-[#E6E6E6] bg-white rounded-md text-gray-700 hover:bg-gray-50 transition-all"
                              title="Edit Menu"
                            >
                              <Edit2 size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setDeleteMenuTarget(menu)}
                              className="p-1.5 border border-red-100 bg-white rounded-md text-red-600 hover:bg-red-50 transition-all"
                              title="Delete Menu"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                    {menuList.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-12 text-center text-sm text-[#6B6B6B]">
                          No menus found. Click "Add menu" to create your first navigation menu.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Item Modal with Shopify Link Picker */}
      <Modal
        open={isAddModalOpen}
        onClose={() => { setIsAddModalOpen(false); setAddTranslations({}); }}
        title="Add Menu Item"
        subtitle="Configure the item label, link target, parent group, and translations."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => { setIsAddModalOpen(false); setAddTranslations({}); }}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={addItem}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              Create Item
            </button>
          </div>
        }
      >
        <div className="space-y-4 p-6">
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
      </Modal>

      {/* Edit Item Modal with Shopify Link Picker */}
      <Modal
        open={Boolean(editingItem)}
        onClose={closeEditModal}
        title="Edit Menu Item"
        subtitle="Update the item label, link target, parent group, and translations."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={closeEditModal}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => editingItem && saveItem(editingItem)}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              Save Changes
            </button>
          </div>
        }
      >
        {editingItem && (
          <div className="space-y-4 p-6">
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
        )}
      </Modal>

      {/* Delete Item Confirmation Modal */}
      <ConfirmModal open={!!deleteItemId} title="Remove item" message="Are you sure you want to remove this menu item?" onConfirm={removeItem} onCancel={() => setDeleteItemId(null)} danger />
      
      {/* Delete Menu Location Confirmation Modal */}
      <ConfirmModal open={!!deleteMenuTarget} title="Delete Menu" message={`Are you sure you want to delete the menu "${deleteMenuTarget?.name}"? This action cannot be undone.`} onConfirm={removeMenu} onCancel={() => setDeleteMenuTarget(null)} danger />
    </AdminLayout>
  );
}
