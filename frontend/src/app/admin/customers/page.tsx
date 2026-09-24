"use client";

import Link from "next/link";
import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle2,
  Eye,
  Filter,
  Plus,
  Search,
  Shield,
  Store,
  UserCog,
  Users,
  XCircle,
  Edit2,
  Trash2,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  ConfirmModal,
  DataTable,
  Pagination,
  StatusBadge,
  useToast,
  type Column,
} from "@/components/admin/AdminComponents";
import {
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminRowActions";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import {
  useAdminCountries,
  useAdminCustomerRoles,
  useAdminCustomers,
  useAdminCustomerCounts,
  useAdminTiers,
  useApproveCustomer,
  useRejectCustomer,
} from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

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
  { value: "", label: "All Customer Types" },
  { value: "RETAIL", label: "Retail" },
  { value: "DEALER", label: "Dealer" },
  { value: "DOCTOR", label: "Doctor" },
  { value: "WHOLESALE", label: "Wholesale" },
];

const APPROVAL_OPTIONS = [
  { value: "", label: "All Approvals" },
  { value: "ACTIVE", label: "Active" },
  { value: "PENDING_APPROVAL", label: "Pending Approval" },
  { value: "SUSPENDED", label: "Suspended" },
];

const STATUS_OPTIONS = [
  { value: "", label: "All Statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
];

const visibleColumnsDefault = {
  name: true,
  companyName: true,
  customerRole: true,
  tier: true,
  status: true,
  approvalStatus: true,
  createdAt: true,
  actions: true,
};

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
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);
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

  const { data: customerCounts, isLoading: customerCountsLoading } = useAdminCustomerCounts();

  const { data: customerRoles = [] } = useAdminCustomerRoles();
  const { data: tiers = [] } = useAdminTiers();
  const { data: countries = [] } = useAdminCountries();
  const approveCustomer = useApproveCustomer();
  const rejectCustomer = useRejectCustomer();

  const totals = {
    total: Number(customerCounts?.total ?? pagination.total ?? 0),
    active: Number(customerCounts?.active ?? 0),
    pending: Number(customerCounts?.pending ?? 0),
    wholesale: Number(customerCounts?.wholesale ?? 0),
  };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, customerTypeFilter, approvalFilter, roleFilter, tierFilter, countryFilter, sortBy, sortDir, limit]);

  const roleOptions = useMemo(
    () => [{ value: "", label: "All Roles" }, ...customerRoles.map((role: { id: string; name: string; status?: string }) => ({
      value: role.id,
      label: role.status === "ACTIVE" ? role.name : `${role.name} (Inactive)`,
    }))],
    [customerRoles],
  );

  const tierOptions = useMemo(
    () => [{ value: "", label: "All Tiers" }, ...tiers.map((tier: { id: string; name: string }) => ({ value: tier.id, label: tier.name }))],
    [tiers],
  );

  const columns: Column<CustomerRow>[] = [
    {
      key: "name",
      label: "Customer",
      width: "220px",
      render: (row) => (
        <div className="min-w-0 pr-3">
          <Link
            href={`/admin/customers/${row.id}`}
            className="text-left font-semibold text-[#1A1A1A] hover:text-[#E31E24] text-[13px] block truncate transition-colors"
            title={`${row.firstName} ${row.lastName}`}
          >
            {row.firstName} {row.lastName}
          </Link>
          <div className="mt-0.5 text-[11.5px] text-[#6B6B6B] truncate">{row.email}</div>
          {row.phone ? <div className="mt-0.5 text-[11.5px] text-[#9A9A9A]">{row.phone}</div> : null}
        </div>
      ),
    },
    {
      key: "companyName",
      label: "Company / Country",
      width: "180px",
      render: (row) => (
        <div>
          <div className="text-[13px] font-medium text-[#1A1A1A]">{row.companyName || "-"}</div>
          <div className="mt-0.5 text-[11.5px] text-[#6B6B6B]">{row.defaultCountry ? `${row.defaultCountry.name} (${row.defaultCountry.code})` : "No country"}</div>
        </div>
      ),
    },
    {
      key: "customerRole",
      label: "Role",
      width: "120px",
      render: (row) => (
        <span className="inline-flex items-center rounded-full border border-[#E6E6E6] bg-[#FAFAFA] px-2.5 py-0.5 text-[11.5px] font-medium text-[#555] whitespace-nowrap">
          {row.customerRole?.name ?? row.customerType.replace("_", " ")}
        </span>
      ),
    },
    {
      key: "tier",
      label: "Tier",
      width: "100px",
      render: (row) => (
        <span className="text-[12.5px] font-medium text-[#1A1A1A]">{row.tier?.name ?? "-"}</span>
      ),
    },
    {
      key: "status",
      label: "Account",
      width: "110px",
      render: (row) => (
        <StatusBadge
          status={row.status}
          interactive={canUpdate}
          onClick={
            canUpdate
              ? async () => {
                  const nextStatus = row.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
                  try {
                    await adminApi.put(`/customers/${row.id}`, { status: nextStatus });
                    showToast(`Account status updated to ${nextStatus.toLowerCase()}.`);
                    customerQuery.refetch();
                  } catch (err) {
                    showToast(getAdminErrorMessage(err, "Failed to update account status."), "error");
                  }
                }
              : undefined
          }
        />
      ),
    },
    {
      key: "approvalStatus",
      label: "Approval",
      width: "110px",
      render: (row) => (
        <StatusBadge
          status={row.approvalStatus}
          interactive={canUpdate}
          onClick={
            canUpdate
              ? async () => {
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
                }
              : undefined
          }
        />
      ),
    },
    {
      key: "createdAt",
      label: "Created",
      width: "110px",
      render: (row) => <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">{formatDate(row.createdAt)}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      width: "140px",
      align: "left",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <AdminRowActions
            view={{
              onClick: () => router.push(`/admin/customers/${row.id}`),
              title: "View details",
            }}
            edit={
              canUpdate
                ? {
                    onClick: () => router.push(`/admin/customers/${row.id}`),
                    title: "Edit profile",
                  }
                : undefined
            }
            delete={
              canDelete
                ? {
                    onClick: () => setDeletingCustomer(row.id),
                    title: "Delete account",
                  }
                : undefined
            }
          />
          {canUpdate && row.approvalStatus === "PENDING_APPROVAL" ? (
            <div className="flex items-center gap-1 ml-1">
              <button
                type="button"
                onClick={() => setPendingAction({ customer: row, action: "APPROVE" })}
                className="inline-flex h-7 items-center gap-1 rounded border border-[#CFE8D7] px-2 text-[11.5px] font-semibold text-[#1F8F4A] hover:bg-[#F1FBF4] transition-colors cursor-pointer"
                title="Approve customer"
              >
                <CheckCircle2 size={12} />
                Approve
              </button>
              <button
                type="button"
                onClick={() => setPendingAction({ customer: row, action: "REJECT" })}
                className="inline-flex h-7 items-center gap-1 rounded border border-[#F2C9C9] px-2 text-[11.5px] font-semibold text-[#E31E24] hover:bg-[#FFF5F5] transition-colors cursor-pointer"
                title="Reject customer"
              >
                <XCircle size={12} />
                Reject
              </button>
            </div>
          ) : null}
        </div>
      ),
    },
  ];

  const filteredColumns = columns.filter((column) => {
    if (column.key === "name") return visibleColumns.name;
    if (column.key === "companyName") return visibleColumns.companyName;
    if (column.key === "customerRole") return visibleColumns.customerRole;
    if (column.key === "tier") return visibleColumns.tier;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "approvalStatus") return visibleColumns.approvalStatus;
    if (column.key === "createdAt") return visibleColumns.createdAt;
    if (column.key === "actions") return visibleColumns.actions;
    return true;
  });

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
  const [deletingLoading, setDeletingLoading] = useState(false);

  const handleDeleteCustomer = async () => {
    if (!deletingCustomer) return;
    setDeletingLoading(true);
    try {
      await adminApi.delete(`/customers/${deletingCustomer}`);
      showToast("Customer deleted successfully.");
      customerQuery.refetch();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to delete customer."), "error");
    } finally {
      setDeletingLoading(false);
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
    sortBy !== "createdAt" ? sortBy : "",
    sortDir !== "desc" ? sortDir : "",
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
    setPage(1);
  };

  if (authLoading || !hasPermission("customers.view")) {
    return null;
  }

  return (
    <AdminLayout title="Users & Customers" breadcrumb={[{ label: "Customers" }]}>
      <div className="space-y-5">
        {/* Navigation Sub-Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          <Link
            href="/admin/customers"
            className="flex items-center gap-2 border-b-2 border-[#E31E24] text-[#E31E24] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap cursor-pointer"
          >
            <Users size={15} />
            <span>Customers</span>
            <span className="ml-1 rounded-full bg-[#E31E24]/10 text-[#E31E24] px-2 py-0.5 text-[11px] font-semibold">
              {totals.total}
            </span>
          </Link>
          {hasPermission("users.view") && (
            <Link
              href="/admin/users"
              className="flex items-center gap-2 border-b-2 border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A] px-3 pb-3 pt-1 text-[13.5px] font-medium shrink-0 whitespace-nowrap transition-colors cursor-pointer"
            >
              <UserCog size={15} />
              <span>Staff (Users)</span>
            </Link>
          )}
        </div>

        <AdminStatsGrid
          stats={[
            { title: "Total Customers", value: totals.total, subtitle: "All customer records", icon: <Users size={18} />, isLoading: customerCountsLoading },
            { title: "Active Accounts", value: totals.active, subtitle: "Currently enabled", icon: <Shield size={18} />, color: "bg-emerald-600", isLoading: customerCountsLoading },
            { title: "Pending Approval", value: totals.pending, subtitle: "Wholesale accounts waiting", icon: <UserCog size={18} />, color: "bg-amber-600", isLoading: customerCountsLoading },
            { title: "Wholesale Customers", value: totals.wholesale, subtitle: "Sales-focused accounts", icon: <Store size={18} />, color: "bg-sky-600", isLoading: customerCountsLoading }
          ]}
        />

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search customer name, email, company, phone...",
            widthClassName: "w-[280px]",
          }}
          filters={{
            showFilters: showAdvancedFilters,
            onToggle: () => setShowAdvancedFilters(!showAdvancedFilters),
            activeCount: activeFilterCount,
            label: "Filters",
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key) => {
              setVisibleColumns((current) => ({
                ...current,
                [key]: !current[key as keyof typeof current],
              }));
            },
            options: [
              { key: "name", label: "Customer" },
              { key: "companyName", label: "Company / Country" },
              { key: "customerRole", label: "Role" },
              { key: "tier", label: "Tier" },
              { key: "status", label: "Account" },
              { key: "approvalStatus", label: "Approval" },
              { key: "createdAt", label: "Created Date" },
              { key: "actions", label: "Actions" },
            ],
          }}
          refresh={{
            onRefresh: () => {
              void customerQuery.refetch().then(() => showToast("Customers refreshed."));
            },
            isRefreshing: customerQuery.isFetching,
          }}
          primaryAction={hasPermission("customers.create") ? { href: "/admin/customers/create", label: "Add Customer", icon: <Plus size={14} /> } : undefined}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 pt-2">
              <AdminSelect
                label="Account Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={STATUS_OPTIONS}
              />
              <AdminSelect
                label="Approval Status"
                value={approvalFilter}
                onChange={(e) => {
                  setApprovalFilter(e.target.value);
                  setPage(1);
                }}
                options={APPROVAL_OPTIONS}
              />
              <AdminSelect
                label="Customer Role"
                value={roleFilter}
                onChange={(e) => {
                  setRoleFilter(e.target.value);
                  setPage(1);
                }}
                options={roleOptions}
              />
              <AdminSelect
                label="Customer Type"
                value={customerTypeFilter}
                onChange={(e) => {
                  setCustomerTypeFilter(e.target.value);
                  setPage(1);
                }}
                options={CUSTOMER_TYPE_OPTIONS}
              />
              <AdminSelect
                label="Customer Tier"
                value={tierFilter}
                onChange={(e) => {
                  setTierFilter(e.target.value);
                  setPage(1);
                }}
                options={tierOptions}
              />
              <AdminSelect
                label="Sort Field"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                options={[
                  { value: "createdAt", label: "Created Date" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "firstName", label: "Customer Name" },
                  { value: "email", label: "Email" },
                ]}
              />
              <AdminSelect
                label="Sort Order"
                value={sortDir}
                onChange={(e) => setSortDir(e.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Descending (Newest)" },
                  { value: "asc", label: "Ascending (Oldest)" },
                ]}
              />
            </div>
          }
          onResetFilters={resetFilters}
        />

        {/* FULL-WIDTH DATA TABLE */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<CustomerRow>
            title="Customers List"
            columns={filteredColumns}
            data={customers}
            rowKey="id"
            isLoading={customerQuery.isLoading}
            emptyMessage="No customers found."
            totalItems={pagination.total}
            currentPage={page}
            pageSize={limit}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            pageSizeOptions={[10, 25, 50, 100]}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={pagination.totalPages || 1}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>

      <ConfirmModal
        open={!!pendingAction}
        title={pendingAction?.action === "APPROVE" ? "Approve customer?" : "Reject customer?"}
        message={
          pendingAction
            ? `${pendingAction.action === "APPROVE" ? "Approve" : "Reject"} account for ${pendingAction.customer.firstName} ${pendingAction.customer.lastName}?`
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
        isLoading={deletingLoading}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
