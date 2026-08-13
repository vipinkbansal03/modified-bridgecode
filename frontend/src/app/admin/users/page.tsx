"use client";
import { useState, useLayoutEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import * as Yup from "yup";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { Modal } from "@/components/ui/Modal";
import { DataTable, Column, StatusBadge, AdminInput, AdminSelect, AdminMultiSelect, ConfirmModal, useToast, AdminListToolbar, LoadingButton } from "@/components/admin/AdminComponents";
import { useAdminUsers, useAdminRoles, useAdminWarehouses } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, X, Trash2, Edit2 } from "lucide-react";
interface User { id: string; name: string; email: string; roleId: string; role: { name: string }; status: string; lastLoginAt: string; warehouses?: { warehouseId: string }[] }
export default function UsersPage() {
  const { hasPermission, isLoading: authLoading } = useAdminAuth();
  const router = useRouter();

  useLayoutEffect(() => {
    if (!authLoading && !hasPermission("users.view")) {
      router.replace("/admin/dashboard");
    }
  }, [authLoading, hasPermission, router]);

  const canCreate = hasPermission("users.create");
  const canUpdate = hasPermission("users.update");
  const canDelete = hasPermission("users.delete");

  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data: users = [], isLoading, refetch } = useAdminUsers();
  const { data: roles = [] } = useAdminRoles();
  const { data: warehousesData } = useAdminWarehouses({ limit: 30 });
  const warehouses = warehousesData?.data || [];
  const roleOptions = [{ value: "", label: "Select role…" }, ...roles.map((r: { id: string; name: string }) => ({ value: r.id, label: r.name }))];
  const form = useAdminForm({
    enableReinitialize: true,
    initialValues: {
      name: editingUser?.name || "",
      email: editingUser?.email || "",
      password: "",
      roleId: editingUser?.roleId || "",
      status: editingUser?.status || "ACTIVE",
      warehouseIds: editingUser?.warehouses?.map((uw: any) => uw.warehouseId) || [] as string[],
    },
    validationSchema: Yup.object({
      name: Yup.string().required("Name is required"),
      email: Yup.string().email("Invalid email").required("Email is required"),
      password: editingUser
        ? Yup.string().min(8, "Password must be at least 8 characters")
        : Yup.string().min(8, "Password must be at least 8 characters").required("Password is required"),
      roleId: Yup.string().required("Role is required"),
      status: Yup.string().required("Status is required"),
    }),
    onSubmit: async (values) => {
      try {
        if (editingUser) {
          const payload: any = { ...values };
          if (!payload.password) delete payload.password;
          await adminApi.put(`/users/${editingUser.id}`, payload);
          showToast("User updated.");
        } else {
          await adminApi.post("/users", values);
          showToast("User created.");
        }
        refetch();
        setShowForm(false);
        setEditingUser(null);
        form.reset();
      } catch (err) {
        showToast("Failed to save user.", "error");
      } finally {
        
      }
    },
  });
  const handleCloseForm = () => {
    setShowForm(false);
    setEditingUser(null);
    form.reset();
  };
  const [deletingLoading, setDeletingLoading] = useState(false);
  const handleDelete = async () => {
    if (!deleting) return;
    setDeletingLoading(true);
    try { await adminApi.delete(`/users/${deleting}`); showToast("User removed."); refetch(); }
    catch { showToast("Failed.", "error"); } finally { setDeletingLoading(false); setDeleting(null); }
  };
  const columns: Column<User>[] = [
    { key: "name", label: "Name", render: (r) => <div><div className="font-medium">{r.name}</div><div className="text-[11.5px] text-[#9A9A9A]">{r.email}</div></div> },
    { key: "role", label: "Role", render: (r) => r.role?.name },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        canUpdate ? (
          <button
            onClick={async () => {
              const nextStatus = r.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
              try {
                await adminApi.put(`/users/${r.id}`, { status: nextStatus });
                showToast(`Status updated to ${nextStatus.toLowerCase()}.`);
                refetch();
              } catch {
                showToast("Failed to update status.", "error");
              }
            }}
            className="cursor-pointer hover:opacity-85 transition-opacity focus:outline-hidden"
            title="Click to toggle status"
          >
            <StatusBadge status={r.status} />
          </button>
        ) : (
          <StatusBadge status={r.status} />
        )
      ),
    },
    { key: "lastLoginAt", label: "Last Login", render: (r) => r.lastLoginAt ? new Date(r.lastLoginAt).toLocaleDateString() : "Never" },
    ...(canUpdate || canDelete
      ? [
          {
            key: "actions",
            label: "Actions",
            width: "100px",
            render: (r: User) => (
              <div className="flex items-center gap-1.5">
                {canUpdate && (
                  <button
                    onClick={() => {
                      setEditingUser(r);
                      setShowForm(true);
                    }}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]"
                    title="Edit user"
                  >
                    <Edit2 size={13} />
                  </button>
                )}
                {canDelete && (
                  <button
                    onClick={() => setDeleting(r.id)}
                    className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"
                    title="Delete user"
                  >
                    <Trash2 size={13} />
                  </button>
                )}
              </div>
            ),
          },
        ]
      : []),
  ];
  if (authLoading || !hasPermission("users.view")) {
    return null;
  }

  return (
    <AdminLayout title="Users & Customers" breadcrumb={[{ label: "Users" }]}>
      <div className="space-y-5">
        <AdminListToolbar
          leftExtra={
            <div className="flex border-b border-[#E6E6E6]">
              {hasPermission("customers.view") && (
                <Link
                  href="/admin/customers"
                  className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-transparent text-[#6B7280] hover:text-[#111827]"
                >
                  Customers
                </Link>
              )}
              <Link
                href="/admin/users"
                className="px-4 py-2 text-sm font-semibold border-b-2 transition-colors border-[#E31E24] text-[#E31E24]"
              >
                Staff (Users)
              </Link>
            </div>
          }
          primaryAction={
            canCreate
              ? {
                  label: "New User",
                  onClick: () => setShowForm(true),
                  icon: <Plus size={14} />,
                }
              : undefined
          }
        />

        <Modal open={showForm} onClose={handleCloseForm}>
          <form onSubmit={form.handleSubmit} className="flex flex-col max-h-[90vh] w-full max-w-2xl bg-white rounded-xl shadow-xl overflow-hidden">
            <div className="border-b border-[#E6E6E6] px-5 py-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-[#1A1A1A]">
                  {editingUser ? "Edit Staff User" : "Create New Staff User"}
                </h3>
                <p className="mt-0.5 text-xs text-[#6B6B6B]">
                  {editingUser ? "Modify user credentials, role, and system status." : "Add a new member to the admin team and assign them a system role."}
                </p>
              </div>
              <button
                type="button"
                onClick={handleCloseForm}
                className="text-[#9A9A9A] hover:text-[#1A1A1A]"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <AdminInput label="Full Name" {...form.getFieldProps("name")} error={form.errors.name as string} />
                <AdminInput label="Email" type="email" {...form.getFieldProps("email")} error={form.errors.email as string} />
                <AdminInput label={editingUser ? "Password" : "Password *"} type="password" placeholder={editingUser ? "Leave blank to keep current" : "Min 8 characters"} {...form.getFieldProps("password")} error={form.errors.password as string} />
                <AdminSelect label="Role" options={roleOptions} {...form.getFieldProps("roleId")} error={form.errors.roleId as string} />
                <AdminSelect
                  label="Status"
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  {...form.getFieldProps("status")}
                  error={form.errors.status as string}
                />
                <div className="md:col-span-2 border-t border-[#E6E6E6] pt-4 mt-2">
                  <AdminMultiSelect
                    label="Assigned Warehouses"
                    placeholder="Select assigned warehouses..."
                    options={warehouses.map((w: any) => ({
                      value: w.id,
                      label: `${w.name} ${w.state ? `(${w.state})` : ""}`
                    }))}
                    selectedValues={form.values.warehouseIds}
                    onChange={(nextIds) => form.setFieldValue("warehouseIds", nextIds)}
                    error={form.errors.warehouseIds as string}
                  />
                  <p className="mt-1.5 text-[11px] text-[#9A9A9A]">
                    Leave all unchecked if this staff member should have access to all warehouses.
                  </p>
                </div>
              </div>
            </div>

            <div className="border-t border-[#E6E6E6] bg-slate-50 px-5 py-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseForm}
                className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13px] font-medium text-[#1A1A1A] hover:bg-[#F7F7F7]"
              >
                Cancel
              </button>
              <LoadingButton
                type="submit"
                loading={form.isSubmitting}
                loadingText="Saving..."
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
              >
                {editingUser ? "Update User" : "Create User"}
              </LoadingButton>
            </div>
          </form>
        </Modal>
      <DataTable<User> columns={columns} data={users} rowKey="id" isLoading={isLoading} emptyMessage="No users." />
      <ConfirmModal open={!!deleting} title="Remove user?" message="This will deactivate the user account." onConfirm={handleDelete} onCancel={() => setDeleting(null)} isLoading={deletingLoading} />
      {ToastComponent}
      </div>
    </AdminLayout>
  );
}
