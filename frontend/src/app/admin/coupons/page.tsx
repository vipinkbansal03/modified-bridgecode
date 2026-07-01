"use client";

import { useMemo, useState } from "react";
import { Edit2, Plus, Search, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, Column, ConfirmModal, DataTable, Pagination, useToast } from "@/components/admin/AdminComponents";
import { Modal } from "@/components/ui/Modal";
import { useAdminCountries, useAdminCoupons, useCreateCoupon, useDeleteCoupon, useUpdateCoupon } from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";

type Related = { id: string; name?: string; code?: string };

type Coupon = {
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
  countryId: string;
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
  countryId: "",
  status: "ACTIVE",
};

function dateInput(value?: string | null) {
  return value ? value.slice(0, 10) : "";
}

function amount(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === "") return "-";
  return Number(value).toLocaleString("en-IN", { maximumFractionDigits: 2 });
}

function valueLabel(coupon: Coupon) {
  return coupon.discountType === "PERCENTAGE"
    ? `${amount(coupon.discountValue)}% off`
    : `${amount(coupon.discountValue)} off`;
}

function toForm(coupon: Coupon): FormState {
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
    countryId: coupon.countryId ?? "",
    status: coupon.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  };
}

export default function CouponsPage() {
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [form, setForm] = useState<FormState>(blankForm);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<Coupon | null>(null);

  const { showToast, ToastComponent } = useToast();
  const { data, isLoading } = useAdminCoupons({
    page,
    limit,
    search: search.trim() || undefined,
    status: status || undefined,
  });
  const { data: countries = [] } = useAdminCountries();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const coupons: Coupon[] = data?.data ?? [];
  const totalPages = data?.pagination?.totalPages ?? 1;

  const countryOptions = useMemo(
    () => [
      { value: "", label: "All countries" },
      ...countries.map((country: Related) => ({
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
      countryId: form.countryId || null,
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

  const toggleStatus = async (coupon: Coupon) => {
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

  const columns: Column<Coupon>[] = [
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
          <div className="font-semibold text-[#1A1A1A]">{valueLabel(row)}</div>
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
          <span className="rounded-full bg-[#F8F8F8] px-2 py-1">
            Min: {row.minOrderValue ? amount(row.minOrderValue) : "None"}
          </span>
          {row.discountType === "PERCENTAGE" && row.maxDiscount ? (
            <span className="rounded-full bg-[#F8F8F8] px-2 py-1">Cap: {amount(row.maxDiscount)}</span>
          ) : null}
          <span className="rounded-full bg-[#F8F8F8] px-2 py-1">
            {row.country ? `${row.country.name} (${row.country.code})` : "All countries"}
          </span>
        </div>
      ),
    },
    { key: "usage", label: "Usage", render: (row) => `${row.usedCount}/${row.usageLimit || "Unlimited"}` },
    { key: "dates", label: "Dates", render: (row) => `${dateInput(row.startDate)} to ${dateInput(row.endDate)}` },
    {
      key: "status",
      label: "Status",
      render: (row) => {
        const isActive = row.status === "ACTIVE";
        return (
          <button
            type="button"
            onClick={() => toggleStatus(row)}
            disabled={updateCoupon.isPending}
            title={isActive ? "Click to pause this coupon" : "Click to activate this coupon"}
            className="inline-flex items-center gap-2 rounded-full border border-[#E6E6E6] bg-white px-2.5 py-1.5 text-[12px] font-medium transition hover:border-[#D0D0D0] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className={`relative h-4 w-8 rounded-full transition ${isActive ? "bg-emerald-500" : "bg-[#D9D9D9]"}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition ${isActive ? "left-4" : "left-0.5"}`} />
            </span>
            <span className={isActive ? "text-emerald-700" : "text-[#6B6B6B]"}>{isActive ? "Active" : "Inactive"}</span>
          </button>
        );
      },
    },
    {
      key: "actions",
      label: "",
      width: "86px",
      render: (row) => (
        <div className="flex items-center gap-2">
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
          <button
            type="button"
            onClick={() => setDeleting(row)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
            aria-label={`Delete ${row.code}`}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Coupons" breadcrumb={[{ label: "Coupons" }]}>
      <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <label className="relative w-full lg:max-w-md">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9A9A9A]" />
            <input
              type="search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
              placeholder="Search coupon code or description..."
              className="h-10 w-full rounded-lg border border-[#E6E6E6] bg-white pl-9 pr-3 text-[13.5px] outline-none transition focus:border-[#E31E24] focus:ring-2 focus:ring-[#E31E24]/10"
            />
          </label>

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <AdminSelect
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
              className="min-w-[150px]"
            />
            <AdminSelect
              value={String(limit)}
              onChange={(event) => {
                setLimit(Number(event.target.value));
                setPage(1);
              }}
              options={[
                { value: "10", label: "10 per page" },
                { value: "20", label: "20 per page" },
                { value: "50", label: "50 per page" },
              ]}
              className="min-w-[140px]"
            />
            <button
              type="button"
              onClick={openCreate}
              className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md bg-[#E31E24] px-4 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
            >
              <Plus size={14} /> Create Coupon
            </button>
          </div>
        </div>
      </div>

      <Modal open={isFormOpen} onClose={resetForm} title={form.id ? "Edit coupon" : "New coupon"} panelClassName="max-w-4xl">
        <form onSubmit={submit} className="space-y-4">
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
            <AdminSelect label="Country Restriction" value={form.countryId} onChange={(event) => setField("countryId", event.target.value)} options={countryOptions} />

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

      <DataTable<Coupon> columns={columns} data={coupons} rowKey="id" isLoading={isLoading} emptyMessage="No coupons found." />
      <Pagination page={page} totalPages={totalPages} onPageChange={setPage} />
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
