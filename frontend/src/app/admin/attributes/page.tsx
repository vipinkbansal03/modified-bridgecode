"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  StatusBadge,
  useToast,
} from "@/components/admin/AdminComponents";
import { AttributeRoleBadge } from "@/components/admin/attributes/AttributeRoleBadge";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import {
  useAdminAttributes,
  useCreateAttribute,
  useDeleteAttribute,
  useReorderAttributes,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import type { ApiAttribute } from "@/types/api.types";
import type { AttributeRole } from "@/lib/attributeUtils";

export default function AttributesPage() {
  const router = useRouter();
  const { data: attributes = [], isLoading, refetch } = useAdminAttributes();
  const createAttribute = useCreateAttribute();
  const deleteAttribute = useDeleteAttribute();
  const reorderAttributes = useReorderAttributes();
  const { showToast, ToastComponent } = useToast();

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<AttributeRole>("DROPDOWN");
  const [newStatus, setNewStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const sorted = useMemo(
    () => [...attributes].sort((a: ApiAttribute, b: ApiAttribute) => a.sortOrder - b.sortOrder),
    [attributes],
  );

  const handleCreate = async () => {
    if (!newName.trim()) {
      showToast("Attribute name is required.", "error");
      return;
    }
    try {
      const res = await createAttribute.mutateAsync({
        name: newName.trim(),
        role: newRole,
        status: newStatus,
      });
      showToast("Attribute created.");
      setShowCreate(false);
      setNewName("");
      setNewRole("DROPDOWN");
      setNewStatus("ACTIVE");
      const created = res?.data as ApiAttribute | undefined;
      if (created?.id) router.push(`/admin/attributes/${created.id}`);
      else refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to create attribute."), "error");
    }
  };

  const handleReorder = async (next: ApiAttribute[]) => {
    try {
      await reorderAttributes.mutateAsync(toSortOrderPayload(next));
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder attributes."), "error");
      refetch();
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteAttribute.mutateAsync(deletingId);
      showToast("Attribute removed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete attribute."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <AdminLayout title="Attributes & Options" breadcrumb={[{ label: "Attributes" }]}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#6B6B6B]">
          Manage global attribute definitions. Drag rows to reorder.
        </p>
        <button
          type="button"
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-md bg-[#E31E24] px-4 py-2.5 text-[13.5px] font-semibold text-white hover:bg-[#B5151B]"
        >
          <Plus size={14} /> New attribute
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
          No attributes yet. Create your first attribute.
        </div>
      ) : (
        <SortableList
          items={sorted}
          onReorder={handleReorder}
          renderItem={(attr) => (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 flex-wrap items-center gap-3">
                <Link href={`/admin/attributes/${attr.id}`} className="text-[14px] font-semibold text-[#1A1A1A] hover:text-[#E31E24]">
                  {attr.name}
                </Link>
                <AttributeRoleBadge role={attr.role} />
                <StatusBadge status={attr.status} />
                <span className="text-[12px] text-[#9A9A9A]">{attr._count?.values ?? 0} values</span>
                <span className="text-[11px] text-[#C4C4C4]">#{attr.sortOrder}</span>
              </div>
              <div className="flex shrink-0 gap-1">
                <Link href={`/admin/attributes/${attr.id}`} className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0]">
                  <Pencil size={14} />
                </Link>
                <button type="button" onClick={() => setDeletingId(attr.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        />
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-xl border border-[#E6E6E6] bg-white p-5 shadow-xl">
            <h2 className="mb-4 text-[15px] font-semibold text-[#1A1A1A]">New attribute</h2>
            <div className="space-y-3">
              <AdminInput label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Wire Size" />
              <AdminSelect
                label="Role"
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as AttributeRole)}
                options={[
                  { value: "DROPDOWN", label: "Dropdown" },
                  { value: "X_GRID", label: "X-Grid (rows × columns)" },
                  { value: "Y_GRID", label: "Y-Grid (country pricing)" },
                ]}
              />
              <AdminSelect
                label="Status"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
            </div>
            <div className="mt-5 flex gap-2">
              <button type="button" onClick={handleCreate} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
                Create
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deletingId}
        title="Remove attribute?"
        message="This will deactivate the attribute and its values."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
