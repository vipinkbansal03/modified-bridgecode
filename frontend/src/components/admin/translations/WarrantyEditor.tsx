"use client";

import { AdminRichTextEditor } from "../AdminComponents";

interface WarrantyEditorProps {
  value: string[];
  onChange: (value: string[]) => void;
}

export default function WarrantyEditor({
  value,
  onChange,
}: WarrantyEditorProps) {
  const updateLine = (index: number, html: string) => {
    const updated = [...value];
    updated[index] = html;
    onChange(updated);
  };

  const addLine = () => {
    onChange([...value, ""]);
  };

  const removeLine = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-semibold text-[#1A1A1A]">
            Warranty
          </h4>

          <p className="text-[12.5px] text-[#6B6B6B]">
            Add translated warranty lines.
          </p>
        </div>

        <button
          type="button"
          onClick={addLine}
          className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium hover:bg-[#F5F5F5]"
        >
          Add Line
        </button>
      </div>

      {value.map((line, index) => (
        <div key={index} className="space-y-3">
          <AdminRichTextEditor
            label={`Warranty line ${index + 1}`}
            value={line}
            onChange={(html) => updateLine(index, html)}
          />

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() => removeLine(index)}
              className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[13px] hover:bg-[#F2F2F2]"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {value.length === 0 && (
        <div className="text-center text-[13px] text-[#6B6B6B] py-6">
          No warranty lines added.
        </div>
      )}
    </div>
  );
}