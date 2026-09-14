"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, Pagination, AdminSelect, AdminInput } from "@/components/admin/AdminComponents";
import { useAdminLogs } from "@/hooks/admin/useAdminHooks";

interface Log { id: string; action: string; entityType: string; entityId: string; user?: { name: string }; ipAddress: string; createdAt: string; metadata: unknown }

export default function LogsPage() {
  const [page, setPage] = useState(1);
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");
  const { data, isLoading } = useAdminLogs({ page, entityType, action });
  const columns: Column<Log>[] = [
    { key: "action", label: "Action", render: (r) => <span className="font-mono text-[12px] bg-[#F2F2F2] px-2 py-0.5 rounded">{r.action}</span> },
    { key: "entityType", label: "Entity", render: (r) => r.entityType || "—" },
    { key: "entityId", label: "Entity ID", render: (r) => <span className="font-mono text-[11.5px] text-[#9A9A9A]">{r.entityId?.slice(0, 12) || "—"}</span> },
    { key: "user", label: "User", render: (r) => r.user?.name || "System" },
    { key: "ipAddress", label: "IP", render: (r) => r.ipAddress || "—" },
    { key: "createdAt", label: "Date", render: (r) => new Date(r.createdAt).toLocaleString() },
  ];
  return (
    <AdminLayout title="Activity Logs" breadcrumb={[{ label: "Logs" }]}>
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="w-[200px]">
          <AdminSelect
            options={[
              { value: "", label: "All Entity Types" },
              { value: "Product", label: "Product" },
              { value: "Order", label: "Order" },
              { value: "Quote", label: "Quote" },
              { value: "User", label: "User" },
            ]}
            value={entityType}
            onChange={(e) => {
              setEntityType(e.target.value);
              setPage(1);
            }}
            className="h-10 text-[13.5px]"
          />
        </div>
        <div className="w-[220px]">
          <AdminInput
            placeholder="Filter by action…"
            value={action}
            onChange={(e) => {
              setAction(e.target.value);
              setPage(1);
            }}
            className="h-10 text-[13.5px]"
          />
        </div>
      </div>
      <DataTable<Log> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No activity logs yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
    </AdminLayout>
  );
}
