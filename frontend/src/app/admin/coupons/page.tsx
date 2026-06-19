"use client";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, Pagination, AdminInput, AdminSelect, useToast, ConfirmModal } from "@/components/admin/AdminComponents";
import { useAdminCoupons, useCreateCoupon } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, X, Trash2 } from "lucide-react";
interface Coupon { id: string; code: string; discountType: string; discountValue: number; minOrderValue: number; usageLimit: number; usedCount: number; endDate: string; status: string }
const schema = Yup.object({ code: Yup.string().required("Code is required").uppercase(), discountType: Yup.string().required(), discountValue: Yup.number().positive().required(), startDate: Yup.date().required(), endDate: Yup.date().required(), minOrderValue: Yup.number().min(0), maxDiscount: Yup.number().min(0), usageLimit: Yup.number().integer().min(1) });
export default function CouponsPage() {
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data, isLoading, refetch } = useAdminCoupons({ page });
  const createCoupon = useCreateCoupon();
  const formik = useFormik({
    initialValues: { code: "", discountType: "PERCENTAGE", discountValue: 10, startDate: "", endDate: "", minOrderValue: "", maxDiscount: "", usageLimit: "" },
    validationSchema: schema,
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try { await createCoupon.mutateAsync(values); showToast("Coupon created."); setShowForm(false); resetForm(); }
      catch { showToast("Failed.", "error"); } finally { setSubmitting(false); }
    },
  });
  const handleDelete = async () => {
    if (!deleting) return;
    try { await adminApi.delete(`/coupons/${deleting}`); showToast("Deleted."); refetch(); }
    catch { showToast("Failed.", "error"); } finally { setDeleting(null); }
  };
  const columns: Column<Coupon>[] = [
    { key: "code", label: "Code", render: (r) => <span className="font-mono font-semibold text-[13px]">{r.code}</span> },
    { key: "discountType", label: "Type", render: (r) => r.discountType === "PERCENTAGE" ? `${r.discountValue}%` : `$${r.discountValue} off` },
    { key: "minOrderValue", label: "Min Order", render: (r) => r.minOrderValue ? `$${r.minOrderValue}` : "—" },
    { key: "usage", label: "Usage", render: (r) => `${r.usedCount}/${r.usageLimit || "∞"}` },
    { key: "endDate", label: "Expires", render: (r) => new Date(r.endDate).toLocaleDateString() },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "actions", label: "", width: "50px", render: (r) => <button onClick={() => setDeleting(r.id)} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button> },
  ];
  return (
    <AdminLayout title="Coupons" breadcrumb={[{ label: "Coupons" }]}>
      <div className="flex justify-end mb-5"><button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">{showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Create Coupon"}</button></div>
      {showForm && (
        <form onSubmit={formik.handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5 grid grid-cols-2 sm:grid-cols-3 gap-4">
          <AdminInput label="Coupon Code *" placeholder="SAVE20" {...formik.getFieldProps("code")} error={formik.touched.code ? (formik.errors.code as string) : ""} />
          <AdminSelect label="Discount Type" options={[{ value: "PERCENTAGE", label: "Percentage %" }, { value: "FIXED", label: "Fixed Amount" }]} {...formik.getFieldProps("discountType")} />
          <AdminInput label="Discount Value *" type="number" min="0" {...formik.getFieldProps("discountValue")} error={formik.touched.discountValue ? (formik.errors.discountValue as string) : ""} />
          <AdminInput label="Min Order Value" type="number" min="0" placeholder="0 = no minimum" {...formik.getFieldProps("minOrderValue")} />
          <AdminInput label="Max Discount" type="number" min="0" placeholder="Leave blank for no cap" {...formik.getFieldProps("maxDiscount")} />
          <AdminInput label="Usage Limit" type="number" min="1" placeholder="Leave blank for unlimited" {...formik.getFieldProps("usageLimit")} />
          <AdminInput label="Start Date *" type="date" {...formik.getFieldProps("startDate")} error={formik.touched.startDate ? (formik.errors.startDate as string) : ""} />
          <AdminInput label="End Date *" type="date" {...formik.getFieldProps("endDate")} error={formik.touched.endDate ? (formik.errors.endDate as string) : ""} />
          <div className="col-span-2 sm:col-span-3"><button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">Create Coupon</button></div>
        </form>
      )}
      <DataTable<Coupon> columns={columns} data={data?.data || []} rowKey="id" isLoading={isLoading} emptyMessage="No coupons yet." />
      <Pagination page={page} totalPages={data?.pagination?.totalPages || 1} onPageChange={setPage} />
      <ConfirmModal open={!!deleting} title="Delete coupon?" message="This cannot be undone." onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
