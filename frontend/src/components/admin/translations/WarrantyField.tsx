"use client";

import { useEffect, useState } from "react";
import WarrantyEditor, { normalizeWarranty } from "./WarrantyEditor";

interface WarrantyFieldProps {
  initialValue?: string[] | string | Record<string, unknown> | null;
  onSave: (value: string[]) => Promise<void>;
}

export default function WarrantyField({
  initialValue,
  onSave,
}: WarrantyFieldProps) {
  const [value, setValue] = useState<string[]>(() =>
    normalizeWarranty(initialValue),
  );

  useEffect(() => {
    setValue(normalizeWarranty(initialValue));
  }, [initialValue]);

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
      <WarrantyEditor
        value={value}
        onChange={setValue}
      />

      <div className="flex justify-end">
        <button
          type="button"
          disabled={saving}
          onClick={handleSave}
          className="rounded-md bg-[#E31E24] px-4 py-2 text-sm font-medium text-white hover:bg-[#C5181E] disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>
    </div>
  );
}