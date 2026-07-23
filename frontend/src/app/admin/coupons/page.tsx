"use client";

import { useEffect, useMemo, useState } from "react";
import { Edit2, Filter, Plus, Search, Shield, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, AdminSelect, ConfirmModal, DataTable, Pagination, StatCard, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { AdminSearchableSelect } from "@/components/admin/AdminSearchableSelect";
import { AdminMultiSearchableSelect } from "@/components/admin/AdminMultiSearchableSelect";
import { useAdminCountries, useAdminCoupons, useCreateCoupon, useDeleteCoupon, useUpdateCoupon } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

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

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function amount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function validity(coupon: CouponRow) {
  const start = dateInput(coupon.startDate);
  const end = dateInput(coupon.endDate);
  return `${start} to ${end}`;
}

function valueLabel(coupon: CouponRow) {
  return coupon.discountType === "PERCENTAGE" ? `${amount(coupon.discountValue)}%` : amount(coupon.discountValue);
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
    countryIds: coupon.countryId ? [coupon.countryId] : [],
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
  const [form, setForm] = useState<FormState>(blankForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<CouponRow | null>(null);

  const { data, isLoading } = useAdminCoupons({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
    status: status || undefined,
    sortBy,
    sortDir,
  });
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

  const stats = useMemo(
    () => ({
      total: Number(pagination.total ?? 0),
      active: coupons.filter((coupon) => coupon.status === "ACTIVE").length,
      percentage: coupons.filter((coupon) => coupon.discountType === "PERCENTAGE").length,
      fixed: coupons.filter((coupon) => coupon.discountType === "FIXED").length,
    }),
    [pagination.total, coupons],
  );

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

  const resetForm = () => {
    setForm(blankForm);
    setIsFormOpen(false);
  };

  const openCreate = () => {
    setForm(blankForm);
    setIsFormOpen(true);
  };

  const setField = (key: keyof FormState, value: string) => {
    setForm((current) => {
      const next = { ...current, [key]: key === "code" ? value.toUpperCase() : value };
      if (key === "discountType" && value === "FIXED") next.maxDiscount = "";
      return next;
    });
  };

  const validateForm = () => {
    if (!form.code.trim()) return "Coupon code is required.";
    if (!form.discountValue) return "Discount value is required.";
    if (!form.startDate || !form.endDate) return "Start date and end date are required.";
    if (new Date(form.endDate) < new Date(form.startDate)) return "End date must be after start date.";
    if (form.discountType === "PERCENTAGE" && Number(form.discountValue) > 100) return "Percentage discount cannot exceed 100.";
    return "";
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    const error = validateForm();
    if (error) {
      showToast(error, "error");
      return;
    }

    const payload = {
      code: form.code.trim(),
      description: form.description.trim() || null,
      discountType: form.discountType,
      discountValue: form.discountValue,
      minOrderValue: form.minOrderValue || null,
      maxDiscount: form.discountType === "PERCENTAGE" ? form.maxDiscount || null : null,
      startDate: form.startDate,
      endDate: form.endDate,
      usageLimit: form.usageLimit || null,
      countryId: form.countryIds.length > 0 ? form.countryIds[0] : null,
      status: form.status,
    };

    try {
      if (form.id) {
        await updateCoupon.mutateAsync({ id: form.id, ...payload });
        showToast("Coupon updated.");
      } else {
        await createCoupon.mutateAsync(payload);
        showToast("Coupon created.");
      }
      resetForm();
    } catch (err) {
      showToast(getAdminErrorMessage(err, "Failed to save coupon."), "error");
    }
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

  const columns: Column<CouponRow>[] = [
    {
      key: "code",
      label: "Coupon",
      render: (row) => (
        <div className="min-w-[180px]">
          <div className="inline-flex rounded-md bg-[#F8F8F8] px-2.5 py-1 font-mono text-[13px] font-semibold tracking-wide text-[#1A1A1A]">
            {row.code}
          </div>
          {row.description ? <div className="mt-1 text-[12px] text-[#6B6B6B]">{row.description}</div> : null}
        </div>
      ),
    },
    {
      key: "discount",
      label: "Discount",
      render: (row) => (
        <div>
          <div className="font-semibold text-[#1A1A1A]">
            {row.discountType === "PERCENTAGE" ? `${valueLabel(row)} off` : `${valueLabel(row)} off`}
          </div>
          <div className="mt-1 text-[11.5px] uppercase tracking-wide text-[#9A9A9A]">
            {row.discountType === "PERCENTAGE" ? "Percentage coupon" : "Fixed amount coupon"}
          </div>
        </div>
      ),
    },
    {
      key: "conditions",
      label: "Conditions",
      render: (row) => (
        <div className="flex max-w-[340px] flex-wrap gap-1.5 text-[12px] text-[#6B6B6B]">
          <span className="rounded-full bg-[#F8F8F8] px-2 py-1">Min: {row.minOrderValue ? amount(row.minOrderValue) : "None"}</span>
          {row.discountType === "PERCENTAGE" && row.maxDiscount ? <span className="rounded-full bg-[#F8F8F8] px-2 py-1">Cap: {amount(row.maxDiscount)}</span> : null}
          <span className="rounded-full bg-[#F8F8F8] px-2 py-1">{row.country ? `${row.country.name} (${row.country.code})` : "All countries"}</span>
        </div>
      ),
    },
    { key: "usage", label: "Usage", render: (row) => `${row.usedCount}/${row.usageLimit || "Unlimited"}` },
    { key: "dates", label: "Validity", render: (row) => validity(row) },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Actions",
      width: "96px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          {canUpdate && (
            <button
              type="button"
              onClick={() => {
                setForm(toForm(row));
                setIsFormOpen(true);
              }}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
              aria-label={`Edit ${row.code}`}
            >
              <Edit2 size={13} />
            </button>
          )}
          {canDelete && (
            <button
              type="button"
              onClick={() => setDeleting(row)}
              className="flex h-7 w-7 items-center justify-center rounded border border-[#F2C9C9] text-red-500 hover:bg-red-50"
              aria-label={`Delete ${row.code}`}
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Coupons" breadcrumb={[{ label: "Coupons" }]}>
      <div className="space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard title="Total Coupons" value={stats.total} subtitle="All coupon records" icon={<Shield size={18} />} />
          <StatCard title="Active Coupons" value={stats.active} subtitle="Available now" icon={<Shield size={18} />} color="bg-green-600" />
          <StatCard title="Percentage Coupons" value={stats.percentage} subtitle="Rate-based deals" icon={<Shield size={18} />} color="bg-[#0F6CBD]" />
          <StatCard title="Fixed Coupons" value={stats.fixed} subtitle="Flat-value deals" icon={<Shield size={18} />} color="bg-[#7A4F01]" />
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative w-full max-w-[280px]">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search coupon code..."
                className="h-10 w-full rounded-md border border-[#E6E6E6] bg-white py-2 pl-8 pr-3.5 text-[13.5px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowFilters((current) => !current)}
                className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-[#E6E6E6] px-3 text-[13px] font-semibold text-[#555] hover:bg-[#F2F2F2]"
              >
                <Filter size={14} />
                {showFilters ? "Hide filters" : "Show filters"}
              </button>
              {canCreate && (
                <button
                  type="button"
                  onClick={openCreate}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
                >
                  <Plus size={14} />
                  Create Coupon
                </button>
              )}
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 border-t border-[#F0F0F0] pt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-[13px] font-bold text-[#1A1A1A]">Filters & Sorting</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setStatus("");
                    setSortBy("createdAt");
                    setSortDir("desc");
                    setPage(1);
                  }}
                  className="text-[12.5px] font-medium text-[#E31E24] hover:underline"
                >
                  Reset
                </button>
              </div>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <AdminSelect
                  label="Status"
                  value={status}
                  onChange={(event) => {
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                  options={[
                    { value: "", label: "All statuses" },
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                />
                <AdminSelect
                  label="Sort By"
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  options={[
                    { value: "createdAt", label: "Created date" },
                    { value: "code", label: "Code" },
                    { value: "discountValue", label: "Discount" },
                    { value: "usedCount", label: "Usage" },
                    { value: "startDate", label: "Start date" },
                    { value: "endDate", label: "End date" },
                    { value: "status", label: "Status" },
                  ]}
                />
                <AdminSelect
                  label="Direction"
                  value={sortDir}
                  onChange={(event) => setSortDir(event.target.value as "asc" | "desc")}
                  options={[
                    { value: "desc", label: "Descending" },
                    { value: "asc", label: "Ascending" },
                  ]}
                />
                <AdminSelect
                  label="Page Size"
                  value={String(limit)}
                  onChange={(event) => setLimit(Number(event.target.value))}
                  options={[
                    { value: "10", label: "10 per page" },
                    { value: "20", label: "20 per page" },
                    { value: "50", label: "50 per page" },
                  ]}
                />
              </div>
            </div>
          )}
        </div>

        <div className="rounded-xl border border-[#E6E6E6] bg-white">
          <DataTable<CouponRow> columns={columns} data={coupons} rowKey="id" isLoading={isLoading} emptyMessage="No coupons found." />
          <div className="border-t border-[#E6E6E6] px-4 py-3">
            <Pagination page={pagination.page} totalPages={pagination.totalPages || 1} onPageChange={setPage} />
          </div>
        </div>
      </div>

      <Modal open={isFormOpen} onClose={resetForm} title={form.id ? "Edit coupon" : "New coupon"} panelClassName="max-w-4xl">
        <form onSubmit={submit} className="space-y-6 p-6">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <AdminInput label="Coupon Code *" placeholder="SAVE20" value={form.code} onChange={(event) => setField("code", event.target.value)} />
            <AdminSelect
              label="Discount Type"
              value={form.discountType}
              onChange={(event) => setField("discountType", event.target.value)}
              options={[
                { value: "PERCENTAGE", label: "Percentage %" },
                { value: "FIXED", label: "Fixed amount" },
              ]}
            />
            <AdminInput label="Discount Value *" type="number" min="0" step="0.01" value={form.discountValue} onChange={(event) => setField("discountValue", event.target.value)} />

            <AdminInput label="Minimum Order Value" type="number" min="0" step="0.01" placeholder="No minimum" value={form.minOrderValue} onChange={(event) => setField("minOrderValue", event.target.value)} />
            {form.discountType === "PERCENTAGE" ? (
              <AdminInput label="Max Discount Cap" type="number" min="0" step="0.01" placeholder="No cap" value={form.maxDiscount} onChange={(event) => setField("maxDiscount", event.target.value)} />
            ) : (
              <div className="rounded-md border border-dashed border-[#E6E6E6] bg-[#FAFAFA] px-3.5 py-2.5 text-[12.5px] text-[#6B6B6B]">
                Max cap is only used for percentage coupons.
              </div>
            )}
            <AdminInput label="Usage Limit" type="number" min="1" placeholder="Unlimited" value={form.usageLimit} onChange={(event) => setField("usageLimit", event.target.value)} />

            <AdminInput label="Start Date *" type="date" value={form.startDate} onChange={(event) => setField("startDate", event.target.value)} />
            <AdminInput label="End Date *" type="date" value={form.endDate} onChange={(event) => setField("endDate", event.target.value)} />
            <AdminMultiSearchableSelect
              label="Country Restriction"
              values={form.countryIds}
              onValuesChange={(values) =>
                setForm((prev) => ({
                  ...prev,
                  countryIds: values,
                }))
              }
              options={countryOptions}
              placeholder="Select countries"
              allowSelectAll
              selectAllLabel="All countries"
              selectionSummaryFormatter={(selected) => `${selected.length} Countries Selected`}
            />

            <AdminSelect
              label="Status"
              value={form.status}
              onChange={(event) => setField("status", event.target.value)}
              options={[
                { value: "ACTIVE", label: "Active" },
                { value: "INACTIVE", label: "Inactive" },
              ]}
            />
            <div className="md:col-span-2">
              <AdminInput label="Description" placeholder="Short admin/customer note" value={form.description} onChange={(event) => setField("description", event.target.value)} />
            </div>
          </div>

          <div className="rounded-lg bg-[#F8F8F8] p-3 text-[12.5px] text-[#6B6B6B]">
            Country restriction is checked during checkout. Leave it as "All countries" for a global coupon.
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={resetForm} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]">
              Cancel
            </button>
            <button
              type="submit"
              disabled={createCoupon.isPending || updateCoupon.isPending}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
            >
              {form.id ? "Update Coupon" : "Create Coupon"}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmModal
        open={!!deleting}
        title="Delete coupon?"
        message={deleting ? `${deleting.code} will stop being available immediately.` : ""}
        onConfirm={confirmDelete}
        onCancel={() => setDeleting(null)}
      />

      {ToastComponent}
    </AdminLayout>
  );
}
