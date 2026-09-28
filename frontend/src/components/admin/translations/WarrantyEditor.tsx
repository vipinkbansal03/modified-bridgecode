import { Trash2, Plus } from "lucide-react";
import { AdminRichTextEditor } from "../AdminComponents";

interface WarrantyEditorProps {
  value?: string[] | string | Record<string, unknown> | null;
  onChange: (value: string[]) => void;
}

export function normalizeWarranty(raw: unknown): string[] {
  if (!raw) return [];

  if (Array.isArray(raw)) {
    return raw
      .map((item) => {
        if (typeof item === "string") return item.trim();
        if (typeof item === "object" && item !== null) {
          return String((item as { text?: unknown; description?: unknown; value?: unknown }).text ??
            (item as { text?: unknown; description?: unknown; value?: unknown }).description ??
            (item as { text?: unknown; description?: unknown; value?: unknown }).value ??
            JSON.stringify(item)).trim();
        }
        return String(item).trim();
      })
      .filter(Boolean);
  }

  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw);
      return normalizeWarranty(parsed);
    } catch {
      return [raw.trim()];
    }
  }

  if (typeof raw === "object") {
    return Object.values(raw as Record<string, unknown>)
      .map((v) => String(v ?? "").trim())
      .filter(Boolean);
  }

  return [];
}

export default function WarrantyEditor({
  value,
  onChange,
}: WarrantyEditorProps) {
  const safeList = normalizeWarranty(value);

  const updateLine = (index: number, html: string) => {
    const updated = [...safeList];
    updated[index] = html;
    onChange(updated);
  };

  const addLine = () => {
    onChange([...safeList, ""]);
  };

  const removeLine = (index: number) => {
    onChange(safeList.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-4.5 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[13.5px] font-bold text-[#1A1A1A]">
            Warranty Information
          </h4>
          <p className="text-[12px] text-[#6B6B6B]">
            Add translated warranty clauses and guidelines.
          </p>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#E0E0E0] bg-white px-3 py-1.5 text-[12px] font-semibold text-[#1A1A1A] hover:bg-[#F5F5F5] transition cursor-pointer"
        >
          <Plus size={13} />
          <span>Add Clause</span>
        </button>
      </div>

      <div className="space-y-3.5">
        {safeList.map((line, index) => (
          <div
            key={index}
            className="rounded-xl border border-[#E2E8F0] bg-white p-4 shadow-2xs space-y-2.5 transition-all hover:border-[#CBD5E1]"
          >
            <div className="flex items-center justify-between border-b border-[#F1F5F9] pb-2">
              <span className="inline-flex items-center gap-2 text-[12.5px] font-bold text-[#1E293B]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-red-50 text-[11px] font-bold text-[#E31E24]">
                  {index + 1}
                </span>
                Warranty Clause #{index + 1}
              </span>

              <button
                type="button"
                onClick={() => removeLine(index)}
                className="inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11.5px] font-medium text-red-600 hover:bg-red-50 transition cursor-pointer"
              >
                <Trash2 size={13} />
                <span>Remove</span>
              </button>
            </div>

            <div>
              <AdminRichTextEditor
                placeholder="Enter translated warranty clause text..."
                value={line}
                onChange={(html) => updateLine(index, html)}
                compact
                hideImageUpload
              />
            </div>
          </div>
        ))}
      </div>

      {safeList.length === 0 && (
        <div className="text-center text-[12.5px] text-[#888] py-4">
          No warranty clauses added yet. Click &quot;Add Clause&quot; above.
        </div>
      )}
    </div>
  );
}