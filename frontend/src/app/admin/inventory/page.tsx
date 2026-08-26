"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, Download, Filter, History, Layers, Search, SlidersHorizontal, Trash2, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminListToolbar, AdminSelect, AdminStatsGrid, Pagination, StatCard, StatusBadge, useToast, AdminBulkActionsBar, AdminDeleteModal, DataTable } from "@/components/admin/AdminComponents";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { RefreshButton } from "@/components/admin/RefreshButton";
import { Modal } from "@/components/ui/Modal";
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

const STORAGE_KEY = "admin-inventory-columns-v1";

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

export default function InventoryPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("inventory.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canUpdate = hasPermission("inventory.update");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [activeTab, setActiveTab] = useState<"levels" | "alerts" | "activity">("levels");
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("product");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedGroupId, setLastSelectedGroupId] = useState<string | null>(null);
  const [limit, setLimit] = useState(20);
  const [warehouseFilterId, setWarehouseFilterId] = useState("");
  const [productFilterId, setProductFilterId] = useState("");
  const [variantFilterId, setVariantFilterId] = useState("");
  const [visibleColumns, setVisibleColumns] = useState<Record<InventoryColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnsReady, setColumnsReady] = useState(false);
  const [historyRow, setHistoryRow] = useState<InventoryRow | null>(null);
  const [bulkStock, setBulkStock] = useState("");
  const [bulkThreshold, setBulkThreshold] = useState("");
  const [bulkWarehouseId, setBulkWarehouseId] = useState("");
  const [bulkAction, setBulkAction] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<SpreadsheetReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
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
  const groupedRows = useMemo(() => {
    const groupsMap = new Map<string, InventoryRow[]>();
    for (const row of rows) {
      const key = row.variantId || row.product?.id || row.id;
      if (!groupsMap.has(key)) {
        groupsMap.set(key, []);
      }
      groupsMap.get(key)!.push(row);
    }
    return Array.from(groupsMap.values());
  }, [rows]);
  const recentRows = (recentAdjustments?.data ?? []) as Adjustment[];
  const historyRows = (rowAdjustments?.data ?? []) as Adjustment[];

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
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
            <div className="font-semibold text-[#1A1A1A] leading-snug">
              {row.product?.title || "Unknown product"}
            </div>
            <div className="mt-0.5 text-[12px] text-[#6B6B6B] leading-snug">
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

    if (visibleColumns.warehouse) {
      cols.push({
        key: "warehouse",
        label: "Warehouse",
        width: "180px",
        render: (row) => {
          const warehouseLabel = row.warehouse
            ? `${row.warehouse.name}${row.warehouse.state ? ` (${row.warehouse.state})` : ""}`
            : "Base / Default";
          return <span className="text-[13px] text-[#555] leading-snug block">{warehouseLabel}</span>;
        },
      });
    }

    if (visibleColumns.reserved) {
      cols.push({
        key: "reserved",
        label: "Reserved Stock",
        width: "100px",
        render: (row) => <span className="text-[13px] text-[#6B6B6B]">{tinyNumber(row.reservedStock)}</span>,
      });
    }

    if (visibleColumns.threshold) {
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

    if (visibleColumns.status) {
      cols.push({
        key: "status",
        label: "Status",
        width: "110px",
        render: (row) => <StatusBadge status={row.status} />,
      });
    }

    if (visibleColumns.updated) {
      cols.push({
        key: "updated",
        label: "Updated Date",
        width: "110px",
        render: (row) => (
          <span className="text-[12.5px] text-[#6B6B6B]">
            {new Date(row.updatedAt).toLocaleDateString()}
          </span>
        ),
      });
    }

    cols.push({
      key: "actions",
      label: "Actions",
      width: "140px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setHistoryRow(row)}
            disabled={!row.variantId}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12px] font-semibold text-[#444] hover:border-[#E31E24] hover:text-[#E31E24] hover:bg-[#FFF7F7] disabled:opacity-40 disabled:hover:border-[#E6E6E6] disabled:hover:bg-white disabled:hover:text-[#444] shadow-xs transition-colors whitespace-nowrap"
            title="Stock History"
          >
            <History size={13} /> History
          </button>
          {row.warehouseId ? (
            <button
              type="button"
              onClick={() => setUnassignTarget(row)}
              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-[#6B6B6B] hover:border-[#E31E24] hover:text-[#E31E24] hover:bg-[#FFF7F7] shadow-xs transition-colors flex-shrink-0"
              title="Unassign Warehouse"
            >
              <Trash2 size={13} />
            </button>
          ) : (
            <div className="w-8 flex-shrink-0" />
          )}
        </div>
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
      const blob = new Blob([response.data], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
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

  const openImportDialog = () => {
    setImportPreview(null);
    setImportMessage("");
    setImportFile(null);
    setImportOpen(true);
    fileInputRef.current?.click();
  };

  const previewImport = async (file?: File) => {
    if (!file) return;
    setImportFile(file);
    setImportMessage("Previewing spreadsheet...");
    setImportPreview(null);
    const formData = new FormData();
    formData.append("file", file);
    try {
      const response = await adminApi.post("/inventory/import/preview", formData);
      const report = response.data?.data as SpreadsheetReport;
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
      const response = await adminApi.post("/inventory/import", formData);
      const result = response.data?.data as { created: number; updated: number; report: SpreadsheetReport };
      showToast(`Imported ${result.created} created and ${result.updated} updated inventory rows.`);
      setImportOpen(false);
      setImportFile(null);
      setImportPreview(null);
      setImportMessage("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to import inventory spreadsheet."), "error");
    } finally {
      setImporting(false);
    }
  };

  const applyBulkUpdate = async () => {
    let stockValue: number | undefined = undefined;
    let thresholdValue: number | undefined = undefined;
    let warehouseId: string | undefined | null = undefined;

    if (bulkAction === "stock") {
      stockValue = bulkStock.trim() === "" ? undefined : Number(bulkStock);
      if (stockValue === undefined) {
        showToast("Enter stock value.", "error");
        return;
      }
      if (!Number.isInteger(stockValue) || stockValue < 0) {
        showToast("Stock must be a positive integer.", "error");
        return;
      }
    } else if (bulkAction === "threshold") {
      thresholdValue = bulkThreshold.trim() === "" ? undefined : Number(bulkThreshold);
      if (thresholdValue === undefined) {
        showToast("Enter threshold value.", "error");
        return;
      }
      if (!Number.isInteger(thresholdValue) || thresholdValue < 0) {
        showToast("Threshold must be a positive integer.", "error");
        return;
      }
    } else if (bulkAction === "delete") {
      setShowBulkDeleteModal(true);
      return;
    } else {
      showToast("Select a bulk action to apply.", "error");
      return;
    }

    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        ...(stockValue !== undefined ? { stock: stockValue } : {}),
        ...(thresholdValue !== undefined ? { lowStockThreshold: thresholdValue } : {}),
        ...(warehouseId !== undefined ? { warehouseId } : {}),
      });
      setSelectedIds([]);
      setBulkStock("");
      setBulkThreshold("");
      setBulkWarehouseId("");
      setBulkAction("");
      showToast("Selected inventory rows updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk inventory update failed."), "error");
    }
  };

  const handleWarehouseAssignSubmit = async () => {
    const selectedWarehouseIds = Object.keys(warehouseAssignSelections).filter((id) => warehouseAssignSelections[id]);
    if (selectedWarehouseIds.length === 0) {
      showToast("Please select at least one warehouse.", "error");
      return;
    }

    for (const wId of selectedWarehouseIds) {
      const stockStr = warehouseAssignStocks[wId]?.trim();
      const stockVal = stockStr ? parseInt(stockStr) : null;
      if (stockStr && (isNaN(stockVal as number) || (stockVal as number) < 0)) {
        showToast("Please enter a valid stock level.", "error");
        return;
      }
    }

    setBulkSaving(true);
    try {
      const uniqueVariantIds = Array.from(
        new Set(
          rows
            .filter((inv) => selectedIds.includes(inv.id))
            .map((inv) => inv.variantId)
            .filter(Boolean)
        )
      ) as string[];

      for (const wId of selectedWarehouseIds) {
        const stockStr = warehouseAssignStocks[wId]?.trim();
        const stockVal = stockStr ? parseInt(stockStr) : null;

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
  if (authLoading || !hasPermission("inventory.view")) {
    return null;
  }

  return (
    <AdminLayout title="Inventory" breadcrumb={[{ label: "Inventory" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Tracked Items", value: tinyNumber(dashboard.data?.totals?.trackedItems ?? 0), icon: <Layers size={18} /> },
          { title: "Total Stock", value: tinyNumber(dashboard.data?.totals?.totalStock ?? 0), icon: <Clock3 size={18} />, color: "bg-blue-600" },
          { title: "Reserved Stock", value: tinyNumber(dashboard.data?.totals?.reservedStock ?? 0), icon: <Clock3 size={18} />, color: "bg-slate-600" },
          { title: "Low Stock", value: tinyNumber(dashboard.data?.totals?.lowStockCount ?? 0), icon: <History size={18} />, color: "bg-orange-500" },
          { title: "Out of Stock", value: tinyNumber(dashboard.data?.totals?.outOfStockCount ?? 0), icon: <X size={18} />, color: "bg-red-500" }
        ]}
        isLoading={dashboard.isLoading}
      />

      <AdminListToolbar
        search={{
          value: searchInput,
          onChange: setSearchInput,
          placeholder: "Search inventory...",
          widthClassName: "w-[260px]",
        }}
        filters={{
          showFilters,
          onToggle: () => setShowFilters(!showFilters),
          activeCount: [status, warehouseFilterId, productFilterId, variantFilterId, sortBy !== "updatedAt" ? sortBy : ""].filter(Boolean).length,
        }}
        columns={{
          visibleColumns,
          onToggleColumn: (key) => setVisibleColumns((current) => ({ ...current, [key]: !current[key as InventoryColumnKey] })),
          options: (Object.keys(DEFAULT_COLUMNS) as InventoryColumnKey[]).map((k) => ({
            key: k,
            label: k === "warehouse" ? "Warehouse" : k === "reserved" ? "Reserved Stock" : k === "threshold" ? "Low Stock At" : k === "status" ? "Status" : "Updated Date",
          })),
        }}
        exportAction={{
          onClick: () => exportInventory(selectedCount > 0),
          label: selectedCount > 0 ? `Export Selected (${selectedCount})` : "Export Excel",
          disabled: exporting,
        }}
        importAction={canUpdate ? {
          onClick: openImportDialog,
          label: "Import Excel",
        } : undefined}
        refresh={{
          onRefresh: refetch,
          isRefreshing: isFetching,
        }}
        onResetFilters={() => {
          setStatus("");
          setWarehouseFilterId("");
          setProductFilterId("");
          setVariantFilterId("");
          setSortBy("updatedAt");
          setSortDir("desc");
          setPage(1);
        }}
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
                { value: "", label: "All Status" },
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
              label="Sort Direction"
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

      <input
        ref={fileInputRef}
        type="file"
        accept=".xlsx,.xls,.csv"
        className="hidden"
        onChange={(event) => {
          void previewImport(event.target.files?.[0] || undefined);
          event.currentTarget.value = "";
        }}
      />

      {/* Tabs */}
      <div className="mb-6 flex border-b border-[#E6E6E6]">
        <button
          type="button"
          onClick={() => setActiveTab("levels")}
          className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors ${
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
          className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors flex items-center gap-1.5 ${
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
          className={`border-b-2 px-6 py-2.5 text-[14px] font-semibold transition-colors ${
            activeTab === "activity"
              ? "border-[#E31E24] text-[#E31E24]"
              : "border-transparent text-[#6B6B6B] hover:text-[#1A1A1A]"
          }`}
        >
          Recent Stock Activity
        </button>
      </div>

      {activeTab === "alerts" && (
        <section className="mb-6 rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <History size={17} className="text-[#E31E24]" />
              <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Low Stock Alerts</h2>
            </div>
            <span className="text-[12.5px] text-[#9A9A9A]">
              {alerts.isLoading ? "Loading..." : `${(alerts.data ?? []).length} alert${(alerts.data ?? []).length === 1 ? "" : "s"}`}
            </span>
          </div>
          {alerts.isLoading ? (
            <div className="py-4 text-[13px] text-[#9A9A9A]">Loading low stock alerts...</div>
          ) : (alerts.data ?? []).length === 0 ? (
            <div className="py-4 text-[13px] text-[#9A9A9A]">No low stock alerts right now.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-[13px]">
                <thead className="bg-[#F8F8F8] text-[#9A9A9A]">
                  <tr>
                    <th className="px-4 py-2 text-left">Product</th>
                    <th className="px-4 py-2 text-left">Variant</th>
                    <th className="px-4 py-2 text-left">Stock</th>
                    <th className="px-4 py-2 text-left">Threshold</th>
                    <th className="px-4 py-2 text-left">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E6E6E6]">
                  {(alerts.data ?? []).map((item: InventoryRow) => (
                    <tr key={item.id} className="hover:bg-[#FAFAFA]">
                      <td className="px-4 py-2 font-medium text-[#1A1A1A]">{item.product?.title ?? "Unknown product"}</td>
                      <td className="px-4 py-2 text-[#555]">{item.variant?.title ?? "Main stock"}</td>
                      <td className="px-4 py-2 text-[#555]">{item.stock}</td>
                      <td className="px-4 py-2 text-[#555]">{item.lowStockThreshold}</td>
                      <td className="px-4 py-2"><StatusBadge status={item.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {activeTab === "levels" && (
        <DataTable<InventoryRow>
          columns={columns}
          data={rows}
          rowKey="id"
          isLoading={isLoading}
          emptyMessage="No inventory records found."
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
          onSelectAll={async (checked) => {
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
          }}
          renderBulkActions={(selectedIds) => (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center justify-center rounded-full bg-[#FEF2F2] border border-red-100 px-2.5 py-0.5 text-[11.5px] font-semibold text-red-600 min-w-[84px]">
                {selectedIds.length} selected
              </span>
              <select
                value={bulkAction}
                onChange={(e) => {
                  const val = e.target.value;
                  setBulkAction(val);
                  if (val === "warehouse") {
                    setWarehouseAssignSelections({});
                    setWarehouseAssignStocks({});
                    setWarehouseAssignModalOpen(true);
                  }
                }}
                className="h-8 rounded-md border border-[#D1D5DB] bg-white px-3 text-[12.5px] text-[#1F2937] outline-none focus:border-[#E31E24] cursor-pointer"
              >
                <option value="">Choose Bulk Action</option>
                <option value="stock">Update stock</option>
                <option value="threshold">Update low stock threshold</option>
                <option value="warehouse">Assign warehouse</option>
                <option value="delete">Delete selected</option>
              </select>

              {bulkAction === "stock" && (
                <input
                  type="text"
                  placeholder="Stock"
                  value={bulkStock}
                  onChange={(e) => setBulkStock(e.target.value.replace(/\D/g, ""))}
                  className="h-8 w-24 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                />
              )}
              {bulkAction === "threshold" && (
                <input
                  type="text"
                  placeholder="Threshold"
                  value={bulkThreshold}
                  onChange={(e) => setBulkThreshold(e.target.value.replace(/\D/g, ""))}
                  className="h-8 w-28 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12.5px] outline-none focus:border-[#E31E24] shadow-sm"
                />
              )}

              <button
                type="button"
                onClick={() => void applyBulkUpdate()}
                disabled={bulkUpdate.isPending || selectedIds.length === 0 || !bulkAction}
                className="h-8 rounded-md bg-[#E31E24] hover:bg-[#B5151B] px-4 text-[12.5px] font-semibold text-white disabled:opacity-40 disabled:hover:bg-[#E31E24] disabled:cursor-not-allowed transition-all shadow-sm flex items-center justify-center min-w-[80px]"
              >
                {bulkUpdate.isPending ? "Applying..." : "Apply"}
              </button>

              <button
                type="button"
                onClick={() => {
                  setSelectedIds([]);
                  setBulkAction("");
                }}
                className="inline-flex h-8 items-center gap-1 rounded-md border border-[#E6E6E6] bg-white px-2.5 text-[12px] text-[#555] hover:bg-gray-50"
              >
                <X size={13} /> Clear
              </button>
            </div>
          )}
        />
      )}

      <Modal
        open={warehouseAssignModalOpen}
        onClose={() => { setWarehouseAssignModalOpen(false); setBulkAction(""); }}
        title="Assign Selected Variants to Warehouses"
        panelClassName="max-w-md"
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
                  placeholder="Stock"
                  disabled={!warehouseAssignSelections[w.id]}
                  value={warehouseAssignStocks[w.id] ?? ""}
                  onChange={(event) => setWarehouseAssignStocks(prev => ({ ...prev, [w.id]: event.target.value.replace(/\D/g, "") }))}
                  className="w-24 h-8 px-2 rounded-md border border-[#E6E6E6] text-[12.5px] outline-none disabled:bg-[#FAFAFA] text-center focus:border-[#E31E24]"
                />
              </div>
            ))}
          </div>
          <div className="mt-4 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={() => { setWarehouseAssignModalOpen(false); setBulkAction(""); }}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleWarehouseAssignSubmit}
              disabled={bulkSaving}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
            >
              {bulkSaving ? "Assigning..." : "Assign"}
            </button>
          </div>
        </div>
      </Modal>

      {activeTab === "activity" && (
        <section className="mt-6 rounded-lg border border-[#E6E6E6] bg-white p-5">
          <div className="mb-3 flex items-center gap-2">
            <Clock3 size={17} className="text-[#E31E24]" />
            <h2 className="text-[15px] font-semibold text-[#1A1A1A]">Recent Stock Activity</h2>
          </div>
          {recentLoading ? (
            <div className="py-4 text-[13px] text-[#9A9A9A]">Loading recent activity...</div>
          ) : (
            <AdjustmentRows adjustments={recentRows} emptyMessage="No stock adjustments recorded yet." />
          )}
        </section>
      )}

      {historyRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#EFEFEF] p-5">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Stock History</h2>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">
                  {historyRow.product.title} / {historyRow.variant?.title ?? "Variant"}
                </p>
              </div>
              <button type="button" onClick={() => setHistoryRow(null)} className="rounded p-1 text-[#6B6B6B] hover:bg-[#F5F5F5]">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-y-auto p-5">
              {rowHistoryLoading ? (
                <div className="py-4 text-[13px] text-[#9A9A9A]">Loading history...</div>
              ) : (
                <AdjustmentRows adjustments={historyRows} emptyMessage="No stock adjustments recorded for this variant." />
              )}
            </div>
          </div>
        </div>
      )}

      {importOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-lg bg-white shadow-xl">
            <div className="flex items-start justify-between gap-4 border-b border-[#EFEFEF] p-5">
              <div>
                <h2 className="text-[18px] font-semibold text-[#1A1A1A]">Import Inventory Excel</h2>
                <p className="mt-1 text-[13px] text-[#6B6B6B]">
                  Upload an `.xlsx` or `.csv` file with `variantId`, `variantSku` or `productSku`, plus `stock`, `reservedStock`, and `lowStockThreshold`.
                </p>
              </div>
              <button type="button" onClick={() => setImportOpen(false)} className="rounded p-1 text-[#6B6B6B] hover:bg-[#F5F5F5]">
                <X size={18} />
              </button>
            </div>
            <div className="max-h-[78vh] overflow-y-auto p-5">
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
                >
                  <Upload size={15} /> Choose File
                </button>
                <button
                  type="button"
                  onClick={() => void confirmImport()}
                  disabled={!importFile || importing || (importPreview?.invalidRows ?? 0) > 0}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-50"
                >
                  {importing ? "Importing..." : "Import Now"}
                </button>
                <span className="text-[13px] text-[#6B6B6B]">{importMessage || "Pick a spreadsheet to preview validation results before importing."}</span>
              </div>

              {importPreview && (
                <div className="space-y-4">
                  <AdminStatsGrid
                    stats={[
                      { title: "Total Rows", value: tinyNumber(importPreview.totalRows), icon: <Clock3 size={18} /> },
                      { title: "Valid Rows", value: tinyNumber(importPreview.validRows), icon: <History size={18} />, color: "bg-emerald-600" },
                      { title: "Invalid Rows", value: tinyNumber(importPreview.invalidRows), icon: <X size={18} />, color: "bg-red-500" },
                      { title: "Duplicates", value: tinyNumber(importPreview.duplicateWarnings.length), icon: <Filter size={18} />, color: "bg-orange-500" }
                    ]}
                  />
                  {importPreview.issues.length > 0 && (
                    <div className="rounded-lg border border-[#F1D6D6] bg-[#FFF8F8] p-4">
                      <h3 className="mb-3 text-[14px] font-semibold text-[#1A1A1A]">Validation Issues</h3>
                      <div className="max-h-44 space-y-2 overflow-y-auto text-[13px] text-[#6B6B6B]">
                        {importPreview.issues.slice(0, 30).map((issue, index) => (
                          <div key={`${issue.row}-${issue.field}-${index}`} className="rounded border border-[#F1D6D6] bg-white px-3 py-2">
                            Row {issue.row}, {issue.field}: {issue.message}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {importPreview.duplicateWarnings.length > 0 && (
                    <div className="rounded-lg border border-[#F0E1C0] bg-[#FFFDF6] p-4">
                      <h3 className="mb-3 text-[14px] font-semibold text-[#1A1A1A]">Duplicate Warnings</h3>
                      <div className="max-h-40 space-y-2 overflow-y-auto text-[13px] text-[#6B6B6B]">
                        {importPreview.duplicateWarnings.map((warning, index) => (
                          <div key={`${warning}-${index}`} className="rounded border border-[#F0E1C0] bg-white px-3 py-2">
                            {warning}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="rounded-lg border border-[#E6E6E6]">
                    <div className="border-b border-[#E6E6E6] px-4 py-3 text-[13px] font-semibold text-[#1A1A1A]">Preview Rows</div>
                    <div className="overflow-x-auto">
                      <table className="w-full min-w-[900px] text-[13px]">
                        <thead className="bg-[#F8F8F8] text-[#9A9A9A]">
                          <tr>
                            <th className="px-4 py-2 text-left">Row</th>
                            <th className="px-4 py-2 text-left">Variant ID</th>
                            <th className="px-4 py-2 text-left">Variant SKU</th>
                            <th className="px-4 py-2 text-left">Product SKU</th>
                            <th className="px-4 py-2 text-left">Stock</th>
                            <th className="px-4 py-2 text-left">Reserved Stock</th>
                            <th className="px-4 py-2 text-left">Low Stock At</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#E6E6E6]">
                          {importPreview.sampleRows.map((sample) => (
                            <tr key={String(sample.row)} className="hover:bg-[#FAFAFA]">
                              <td className="px-4 py-2">{String(sample.row)}</td>
                              <td className="px-4 py-2">{String(sample.variantId ?? "")}</td>
                              <td className="px-4 py-2">{String(sample.variantSku ?? "")}</td>
                              <td className="px-4 py-2">{String(sample.productSku ?? "")}</td>
                              <td className="px-4 py-2">{String(sample.stock ?? "")}</td>
                              <td className="px-4 py-2">{String(sample.reservedStock ?? "")}</td>
                              <td className="px-4 py-2">{String(sample.lowStockThreshold ?? "")}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

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
