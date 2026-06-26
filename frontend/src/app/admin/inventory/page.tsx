"use client";

import { useState } from "react";
import { Clock3, History, Search, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, Pagination, useToast } from "@/components/admin/AdminComponents";
import {
  useAdminInventory,
  useAdminInventoryAdjustments,
  useAdminVariantInventoryAdjustments,
  useUpdateInventory,
} from "@/hooks/admin/useAdminHooks";

interface InvRow {
  id: string;
  variantId?: string | null;
  variant?: { id: string; title: string; sku?: string | null; product?: { title: string } };
  stock: number;
  reservedStock: number;
  lowStockThreshold: number;
  status: string;
}

type Adjustment = {
  id: string;
  previousQty: number;
  newQty: number;
  reason?: string | null;
  adjustedBy?: string | null;
  createdAt: string;
  variant?: { title: string; sku?: string | null; product?: { title: string } | null } | null;
};

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
          <div key={adjustment.id} className="grid gap-3 py-3 text-[13px] md:grid-cols-[1.2fr_110px_1fr_1fr]">
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

export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [historyRow, setHistoryRow] = useState<InvRow | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminInventory({ page, search } as never);
  const { data: recentAdjustments, isLoading: recentLoading } = useAdminInventoryAdjustments({ page: 1, limit: 8 });
  const { data: rowAdjustments, isLoading: rowHistoryLoading } = useAdminVariantInventoryAdjustments(historyRow?.variantId ?? undefined, { page: 1, limit: 25 });
  const updateInv = useUpdateInventory();

  const columns: Column<InvRow>[] = [
    {
      key: "product",
      label: "Product / Variant",
      render: (r) => (
        <div>
          <div className="font-medium text-[13.5px]">{r.variant?.product?.title}</div>
          <div className="text-[11.5px] text-[#9A9A9A]">{r.variant?.title}</div>
        </div>
      ),
    },
    {
      key: "stock",
      label: "Stock",
      render: (r) => (
        <input
          type="number"
          min="0"
          defaultValue={r.stock}
          className="w-20 rounded border border-[#E6E6E6] px-2 py-1 text-center text-[13px] outline-none focus:border-[#E31E24]"
          onBlur={async (e) => {
            const nextStock = parseInt(e.target.value, 10);
            if (Number.isNaN(nextStock) || nextStock === r.stock) return;
            await updateInv.mutateAsync({ id: r.id, stock: nextStock });
            showToast("Updated.");
          }}
        />
      ),
    },
    { key: "reservedStock", label: "Reserved" },
    {
      key: "lowStockThreshold",
      label: "Low Stock At",
      render: (r) => (
        <input
          type="number"
          min="0"
          defaultValue={r.lowStockThreshold}
          className="w-20 rounded border border-[#E6E6E6] px-2 py-1 text-center text-[13px] outline-none focus:border-[#E31E24]"
          onBlur={async (e) => {
            const nextThreshold = parseInt(e.target.value, 10);
            if (Number.isNaN(nextThreshold) || nextThreshold === r.lowStockThreshold) return;
            await updateInv.mutateAsync({ id: r.id, lowStockThreshold: nextThreshold });
            showToast("Updated.");
          }}
        />
      ),
    },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    {
      key: "history",
      label: "",
      width: "90px",
      render: (r) => (
        <button
          type="button"
          disabled={!r.variantId}
          onClick={() => setHistoryRow(r)}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-[#E31E24] hover:underline disabled:text-[#CFCFCF] disabled:hover:no-underline"
        >
          <History size={14} />
          History
        </button>
      ),
    },
  ];

  const recentRows = (recentAdjustments?.data ?? []) as Adjustment[];
  const historyRows = (rowAdjustments?.data ?? []) as Adjustment[];

  return (
    <AdminLayout title="Inventory" breadcrumb={[{ label: "Inventory" }]}>
      <div className="mb-5 relative w-[240px]">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
        <input
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3 text-[13.5px] outline-none focus:border-[#E31E24]"
        />
      </div>

      <DataTable<InvRow> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No inventory records." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />

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
                  {historyRow.variant?.product?.title} / {historyRow.variant?.title}
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

      {ToastComponent}
    </AdminLayout>
  );
}
