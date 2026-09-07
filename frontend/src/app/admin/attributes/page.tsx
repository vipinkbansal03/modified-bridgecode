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
import { formatDate } from "@/utils/formatDate";
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
  DataTable,
  Pagination,
  type Column,
} from "@/components/admin/AdminComponents";
import { AdminRowActions, AdminActionButton } from "@/components/admin/AdminRowActions";
import { AttributeRoleBadge } from "@/components/admin/attributes/AttributeRoleBadge";
import { AttributeValueEditors } from "@/components/admin/attributes/AttributeValueEditors";
import { toSortOrderPayload } from "@/components/admin/SortableList";
import { useAdminForm } from "@/hooks/admin/useAdminForm";
import { Modal } from "@/components/ui/Modal";
import {
  useAdminAttribute,
  useAdminAttributes,
  useCreateAttribute,
  useDeleteAttribute,
  usePermanentDeleteAttribute,
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
type ColumnKey = "name" | "role" | "values" | "status" | "sortOrder" | "updatedAt";

const DEFAULT_COLUMNS: Record<ColumnKey, boolean> = {
  name: true,
  role: true,
  values: true,
  status: true,
  sortOrder: true,
  updatedAt: true,
};

const COLUMN_OPTIONS: { key: ColumnKey; label: string }[] = [
  { key: "name", label: "Attribute Name" },
  { key: "role", label: "Display Type" },
  { key: "values", label: "Values Count" },
  { key: "status", label: "Status" },
  { key: "sortOrder", label: "Priority / Sort" },
  { key: "updatedAt", label: "Updated Date" },
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
  const permanentDeleteAttribute = usePermanentDeleteAttribute();
  const reorderAttributes = useReorderAttributes();
  const { showToast, ToastComponent } = useToast();

  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [sortBy, setSortBy] = useState("sortOrder");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [showFilters, setShowFilters] = useState(false);
  const [visibleColumns, setVisibleColumns] = useState<Record<ColumnKey, boolean>>(DEFAULT_COLUMNS);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);

  useEffect(() => {
    setSelectedIds([]);
  }, [page, limit, search, statusFilter, roleFilter, sortBy, sortDir]);

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
    const inactive = attributes.filter((a: ApiAttribute) => a.status === "INACTIVE").length;
    const totalValues = attributes.reduce((acc: number, a: ApiAttribute) => acc + (a.values?.length ?? 0), 0);
    return { total, active, inactive, totalValues };
  }, [attributes]);

  const isFiltered = Boolean(search.trim() || statusFilter || roleFilter);

  const filteredAttributes = useMemo(() => {
    return attributes.filter((attr: ApiAttribute) => {
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
  }, [attributes, search, statusFilter, roleFilter]);

  const sortedAttributes = useMemo(() => {
    const list = [...filteredAttributes];
    list.sort((a: ApiAttribute, b: ApiAttribute) => {
      if (sortBy === "sortOrder") {
        return sortDir === "asc" ? a.sortOrder - b.sortOrder : b.sortOrder - a.sortOrder;
      }
      if (sortBy === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      if (sortBy === "updatedAt") {
        const dateA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
        const dateB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
        return sortDir === "asc" ? dateA - dateB : dateB - dateA;
      }
      if (sortBy === "createdAt") {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return sortDir === "asc" ? dateA - dateB : dateB - dateA;
      }
      return 0;
    });
    return list;
  }, [filteredAttributes, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sortedAttributes.length / limit));
  const paginatedAttributes = useMemo(() => {
    const start = (page - 1) * limit;
    return sortedAttributes.slice(start, start + limit);
  }, [sortedAttributes, page, limit]);

  const recentlyUpdatedAttributes = useMemo(() => {
    if (!attributes.length) return [];
    const withDate = [...attributes].filter((a: ApiAttribute) => Boolean(a.updatedAt));
    if (withDate.length > 0) {
      return withDate
        .sort((a: ApiAttribute, b: ApiAttribute) => new Date(b.updatedAt!).getTime() - new Date(a.updatedAt!).getTime())
        .slice(0, 4);
    }
    return [...attributes].slice(0, 4);
  }, [attributes]);

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
      const start = (page - 1) * limit;
      const fullReordered = [...sortedAttributes];
      fullReordered.splice(start, next.length, ...next);
      await reorderAttributes.mutateAsync(toSortOrderPayload(fullReordered));
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

  const handleSoftDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteAttribute.mutateAsync(deletingId);
      showToast("Attribute archived successfully.");
      setDeletingId(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to archive attribute."), "error");
      throw error;
    }
  };

  const handlePermanentDelete = async () => {
    if (!deletingId) return;
    try {
      await permanentDeleteAttribute.mutateAsync(deletingId);
      showToast("Attribute permanently deleted.");
      setDeletingId(null);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to permanently delete attribute."), "error");
      throw error;
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    setBulkSaving(true);
    try {
      await Promise.all(selectedIds.map((id) => deleteAttribute.mutateAsync(id)));
      showToast(`Successfully archived ${selectedIds.length} attribute(s).`);
      setSelectedIds([]);
      setBulkAction("");
      setShowBulkDeleteModal(false);
      refetch();
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to complete bulk archive."), "error");
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

  const columns: Column<ApiAttribute>[] = useMemo(() => [
    {
      key: "name",
      label: "Attribute Name",
      width: "240px",
      render: (row) => (
        <div className="min-w-0">
          <Link
            href={`/admin/attributes/${row.id}`}
            className="truncate font-semibold text-[#1A1A1A] hover:text-[#E31E24] transition-colors inline-flex items-center gap-1.5"
          >
            <span>{row.name}</span>
            <ExternalLink size={12} className="text-[#9A9A9A] shrink-0" />
          </Link>
          <div className="mt-0.5 text-[11.5px] text-[#9A9A9A] font-mono truncate">
            {row.slug ? `slug: ${row.slug}` : `ID: ${row.id.slice(0, 8)}...`}
          </div>
        </div>
      ),
    },
    {
      key: "role",
      label: "Display Type",
      width: "160px",
      render: (row) => <AttributeRoleBadge role={row.role} />,
    },
    {
      key: "values",
      label: "Values",
      width: "130px",
      render: (row) => (
        <Link
          href={`/admin/attributes/${row.id}`}
          className="inline-flex items-center gap-1.5 text-[12.5px] font-medium text-[#555] hover:text-[#E31E24] hover:underline"
        >
          <Tag size={12} className="text-[#9A9A9A]" />
          <span>{row._count?.values ?? row.values?.length ?? 0} values</span>
        </Link>
      ),
    },
    {
      key: "status",
      label: "Status",
      width: "110px",
    },
    {
      key: "sortOrder",
      label: "Priority",
      width: "100px",
      render: (row) => (
        <span className="font-mono text-[12px] text-[#888] whitespace-nowrap">
          #{row.sortOrder}
        </span>
      ),
    },
    {
      key: "updatedAt" as any,
      label: "Updated Date",
      width: "130px",
      render: (row) => (
        <span className="text-[#1A1A1A] whitespace-nowrap text-[12.5px]">
          {row.updatedAt ? formatDate(row.updatedAt) : "—"}
        </span>
      ),
    },
    {
      key: "actions",
      label: "Actions",
      width: "120px",
      render: (row) => (
        <AdminRowActions
          view={{
            onClick: () => router.push(`/admin/attributes/${row.id}`),
            title: "View attribute values and details",
          }}
          edit={
            canUpdate
              ? {
                  onClick: () => openEditModal(row.id),
                  title: "Edit attribute",
                }
              : undefined
          }
          delete={
            canDelete
              ? {
                  onClick: () => setDeletingId(row.id),
                  title: "Delete attribute",
                }
              : undefined
          }
        />
      ),
    },
  ], [canUpdate, canDelete, router]);

  const filteredColumns = useMemo(() => {
    return columns.filter((column) => {
      const k = column.key as ColumnKey;
      if (k in visibleColumns) return visibleColumns[k];
      return true;
    });
  }, [columns, visibleColumns]);

  return (
    <AdminLayout
      title="Attributes & Options"
      breadcrumb={[
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
              subtitle: "All configured attributes",
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
              title: "Inactive Attributes",
              value: attributeStats.inactive,
              subtitle: "Disabled attributes",
              icon: <XCircle size={18} />,
              color: "bg-gray-600",
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

        {/* RECENTLY UPDATED */}
        {recentlyUpdatedAttributes.length > 0 ? (
          <div className="rounded-xl border border-[#E6E6E6] bg-white p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[13.5px] font-semibold text-[#1A1A1A]">Recently Updated</h3>
                <p className="text-[12px] text-[#6B6B6B]">Quick access to latest modified attributes.</p>
              </div>
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-[11px] font-medium text-[#6B6B6B]">
                {recentlyUpdatedAttributes.length} items
              </span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {recentlyUpdatedAttributes.map((attr) => (
                <div
                  key={attr.id}
                  onClick={() => openEditModal(attr.id)}
                  className="rounded-lg border border-[#E6E6E6] p-3 bg-[#FAFAFA] flex flex-col justify-between min-h-[90px] cursor-pointer hover:border-[#D6D6D6] transition-colors"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[13px] font-semibold text-[#1A1A1A]" title={attr.name}>{attr.name}</div>
                    <div className="text-[11.5px] text-[#9A9A9A] mt-1 truncate">
                      {ATTRIBUTE_DISPLAY_TYPE_LABELS[attr.role as AttributeRole] || attr.role} · {attr._count?.values ?? attr.values?.length ?? 0} values
                    </div>
                  </div>
                  <div className="mt-2.5 flex items-center justify-between">
                    <span className="text-[11.5px] text-[#9A9A9A]">
                      {attr.updatedAt ? formatDate(attr.updatedAt) : "—"}
                    </span>
                    <StatusBadge status={attr.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* 2. STANDARDIZED LIST TOOLBAR */}
        <AdminListToolbar
          search={{
            value: search,
            onChange: (val: string) => {
              setPage(1);
              setSearch(val);
            },
            placeholder: "Search attributes...",
            widthClassName: "w-[240px]",
          }}
          filters={{
            showFilters,
            onToggle: () => setShowFilters(!showFilters),
            activeCount: [statusFilter, roleFilter].filter(Boolean).length,
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
                  label: "Add Attribute",
                  icon: <Plus size={14} />,
                }
              : undefined
          }
          onResetFilters={() => {
            setSearch("");
            setStatusFilter("");
            setRoleFilter("");
            setSortBy("sortOrder");
            setSortDir("asc");
            setPage(1);
          }}
          filterPanel={
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <AdminSelect
                label="Status"
                value={statusFilter}
                onChange={(event) => {
                  setPage(1);
                  setStatusFilter(event.target.value);
                }}
                options={[
                  { value: "", label: "All status" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "INACTIVE", label: "Inactive" },
                ]}
              />
              <AdminSelect
                label="Display Type"
                value={roleFilter}
                onChange={(event) => {
                  setPage(1);
                  setRoleFilter(event.target.value);
                }}
                options={[
                  { value: "", label: "All types" },
                  { value: "DROPDOWN", label: "Dropdown (Single Choice)" },
                  { value: "X_GRID", label: "X-Grid (Matrix Column)" },
                  { value: "Y_GRID", label: "Y-Grid (Matrix Row)" },
                ]}
              />
              <AdminSelect
                label="Sort By"
                value={sortBy}
                onChange={(event) => {
                  setSortBy(event.target.value);
                  setPage(1);
                }}
                options={[
                  { value: "sortOrder", label: "Sort Order" },
                  { value: "name", label: "Attribute Name" },
                  { value: "updatedAt", label: "Updated Date" },
                  { value: "createdAt", label: "Created Date" },
                ]}
              />
              <AdminSelect
                label="Direction"
                value={sortDir}
                onChange={(event) => {
                  setSortDir(event.target.value as "asc" | "desc");
                  setPage(1);
                }}
                options={[
                  { value: "asc", label: "Ascending" },
                  { value: "desc", label: "Descending" },
                ]}
              />
            </div>
          }
        />

        {/* 3. FULL-WIDTH DATA TABLE WITH BULK ACTIONS */}
        <div>
          <DataTable<ApiAttribute>
            title="Attributes List"
            columns={filteredColumns}
            data={paginatedAttributes}
            rowKey="id"
            isLoading={isLoading}
            emptyMessage={
              isFiltered
                ? "No attributes matched your search or filters."
                : "No attributes configured."
            }
            enableSelection={canUpdate}
            selectedIds={selectedIds}
            onSelectionChange={setSelectedIds}
            onToggleStatus={canUpdate ? handleToggleStatus : undefined}
            statusLoadingId={updateAttribute.isPending ? ((updateAttribute.variables as any)?.id ?? null) : null}
            isStatusDisabled={() => !canUpdate}
            enableReorder={!isFiltered && canUpdate && sortBy === "sortOrder"}
            onReorder={handleReorder}
            disabledReorder={reorderAttributes.isPending}
            rowTooltip={!isFiltered && canUpdate && sortBy === "sortOrder" ? "Drag attribute to reorder" : undefined}
            totalItems={filteredAttributes.length}
            currentPage={page}
            pageSize={limit}
            totalPages={totalPages}
            onPageChange={setPage}
            onPageSizeChange={(newLimit) => {
              setLimit(newLimit);
              setPage(1);
            }}
            pageSizeOptions={[10, 20, 50, 100]}
            onSelectAll={(checked) => setSelectedIds(checked ? filteredAttributes.map((a: ApiAttribute) => a.id) : [])}
            renderBulkActions={(selectedIds) => (
              <AdminBulkActionsBar
                selectedCount={selectedIds.length}
                onClear={() => setSelectedIds([])}
                actionType={bulkAction}
                onActionTypeChange={setBulkAction}
                actions={[
                  { value: "activate", label: "Mark active" },
                  { value: "deactivate", label: "Mark inactive" },
                  { value: "delete", label: "Delete selected" },
                ]}
                onApply={() => handleBulkAction(bulkAction)}
                applyLoading={bulkSaving}
                applyDisabled={!bulkAction || selectedIds.length === 0}
              />
            )}
          />
          <div className="border-t border-[#E6E6E6] px-4 py-3 bg-white">
            <Pagination
              page={page}
              totalPages={totalPages}
              onPageChange={setPage}
              alwaysShow={true}
            />
          </div>
        </div>
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
        onSoftDelete={handleSoftDelete}
        onPermanentDelete={handlePermanentDelete}
        isSoftDeleting={deleteAttribute.isPending}
        isPermanentDeleting={permanentDeleteAttribute.isPending}
        permanentDeleteDisabled={!deletingAttribute?.canPermanentDelete}
        permanentDeleteDisabledReason={deletingAttribute?.permanentDeleteBlockReason || undefined}
        softDeleteDescription="Hides this attribute from the active catalog while preserving all past variants and historical associations."
        permanentDeleteDescription="Physically deletes this attribute from the database. Allowed only if zero products, variants, selections, or filter settings reference it."
      />

      {/* BULK DELETE MODAL */}
      <AdminDeleteModal
        open={showBulkDeleteModal}
        onClose={() => setShowBulkDeleteModal(false)}
        itemName={`${selectedIds.length} selected attributes`}
        itemType="Attributes (Bulk)"
        onSoftDelete={handleBulkDelete}
        isSoftDeleting={bulkSaving}
        permanentDeleteDisabled={true}
        permanentDeleteDisabledReason="Bulk deletion only supports archiving. To permanently delete an attribute, delete it individually from the Archive tab."
        softDeleteDescription="Hides the selected attributes from the active catalog while preserving associations."
      />

      {ToastComponent}
    </AdminLayout>
  );
}
