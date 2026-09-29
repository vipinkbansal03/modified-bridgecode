"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Copy,
  Edit2,
  Filter,
  Plus,
  Search,
  Tag,
  Ticket,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  SlidersHorizontal,
  Trash2,
  X,
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
  LoadingButton,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import {
  AdminRowActions,
  AdminActionButton,
} from "@/components/admin/AdminRowActions";
import { Modal } from "@/components/ui/Modal";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import {
  useAdminCountries,
  useAdminCoupons,
  useCreateCoupon,
  useDeleteCoupon,
  useUpdateCoupon,
  useBulkCoupons,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { cn } from "@/utils/cn";
import { formatDate } from "@/utils/formatDate";

type Related = { id: string; name?: string; code?: string };

type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string | number;
  minOrderValue: string | number | null;
  maxDiscount: string | number | null;
  startDate: string;
  endDate: string;
  usageLimit: number | null;
  usedCount: number;
  countryId: string | null;
  country?: Related | null;
  status: "ACTIVE" | "INACTIVE";
  effectiveStatus?: "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE";
  createdAt?: string;
};

type FormState = {
  id?: string;
  code: string;
  description: string;
  discountType: "PERCENTAGE" | "FIXED";
  discountValue: string;
  minOrderValue: string;
  maxDiscount: string;
  startDate: string;
  endDate: string;
  usageLimit: string;
  countryIds: string[];
  status: "ACTIVE" | "INACTIVE";
};

const blankForm: FormState = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: "",
  minOrderValue: "",
  maxDiscount: "",
  startDate: "",
  endDate: "",
  usageLimit: "",
  countryIds: [],
  status: "ACTIVE",
};

const visibleColumnsDefault = {
  code: true,
  discount: true,
  conditions: true,
  usage: true,
  status: true,
  actions: true,
};

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function amount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function valueLabel(coupon: CouponRow) {
  return coupon.discountType === "PERCENTAGE" ? `${amount(coupon.discountValue)}%` : amount(coupon.discountValue);
}

function getEffectiveCouponStatus(coupon: CouponRow): "ACTIVE" | "SCHEDULED" | "EXPIRED" | "INACTIVE" {
  if (coupon.effectiveStatus) return coupon.effectiveStatus;
  if (coupon.status !== "ACTIVE") return "INACTIVE";
  const now = new Date();
  const start = new Date(coupon.startDate);
  const end = new Date(coupon.endDate);
  if (now < start) return "SCHEDULED";
  if (now > end) return "EXPIRED";
  return "ACTIVE";
}

