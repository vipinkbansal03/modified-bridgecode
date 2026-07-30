"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Edit2, Plus, Trash2, X } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import { AdminInput, ConfirmModal, DataTable, StatusBadge, useToast, type Column } from "@/components/admin/AdminComponents";
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import { ApiShippingBox } from "@/types/api.types";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export default function ShippingBoxesPage() {
  const { hasPermission } = useAdminAuth();
  const canManage = hasPermission("shipping.manage");
  const { showToast, ToastComponent } = useToast();
  const qc = useQueryClient();

  const { data: boxes = [], isLoading } = useQuery<ApiShippingBox[]>({
    queryKey: ["admin-shipping-boxes"],
    queryFn: () => adminApi.get("/shipping/boxes").then((r) => r.data.data),
  });

  const upsertMutation = useMutation({
    mutationFn: async (vars: { id?: string; data: Record<string, unknown> }) =>
      vars.id ? adminApi.put(`/shipping/boxes/${vars.id}`, vars.data) : adminApi.post("/shipping/boxes", vars.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/shipping/boxes/${id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (id: string) => adminApi.post(`/shipping/boxes/${id}/toggle`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-shipping-boxes"] });
    },
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingBox, setEditingBox] = useState<ApiShippingBox | null>(null);
  const [formName, setFormName] = useState("");
  const [formLength, setFormLength] = useState("");
  const [formWidth, setFormWidth] = useState("");
  const [formHeight, setFormHeight] = useState("");
  const [formMaxWeight, setFormMaxWeight] = useState("");
  const [formIsActive, setFormIsActive] = useState(true);
  const [deletingBox, setDeletingBox] = useState<ApiShippingBox | null>(null);

  const openCreate = () => {
    setEditingBox(null);
    setFormName("");
    setFormLength("");
    setFormWidth("");
    setFormHeight("");
    setFormMaxWeight("");
    setFormIsActive(true);
    setFormOpen(true);
  };

  const openEdit = (box: ApiShippingBox) => {
    setEditingBox(box);
    setFormName(box.name);
    setFormLength(String(box.length));
    setFormWidth(String(box.width));
    setFormHeight(String(box.height));
    setFormMaxWeight(String(box.maxWeight));
    setFormIsActive(box.isActive);
    setFormOpen(true);
  };

  const handleSave = async () => {
    if (!formName.trim()) { showToast("Box name is required.", "error"); return; }
    const payload = {
      name: formName.trim(),
      length: Number(formLength),
      width: Number(formWidth),
      height: Number(formHeight),
      maxWeight: Number(formMaxWeight),
      isActive: formIsActive,
    };
    try {
      await upsertMutation.mutateAsync({ id: editingBox?.id, data: payload });
      showToast(editingBox ? "Box updated." : "Box created.");
      setFormOpen(false);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save box."), "error");
    }
  };

  const columns: Column<ApiShippingBox>[] = useMemo(() => [
    { key: "name", label: "Box Name" },
    {
      key: "length", label: "L × W × H (cm)",
      render: (row) => `${row.length} × ${row.width} × ${row.height}`,
    },
    {
      key: "maxWeight", label: "Max Weight (kg)",
      render: (row) => row.maxWeight,
    },
    {
      key: "isActive", label: "Status",
      render: (row) => <StatusBadge status={row.isActive ? "ACTIVE" : "INACTIVE"} />,
    },
    {
      key: "actions", label: "Actions",
      render: (row) => (
        <div className="flex items-center gap-2">
          <button
            onClick={() => openEdit(row)}
            disabled={!canManage}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
          >
            <Edit2 size={12} />
          </button>
          <button
            onClick={async () => {
              try {
                await toggleMutation.mutateAsync(row.id);
                showToast(`${row.name} ${row.isActive ? "deactivated" : "activated"}.`);
              } catch (error) {
                showToast(getAdminErrorMessage(error, "Toggle failed."), "error");
              }
            }}
            disabled={!canManage}
            className="rounded border border-[#E6E6E6] px-2 py-1 text-[12px] hover:bg-[#F5F5F5] disabled:opacity-40"
          >
            {row.isActive ? "Deactivate" : "Activate"}
          </button>
          <button
            onClick={() => setDeletingBox(row)}
            disabled={!canManage}
            className="rounded border border-[#F2C9C9] px-2 py-1 text-[12px] text-red-600 hover:bg-red-50 disabled:opacity-40"
          >
            <Trash2 size={12} />
          </button>
        </div>
      ),
    },
  ], [canManage, toggleMutation, showToast]);

  return (
    <AdminLayout title="Package/Box Management" breadcrumb={[{ label: "Shipping", href: "/admin/shipping" }, { label: "Boxes" }]}>
      <div className="space-y-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex gap-2 border-b border-[#E6E6E6]">
            <Link href="/admin/shipping" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Providers
            </Link>
            <Link href="/admin/shipping/zones" className="px-4 py-2 text-[13px] font-medium text-[#6B6B6B] hover:text-[#111]">
              Zones
            </Link>
            <span className="border-b-2 border-[#E31E24] px-4 py-2 text-[13px] font-semibold text-[#111]">Boxes</span>
          </div>
          {canManage && (
            <button onClick={openCreate} className="inline-flex items-center justify-center gap-2 rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]">
              <Plus size={15} /> Add Box
            </button>
          )}
        </div>

        <DataTable columns={columns} data={boxes} isLoading={isLoading} rowKey="id" emptyMessage="No shipping boxes configured." />
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#111]">{editingBox ? "Edit Box" : "Add Box"}</h2>
              <button onClick={() => setFormOpen(false)} className="rounded-md p-1 text-[#6B6B6B] hover:bg-[#F2F2F2] hover:text-[#111]">
                <X size={18} />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <AdminInput label="Box Name *" placeholder="e.g. Small Box, Medium Box" value={formName} onChange={(e) => setFormName(e.target.value)} />
              </div>
              <AdminInput label="Length (cm) *" type="text" placeholder="e.g. 30" value={formLength} onChange={(e) => setFormLength(e.target.value)} />
              <AdminInput label="Width (cm) *" type="text" placeholder="e.g. 20" value={formWidth} onChange={(e) => setFormWidth(e.target.value)} />
              <AdminInput label="Height (cm) *" type="text" placeholder="e.g. 15" value={formHeight} onChange={(e) => setFormHeight(e.target.value)} />
              <AdminInput label="Max Weight (kg) *" type="text" placeholder="e.g. 5" value={formMaxWeight} onChange={(e) => setFormMaxWeight(e.target.value)} />
              <div className="flex items-end pb-2">
                <label className="flex cursor-pointer items-center gap-2">
                  <input type="checkbox" checked={formIsActive} onChange={(e) => setFormIsActive(e.target.checked)} className="rounded" />
                  <span className="text-[13.5px] text-[#1A1A1A]">Active</span>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setFormOpen(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2.5 text-[13.5px] font-medium text-[#555] hover:bg-[#F2F2F2]">
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={upsertMutation.isPending}
                className="rounded-md bg-[#E31E24] px-5 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
              >
                {upsertMutation.isPending ? "Saving..." : editingBox ? "Update Box" : "Create Box"}
              </button>
            </div>
          </div>
        </div>
      )}

      {deletingBox && (
        <ConfirmModal
          open={!!deletingBox}
          title="Delete Box"
          message={`Are you sure you want to delete "${deletingBox.name}"? This action cannot be undone.`}
          onConfirm={async () => {
            try {
              await deleteMutation.mutateAsync(deletingBox.id);
              showToast("Box deleted.");
            } catch (error) {
              showToast(getAdminErrorMessage(error, "Failed to delete box."), "error");
            } finally {
              setDeletingBox(null);
            }
          }}
          onCancel={() => setDeletingBox(null)}
        />
      )}

      {ToastComponent}
    </AdminLayout>
  );
}
