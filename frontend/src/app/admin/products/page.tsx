"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminListToolbar,
  AdminStatsGrid,
  Column,
  AdminDeleteModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
  AdminMultiSelect,
  AdminSelect,
} from "@/components/admin/AdminComponents";
import { AdminRowActions, AdminActionButton } from "@/components/admin/AdminRowActions";
import { toSortOrderPayload } from "@/components/admin/SortableList";
import { Modal } from "@/components/ui/Modal";
import { AdminImportWizard, WizardColumnDef } from "@/components/admin/AdminImportWizard";
import {
  useAdminCategories,
  useAdminCollections,
  useAdminCountries,
  useAdminProducts,
  useBulkUpdateProducts,
  useDuplicateProduct,
  useDeleteProduct,
  usePermanentDeleteProduct,
  useReorderProducts,
  useAdminWarehouses,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { formatDate } from "@/utils/formatDate";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Package,
  Pencil,
  Plus,
  Trash2,
  Upload,
  XCircle,
  Eye,
} from "lucide-react";

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
  prices: { sellingPrice: string | number; currency: { symbol: string; code: string; isBase?: boolean } }[];
  updatedAt: string;
  createdAt: string;
}

type BulkAction = "enable" | "disable" | "assignCategory" | "assignCountries" | "assignCollections" | "assignWarehouse" | "delete";

type ColumnKey = "product" | "sku" | "brand" | "category" | "status" | "countries" | "inventory" | "price" | "updated";

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
  product: true,
  sku: true,
  brand: true,
  category: true,
  status: true,
  countries: true,
  inventory: true,
  price: true,
  updated: true,
};

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "product", label: "Product" },
  { key: "sku", label: "SKU" },
  { key: "brand", label: "Brand" },
  { key: "category", label: "Category" },
  { key: "status", label: "Status" },
  { key: "countries", label: "Country Availability" },
  { key: "inventory", label: "Inventory" },
  { key: "price", label: "Price" },
  { key: "updated", label: "Updated Date" },
];

const PRODUCT_COLUMNS_STORAGE_KEY = "admin-products-columns-v3";

