"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Clock3,
  Download,
  Filter,
  History,
  Layers,
  Search,
  SlidersHorizontal,
  Trash2,
  Upload,
  X,
  AlertTriangle,
  Package,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { formatDate, formatDateTime } from "@/utils/formatDate";
import {
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  Pagination,
  StatusBadge,
  useToast,
  AdminBulkActionsBar,
  AdminDeleteModal,
  DataTable,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import { AdminRowActions, AdminActionButton } from "@/components/admin/AdminRowActions";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { Modal } from "@/components/ui/Modal";
import { AdminImportWizard, WizardColumnDef } from "@/components/admin/AdminImportWizard";
import {
  useAdminInventory,
  useAdminInventoryAdjustments,
  useAdminInventoryAlerts,
  useAdminInventoryDashboard,
  useAdminVariantInventoryAdjustments,
  useBulkUpdateInventory,
  useUpdateInventory,
  useAdminWarehouses,
  useAdminProducts,
  useAdminVariants,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type InventoryRow = {
  id: string;
  variantId?: string | null;
  warehouseId?: string | null;
  warehouse?: { id: string; name: string; gstin?: string; state?: string; countryId?: string } | null;
  product: {
    id: string;
    title: string;
    sku?: string | null;
    brand?: string | null;
    status?: string | null;
    updatedAt?: string;
    countries?: { country: { id: string; name: string; code: string } }[];
  };
  variant?: {
    id: string;
    title: string;
    sku?: string | null;
    product?: { id: string; title: string; sku?: string | null } | null;
  } | null;
  stock: number;
  reservedStock: number;
  lowStockThreshold: number;
  status: string;
  updatedAt: string;
};

type Adjustment = {
  id: string;
  previousQty: number;
  newQty: number;
  reason?: string | null;
  adjustedBy?: string | null;
  createdAt: string;
  variant?: { title: string; sku?: string | null; product?: { title: string; sku?: string | null } | null } | null;
};

type SpreadsheetReport = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: Array<{ row: number; field: string; message: string }>;
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

type InventoryColumnKey = "warehouse" | "reserved" | "threshold" | "status" | "updated";

const DEFAULT_COLUMNS: Record<InventoryColumnKey, boolean> = {
  warehouse: true,
  reserved: true,
  threshold: true,
  status: true,
  updated: true,
};

const COLUMN_OPTIONS: { key: InventoryColumnKey; label: string }[] = [
  { key: "warehouse", label: "Warehouse" },
  { key: "reserved", label: "Reserved Stock" },
  { key: "threshold", label: "Low Stock At" },
  { key: "status", label: "Status" },
  { key: "updated", label: "Updated Date" },
];

const STORAGE_KEY = "admin-inventory-columns-v2";

function formatReason(reason?: string | null) {
  if (!reason) return "Unspecified";
  return reason.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function formatAdjustmentDelta(adjustment: Adjustment) {
  const delta = adjustment.newQty - adjustment.previousQty;
  return `${delta > 0 ? "+" : ""}${delta}`;
}

function AdjustmentRows({ adjustments, emptyMessage }: { adjustments: Adjustment[]; emptyMessage: string }) {
  if (!adjustments.length) return <div className="py-4 text-[13px] text-[#9A9A9A]">{emptyMessage}</div>;

  return (
    <div className="divide-y divide-[#EFEFEF]">
      {adjustments.map((adjustment) => {
        const delta = adjustment.newQty - adjustment.previousQty;
        return (
          <div key={adjustment.id} className="grid gap-3 py-3 text-[13px] md:grid-cols-[1.35fr_110px_1fr_1fr]">
            <div>
              <div className="font-medium text-[#1A1A1A]">{new Date(adjustment.createdAt).toLocaleString()}</div>
              <div className="mt-0.5 text-[12px] text-[#9A9A9A]">
                {adjustment.variant?.product?.title}
                {adjustment.variant?.title ? ` / ${adjustment.variant.title}` : ""}
              </div>
            </div>
            <div>
              <span className={delta >= 0 ? "font-semibold text-emerald-700" : "font-semibold text-[#E31E24]"}>
                {formatAdjustmentDelta(adjustment)}
              </span>
              <span className="ml-2 text-[#6B6B6B]">
                {adjustment.previousQty} &rarr; {adjustment.newQty}
              </span>
            </div>
            <div className="text-[#6B6B6B]">{formatReason(adjustment.reason)}</div>
            <div className="text-[#6B6B6B]">{adjustment.adjustedBy || "System"}</div>
          </div>
        );
      })}
    </div>
  );
}

function tinyNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

const inventoryWizardColumns: WizardColumnDef[] = [
  { key: "productSku", header: "Product SKU", minWidth: "140px" },
  { key: "variantSku", header: "Variant SKU", minWidth: "140px" },
  { key: "stock", header: "Stock", required: true, type: "number", minWidth: "100px" },
  { key: "reservedStock", header: "Reserved Stock", type: "number", minWidth: "110px" },
  { key: "lowStockThreshold", header: "Low Stock Alert", type: "number", minWidth: "120px" },
  { key: "warehouseId", header: "Country / Warehouse", minWidth: "140px", placeholder: "e.g. IN, US" },
];

const inventoryExpectedColumns = [
  { name: "stock", required: true, hint: "Available physical stock" },
  { name: "variantSku", hint: "SKU of specific variant" },
  { name: "productSku", hint: "SKU of parent product" },
  { name: "variantId", hint: "Database ID of variant" },
  { name: "reservedStock", hint: "Reserved quantity" },
  { name: "lowStockThreshold", hint: "Threshold before low stock warning" },
  { name: "warehouseId", hint: "Country code (e.g. IN) or warehouse ID" },
];

export default function InventoryPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("inventory.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("inventory.update");

  const [activeTab, setActiveTab] = useState<"levels" | "alerts" | "activity">("levels");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [limit, setLimit] = useState(20);
  const [warehouseFilterId, setWarehouseFilterId] = useState("");
  const [productFilterId, setProductFilterId] = useState("");
  const [variantFilterId, setVariantFilterId] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Record<InventoryColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnsReady, setColumnsReady] = useState(false);
  const [historyRow, setHistoryRow] = useState<InventoryRow | null>(null);
  const [bulkStock, setBulkStock] = useState("");
  const [bulkThreshold, setBulkThreshold] = useState("");
  const [bulkAction, setBulkAction] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [warehouseAssignModalOpen, setWarehouseAssignModalOpen] = useState(false);
  const [warehouseAssignSelections, setWarehouseAssignSelections] = useState<Record<string, boolean>>({});
  const [warehouseAssignStocks, setWarehouseAssignStocks] = useState<Record<string, string>>({});
  const [bulkSaving, setBulkSaving] = useState(false);
  const [unassignTarget, setUnassignTarget] = useState<InventoryRow | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);

  const { showToast, ToastComponent } = useToast();

  const { data: productsData } = useAdminProducts({ limit: 1000, sortBy: "title", sortDir: "asc" });
  const { data: variantsData } = useAdminVariants({ limit: 1000, productId: productFilterId || undefined, sortBy: "title", sortDir: "asc" });

  const productOptions = useMemo(() => {
    const list = ((productsData as any)?.data ?? []) as any[];
    return list.map((p) => ({
      value: p.id,
      label: `${p.title}${p.productCode ? ` (${p.productCode})` : p.sku ? ` (${p.sku})` : ""}`,
    }));
  }, [productsData]);

  const variantOptions = useMemo(() => {
    const list = ((variantsData as any)?.data ?? []) as any[];
    return list.map((v) => ({
      value: v.id,
      label: `${v.title || v.sku || "Variant"}${v.product?.title ? ` - ${v.product.title}` : ""}${v.sku ? ` (${v.sku})` : ""}`,
    }));
  }, [variantsData]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) setVisibleColumns({ ...DEFAULT_COLUMNS, ...JSON.parse(raw) });
    } catch {
      // Ignore broken saved preferences.
    }
    setColumnsReady(true);
  }, []);

  useEffect(() => {
    if (!columnsReady) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibleColumns));
  }, [columnsReady, visibleColumns]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setSelectedIds([]);
  }, [search, status, sortBy, sortDir, warehouseFilterId, productFilterId, variantFilterId]);

  const inventoryQuery = useAdminInventory({
    page,
    limit,
    search: search || undefined,
    status: status || undefined,
    sortBy,
    sortDir,
    warehouseId: warehouseFilterId || undefined,
    productId: productFilterId || undefined,
    variantId: variantFilterId || undefined,
  });
  const { data, isLoading, refetch, isFetching } = inventoryQuery;
  const dashboard = useAdminInventoryDashboard();

  const { data: recentAdjustments, isLoading: recentLoading } = useAdminInventoryAdjustments({ page: 1, limit: 8 });
  const { data: rowAdjustments, isLoading: rowHistoryLoading } = useAdminVariantInventoryAdjustments(historyRow?.variantId ?? undefined, { page: 1, limit: 25 });
  const updateInv = useUpdateInventory();
  const bulkUpdate = useBulkUpdateInventory();
  const { data: warehousesData } = useAdminWarehouses({ limit: 30 });
  const warehouses = warehousesData?.data || [];

  const alerts = useAdminInventoryAlerts();

  const rows = (data?.data ?? []) as InventoryRow[];
  const recentRows = (recentAdjustments?.data ?? []) as Adjustment[];
  const historyRows = (rowAdjustments?.data ?? []) as Adjustment[];

  const selectedCount = selectedIds.length;
  const totalPages = data?.pagination?.totalPages || 1;

  const handleInlineUpdate = async (row: InventoryRow, payload: { stock?: number; lowStockThreshold?: number }) => {
    try {
      await updateInv.mutateAsync({ id: row.id, ...payload });
      showToast("Inventory updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update inventory."), "error");
    }
  };

  const columns = useMemo(() => {
    const cols: Array<{
      key: string;
      label: string;
      width?: string;
      render: (row: InventoryRow) => React.ReactNode;
    }> = [
      {
        key: "product",
        label: "Product / Variant",
        width: "280px",
        render: (row) => (
          <div className="py-0.5 min-w-0">
            <div className="font-semibold text-[#1A1A1A] leading-snug truncate">
              {row.product?.title || "Unknown product"}
            </div>
            <div className="mt-0.5 text-[12px] text-[#6B6B6B] leading-snug truncate">
              {row.variant?.title || (row.variantId ? row.product?.brand : "Main Stock")}
            </div>
          </div>
        ),
      },
      {
        key: "sku",
        label: "SKU",
        width: "180px",
        render: (row) => (
          <div className="space-y-0.5 min-w-0">
            <div className="font-mono text-[12.5px] text-[#444] break-all font-medium leading-snug">
              {row.variant?.sku || row.product?.sku || "—"}
            </div>
            <div className="text-[11px] text-[#9A9A9A]">
              {row.product?.brand || "Modern Orthodontics"}
            </div>
          </div>
        ),
      },
      {
        key: "stock",
        label: "Stock",
        width: "80px",
        render: (row) => <span className="font-semibold text-[#1A1A1A]">{tinyNumber(row.stock)}</span>,
      },
      {
        key: "available",
        label: "Available",
        width: "90px",
        render: (row) => {
          const availableStock = Math.max(0, row.stock - row.reservedStock);
          return <span className="font-semibold text-emerald-700">{tinyNumber(availableStock)}</span>;
        },
      },
    ];

    if (visibleColumns.warehouse !== false) {
      cols.push({
        key: "warehouse",
        label: "Warehouse",
        width: "180px",
        render: (row) => {
          const warehouseLabel = row.warehouse
            ? `${row.warehouse.name}${row.warehouse.state ? ` (${row.warehouse.state})` : ""}`
            : "Base / Default";
          return <span className="text-[13px] text-[#555] leading-snug block truncate">{warehouseLabel}</span>;
        },
      });
    }

    if (visibleColumns.reserved !== false) {
      cols.push({
        key: "reserved",
        label: "Reserved Stock",
        width: "100px",
        render: (row) => <span className="text-[13px] text-[#6B6B6B]">{tinyNumber(row.reservedStock)}</span>,
      });
    }

    if (visibleColumns.threshold !== false) {
      cols.push({
        key: "threshold",
        label: "Low Stock At",
        width: "110px",
        render: (row) =>
          canUpdate ? (
            <input
              type="text"
              defaultValue={row.lowStockThreshold}
              className="w-20 rounded border border-[#E6E6E6] px-2 py-1 text-center text-[12.5px] outline-none focus:border-[#E31E24]"
              onChange={(e) => {
                e.target.value = e.target.value.replace(/\D/g, "");
              }}
              onBlur={(e) => {
                const nextVal = Number(e.target.value);
                if (!Number.isInteger(nextVal) || nextVal < 0 || nextVal === row.lowStockThreshold) return;
                void handleInlineUpdate(row, { lowStockThreshold: nextVal });
              }}
            />
          ) : (
            <span className="text-[13px] text-[#555]">{row.lowStockThreshold}</span>
          ),
      });
    }

    if (visibleColumns.status !== false) {
      cols.push({
        key: "status",
        label: "Status",
        width: "110px",
        render: (row) => <StatusBadge status={row.status} />,
      });
    }

    if (visibleColumns.updated !== false) {
      cols.push({
        key: "updated",
        label: "Updated Date",
        width: "110px",
        render: (row) => (
          <span className="text-[12.5px] text-[#6B6B6B]">
            {formatDate(row.updatedAt)}
          </span>
        ),
      });
    }

    cols.push({
      key: "actions",
      label: "Actions",
      width: "140px",
      render: (row) => (
        <AdminRowActions
          extra={
            <AdminActionButton
              action={{
                onClick: () => setHistoryRow(row),
                disabled: !row.variantId,
                title: "Stock History",
                icon: (
                  <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold">
                    <History size={12} /> History
                  </span>
                ),
                className: "w-auto px-2 h-7",
              }}
              defaultIcon={<History size={13} />}
              defaultTitle="Stock History"
            />
          }
          delete={
            row.warehouseId
              ? {
                  title: "Unassign Warehouse",
                  onClick: () => setUnassignTarget(row),
                }
              : undefined
          }
        />
      ),
    });

    return cols;
  }, [visibleColumns, canUpdate]);

  const exportInventory = async (selectedOnly = false) => {
    try {
      setExporting(true);
      const response = await adminApi.get("/inventory/export", {
        params: {
          page,
          limit: 20,
          search: search || undefined,
          status: status || undefined,
          sortBy,
          sortDir,
          ids: selectedOnly && selectedIds.length ? selectedIds.join(",") : undefined,
        },
        responseType: "blob",
      });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = selectedOnly && selectedIds.length ? "inventory-selected.xlsx" : "inventory-export.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to export inventory."), "error");
    } finally {
      setExporting(false);
    }
  };

  const downloadSampleTemplate = async () => {
    try {
      const response = await adminApi.get("/inventory/sample-template", { responseType: "blob" });
      const blob = new Blob([response.data], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "inventory-template.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to download sample template."), "error");
    }
  };


  const openImportDialog = () => {
    setImportOpen(true);
  };

  const handleSelectAll = async (checked: boolean) => {
    if (checked) {
      const visibleIds = rows.map((row) => row.id);
      try {
        const res = await adminApi.get("/inventory", {
          params: {
            search: search || undefined,
            status: status || undefined,
            sortBy,
            sortDir,
            warehouseId: warehouseFilterId || undefined,
            productId: productFilterId || undefined,
            variantId: variantFilterId || undefined,
            limit: 999999,
            ignoreMaxLimit: "true",
          },
        });
        const allIds = (res.data.data ?? []).map((row: any) => row.id);
        setSelectedIds(allIds);
        showToast(`Selected all ${allIds.length} inventory items across all pages.`, "success");
      } catch {
        setSelectedIds(visibleIds);
      }
    } else {
      setSelectedIds([]);
    }
  };

  const applyBulkUpdate = async () => {
    if (!selectedIds.length || !bulkAction) return;

    if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }

    if (bulkAction === "warehouse") {
      setWarehouseAssignSelections({});
      setWarehouseAssignStocks({});
      setWarehouseAssignModalOpen(true);
      return;
    }

    try {
      if (bulkAction === "stock") {
        if (!bulkStock) {
          showToast("Please enter a stock quantity.", "error");
          return;
        }
        await bulkUpdate.mutateAsync({
          ids: selectedIds,
          stock: Number(bulkStock),
        });
        showToast(`Updated stock for ${selectedIds.length} inventory item(s).`);
      } else if (bulkAction === "threshold") {
        if (!bulkThreshold) {
          showToast("Please enter a low stock threshold.", "error");
          return;
        }
        await bulkUpdate.mutateAsync({
          ids: selectedIds,
          lowStockThreshold: Number(bulkThreshold),
        });
        showToast(`Updated low stock threshold for ${selectedIds.length} inventory item(s).`);
      }

      setSelectedIds([]);
      setBulkAction("");
      setBulkStock("");
      setBulkThreshold("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk action failed."), "error");
    }
  };

  const handleWarehouseAssignSubmit = async () => {
    const selectedWarehouseIds = Object.keys(warehouseAssignSelections).filter(id => warehouseAssignSelections[id]);
    if (!selectedWarehouseIds.length) {
      showToast("Please select at least one warehouse.", "error");
      return;
    }

    setBulkSaving(true);
    try {
      const selectedRows = rows.filter(r => selectedIds.includes(r.id));
      const uniqueVariantIds = Array.from(new Set(selectedRows.map(r => r.variantId).filter(Boolean))) as string[];

      for (const wId of selectedWarehouseIds) {
        const stockVal = warehouseAssignStocks[wId] ? Number(warehouseAssignStocks[wId]) : null;
        await Promise.all(
          uniqueVariantIds.map((vId) => {
            let finalStock = 0;
            if (stockVal !== null) {
              finalStock = stockVal;
            } else {
              const row = rows.find((r) => r.variantId === vId && (r.warehouse === null || r.warehouse === undefined));
              finalStock = row?.stock ?? 0;
            }
            return adminApi.post("/inventory/upsert", {
              variantId: vId,
              warehouseId: wId,
              stock: finalStock,
            });
          })
        );
      }

      showToast(`Successfully assigned selected variants to warehouses.`, "success");
      setWarehouseAssignModalOpen(false);
      setSelectedIds([]);
      setBulkAction("");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to assign warehouses."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setSearch("");
    setStatus("");
    setWarehouseFilterId("");
    setProductFilterId("");
    setVariantFilterId("");
    setSortBy("updatedAt");
    setSortDir("desc");
    setLimit(20);
    setPage(1);
  };

  if (authLoading || !hasPermission("inventory.view")) {
    return null;
  }

  return (
    <AdminLayout title="Inventory" breadcrumb={[{ label: "Admin", href: "/admin" }, { label: "Inventory" }]}>
      <div className="space-y-5">
        {/* 1. TOP KPI STATS GRID */}
        <AdminStatsGrid
          stats={[
            {
              title: "Tracked Items",
              value: tinyNumber(dashboard.data?.totals?.trackedItems ?? 0),
              subtitle: "Active catalog variants",
              icon: <Layers size={18} />,
              isLoading: dashboard.isLoading,
            },
            {
              title: "Total Stock",
              value: tinyNumber(dashboard.data?.totals?.totalStock ?? 0),
              subtitle: "Units across all warehouses",
              icon: <Clock3 size={18} />,
              color: "bg-blue-600",
              isLoading: dashboard.isLoading,
            },
            {
              title: "Reserved Stock",
              value: tinyNumber(dashboard.data?.totals?.reservedStock ?? 0),
              subtitle: "Allocated to orders",
              icon: <Clock3 size={18} />,
              color: "bg-slate-600",
              isLoading: dashboard.isLoading,
            },
            {
              title: "Low Stock",
              value: tinyNumber(dashboard.data?.totals?.lowStockCount ?? 0),
              subtitle: "Below alert threshold",
              icon: <History size={18} />,
              color: "bg-orange-500",
              isLoading: dashboard.isLoading,
            },
            {
              title: "Out of Stock",
              value: tinyNumber(dashboard.data?.totals?.outOfStockCount ?? 0),
              subtitle: "Requires replenishment",
              icon: <X size={18} />,
              color: "bg-red-500",
              isLoading: dashboard.isLoading,
            },
          ]}
        />

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: searchInput,
            onChange: setSearchInput,
            placeholder: "Search inventory...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [status, warehouseFilterId, productFilterId, variantFilterId, sortBy !== "updatedAt" ? sortBy : ""].filter(Boolean).length,
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key) =>
              setVisibleColumns((current) => ({
                ...current,
                [key as InventoryColumnKey]: current[key as InventoryColumnKey] === false ? true : false,
              })),
            options: COLUMN_OPTIONS,
          }}
          exportAction={{
            onClick: () => exportInventory(selectedCount > 0),
            label: selectedCount > 0 ? `Export Selected (${selectedCount})` : "Export Excel",
            disabled: exporting,
          }}
          importAction={
            canUpdate
              ? {
                  onClick: openImportDialog,
                  label: "Import Excel",
                }
              : undefined
          }
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Inventory refreshed."));
            },
            isRefreshing: isFetching,
          }}
          onResetFilters={handleResetFilters}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              <AdminMultiSearchableSelect
                label="Product"
                values={productFilterId ? productFilterId.split(",").filter(Boolean) : []}
                onValuesChange={(vals) => {
                  setProductFilterId(vals.join(","));
                  setVariantFilterId("");
                  setPage(1);
                }}
                options={productOptions}
                placeholder="Select products"
                allowSelectAll
                selectAllLabel="All products"
              />
              <AdminMultiSearchableSelect
                label="Variant"
                values={variantFilterId ? variantFilterId.split(",").filter(Boolean) : []}
                onValuesChange={(vals) => {
                  setVariantFilterId(vals.join(","));
                  setPage(1);
                }}
                options={variantOptions}
                placeholder="Select variants"
                allowSelectAll
                selectAllLabel="All variants"
              />
              <AdminSelect
                label="Warehouse"
                value={warehouseFilterId}
                onChange={(event) => {
                  setWarehouseFilterId(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Warehouses" },
                  ...warehouses.map((w: any) => ({
                    value: w.id,
                    label: `${w.name}${w.state ? ` (${w.state})` : ""}${w.country?.code ? ` [${w.country.code}]` : ""}`,
                  })),
                ]}
              />
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "IN_STOCK", label: "In Stock" },
                  { value: "LOW_STOCK", label: "Low Stock" },
                  { value: "OUT_OF_STOCK", label: "Out of Stock" },
                  { value: "BACKORDER", label: "Backorder" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "product", label: "Product" },
                  { value: "variant", label: "Variant" },
                  { value: "sku", label: "SKU" },
                  { value: "stock", label: "Stock" },
                  { value: "reservedStock", label: "Reserved Stock" },
                  { value: "lowStockThreshold", label: "Low Stock Threshold" },
                  { value: "status", label: "Status" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
                ]}
              />
            </div>
          }
        />



        {/* 3. TABS NAVIGATION */}
        <div className="flex border-b border-[#E6E6E6]">
          <button
            type="button"
            onClick={() => setActiveTab("levels")}
            className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors cursor-pointer ${
              activeTab === "levels"
                ? "border-[#E31E24] text-[#E31E24]"
                : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
          >
            Stock Levels
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors flex items-center gap-1.5 cursor-pointer ${
              activeTab === "alerts"
                ? "border-[#E31E24] text-[#E31E24]"
                : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
          >
            Low Stock Alerts
            {alerts.data && alerts.data.length > 0 && (
              <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[#E31E24] px-1 text-[10.5px] font-bold text-white">
                {alerts.data.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("activity")}
            className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors cursor-pointer ${
              activeTab === "activity"
                ? "border-[#E31E24] text-[#E31E24]"
                : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]"
            }`}
          >
            Recent Stock Activity
          </button>
        </div>

        {/* TAB 1: STOCK LEVELS */}
        {activeTab === "levels" && (
          <>
            <DataTable<InventoryRow>
              title="Stock Levels"
              columns={columns}
              data={rows}
              rowKey="id"
              isLoading={isLoading}
              emptyMessage={
                search || status || warehouseFilterId || productFilterId || variantFilterId
                  ? "No inventory records matched your search or filters."
                  : "No inventory records found."
              }
              enableSelection={canUpdate}
              selectedIds={selectedIds}
              onSelectionChange={setSelectedIds}
              totalItems={data?.pagination?.total ?? 0}
              currentPage={page}
              pageSize={limit}
              totalPages={totalPages}
              onPageChange={setPage}
              onPageSizeChange={(size) => {
                setLimit(size);
                setPage(1);
              }}
              pageSizeOptions={[20, 50, 100, 500]}
              onSelectAll={handleSelectAll}
              renderBulkActions={(selectedIds) => (
                <AdminBulkActionsBar
                  selectedCount={selectedIds.length}
                  onClear={() => setSelectedIds([])}
                  actionType={bulkAction}
                  onActionTypeChange={(val) => {
                    setBulkAction(val);
                    if (val === "warehouse") {
                      setWarehouseAssignSelections({});
                      setWarehouseAssignStocks({});
                      setWarehouseAssignModalOpen(true);
                    }
                  }}
                  actions={[
                    { value: "stock", label: "Update Stock" },
                    { value: "threshold", label: "Update Threshold" },
                    { value: "warehouse", label: "Assign Warehouse" },
                    { value: "delete", label: "Delete Selected" },
                  ]}
                  onApply={() => void applyBulkUpdate()}
                  applyLoading={bulkUpdate.isPending}
                  applyDisabled={!bulkAction || selectedIds.length === 0}
                  renderExtraSelectors={() => (
                    <>
                      {bulkAction === "stock" && (
                        <input
                          type="text"
                          placeholder="Stock qty"
                          value={bulkStock}
                          onChange={(e) => setBulkStock(e.target.value.replace(/\D/g, ""))}
                          className="h-8 w-24 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                        />
                      )}
                      {bulkAction === "threshold" && (
                        <input
                          type="text"
                          placeholder="Threshold qty"
                          value={bulkThreshold}
                          onChange={(e) => setBulkThreshold(e.target.value.replace(/\D/g, ""))}
                          className="h-8 w-28 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                        />
                      )}
                    </>
                  )}
                />
              )}
            />

            {/* BOTTOM PAGINATION */}
            <div className="flex items-center justify-end mt-4">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
                alwaysShow={true}
              />
            </div>
          </>
        )}

        {/* TAB 2: LOW STOCK ALERTS */}
        {activeTab === "alerts" && (
          <section className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-2xs">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#E6E6E6] pb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle size={17} className="text-[#E31E24]" />
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Low Stock Alerts</h2>
              </div>
              <span className="text-[12.5px] font-medium text-[#6B6B6B]">
                {alerts.isLoading ? "Loading..." : `${(alerts.data ?? []).length} item${(alerts.data ?? []).length === 1 ? "" : "s"} below threshold`}
              </span>
            </div>
            {alerts.isLoading ? (
              <div className="py-8 text-center text-[13px] text-[#9A9A9A]">Loading low stock alerts...</div>
            ) : (alerts.data ?? []).length === 0 ? (
              <div className="py-8 text-center text-[13px] text-[#9A9A9A]">No low stock alerts right now. All inventory items are within safe levels.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-[13px]">
                  <thead className="bg-[#F8F8F8] text-[#9A9A9A] border-b border-[#E6E6E6]">
                    <tr>
                      <th className="px-4 py-2.5 text-left font-semibold">Product</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Variant</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Stock</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Threshold</th>
                      <th className="px-4 py-2.5 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E6E6E6]">
                    {(alerts.data ?? []).map((item: InventoryRow) => (
                      <tr key={item.id} className="hover:bg-[#FAFAFA] transition-colors">
                        <td className="px-4 py-2.5 font-medium text-[#1A1A1A]">{item.product?.title ?? "Unknown product"}</td>
                        <td className="px-4 py-2.5 text-[#555]">{item.variant?.title ?? "Main stock"}</td>
                        <td className="px-4 py-2.5 font-semibold text-[#E31E24]">{item.stock}</td>
                        <td className="px-4 py-2.5 text-[#555]">{item.lowStockThreshold}</td>
                        <td className="px-4 py-2.5"><StatusBadge status={item.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        {/* TAB 3: RECENT STOCK ACTIVITY */}
        {activeTab === "activity" && (
          <section className="rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-2xs">
            <div className="mb-4 flex items-center justify-between gap-3 border-b border-[#E6E6E6] pb-3">
              <div className="flex items-center gap-2">
                <Clock3 size={17} className="text-[#E31E24]" />
                <h2 className="text-[15px] font-bold text-[#1A1A1A]">Recent Stock Activity</h2>
              </div>
              <span className="text-[12.5px] font-medium text-[#6B6B6B]">Audit log of inventory adjustments</span>
            </div>
            {recentLoading ? (
              <div className="py-8 text-center text-[13px] text-[#9A9A9A]">Loading recent activity...</div>
            ) : (
              <AdjustmentRows adjustments={recentRows} emptyMessage="No stock adjustments recorded yet." />
            )}
          </section>
        )}
      </div>

      {/* STOCK HISTORY MODAL */}
      <Modal
        open={Boolean(historyRow)}
        onClose={() => setHistoryRow(null)}
        title="Stock History Audit"
        subtitle={historyRow ? `${historyRow.product.title} / ${historyRow.variant?.title ?? "Variant"}` : undefined}
        size="2xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => setHistoryRow(null)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Close
            </button>
          </div>
        }
      >
        <div className="p-6">
          {rowHistoryLoading ? (
            <div className="py-4 text-center text-[13px] text-[#9A9A9A]">Loading history...</div>
          ) : (
            <AdjustmentRows adjustments={historyRows} emptyMessage="No stock adjustments recorded for this variant." />
          )}
        </div>
      </Modal>

      {/* WAREHOUSE ASSIGN MODAL */}
      <Modal
        open={warehouseAssignModalOpen}
        onClose={() => { setWarehouseAssignModalOpen(false); setBulkAction(""); }}
        title="Assign Selected Variants to Warehouses"
        subtitle="Select warehouses and specify initial stock levels for the selected variants."
        size="lg"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={() => { setWarehouseAssignModalOpen(false); setBulkAction(""); }}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={handleWarehouseAssignSubmit}
              loading={bulkSaving}
              loadingText="Assigning..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              Assign Warehouses
            </LoadingButton>
          </div>
        }
      >
        <div className="space-y-4 p-6">
          <p className="text-[13px] text-[#6B6B6B]">
            Select which warehouses you want to assign the selected variants to, and optionally specify their initial stock levels.
          </p>
          <div className="max-h-[300px] overflow-y-auto border border-[#E6E6E6] rounded-md divide-y divide-[#E6E6E6] px-4 bg-white">
            {(warehousesData?.data ?? []).map((w: any) => (
              <div key={w.id} className="flex items-center justify-between py-3 gap-3">
                <label className="flex items-center gap-2.5 cursor-pointer select-none text-[13px] text-[#1A1A1A] font-medium min-w-0">
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
                <input
                  type="text"
                  placeholder="Stock qty"
                  disabled={!warehouseAssignSelections[w.id]}
                  value={warehouseAssignStocks[w.id] ?? ""}
                  onChange={(event) => setWarehouseAssignStocks(prev => ({ ...prev, [w.id]: event.target.value.replace(/\D/g, "") }))}
                  className="w-28 h-8 px-2 rounded-md border border-[#E6E6E6] text-[12.5px] outline-none disabled:bg-[#FAFAFA] text-center focus:border-[#E31E24]"
                />
              </div>
            ))}
          </div>
        </div>
      </Modal>

      {/* EXCEL IMPORT MODAL */}
      <AdminImportWizard
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import Inventory"
        subtitle="Upload an .xlsx or .csv file to update variant stock levels with live preview & direct inline editing."
        entityName="inventory records"
        columns={inventoryWizardColumns}
        expectedColumns={inventoryExpectedColumns}
        sampleTemplateUrl="/inventory/sample-template"
        sampleTemplateFilename="inventory_sample_template.xlsx"
        previewEndpoint="/inventory/import/preview"
        executeEndpoint="/inventory/import"
        onSuccess={(result) => {
          refetch();
          showToast(`Import complete. ${result?.updated ?? 0} inventory records updated.`, "success");
        }}
      />

      {/* UNASSIGN SINGLE WAREHOUSE MODAL */}
      <AdminDeleteModal
        open={Boolean(unassignTarget)}
        onClose={() => setUnassignTarget(null)}
        itemName={unassignTarget ? `${unassignTarget.warehouse?.name ?? "Warehouse"} for ${unassignTarget.variant?.sku ?? unassignTarget.product?.title ?? "Item"}` : undefined}
        itemType="Warehouse Assignment"
        onSoftDelete={async () => {
          if (!unassignTarget) return;
          try {
            await adminApi.delete(`/inventory/${unassignTarget.id}`);
            showToast("Warehouse unassigned.", "success");
            setUnassignTarget(null);
            refetch();
          } catch (err: any) {
            showToast(err?.response?.data?.error || "Error unassigning warehouse.", "error");
          }
        }}
        onPermanentDelete={async () => {
          if (!unassignTarget) return;
          try {
            await adminApi.delete(`/inventory/${unassignTarget.id}`);
            showToast("Warehouse unassigned.", "success");
            setUnassignTarget(null);
            refetch();
          } catch (err: any) {
            showToast(err?.response?.data?.error || "Error unassigning warehouse.", "error");
          }
        }}
      />

      {/* BULK DELETE MODAL */}
      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected warehouse assignments`}
        itemType="Warehouse Assignments (Bulk)"
        onSoftDelete={async () => {
          setBulkSaving(true);
          try {
            await Promise.all(selectedIds.map((id) => adminApi.delete(`/inventory/${id}`)));
            setSelectedIds([]);
            setBulkAction("");
            setShowBulkDeleteModal(false);
            showToast(`Successfully deleted ${selectedIds.length} warehouse assignment(s).`, "success");
            refetch();
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete warehouse assignments."), "error");
          } finally {
            setBulkSaving(false);
          }
        }}
        onPermanentDelete={async () => {
          setBulkSaving(true);
          try {
            await Promise.all(selectedIds.map((id) => adminApi.delete(`/inventory/${id}`)));
            setSelectedIds([]);
            setBulkAction("");
            setShowBulkDeleteModal(false);
            showToast(`Successfully deleted ${selectedIds.length} warehouse assignment(s).`, "success");
            refetch();
          } catch (error) {
            showToast(getAdminErrorMessage(error, "Failed to delete warehouse assignments."), "error");
          } finally {
            setBulkSaving(false);
          }
        }}
        isSoftDeleting={bulkSaving}
        isPermanentDeleting={bulkSaving}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
