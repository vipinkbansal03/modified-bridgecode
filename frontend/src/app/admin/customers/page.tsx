"use client";

import Link from "next/link";
import { Eye } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, StatusBadge, type Column } from "@/components/admin/AdminComponents";
import { useAdminCustomers } from "@/hooks/admin/useAdminHooks";

type CustomerRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  status: string;
  tier?: { id: string; name: string } | null;
  createdAt: string;
};

export default function AdminCustomersPage() {
  const { data, isLoading } = useAdminCustomers({ limit: 50 });
  const customers = (data?.data ?? []) as CustomerRow[];

  const columns: Column<CustomerRow>[] = [
    {
      key: "email",
      label: "Customer",
      render: (row) => (
        <div>
          <div className="font-medium">{row.firstName} {row.lastName}</div>
          <div className="text-[11.5px] text-[#9A9A9A]">{row.email}</div>
        </div>
      ),
    },
    { key: "phone", label: "Phone", render: (row) => row.phone || "—" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    { key: "tier", label: "Tier", render: (row) => row.tier?.name ?? "None" },
    {
      key: "actions",
      label: "",
      width: "80px",
      render: (row) => (
        <Link href={`/admin/customers/${row.id}`} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#E31E24] hover:underline">
          <Eye size={14} />
          View
        </Link>
      ),
    },
  ];

  return (
    <AdminLayout title="Customers">
      <p className="mb-5 text-[13.5px] text-[#6B6B6B]">Assign customer tiers for pricing rules.</p>
      <DataTable columns={columns} data={customers} isLoading={isLoading} rowKey="id" emptyMessage="No customers found." />
    </AdminLayout>
  );
}
