"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Yup from "yup";
import {
  AlertTriangle,
  CheckCircle2,
  Copy,
  ExternalLink,
  GripVertical,
  Layers,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Sliders,
  Tag,
  Trash2,
  XCircle,
  Zap,
} from "lucide-react";
import { AdminLayout } from "@/components/admin/layout/AdminLayout";
import { useAdminAuth } from "@/contexts/AdminAuthContext";
import {
  AdminInput,
  AdminListToolbar,
  AdminSelect,
  AdminStatsGrid,
  ConfirmModal,
  StatusBadge,
  useToast,
  LoadingButton,
  AdminBulkActionsBar,
  AdminDeleteModal,
} from "@/components/admin/AdminComponents";
import { AdminRowActions, AdminActionButton } from "@/components/admin/AdminRowActions";
import { AttributeRoleBadge } from "@/components/admin/attributes/AttributeRoleBadge";
import { AttributeValueEditors } from "@/components/admin/attributes/AttributeValueEditors";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
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
  ATTRIBUTE_DISPLAY_TYPE_LABELS,
  getDisplayTypeChangeWarnings,
  type AttributeRole,
} from "@/lib/attributeUtils";
import type { ApiAttribute } from "@/types/api.types";

type EditorMode = "create" | "edit" | null;
type ColumnKey = "name" | "role" | "status" | "values" | "sortOrder";

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  name: true,
  role: true,
  status: true,
  values: true,
  sortOrder: true,
};

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "name", label: "Attribute Name" },
  { key: "role", label: "Display Type" },
  { key: "status", label: "Status" },
  { key: "values", label: "Values Count" },
  { key: "sortOrder", label: "Sort Order" },
];

const attributeSchema = Yup.object({
  name: Yup.string().trim().required("Attribute name is required"),
  role: Yup.string().oneOf(["DROPDOWN", "X_GRID", "Y_GRID"]).required("Display type is required"),
  status: Yup.string().oneOf(["ACTIVE", "INACTIVE"]).required("Status is required"),
});

