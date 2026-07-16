"use client";

import { AdminInput, AdminRichTextEditor } from "../AdminComponents";
import { Highlight } from "./fields/HighlightsField";

interface HighlightsEditorProps {
  value: Highlight[];
  onChange: (value: Highlight[]) => void;
}

export default function HighlightsEditor({
  value,
  onChange,
}: HighlightsEditorProps) {
  const updateTitle = (index: number, title: string) => {
    const updated = [...value];
    updated[index] = {
      ...updated[index],
      title,
    };
    onChange(updated);
  };

  const updateDescription = (index: number, description: string) => {
    const updated = [...value];
    updated[index] = {
      ...updated[index],
      description,
    };
    onChange(updated);
  };

  const addHighlight = () => {
    onChange([
      ...value,
      {
        title: "",
        description: "",
      },
    ]);
  };

  const removeHighlight = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-semibold text-[#1A1A1A]">
            Highlights
          </h4>

          <p className="text-[12.5px] text-[#6B6B6B]">
            Add translated highlights.
          </p>
        </div>

        <button
          type="button"
          onClick={addHighlight}
          className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium hover:bg-[#F5F5F5]"
        >
          Add Highlight
        </button>
      </div>

      {value.map((highlight, index) => (
        <div
          key={index}
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_auto] gap-4 items-start"
        >
          <div>
            <AdminInput
              label="Title"
              value={highlight.title}
              onChange={(e) => updateTitle(index, e.target.value)}
            />
          </div>

          <div>
            <AdminRichTextEditor
              label="Description"
              value={highlight.description}
              onChange={(html) => updateDescription(index, html)}
            />
          </div>

          <div className="flex items-end h-full">
            <button
              type="button"
              onClick={() => removeHighlight(index)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-sm hover:bg-[#F5F5F5]"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {value.length === 0 && (
        <div className="py-6 text-center text-[13px] text-[#6B6B6B]">
          No highlights added.
        </div>
      )}
    </div>
  );
}