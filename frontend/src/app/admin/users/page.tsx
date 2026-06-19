"use client";
import { useState } from "react";
import { useFormik } from "formik";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, StatusBadge, AdminInput, AdminSelect, ConfirmModal, useToast } from "@/components/admin/AdminComponents";
import { useAdminUsers, useAdminRoles } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, X, Trash2 } from "lucide-react";
interface User { id: string; name: string; email: string; role: { name: string }; status: string; lastLoginAt: string }
export default function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data: users = [], isLoading, refetch } = useAdminUsers();
  const { data: roles = [] } = useAdminRoles();
  const roleOptions = [{ value: "", label: "Select role…" }, ...roles.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))];
  const formik = useFormik({
    initialValues: { name: "", email: "", password: "", roleId: "" },
    validationSchema: Yup.object({ name: Yup.string().required(), email: Yup.string().email().required(), password: Yup.string().min(8).required(), roleId: Yup.string().required() }),
    onSubmit: async (values, { setSubmitting, resetForm }) => {
      try { await adminApi.post("/users", values); showToast("User created."); refetch(); setShowForm(false); resetForm(); }
      catch { showToast("Failed.", "error"); } finally { setSubmitting(false); }
    },
  });
  const handleDelete = async () => {
    if (!deleting) return;
    try { await adminApi.delete(`/users/${deleting}`); showToast("User removed."); refetch(); }
    catch { showToast("Failed.", "error"); } finally { setDeleting(null); }
  };
  const columns: Column<User>[] = [
    { key: "name", label: "Name", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-[11.5px] text-[#9A9A9A]">{r.email}</div></div> },
    { key: "role", label: "Role", render: (r) => r.role?.name },
    { key: "status", label: "Status", render: (r) => <StatusBadge status={r.status} /> },
    { key: "lastLoginAt", label: "Last Login", render: (r) => r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : "Never" },
    { key: "actions", label: "", width: "50px", render: (r) => <button onClick={() => setDeleting(r.id)} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button> },
  ];
  return (
    <AdminLayout title="Users" breadcrumb={[{ label: "Users" }]}>
      <div className="flex justify-end mb-5"><button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">{showForm ? <X size={14} /> : <Plus size={14} />} {showForm ? "Cancel" : "New User"}</button></div>
      {showForm && (
        <form onSubmit={formik.handleSubmit} className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AdminInput label="Full Name *" {...formik.getFieldProps("name")} error={formik.touched.name ? (formik.errors.name as string) : ""} />
          <AdminInput label="Email *" type="email" {...formik.getFieldProps("email")} error={formik.touched.email ? (formik.errors.email as string) : ""} />
          <AdminInput label="Password *" type="password" placeholder="Min 8 characters" {...formik.getFieldProps("password")} error={formik.touched.password ? (formik.errors.password as string) : ""} />
          <AdminSelect label="Role *" options={roleOptions} {...formik.getFieldProps("roleId")} error={formik.touched.roleId ? (formik.errors.roleId as string) : ""} />
          <div className="sm:col-span-2"><button type="submit" disabled={formik.isSubmitting} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60">Create User</button></div>
        </form>
      )}
      <DataTable<User> columns={columns} data={users} rowKey="id" isLoading={isLoading} emptyMessage="No users." />
      <ConfirmModal open={!!deleting} title="Remove user?" message="This will deactivate the user account." onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
