"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
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
  customerType: string;
  approvalStatus: string;
  tier?: { id: string; name: string } | null;
  createdAt: string;
};

const FILTERS = [
  { key: "ALL", label: "All customers" },
  { key: "PENDING_APPROVAL", label: "Pending approval", approvalStatus: "PENDING_APPROVAL" },
  { key: "RETAIL", label: "Retail", customerType: "RETAIL" },
  { key: "DEALER", label: "Dealer", customerType: "DEALER" },
  { key: "DOCTOR", label: "Doctor", customerType: "DOCTOR" },
  { key: "WHOLESALE", label: "Wholesale", customerType: "WHOLESALE" },
];

export default function AdminCustomersPage() {
  const [activeFilter, setActiveFilter] = useState("ALL");
  const selectedFilter = useMemo(() => FILTERS.find((filter) => filter.key === activeFilter) ?? FILTERS[0], [activeFilter]);
  const { data, isLoading } = useAdminCustomers({
    limit: 50,
    customerType: selectedFilter.customerType,
    approvalStatus: selectedFilter.approvalStatus,
  });
  const { data: pendingData } = useAdminCustomers({ limit: 1, approvalStatus: "PENDING_APPROVAL" });
  const customers = (data?.data ?? []) as CustomerRow[];
  const pendingCount = Number(pendingData?.pagination?.total ?? 0);

  const columns: Column<CustomerRow>[] = [
    {
      key: "email",
      label: "Customer",
      render: (row) => (
        <div>
          <div className="font-medium">
            {row.firstName} {row.lastName}
          </div>
          <div className="text-[11.5px] text-[#9A9A9A]">{row.email}</div>
        </div>
      ),
    },
    { key: "phone", label: "Phone", render: (row) => row.phone || "-" },
    { key: "customerType", label: "Type", render: (row) => row.customerType.replace("_", " ") },
    { key: "status", label: "Account", render: (row) => <StatusBadge status={row.status} /> },
    { key: "approvalStatus", label: "Approval", render: (row) => <StatusBadge status={row.approvalStatus} /> },
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
      <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[13.5px] text-[#6B6B6B]">Assign customer tiers, segment account type, and approve wholesale requests.</p>
          {pendingCount > 0 ? (
            <p className="mt-1 text-[12.5px] font-medium text-[#E31E24]">
              {pendingCount} wholesale account{pendingCount === 1 ? "" : "s"} pending approval
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() => setActiveFilter(filter.key)}
              className={`h-9 rounded-md border px-3 text-[12.5px] font-semibold transition ${
                activeFilter === filter.key ? "border-[#E31E24] bg-[#E31E24] text-white" : "border-[#E6E6E6] bg-white text-[#555] hover:border-[#E31E24]"
              }`}
            >
              {filter.label}
              {filter.key === "PENDING_APPROVAL" && pendingCount > 0 ? ` (${pendingCount})` : ""}
            </button>
          ))}
        </div>
      </div>
      <DataTable columns={columns} data={customers} isLoading={isLoading} rowKey="id" emptyMessage="No customers found." />
    </AdminLayout>
  );
}
