"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, RotateCcw, AlertTriangle } from "lucide-react";
import {
  AdminInput,
  AdminTextarea,
  ConfirmModal,
  StatusBadge,
  useToast,
  LoadingButton,
} from "@/components/admin/AdminComponents";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import {
  useCreateAttributeValue,
  useDeleteAttributeValue,
  usePermanentDeleteAttributeValue,
  useReorderAttributeValues,
  useUpdateAttributeValue,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import type { ApiAttribute, ApiAttributeValue } from "@/types/api.types";

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

interface ValueFormState {
  value: string;
  slug: string;
  image: string;
  note: string;
  priceAdjustment: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm = (): ValueFormState => ({
  value: "",
  slug: "",
  image: "",
  note: "",
  priceAdjustment: "0",
  status: "ACTIVE",
});

function toForm(value?: ApiAttributeValue): ValueFormState {
  if (!value) return emptyForm();
  return {
    value: value.value,
    slug: value.slug,
    image: value.image ?? "",
    note: value.note ?? "",
    priceAdjustment: String(value.priceAdjustment ?? 0),
    status: (value.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
  };
}

function ValueFormFields({
  form,
  setForm,
}: {
  form: ValueFormState;
  setForm: (next: ValueFormState) => void;
}) {
  const update = (patch: Partial<ValueFormState>) => setForm({ ...form, ...patch });

  return (
    <div className="grid w-full gap-3 sm:grid-cols-2">
      <AdminInput
        label="Value"
        value={form.value}
        onChange={(e) => update({ value: e.target.value, slug: slugify(e.target.value) })}
      />
      <AdminInput label="Slug" value={form.slug} onChange={(e) => update({ slug: e.target.value })} />
      <AdminInput label="Image URL" value={form.image} onChange={(e) => update({ image: e.target.value })} />
      <AdminInput
        label="Price adjustment"
        type="number"
        value={form.priceAdjustment}
        onChange={(e) => update({ priceAdjustment: e.target.value })}
      />
      <div className="sm:col-span-2">
        <AdminTextarea label="Note" value={form.note} onChange={(e) => update({ note: e.target.value })} rows={2} />
      </div>
      <div className="sm:col-span-2">
        <label className="mb-1 block text-[12px] font-medium text-[#555]">Status</label>
        <select
          value={form.status}
          onChange={(e) => update({ status: e.target.value as "ACTIVE" | "INACTIVE" })}
          className="w-full rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] text-[#1A1A1A] outline-none focus:border-[#E31E24]"
        >
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </select>
      </div>
    </div>
  );
}

function ValueRowSummary({ value }: { value: ApiAttributeValue }) {
  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3 text-[13px]">
      <span className="font-medium text-[#1A1A1A]">{value.value}</span>
      <span className="font-mono text-[11px] text-[#9A9A9A]">{value.slug}</span>
      {Number(value.priceAdjustment) !== 0 && <span className="text-[#6B6B6B]">+{value.priceAdjustment}</span>}
      <StatusBadge status={value.status ?? "ACTIVE"} />
    </div>
  );
}

function ValueListSection({
  title,
  attribute,
  values,
}: {
  title: string;
  attribute: ApiAttribute;
  values: ApiAttributeValue[];
}) {
  const { showToast, ToastComponent } = useToast();
  const createValue = useCreateAttributeValue();
  const updateValue = useUpdateAttributeValue();
  const deleteValue = useDeleteAttributeValue();
  const permanentDeleteValue = usePermanentDeleteAttributeValue();
  const reorderValues = useReorderAttributeValues();

  const [activeTab, setActiveTab] = useState<"ALL" | "ACTIVE" | "INACTIVE">("ALL");
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ValueFormState>(emptyForm());
  const [targetValue, setTargetValue] = useState<ApiAttributeValue | null>(null);
  const [deleteMode, setDeleteMode] = useState<"deactivate" | "permanent">("deactivate");

  const sortedValues = useMemo(
    () => [...values].sort((left, right) => left.sortOrder - right.sortOrder),
    [values],
  );

  const activeValues = useMemo(
    () => sortedValues.filter((v) => v.status !== "INACTIVE"),
    [sortedValues],
  );

  const inactiveValues = useMemo(
    () => sortedValues.filter((v) => v.status === "INACTIVE"),
    [sortedValues],
  );

  const displayedValues = useMemo(() => {
    if (activeTab === "ACTIVE") return activeValues;
    if (activeTab === "INACTIVE") return inactiveValues;
    return sortedValues;
  }, [activeTab, sortedValues, activeValues, inactiveValues]);

  const persistReorder = async (next: ApiAttributeValue[]) => {
    try {
      await reorderValues.mutateAsync({
        attributeId: attribute.id,
        items: toSortOrderPayload(next),
      });
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reorder values."), "error");
    }
  };

  const openCreate = () => {
    setForm(emptyForm());
    setEditingId(null);
    setShowForm(true);
  };

  const openEdit = (value: ApiAttributeValue) => {
    setForm(toForm(value));
    setEditingId(value.id);
    setShowForm(true);
  };

  const handleSave = async () => {
    try {
      const payload = {
        value: form.value.trim(),
        slug: form.slug.trim() || slugify(form.value),
        image: form.image.trim() || null,
        note: form.note.trim() || null,
        priceAdjustment: Number(form.priceAdjustment || 0),
        status: form.status,
      };

      if (editingId) {
        await updateValue.mutateAsync({ attributeId: attribute.id, valueId: editingId, ...payload });
        showToast("Value updated.");
      } else {
        await createValue.mutateAsync({ attributeId: attribute.id, ...payload });
        showToast("Value added.");
      }

      setShowForm(false);
      setEditingId(null);
      setForm(emptyForm());
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to save value."), "error");
    }
  };

  const handleReactivate = async (val: ApiAttributeValue) => {
    try {
      await updateValue.mutateAsync({ attributeId: attribute.id, valueId: val.id, status: "ACTIVE" });
      showToast(`Value "${val.value}" reactivated.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to reactivate value."), "error");
    }
  };

  const handleDeactivate = async () => {
    if (!targetValue) return;
    try {
      await deleteValue.mutateAsync({ attributeId: attribute.id, valueId: targetValue.id });
      showToast(`Value "${targetValue.value}" deactivated.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to deactivate value."), "error");
    } finally {
      setTargetValue(null);
    }
  };

  const handlePermanentDelete = async () => {
    if (!targetValue) return;
    try {
      await permanentDeleteValue.mutateAsync({ attributeId: attribute.id, valueId: targetValue.id });
      showToast(`Value "${targetValue.value}" permanently deleted.`);
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to permanently delete value."), "error");
    } finally {
      setTargetValue(null);
    }
  };

  return (
    <div className="w-full rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-3">
          <h3 className="text-[13px] font-semibold text-[#1A1A1A]">{title}</h3>
          {/* Sub-filter tabs */}
          <div className="flex items-center rounded-lg border border-[#E6E6E6] bg-[#F0F0F0] p-0.5 text-[11.5px]">
            <button
              type="button"
              onClick={() => setActiveTab("ALL")}
              className={`rounded-md px-2.5 py-0.5 font-medium transition-colors ${
                activeTab === "ALL" ? "bg-white text-[#1A1A1A] shadow-sm" : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              All ({sortedValues.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("ACTIVE")}
              className={`rounded-md px-2.5 py-0.5 font-medium transition-colors ${
                activeTab === "ACTIVE" ? "bg-white text-green-700 shadow-sm" : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              Active ({activeValues.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("INACTIVE")}
              className={`rounded-md px-2.5 py-0.5 font-medium transition-colors ${
                activeTab === "INACTIVE" ? "bg-white text-gray-700 shadow-sm" : "text-[#6B6B6B] hover:text-[#1A1A1A]"
              }`}
            >
              Inactive ({inactiveValues.length})
            </button>
          </div>
        </div>

        <button
          type="button"
          onClick={openCreate}
          className="flex items-center gap-1 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1A1A] hover:border-[#E31E24]"
        >
          <Plus size={13} /> Add
        </button>
      </div>

      {displayedValues.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-[#9A9A9A]">
          {activeTab === "INACTIVE" ? "No inactive values." : "No values yet."}
        </p>
      ) : activeTab === "ACTIVE" || activeTab === "ALL" ? (
        <SortableList
          className="w-full min-w-0"
          rowWidthClassName="w-full min-w-0"
          contentClassName="flex-1 min-w-0 py-2 pr-3"
          items={displayedValues}
          onReorder={persistReorder}
          renderItem={(value) => (
            <div className="flex w-full min-w-0 items-center justify-between gap-3">
              <ValueRowSummary value={value} />
              <div className="flex shrink-0 items-center gap-1">
                {value.status === "INACTIVE" ? (
                  <button
                    type="button"
                    title="Reactivate value"
                    onClick={() => handleReactivate(value)}
                    className="rounded p-1.5 text-green-600 hover:bg-green-50"
                  >
                    <RotateCcw size={14} />
                  </button>
                ) : null}
                <button
                  type="button"
                  title="Edit value"
                  onClick={() => openEdit(value)}
                  className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title={value.status === "INACTIVE" ? "Delete value" : "Deactivate value"}
                  onClick={() => {
                    setTargetValue(value);
                    setDeleteMode(value.status === "INACTIVE" ? "permanent" : "deactivate");
                  }}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          )}
        />
      ) : (
        <div className="divide-y divide-[#EAEAEA] rounded-lg border border-[#E6E6E6] bg-white">
          {displayedValues.map((value) => (
            <div key={value.id} className="flex w-full min-w-0 items-center justify-between p-3">
              <ValueRowSummary value={value} />
              <div className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  title="Reactivate value"
                  onClick={() => handleReactivate(value)}
                  className="rounded p-1.5 text-green-600 hover:bg-green-50"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  title="Edit value"
                  onClick={() => openEdit(value)}
                  className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0]"
                >
                  <Pencil size={14} />
                </button>
                <button
                  type="button"
                  title="Delete permanently"
                  onClick={() => {
                    setTargetValue(value);
                    setDeleteMode("permanent");
                  }}
                  className="rounded p-1.5 text-red-500 hover:bg-red-50"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="mt-4 w-full rounded-lg border border-[#E6E6E6] bg-white p-4">
          <h4 className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">{editingId ? "Edit value" : "New value"}</h4>
          <ValueFormFields form={form} setForm={setForm} />
          <div className="mt-4 flex gap-2">
            <LoadingButton
              type="button"
              onClick={handleSave}
              loading={createValue.isPending || updateValue.isPending}
              loadingText={editingId ? "Saving..." : "Adding..."}
              className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]"
            >
              {editingId ? "Update" : "Add value"}
            </LoadingButton>
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
              }}
              className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* VALUE DELETE / DEACTIVATE MODAL */}
      {targetValue && (
        <ConfirmModal
          open={Boolean(targetValue)}
          title={
            deleteMode === "permanent"
              ? targetValue.canPermanentDelete === false
                ? `Cannot Delete "${targetValue.value}"`
                : `Permanently Delete "${targetValue.value}"?`
              : `Deactivate "${targetValue.value}"?`
          }
          message={
            deleteMode === "permanent"
              ? targetValue.canPermanentDelete === false
                ? targetValue.permanentDeleteBlockReason || "This attribute value is referenced by products or variants and cannot be permanently deleted."
                : "This attribute value has zero references across products and variants. Permanent deletion will physically remove it from the database."
              : "Deactivating this value will hide it from new variant configurations while preserving existing historical records."
          }
          danger={deleteMode === "permanent" && targetValue.canPermanentDelete !== false}
          confirmText={
            deleteMode === "permanent"
              ? targetValue.canPermanentDelete === false
                ? "Understood"
                : "Permanently Delete"
              : "Deactivate Value"
          }
          onConfirm={
            deleteMode === "permanent"
              ? targetValue.canPermanentDelete === false
                ? () => setTargetValue(null)
                : handlePermanentDelete
              : handleDeactivate
          }
          onCancel={() => setTargetValue(null)}
          isLoading={deleteValue.isPending || permanentDeleteValue.isPending}
        />
      )}
      {ToastComponent}
    </div>
  );
}

export function AttributeValueEditors({ attribute }: { attribute: ApiAttribute }) {
  const values = attribute.values ?? [];
  const displayTypeLabel =
    attribute.role === "DROPDOWN" ? "Dropdown" : attribute.role === "X_GRID" ? "Grid X Axis" : "Grid Y Axis";

  return (
    <ValueListSection
      title={`${displayTypeLabel} values`}
      attribute={attribute}
      values={values}
    />
  );
}
