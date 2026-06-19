"use client";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, AdminInput, AdminSelect, useToast } from "@/components/admin/AdminComponents";
import { useAdminCountries, useAdminCurrencies } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, X } from "lucide-react";
interface Country { id: string; name: string; code: string; currency: { name: string; symbol: string }; isDefault: boolean; status: string }
export default function CountriesPage() {
  const [showForm, setShowForm] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const { data: countries = [], isLoading, refetch } = useAdminCountries();
  const { data: currencies = [] } = useAdminCurrencies();
  const currencyOptions = [{ value: "", label: "Select…" }, ...currencies.map((c: { id: string; name: string; code: string }) => ({ value: c.id, label: `${c.name} (${c.code})` }))];
  const formik = useFormik({
    initialValues: { name: "", code: "", currencyId: "" },
    validationSchema: Yup.object({ name: Yup.string().required(), code: Yup.string().required().length(2), currencyId: Yup.string().required() }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try { await adminApi.post("/countries", values); showToast("Country added."); refetch(); setShowForm(false); resetForm(); }
      catch { showToast("Failed.", "error"); } finally { setSubmitting(false); }
    },
  });
  const columns: Column<Country>[] = [
    { key: "name", label: "Country" },
    { key: "code", label: "Code", render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: "currency", label: "Currency", render: (r) => `${r.currency?.name} (${r.currency?.symbol})` },
    { key: "isDefault", label: "Default", render: (r) => r.isDefault ? <span className="text-green-600 font-medium text-[12.5px]">Default</span> : "—" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <AdminLayout title="Countries" breadcrumb={[{ label: "Countries" }]}>
      <div className="flex justify-end mb-5"><button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">{showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Country"}</button></div>
      {showForm && (
        <form onSubmit={formik.handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5 grid sm:grid-cols-3 gap-4">
          <AdminInput label="Country Name *" placeholder="Germany" {...formik.getFieldProps("name")} error={formik.touched.name ? (formik.errors.name as string) : ""} />
          <AdminInput label="ISO Code (2 letters) *" placeholder="DE" maxLength={2} {...formik.getFieldProps("code")} error={formik.touched.code ? (formik.errors.code as string) : ""} />
          <AdminSelect label="Currency *" options={currencyOptions} {...formik.getFieldProps("currencyId")} error={formik.touched.currencyId ? (formik.errors.currencyId as string) : ""} />
          <div className="sm:col-span-3"><button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">Add Country</button></div>
        </form>
      )}
      <DataTable<Country> columns={columns} data={countries} rowKey="id" isLoading={isLoading} emptyMessage="No countries configured." />
      {ToastComponent}
    </AdminLayout>
  );
}
