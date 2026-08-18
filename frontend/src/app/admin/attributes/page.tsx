"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, AlertTriangle, CheckCircle2, Sliders, Tag, Zap } from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminSelect,
  ConfirmModal,
  StatCard,
  AdminStatsGrid,
  AdminListToolbar,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
} from "@/components/admin/AdminComponents";
import { AttributeRoleBadge } from "@/components/admin/attributes/AttributeRoleBadge";
import { AttributeValueEditors } from "@/components/admin/attributes/AttributeValueEditors";
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
import { adminApi, getAdminErrorMessage } from "@/services/adminApi";
import {
  ATTRIBUTE_DISPLAY_TYPE_LABELS,
  getDisplayTypeChangeWarnings,
  type AttributeRole,
} from "@/lib/attributeUtils";
import type { ApiAttribute } from "@/types/api.types";

type EditorMode = "create" | "edit" | null;

export default function AttributesPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("attributes.create");
  const canUpdate = hasPermission("attributes.update");
  const canDelete = hasPermission("attributes.delete");

  const router = useRouter();
  const { data: attributes = [], isLoading, refetch } = useAdminAttributes();
  const createAttribute = useCreateAttribute();
  const updateAttribute = useUpdateAttribute();
  const deleteAttribute = useDeleteAttribute();
  const reorderAttributes = useReorderAttributes();
  const { showToast, ToastComponent } = useToast();

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const handleBulkAction = async () => {
    if (selectedIds.length === 0 || !bulkAction) return;

    if (bulkAction === "delete") {
      if (!window.confirm(`Are you sure you want to permanently delete the ${selectedIds.length} selected attribute(s)? This action cannot be undone.`)) {
        return;
      }
    }

    setBulkSaving(true);
    try {
      if (bulkAction === "delete") {
        await Promise.all(selectedIds.map(id => deleteAttribute.mutateAsync(id)));
        showToast(`Successfully deleted ${selectedIds.length} attribute(s).`, "success");
      } else if (bulkAction === "activate") {
        await Promise.all(selectedIds.map(id => updateAttribute.mutateAsync({ id, status: "ACTIVE" })));
        showToast(`Successfully activated ${selectedIds.length} attribute(s).`, "success");
      } else if (bulkAction === "deactivate") {
        await Promise.all(selectedIds.map(id => updateAttribute.mutateAsync({ id, status: "INACTIVE" })));
        showToast(`Successfully deactivated ${selectedIds.length} attribute(s).`, "success");
      }
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [role, setRole] = useState<AttributeRole>("DROPDOWN");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">("ACTIVE");
  const [roleWarnings, setRoleWarnings] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: editingAttribute, isLoading: editLoading } = useAdminAttribute(editingId ?? "");

  const attributeStats = useMemo(() => {
    const total = attributes.length;
    const active = attributes.filter((a: ApiAttribute) => a.status === "ACTIVE").length;
    const grid = attributes.filter((a: ApiAttribute) => a.role === "X_GRID" || a.role === "Y_GRID").length;
    const totalValues = attributes.reduce((acc: number, a: ApiAttribute) => acc + (a.values?.length ?? 0), 0);
    return { total, active, grid, totalValues };
  }, [attributes]);

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
    setRoleWarnings([]);
  };

  const openCreateModal = () => {
    setEditorMode("create");
    setEditingId(null);
    setName("");
    setRole("DROPDOWN");
    setStatus("ACTIVE");
    setRoleWarnings([]);
  };

  const openEditModal = (attributeId: string) => {
    setEditorMode("edit");
    setEditingId(attributeId);
    setRoleWarnings([]);
  };

  const handleRoleChange = (nextRole: AttributeRole) => {
    setRole(nextRole);
    if (editorMode === "edit" && editingAttribute && nextRole !== editingAttribute.role) {
      setRoleWarnings(getDisplayTypeChangeWarnings(editingAttribute.values ?? [], nextRole, editingAttribute.role));
    } else {
      setRoleWarnings([]);
    }
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
    if (!canUpdate) {
      showToast("You do not have permission to edit attributes.", "error");
      refetch();
      return;
    }
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

  const attributeGridClass = "grid w-full min-w-0 gap-3 md:grid-cols-[40px_minmax(180px,1fr)_120px_90px_90px_60px_100px] md:items-center";

  return (
    <AdminLayout title="Attributes & Options" breadcrumb={[{ label: "Attributes" }]}>
      <AdminStatsGrid
        stats={[
          { title: "Total Attributes", value: attributeStats.total, subtitle: "Product specifications & options", icon: <Sliders size={18} /> },
          { title: "Active Attributes", value: attributeStats.active, subtitle: "Enabled for products", icon: <CheckCircle2 size={18} />, color: "bg-green-600" },
          { title: "Grid Attributes", value: attributeStats.grid, subtitle: "Generates variant matrices", icon: <Zap size={18} />, color: "bg-indigo-600" },
          { title: "Attribute Values", value: attributeStats.totalValues, subtitle: "Configured value choices", icon: <Tag size={18} />, color: "bg-blue-600" }
        ]}
        isLoading={isLoading}
      />

      <AdminListToolbar
        leftExtra={
          <p className="text-[13.5px] text-[#6B6B6B]">
            Manage global attribute definitions. Drag rows to reorder.
          </p>
        }
        refresh={{
          onRefresh: refetch,
          isRefreshing: isLoading,
        }}
        primaryAction={
          canCreate
            ? {
                onClick: openCreateModal,
                label: "New attribute",
                icon: <Plus size={14} />,
              }
            : undefined
        }
      />

      {isLoading ? (
        <div className="space-y-3">{[...Array(4)].map((_, i) => <div key={i} className="h-16 animate-pulse rounded-lg bg-[#E6E6E6]" />)}</div>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
          No attributes yet. Create your first attribute.
        </div>
      ) : (
        <div className="rounded-lg border border-[#E6E6E6] bg-white">
          <div className="border-b border-[#E6E6E6] bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 min-h-[56px] transition-all rounded-t-lg">
            <div className="flex flex-wrap items-center gap-3 w-full">
              <span className="text-[13px] font-bold text-[#1A1A1A]">Attributes List</span>
              <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
                {sorted.length} {sorted.length === 1 ? "attribute" : "attributes"}
              </span>
              
              <div className="flex items-center gap-2 border-l border-[#E6E6E6] pl-3 ml-2 flex-wrap">
                <AdminBulkActionsBar
                  selectedCount={selectedIds.length}
                  onClear={() => setSelectedIds([])}
                  actionType={bulkAction}
                  onActionTypeChange={setBulkAction}
                  actions={[
                    { value: "activate", label: "Mark active" },
                    { value: "deactivate", label: "Mark inactive" },
                    { value: "delete", label: "Delete selected" }
                  ]}
                  onApply={handleBulkAction}
                  applyLoading={bulkSaving}
                  applyDisabled={!bulkAction || selectedIds.length === 0}
                />
              </div>
            </div>
          </div>
          <div className="p-3">
            <div className="mb-2 hidden items-center gap-2 px-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A] md:flex">
              <span className="w-6 shrink-0" />
              <div className={`${attributeGridClass} min-w-0 flex-1 pr-3`}>
                <div className="flex items-center justify-center">
                  <input
                    type="checkbox"
                    checked={sorted.length > 0 && selectedIds.length === sorted.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedIds(sorted.map(a => a.id));
                      } else {
                        setSelectedIds([]);
                      }
                    }}
                    className="h-4 w-4 accent-[#E31E24]"
                  />
                </div>
                <span>Attribute</span>
                <span>Display Type</span>
                <span>Status</span>
                <span>Values</span>
                <span>Sort</span>
                <span className="text-right">Actions</span>
              </div>
            </div>
            <SortableList
              className="w-full min-w-0"
              rowWidthClassName="w-full min-w-0"
              contentClassName="flex-1 min-w-0 py-2 pr-3"
              items={sorted}
              onReorder={handleReorder}
              disabled={!canUpdate}
              renderItem={(attr) => (
                <div className={attributeGridClass}>
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={selectedIds.includes(attr.id)}
                      onChange={(e) => {
                        const isShiftPressed = (e.nativeEvent as any).shiftKey;
                        const isSelected = selectedIds.includes(attr.id);

                        if (isShiftPressed && lastSelectedId !== null) {
                          const prevIndex = sorted.findIndex(a => a.id === lastSelectedId);
                          const currIndex = sorted.findIndex(a => a.id === attr.id);
                          if (prevIndex !== -1 && currIndex !== -1) {
                            const start = Math.min(prevIndex, currIndex);
                            const end = Math.max(prevIndex, currIndex);
                            const rangeIds = sorted.slice(start, end + 1).map(a => a.id);
                            if (!isSelected) {
                              setSelectedIds(prev => Array.from(new Set([...prev, ...rangeIds])));
                            } else {
                              setSelectedIds(prev => prev.filter(id => !rangeIds.includes(id)));
                            }
                            setLastSelectedId(attr.id);
                            return;
                          }
                        }

                        if (e.target.checked) {
                          setSelectedIds(prev => [...prev, attr.id]);
                        } else {
                          setSelectedIds(prev => prev.filter(id => id !== attr.id));
                        }
                        setLastSelectedId(attr.id);
                      }}
                      className="h-4 w-4 accent-[#E31E24]"
                    />
                  </div>
                  <Link href={`/admin/attributes/${attr.id}`} className="truncate text-[14px] font-semibold text-[#1A1A1A] hover:text-[#E31E24]">
                    {attr.name}
                  </Link>
                  <div>
                    <AttributeRoleBadge role={attr.role} />
                  </div>
                  <div>
                    <StatusBadge status={attr.status} />
                  </div>
                  <span className="text-[13px] text-[#6B6B6B]">{attr._count?.values ?? 0} values</span>
                  <span className="text-[12px] text-[#9A9A9A]">#{attr.sortOrder}</span>
                  <div className="flex gap-1.5 md:justify-end">
                    {canUpdate && (
                      <button type="button" onClick={() => openEditModal(attr.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-[#6B6B6B] hover:bg-[#F2F2F2]" title="Edit attribute">
                        <Pencil size={13} />
                      </button>
                    )}
                    {canDelete && (
                      <button type="button" onClick={() => setDeletingId(attr.id)} className="flex h-7 w-7 items-center justify-center rounded border border-[#E6E6E6] text-red-500 hover:bg-red-50" title="Delete attribute">
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                </div>
              )}
            />
          </div>
        </div>
      )}

      <Modal
        open={isEditorOpen}
        onClose={resetEditorState}
        title={editorMode === "edit" ? "Edit attribute" : "New attribute"}
        panelClassName="max-h-[90vh] max-w-3xl overflow-y-auto"
      >
        <div className="p-6">
          {editorMode === "edit" && editLoading ? (
            <div className="space-y-4">
              {[...Array(3)].map((_, index) => (
                <div key={index} className="h-12 animate-pulse rounded-lg bg-[#E6E6E6]" />
              ))}
            </div>
          ) : (
            <>
              <div className="space-y-4">
                <AdminInput label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Wire Size" />
                <AdminSelect
                  label="Display Type"
                  value={role}
                  onChange={(e) => handleRoleChange(e.target.value as AttributeRole)}
                  options={[
                    { value: "DROPDOWN", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.DROPDOWN },
                    { value: "X_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.X_GRID },
                    { value: "Y_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.Y_GRID },
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
                <p className="mt-4 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-[12.5px] text-amber-900">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0" />
                  Display type changed. Save to apply. The storefront will automatically switch between dropdown and matrix rendering based on this setting.
                </p>
              ) : null}
              {roleWarnings.length > 0 ? (
                <p className="mt-3 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[12.5px] text-blue-900">
                  {roleWarnings.join(" ")}
                </p>
              ) : null}

              {editorMode === "edit" && editingAttribute ? (
                <div className="mt-6 border-t border-[#E6E6E6] pt-6">
                  <div className="mb-4">
                    <h3 className="text-[14px] font-semibold text-[#1A1A1A]">Values</h3>
                    <p className="mt-1.5 text-[12.5px] text-[#6B6B6B]">
                      If you switch the display type, update the existing values here before saving the attribute.
                    </p>
                  </div>
                  <AttributeValueEditors attribute={{ ...(editingAttribute as ApiAttribute), role }} />
                </div>
              ) : null}

              <div className="mt-6 flex gap-2">
                <LoadingButton
                  type="button"
                  onClick={handleSave}
                  loading={isSaving}
                  loadingText={editorMode === "edit" ? "Saving..." : "Creating..."}
                  disabled={editorMode === "edit" && editLoading}
                  className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B] disabled:opacity-60"
                >
                  {editorMode === "edit" ? "Save" : "Create"}
                </LoadingButton>
                <button type="button" onClick={resetEditorState} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]">
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </Modal>

      <ConfirmModal
        open={!!deletingId}
        title="Delete attribute?"
        message="Are you sure you want to permanently delete this attribute? This action cannot be undone."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
        isLoading={deleteAttribute.isPending}
      />
      {ToastComponent}
    </AdminLayout>
  );
}
