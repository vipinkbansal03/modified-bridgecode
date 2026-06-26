"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  AdminInput,
  AdminSelect,
  AdminTextarea,
  ConfirmModal,
  StatusBadge,
  useToast,
} from "@/components/admin/AdminComponents";
import { SortableList, toSortOrderPayload } from "@/components/admin/SortableList";
import {
  useCreateAttributeValue,
  useDeleteAttributeValue,
  useReorderAttributeValues,
  useUpdateAttributeValue,
  useAdminCountries,
} from "@/hooks/admin/useAdminHooks";
import { getAdminErrorMessage } from "@/services/adminApi";
import type { ApiAttribute, ApiAttributeValue } from "@/types/api.types";
import type { AttributeRole } from "@/lib/attributeUtils";

const slugify = (value: string) =>
  value.toLowerCase().trim().replace(/[^\w\s-]/g, "").replace(/[\s_-]+/g, "-").replace(/^-+|-+$/g, "");

interface ValueFormState {
  value: string;
  slug: string;
  image: string;
  note: string;
  priceAdjustment: string;
  gridRole: "" | "ROW" | "COLUMN";
  countryId: string;
  moq: string;
  tierPrice: string;
  dealerPrice: string;
  status: "ACTIVE" | "INACTIVE";
}

const emptyForm = (): ValueFormState => ({
  value: "",
  slug: "",
  image: "",
  note: "",
  priceAdjustment: "0",
  gridRole: "",
  countryId: "",
  moq: "",
  tierPrice: "",
  dealerPrice: "",
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
    gridRole: value.gridRole ?? "",
    countryId: value.countryId ?? "",
    moq: value.moq != null ? String(value.moq) : "",
    tierPrice: value.tierPrice != null ? String(value.tierPrice) : "",
    dealerPrice: value.dealerPrice != null ? String(value.dealerPrice) : "",
    status: (value.status as "ACTIVE" | "INACTIVE") ?? "ACTIVE",
  };
}

function toPayload(form: ValueFormState, role: AttributeRole) {
  const base = {
    value: form.value.trim(),
    slug: form.slug.trim() || slugify(form.value),
    image: form.image.trim() || null,
    note: form.note.trim() || null,
    priceAdjustment: Number(form.priceAdjustment || 0),
    status: form.status,
  };

  if (role === "DROPDOWN") return base;

  if (role === "X_GRID") {
    return { ...base, gridRole: form.gridRole || null };
  }

  return {
    ...base,
    countryId: form.countryId || null,
    moq: form.moq !== "" ? Number(form.moq) : null,
    tierPrice: form.tierPrice !== "" ? Number(form.tierPrice) : null,
    dealerPrice: form.dealerPrice !== "" ? Number(form.dealerPrice) : null,
  };
}

