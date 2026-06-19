"use client";
import { useState } from "react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { DataTable, Column, useToast, ConfirmModal } from "@/components/admin/AdminComponents";
import { useAdminRoles } from "@/hooks/admin/useAdminHooks";
import { adminApi } from "@/services/adminApi";
import { Plus, Trash2 } from "lucide-react";

const ALL_PERMISSIONS = ["*","products.create","products.update","products.delete","products.view","orders.manage","orders.view","quotes.manage","quotes.view","inventory.manage","users.manage","settings.manage","logs.view"];
interface Role { id: string; name: string; permissions: string[]; _count: { users: number } }

export default function RolesPage() {
  const [newRoleName, setNewRoleName] = useState("");
  const [newRolePerms, setNewRolePerms] = useState<string[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const { showToast, ToastComponent } = useToast();
  const { data: roles = [], isLoading, refetch } = useAdminRoles();

  const handleCreate = async () => {
    if (!newRoleName) return;
    try { await adminApi.post("/roles", { name: newRoleName, permissions: newRolePerms }); showToast("Role created."); refetch(); setShowForm(false); setNewRoleName(""); setNewRolePerms([]); }
    catch { showToast("Failed.", "error"); }
  };
  const handleDelete = async () => {
    if (!deleting) return;
    try { await adminApi.delete(`/roles/${deleting}`); showToast("Deleted."); refetch(); }
    catch { showToast("Cannot delete role with users assigned.", "error"); } finally { setDeleting(null); }
  };

  const columns: Column<Role>[] = [
    { key: "name", label: "Role" },
    { key: "permissions", label: "Permissions", render: (r) => r.permissions.includes("*") ? <span className="text-red-600 font-medium text-[12.5px]">Full Access</span> : <span className="text-[12.5px] text-[#6B6B6B]">{r.permissions.length} permissions</span> },
    { key: "_count", label: "Users", render: (r) => r._count?.users || 0 },
    { key: "actions", label: "", width: "50px", render: (r) => <button onClick={() => setDeleting(r.id)} className="flex items-center justify-center h-7 w-7 rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50"><Trash2 size={13} /></button> },
  ];

  return (
    <AdminLayout title="Roles & Permissions" breadcrumb={[{ label: "Roles" }]}>
      <div className="flex justify-end mb-5"><button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"><Plus size={14} /> New Role</button></div>
      {showForm && (
        <div className="mb-5 rounded-xl border border-[#E6E6E6] bg-white p-5">
          <input value={newRoleName} onChange={(e) => setNewRoleName(e.target.value)} placeholder="Role name e.g. Sales Manager" className="mb-4 w-full rounded-md border border-[#E6E6E6] px-3.5 py-2.5 text-[13.5px] outline-none focus:border-[#E31E24]" />
          <h4 className="text-[13px] font-medium text-[#1A1A1A] mb-2.5">Permissions</h4>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
            {ALL_PERMISSIONS.map((p) => (
              <label key={p} className="flex items-center gap-2 cursor-pointer text-[13px]">
                <input type="checkbox" checked={newRolePerms.includes(p)} onChange={(e) => e.target.checked ? setNewRolePerms([...newRolePerms, p]) : setNewRolePerms(newRolePerms.filter((x) => x !== p))} className="rounded" />
                <span className="font-mono text-[12px]">{p}</span>
              </label>
            ))}
          </div>
          <button onClick={handleCreate} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">Create Role</button>
        </div>
      )}
      <DataTable<Role> columns={columns} data={roles} rowKey="id" isLoading={isLoading} emptyMessage="No roles." />
      <ConfirmModal open={!!deleting} title="Delete role?" message="Users assigned to this role must be re-assigned first." onConfirm={handleDelete} onCancel={() => setDeleting(null)} />
      {ToastComponent}
    </AdminLayout>
  );
}
