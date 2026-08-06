"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Search,
  Mail,
  Users,
  UserPlus,
  X,
  Check,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  DataTable,
  Pagination,
  AdminInput,
  AdminSelect,
  StatCard,
  useToast,
  ConfirmModal,
  type Column,
} from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { RefreshButton } from "@/components/admin/RefreshButton";
import {
  useAdminSubscribers,
  useCreateSubscriber,
  useUpdateSubscriberStatus,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type SubscriberRow = {
  id: string;
  email: string;
  status: string;
  source: string;
  subscribedAt: string;
  unsubscribedAt?: string | null;
  createdAt: string;
};

export default function NewsletterAdminPage() {
  // Subscribers Listing State
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [sortBy, setSortBy] = useState("subscribedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Manual Add Modal State
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");

  // Confirmations State
  const [isConfirmToggleOpen, setIsConfirmToggleOpen] = useState(false);
  const [toggleTarget, setToggleTarget] = useState<SubscriberRow | null>(null);

  const { showToast } = useToast();

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch Subscribers
  const { data, isLoading, refetch, isFetching } = useAdminSubscribers({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: statusFilter || undefined,
    sortBy,
    sortDir,
  });

  const subscribers = useMemo(
    () => (data?.data ?? []) as SubscriberRow[],
    [data?.data],
  );
  const pagination = data?.pagination ?? {
    page,
    limit,
    total: 0,
    totalPages: 1,
  };

  const createMutation = useCreateSubscriber();
  const updateStatusMutation = useUpdateSubscriberStatus();

  // Quick stats computed from total pagination or filtered counts
  const stats = useMemo(() => {
    return {
      total: pagination.total ?? 0,
      active: subscribers.filter((s) => s.status === "ACTIVE").length,
      unsubscribed: subscribers.filter((s) => s.status === "UNSUBSCRIBED").length,
    };
  }, [subscribers, pagination.total]);

  // Handlers
  const handleAddSubscriber = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim()) return;

    createMutation.mutate(
      { email: newEmail.trim() },
      {
        onSuccess: () => {
          showToast({
            title: "Subscriber added",
            message: `${newEmail.trim()} has been registered successfully.`,
            type: "success",
          });
          setNewEmail("");
          setIsAddOpen(false);
          refetch();
        },
        onError: (err) => {
          showToast({
            title: "Error adding subscriber",
            message: getAdminErrorMessage(err, "Failed to register email."),
            type: "error",
          });
        },
      },
    );
  };

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
          showToast({
            title: "Subscriber status updated",
            message: `Subscriber marked as ${nextStatus.toLowerCase()}.`,
            type: "success",
          });
          setIsConfirmToggleOpen(false);
          setToggleTarget(null);
          refetch();
        },
        onError: (err) => {
          showToast({
            title: "Failed to update status",
            message: getAdminErrorMessage(err, "Action could not be performed."),
            type: "error",
          });
        },
      },
    );
  };

  // Columns Configuration
  const columns: Column<SubscriberRow>[] = [
    {
      key: "email",
      label: "Subscriber Email",
      render: (row: SubscriberRow) => (
        <div>
          <p className="text-[13.5px] font-semibold text-[#1A1A1A]">{row.email}</p>
          <p className="text-[11.5px] text-[#6B6B6B]">
            Source: {row.source ? row.source.toLowerCase() : "storefront"}
          </p>
        </div>
      ),
    },
    {
      key: "status",
      label: "Status",
      render: (row: SubscriberRow) => {
        const isActive = row.status === "ACTIVE";
        return (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
              isActive
                ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                : "bg-gray-100 text-gray-600 border border-gray-200"
            }`}
          >
            {isActive ? <Check size={11} /> : <X size={11} />}
            {row.status}
          </span>
        );
      },
    },
    {
      key: "subscribedAt",
      label: "Subscribed Date",
      render: (row: SubscriberRow) => (
        <span className="text-[12.5px] text-[#6B6B6B]">
          {row.subscribedAt ? new Date(row.subscribedAt).toLocaleDateString() : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: SubscriberRow) => (
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={() => handleToggleClick(row)}
            className={`rounded-md px-2.5 py-1 text-[12px] font-semibold transition ${
              row.status === "ACTIVE"
                ? "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            }`}
          >
            {row.status === "ACTIVE" ? "Unsubscribe" : "Reactivate"}
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Newsletter Subscribers">
      <div className="space-y-6">
        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-3">
          <StatCard
            title="Total List Count"
            value={stats.total}
            subtitle="All registered emails"
            icon={<Users size={18} />}
            isLoading={isLoading}
          />
          <StatCard
            title="Active Subscriptions"
            value={stats.active}
            subtitle="Subscribed and active"
            icon={<Mail size={18} />}
            color="bg-emerald-600"
            isLoading={isLoading}
          />
          <StatCard
            title="Unsubscriptions"
            value={stats.unsubscribed}
            subtitle="Opted-out subscribers"
            icon={<X size={18} />}
            color="bg-gray-600"
            isLoading={isLoading}
          />
        </div>

        {/* List Toolbar */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[280px]">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search subscriber email..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <RefreshButton onRefresh={refetch} isRefreshing={isFetching} />

              <AdminSelect
                label=""
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                className="h-10"
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "UNSUBSCRIBED", label: "Unsubscribed" },
                ]}
              />

              <button
                type="button"
                onClick={() => setIsAddOpen(true)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
              >
                <UserPlus size={14} />
                Add Subscriber
              </button>
            </div>
          </div>
        </div>

        {/* Subscribers Table */}
        <DataTable
          columns={columns}
          data={subscribers}
          isLoading={isLoading}
          rowKey="id"
        />

        {/* Pagination */}
        <div className="mt-6">
          <Pagination
            page={page}
            totalPages={pagination.totalPages}
            onPageChange={setPage}
          />
        </div>
      </div>

      {/* Manual Add Subscriber Modal */}
      <Modal
        open={isAddOpen}
        onClose={() => setIsAddOpen(false)}
        title="Manually Add Subscriber"
      >
        <form onSubmit={handleAddSubscriber} className="space-y-4 p-5">
          <AdminInput
            label="Email Address"
            required
            type="email"
            placeholder="subscriber@example.com"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            disabled={createMutation.isPending}
          />
          <div className="flex justify-end gap-2.5 pt-2">
            <button
              type="button"
              onClick={() => setIsAddOpen(false)}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]"
              disabled={createMutation.isPending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? "Adding..." : "Add Subscriber"}
            </button>
          </div>
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
        danger={toggleTarget?.status === "ACTIVE"}
      />
    </AdminLayout>
  );
}
