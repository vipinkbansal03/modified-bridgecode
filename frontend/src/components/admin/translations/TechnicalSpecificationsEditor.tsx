"use client";

import { AdminInput } from "../AdminComponents";

export interface TechnicalSpecification {
  label: string;
  value: string;
}

interface TechnicalSpecificationsEditorProps {
  value?: unknown;
  onChange: (value: TechnicalSpecification[]) => void;
}

export function normalizeTechnicalSpecifications(
  raw: unknown,
): TechnicalSpecification[] {
  if (!raw) return [];

  // If string, parse JSON if possible
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (!trimmed) return [];
    try {
      const parsed = JSON.parse(trimmed);
      return normalizeTechnicalSpecifications(parsed);
    } catch {
      return [{ label: "Specification", value: trimmed }];
    }
  }

  // If object (and not array)
  if (typeof raw === "object" && !Array.isArray(raw)) {
    const obj = raw as Record<string, unknown>;
    if (Array.isArray(obj.specs)) return normalizeTechnicalSpecifications(obj.specs);
    if (Array.isArray(obj.specifications)) return normalizeTechnicalSpecifications(obj.specifications);
    if (Array.isArray(obj.items)) return normalizeTechnicalSpecifications(obj.items);
    if (Array.isArray(obj.technicalSpecs)) return normalizeTechnicalSpecifications(obj.technicalSpecs);

    return Object.entries(obj).flatMap(([label, val]) => {
      if (val && typeof val === "object") {
        return normalizeTechnicalSpecifications(val);
      }
      return [
        {
          label: label.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
          value: String(val ?? "").trim(),
        },
      ];
    });
  }

  // If array
  if (Array.isArray(raw)) {
    return raw
      .flatMap((item) => {
        if (!item) return [];
        if (typeof item === "string") {
          return [{ label: "Specification", value: item.trim() }];
        }
        if (typeof item === "object") {
          if ("label" in item && "value" in item) {
            const rawVal = (item as { value: unknown }).value;
            return [
              {
                label: String((item as { label: unknown }).label ?? "").trim(),
                value: typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal ?? "").trim(),
              },
            ];
          }
          if ("key" in item && "value" in item) {
            const rawVal = (item as { value: unknown }).value;
            return [
              {
                label: String((item as { key: unknown }).key ?? "").trim(),
                value: typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal ?? "").trim(),
              },
            ];
          }
          if ("name" in item && "value" in item) {
            const rawVal = (item as { value: unknown }).value;
            return [
              {
                label: String((item as { name: unknown }).name ?? "").trim(),
                value: typeof rawVal === "object" ? JSON.stringify(rawVal) : String(rawVal ?? "").trim(),
              },
            ];
          }
          return Object.entries(item).map(([k, v]) => ({
            label: k.replace(/([A-Z])/g, " $1").replace(/_/g, " ").trim(),
            value: typeof v === "object" ? JSON.stringify(v) : String(v ?? "").trim(),
          }));
        }
        return [
          {
            label: "Specification",
            value: String(item).trim(),
          },
        ];
      })
      .filter((item): item is TechnicalSpecification => Boolean(item && (item.label || item.value)));
  }

  return [];
}

export default function TechnicalSpecificationsEditor({
  value,
  onChange,
}: TechnicalSpecificationsEditorProps) {
  const safeList = normalizeTechnicalSpecifications(value);

  const updateItem = (
    index: number,
    field: "label" | "value",
    fieldValue: string,
  ) => {
    const updated = [...safeList];
    updated[index] = {
      ...(updated[index] || { label: "", value: "" }),
      [field]: fieldValue,
    };

    onChange(updated);
  };

  const addSpecification = () => {
    onChange([
      ...safeList,
      {
        label: "",
        value: "",
      },
    ]);
  };

  const removeSpecification = (index: number) => {
    onChange(safeList.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-[13.5px] font-bold text-[#1A1A1A]">
            Technical Specifications Table
          </h4>
          <p className="text-[12px] text-[#666]">
            Add or edit label and value rows for this product.
          </p>
        </div>

        <button
          type="button"
          onClick={addSpecification}
          className="rounded-lg border border-[#E31E24] bg-red-50 px-3 py-1.5 text-[12px] font-semibold text-[#E31E24] hover:bg-red-100 transition"
        >
          + Add Spec Row
        </button>
      </div>

      <div className="space-y-2.5">
        {safeList.map((item, index) => (
          <div
            key={index}
            className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] items-end bg-white p-2.5 rounded-lg border border-[#ECECEC]"
          >
            <AdminInput
              label="Spec Name (e.g. Material)"
              value={item.label}
              onChange={(e) => updateItem(index, "label", e.target.value)}
            />

            <AdminInput
              label="Spec Value (e.g. Medical Grade Stainless Steel)"
              value={item.value}
              onChange={(e) => updateItem(index, "value", e.target.value)}
            />

            <button
              type="button"
              onClick={() => removeSpecification(index)}
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-medium text-red-700 hover:bg-red-100 transition"
            >
              Remove
            </button>
          </div>
        ))}

        {safeList.length === 0 && (
          <div className="text-center text-[12.5px] text-[#888] py-4 bg-white rounded-lg border border-dashed border-[#DDD]">
            No specifications yet. Click &quot;+ Add Spec Row&quot; above.
          </div>
        )}
      </div>
    </div>
  );
}