const productExpectedColumns = [
  { name: "title", required: true, hint: "Full title of the product" },
  { name: "categoryName", required: true, hint: "Category Name (e.g. Brackets) or Category Slug" },
  { name: "sku", hint: "Unique SKU identifier" },
  { name: "productCode", hint: "Unique internal product code" },
  { name: "imageUrl", hint: "Direct image URL or comma-separated image URLs" },
  { name: "brand", hint: "Brand name, defaults to Modern Orthodontics" },
  { name: "status", hint: "ACTIVE, INACTIVE, DRAFT, ARCHIVED" },
  { name: "countryCodes", hint: "All countries (ALL) or comma-separated country codes, e.g. IN, US, GB" },
];

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
  const [limit, setLimit] = useState(10);
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
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnsReady, setColumnsReady] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, categoryId, warehouseFilterId, sortBy, sortDir, limit]);

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

  const { data, isLoading, refetch, isFetching } = useAdminProducts({
    page,
    search: debouncedSearch || undefined,
    status: status || undefined,
    categoryId: categoryId || undefined,
    warehouseId: warehouseFilterId || undefined,
    limit,
    sortBy,
    sortDir,
  });

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

  const wizardCountryOptions = useMemo(() => {
    const list = (countries || [])
      .filter((c: any) => c.status === "ACTIVE" || !c.status)
      .map((c: any) => ({
        label: `${c.name} (${c.code.toUpperCase()})`,
        value: c.code.toUpperCase(),
      }));
    return [
      { label: "All countries", value: "ALL" },
      ...list,
    ];
  }, [countries]);

  const categoryOptions = useMemo(() => {
    return (categories as Array<{ id: string; name: string; slug: string }>).map((c) => ({
      label: c.name,
      value: c.name,
    }));
  }, [categories]);

  const productWizardColumns: WizardColumnDef[] = useMemo(() => [
    { key: "title", header: "Title", required: true, minWidth: "200px" },
    { key: "sku", header: "SKU", minWidth: "140px" },
    { key: "productCode", header: "Product Code", minWidth: "140px" },
    {
      key: "categoryName",
      header: "Category",
      required: true,
      type: "select",
      options: categoryOptions,
      minWidth: "160px",
    },
    { key: "imageUrl", header: "Image URL", minWidth: "180px", placeholder: "https://..." },
    { key: "brand", header: "Brand", minWidth: "130px" },
    {
      key: "status",
      header: "Status",
      type: "select",
      options: [
        { label: "Active", value: "ACTIVE" },
        { label: "Inactive", value: "INACTIVE" },
        { label: "Draft", value: "DRAFT" },
        { label: "Archived", value: "ARCHIVED" },
      ],
      minWidth: "120px",
    },
    {
      key: "countryCodes",
      header: "Countries",
      type: "multiselect",
      options: wizardCountryOptions,
      minWidth: "160px",
      placeholder: "All countries or IN, US...",
    },
  ], [categoryOptions, wizardCountryOptions]);
  const { data: warehouses = [] } = useAdminWarehouses({ limit: 30 });
  const { data: collectionsData } = useAdminCollections({ limit: 200 });
  const deleteMutation = useDeleteProduct();
  const permanentDeleteMutation = usePermanentDeleteProduct();
  const duplicateMutation = useDuplicateProduct();
  const reorderProducts = useReorderProducts();
  const bulkUpdate = useBulkUpdateProducts();
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const products = useMemo(() => (data?.data ?? []) as ProductRow[], [data?.data]);

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
    const price = product.prices.find((p) => p.currency?.isBase || p.currency?.code === "INR") ?? product.prices[0];
    if (!price) return "—";
    return `${price.currency.symbol}${Number(price.sellingPrice).toFixed(2)}`;
  };

  const columns: Column<ProductRow>[] = useMemo(() => {
    const cols: Column<ProductRow>[] = [];

    if (visibleColumns.product !== false) {
      cols.push({
        key: "product",
        label: "Product",
        width: "280px",
        render: (product) => (
          <div className="flex items-center gap-3 min-w-0">
            {product.media[0] ? (
              <img
                src={product.media[0].url}
                alt={product.title}
                className="h-10 w-10 flex-none rounded object-cover border border-[#E6E6E6]"
              />
            ) : (
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded bg-[#F2F2F2] text-[#9A9A9A] border border-[#E6E6E6]">
                <Package size={16} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[13.5px] font-medium text-[#1A1A1A] block">
                  {product.title}
                </span>
                {product.isFeatured && (
                  <span className="inline-flex items-center rounded-full bg-amber-50 px-2 py-0.5 text-[10.5px] font-semibold text-amber-700 border border-amber-200 shrink-0">
                    Featured
                  </span>
                )}
              </div>
              <div className="truncate text-[11.5px] text-[#9A9A9A]">
                {product.productCode || product.sku || product.id}
              </div>
            </div>
          </div>
        ),
      });
    }

    if (visibleColumns.sku !== false) {
      cols.push({
        key: "sku",
        label: "SKU",
        width: "120px",
        render: (product) => <span className="truncate text-[13px] text-[#555]">{product.sku || "—"}</span>,
      });
    }

    if (visibleColumns.brand !== false) {
      cols.push({
        key: "brand",
        label: "Brand",
        width: "130px",
        render: (product) => <span className="truncate text-[13px] text-[#555]">{product.brand || "—"}</span>,
      });
    }

    if (visibleColumns.category !== false) {
      cols.push({
        key: "category",
        label: "Category",
        width: "140px",
        render: (product) => <span className="truncate text-[13px] text-[#555]">{product.category?.name || "Uncategorized"}</span>,
      });
    }

    if (visibleColumns.status !== false) {
      cols.push({
        key: "status",
        label: "Status",
        width: "100px",
        render: (product) => <StatusBadge status={product.status} />,
      });
    }

    if (visibleColumns.countries !== false) {
      cols.push({
        key: "countries",
        label: "Country Availability",
        width: "120px",
        render: (product) => <span className="text-[13px] text-[#555] font-medium">{product.countries.length}</span>,
      });
    }

    if (visibleColumns.inventory !== false) {
      cols.push({
        key: "inventory",
        label: "Inventory",
        width: "110px",
        render: (product) => {
          const inventory = getInventorySummary(product);
          return <span className="text-[13px] text-[#555]">{inventory.available} / {inventory.stock}</span>;
        },
      });
    }

    if (visibleColumns.price !== false) {
      cols.push({
        key: "price",
        label: "Price",
        width: "100px",
        render: (product) => <span className="text-[13px] text-[#555] font-medium">{formatPrice(product)}</span>,
      });
    }

    if (visibleColumns.updated !== false) {
      cols.push({
        key: "updated",
        label: "Updated Date",
        width: "110px",
        render: (product) => <span className="text-[12px] text-[#777]">{formatDate(product.updatedAt)}</span>,
      });
    }

    cols.push({
      key: "actions",
      label: "Actions",
      width: "140px",
      render: (product) => (
        <AdminRowActions
          view={
            product.slug
              ? {
                  title: "View on Storefront",
                  href: `/products/${product.slug}`,
                  target: "_blank",
                  icon: <ExternalLink size={13} />,
                }
              : undefined
          }
          edit={
            canUpdate
              ? {
                  title: "Edit Product",
                  href: `/admin/products/${product.id}/edit`,
                }
              : {
                  title: "View Product",
                  href: `/admin/products/${product.id}/edit`,
                  icon: <Eye size={13} />,
                }
          }
          extra={
            canUpdate ? (
              <AdminActionButton
                action={{
                  onClick: () => handleDuplicate(product.id),
                  title: "Duplicate Product",
                  icon: <Copy size={13} />,
                }}
                defaultIcon={<Copy size={13} />}
                defaultTitle="Duplicate Product"
              />
            ) : null
          }
          delete={
            canDelete
              ? {
                  title: "Delete Product",
                  onClick: () => setDeleting(product.id),
                }
              : undefined
          }
        />
      ),
    });

    return cols;
  }, [visibleColumns, canUpdate, canDelete]);

  const deletingProduct = useMemo(() => {
    if (!deleting) return null;
    return products.find((p) => p.id === deleting) || null;
  }, [deleting, products]);

  const handleDelete = async () => {
    if (!deleting) return;
    try {
      await deleteMutation.mutateAsync(deleting);
      setSelectedIds((current) => current.filter((id) => id !== deleting));
      showToast("Product soft-deleted.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete product."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!deleting) return;
    try {
      await permanentDeleteMutation.mutateAsync(deleting);
      setSelectedIds((current) => current.filter((id) => id !== deleting));
      showToast("Product permanently deleted from database.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to permanently delete product."), "error");
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
    if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }
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
    setImportOpen(true);
  };

  const handleResetFilters = () => {
    setSearch("");
    setDebouncedSearch("");
    setStatus("");
    setCategoryId("");
    setWarehouseFilterId("");
    setSortBy("sortOrder");
    setSortDir("asc");
    setLimit(10);
    setPage(1);
  };

  if (authLoading || !hasPermission("products.view")) {
    return null;
  }

  return (
    <AdminLayout title="Products" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Products" }]}>
      <div className="space-y-5">
        {/* 1. TOP KPI SUMMARY GRID */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Products",
              value: productStats.total,
              subtitle: "All catalog items",
              icon: <Package size={18} />,
              isLoading: totalLoading,
            },
            {
              title: "Active Products",
              value: productStats.active,
              subtitle: "Currently live on storefront",
              icon: <CheckCircle2 size={18} />,
              color: "bg-green-600",
              isLoading: activeLoading,
            },
            {
              title: "Draft Products",
              value: productStats.draft,
              subtitle: "Unpublished drafts",
              icon: <FileText size={18} />,
              color: "bg-amber-600",
              isLoading: draftLoading,
            },
            {
              title: "Inactive Products",
              value: productStats.inactive,
              subtitle: "Disabled / hidden",
              icon: <XCircle size={18} />,
              color: "bg-gray-600",
              isLoading: inactiveLoading,
            },
          ]}
        />

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search products...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: [status, categoryId, warehouseFilterId, sortBy !== "sortOrder" ? sortBy : ""].filter(Boolean).length,
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key: string) =>
              setVisibleColumns((current) => ({
                ...current,
                [key as ColumnKey]: current[key as ColumnKey] === false ? true : false,
              })),
            options: COLUMN_OPTIONS,
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
            onRefresh: () => {
              void refetch().then(() => showToast("Products refreshed."));
            },
            isRefreshing: isFetching,
          }}
          primaryAction={
            canCreate
              ? {
                  href: "/admin/products/create",
                  label: "New Product",
                  icon: <Plus size={15} />,
                }
              : undefined
          }
          onResetFilters={handleResetFilters}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <AdminSelect
                label="Status"
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "DRAFT", label: "Draft" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                  { value: "ARCHIVED", label: "Archived" },
                ]}
              />
              <AdminSelect
                label="Category"
                value={categoryId}
                onChange={(e) => {
                  setCategoryId(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Categories" },
                  ...categories.map((category: { id: string; name: string }) => ({
                    value: category.id,
                    label: category.name,
                  })),
                ]}
              />
              <AdminSelect
                label="Warehouse"
                value={warehouseFilterId}
                onChange={(e) => {
                  setWarehouseFilterId(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Warehouses" },
                  ...(warehouses.data ?? warehouses).map((w: any) => ({
                    value: w.id,
                    label: `${w.name}${w.state ? ` (${w.state})` : ""}${w.country?.code ? ` [${w.country.code}]` : ""}`,
                  })),
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: "sortOrder", label: "Custom Sort Order" },
                  { value: "title", label: "Product Name" },
                  { value: "sku", label: "SKU" },
                  { value: "brand", label: "Brand" },
                  { value: "category", label: "Category" },
                  { value: "status", label: "Status" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "createdAt", label: "Created Date" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
              />
            </div>
          }
        />


        {/* 3. FULL-WIDTH DATA TABLE WITH BULK ACTIONS */}
        <DataTable<ProductRow>
          title="Product Catalog"
          columns={columns}
          data={products}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage={
            debouncedSearch || status || categoryId || warehouseFilterId
              ? "No products matched your search or filter."
              : "No products found. Create your first product."
          }
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
          onPageSizeChange={(newLimit) => {
            setLimit(newLimit);
            setPage(1);
          }}
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
                        options={countries.map((country: { id: string; code: string; name: string }) => ({
                          value: country.id,
                          label: `${country.name} (${country.code})`,
                        }))}
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
                        options={(collectionsData?.data ?? []).map((collection: { id: string; name: string }) => ({
                          value: collection.id,
                          label: collection.name,
                        }))}
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

        {/* 4. BOTTOM PAGINATION MATCHING TAX / ORDERS */}
        <div className="flex items-center justify-end mt-4">
          <Pagination
            page={page}
            totalPages={data?.pagination?.totalPages || 1}
            onPageChange={setPage}
            alwaysShow={true}
          />
        </div>
      </div>

      {/* WAREHOUSE ASSIGN MODAL */}
      <Modal
        open={warehouseAssignModalOpen}
        onClose={() => {
          setWarehouseAssignModalOpen(false);
          setBulkAction("enable");
        }}
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
                    onChange={(e) =>
                      setWarehouseAssignSelections((prev) => ({ ...prev, [w.id]: e.target.checked }))
                    }
                    className="rounded border-[#E6E6E6] text-[#E31E24] focus:ring-[#E31E24]"
                  />
                  <span className="truncate">
                    {w.name} {w.state ? `(${w.state})` : ""} {w.country?.code ? `[${w.country.code}]` : ""}
                  </span>
                </label>
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => {
                setWarehouseAssignModalOpen(false);
                setBulkAction("enable");
              }}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2] cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={handleProductsWarehouseAssignSubmit}
              loading={bulkUpdate.isPending}
              loadingText="Assigning..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] cursor-pointer"
            >
              Assign
            </LoadingButton>
          </div>
        </div>
      </Modal>

      {/* SINGLE DELETE MODAL */}
      <AdminDeleteModal
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        itemName={deletingProduct?.title}
        itemType="Product"
        onSoftDelete={handleDelete}
        onPermanentDelete={handlePermanentDelete}
        isSoftDeleting={deleteMutation.isPending}
        isPermanentDeleting={permanentDeleteMutation.isPending}
      />

      {/* BULK DELETE MODAL */}
      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected products`}
        itemType="Products (Bulk)"
        onSoftDelete={async () => {
          try {
            await bulkUpdate.mutateAsync({
              ids: selectedIds,
              action: "delete",
            });
            showToast(`Successfully soft-deleted ${selectedIds.length} product(s).`);
            setSelectedIds([]);
            setShowBulkDeleteModal(false);
            refetch();
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Bulk delete failed."), "error");
          }
        }}
        onPermanentDelete={async () => {
          try {
            await Promise.all(selectedIds.map((id) => permanentDeleteMutation.mutateAsync(id)));
            showToast(`Successfully permanently deleted ${selectedIds.length} product(s).`);
            setSelectedIds([]);
            setShowBulkDeleteModal(false);
            refetch();
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Bulk permanent delete failed."), "error");
          }
        }}
        isSoftDeleting={bulkUpdate.isPending}
        isPermanentDeleting={permanentDeleteMutation.isPending}
        softDeleteDescription={`Hides the ${selectedIds.length} selected products from the storefront catalog while preserving all order history, quotes, and reports.`}
        permanentDeleteDescription={`Physically purges the ${selectedIds.length} selected products from the database. Any product with existing order or quote lines will be blocked.`}
      />

      {/* EXCEL IMPORT WIZARD */}
      <AdminImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Products Excel"
        subtitle="Upload an .xlsx or .csv file to bulk create or update catalog products with live preview & direct inline editing."
        entityName="products"
        columns={productWizardColumns}
        expectedColumns={productExpectedColumns}
        sampleTemplateUrl="/products/sample-template"
        sampleTemplateFilename="products-template.xlsx"
        previewEndpoint="/products/import/preview"
        executeEndpoint="/products/import"
        onSuccess={(result) => {
          showToast(
            `Import complete: ${result?.created ?? 0} created, ${result?.updated ?? 0} updated.`,
            "success"
          );
          refetch();
        }}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
