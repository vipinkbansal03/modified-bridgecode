"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Eye, Filter, Search, Shield, Store, UserCog, Users, XCircle } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminSelect, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import {
  useAdminCountries,
  useAdminCustomerRoles,
  useAdminCustomers,
  useAdminTiers,
  useApproveCustomer,
  useRejectCustomer,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type CustomerRow = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  companyName?: string | null;
  phone?: string | null;
  status: string;
  customerType: string;
  approvalStatus: string;
  customerRole?: { id: string; key: string; name: string } | null;
  tier?: { id: string; name: string } | null;
  defaultCountry?: { id: string; name: string; code: string } | null;
  createdAt: string;
  updatedAt?: string;
};

type CustomerListResponse = {
  data?: CustomerRow[];
  pagination?: { page: number; limit: number; total: number; totalPages: number };
};

const CUSTOMER_TYPE_OPTIONS = [
  { value: "", label: "All customer types" },
  { value: "RETAIL", label: "Retail" },
  { value: "DEALER", label: "Dealer" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "WHOLESALE", label: "Wholesale" },
];

const APPROVAL_OPTIONS = [
  { value: "", label: "All approvals" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING_APPROVAL", label: "Pending approval" },
  { value: "SUSPENDED", label: "Suspended" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

function formatDate(value?: string) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString();
}

export default function AdminCustomersPage() {
  const { showToast, ToastComponent } = useToast();
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [customerTypeFilter, setCustomerTypeFilter] = useState("");
  const [approvalFilter, setApprovalFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [tierFilter, setTierFilter] = useState("");
  const [countryFilter, setCountryFilter] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [pendingAction, setPendingAction] = useState<{ customer: CustomerRow; action: "APPROVE" | "REJECT" } | null>(null);

  const customerQuery = useAdminCustomers({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    customerType: customerTypeFilter || undefined,
    approvalStatus: approvalFilter || undefined,
    customerRoleId: roleFilter || undefined,
    tierId: tierFilter || undefined,
    countryId: countryFilter || undefined,
    sortBy,
    sortDir,
  });
  const totalResponse = customerQuery.data as CustomerListResponse | undefined;
  const customers = (totalResponse?.data ?? []) as CustomerRow[];
  const pagination = totalResponse?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  const activeCountQuery = useAdminCustomers({ page: 1, limit: 1, status: "ACTIVE" });
  const pendingCountQuery = useAdminCustomers({ page: 1, limit: 1, approvalStatus: "PENDING_APPROVAL" });
  const wholesaleCountQuery = useAdminCustomers({ page: 1, limit: 1, customerType: "WHOLESALE" });

  const { data: customerRoles = [] } = useAdminCustomerRoles();
  const { data: tiers = [] } = useAdminTiers();
  const { data: countries = [] } = useAdminCountries();
  const approveCustomer = useApproveCustomer();
  const rejectCustomer = useRejectCustomer();

  const totals = {
    total: Number(pagination.total ?? 0),
    active: Number((activeCountQuery.data as CustomerListResponse | undefined)?.pagination?.total ?? 0),
    pending: Number((pendingCountQuery.data as CustomerListResponse | undefined)?.pagination?.total ?? 0),
    wholesale: Number((wholesaleCountQuery.data as CustomerListResponse | undefined)?.pagination?.total ?? 0),
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, customerTypeFilter, approvalFilter, roleFilter, tierFilter, countryFilter, sortBy, sortDir, limit]);

  const roleOptions = useMemo(
    () => [{ value: "", label: "All roles" }, ...customerRoles.map((role: { id: string; name: string; status?: string }) => ({
      value: role.id,
      label: role.status === "ACTIVE" ? role.name : `${role.name} (Inactive)`,
    }))],
    [customerRoles],
  );

  const tierOptions = useMemo(
    () => [{ value: "", label: "All tiers" }, ...tiers.map((tier: { id: string; name: string }) => ({ value: tier.id, label: tier.name }))],
    [tiers],
  );

  const countryOptions = useMemo(
    () => [{ value: "", label: "All countries" }, ...countries.map((country: { id: string; name: string; code: string }) => ({
      value: country.id,
      label: `${country.name} (${country.code})`,
    }))],
    [countries],
  );

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      label: "Customer",
      render: (row) => (
        <div className="min-w-[220px]">
          <div className="font-medium text-[#1A1A1A]">
            {row.firstName} {row.lastName}
          </div>
          <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.email}</div>
          {row.phone ? <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.phone}</div> : null}
        </div>
      ),
    },
    {
      key: "companyName",
      label: "Company / Country",
      render: (row) => (
        <div>
          <div className="text-[13px] text-[#1A1A1A]">{row.companyName || "-"}</div>
          <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.defaultCountry ? `${row.defaultCountry.name} (${row.defaultCountry.code})` : "No country"}</div>
        </div>
      ),
    },
    { key: "customerRole", label: "Role", render: (row) => row.customerRole?.name ?? row.customerType.replace("_", " ") },
    { key: "tier", label: "Tier", render: (row) => row.tier?.name ?? "-" },
    { key: "status", label: "Account", render: (row) => <StatusBadge status={row.status} /> },
    { key: "approvalStatus", label: "Approval", render: (row) => <StatusBadge status={row.approvalStatus} /> },
    { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
    {
      key: "actions",
      label: "Actions",
      width: "170px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/customers/${row.id}`}
            className="inline-flex h-7 items-center gap-1 rounded border border-[#E6E6E6] px-2.5 text-[12px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2]"
          >
            <Eye size={13} />
            View
          </Link>
          {row.approvalStatus === "PENDING_APPROVAL" ? (
            <>
              <button
                type="button"
                onClick={() => setPendingAction({ customer: row, action: "APPROVE" })}
                className="inline-flex h-7 items-center gap-1 rounded border border-[#CFE8D7] px-2.5 text-[12px] font-medium text-[#1F8F4A] hover:bg-[#F1FBF4]"
              >
                <CheckCircle2 size={13} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({ customer: row, action: "REJECT" })}
                className="inline-flex h-7 items-center gap-1 rounded border border-[#F2C9C9] px-2.5 text-[12px] font-medium text-[#E31E24] hover:bg-[#FFF5F5]"
              >
                <XCircle size={13} />
                Reject
              </button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const handleApprovalConfirm = async () => {
    if (!pendingAction) return;
    try {
      if (pendingAction.action === "APPROVE") {
        await approveCustomer.mutateAsync(pendingAction.customer.id);
        showToast("Customer approved.");
      } else {
        await rejectCustomer.mutateAsync(pendingAction.customer.id);
        showToast("Customer rejected.");
      }
      setPendingAction(null);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Could not update customer approval."), "error");
    }
  };

  return (
    <AdminLayout title="Customers" breadcrumb={[{ label: "Customers" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Customers" value={totals.total} subtitle="All customer records" icon={<Users size={18} />} />
          <StatCard title="Active Accounts" value={totals.active} subtitle="Currently enabled" icon={<Shield size={18} />} color="bg-green-600" />
          <StatCard title="Pending Approval" value={totals.pending} subtitle="Wholesale accounts waiting" icon={<UserCog size={18} />} color="bg-amber-600" />
          <StatCard title="Wholesale Customers" value={totals.wholesale} subtitle="Sales-focused accounts" icon={<Store size={18} />} color="bg-[#0F6CBD]" />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="grid gap-3 xl:grid-cols-[minmax(0,1.8fr)_repeat(6,minmax(0,1fr))]">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search customers"
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>
            <AdminSelect label="" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} options={STATUS_OPTIONS} />
            <AdminSelect label="" value={approvalFilter} onChange={(event) => setApprovalFilter(event.target.value)} options={APPROVAL_OPTIONS} />
            <AdminSelect label="" value={customerTypeFilter} onChange={(event) => setCustomerTypeFilter(event.target.value)} options={CUSTOMER_TYPE_OPTIONS} />
            <AdminSelect label="" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)} options={roleOptions} />
            <AdminSelect label="" value={tierFilter} onChange={(event) => setTierFilter(event.target.value)} options={tierOptions} />
            <AdminSelect label="" value={countryFilter} onChange={(event) => setCountryFilter(event.target.value)} options={countryOptions} />
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_auto]">
            <AdminSelect
              label=""
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value)}
              options={[
                { value: "createdAt", label: "Created date" },
                { value: "updatedAt", label: "Updated date" },
                { value: "firstName", label: "Customer name" },
                { value: "email", label: "Email" },
                { value: "status", label: "Account status" },
                { value: "approvalStatus", label: "Approval status" },
                { value: "customerType", label: "Customer type" },
              ]}
            />
            <AdminSelect
              label=""
              value={sortDir}
              onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
              options={[
                { value: "desc", label: "Descending" },
                { value: "asc", label: "Ascending" },
              ]}
            />
            <AdminSelect
              label=""
              value={String(limit)}
              onChange={(event) => setLimit(Number(event.target.value))}
              options={[
                { value: "10", label: "10 / page" },
                { value: "20", label: "20 / page" },
                { value: "50", label: "50 / page" },
              ]}
            />
            <div className="flex items-center justify-end text-[12.5px] text-[#6B6B6B]">
              {pagination.total ?? 0} total
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-2 text-[12px] text-[#6B6B6B]">
            <span className="rounded-full border border-[#E6E6E6] px-3 py-1">Filters update instantly</span>
            <span className="rounded-full border border-[#E6E6E6] px-3 py-1">Use View for full profile, orders, and addresses</span>
          </div>
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white">
          <DataTable<CustomerRow> columns={columns} data={customers} rowKey="id" isLoading={customerQuery.isLoading} emptyMessage="No customers found." />
          <div className="border-t border-[#E6E6E6] px-4 py-3">
            <Pagination page={pagination.page} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction?.action === "APPROVE" ? "Approve customer?" : "Reject customer?"}
        message={
          pendingAction
            ? `${pendingAction.action === "APPROVE" ? "Approve" : "Reject"} ${pendingAction.customer.firstName} ${pendingAction.customer.lastName}?`
            : ""
        }
        onConfirm={handleApprovalConfirm}
        onCancel={() => setPendingAction(null)}
        isLoading={approveCustomer.isPending || rejectCustomer.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
