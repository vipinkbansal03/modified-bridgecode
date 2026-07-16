"use client";

import { useState } from "react";
import TechnicalSpecificationsEditor, {
  TechnicalSpecification,
} from "../TechnicalSpecificationsEditor";

interface TechnicalSpecificationsFieldProps {
  initialValue: TechnicalSpecification[];
  onSave: (value: TechnicalSpecification[]) => Promise<void>;
}

export default function TechnicalSpecificationsField({
  initialValue,
  onSave,
}: TechnicalSpecificationsFieldProps) {
  const [value, setValue] =
    useState<TechnicalSpecification[]>(initialValue);

  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    try {
      setSaving(true);
      await onSave(value);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <TechnicalSpecificationsEditor
        value={value}
        onChange={setValue}
      />

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-md bg-[#E31E24] px-4 py-2 text-sm font-medium text-white hover:bg-[#C5181E] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}