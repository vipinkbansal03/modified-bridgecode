"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { ConfirmModal, Pagination, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminCategories,
  useAdminCollections,
  useAdminCountries,
  useAdminProducts,
  useArchiveProduct,
  useBulkUpdateProducts,
  useDuplicateProduct,
  useDeleteProduct,
  useReorderProducts,
  useRestoreProduct,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { Archive, Copy, Download, Eye, Filter, Layers, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, Upload } from "lucide-react";

interface ProductRow {
  id: string;
  slug?: string;
  title: string;
  productCode?: string | null;
  sku?: string | null;
  brand?: string | null;
  category: { id: string; name: string };
  status: string;
  sortOrder?: number;
  hasVariants: boolean;
  _count: { variants: number };
  media: { url: string }[];
  countries: { countryId: string }[];
  inventories: { stock: number; reservedStock: number }[];
  prices: { sellingPrice: string | number; currency: { symbol: string; code: string } }[];
  updatedAt: string;
  createdAt: string;
}

type BulkAction = "enable" | "disable" | "archive" | "restore" | "assignCategory" | "assignCountries" | "assignCollections" | "delete";

type ColumnKey = "image" | "name" | "sku" | "brand" | "category" | "status" | "countries" | "inventory" | "price" | "updated" | "actions";

type SpreadsheetIssue = { row: number; field: string; message: string };
type SpreadsheetPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: SpreadsheetIssue[];
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  image: true,
  name: true,
  sku: true,
  brand: true,
  category: true,
  status: true,
  countries: true,
  inventory: true,
  price: true,
  updated: true,
  actions: true,
};

const PRODUCT_COLUMNS_STORAGE_KEY = "admin-products-columns-v2";

