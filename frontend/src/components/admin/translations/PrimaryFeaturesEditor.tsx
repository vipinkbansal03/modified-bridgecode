"use client";

import { AdminInput, AdminRichTextEditor } from "../AdminComponents";
import { PrimaryFeature } from "./fields/PrimaryFeaturesField";

interface PrimaryFeaturesEditorProps {
  value: PrimaryFeature[];
  onChange: (value: PrimaryFeature[]) => void;
}

export default function PrimaryFeaturesEditor({
  value,
  onChange,
}: PrimaryFeaturesEditorProps) {
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

  const addFeature = () => {
    onChange([
      ...value,
      {
        title: "",
        description: "",
      },
    ]);
  };

  const removeFeature = (index: number) => {
    onChange(value.filter((_, i) => i !== index));
  };

  return (
    <div className="rounded-xl border border-[#E6E6E6] bg-[#FAFAFA] p-5 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-[14px] font-semibold text-[#1A1A1A]">
            Primary Features
          </h4>

          <p className="text-[12.5px] text-[#6B6B6B]">
            Add translated primary features.
          </p>
        </div>

        <button
          type="button"
          onClick={addFeature}
          className="rounded-md border border-[#E6E6E6] bg-white px-3 py-2 text-[12.5px] font-medium hover:bg-[#F5F5F5]"
        >
          Add Feature
        </button>
      </div>

      {value.map((feature, index) => (
        <div
          key={index}
          className="grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_auto] gap-4 items-start"
        >
          <div>
            <AdminInput
              label="Title"
              value={feature.title}
              onChange={(e) => updateTitle(index, e.target.value)}
            />
          </div>

          <div>
            <AdminRichTextEditor
              label="Description"
              value={feature.description}
              onChange={(html) => updateDescription(index, html)}
            />
          </div>

          <div className="flex items-end h-full">
            <button
              type="button"
              onClick={() => removeFeature(index)}
              className="rounded-md border border-[#E6E6E6] bg-white px-4 py-2 text-sm hover:bg-[#F5F5F5]"
            >
              Remove
            </button>
          </div>
        </div>
      ))}

      {value.length === 0 && (
        <div className="py-6 text-center text-[13px] text-[#6B6B6B]">
          No primary features added.
        </div>
      )}
    </div>
  );
}
