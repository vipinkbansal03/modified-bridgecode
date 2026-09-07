"use client";

import { useEffect, useMemo, useState } from "react";
import * as Yup from "yup";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import {
  Mail,
  Users,
  UserPlus,
  CheckCircle2,
  XCircle,
  X,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  DataTable,
  AdminInput,
  AdminSelect,
  AdminStatsGrid,
  AdminListToolbar,
  Pagination,
  StatusBadge,
  useToast,
  ConfirmModal,
  LoadingButton,
  type Column,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminSubscribers,
  useCreateSubscriber,
  useUpdateSubscriberStatus,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { cn } from "@/utils/cn";

type SubscriberRow = {
  id: string;
  email: string;
  status: string;
  source: string;
  subscribedAt: string;
  unsubscribedAt?: string | null;
  createdAt: string;
};

const initialSubscriberValues = { email: "" };
const addSubscriberSchema = Yup.object({
  email: Yup.string().email("Invalid email").required("Email is required"),
});

const visibleColumnsDefault = {
  email: true,
  status: true,
  subscribedAt: true,
  unsubscribedAt: true,
  actions: true,
};

export default function NewsletterAdminPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("subscribedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);

  // Manual Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);

  // Confirmations State
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<SubscriberRow | null>(null);

  const { showToast, ToastComponent } = useToast();

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const { data, isLoading, refetch, isFetching } = useAdminSubscribers({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortDir,
  });

  const { data: allData } = useAdminSubscribers({ limit: 1000 });
  const allSubscribers = useMemo(
    () => (allData?.data ?? []) as SubscriberRow[],
    [allData?.data],
  );

  const subscribers = useMemo(
    () => (data?.data ?? []) as SubscriberRow[],
    [data?.data],
  );
  const total = data?.pagination?.total ?? 0;
  const totalPages = data?.pagination?.totalPages ?? 1;

  const totalCount = allSubscribers.length || total;
  const activeCount = allSubscribers.filter((s) => s.status === "ACTIVE").length;
  const unsubCount = allSubscribers.filter((s) => s.status === "UNSUBSCRIBED").length;

  const createMutation = useCreateSubscriber();
  const updateStatusMutation = useUpdateSubscriberStatus();

  const form = useAdminForm({
    initialValues: initialSubscriberValues,
    validationSchema: addSubscriberSchema,
    onSubmit: async (values, { setSubmitting, resetForm, setStatus }) => {
      setStatus("");
      try {
        await createMutation.mutateAsync({ email: values.email.trim() });
        showToast("Subscriber registered successfully.");
        setIsAddOpen(false);
        resetForm();
        refetch();
      } catch (err) {
        const msg = getAdminErrorMessage(err, "Failed to register email.");
        setStatus(msg);
        showToast(msg, "error");
      } finally {
        setSubmitting(false);
      }
    },
  });

  const handleOpenAddModal = () => {
    form.resetForm();
    setIsAddOpen(true);
  };

  const handleCloseAddModal = () => {
    setIsAddOpen(false);
    form.resetForm();
  };

  useEffect(() => {
    if (!isAddOpen) {
      form.resetForm();
    }
  }, [isAddOpen]);

  const handleToggleClick = (row: SubscriberRow) => {
    setToggleTarget(row);
    setIsConfirmToggleOpen(true);
  };

  const executeToggleStatus = () => {
    if (!toggleTarget) return;
    const nextStatus = toggleTarget.status === "ACTIVE" ? "UNSUBSCRIBED" : "ACTIVE";

    updateStatusMutation.mutate(
      { id: toggleTarget.id, status: nextStatus },
      {
        onSuccess: () => {
          showToast(`Subscriber marked as ${nextStatus.toLowerCase()}.`);
          setIsConfirmToggleOpen(false);
          setToggleTarget(null);
          refetch();
        },
        onError: (err) => {
          showToast(getAdminErrorMessage(err, "Action could not be performed."), "error");
        },
      },
    );
  };

  const columns: Column<SubscriberRow>[] = [
    {
      key: "email",
      label: "Subscriber Email",
      width: "320px",
      align: "left",
      render: (row: SubscriberRow) => (
        <div className="min-w-0 pr-3">
          <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">{row.email}</p>
          <p className="text-[11.5px] text-[#6B6B6B] mt-0.5">
            Source: {row.source ? row.source.toLowerCase() : "storefront"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "140px",
      align: "left",
      render: (row: SubscriberRow) => <StatusBadge status={row.status} />,
    },
    {
      key: "subscribedAt",
      label: "Subscribed Date",
      width: "160px",
      align: "left",
      render: (row: SubscriberRow) => (
        <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
          {row.subscribedAt ? new Date(row.subscribedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "unsubscribedAt",
      label: "Unsubscribed Date",
      width: "160px",
      align: "left",
      render: (row: SubscriberRow) => (
        <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
          {row.unsubscribedAt ? new Date(row.unsubscribedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "140px",
      align: "left",
      render: (row: SubscriberRow) => (
        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={() => handleToggleClick(row)}
            className={`inline-flex h-7 items-center rounded-md px-2.5 text-[12px] font-semibold transition-colors shadow-2xs cursor-pointer ${
              row.status === "ACTIVE"
                ? "border border-[#F2C9C9] bg-white text-[#E31E24] hover:bg-[#FFF5F5]"
                : "border border-[#CFE8D7] bg-white text-[#1F8F4A] hover:bg-[#F1FBF4]"
            }`}
          >
            {row.status === "ACTIVE" ? "Unsubscribe" : "Reactivate"}
          </button>
        </div>
      ),
    },
  ];

  const filteredColumns = columns.filter((column) => {
    if (column.key === "email") return visibleColumns.email;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "subscribedAt") return visibleColumns.subscribedAt;
    if (column.key === "unsubscribedAt") return visibleColumns.unsubscribedAt;
    if (column.key === "actions") return visibleColumns.actions;
    return true;
  });

  return (
    <AdminLayout title="Newsletter Subscribers" breadcrumb={[{ label: "Customers", href: "/admin/customers" }, { label: "Newsletter Subscribers" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total List Count", value: totalCount, subtitle: "All registered emails", icon: <Mail size={18} />, isLoading },
            { title: "Active Subscriptions", value: activeCount, subtitle: "Subscribed and active", icon: <CheckCircle2 size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Unsubscriptions", value: unsubCount, subtitle: "Opted-out subscribers", icon: <XCircle size={18} />, color: "bg-slate-600", isLoading },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {[
            { id: "", label: "All Subscribers", count: totalCount, icon: <Mail size={15} /> },
            { id: "ACTIVE", label: "Active", count: activeCount, icon: <CheckCircle2 size={15} /> },
            { id: "UNSUBSCRIBED", label: "Unsubscribed", count: unsubCount, icon: <XCircle size={15} /> },
          ].map((tab) => {
            const isActive = statusFilter === tab.id;
            return (
              <button
                key={tab.id || "ALL"}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id);
                  setPage(1);
                }}
                className={cn(
                  "flex items-center gap-2 border-b-2 px-3 pb-3 pt-1 text-[13.5px] font-medium transition-colors cursor-pointer shrink-0 whitespace-nowrap",
                  isActive
                    ? "border-[#E31E24] text-[#E31E24]"
                    : "border-transparent text-[#666] hover:border-[#CCC] hover:text-[#1A1A1A]"
                )}
              >
                {tab.icon}
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "ml-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    isActive
                      ? "bg-[#E31E24]/10 text-[#E31E24]"
                      : "bg-[#F0F0F0] text-[#666]"
                  )}
                >
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>

        <AdminListToolbar
          search={{
            value: search,
            onChange: (val) => {
              setSearch(val);
              setPage(1);
            },
            placeholder: "Search subscriber email...",
            widthClassName: "w-[260px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [statusFilter, sortBy !== "subscribedAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
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
              { key: "email", label: "Subscriber Email" },
              { key: "status", label: "Status" },
              { key: "subscribedAt", label: "Subscribed Date" },
              { key: "unsubscribedAt", label: "Unsubscribed Date" },
              { key: "actions", label: "Actions" },
            ],
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Subscribers refreshed."));
            },
            isRefreshing: isFetching,
          }}
          primaryAction={{
            onClick: handleOpenAddModal,
            label: "Add Subscriber",
            icon: <UserPlus size={14} />,
          }}
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setSortBy("subscribedAt");
            setSortDir("desc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-3 pt-2">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "UNSUBSCRIBED", label: "Unsubscribed" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "subscribedAt", label: "Subscribed Date" },
                  { value: "email", label: "Email Address" },
                  { value: "status", label: "Status" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(e) => {
                  setSortDir(e.target.value as "asc" | "desc");
                  setPage(1);
                }}
                options={[
                  { value: "desc", label: "Descending (Newest)" },
                  { value: "asc", label: "Ascending (Oldest)" },
                ]}
              />
            </div>
          }
        />

        {/* FULL-WIDTH DATA TABLE */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<SubscriberRow>
            title="Subscribers List"
            columns={filteredColumns}
            data={subscribers}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No subscribers found."
            totalItems={total}
            currentPage={page}
            pageSize={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            pageSizeOptions={[10, 20, 50, 100]}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
      </div>

      {/* Manual Add Subscriber Modal */}
      <Modal
        open={isAddOpen}
        onClose={handleCloseAddModal}
        title="Manually Add Subscriber"
        subtitle="Register an email address to the newsletter distribution list."
        size="md"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={handleCloseAddModal}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              disabled={form.isSubmitting}
            >
              Cancel
            </button>
            <LoadingButton
              type="submit"
              form="add-subscriber-form"
              loading={form.isSubmitting || createMutation.isPending}
              loadingText="Adding..."
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
            >
              Add Subscriber
            </LoadingButton>
          </div>
        }
      >
        <form id="add-subscriber-form" onSubmit={form.handleSubmit} className="space-y-4 p-6">
          <AdminInput
            label="Email Address"
            required
            type="email"
            placeholder="subscriber@example.com"
            {...form.getFieldProps("email")}
            error={form.touched.email && typeof form.errors.email === "string" ? form.errors.email : undefined}
            disabled={form.isSubmitting}
          />
          {form.status && (
            <p className="text-[12.5px] text-[#E31E24]">{form.status}</p>
          )}
        </form>
      </Modal>

      {/* Confirmation Modal for Reactivation / Unsubscribe toggle */}
      <ConfirmModal
        open={isConfirmToggleOpen}
        title={
          toggleTarget?.status === "ACTIVE"
            ? "Unsubscribe User"
            : "Reactivate User"
        }
        message={
          toggleTarget?.status === "ACTIVE"
            ? `Are you sure you want to unsubscribe ${toggleTarget?.email} from the newsletter?`
            : `Are you sure you want to reactivate ${toggleTarget?.email} as an active subscriber?`
        }
        onConfirm={executeToggleStatus}
        onCancel={() => {
          setIsConfirmToggleOpen(false);
          setToggleTarget(null);
        }}
        isLoading={updateStatusMutation.isPending}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