export default function AttributesPage() {
  const { hasPermission } = useAdminAuth();
  const canCreate = hasPermission("attributes.create");
  const canUpdate = hasPermission("attributes.update");
  const canDelete = hasPermission("attributes.delete");

  const router = useRouter();
  const { data: attributes = [], isLoading, refetch, isFetching } = useAdminAttributes();
  const createAttribute = useCreateAttribute();
  const updateAttribute = useUpdateAttribute();
  const deleteAttribute = useDeleteAttribute();
  const reorderAttributes = useReorderAttributes();
  const { showToast, ToastComponent } = useToast();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [lastSelectedId, setLastSelectedId] = useState<string | null>(null);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  const [editorMode, setEditorMode] = useState<EditorMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [roleWarnings, setRoleWarnings] = useState<string[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  const { data: editingAttribute, isLoading: editLoading } = useAdminAttribute(editingId ?? "");

  const form = useAdminForm({
    initialValues: {
      name: "",
      role: "DROPDOWN" as AttributeRole,
      status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    },
    validationSchema: attributeSchema,
    onSubmit: async (values, { resetForm }) => {
      try {
        if (editorMode === "edit" && editingId) {
          await updateAttribute.mutateAsync({
            id: editingId,
            name: values.name.trim(),
            role: values.role,
            status: values.status,
          });
          showToast("Attribute saved successfully.");
          resetForm();
          resetEditorState();
          refetch();
          return;
        }

        const res = await createAttribute.mutateAsync({
          name: values.name.trim(),
          role: values.role,
          status: values.status,
        });
        showToast("Attribute created successfully.");
        resetForm();
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
    },
  });

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

  const isFiltered = Boolean(search.trim() || statusFilter || roleFilter);

  const filteredAttributes = useMemo(() => {
    return sorted.filter((attr: ApiAttribute) => {
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchesName = attr.name.toLowerCase().includes(q);
        const matchesSlug = (attr.slug || "").toLowerCase().includes(q);
        if (!matchesName && !matchesSlug) return false;
      }
      if (statusFilter && attr.status !== statusFilter) return false;
      if (roleFilter && attr.role !== roleFilter) return false;
      return true;
    });
  }, [sorted, search, statusFilter, roleFilter]);

  const deletingAttribute = useMemo(
    () => (deletingId ? attributes.find((a: ApiAttribute) => a.id === deletingId) : null),
    [deletingId, attributes],
  );

  useEffect(() => {
    if (editorMode !== "edit" || !editingAttribute) return;
    form.reset({
      name: editingAttribute.name,
      role: editingAttribute.role,
      status: editingAttribute.status as "ACTIVE" | "INACTIVE",
    });
  }, [editorMode, editingAttribute]);

  const resetEditorState = () => {
    setEditorMode(null);
    setEditingId(null);
    form.reset({
      name: "",
      role: "DROPDOWN",
      status: "ACTIVE",
    });
    setRoleWarnings([]);
  };

  const openCreateModal = () => {
    setEditorMode("create");
    setEditingId(null);
    form.reset({
      name: "",
      role: "DROPDOWN",
      status: "ACTIVE",
    });
    setRoleWarnings([]);
  };

  const openEditModal = (attributeId: string) => {
    setEditorMode("edit");
    setEditingId(attributeId);
    setRoleWarnings([]);
  };

  const handleCloseModal = () => {
    if (form.dirty) {
      setShowDiscardConfirm(true);
    } else {
      resetEditorState();
    }
  };

  const handleRoleChange = (nextRole: AttributeRole) => {
    form.setFieldValue("role", nextRole);
    if (editorMode === "edit" && editingAttribute && nextRole !== editingAttribute.role) {
      setRoleWarnings(getDisplayTypeChangeWarnings(editingAttribute.values ?? [], nextRole, editingAttribute.role));
    } else {
      setRoleWarnings([]);
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
      showToast("Attribute order updated.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder attributes."), "error");
      refetch();
    }
  };

  const handleToggleStatus = async (attr: ApiAttribute) => {
    if (!canUpdate) {
      showToast("You do not have permission to update attributes.", "error");
      return;
    }
    const nextStatus = attr.status === "ACTIVE" ? "INACTIVE" : "ACTIVE";
    try {
      await updateAttribute.mutateAsync({
        id: attr.id,
        status: nextStatus,
      });
      showToast(`Attribute marked ${nextStatus.toLowerCase()}.`);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to update attribute status."), "error");
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteAttribute.mutateAsync(deletingId);
      showToast("Attribute deleted successfully.");
      setDeletingId(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete attribute."), "error");
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteAttribute.mutateAsync(id)));
      showToast(`Successfully deleted ${selectedIds.length} attribute(s).`);
      setSelectedIds([]);
      setBulkAction("");
      setShowBulkDeleteModal(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk delete."), "error");
    } finally {
      setBulkSaving(false);
    }
  };

  const handleBulkAction = async (action: string) => {
    if (selectedIds.length === 0 || !action) return;

    if (action === "delete") {
      setShowBulkDeleteModal(true);
      return;
    }

    setBulkSaving(true);
    setBulkAction(action);
    try {
      if (action === "activate") {
        await Promise.all(selectedIds.map((id) => updateAttribute.mutateAsync({ id, status: "ACTIVE" })));
        showToast(`Successfully activated ${selectedIds.length} attribute(s).`);
      } else if (action === "deactivate") {
        await Promise.all(selectedIds.map((id) => updateAttribute.mutateAsync({ id, status: "INACTIVE" })));
        showToast(`Successfully deactivated ${selectedIds.length} attribute(s).`);
      }
      setSelectedIds([]);
      setBulkAction("");
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk action."), "error");
    } finally {
      setBulkSaving(false);
      setBulkAction("");
    }
  };

  const isEditorOpen = !!editorMode;
  const isSaving = form.isSubmitting || createAttribute.isPending || updateAttribute.isPending;
  const currentRole = editorMode === "edit" ? editingAttribute?.role : null;

  const attributeGridClass =
    "grid w-full min-w-0 gap-3 md:grid-cols-[40px_minmax(180px,1fr)_130px_90px_90px_60px_100px] md:items-center";

  return (
    <AdminLayout
      title="Attributes & Options"
      breadcrumb={[
        { label: "Admin", href: "/admin" },
        { label: "Catalog" },
        { label: "Attributes" },
      ]}
    >
      <div className="space-y-5">
        {/* 1. TOP KPI STATS GRID */}
        <AdminStatsGrid
          stats={[
            {
              title: "Total Attributes",
              value: attributeStats.total,
              subtitle: "Product specifications & options",
              icon: <Sliders size={18} />,
            },
            {
              title: "Active Attributes",
              value: attributeStats.active,
              subtitle: "Enabled for products",
              icon: <CheckCircle2 size={18} />,
              color: "bg-green-600",
            },
            {
              title: "Grid Attributes",
              value: attributeStats.grid,
              subtitle: "Generates variant matrices",
              icon: <Zap size={18} />,
              color: "bg-indigo-600",
            },
            {
              title: "Attribute Values",
              value: attributeStats.totalValues,
              subtitle: "Configured value choices",
              icon: <Tag size={18} />,
              color: "bg-blue-600",
            },
          ]}
          isLoading={isLoading}
        />

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: setSearch,
            placeholder: "Search attributes...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: (statusFilter ? 1 : 0) + (roleFilter ? 1 : 0),
          }}
          columns={{
            visibleColumns,
            onToggleColumn: (key: string) =>
              setVisibleColumns((current) => ({
                ...current,
                [key as ColumnKey]: current[key as ColumnKey] === false ? true : false,
              })),
            options: COLUMN_OPTIONS,
          }}
          refresh={{
            onRefresh: () => {
              void refetch().then(() => showToast("Attributes refreshed."));
            },
            isRefreshing: isFetching || isLoading,
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
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setRoleFilter("");
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                options={[
                  { value: "", label: "All Statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Display Type"
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value)}
                options={[
                  { value: "", label: "All Display Types" },
                  { value: "DROPDOWN", label: "Dropdown (Single Choice)" },
                  { value: "X_GRID", label: "X-Grid (Matrix Column)" },
                  { value: "Y_GRID", label: "Y-Grid (Matrix Row)" },
                ]}
              />
            </div>
          }
        />

        {/* 3. REORDERABLE ATTRIBUTE LIST */}
        {isLoading ? (
          <div className="space-y-3">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-lg bg-[#E6E6E6]" />
            ))}
          </div>
        ) : filteredAttributes.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[#E6E6E6] py-12 text-center text-[13.5px] text-[#9A9A9A]">
            {isFiltered
              ? "No attributes matched your search or filters."
              : "No attributes yet. Create your first attribute."}
          </div>
        ) : (
          <div className="rounded-lg border border-[#E6E6E6] bg-white shadow-2xs">
            {/* Header / Bulk Actions Bar */}
            <div className="border-b border-[#E6E6E6] bg-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 min-h-[56px] transition-all rounded-t-lg">
              <div className="flex flex-wrap items-center gap-3 w-full">
                <span className="text-[13px] font-bold text-[#1A1A1A]">Attributes List</span>
                <span className="text-[12.5px] text-[#6B6B6B] whitespace-nowrap">
                  {filteredAttributes.length} {filteredAttributes.length === 1 ? "attribute" : "attributes"}
                  {isFiltered ? " (Filtered — Drag reorder disabled)" : " (Drag rows to reorder)"}
                </span>

                <div className="flex items-center gap-2 border-l border-[#E6E6E6] pl-3 ml-2 flex-wrap">
                  <AdminBulkActionsBar
                    selectedCount={selectedIds.length}
                    onClear={() => setSelectedIds([])}
                    actionType={bulkAction}
                    onActionTypeChange={setBulkAction}
                    actions={[
                      { value: "activate", label: "Enable" },
                      { value: "deactivate", label: "Disable" },
                      { value: "delete", label: "Delete" },
                    ]}
                    onApply={() => handleBulkAction(bulkAction)}
                    applyLoading={bulkSaving}
                    applyDisabled={!bulkAction || selectedIds.length === 0}
                  />
                </div>
              </div>
            </div>

            {/* Column Headers */}
            <div className="p-3">
              <div className="mb-2 hidden items-center gap-2 px-3 text-[11.5px] font-semibold uppercase tracking-wide text-[#9A9A9A] md:flex">
                <span className="w-6 shrink-0" />
                <div className={`${attributeGridClass} min-w-0 flex-1 pr-3`}>
                  <div className="flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={
                        filteredAttributes.length > 0 &&
                        selectedIds.length === filteredAttributes.length
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(filteredAttributes.map((a) => a.id));
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
                items={filteredAttributes}
                onReorder={isFiltered ? () => {} : handleReorder}
                disabled={!canUpdate || isFiltered}
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
                            const prevIndex = filteredAttributes.findIndex((a) => a.id === lastSelectedId);
                            const currIndex = filteredAttributes.findIndex((a) => a.id === attr.id);
                            if (prevIndex !== -1 && currIndex !== -1) {
                              const start = Math.min(prevIndex, currIndex);
                              const end = Math.max(prevIndex, currIndex);
                              const rangeIds = filteredAttributes.slice(start, end + 1).map((a) => a.id);
                              if (!isSelected) {
                                setSelectedIds((prev) => Array.from(new Set([...prev, ...rangeIds])));
                              } else {
                                setSelectedIds((prev) => prev.filter((id) => !rangeIds.includes(id)));
                              }
                              setLastSelectedId(attr.id);
                              return;
                            }
                          }

                          if (e.target.checked) {
                            setSelectedIds((prev) => [...prev, attr.id]);
                          } else {
                            setSelectedIds((prev) => prev.filter((id) => id !== attr.id));
                          }
                          setLastSelectedId(attr.id);
                        }}
                        className="h-4 w-4 accent-[#E31E24]"
                      />
                    </div>

                    <div className="min-w-0">
                      <Link
                        href={`/admin/attributes/${attr.id}`}
                        className="truncate text-[13.5px] font-semibold text-[#1A1A1A] hover:text-[#E31E24] transition-colors inline-flex items-center gap-1.5"
                      >
                        {attr.name}
                        <ExternalLink size={12} className="opacity-0 group-hover:opacity-100 text-[#9A9A9A]" />
                      </Link>
                    </div>

                    <div>
                      <AttributeRoleBadge role={attr.role} />
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleToggleStatus(attr)}
                        className="cursor-pointer"
                        title="Click to toggle status"
                      >
                        <StatusBadge status={attr.status} />
                      </button>
                    </div>

                    <div>
                      <Link
                        href={`/admin/attributes/${attr.id}`}
                        className="text-[12.5px] font-medium text-[#555] hover:text-[#E31E24] hover:underline"
                      >
                        {attr._count?.values ?? attr.values?.length ?? 0} values
                      </Link>
                    </div>

                    <span className="text-[12px] font-mono text-[#888]">#{attr.sortOrder}</span>

                    <div className="flex gap-1.5 md:justify-end">
                      <AdminRowActions
                        edit={
                          canUpdate
                            ? {
                                title: "Edit attribute",
                                onClick: () => openEditModal(attr.id),
                              }
                            : undefined
                        }
                        delete={
                          canDelete
                            ? {
                                title: "Delete attribute",
                                onClick: () => setDeletingId(attr.id),
                              }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                )}
              />
            </div>
          </div>
        )}
      </div>

      {/* ATTRIBUTE CREATE / EDIT MODAL */}
      <Modal
        open={isEditorOpen}
        onClose={handleCloseModal}
        title={editorMode === "edit" ? `Edit Attribute: ${form.values.name}` : "New Attribute"}
        subtitle={
          editorMode === "edit"
            ? "Update attribute configurations, display type, and preset option values."
            : "Define custom specifications, matrix axes, and option lists for products."
        }
        size="3xl"
        footer={
          <div className="flex items-center justify-end gap-2.5 w-full">
            <button
              type="button"
              onClick={handleCloseModal}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-[13.5px] font-medium text-[#1A1A1A] hover:bg-[#F2F2F2] transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <LoadingButton
              type="button"
              onClick={form.handleSubmit}
              loading={isSaving}
              loadingText={editorMode === "edit" ? "Saving..." : "Creating..."}
              disabled={editorMode === "edit" && editLoading}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[#B5151B] transition-colors cursor-pointer shadow-2xs disabled:opacity-60"
            >
              {editorMode === "edit" ? "Save Changes" : "Create Attribute"}
            </LoadingButton>
          </div>
        }
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
                <AdminInput
                  label="Name"
                  placeholder="e.g. Wire Size"
                  {...form.getFieldProps("name")}
                  error={form.errors.name as string}
                  required
                />
                <AdminSelect
                  label="Display Type"
                  value={form.values.role}
                  onChange={(e) => handleRoleChange(e.target.value as AttributeRole)}
                  options={[
                    { value: "DROPDOWN", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.DROPDOWN },
                    { value: "X_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.X_GRID },
                    { value: "Y_GRID", label: ATTRIBUTE_DISPLAY_TYPE_LABELS.Y_GRID },
                  ]}
                  error={form.errors.role as string}
                />
                <AdminSelect
                  label="Status"
                  value={form.values.status}
                  onChange={(e) => form.setFieldValue("status", e.target.value)}
                  options={[
                    { value: "ACTIVE", label: "Active" },
                    { value: "INACTIVE", label: "Inactive" },
                  ]}
                  error={form.errors.status as string}
                />
              </div>

              {editorMode === "edit" && currentRole && form.values.role !== currentRole ? (
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
                  <AttributeValueEditors
                    attribute={{ ...(editingAttribute as ApiAttribute), role: form.values.role }}
                  />
                </div>
              ) : null}
            </>
          )}
        </div>
      </Modal>

      {/* DISCARD CONFIRMATION MODAL */}
      <ConfirmModal
        open={showDiscardConfirm}
        title="Discard Unsaved Changes?"
        message="You have unsaved changes in this attribute form. Are you sure you want to discard them?"
        danger={true}
        confirmText="Discard Changes"
        onConfirm={() => {
          setShowDiscardConfirm(false);
          resetEditorState();
        }}
        onCancel={() => setShowDiscardConfirm(false)}
      />

      {/* SINGLE DELETE MODAL */}
      <AdminDeleteModal
        open={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        itemName={deletingAttribute?.name}
        itemType="Attribute"
        onSoftDelete={handleDelete}
        onPermanentDelete={handleDelete}
        isSoftDeleting={deleteAttribute.isPending}
        isPermanentDeleting={deleteAttribute.isPending}
        softDeleteDescription="Hides this attribute from the catalog while preserving past orders and product associations."
        permanentDeleteDescription="Physically deletes this attribute and its values from the database. Blocked if active products or variants reference it."
      />

      {/* BULK DELETE MODAL */}
      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected attributes`}
        itemType="Attributes (Bulk)"
        onSoftDelete={handleBulkDelete}
        onPermanentDelete={handleBulkDelete}
        isSoftDeleting={bulkSaving}
        isPermanentDeleting={bulkSaving}
        softDeleteDescription="Hides the selected attributes from the catalog while preserving associations."
        permanentDeleteDescription="Physically deletes the selected attributes from the database."
      />

      {ToastComponent}
    </AdminLayout>
  );
}
