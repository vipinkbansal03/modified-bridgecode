"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, Pagination, useToast } from "@/components/admin/AdminComponents";
import { useAdminInventory, useUpdateInventory } from "@/hooks/admin/useAdminHooks";
import { Search } from "lucide-react";
interface InvRow { id: string; variant?: { title: string; product?: { title: string } }; stock: number; reservedStock: number; lowStockThreshold: number; status: string }
export default function InventoryPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminInventory({ page, search } as never);
  const updateInv = useUpdateInventory();
  const columns: Column<InvRow>[] = [
    { key: "product", label: "Product / Variant", render: (r) => <div><div className="font-medium text-[13.5px]">{r.variant?.product?.title}</div><div className="text-[11.5px] text-[#9A9A9A]">{r.variant?.title}</div></div> },
    { key: "stock", label: "Stock", render: (r) => <input type="number" min="0" defaultValue={r.stock} className="w-20 rounded border border-[#E6E6E6] px-2 py-1 text-center text-[13px] outline-none focus:border-[#E31E24]" onBlur={async (e) => { await updateInv.mutateAsync({ id: r.id, stock: parseInt(e.target.value) }); showToast("Updated."); }} /> },
    { key: "reservedStock", label: "Reserved" },
    { key: "lowStockThreshold", label: "Low Stock At", render: (r) => <input type="number" min="0" defaultValue={r.lowStockThreshold} className="w-20 rounded border border-[#E6E6E6] px-2 py-1 text-center text-[13px] outline-none focus:border-[#E31E24]" onBlur={async (e) => { await updateInv.mutateAsync({ id: r.id, lowStockThreshold: parseInt(e.target.value) }); }} /> },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <AdminLayout title="Inventory" breadcrumb={[{ label: "Inventory" }]}>
      <div className="mb-5 relative w-[240px]"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" /><input placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3 text-[13.5px] outline-none focus:border-[#E31E24]" /></div>
      <DataTable<InvRow> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No inventory records." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      {ToastComponent}
    </AdminLayout>
  );
}
