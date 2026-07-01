"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle } from "lucide-react";
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
import { Modal } from "@/components/ui/Modal";
import {
  useAdminAttribute,
  useAdminAttributes,
  useCreateAttribute,
  useDeleteAttribute,
  useReorderAttributes,
  useUpdateAttribute,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import {
  ATTRIBUTE_ROLE_LABELS,
  getRoleChangeWarnings,
  type AttributeRole,
} from "@/lib/attributeUtils";
import type { ApiAttribute } from "@/types/api.types";

type EditorMode = "create" | "edit" | null;

export default function AttributesPage() {
  const router = useRouter();
  const { data: attributes = [], isLoading, refetch } = useAdminAttributes();
  const createAttribute = useCreateAttribute();
  const updateAttribute = useUpdateAttribute();
  const deleteAttribute = useDeleteAttribute();
  const reorderAttributes = useReorderAttributes();
  const { showToast, ToastComponent } = useToast();

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<AttributeRole>("DROPDOWN");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [pendingRole, setPendingRole] = useState<AttributeRole | null>(null);
  const [roleWarnings, setRoleWarnings] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: editingAttribute, isLoading: editLoading } = useAdminAttribute(editingId ?? "");

  const sorted = useMemo(
    () => [...attributes].sort((a: ApiAttribute, b: ApiAttribute) => a.sortOrder - b.sortOrder),
    [attributes],
  );

  useEffect(() => {
    if (editorMode !== "edit" || !editingAttribute) return;
    setName(editingAttribute.name);
    setRole(editingAttribute.role);
    setStatus(editingAttribute.status as "ACTIVE" | "INACTIVE");
  }, [editorMode, editingAttribute]);

  const resetEditorState = () => {
    setEditorMode(null);
    setEditingId(null);
    setName("");
    setRole("DROPDOWN");
    setStatus("ACTIVE");
    setPendingRole(null);
    setRoleWarnings([]);
  };

  const openCreateModal = () => {
    setEditorMode("create");
    setEditingId(null);
    setName("");
    setRole("DROPDOWN");
    setStatus("ACTIVE");
    setPendingRole(null);
    setRoleWarnings([]);
  };

  const openEditModal = (attributeId: string) => {
    setEditorMode("edit");
    setEditingId(attributeId);
    setPendingRole(null);
    setRoleWarnings([]);
  };

  const handleRoleChange = (nextRole: AttributeRole) => {
    if (editorMode !== "edit" || !editingAttribute || nextRole === editingAttribute.role) {
      setRole(nextRole);
      return;
    }
    const warnings = getRoleChangeWarnings(editingAttribute.values ?? [], nextRole, editingAttribute.role);
    if (warnings.length > 0) {
      setPendingRole(nextRole);
      setRoleWarnings(warnings);
      return;
    }
    setRole(nextRole);
  };

  const confirmRoleChange = () => {
    if (pendingRole) setRole(pendingRole);
    setPendingRole(null);
    setRoleWarnings([]);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      showToast("Attribute name is required.", "error");
      return;
    }

    try {
      if (editorMode === "edit" && editingId) {
        await updateAttribute.mutateAsync({
          id: editingId,
          name: name.trim(),
          role,
          status,
        });
        showToast("Attribute saved.");
        resetEditorState();
        refetch();
        return;
      }

      const res = await createAttribute.mutateAsync({
        name: name.trim(),
        role,
        status,
      });
      showToast("Attribute created.");
      resetEditorState();
      const created = res?.data as ApiAttribute | undefined;
      if (created?.id) router.push(`/admin/attributes/${created.id}`);
      else refetch();
    } catch (error) {
      showToast(
        getAdminErrorMessage(
          error,
          editorMode === "edit" ? "Failed to save attribute." : "Failed to create attribute.",
        ),
        "error",
      );
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

  const isEditorOpen = !!editorMode;
  const isSaving = createAttribute.isPending || updateAttribute.isPending;
  const currentRole = editorMode === "edit" ? editingAttribute?.role : null;

  return (
    <AdminLayout title="Attributes & Options" breadcrumb={[{ label: "Attributes" }]}>
      <div className="mb-5 flex items-center justify-between gap-3">
        <p className="text-[13.5px] text-[#6B6B6B]">
          Manage global attribute definitions. Drag rows to reorder.
        </p>
        <button
          type="button"
          onClick={openCreateModal}
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
                <button type="button" onClick={() => openEditModal(attr.id)} className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0]">
                  <Pencil size={14} />
                </button>
                <button type="button" onClick={() => setDeletingId(attr.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50">
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        />
      )}

      <Modal
        open={isEditorOpen}
        onClose={resetEditorState}
        title={editorMode === "edit" ? "Edit attribute" : "New attribute"}
        panelClassName="max-w-md"
      >
        {editorMode === "edit" && editLoading ? (
          <div className="space-y-3">
            {[...Array(3)].map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-lg bg-[#E6E6E6]" />
            ))}
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <AdminInput label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wire Size" />
              <AdminSelect
                label="Role"
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as AttributeRole)}
                options={[
                  { value: "DROPDOWN", label: ATTRIBUTE_ROLE_LABELS.DROPDOWN },
                  { value: "X_GRID", label: ATTRIBUTE_ROLE_LABELS.X_GRID },
                  { value: "Y_GRID", label: ATTRIBUTE_ROLE_LABELS.Y_GRID },
                ]}
              />
              <AdminSelect
                label="Status"
                value={status}
                onChange={(e) => setStatus(e.target.value as "ACTIVE" | "INACTIVE")}
                options={[
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
            </div>

            {editorMode === "edit" && currentRole && role !== currentRole ? (
              <p className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                Role changed. Save to apply. Existing values must match the new role or the server will reject the update.
              </p>
            ) : null}

            <div className="mt-5 flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving || (editorMode === "edit" && editLoading)}
                className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
              >
                {isSaving ? (editorMode === "edit" ? "Saving..." : "Creating...") : editorMode === "edit" ? "Save" : "Create"}
              </button>
              <button type="button" onClick={resetEditorState} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]">
                Cancel
              </button>
            </div>
          </>
        )}
      </Modal>

      <ConfirmModal
        open={!!pendingRole}
        title="Change attribute role?"
        message={
          roleWarnings.length
            ? `${roleWarnings.join(" ")} You can change the role, but saving will fail until values are updated.`
            : "Proceed with role change?"
        }
        onConfirm={confirmRoleChange}
        onCancel={() => {
          setPendingRole(null);
          setRoleWarnings([]);
        }}
      />

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