function ValueFormFields({
  role,
  form,
  setForm,
  countries,
  gridRoleLocked,
  usedCountryIds = [],
}: {
  role: AttributeRole;
  form: ValueFormState;
  setForm: (next: ValueFormState) => void;
  countries: { id: string; name: string; code: string }[];
  gridRoleLocked?: "ROW" | "COLUMN";
  usedCountryIds?: string[];
}) {
  const update = (patch: Partial<ValueFormState>) => setForm({ ...form, ...patch });

  if (role === "Y_GRID") {
    return (
      <div className="grid gap-3 sm:grid-cols-2">
        <AdminSelect
          label="Country"
          value={form.countryId}
          onChange={(e) => {
            const country = countries.find((c) => c.id === e.target.value);
            update({
              countryId: e.target.value,
              value: country?.name ?? form.value,
              slug: country ? slugify(country.name) : form.slug,
            });
          }}
          options={[
            { value: "", label: "Select country…" },
            ...countries
              .filter((c) => !usedCountryIds.includes(c.id) || c.id === form.countryId)
              .map((c) => ({ value: c.id, label: `${c.name} (${c.code})` })),
          ]}
        />
        <AdminInput label="Display value" value={form.value} onChange={(e) => update({ value: e.target.value, slug: slugify(e.target.value) })} />
        <AdminInput label="MOQ" type="number" value={form.moq} onChange={(e) => update({ moq: e.target.value })} />
        <AdminInput label="Tier Price" type="number" value={form.tierPrice} onChange={(e) => update({ tierPrice: e.target.value })} />
        <AdminInput label="Dealer Price" type="number" value={form.dealerPrice} onChange={(e) => update({ dealerPrice: e.target.value })} />
        <AdminInput label="Price adjustment" type="number" value={form.priceAdjustment} onChange={(e) => update({ priceAdjustment: e.target.value })} />
        <AdminSelect
          label="Status"
          value={form.status}
          onChange={(e) => update({ status: e.target.value as "ACTIVE" | "INACTIVE" })}
          options={[
            { value: "ACTIVE", label: "Active" },
            { value: "INACTIVE", label: "Inactive" },
          ]}
        />
        <div className="sm:col-span-2">
          <AdminTextarea label="Note" value={form.note} onChange={(e) => update({ note: e.target.value })} rows={2} />
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {role === "X_GRID" && (
        <AdminSelect
          label="Grid role"
          value={gridRoleLocked ?? form.gridRole}
          onChange={(e) => update({ gridRole: e.target.value as "ROW" | "COLUMN" })}
          disabled={!!gridRoleLocked}
          options={[
            { value: "", label: "Select ROW or COLUMN…" },
            { value: "ROW", label: "Row" },
            { value: "COLUMN", label: "Column" },
          ]}
        />
      )}
      <AdminInput label="Value" value={form.value} onChange={(e) => update({ value: e.target.value, slug: slugify(e.target.value) })} />
      <AdminInput label="Slug" value={form.slug} onChange={(e) => update({ slug: e.target.value })} />
      <AdminInput label="Image URL" value={form.image} onChange={(e) => update({ image: e.target.value })} />
      <AdminInput label="Price adjustment" type="number" value={form.priceAdjustment} onChange={(e) => update({ priceAdjustment: e.target.value })} />
      <AdminSelect
        label="Status"
        value={form.status}
        onChange={(e) => update({ status: e.target.value as "ACTIVE" | "INACTIVE" })}
        options={[
          { value: "ACTIVE", label: "Active" },
          { value: "INACTIVE", label: "Inactive" },
        ]}
      />
      <div className="sm:col-span-2">
        <AdminTextarea label="Note" value={form.note} onChange={(e) => update({ note: e.target.value })} rows={2} />
      </div>
    </div>
  );
}

function ValueRowSummary({ value, role }: { value: ApiAttributeValue; role: AttributeRole }) {
  if (role === "Y_GRID") {
    return (
      <div className="flex flex-wrap items-center gap-3 text-[13px]">
        <span className="font-medium text-[#1A1A1A]">{value.country?.name ?? value.value}</span>
        {value.moq != null && <span className="text-[#6B6B6B]">MOQ: {value.moq}</span>}
        {value.tierPrice != null && <span className="text-[#6B6B6B]">Tier: {value.tierPrice}</span>}
        {value.dealerPrice != null && <span className="text-[#6B6B6B]">Dealer: {value.dealerPrice}</span>}
        {Number(value.priceAdjustment) !== 0 && <span className="text-[#6B6B6B]">Adj: {value.priceAdjustment}</span>}
        <StatusBadge status={value.status ?? "ACTIVE"} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-[13px]">
      <span className="font-medium text-[#1A1A1A]">{value.value}</span>
      <span className="font-mono text-[11px] text-[#9A9A9A]">{value.slug}</span>
      {role === "X_GRID" && value.gridRole && (
        <span className="rounded bg-violet-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-violet-700">{value.gridRole}</span>
      )}
      {Number(value.priceAdjustment) !== 0 && <span className="text-[#6B6B6B]">+{value.priceAdjustment}</span>}
      <StatusBadge status={value.status ?? "ACTIVE"} />
    </div>
  );
}

function ValueListSection({
  title,
  attribute,
  values,
  gridRole,
}: {
  title: string;
  attribute: ApiAttribute;
  values: ApiAttributeValue[];
  gridRole?: "ROW" | "COLUMN";
}) {
  const { showToast, ToastComponent } = useToast();
  const createValue = useCreateAttributeValue();
  const updateValue = useUpdateAttributeValue();
  const deleteValue = useDeleteAttributeValue();
  const reorderValues = useReorderAttributeValues();
  const { data: countries = [] } = useAdminCountries();

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ValueFormState>(emptyForm());
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const activeValues = useMemo(
    () => values.filter((v) => v.status !== "INACTIVE").sort((a, b) => a.sortOrder - b.sortOrder),
    [values],
  );

  const usedCountryIds = useMemo(
    () => activeValues.map((v) => v.countryId).filter((id): id is string => !!id),
    [activeValues],
  );

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
    const base = emptyForm();
    if (gridRole) base.gridRole = gridRole;
    setForm(base);
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
      const payload = toPayload(form, attribute.role);
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

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      await deleteValue.mutateAsync({ attributeId: attribute.id, valueId: deletingId });
      showToast("Value removed.");
    } catch (error) {
      showToast(getAdminErrorMessage(error, "Failed to delete value."), "error");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#1A1A1A]">{title}</h3>
        <button type="button" onClick={openCreate} className="flex items-center gap-1 rounded-md border border-[#E6E6E6] bg-white px-3 py-1.5 text-[12px] font-medium text-[#1A1A1A] hover:border-[#E31E24]">
          <Plus size={13} /> Add
        </button>
      </div>

      {activeValues.length === 0 ? (
        <p className="py-6 text-center text-[12.5px] text-[#9A9A9A]">No values yet.</p>
      ) : (
        <SortableList
          items={activeValues}
          onReorder={persistReorder}
          renderItem={(value) => (
            <div className="flex items-center justify-between gap-3">
              <ValueRowSummary value={value} role={attribute.role} />
              <div className="flex shrink-0 gap-1">
                <button type="button" onClick={() => openEdit(value)} className="rounded p-1.5 text-[#6B6B6B] hover:bg-[#F0F0F0]"><Pencil size={14} /></button>
                <button type="button" onClick={() => setDeletingId(value.id)} className="rounded p-1.5 text-red-500 hover:bg-red-50"><Trash2 size={14} /></button>
              </div>
            </div>
          )}
        />
      )}

      {showForm && (
        <div className="mt-4 rounded-lg border border-[#E6E6E6] bg-white p-4">
          <h4 className="mb-3 text-[13px] font-semibold text-[#1A1A1A]">{editingId ? "Edit value" : "New value"}</h4>
          <ValueFormFields
            role={attribute.role}
            form={form}
            setForm={setForm}
            countries={countries}
            gridRoleLocked={gridRole}
            usedCountryIds={attribute.role === "Y_GRID" ? usedCountryIds.filter((cid) => cid !== form.countryId) : []}
          />
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={handleSave} className="rounded-md bg-[#E31E24] px-4 py-2 text-[13px] font-semibold text-white hover:bg-[#B5151B]">
              {editingId ? "Save changes" : "Add value"}
            </button>
            <button type="button" onClick={() => { setShowForm(false); setEditingId(null); }} className="rounded-md border border-[#E6E6E6] px-4 py-2 text-[13px] text-[#6B6B6B]">
              Cancel
            </button>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deletingId}
        title="Remove value?"
        message="This will deactivate the value."
        onConfirm={handleDelete}
        onCancel={() => setDeletingId(null)}
      />
      {ToastComponent}
    </div>
  );
}

export function AttributeValueEditors({ attribute }: { attribute: ApiAttribute }) {
  const values = attribute.values ?? [];

  if (attribute.role === "X_GRID") {
    const unassigned = values.filter((v) => v.status !== "INACTIVE" && !v.gridRole);
    return (
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-2">
          <ValueListSection title="Row values" attribute={attribute} values={values.filter((v) => v.gridRole === "ROW")} gridRole="ROW" />
          <ValueListSection title="Column values" attribute={attribute} values={values.filter((v) => v.gridRole === "COLUMN")} gridRole="COLUMN" />
        </div>
        {unassigned.length > 0 && (
          <ValueListSection title="Unassigned (needs ROW or COLUMN)" attribute={attribute} values={unassigned} />
        )}
      </div>
    );
  }

  if (attribute.role === "Y_GRID") {
    return <ValueListSection title="Country pricing rows" attribute={attribute} values={values} />;
  }

  return <ValueListSection title="Dropdown values" attribute={attribute} values={values} />;
}
