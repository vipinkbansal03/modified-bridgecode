"use client";

import { useEffect, useState } from "react";
import PrimaryFeaturesEditor, {
  PrimaryFeature,
  normalizePrimaryFeatures,
} from "../PrimaryFeaturesEditor";

export type { PrimaryFeature };

interface PrimaryFeaturesFieldProps {
  initialValue?: PrimaryFeature[] | Record<string, unknown> | string[] | string | null;
  onSave: (value: PrimaryFeature[]) => Promise<void>;
}

export default function PrimaryFeaturesField({
  initialValue,
  onSave,
}: PrimaryFeaturesFieldProps) {
  const [value, setValue] = useState<PrimaryFeature[]>(() =>
    normalizePrimaryFeatures(initialValue),
  );

  useEffect(() => {
    setValue(normalizePrimaryFeatures(initialValue));
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
      <PrimaryFeaturesEditor
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