export default function AdminProductsPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [sortBy, setSortBy] = useState("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<BulkAction>("enable");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkCountryIds, setBulkCountryIds] = useState<string[]>([]);
  const [bulkCollectionIds, setBulkCollectionIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<SpreadsheetPreview | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnsReady, setColumnsReady] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    try {
      const raw = localStorage.getItem(PRODUCT_COLUMNS_STORAGE_KEY);
      if (raw) setVisibleColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(raw) });
    } catch {
      // Ignore invalid persisted column prefs.
    }
    setColumnsReady(true);
  }, []);

  useEffect(() => {
    if (!columnsReady) return;
    localStorage.setItem(PRODUCT_COLUMNS_STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [columnsReady, visibleColumns]);

  const { data, isLoading, refetch } = useAdminProducts({ page, search, status, categoryId: categoryId || undefined, limit: 20, sortBy, sortDir });
  const { data: categories = [] } = useAdminCategories();
  const { data: countries = [] } = useAdminCountries();
  const { data: collectionsData } = useAdminCollections({ limit: 200 });
  const deleteMutation = useDeleteProduct();
  const duplicateMutation = useDuplicateProduct();
  const archiveMutation = useArchiveProduct();
  const restoreMutation = useRestoreProduct();
  const reorderProducts = useReorderProducts();
  const bulkUpdate = useBulkUpdateProducts();

  const products = useMemo(() => (data?.data ?? []) as ProductRow[], [data?.data]);
  const allVisibleSelected = products.length > 0 && products.every((product) => selectedIds.includes(product.id));
  const columns = useMemo(
    () =>
      [
        visibleColumns.image ? { key: "image", label: "Image", width: "72px" } : null,
        visibleColumns.name ? { key: "name", label: "Product Name", width: "280px" } : null,
        visibleColumns.sku ? { key: "sku", label: "SKU", width: "130px" } : null,
        visibleColumns.brand ? { key: "brand", label: "Brand", width: "150px" } : null,
        visibleColumns.category ? { key: "category", label: "Category", width: "160px" } : null,
        visibleColumns.status ? { key: "status", label: "Status", width: "120px" } : null,
        visibleColumns.countries ? { key: "countries", label: "Country Availability", width: "130px" } : null,
        visibleColumns.inventory ? { key: "inventory", label: "Inventory", width: "120px" } : null,
        visibleColumns.price ? { key: "price", label: "Price", width: "120px" } : null,
        visibleColumns.updated ? { key: "updated", label: "Updated Date", width: "140px" } : null,
        visibleColumns.actions ? { key: "actions", label: "Actions", width: "168px" } : null,
      ].filter(Boolean) as { key: ColumnKey; label: string; width: string }[],
    [visibleColumns],
  );
   const gridTemplateColumns = useMemo(() => `minmax(24px,24px) ${columns.map((column) => column.width).join(" ")}`, [columns]);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const visibleIds = products.map((product) => product.id);
      if (visibleIds.every((id) => current.includes(id))) return current.filter((id) => !visibleIds.includes(id));
      return Array.from(new Set([...current, ...visibleIds]));
    });
  };

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting);
      setSelectedIds((current) => current.filter((id) => id !== deleting));
      showToast("Product deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete product."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleDuplicate = async (id: string) => {
    try {
      await duplicateMutation.mutateAsync(id);
      showToast("Product duplicated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to duplicate product."), "error");
    }
  };

  const handleArchiveToggle = async (product: ProductRow) => {
    try {
      if (product.status === "ARCHIVED") {
        await restoreMutation.mutateAsync(product.id);
        showToast("Product restored.");
      } else {
        await archiveMutation.mutateAsync(product.id);
        showToast("Product archived.");
      }
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update product status."), "error");
    }
  };

  const handleReorder = async (nextRows: ProductRow[]) => {
    try {
      await reorderProducts.mutateAsync(toSortOrderPayload(nextRows));
      showToast("Products reordered.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder products."), "error");
    }
  };

  const handleBulkAction = async () => {
    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        action: bulkAction,
        categoryId: bulkAction === "assignCategory" ? bulkCategoryId : undefined,
        countryIds: bulkAction === "assignCountries" ? bulkCountryIds : undefined,
        collectionIds: bulkAction === "assignCollections" ? bulkCollectionIds : undefined,
      });
      setSelectedIds([]);
      showToast("Bulk action completed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const getInventorySummary = (product: ProductRow) => {
    const totals = product.inventories.reduce(
      (acc, inventory) => {
        acc.stock += inventory.stock;
        acc.available += Math.max(0, inventory.stock - inventory.reservedStock);
        return acc;
      },
      { stock: 0, available: 0 },
    );
    return totals;
  };

  const formatPrice = (product: ProductRow) => {
    const price = product.prices[0];
    if (!price) return "—";
    return `${price.currency.symbol}${Number(price.sellingPrice).toFixed(2)}`;
  };

  const exportProducts = async (selectedOnly = false) => {
    try {
      const params = {
        page,
        search: search || undefined,
        status: status || undefined,
        categoryId: categoryId || undefined,
        sortBy,
        sortDir,
        ids: selectedOnly && selectedIds.length ? selectedIds.join(",") : undefined,
      };
      const response = await adminApi.get("/products/export", { params, responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedOnly && selectedIds.length ? "products-selected.xlsx" : "products-export.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export products."), "error");
    }
  };

  const openImportDialog = () => {
    setImportPreview(null);
    setImportMessage("");
    setImportFile(null);
    setImportOpen(true);
    fileInputRef.current?.click();
  };

  const handleImportFile = async (file?: File) => {
    if (!file) return;
    setImportFile(file);
    setImportMessage("Previewing spreadsheet...");
    setImportPreview(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await adminApi.post("/products/import/preview", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const report = response.data?.data as SpreadsheetPreview;
      setImportPreview(report);
      setImportMessage(report.invalidRows > 0 ? "Fix the validation issues before importing." : "Preview looks good. You can import now.");
    } catch (error) {
      setImportMessage(getAdminErrorMessage(error, "Failed to preview spreadsheet."));
      setImportPreview(null);
    }
  };

  const confirmImport = async () => {
    if (!importFile) return;
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", importFile);
      const response = await adminApi.post("/products/import", formData, { headers: { "Content-Type": "multipart/form-data" } });
      const result = response.data?.data as { created: number; updated: number; report: SpreadsheetPreview };
      showToast(`Imported ${result.created} created and ${result.updated} updated products.`);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import spreadsheet."), "error");
    } finally {
      setImporting(false);
    }
  };

  return (
    <AdminLayout title="Products" breadcrumb={[{ label: "Products" }]}>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              placeholder="Search products..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-[220px] rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
            />
          </div>
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
          >
            <option value="">All Status</option>
            <option value="DRAFT">Draft</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <select
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
          >
            <option value="">All Categories</option>
            {categories.map((category: { id: string; name: string }) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
          >
            <option value="sortOrder">Sort order</option>
            <option value="title">Name</option>
            <option value="sku">SKU</option>
            <option value="brand">Brand</option>
            <option value="category">Category</option>
            <option value="status">Status</option>
            <option value="updatedAt">Updated date</option>
          </select>
          <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none">
            <option value="asc">Ascending</option>
            <option value="desc">Descending</option>
          </select>
          <details className="relative">
            <summary className="list-none cursor-pointer rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none flex items-center gap-2">
              <SlidersHorizontal size={14} /> Columns
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-[240px] rounded-md border border-[#E6E6E6] bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                <Filter size={12} /> Visibility
              </div>
              <div className="grid gap-2">
                {(Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded border border-[#F0F0F0] px-2.5 py-1.5 text-[12.5px] text-[#1A1A1A]">
                    <span className="capitalize">{key}</span>
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={(e) => setVisibleColumns((current) => ({ ...current, [key]: e.target.checked }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>
        <Link href="/admin/products/create" className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
          <Plus size={15} /> New Product
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => exportProducts(false)} className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]">
            <Download size={15} /> Export Excel
          </button>
          {selectedIds.length > 0 ? (
            <button type="button" onClick={() => exportProducts(true)} className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]">
              <Download size={15} /> Export Selected
            </button>
          ) : null}
          <button type="button" onClick={openImportDialog} className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]">
            <Upload size={15} /> Import Excel
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={(event) => {
            void handleImportFile(event.target.files?.[0] || undefined);
            event.currentTarget.value = "";
          }}
        />
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#9A9A9A]">
        <span>{data?.pagination ? `${data.pagination.total} products` : ""}</span>
        <label className="inline-flex items-center gap-2 text-[#555]">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
          Select visible
        </label>
      </div>

      {selectedIds.length > 0 ? (
        <div className="mb-4 rounded-lg border border-[#E6E6E6] bg-white p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-[#1A1A1A]">{selectedIds.length} selected</span>
            <select value={bulkAction} onChange={(event) => setBulkAction(event.target.value as BulkAction)} className="h-9 rounded-md border border-[#E6E6E6] px-3 text-[13px]">
              <option value="enable">Enable</option>
              <option value="disable">Disable</option>
              <option value="archive">Archive</option>
              <option value="restore">Restore</option>
              <option value="assignCategory">Assign category</option>
              <option value="assignCountries">Enable countries</option>
              <option value="assignCollections">Assign collections</option>
              <option value="delete">Delete</option>
            </select>
            {bulkAction === "assignCategory" ? (
              <select value={bulkCategoryId} onChange={(event) => setBulkCategoryId(event.target.value)} className="h-9 rounded-md border border-[#E6E6E6] px-3 text-[13px]">
                <option value="">Select category</option>
                {categories.map((category: { id: string; name: string }) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            ) : null}
            {bulkAction === "assignCountries" ? (
              <div className="flex flex-wrap gap-2">
                {countries.map((country: { id: string; code: string; name: string }) => (
                  <label key={country.id} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E6E6E6] px-3 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={bulkCountryIds.includes(country.id)}
                      onChange={() =>
                        setBulkCountryIds((current) => (current.includes(country.id) ? current.filter((id) => id !== country.id) : [...current, country.id]))
                      }
                    />
                    {country.code}
                  </label>
                ))}
              </div>
            ) : null}
            {bulkAction === "assignCollections" ? (
              <div className="flex max-h-40 flex-wrap gap-2 overflow-y-auto">
                {(collectionsData?.data ?? []).map((collection: { id: string; name: string }) => (
                  <label key={collection.id} className="inline-flex h-9 items-center gap-2 rounded-md border border-[#E6E6E6] px-3 text-[12.5px]">
                    <input
                      type="checkbox"
                      checked={bulkCollectionIds.includes(collection.id)}
                      onChange={() =>
                        setBulkCollectionIds((current) => (current.includes(collection.id) ? current.filter((id) => id !== collection.id) : [...current, collection.id]))
                      }
                    />
                    {collection.name}
                  </label>
                ))}
              </div>
            ) : null}
            <button
              type="button"
              onClick={handleBulkAction}
              disabled={bulkUpdate.isPending}
              className="h-9 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white disabled:opacity-60"
            >
              Apply
            </button>
            <button type="button" onClick={() => setSelectedIds([])} className="h-9 rounded-md border border-[#E6E6E6] px-4 text-[13px] font-semibold text-[#555]">
              Clear
            </button>
          </div>
        </div>
      ) : null}

      {isLoading ? (
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 text-[13.5px] text-[#9A9A9A]">Loading products...</div>
      ) : products.length === 0 ? (
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-5 text-[13.5px] text-[#9A9A9A]">No products found. Create your first product.</div>
      ) : (
        <div className="rounded-lg border border-[#E6E6E6] bg-white">
          <div className="overflow-x-auto">
            <div className="min-w-[1280px] p-3">
              <div className="mb-2 hidden w-max min-w-max items-center gap-2 px-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A] md:grid" style={{ gridTemplateColumns }}>
                <span />
                {columns.map((column) => (
                  <span key={column.key} className="capitalize">
                    {column.label}
                  </span>
                ))}
              </div>
              <SortableList
                className="min-w-max"
                items={products}
                onReorder={handleReorder}
                disabled={reorderProducts.isPending}
                handleAriaLabel="Drag product to reorder"
                itemClassName="overflow-visible"
                renderItem={(product) => {
                  const inventory = getInventorySummary(product);
                  return (
                    <div className="grid w-max min-w-max gap-2 md:items-center" style={{ gridTemplateColumns }}>
                      <div className="flex items-center justify-center">
                        <input type="checkbox" checked={selectedIds.includes(product.id)} onChange={() => toggleSelected(product.id)} onClick={(event) => event.stopPropagation()} />
                      </div>
                      {visibleColumns.image ? (
                        <div className="flex min-w-0 items-center gap-3">
                          {product.media[0] ? (
                            <img src={product.media[0].url} alt={product.title} className="h-10 w-10 flex-none rounded object-cover" />
                          ) : (
                            <div className="flex h-10 w-10 items-center justify-center rounded bg-[#F2F2F2] text-[#9A9A9A]">
                              <Layers size={16} />
                            </div>
                          )}
                        </div>
                      ) : null}
                      {visibleColumns.name ? (
                        <div className="flex min-w-0 items-center gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-[13.5px] font-medium text-[#1A1A1A]">{product.title}</div>
                            <div className="truncate text-[11.5px] text-[#9A9A9A]">{product.productCode || product.id}</div>
                          </div>
                        </div>
                      ) : null}
                      {visibleColumns.sku ? <div className="truncate text-[13px] text-[#555]">{product.sku || "—"}</div> : null}
                      {visibleColumns.brand ? <div className="truncate text-[13px] text-[#555]">{product.brand || "—"}</div> : null}
                      {visibleColumns.category ? <div className="truncate text-[13px] text-[#555]">{product.category?.name || "Uncategorized"}</div> : null}
                      {visibleColumns.status ? <StatusBadge status={product.status} /> : null}
                      {visibleColumns.countries ? <div className="text-[13px] text-[#555]">{product.countries.length}</div> : null}
                      {visibleColumns.inventory ? <div className="text-[13px] text-[#555]">{inventory.available} / {inventory.stock}</div> : null}
                      {visibleColumns.price ? <div className="text-[13px] text-[#555]">{formatPrice(product)}</div> : null}
                      {visibleColumns.updated ? <div className="text-[13px] text-[#555]">{new Date(product.updatedAt).toLocaleDateString()}</div> : null}
                      {visibleColumns.actions ? (
                        <div className="flex gap-1.5 md:justify-end">
                          {product.slug ? (
                            <Link href={`/products/${product.slug}`} target="_blank" className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]" title="View product">
                              <Eye size={13} />
                            </Link>
                          ) : (
                            <span title="Product slug missing" className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded border border-[#E6E6E6] text-[#C4C4C4]">
                              <Eye size={13} />
                            </span>
                          )}
                          <button type="button" onClick={() => handleDuplicate(product.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]" title="Duplicate product">
                            <Copy size={13} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleArchiveToggle(product)}
                            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                            title={product.status === "ARCHIVED" ? "Restore product" : "Archive product"}
                          >
                            {product.status === "ARCHIVED" ? <RotateCcw size={13} /> : <Archive size={13} />}
                          </button>
                           <Link
                             href={`/admin/products/${product.id}/edit`}
                             className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                             title="Edit product"
                           >
                             <Pencil size={13} />
                           </Link>
                          <button type="button" onClick={() => setDeleting(product.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50" title="Delete product">
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ) : null}
                    </div>
                  );
                }}
              />
            </div>
          </div>
        </div>
      )}

      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />

      <ConfirmModal
        open={!!deleting}
        title="Delete product?"
        message="This will soft-delete the product. It will be blocked if active orders reference it."
        onConfirm={handleDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteMutation.isPending}
      />

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Products Excel"
        panelClassName="max-w-4xl max-h-[calc(100vh-2.5rem)] overflow-y-auto"
      >
        <div className="space-y-4 p-6">
          <p className="text-[13.5px] leading-5 text-[#6B6B6B]">
            Upload an `.xlsx` or `.csv` file. The first sheet is read automatically, then the server validates the rows before any write happens.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
            >
              Choose File
            </button>
            <span className="text-[13px] text-[#6B6B6B]">{importFile ? importFile.name : "No file selected"}</span>
          </div>
          {importMessage ? <div className="rounded-md border border-[#E6E6E6] bg-[#FAFAFA] px-3 py-2 text-[13px] text-[#1A1A1A]">{importMessage}</div> : null}
          {importPreview ? (
            <div className="space-y-4 rounded-lg border border-[#E6E6E6] bg-white p-4">
              <div className="grid gap-3 md:grid-cols-4">
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Rows</div>
                  <div className="mt-1 text-[20px] font-semibold text-[#1A1A1A]">{importPreview.totalRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Valid</div>
                  <div className="mt-1 text-[20px] font-semibold text-green-600">{importPreview.validRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Invalid</div>
                  <div className="mt-1 text-[20px] font-semibold text-red-600">{importPreview.invalidRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] p-3">
                  <div className="text-[11px] uppercase tracking-wide text-[#9A9A9A]">Warnings</div>
                  <div className="mt-1 text-[20px] font-semibold text-amber-600">{importPreview.duplicateWarnings.length}</div>
                </div>
              </div>
              {importPreview.issues.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">Validation Issues</h4>
                  <div className="max-h-48 overflow-y-auto rounded border border-[#E6E6E6]">
                    {importPreview.issues.map((issue, index) => (
                      <div key={`${issue.row}-${issue.field}-${index}`} className="border-b border-[#F0F0F0] px-3 py-2 text-[13px] last:border-b-0">
                        <span className="font-semibold text-[#E31E24]">Row {issue.row}</span> <span className="text-[#6B6B6B]">[{issue.field}]</span> {issue.message}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
              {importPreview.sampleRows.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">Preview Rows</h4>
                  <div className="max-h-48 overflow-y-auto rounded border border-[#E6E6E6]">
                    {importPreview.sampleRows.map((row: Record<string, unknown>, index) => (
                      <pre key={index} className="border-b border-[#F0F0F0] px-3 py-2 text-[11.5px] text-[#555] last:border-b-0 whitespace-pre-wrap">
                        {JSON.stringify(row)}
                      </pre>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
          <div className="flex items-center justify-end gap-2.5">
            <button type="button" onClick={() => setImportOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium text-[#555] hover:bg-[#F2F2F2]">
              Close
            </button>
            <button
              type="button"
              onClick={confirmImport}
              disabled={!importFile || importing || !!importPreview?.invalidRows}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
            >
              {importing ? "Importing..." : "Import Products"}
            </button>
          </div>
        </div>
      </Modal>

      {ToastComponent}
    </AdminLayout>
  );
}
