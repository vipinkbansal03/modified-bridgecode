"use client";

import Link from "next/link";
import { useState } from "react";
import { Eye, RotateCw } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminSelect,
  DataTable,
  StatusBadge,
  type Column,
} from "@/components/admin/AdminComponents";
import { useAdminOrderReturns, useUpdateOrderReturnStatus } from "@/hooks/admin/useAdminHooks";
import { Modal } from "@/components/ui/Modal";

type ReturnRow = {
  id: string;
  status: string;
  reason: string;
  refundAmount: number | string;
  createdAt: string;
  customer: { firstName: string; lastName: string; email: string };
  order: { orderNumber: string; currency?: { symbol?: string | null } | null };
};

export default function AdminReturnsPage() {
  const { hasPermission } = useAdminAuth();
  const { mutate: updateStatus } = useUpdateOrderReturnStatus();
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    type: "APPROVE" | "REJECT" | "COMPLETE" | null;
    returnId: string | null;
    notes: string;
  }>({
    open: false,
    type: null,
    returnId: null,
    notes: "",
  });
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const limit = 10;

  const { data, isLoading } = useAdminOrderReturns({
    status: statusFilter || undefined,
    page: String(page),
    limit: String(limit),
  }) as { data?: { data: ReturnRow[]; pagination: { total: number; totalPages: number } }; isLoading: boolean };

  const returns = data?.data || [];
  const total = data?.pagination?.total || 0;
  const totalPages = data?.pagination?.totalPages || 1;

  const columns: Column<ReturnRow>[] = [
    {
      key: "orderNumber",
      label: "Order #",
      render: (row: ReturnRow) => (
        <span className="font-mono font-semibold text-ink">
          {row.order.orderNumber}
        </span>
      ),
    },
    {
      key: "customer",
      label: "Customer",
      render: (row: ReturnRow) => (
        <div>
          <div className="font-medium text-ink">
            {row.customer.firstName} {row.customer.lastName}
          </div>
          <div className="text-[12px] text-[#9A9A9A]">{row.customer.email}</div>
        </div>
      ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (row: ReturnRow) => (
        <span className="text-[13px] text-steel max-w-[200px] block truncate" title={row.reason}>
          {row.reason}
        </span>
      ),
    },
    {
      key: "refundAmount",
      label: "Refund Amount",
      render: (row: ReturnRow) => {
        const sym = row.order.currency?.symbol ?? "$";
        return (
          <span className="font-semibold text-ink">
            {sym}{Number(row.refundAmount).toFixed(2)}
          </span>
        );
      },
    },
    {
      key: "status",
      label: "Status",
      render: (row: ReturnRow) => <StatusBadge status={row.status} />,
    },
    {
      key: "createdAt",
      label: "Date Requested",
      render: (row: ReturnRow) => (
        <span className="text-[13px] text-steel">
          {new Date(row.createdAt).toLocaleDateString("en-IN", {
            dateStyle: "medium",
          })}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      render: (row: ReturnRow) => (
        <div className="flex items-center gap-2">
          <Link
            href={`/admin/returns/${row.id}`}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E6E6E6] bg-white text-steel hover:bg-grey hover:text-ink transition"
            title="View Details"
          >
            <Eye size={14} />
          </Link>
          {row.status === "PENDING" && (
            <>
              <button
                onClick={() => {
                  setActionModal({
                    open: true,
                    type: "APPROVE",
                    returnId: row.id,
                    notes: "",
                  });
                }}
                className="inline-flex h-8 px-2.5 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 text-[12px] font-semibold hover:bg-emerald-100 transition shadow-sm"
                title="Approve"
              >
                Approve
              </button>
              <button
                onClick={() => {
                  setActionModal({
                    open: true,
                    type: "REJECT",
                    returnId: row.id,
                    notes: "",
                  });
                }}
                className="inline-flex h-8 px-2.5 items-center justify-center rounded-md border border-rose-200 bg-rose-50 text-rose-700 text-[12px] font-semibold hover:bg-rose-100 transition shadow-sm"
                title="Reject"
              >
                Reject
              </button>
            </>
          )}
          {row.status === "APPROVED" && (
            <button
              onClick={() => {
                setActionModal({
                  open: true,
                  type: "COMPLETE",
                  returnId: row.id,
                  notes: "",
                });
              }}
              className="inline-flex h-8 px-2.5 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 text-[12px] font-semibold hover:bg-blue-100 transition shadow-sm"
              title="Complete & Refund"
            >
              Complete & Refund
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout
      title="Returns & Refunds"
      breadcrumb={[{ label: "Commerce" }, { label: "Returns & Refunds" }]}
    >
      <div className="space-y-4">
        {/* Filters Toolbar */}
        <div className="rounded-lg border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="w-full sm:w-60">
              <AdminSelect
                label="Status Filter"
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "PENDING", label: "Pending" },
                  { value: "APPROVED", label: "Approved" },
                  { value: "REJECTED", label: "Rejected" },
                  { value: "COMPLETED", label: "Completed" },
                ]}
              />
            </div>
            {isLoading && (
              <div className="flex items-center gap-2 text-steel text-[13px] sm:ml-auto">
                <RotateCw size={14} className="animate-spin" />
                <span>Loading…</span>
              </div>
            )}
          </div>
        </div>

        {/* Datatable */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden">
          <DataTable<ReturnRow>
            title="Return Requests"
            columns={columns}
            data={returns}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No return requests found."
            totalItems={total}
            currentPage={page}
            pageSize={limit}
            totalPages={totalPages}
            onPageChange={setPage}
          />
        </div>

        <Modal
          open={actionModal.open}
          onClose={() => setActionModal({ open: false, type: null, returnId: null, notes: "" })}
          title={
            actionModal.type === "APPROVE"
              ? "Approve Return Request"
              : actionModal.type === "REJECT"
              ? "Reject Return Request"
              : "Complete & Refund Return"
          }
          footer={
            <>
              <button
                type="button"
                onClick={() => setActionModal({ open: false, type: null, returnId: null, notes: "" })}
                className="px-4 py-2 text-[13px] font-semibold text-[#6B7280] bg-white border border-[#D1D5DB] rounded-lg hover:bg-[#F3F4F6] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => {
                  if (actionModal.returnId && actionModal.type) {
                    const nextStatus =
                      actionModal.type === "APPROVE"
                        ? "APPROVED"
                        : actionModal.type === "REJECT"
                        ? "REJECTED"
                        : "COMPLETED";
                    updateStatus(
                      {
                        id: actionModal.returnId,
                        status: nextStatus,
                        adminNotes: actionModal.type === "REJECT" ? actionModal.notes : undefined,
                      },
                      {
                        onSuccess: () => {
                          setActionModal({ open: false, type: null, returnId: null, notes: "" });
                        },
                      }
                    );
                  }
                }}
                className={`px-4 py-2 text-[13px] font-semibold text-white rounded-lg transition-colors ${
                  actionModal.type === "REJECT"
                    ? "bg-rose-600 hover:bg-rose-700"
                    : actionModal.type === "APPROVE"
                    ? "bg-emerald-600 hover:bg-emerald-700"
                    : "bg-blue-600 hover:bg-blue-700"
                }`}
              >
                {actionModal.type === "APPROVE"
                  ? "Confirm Approve"
                  : actionModal.type === "REJECT"
                  ? "Confirm Reject"
                  : "Confirm Complete & Refund"}
              </button>
            </>
          }
        >
          <div className="p-6 text-[13.5px] text-[#374151] space-y-4">
            {actionModal.type === "APPROVE" && (
              <p>Are you sure you want to approve this return request?</p>
            )}
            {actionModal.type === "COMPLETE" && (
              <p>Are you sure you want to mark this return as completed and issue the refund? This action will automatically replenish the warehouse inventory levels.</p>
            )}
            {actionModal.type === "REJECT" && (
              <div className="space-y-2">
                <p>Please enter the reason for rejecting this return request (this will be visible to the customer):</p>
                <textarea
                  rows={4}
                  value={actionModal.notes}
                  onChange={(e) => setActionModal((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="Enter rejection notes..."
                  className="w-full rounded-lg border border-[#D1D5DB] p-3 text-[13.5px] text-ink outline-none focus:border-brand focus:ring-1 focus:ring-brand"
                />
              </div>
            )}
          </div>
        </Modal>
      </div>
    </AdminLayout>
  );
}
