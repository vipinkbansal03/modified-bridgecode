"use client";

import { Trash2, Plus } from "lucide-react";
import { AdminInput, AdminRichTextEditor } from "../AdminComponents";
export interface PrimaryFeature {
  title: string;
  description: string;
}

interface PrimaryFeaturesEditorProps {
  value?: PrimaryFeature[] | Record<string, unknown> | string[] | string | null;
  onChange: (value: PrimaryFeature[]) => void;
}

export function normalizePrimaryFeatures(raw: unknown): PrimaryFeature[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (!item) return null;
        if (typeof item === "string") {
          return { title: "", description: item.trim() };
        }
        if (typeof item === "object") {
          return {
            title: String((item as { title?: unknown }).title ?? "").trim(),
            description: String(
              (item as { description?: unknown; text?: unknown }).description ??
                (item as { description?: unknown; text?: unknown }).text ??
                "",
            ).trim(),
          };
        }
        return { title: "", description: String(item).trim() };
      })
      .filter((item): item is PrimaryFeature => item !== null);
  }

  if (typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([title, desc]) => ({
      title: title.trim(),
      description: String(desc ?? "").trim(),
    }));
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return normalizePrimaryFeatures(parsed);
    } catch {
      return [{ title: "", description: raw.trim() }];
    }
  }

  return [];
}

export default function PrimaryFeaturesEditor({
  value,
  onChange,
}: PrimaryFeaturesEditorProps) {
  const safeList = normalizePrimaryFeatures(value);

  const updateTitle = (index: number, title: string) => {
    const updated = [...safeList];
    updated[index] = {
      ...(updated[index] || { title: "", description: "" }),
      title,
    };
    onChange(updated);
  };

  const updateDescription = (index: number, description: string) => {
    const updated = [...safeList];
    updated[index] = {
      ...(updated[index] || { title: "", description: "" }),
      description,
    };
    onChange(updated);
  };

  const addFeature = () => {
    onChange([
      ...safeList,
      {
        title: "",
        description: "",
      },
    ]);
  };

  const removeFeature = (index: number) => {
    onChange(safeList.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4.5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[13.5px] font-bold text-[#1A1A1A]">
            Primary Features
          </h4>
          <p className="text-[12px] text-[#6B6B6B]">
            Add translated primary features with title and formatted description.
          </p>
        </div>

        <button
          type="button"
          onClick={addFeature}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] transition cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Feature</span>
        </button>
      </div>

      <div className="space-y-3.5">
        {safeList.map((feature, index) => (
          <div
            key={index}
            className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs space-y-3 transition-all hover:border-[#CBD5E1]"
          >
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2.5">
              <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-[#1E293B]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-[#E31E24]">
                  {index + 1}
                </span>
                Feature #{index + 1}
              </span>

              <button
                type="button"
                onClick={() => removeFeature(index)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <AdminInput
                  label="Title"
                  placeholder="e.g. Clinical Inspection & Verification"
                  value={feature.title}
                  onChange={(e) => updateTitle(index, e.target.value)}
                />
              </div>

              <div>
                <AdminRichTextEditor
                  label="Description"
                  placeholder="Enter translated feature description..."
                  value={feature.description}
                  onChange={(html) => updateDescription(index, html)}
                  compact
                  hideImageUpload
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {safeList.length === 0 && (
        <div className="text-center text-[12.5px] text-[#888] py-4">
          No features added yet. Click &quot;Add Feature&quot; above.
        </div>
      )}
    </div>
  );
}
