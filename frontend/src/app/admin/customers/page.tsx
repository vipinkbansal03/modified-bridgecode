"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Filter, Search, Shield, Store, UserCog, Users, XCircle, Edit2, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminSelect, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import {
  useAdminCountries,
  useAdminCustomerRoles,
  useAdminCustomers,
  useAdminTiers,
  useApproveCustomer,
  useRejectCustomer,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

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
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("customers.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("customers.create");
  const canUpdate = hasPermission("customers.update");
  const canDelete = hasPermission("customers.delete");

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
    {
      key: "status",
      label: "Account",
      render: (row) => (
        canUpdate ? (
          <button
            onClick={async () => {
              const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
              try {
                await adminApi.put(`/customers/${row.id}`, { status: nextStatus });
                showToast(`Account status updated to ${nextStatus.toLowerCase()}.`);
                customerQuery.refetch();
              } catch (err) {
                showToast(getAdminErrorMessage(err, "Failed to update account status."), "error");
              }
            }}
            className="cursor-pointer hover:opacity-85 transition-opacity focus:outline-hidden"
            title="Click to toggle account status"
          >
            <StatusBadge status={row.status} />
          </button>
        ) : (
          <StatusBadge status={row.status} />
        )
      ),
    },
    {
      key: "approvalStatus",
      label: "Approval",
      render: (row) => (
        canUpdate ? (
          <button
            onClick={async () => {
              try {
                if (row.approvalStatus === "ACTIVE") {
                  await adminApi.post(`/customers/${row.id}/reject`);
                  showToast("Customer status set to Suspended.");
                } else {
                  await adminApi.post(`/customers/${row.id}/approve`);
                  showToast("Customer approved.");
                }
                customerQuery.refetch();
              } catch (err) {
                showToast(getAdminErrorMessage(err, "Failed to update approval status."), "error");
              }
            }}
            className="cursor-pointer hover:opacity-85 transition-opacity focus:outline-hidden"
            title="Click to toggle approval status"
          >
            <StatusBadge status={row.approvalStatus} />
          </button>
        ) : (
          <StatusBadge status={row.approvalStatus} />
        )
      ),
    },
    { key: "createdAt", label: "Created", render: (row) => formatDate(row.createdAt) },
    {
      key: "actions",
      label: "Actions",
      width: "180px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <Link
            href={`/admin/customers/${row.id}`}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
            title="View details"
          >
            <Eye size={13} />
          </Link>
          {canUpdate && (
            <Link
              href={`/admin/customers/${row.id}`}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
              title="Edit profile"
            >
              <Edit2 size={13} />
            </Link>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeletingCustomer(row.id)}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
              title="Delete account"
            >
              <Trash2 size={13} />
            </button>
          )}
          {canUpdate && row.approvalStatus === "PENDING_APPROVAL" ? (
            <>
              <button
                type="button"
                onClick={() => setPendingAction({ customer: row, action: "APPROVE" })}
                className="inline-flex h-7 items-center gap-1 rounded border border-[#CFE8D7] px-2.5 text-[12px] font-medium text-[#1F8F4A] hover:bg-[#F1FBF4]"
                title="Approve"
              >
                <CheckCircle2 size={13} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({ customer: row, action: "REJECT" })}
                className="inline-flex h-7 items-center gap-1 rounded border border-[#F2C9C9] px-2.5 text-[12px] font-medium text-[#E31E24] hover:bg-[#FFF5F5]"
                title="Reject"
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

  const [deletingCustomer, setDeletingCustomer] = useState<string | null>(null);

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    try {
      await adminApi.delete(`/customers/${deletingCustomer}`);
      showToast("Customer deleted successfully.");
      customerQuery.refetch();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to delete customer."), "error");
    } finally {
      setDeletingCustomer(null);
    }
  };

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const activeFilterCount = [
    statusFilter,
    approvalFilter,
    customerTypeFilter,
    roleFilter,
    tierFilter,
    countryFilter,
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSearch("");
    setStatusFilter("");
    setApprovalFilter("");
    setCustomerTypeFilter("");
    setRoleFilter("");
    setTierFilter("");
    setCountryFilter("");
    setSortBy("createdAt");
    setSortDir("desc");
  };

  if (authLoading || !hasPermission("customers.view")) {
    return null;
  }

  return (
    <AdminLayout title="Users & Customers" breadcrumb={[{ label: "Customers" }]}>
      <div className="space-y-5">
        {/* Navigation Tabs */}
        <div className="flex border-b border-[#E6E6E6]">
          <Link
            href="/admin/customers"
            className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-[#E31E24] text-[#E31E24]"
          >
            Customers
          </Link>
          {hasPermission("users.view") && (
            <Link
              href="/admin/users"
              className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-transparent text-[#6B7280] hover:text-[#111827]"
            >
              Staff (Users)
            </Link>
          )}
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Customers" value={totals.total} subtitle="All customer records" icon={<Users size={18} />} />
          <StatCard title="Active Accounts" value={totals.active} subtitle="Currently enabled" icon={<Shield size={18} />} color="bg-green-600" />
          <StatCard title="Pending Approval" value={totals.pending} subtitle="Wholesale accounts waiting" icon={<UserCog size={18} />} color="bg-amber-600" />
          <StatCard title="Wholesale Customers" value={totals.wholesale} subtitle="Sales-focused accounts" icon={<Store size={18} />} color="bg-[#0F6CBD]" />
        </div>

        {/* Clean Filter Toolbar */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4 shadow-2xs space-y-3">
          {/* Row 1: Search & Primary Controls */}
          <div className="flex flex-col lg:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by customer name, email, company, phone..."
                className="h-10 w-full rounded-lg border border-[#E5E7EB] bg-white py-2 pl-9 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24] focus:ring-1 focus:ring-[#E31E24]"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#111827] text-xs font-semibold"
                >
                  Clear
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 w-full lg:w-auto overflow-x-auto">
              <div className="w-40 shrink-0">
                <AdminSelect label="" value={roleFilter} onChange={(e) => setRoleFilter(e.target.value)} options={roleOptions} />
              </div>
              <div className="w-44 shrink-0">
                <AdminSelect label="" value={approvalFilter} onChange={(e) => setApprovalFilter(e.target.value)} options={APPROVAL_OPTIONS} />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                className={`h-10 px-3.5 rounded-lg border text-[13px] font-semibold flex items-center gap-2 transition-colors shrink-0 ${
                  showAdvancedFilters || activeFilterCount > 0
                    ? "border-[#E31E24] bg-[#FFF5F5] text-[#E31E24]"
                    : "border-[#E5E7EB] bg-white text-[#374151] hover:bg-[#F9FAFB]"
                }`}
              >
                <Filter size={14} />
                <span>More Filters</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E31E24] text-[11px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>

              {(activeFilterCount > 0 || search) && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="h-10 px-3 rounded-lg text-[12.5px] font-semibold text-[#6B7280] hover:text-[#E31E24] hover:bg-[#F9FAFB] shrink-0"
                >
                  Reset All
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Collapsible Advanced Filters Drawer */}
          {showAdvancedFilters && (
            <div className="pt-3 border-t border-[#F3F4F6] grid gap-3 grid-cols-2 md:grid-cols-4 bg-[#FAFAFA] p-3 rounded-lg border border-[#E5E7EB]">
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">Account Status</label>
                <AdminSelect label="" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} options={STATUS_OPTIONS} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">Customer Type</label>
                <AdminSelect label="" value={customerTypeFilter} onChange={(e) => setCustomerTypeFilter(e.target.value)} options={CUSTOMER_TYPE_OPTIONS} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">Customer Tier</label>
                <AdminSelect label="" value={tierFilter} onChange={(e) => setTierFilter(e.target.value)} options={tierOptions} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">Country</label>
                <AdminSelect label="" value={countryFilter} onChange={(e) => setCountryFilter(e.target.value)} options={countryOptions} />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">Sort Field</label>
                <AdminSelect
                  label=""
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  options={[
                    { value: "createdAt", label: "Created date" },
                    { value: "updatedAt", label: "Updated date" },
                    { value: "firstName", label: "Customer name" },
                    { value: "email", label: "Email" },
                  ]}
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-[#6B7280] mb-1">Sort Order</label>
                <AdminSelect
                  label=""
                  value={sortDir}
                  onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                  options={[
                    { value: "desc", label: "Descending (Newest)" },
                    { value: "asc", label: "Ascending (Oldest)" },
                  ]}
                />
              </div>
            </div>
          )}

          {/* Row 3: Footer Bar */}
          <div className="flex items-center justify-between pt-1 text-[12.5px] text-[#6B7280]">
            <div className="font-semibold text-[#111827]">
              Showing <span className="text-[#E31E24]">{pagination.total ?? 0}</span> customer records
            </div>
            <div className="flex items-center gap-2">
              <span>Per page:</span>
              <select
                value={String(limit)}
                onChange={(e) => setLimit(Number(e.target.value))}
                className="h-8 rounded-md border border-[#E5E7EB] bg-white px-2 py-0 text-[12px] font-semibold text-[#111827] outline-none"
              >
                <option value="10">10</option>
                <option value="25">25</option>
                <option value="50">50</option>
              </select>
            </div>
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

      <ConfirmModal
        open={!!deletingCustomer}
        title="Delete customer?"
        message="Are you sure you want to delete this customer account? This will mark the customer as deleted."
        onConfirm={handleDeleteCustomer}
        onCancel={() => setDeletingCustomer(null)}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
