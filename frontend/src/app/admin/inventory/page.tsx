"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Clock3, Download, Filter, History, Layers, Search, SlidersHorizontal, Upload, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, Pagination, StatCard, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminInventory,
  useAdminInventoryAdjustments,
  useAdminInventoryAlerts,
  useAdminInventoryDashboard,
  useAdminVariantInventoryAdjustments,
  useBulkUpdateInventory,
  useUpdateInventory,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

type InventoryRow = {
  id: string;
  variantId?: string | null;
  countryId?: string | null;
  country?: { id: string; name: string; code: string } | null;
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

type InventoryColumnKey = "country" | "reserved" | "threshold" | "status" | "updated";

const DEFAULT_COLUMNS: Record<InventoryColumnKey, boolean> = {
  country: true,
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<Record<InventoryColumnKey, boolean>>(DEFAULT_COLUMNS);
  const [columnsReady, setColumnsReady] = useState(false);
  const [historyRow, setHistoryRow] = useState<InventoryRow | null>(null);
  const [bulkStock, setBulkStock] = useState("");
  const [bulkThreshold, setBulkThreshold] = useState("");
  const [importOpen, setImportOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<SpreadsheetReport | null>(null);
  const [importMessage, setImportMessage] = useState("");
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const { showToast, ToastComponent } = useToast();

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
  }, [page, search, status, sortBy, sortDir]);

  const inventoryQuery = useAdminInventory({
    page,
    limit: 20,
    search: search || undefined,
    status: status || undefined,
    sortBy,
    sortDir,
  });
  const { data, isLoading, refetch } = inventoryQuery;
  const dashboard = useAdminInventoryDashboard();
  const alerts = useAdminInventoryAlerts();
  const { data: recentAdjustments, isLoading: recentLoading } = useAdminInventoryAdjustments({ page: 1, limit: 8 });
  const { data: rowAdjustments, isLoading: rowHistoryLoading } = useAdminVariantInventoryAdjustments(historyRow?.variantId ?? undefined, { page: 1, limit: 25 });
  const updateInv = useUpdateInventory();
  const bulkUpdate = useBulkUpdateInventory();

  const rows = (data?.data ?? []) as InventoryRow[];
  const recentRows = (recentAdjustments?.data ?? []) as Adjustment[];
  const historyRows = (rowAdjustments?.data ?? []) as Adjustment[];

  const allVisibleSelected = rows.length > 0 && rows.every((row) => selectedIds.includes(row.id));
  const selectedCount = selectedIds.length;

  const visibleColumnEntries = useMemo(
    () =>
      [
        { key: "country" as const, label: "Country Availability", width: "150px" },
        { key: "reserved" as const, label: "Reserved Stock", width: "120px" },
        { key: "threshold" as const, label: "Low Stock At", width: "120px" },
        { key: "status" as const, label: "Status", width: "120px" },
        { key: "updated" as const, label: "Updated Date", width: "140px" },
      ].filter((column) => visibleColumns[column.key]),
    [visibleColumns],
  );

  const gridTemplateColumns = useMemo(() => {
    const widths = ["36px", "270px", "130px", "110px", "120px", ...visibleColumnEntries.map((column) => column.width), "150px"];
    return widths.join(" ");
  }, [visibleColumnEntries]);

  const totalPages = data?.pagination?.totalPages || 1;

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]));
  };

  const toggleVisible = () => {
    const visibleIds = rows.map((row) => row.id);
    setSelectedIds((current) => (visibleIds.every((id) => current.includes(id)) ? current.filter((id) => !visibleIds.includes(id)) : Array.from(new Set([...current, ...visibleIds]))));
  };

  const handleInlineUpdate = async (row: InventoryRow, payload: { stock?: number; lowStockThreshold?: number }) => {
    try {
      await updateInv.mutateAsync({ id: row.id, ...payload });
      showToast("Inventory updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update inventory."), "error");
    }
  };

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
      const response = await adminApi.post("/inventory/import/preview", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
      const response = await adminApi.post("/inventory/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
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
    const stockValue = bulkStock.trim() === "" ? undefined : Number(bulkStock);
    const thresholdValue = bulkThreshold.trim() === "" ? undefined : Number(bulkThreshold);
    if (stockValue === undefined && thresholdValue === undefined) {
      showToast("Enter stock or low stock threshold for the bulk update.", "error");
      return;
    }
    if (stockValue !== undefined && (!Number.isInteger(stockValue) || stockValue < 0)) {
      showToast("Stock must be a non-negative integer.", "error");
      return;
    }
    if (thresholdValue !== undefined && (!Number.isInteger(thresholdValue) || thresholdValue < 0)) {
      showToast("Low stock threshold must be a non-negative integer.", "error");
      return;
    }

    try {
      await bulkUpdate.mutateAsync({
        ids: selectedIds,
        ...(stockValue !== undefined ? { stock: stockValue } : {}),
        ...(thresholdValue !== undefined ? { lowStockThreshold: thresholdValue } : {}),
      });
      setSelectedIds([]);
      setBulkStock("");
      setBulkThreshold("");
      showToast("Selected inventory rows updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Bulk inventory update failed."), "error");
    }
  };

  return (
    <AdminLayout title="Inventory" breadcrumb={[{ label: "Inventory" }]}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              placeholder="Search inventory..."
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              className="w-[260px] rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
            />
          </div>
          <select
            value={status}
            onChange={(event) => {
              setStatus(event.target.value);
              setPage(1);
            }}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
          >
            <option value="">All Status</option>
            <option value="IN_STOCK">In Stock</option>
            <option value="LOW_STOCK">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
            <option value="BACKORDER">Backorder</option>
          </select>
          <select
            value={sortBy}
            onChange={(event) => setSortBy(event.target.value)}
            className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none"
          >
            <option value="updatedAt">Updated Date</option>
            <option value="product">Product</option>
            <option value="variant">Variant</option>
            <option value="sku">SKU</option>
            <option value="stock">Stock</option>
            <option value="reservedStock">Reserved Stock</option>
            <option value="lowStockThreshold">Low Stock Threshold</option>
            <option value="status">Status</option>
          </select>
          <select value={sortDir} onChange={(event) => setSortDir(event.target.value as "asc" | "desc")} className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none">
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
          <details className="relative">
            <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13.5px] outline-none">
              <SlidersHorizontal size={14} /> Columns
            </summary>
            <div className="absolute left-0 z-20 mt-2 w-[240px] rounded-md border border-[#E6E6E6] bg-white p-3 shadow-lg">
              <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wide text-[#9A9A9A]">
                <Filter size={12} /> Visibility
              </div>
              <div className="grid gap-2">
                {(Object.keys(DEFAULT_COLUMNS) as InventoryColumnKey[]).map((key) => (
                  <label key={key} className="flex items-center justify-between gap-3 rounded border border-[#F0F0F0] px-2.5 py-1.5 text-[12.5px] text-[#1A1A1A]">
                    <span>{key === "country" ? "Country Availability" : key === "reserved" ? "Reserved Stock" : key === "threshold" ? "Low Stock At" : key === "status" ? "Status" : "Updated Date"}</span>
                    <input
                      type="checkbox"
                      checked={visibleColumns[key]}
                      onChange={(event) => setVisibleColumns((current) => ({ ...current, [key]: event.target.checked }))}
                    />
                  </label>
                ))}
              </div>
            </div>
          </details>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => exportInventory(false)}
            disabled={exporting}
            className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2] disabled:opacity-50"
          >
            <Download size={15} /> Export Excel
          </button>
          {selectedCount > 0 ? (
            <button
              type="button"
              onClick={() => exportInventory(true)}
              disabled={exporting}
              className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2] disabled:opacity-50"
            >
              <Download size={15} /> Export Selected
            </button>
          ) : null}
          <button
            type="button"
            onClick={openImportDialog}
            className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-semibold text-[#1A1A1A] hover:bg-[#F2F2F2]"
          >
            <Upload size={15} /> Import Excel
          </button>
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
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard title="Tracked Items" value={tinyNumber(dashboard.data?.totals?.trackedItems ?? 0)} icon={<Layers size={18} />} />
        <StatCard title="Total Stock" value={tinyNumber(dashboard.data?.totals?.totalStock ?? 0)} icon={<Clock3 size={18} />} color="bg-blue-600" />
        <StatCard title="Reserved Stock" value={tinyNumber(dashboard.data?.totals?.reservedStock ?? 0)} icon={<Clock3 size={18} />} color="bg-slate-600" />
        <StatCard title="Low Stock" value={tinyNumber(dashboard.data?.totals?.lowStockCount ?? 0)} icon={<History size={18} />} color="bg-orange-500" />
        <StatCard title="Out of Stock" value={tinyNumber(dashboard.data?.totals?.outOfStockCount ?? 0)} icon={<X size={18} />} color="bg-red-500" />
      </div>

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

      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-[12.5px] text-[#9A9A9A]">
        <span>{data?.pagination ? `${data.pagination.total} inventory rows` : "Loading inventory..."}</span>
        <label className="inline-flex items-center gap-2 text-[#555]">
          <input type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} />
          Select visible
        </label>
      </div>

      {selectedCount > 0 ? (
        <div className="mb-4 rounded-lg border border-[#E6E6E6] bg-white p-3">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-[13px] font-semibold text-[#1A1A1A]">{selectedCount} selected</span>
            <div className="flex items-center gap-2">
              <AdminInput label="Stock" type="number" min={0} value={bulkStock} onChange={(event) => setBulkStock(event.target.value)} className="w-28" />
              <AdminInput
                label="Low Stock At"
                type="number"
                min={0}
                value={bulkThreshold}
                onChange={(event) => setBulkThreshold(event.target.value)}
                className="w-32"
              />
            </div>
            <button
              type="button"
              onClick={() => void applyBulkUpdate()}
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

      <div className="rounded-lg border border-[#E6E6E6] bg-white">
        <div className="overflow-x-auto">
          <div className="w-full min-w-max">
            <div className="grid w-full gap-0 border-b border-[#E6E6E6] bg-[#F8F8F8] px-2 py-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A]" style={{ gridTemplateColumns }}>
              <span />
              <span className="px-2">Product / Variant</span>
              <span className="px-2">SKU</span>
              <span className="px-2">Stock</span>
              <span className="px-2">Available</span>
              {visibleColumns.country && <span className="px-2">Country Availability</span>}
              {visibleColumns.reserved && <span className="px-2">Reserved Stock</span>}
              {visibleColumns.threshold && <span className="px-2">Low Stock At</span>}
              {visibleColumns.status && <span className="px-2">Status</span>}
              {visibleColumns.updated && <span className="px-2">Updated Date</span>}
              <span className="px-2">Actions</span>
            </div>

            {isLoading ? (
              <div className="divide-y divide-[#E6E6E6]">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="grid w-full gap-0 px-2 py-4" style={{ gridTemplateColumns }}>
                    {Array.from({ length: 5 + visibleColumnEntries.length }).map((__, cellIndex) => (
                      <div key={cellIndex} className="px-2">
                        <div className="h-4 animate-pulse rounded bg-[#E6E6E6]" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-12 text-center text-[13.5px] text-[#9A9A9A]">No inventory records found.</div>
            ) : (
              <div className="divide-y divide-[#E6E6E6]">
                {rows.map((row) => {
                  const availableStock = Math.max(0, row.stock - row.reservedStock);
                  const countryLabel = row.country ? `${row.country.name} (${row.country.code})` : "Base";
                  const nextStockValue = String(row.stock);
                  const nextThresholdValue = String(row.lowStockThreshold);

                  return (
                    <div key={row.id} className="grid w-full items-center gap-0 px-2 py-4" style={{ gridTemplateColumns }}>
                      <div className="flex items-center justify-center px-2">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(row.id)}
                          onChange={() => toggleSelected(row.id)}
                          aria-label={`Select ${row.product.title}`}
                        />
                      </div>
                      <div className="min-w-0 px-2">
                        <div className="truncate text-[13.5px] font-medium text-[#1A1A1A]">{row.product.title}</div>
                        <div className="truncate text-[11.5px] text-[#9A9A9A]">{row.variant?.title || row.product.brand || "Variant stock"}</div>
                      </div>
                      <div className="space-y-1 px-2">
                        <div className="truncate text-[13px] text-[#555]">{row.variant?.sku || row.product.sku || "—"}</div>
                        <div className="truncate text-[11.5px] text-[#9A9A9A]">{row.product.brand || "Modern Orthodontics"}</div>
                      </div>
                      <div className="px-2 text-[13px] text-[#555]">{tinyNumber(row.stock)}</div>
                      <div className="px-2 text-[13px] text-[#555]">{tinyNumber(availableStock)}</div>
                      {visibleColumns.country && <div className="px-2 text-[13px] text-[#555]">{countryLabel}</div>}
                      {visibleColumns.reserved && <div className="px-2 text-[13px] text-[#555]">{tinyNumber(row.reservedStock)}</div>}
                      {visibleColumns.threshold && (
                        <div className="px-2">
                          <input
                            type="number"
                            min="0"
                            defaultValue={row.lowStockThreshold}
                            className="w-full max-w-[96px] rounded border border-[#E6E6E6] px-2 py-1.5 text-center text-[13px] outline-none focus:border-[#E31E24]"
                            onBlur={(event) => {
                              const nextValue = Number(event.target.value);
                              if (!Number.isInteger(nextValue) || nextValue < 0 || nextValue === row.lowStockThreshold) return;
                              void handleInlineUpdate(row, { lowStockThreshold: nextValue });
                            }}
                          />
                        </div>
                      )}
                      {visibleColumns.status && <div className="px-2"><StatusBadge status={row.status} /></div>}
                      {visibleColumns.updated && <div className="px-2 text-[13px] text-[#6B6B6B]">{new Date(row.updatedAt).toLocaleDateString()}</div>}
                      <div className="flex items-center justify-center px-2">
                        <button
                          type="button"
                          onClick={() => setHistoryRow(row)}
                          disabled={!row.variantId}
                          className="inline-flex h-9 items-center gap-1 rounded border border-[#E6E6E6] px-3 text-[12.5px] font-medium text-[#6B6B6B] hover:border-[#E31E24] hover:text-[#E31E24] hover:bg-[#FFF7F7] disabled:cursor-not-allowed disabled:text-[#CFCFCF] disabled:hover:border-[#E6E6E6] disabled:hover:bg-white"
                        >
                          <History size={14} />
                          History
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />

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
                  <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
                    <StatCard title="Total Rows" value={tinyNumber(importPreview.totalRows)} icon={<Clock3 size={18} />} />
                    <StatCard title="Valid Rows" value={tinyNumber(importPreview.validRows)} icon={<History size={18} />} color="bg-emerald-600" />
                    <StatCard title="Invalid Rows" value={tinyNumber(importPreview.invalidRows)} icon={<X size={18} />} color="bg-red-500" />
                    <StatCard title="Duplicates" value={tinyNumber(importPreview.duplicateWarnings.length)} icon={<Filter size={18} />} color="bg-orange-500" />
                  </div>
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

      {ToastComponent}
    </AdminLayout>
  );
}
