"use client";

import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { Pencil, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { AdminInput, AdminSelect, Column, DataTable, StatusBadge, useToast } from "@/components/admin/AdminComponents";
import { useAdminCountries, useAdminCurrencies } from "@/hooks/admin/useAdminHooks";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";

interface Country {
  id: string;
  name: string;
  code: string;
  currency: { id: string; name: string; symbol: string };
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
}

export default function CountriesPage() {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Country | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data: countries = [], isLoading, refetch } = useAdminCountries();
  const { data: currencies = [] } = useAdminCurrencies();

  const currencyOptions = [
    { value: "", label: "Select..." },
    ...currencies.map((currency: { id: string; name: string; code: string }) => ({
      value: currency.id,
      label: `${currency.name} (${currency.code})`,
    })),
  ];

  const formik = useFormik({
    initialValues: { name: "", code: "", currencyId: "", status: "ACTIVE", isDefault: false },
    validationSchema: Yup.object({
      name: Yup.string().required("Country name is required."),
      code: Yup.string().required("ISO code is required.").length(2, "Use a 2-letter ISO code."),
      currencyId: Yup.string().required("Currency is required."),
      status: Yup.string().oneOf(["ACTIVE", "INACTIVE"]).required(),
      isDefault: Yup.boolean(),
    }),
    onSubmit: async (values, { resetForm, setSubmitting }) => {
      const payload = { ...values, code: values.code.toUpperCase() };
      try {
        if (editing) {
          await adminApi.put(`/countries/${editing.id}`, payload);
          showToast("Country updated.");
        } else {
          await adminApi.post("/countries", payload);
          showToast("Country added.");
        }
        await refetch();
        setShowForm(false);
        setEditing(null);
        resetForm();
      } catch (error) {
        showToast(getAdminErrorMessage(error, "Failed to save country."), "error");
      } finally {
        setSubmitting(false);
      }
    },
  });

  function resetEditor() {
    setShowForm(false);
    setEditing(null);
    formik.resetForm();
  }

  function openCreate() {
    if (showForm && !editing) {
      resetEditor();
      return;
    }
    setEditing(null);
    formik.setValues({ name: "", code: "", currencyId: "", status: "ACTIVE", isDefault: false });
    setShowForm(true);
  }

  function openEdit(country: Country) {
    setEditing(country);
    formik.setValues({
      name: country.name,
      code: country.code,
      currencyId: country.currency?.id ?? "",
      status: country.status,
      isDefault: country.isDefault,
    });
    setShowForm(true);
  }

  async function deleteCountry(country: Country) {
    if (country.isDefault) {
      showToast("Default country cannot be deleted.", "error");
      return;
    }
    if (!window.confirm(`Delete ${country.name}? It will be deactivated and remain visible here as inactive.`)) return;
    setDeletingId(country.id);
    try {
      await adminApi.delete(`/countries/${country.id}`);
      showToast("Country deleted.");
      await refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete country."), "error");
    } finally {
      setDeletingId(null);
    }
  }

  const columns: Column<Country>[] = [
    { key: "name", label: "Country" },
    { key: "code", label: "Code", render: (row) => <span className="font-mono font-semibold">{row.code}</span> },
    { key: "currency", label: "Currency", render: (row) => `${row.currency?.name ?? "-"} (${row.currency?.symbol ?? "-"})` },
    { key: "isDefault", label: "Default", render: (row) => row.isDefault ? <span className="text-[12.5px] font-medium text-green-600">Default</span> : "-" },
    { key: "status", label: "Status", render: (row) => <StatusBadge status={row.status} /> },
    {
      key: "actions",
      label: "Actions",
      width: "100px",
      render: (row) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => openEdit(row)}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
            title="Edit country"
          >
            <Pencil size={13} />
          </button>
          <button
            type="button"
            onClick={() => deleteCountry(row)}
            disabled={deletingId === row.id || row.isDefault}
            className="flex h-7 w-7 items-center justify-center rounded border border-[#F2C9C9] text-red-500 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40"
            title={row.isDefault ? "Default country cannot be deleted" : "Delete country"}
          >
            <Trash2 size={13} />
          </button>
        </div>
      ),
    },
  ];

  return (
    <AdminLayout title="Countries" breadcrumb={[{ label: "Countries" }]}>
      <div className="mb-5 flex justify-end">
        <button
          onClick={openCreate}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
        >
          {showForm && !editing ? <X size={14} /> : <Plus size={14} />}
          {showForm && !editing ? "Cancel" : "Add Country"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={formik.handleSubmit} className="mb-5 grid gap-4 rounded-xl border border-[#E6E6E6] bg-white p-5 sm:grid-cols-3">
          <div className="flex items-center justify-between sm:col-span-3">
            <h2 className="text-[15px] font-semibold text-[#1A1A1A]">{editing ? `Edit ${editing.name}` : "Add country"}</h2>
            <button type="button" onClick={resetEditor} className="rounded-md border border-[#E6E6E6] px-3 py-1.5 text-[13px] hover:bg-[#F2F2F2]">
              Close
            </button>
          </div>

          <AdminInput label="Country Name *" placeholder="Germany" {...formik.getFieldProps("name")} error={formik.touched.name ? (formik.errors.name as string) : ""} />
          <AdminInput
            label="ISO Code (2 letters) *"
            placeholder="DE"
            maxLength={2}
            {...formik.getFieldProps("code")}
            onChange={(event) => formik.setFieldValue("code", event.target.value.toUpperCase())}
            error={formik.touched.code ? (formik.errors.code as string) : ""}
          />
          <AdminSelect label="Currency *" options={currencyOptions} {...formik.getFieldProps("currencyId")} error={formik.touched.currencyId ? (formik.errors.currencyId as string) : ""} />
          <AdminSelect label="Status" options={[{ value: "ACTIVE", label: "Active" }, { value: "INACTIVE", label: "Inactive" }]} {...formik.getFieldProps("status")} />
          <label className="flex items-center gap-2 pt-7 text-[13.5px] font-medium text-[#1A1A1A]">
            <input
              type="checkbox"
              checked={formik.values.isDefault}
              onChange={(event) => formik.setFieldValue("isDefault", event.target.checked)}
              className="h-4 w-4 rounded border-[#D6D6D6]"
            />
            Set as default country
          </label>

          <div className="flex gap-2.5 sm:col-span-3">
            <button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">
              {editing ? "Save Changes" : "Add Country"}
            </button>
            <button type="button" onClick={resetEditor} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13.5px] font-medium hover:bg-[#F2F2F2]">
              Cancel
            </button>
          </div>
        </form>
      )}

      <DataTable<Country> columns={columns} data={countries} rowKey="id" isLoading={isLoading} emptyMessage="No countries configured." />
      {ToastComponent}
    </AdminLayout>
  );
}
