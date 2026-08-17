"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminListToolbar, AdminStatsGrid, Column, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, LoadingButton, AdminBulkActionsBar, AdminMultiSelect } from "@/components/admin/AdminComponents";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { toSortOrderPayload } from "@/components/admin/SortableList";
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
  useAdminWarehouses,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Archive, CheckCircle2, Copy, Download, Eye, ExternalLink, FileText, Filter, Layers, Package, Pencil, Plus, RotateCcw, Search, SlidersHorizontal, Trash2, Upload, XCircle } from "lucide-react";

interface ProductRow {
  id: string;
  slug?: string;
  title: string;
  productCode?: string | null;
  sku?: string | null;
  brand?: string | null;
  category: { id: string; name: string };
  status: string;
  isFeatured?: boolean;
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

type BulkAction = "enable" | "disable" | "archive" | "restore" | "assignCategory" | "assignCountries" | "assignCollections" | "assignWarehouse" | "delete";

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
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("products.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("products.update");
  const canDelete = hasPermission("products.delete");
  const canCreate = hasPermission("products.create");

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [warehouseFilterId, setWarehouseFilterId] = useState("");
  const [sortBy, setSortBy] = useState("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const res = await adminApi.get("/products", {
        params: {
          search: debouncedSearch || undefined,
          status: status || undefined,
          categoryId: categoryId || undefined,
          warehouseId: warehouseFilterId || undefined,
          limit: 999999,
          ignoreMaxLimit: "true",
          sortBy,
          sortDir,
        },
      });
      const allIds = (res.data.data ?? []).map((p: any) => p.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} products across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all products.", "error");
    }
  };
  const [bulkAction, setBulkAction] = useState<BulkAction>("enable");
  const [bulkCategoryId, setBulkCategoryId] = useState("");
  const [bulkCountryIds, setBulkCountryIds] = useState<string[]>([]);
  const [bulkWarehouseId, setBulkWarehouseId] = useState("");
  const [warehouseAssignModalOpen, setWarehouseAssignModalOpen] = useState(false);
  const [warehouseAssignSelections, setWarehouseAssignSelections] = useState<Record<string, boolean>>({});
  const [bulkCollectionIds, setBulkCollectionIds] = useState<string[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<SpreadsheetPreview | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnsReady, setColumnsReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

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

  const { data, isLoading, refetch, isFetching } = useAdminProducts({ page, search: debouncedSearch, status, categoryId: categoryId || undefined, warehouseId: warehouseFilterId || undefined, limit, sortBy, sortDir });
  const { data: totalStats, isLoading: totalLoading } = useAdminProducts({ limit: 1 });
  const { data: activeStats, isLoading: activeLoading } = useAdminProducts({ status: "ACTIVE", limit: 1 });
  const { data: draftStats, isLoading: draftLoading } = useAdminProducts({ status: "DRAFT", limit: 1 });
  const { data: inactiveStats, isLoading: inactiveLoading } = useAdminProducts({ status: "INACTIVE", limit: 1 });

  const productStats = useMemo(() => {
    return {
      total: totalStats?.pagination?.total ?? 0,
      active: activeStats?.pagination?.total ?? 0,
      draft: draftStats?.pagination?.total ?? 0,
      inactive: inactiveStats?.pagination?.total ?? 0,
    };
  }, [totalStats, activeStats, draftStats, inactiveStats]);
  const { data: categories = [] } = useAdminCategories();
  const { data: countries = [] } = useAdminCountries();
  const { data: warehouses = [] } = useAdminWarehouses({ limit: 30 });
  const { data: collectionsData } = useAdminCollections({ limit: 200 });
  const deleteMutation = useDeleteProduct();
  const duplicateMutation = useDuplicateProduct();
  const archiveMutation = useArchiveProduct();
  const restoreMutation = useRestoreProduct();
  const reorderProducts = useReorderProducts();
  const bulkUpdate = useBulkUpdateProducts();

  const products = useMemo(() => (data?.data ?? []) as ProductRow[], [data?.data]);

  const columns: Column<ProductRow>[] = useMemo(() => {
    const cols: Column<ProductRow>[] = [];

    if (visibleColumns.image) {
      cols.push({
        key: "image",
        label: "Image",
        width: "72px",
        render: (product) =>
          product.media[0] ? (
            <img src={product.media[0].url} alt={product.title} className="h-10 w-10 flex-none rounded object-cover" />
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded bg-[#F2F2F2] text-[#9A9A9A]">
              <Layers size={16} />
            </div>
          ),
      });
    }

    if (visibleColumns.name) {
      cols.push({
        key: "name",
        label: "Product Name",
        width: "280px",
        render: (product) => (
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[13.5px] font-medium text-[#1A1A1A]">{product.title}</span>
              {product.isFeatured && (
                <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 border border-amber-200">
                  Featured
                </span>
              )}
            </div>
            <div className="truncate text-[11.5px] text-[#9A9A9A]">{product.productCode || product.id}</div>
          </div>
        ),
      });
    }

    if (visibleColumns.sku) {
      cols.push({
        key: "sku",
        label: "SKU",
        width: "130px",
        render: (product) => <span className="truncate text-[13px] text-[#555]">{product.sku || "—"}</span>,
      });
    }

    if (visibleColumns.brand) {
      cols.push({
        key: "brand",
        label: "Brand",
        width: "150px",
        render: (product) => <span className="truncate text-[13px] text-[#555]">{product.brand || "—"}</span>,
      });
    }

    if (visibleColumns.category) {
      cols.push({
        key: "category",
        label: "Category",
        width: "160px",
        render: (product) => <span className="truncate text-[13px] text-[#555]">{product.category?.name || "Uncategorized"}</span>,
      });
    }

    if (visibleColumns.status) {
      cols.push({
        key: "status",
        label: "Status",
        width: "120px",
        render: (product) => <StatusBadge status={product.status} />,
      });
    }

    if (visibleColumns.countries) {
      cols.push({
        key: "countries",
        label: "Country Availability",
        width: "130px",
        render: (product) => <span className="text-[13px] text-[#555]">{product.countries.length}</span>,
      });
    }

    if (visibleColumns.inventory) {
      cols.push({
        key: "inventory",
        label: "Inventory",
        width: "120px",
        render: (product) => {
          const inventory = getInventorySummary(product);
          return <span className="text-[13px] text-[#555]">{inventory.available} / {inventory.stock}</span>;
        },
      });
    }

    if (visibleColumns.price) {
      cols.push({
        key: "price",
        label: "Price",
        width: "120px",
        render: (product) => <span className="text-[13px] text-[#555]">{formatPrice(product)}</span>,
      });
    }

    if (visibleColumns.updated) {
      cols.push({
        key: "updated",
        label: "Updated Date",
        width: "140px",
        render: (product) => <span className="text-[13px] text-[#555]">{new Date(product.updatedAt).toLocaleDateString()}</span>,
      });
    }

    if (visibleColumns.actions) {
      cols.push({
        key: "actions",
        label: "Actions",
        width: "168px",
        render: (product) => (
          <div className="flex gap-1.5 md:justify-end" onClick={(e) => e.stopPropagation()}>
            {product.slug ? (
              <Link href={`/products/${product.slug}`} target="_blank" className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]" title="Preview on website">
                <ExternalLink size={13} />
              </Link>
            ) : (
              <span title="Product slug missing" className="flex h-7 w-7 cursor-not-allowed items-center justify-center rounded border border-[#E6E6E6] text-[#C4C4C4]">
                <ExternalLink size={13} />
              </span>
            )}
            {canUpdate && (
              <button type="button" onClick={() => handleDuplicate(product.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]" title="Duplicate product">
                <Copy size={13} />
              </button>
            )}
            {canUpdate && (
              <button
                type="button"
                onClick={() => handleArchiveToggle(product)}
                className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                title={product.status === "ARCHIVED" ? "Restore product" : "Archive product"}
              >
                {product.status === "ARCHIVED" ? <RotateCcw size={13} /> : <Archive size={13} />}
              </button>
            )}
            <Link
              href={`/admin/products/${product.id}/edit`}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
              title={canUpdate ? "Edit product" : "View product"}
            >
              {canUpdate ? <Pencil size={13} /> : <Eye size={13} />}
            </Link>
            {canDelete && (
              <button type="button" onClick={() => setDeleting(product.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50" title="Delete product">
                <Trash2 size={13} />
              </button>
            )}
          </div>
        ),
      });
    }

    return cols;
  }, [visibleColumns, canUpdate, canDelete]);

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

  const handleProductsWarehouseAssignSubmit = async () => {
    const selectedWarehouseIds = Object.keys(warehouseAssignSelections).filter(id => warehouseAssignSelections[id]);
    if (!selectedWarehouseIds.length) {
      showToast("Please select at least one warehouse.", "error");
      return;
    }

    setWarehouseAssignModalOpen(false);
    try {
      for (const wId of selectedWarehouseIds) {
        await bulkUpdate.mutateAsync({
          ids: selectedIds,
          action: "assignWarehouse",
          warehouseId: wId,
        });
      }
      setSelectedIds([]);
      setBulkAction("enable");
      showToast("Warehouse assignments completed successfully.", "success");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to assign warehouses."), "error");
    }
  };

  const handleBulkAction = async () => {
    if (bulkAction === "assignWarehouse") return;
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
      const response = await adminApi.post("/products/import/preview", formData);
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
      const response = await adminApi.post("/products/import", formData);
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

  if (authLoading || !hasPermission("products.view")) {
    return null;
  }

  return (
    <AdminLayout title="Products" breadcrumb={[{ label: "Products" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Total Products", value: productStats.total, subtitle: "All catalog items", icon: <Package size={18} />, isLoading: totalLoading },
          { title: "Active Products", value: productStats.active, subtitle: "Currently live on storefront", icon: <CheckCircle2 size={18} />, color: "bg-green-600", isLoading: activeLoading },
          { title: "Draft Products", value: productStats.draft, subtitle: "Unpublished drafts", icon: <FileText size={18} />, color: "bg-amber-600", isLoading: draftLoading },
          { title: "Inactive Products", value: productStats.inactive, subtitle: "Disabled / hidden", icon: <XCircle size={18} />, color: "bg-gray-600", isLoading: inactiveLoading }
        ]}
      />

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val: string) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search products...",
            widthClassName: "w-[220px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [status, categoryId, warehouseFilterId, sortBy !== "sortOrder" ? sortBy : ""].filter(Boolean).length,
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key: string) => setVisibleColumns((current) => ({ ...current, [key]: !current[key as ColumnKey] })),
            options: (Object.keys(DEFAULT_COLUMNS) as ColumnKey[]).map((k) => ({ key: k, label: k })),
          }}
          exportAction={{
            onClick: () => exportProducts(selectedIds.length > 0),
            label: selectedIds.length > 0 ? `Export Selected (${selectedIds.length})` : "Export Excel",
          }}
          importAction={{
            onClick: openImportDialog,
            label: "Import Excel",
          }}
          refresh={{
            onRefresh: refetch,
            isRefreshing: isFetching,
          }}
          primaryAction={canCreate ? { href: "/admin/products/create", label: "New Product" } : undefined}
          onResetFilters={() => {
            setStatus("");
            setCategoryId("");
            setWarehouseFilterId("");
            setSortBy("sortOrder");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="flex flex-wrap items-center gap-3">
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none min-w-[140px]"
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
                className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none min-w-[140px]"
              >
                <option value="">All Categories</option>
                {categories.map((category: { id: string; name: string }) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
              <select
                value={warehouseFilterId}
                onChange={(e) => {
                  setWarehouseFilterId(e.target.value);
                  setPage(1);
                }}
                className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none min-w-[140px]"
              >
                <option value="">All Warehouses</option>
                {(warehouses.data ?? warehouses).map((w: any) => (
                  <option key={w.id} value={w.id}>
                    {w.name} {w.state ? `(${w.state})` : ''} {w.country?.code ? `[${w.country.code}]` : ''}
                  </option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none min-w-[140px]"
              >
                <option value="sortOrder">Sort order</option>
                <option value="title">Name</option>
                <option value="sku">SKU</option>
                <option value="brand">Brand</option>
                <option value="category">Category</option>
                <option value="status">Status</option>
                <option value="updatedAt">Updated date</option>
              </select>
              <select value={sortDir} onChange={(e) => setSortDir(e.target.value as "asc" | "desc")} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none min-w-[140px]">
                <option value="asc">Ascending</option>
                <option value="desc">Descending</option>
              </select>
            </div>
          }
        />
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

      <DataTable<ProductRow>
        title="Product Catalog"
        columns={columns}
        data={products}
        rowKey="id"
        isLoading={isLoading}
        emptyMessage="No products found. Create your first product."
        enableSelection={true}
        selectedIds={selectedIds}
        onSelectionChange={setSelectedIds}
        enableReorder={canUpdate && sortBy === "sortOrder"}
        onReorder={handleReorder}
        disabledReorder={reorderProducts.isPending}
        rowTooltip={canUpdate && sortBy === "sortOrder" ? "Drag product to reorder" : undefined}
        totalItems={data?.pagination?.total ?? 0}
        currentPage={page}
        pageSize={limit}
        totalPages={data?.pagination?.totalPages || 1}
        onPageChange={setPage}
        onPageSizeChange={setLimit}
        pageSizeOptions={[10, 25, 50, 100]}
        onSelectAll={handleSelectAll}
        renderBulkActions={(selectedIds) => (
          <AdminBulkActionsBar
            selectedCount={selectedIds.length}
            onClear={() => setSelectedIds([])}
            actionType={bulkAction}
            onActionTypeChange={(val) => {
              const action = val as BulkAction;
              setBulkAction(action);
              if (action === "assignWarehouse") {
                if (selectedIds.length === 0) {
                  showToast("Please select at least one product first.", "error");
                  setTimeout(() => setBulkAction("enable"), 0);
                  return;
                }
                setWarehouseAssignSelections({});
                setWarehouseAssignModalOpen(true);
              }
            }}
            actions={[
              { value: "enable", label: "Enable" },
              { value: "disable", label: "Disable" },
              { value: "archive", label: "Archive" },
              { value: "restore", label: "Restore" },
              { value: "assignCategory", label: "Assign category" },
              { value: "assignCountries", label: "Enable countries" },
              { value: "assignCollections", label: "Assign collections" },
              { value: "assignWarehouse", label: "Assign warehouse" },
              { value: "delete", label: "Delete" },
            ]}
            onApply={handleBulkAction}
            applyLoading={bulkUpdate.isPending}
            applyDisabled={bulkAction === "assignWarehouse"}
            renderExtraSelectors={() => (
              <>
                {bulkAction === "assignCategory" && (
                  <select
                    value={bulkCategoryId}
                    onChange={(event) => setBulkCategoryId(event.target.value)}
                    className="h-8 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24] shadow-sm"
                  >
                    <option value="">Select category</option>
                    {categories.map((category: { id: string; name: string }) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                )}
                {bulkAction === "assignCountries" && (
                  <div className="w-[180px]">
                    <AdminMultiSelect
                      options={countries.map((country: { id: string; code: string; name: string }) => ({ value: country.id, label: `${country.name} (${country.code})` }))}
                      value={bulkCountryIds}
                      onChange={setBulkCountryIds}
                      placeholder="Select active countries..."
                      className="h-[32px] py-0 px-3 text-[12.5px]"
                    />
                  </div>
                )}
                {bulkAction === "assignCollections" && (
                  <div className="w-[180px]">
                    <AdminMultiSelect
                      options={(collectionsData?.data ?? []).map((collection: { id: string; name: string }) => ({ value: collection.id, label: collection.name }))}
                      value={bulkCollectionIds}
                      onChange={setBulkCollectionIds}
                      placeholder="Select collections..."
                      className="h-[32px] py-0 px-3 text-[12.5px]"
                    />
                  </div>
                )}
              </>
            )}
          />
        )}
      />

      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />

      <Modal
        open={warehouseAssignModalOpen}
        onClose={() => { setWarehouseAssignModalOpen(false); setBulkAction("enable"); }}
        title="Assign Selected Products to Warehouses"
        panelClassName="max-w-md"
      >
        <div className="space-y-4 p-6">
          <p className="text-[13px] text-[#6B6B6B]">
            Select which warehouses you want to assign the selected products to.
          </p>
          <div className="max-h-[300px] overflow-y-auto border border-[#E6E6E6] rounded-md divide-y divide-[#E6E6E6] px-4 bg-white">
            {(warehouses.data ?? warehouses).map((w: any) => (
              <div key={w.id} className="flex items-center py-3 gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-[13px] text-[#1A1A1A] font-medium min-w-0 w-full">
                  <input
                    type="checkbox"
                    checked={warehouseAssignSelections[w.id] || false}
                    onChange={(e) => setWarehouseAssignSelections(prev => ({ ...prev, [w.id]: e.target.checked }))}
                    className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                  />
                  <span className="truncate">
                    {w.name} {w.state ? `(${w.state})` : ''} {w.country?.code ? `[${w.country.code}]` : ''}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { setWarehouseAssignModalOpen(false); setBulkAction("enable"); }}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={handleProductsWarehouseAssignSubmit}
              loading={bulkUpdate.isPending}
              loadingText="Assigning..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              Assign
            </LoadingButton>
          </div>
        </div>
      </Modal>

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
            Upload an `.xlsx` or `.csv` file. The first sheet is validated on the server before any product is created or updated.
          </p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
            >
              <Upload size={14} />
              {importFile ? importFile.name : "Choose Excel / CSV File"}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.csv"
              className="hidden"
              onChange={(e) => handleImportFile(e.target.files?.[0])}
            />
            {importFile && (
              <button
                type="button"
                onClick={() => {
                  setImportFile(null);
                  setImportPreview(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                className="text-[12.5px] text-red-600 hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          {importing && (
            <div className="flex items-center gap-2 text-[13px] text-[#6B6B6B]">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#E31E24] border-t-transparent" />
              Parsing file preview...
            </div>
          )}
          {importPreview ? (
            <div className="space-y-3 rounded-lg border border-[#E6E6E6] bg-[#FAFAFA] p-4">
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <div className="rounded border border-[#E6E6E6] bg-white p-3">
                  <div className="text-[11.5px] font-semibold text-[#9A9A9A]">Total Rows</div>
                  <div className="mt-1 text-[20px] font-semibold text-[#1A1A1A]">{importPreview.totalRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] bg-white p-3">
                  <div className="text-[11.5px] font-semibold text-[#9A9A9A]">Valid Rows</div>
                  <div className="mt-1 text-[20px] font-semibold text-emerald-600">{importPreview.validRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] bg-white p-3">
                  <div className="text-[11.5px] font-semibold text-[#9A9A9A]">Invalid Rows</div>
                  <div className="mt-1 text-[20px] font-semibold text-red-600">{importPreview.invalidRows}</div>
                </div>
                <div className="rounded border border-[#E6E6E6] bg-white p-3">
                  <div className="text-[11.5px] font-semibold text-[#9A9A9A]">Duplicate Warnings</div>
                  <div className="mt-1 text-[20px] font-semibold text-amber-600">{importPreview.duplicateWarnings.length}</div>
                </div>
              </div>
              {importPreview.issues.length > 0 ? (
                <div>
                  <h4 className="mb-2 text-[13px] font-semibold text-[#1A1A1A]">Validation Issues</h4>
                  <div className="max-h-48 overflow-y-auto rounded border border-[#E6E6E6]">
                    {importPreview.issues.map((issue: any, index: number) => (
                      <div key={`${issue.row}-${issue.field}-${index}`} className="border-b border-[#F0F0F0] px-3 py-2 text-[13px] last:border-b-0">
                        <span className="font-semibold text-[#E31E24]">Row {issue.row}</span> <span className="text-[#6B6B6B]">[{issue.field}]</span> {issue.message}
                      </div>
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
            <LoadingButton
              type="button"
              onClick={confirmImport}
              loading={importing}
              loadingText="Importing..."
              disabled={!importFile || !!importPreview?.invalidRows}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white disabled:opacity-60"
            >
              Import Products
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {ToastComponent}
    </AdminLayout>
  );
}
