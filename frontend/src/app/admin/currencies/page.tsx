"use client";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, AdminInput, useToast } from "@/components/admin/AdminComponents";
import { useAdminCurrencies } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, RefreshCw, X } from "lucide-react";
interface Currency { id: string; name: string; code: string; symbol: string; exchangeRate: number; isBase: boolean; status: string }
export default function CurrenciesPage() {
  const [showForm, setShowForm] = useState(false);
  const { showToast, ToastComponent } = useToast();
  const { data: currencies = [], isLoading, refetch } = useAdminCurrencies();
  const formik = useFormik({
    initialValues: { name: "", code: "", symbol: "", exchangeRate: 1 },
    validationSchema: Yup.object({ name: Yup.string().required(), code: Yup.string().required().length(3), symbol: Yup.string().required(), exchangeRate: Yup.number().min(0).required() }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try { await adminApi.post("/currencies", values); showToast("Currency added."); refetch(); setShowForm(false); resetForm(); }
      catch { showToast("Failed.", "error"); } finally { setSubmitting(false); }
    },
  });
  const columns: Column<Currency>[] = [
    { key: "name", label: "Currency" },
    { key: "code", label: "Code", render: (r) => <span className="font-mono font-semibold">{r.code}</span> },
    { key: "symbol", label: "Symbol" },
    { key: "exchangeRate", label: "Rate vs USD" },
    { key: "isBase", label: "Base", render: (r) => r.isBase ? <span className="text-green-600 font-medium text-[12.5px]">Base</span> : "—" },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <AdminLayout title="Currencies" breadcrumb={[{ label: "Currencies" }]}>
      <div className="mb-5 flex gap-2.5 justify-end">
        <button onClick={async () => { await adminApi.post("/currencies/sync-rates"); showToast("Connect OpenExchangeRates to sync live rates."); }} className="flex items-center gap-1.5 rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]"><RefreshCw size={14} /> Sync Rates</button>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">{showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "Add Currency"}</button>
      </div>
      {showForm && (
        <form onSubmit={formik.handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <AdminInput label="Name *" placeholder="US Dollar" {...formik.getFieldProps("name")} error={formik.touched.name ? (formik.errors.name as string) : ""} />
          <AdminInput label="ISO Code *" placeholder="USD" maxLength={3} {...formik.getFieldProps("code")} />
          <AdminInput label="Symbol *" placeholder="$" {...formik.getFieldProps("symbol")} />
          <AdminInput label="Exchange Rate" type="number" step="0.0001" {...formik.getFieldProps("exchangeRate")} />
          <div className="col-span-2 sm:col-span-4"><button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">Add Currency</button></div>
        </form>
      )}
      <DataTable<Currency> columns={columns} data={currencies} rowKey="id" isLoading={isLoading} emptyMessage="No currencies." />
      {ToastComponent}
    </AdminLayout>
  );
}