function toForm(coupon: CouponRow): FormState {
  return {
    id: coupon.id,
    code: coupon.code,
    description: coupon.description ?? "",
    discountType: coupon.discountType,
    discountValue: String(coupon.discountValue ?? ""),
    minOrderValue: coupon.minOrderValue != null ? String(coupon.minOrderValue) : "",
    maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : "",
    startDate: dateInput(coupon.startDate),
    endDate: dateInput(coupon.endDate),
    usageLimit: coupon.usageLimit ? String(coupon.usageLimit) : "",
    countryIds: (coupon as any).countryIds?.length ? (coupon as any).countryIds : (coupon.countryId ? [coupon.countryId] : []),
    status: coupon.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

export default function CouponsPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("coupons.create");
  const canUpdate = hasPermission("coupons.update");
  const canDelete = hasPermission("coupons.delete");

  const { showToast, ToastComponent } = useToast();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [sortBy, setSortBy] = useState("createdAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState(visibleColumnsDefault);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CouponRow | null>(null);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const bulkCoupons = useBulkCoupons();

  const { data, isLoading, refetch, isFetching } = useAdminCoupons({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: status || undefined,
    sortBy,
    sortDir,
  });

  const { data: allCouponsData } = useAdminCoupons({ limit: 1000 });
  const allCoupons: CouponRow[] = (allCouponsData as any)?.data ?? [];

  const { data: countries = [] } = useAdminCountries();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const response = data as { data?: CouponRow[]; pagination?: { page: number; limit: number; total: number; totalPages: number } } | undefined;
  const coupons = response?.data ?? [];
  const pagination = response?.pagination ?? { page, limit, total: 0, totalPages: 1 };

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, status, sortBy, sortDir, limit]);

  useEffect(() => {
    setSelectedIds([]);
  }, [debouncedSearch, status, sortBy, sortDir]);

  const stats = useMemo(() => {
    return {
      total: allCoupons.length || Number(pagination.total ?? 0),
      active: allCoupons.filter((coupon) => getEffectiveCouponStatus(coupon) === "ACTIVE").length,
      scheduled: allCoupons.filter((coupon) => getEffectiveCouponStatus(coupon) === "SCHEDULED").length,
      expired: allCoupons.filter((coupon) => getEffectiveCouponStatus(coupon) === "EXPIRED").length,
      inactive: allCoupons.filter((coupon) => getEffectiveCouponStatus(coupon) === "INACTIVE").length,
    };
  }, [allCoupons, pagination.total]);

  const countryOptions = useMemo(
    () => [
      ...countries
        .filter((country: any) => country.status === "ACTIVE")
        .map((country: any) => ({
          value: country.id,
          label: `${country.name ?? country.code ?? country.id}${country.code ? ` (${country.code})` : ""}`,
        })),
    ],
    [countries],
  );

  const form = useAdminForm<FormState>({
    initialValues: blankForm,
    validate: (values) => {
      const errors: any = {};
      if (!values.code.trim()) errors.code = "Coupon code is required.";
      if (!values.discountValue) errors.discountValue = "Discount value is required.";
      if (!values.startDate) errors.startDate = "Start date is required.";
      if (!values.endDate) errors.endDate = "End date is required.";
      if (values.startDate && values.endDate && new Date(values.endDate) < new Date(values.startDate)) errors.endDate = "End date must be after start date.";
      if (values.discountType === "PERCENTAGE" && Number(values.discountValue) > 100) errors.discountValue = "Percentage discount cannot exceed 100.";
      return errors;
    },
    onSubmit: async (values, { setSubmitting, resetForm: formReset }) => {
      const payload = {
        code: values.code.trim().toUpperCase(),
        description: values.description.trim() || null,
        discountType: values.discountType,
        discountValue: values.discountValue,
        minOrderValue: values.minOrderValue || null,
        maxDiscount: values.discountType === "PERCENTAGE" ? values.maxDiscount || null : null,
        startDate: values.startDate,
        endDate: values.endDate,
        usageLimit: values.usageLimit || null,
        countryIds: values.countryIds,
        countryId: values.countryIds.length > 0 ? values.countryIds[0] : null,
        status: values.status,
      };

      try {
        if (values.id) {
          await updateCoupon.mutateAsync({ id: values.id, ...payload });
          showToast("Coupon updated.");
        } else {
          await createCoupon.mutateAsync(payload);
          showToast("Coupon created.");
        }
        formReset();
        setIsFormOpen(false);
      } catch (err) {
        showToast(getAdminErrorMessage(err, "Failed to save coupon."), "error");
      }
    }
  });

  const resetForm = () => {
    form.reset();
    setIsFormOpen(false);
  };

  const openCreate = () => {
    form.reset();
    setIsFormOpen(true);
  };

  const toggleStatus = async (coupon: CouponRow) => {
    const nextStatus = coupon.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateCoupon.mutateAsync({ id: coupon.id, status: nextStatus });
      showToast(nextStatus === "ACTIVE" ? "Coupon activated." : "Coupon paused.");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to update coupon status."), "error");
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await deleteCoupon.mutateAsync(deleting.id);
      showToast("Coupon deleted.");
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to delete coupon."), "error");
    } finally {
      setDeleting(null);
    }
  };

  const handleSelectAll = async (checked: boolean) => {
    if (!checked) {
      setSelectedIds([]);
      return;
    }
    try {
      const { adminApi } = await import("@/services/adminApi");
      const res = await adminApi.get("/coupons", {
        params: {
          status: status || undefined,
          search: debouncedSearch.trim() || undefined,
          sortBy,
          sortDir,
          limit: 999999,
          ignoreMaxLimit: "true",
        },
      });
      const allIds = (res.data.data ?? []).map((c: any) => c.id);
      setSelectedIds(allIds);
      showToast(`Selected all ${allIds.length} coupons across all pages.`, "success");
    } catch (err) {
      showToast("Failed to select all coupons.", "error");
    }
  };

  const handleBulkAction = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    if (bulkAction === "delete") {
      setBulkDeleting(true);
      return;
    }

    setBulkSaving(true);
    try {
      await bulkCoupons.mutateAsync({
        ids: selectedIds,
        action: bulkAction === "activate" ? "ENABLE" : "DISABLE",
      });
      showToast(
        bulkAction === "activate" ? "Coupons activated." : "Coupons paused."
      );
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to run bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const confirmBulkDelete = async () => {
    setBulkSaving(true);
    try {
      await bulkCoupons.mutateAsync({
        ids: selectedIds,
        action: "DELETE",
      });
      showToast("Coupons deleted.");
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to delete coupons."), "error");
    } finally {
      setBulkSaving(false);
      setBulkDeleting(false);
    }
  };

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      label: "Coupon",
      width: "200px",
      render: (row) => (
        <div className="min-w-0 pr-3">
          <button
            type="button"
            onClick={() => {
              if (canUpdate) {
                form.reset(toForm(row));
                setIsFormOpen(true);
              }
            }}
            className="inline-flex rounded-md bg-[#F8F8F8] px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wide text-[#1A1A1A] hover:text-[#E31E24] hover:bg-[#F0F0F0] transition-colors cursor-pointer"
            title={`Edit ${row.code}`}
          >
            {row.code}
          </button>
          {row.description ? (
            <div className="mt-1 text-[11.5px] text-[#6B6B6B] truncate" title={row.description}>
              {row.description}
            </div>
          ) : null}
        </div>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      width: "140px",
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1A1A1A] text-[13px]">
            {row.discountType === "PERCENTAGE" ? `${valueLabel(row)} off` : `${valueLabel(row)} off`}
          </div>
          <div className="mt-0.5 text-[11px] uppercase tracking-wide text-[#9A9A9A]">
            {row.discountType === "PERCENTAGE" ? "Percentage coupon" : "Fixed amount coupon"}
          </div>
        </div>
      ),
    },
    {
      key: "conditions",
      label: "Conditions",
      width: "220px",
      render: (row) => (
        <div className="flex max-w-[340px] flex-wrap gap-1.5 text-[11.5px] text-[#6B6B6B]">
          <span className="rounded-full bg-[#F8F8F8] px-2 py-0.5 border border-[#E6E6E6]">
            Min: {row.minOrderValue ? amount(row.minOrderValue) : "None"}
          </span>
          {row.discountType === "PERCENTAGE" && row.maxDiscount ? (
            <span className="rounded-full bg-[#F8F8F8] px-2 py-0.5 border border-[#E6E6E6]">
              Cap: {amount(row.maxDiscount)}
            </span>
          ) : null}
          <span className="rounded-full bg-[#F8F8F8] px-2 py-0.5 border border-[#E6E6E6]">
            {row.country ? `${row.country.name ?? row.country.code} (${row.country.code})` : "All countries"}
          </span>
        </div>
      ),
    },
    {
      key: "usage",
      label: "Usage",
      width: "110px",
      render: (row) => (
        <span className="font-medium text-[#1A1A1A] text-[12.5px]">
          {row.usedCount}/{row.usageLimit || "Unlimited"}
        </span>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "120px",
      render: (row) => {
        const effStatus = getEffectiveCouponStatus(row);
        return (
          <StatusBadge
            status={effStatus}
            interactive={canUpdate}
            onClick={() => toggleStatus(row)}
            loading={updateCoupon.isPending && (updateCoupon.variables as any)?.id === row.id}
          />
        );
      },
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      align: "left",
      render: (row) => (
        <AdminRowActions
          edit={
            canUpdate
              ? {
                  onClick: () => {
                    form.reset(toForm(row));
                    setIsFormOpen(true);
                  },
                  title: "Edit coupon",
                }
              : undefined
          }
          extra={
            canCreate ? (
              <AdminActionButton
                action={{
                  onClick: () => {
                    const cloned = toForm(row);
                    cloned.id = undefined;
                    cloned.code = `${cloned.code}_COPY`;
                    form.reset(cloned);
                    setIsFormOpen(true);
                  },
                  title: "Clone coupon",
                }}
                defaultIcon={<Copy size={13} />}
                defaultTitle="Clone coupon"
              />
            ) : null
          }
          delete={
            canDelete
              ? {
                  onClick: () => setDeleting(row),
                  title: "Delete coupon",
                }
              : undefined
          }
        />
      ),
    },
  ];

  const filteredColumns = columns.filter((column) => {
    if (column.key === "code") return visibleColumns.code;
    if (column.key === "discount") return visibleColumns.discount;
    if (column.key === "conditions") return visibleColumns.conditions;
    if (column.key === "usage") return visibleColumns.usage;
    if (column.key === "status") return visibleColumns.status;
    if (column.key === "actions") return visibleColumns.actions;
    return true;
  });

  return (
    <AdminLayout title="Coupons" breadcrumb={[{ label: "Pricing", href: "/admin/pricing" }, { label: "Coupons" }]}>
      <div className="space-y-5">
        <AdminStatsGrid
          stats={[
            { title: "Total Coupons", value: stats.total, subtitle: "All coupon records", icon: <Ticket size={18} />, isLoading },
            { title: "Active Coupons", value: stats.active, subtitle: "Available & valid now", icon: <CheckCircle2 size={18} />, color: "bg-emerald-600", isLoading },
            { title: "Scheduled Coupons", value: stats.scheduled, subtitle: "Upcoming promotions", icon: <Clock size={18} />, color: "bg-sky-600", isLoading },
            { title: "Expired Coupons", value: stats.expired, subtitle: "Ended promotions", icon: <XCircle size={18} />, color: "bg-amber-600", isLoading },
          ]}
        />

        {/* Horizontal Navigation Tabs */}
        <div className="flex items-center gap-2 border-b border-[#E6E6E6] bg-white px-4 pt-2 rounded-t-lg shadow-2xs overflow-x-auto max-w-full scrollbar-thin">
          {[
            { id: "", label: "All Coupons", count: stats.total, icon: <Ticket size={15} /> },
            { id: "ACTIVE", label: "Active", count: stats.active, icon: <CheckCircle2 size={15} /> },
            { id: "SCHEDULED", label: "Scheduled", count: stats.scheduled, icon: <Clock size={15} /> },
            { id: "EXPIRED", label: "Expired", count: stats.expired, icon: <XCircle size={15} /> },
            { id: "INACTIVE", label: "Inactive", count: stats.inactive, icon: <XCircle size={15} /> },
          ].map((tab) => {
            const isActive = status === tab.id;
            return (
              <button
                key={tab.id || "ALL"}
                type="button"
                onClick={() => {
                  setStatus(tab.id);
                  setPage(1);
                  setSelectedIds([]);
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
            placeholder: "Search coupon code...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters((prev) => !prev),
            activeCount: [status, sortBy !== "createdAt" ? sortBy : "", sortDir !== "desc" ? sortDir : ""].filter(Boolean).length,
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
              { key: "code", label: "Coupon" },
              { key: "discount", label: "Discount" },
              { key: "conditions", label: "Conditions" },
              { key: "usage", label: "Usage" },
              { key: "status", label: "Status" },
              { key: "actions", label: "Actions" },
            ],
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Coupons refreshed."));
            },
            isRefreshing: isFetching,
          }}
          primaryAction={canCreate ? { onClick: openCreate, label: "Add Coupon", icon: <Plus size={14} /> } : undefined}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 pt-2">
              <AdminSelect
                label="Status"
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "SCHEDULED", label: "Scheduled" },
                  { value: "EXPIRED", label: "Expired" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => setSortBy(event.target.value)}
                options={[
                  { value: "createdAt", label: "Created Date" },
                  { value: "code", label: "Coupon Code" },
                  { value: "discountValue", label: "Discount Value" },
                  { value: "usedCount", label: "Usage Count" },
                  { value: "startDate", label: "Start Date" },
                  { value: "endDate", label: "End Date" },
                  { value: "status", label: "Status" },
                ]}
              />
              <AdminSelect
                label="Sort Direction"
                value={sortDir}
                onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                options={[
                  { value: "desc", label: "Descending" },
                  { value: "asc", label: "Ascending" },
                ]}
              />
            </div>
          }
          onResetFilters={() => {
            setSearch("");
            setStatus("");
            setSortBy("createdAt");
            setSortDir("desc");
            setPage(1);
          }}
        />

        {/* FULL-WIDTH DATA TABLE */}
        <div className="rounded-xl border border-[#E6E6E6] bg-white overflow-hidden shadow-2xs">
          <DataTable<CouponRow>
            title="Coupons List"
            columns={filteredColumns}
            data={coupons}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage="No coupons found."
            enableSelection={true}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onToggleStatus={canUpdate ? toggleStatus : undefined}
            statusLoadingId={updateCoupon.isPending ? ((updateCoupon.variables as any)?.id ?? null) : null}
            isStatusDisabled={() => !canUpdate}
            totalItems={pagination.total}
            currentPage={page}
            pageSize={limit}
            totalPages={pagination.totalPages || 1}
            onPageChange={setPage}
            onPageSizeChange={setLimit}
            pageSizeOptions={[10, 20, 50, 100]}
            onSelectAll={handleSelectAll}
            renderBulkActions={(selectedIds) => (
              <AdminBulkActionsBar
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actionType={bulkAction}
                onActionTypeChange={setBulkAction}
                actions={[
                  { value: "activate", label: "Mark active" },
                  { value: "deactivate", label: "Mark inactive" },
                  { value: "delete", label: "Delete selected" },
                ]}
                onApply={handleBulkAction}
                applyLoading={bulkSaving}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
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

      {/* CREATE / EDIT COUPON MODAL */}
      <Modal
        open={isFormOpen}
        onClose={resetForm}
        title={form.values.id ? "Edit Coupon" : "New Coupon"}
        subtitle="Create customer promo codes, discount percentages, limits, and country rules."
        size="4xl"
        footer={
          <div className="flex flex-wrap items-center justify-between gap-3 w-full">
            <div className="text-[12px] text-[#6B6B6B]">
              Country restriction is checked during checkout. Leave it as "All countries" for a global coupon.
            </div>
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={resetForm}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                form="coupon-form"
                loading={form.isSubmitting || createCoupon.isPending || updateCoupon.isPending}
                loadingText="Processing..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs"
              >
                {form.values.id ? "Update Coupon" : "Create Coupon"}
              </LoadingButton>
            </div>
          </div>
        }
      >
        <form id="coupon-form" onSubmit={form.handleSubmit} className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput
              label="Coupon Code"
              placeholder="SAVE20"
              {...form.getFieldProps("code")}
              error={form.errors.code as string}
              onChange={(e) => form.setFieldValue("code", e.target.value.toUpperCase())}
            />
            <AdminSelect
              label="Discount Type"
              {...form.getFieldProps("discountType")}
              error={form.errors.discountType as string}
              onChange={(e) => {
                form.setFieldValue("discountType", e.target.value);
                if (e.target.value === "FIXED") form.setFieldValue("maxDiscount", "");
              }}
              options={[
                { value: "PERCENTAGE", label: "Percentage %" },
                { value: "FIXED", label: "Fixed amount" },
              ]}
            />
            <AdminInput
              label="Discount Value"
              type="text"
              inputMode="decimal"
              {...form.getFieldProps("discountValue")}
              error={form.errors.discountValue as string}
            />

            <AdminInput
              label="Minimum Order Value"
              type="text"
              inputMode="decimal"
              placeholder="No minimum"
              {...form.getFieldProps("minOrderValue")}
              error={form.errors.minOrderValue as string}
            />
            {form.values.discountType === "PERCENTAGE" ? (
              <AdminInput
                label="Max Discount Cap"
                type="text"
                inputMode="decimal"
                placeholder="No cap"
                {...form.getFieldProps("maxDiscount")}
                error={form.errors.maxDiscount as string}
              />
            ) : (
              <div className="rounded-md border border-dashed border-[#E6E6E6] bg-[#FAFAFA] px-3.5 py-2.5 text-[12.5px] text-[#6B6B6B] flex items-center">
                Max cap is only used for percentage coupons.
              </div>
            )}
            <AdminInput
              label="Usage Limit"
              type="text"
              inputMode="numeric"
              placeholder="Unlimited"
              {...form.getFieldProps("usageLimit")}
              error={form.errors.usageLimit as string}
            />

            <AdminInput
              label="Start Date"
              type="date"
              {...form.getFieldProps("startDate")}
              error={form.errors.startDate as string}
            />
            <AdminInput
              label="End Date"
              type="date"
              {...form.getFieldProps("endDate")}
              error={form.errors.endDate as string}
            />
            <AdminMultiSearchableSelect
              label="Country Restriction"
              values={form.values.countryIds}
              onValuesChange={(values) => form.setFieldValue("countryIds", values)}
              options={countryOptions}
              placeholder="Select countries"
              allowSelectAll
              selectAllLabel="All countries"
              selectionSummaryFormatter={(selected) => `${selected.length} Countries Selected`}
            />

            <AdminSelect
              label="Status"
              {...form.getFieldProps("status")}
              error={form.errors.status as string}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <div className="md:col-span-2">
              <AdminInput
                label="Description"
                placeholder="Short admin/customer note"
                {...form.getFieldProps("description")}
                error={form.errors.description as string}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* DELETE CONFIRMATION MODALS */}
      <ConfirmModal
        open={!!deleting}
        title="Delete coupon?"
        message={deleting ? `Are you sure you want to delete coupon ${deleting.code}? This will stop being available immediately.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
        isLoading={deleteCoupon.isPending}
      />

      <ConfirmModal
        open={bulkDeleting}
        title="Delete selected coupons?"
        message={`Are you sure you want to permanently delete the ${selectedIds.length} selected coupon(s)? This action cannot be undone.`}
        onConfirm={confirmBulkDelete}
        onCancel={() => setBulkDeleting(false)}
        isLoading={bulkSaving}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
