"use client";

import { cn } from "@/utils/cn";

interface CmsSectionToggleProps {
  enabled: boolean;
  onChange: (enabled: boolean) => void;
  label?: string;
  disabled?: boolean;
}

export function CmsSectionToggle({
  enabled,
  onChange,
  label,
  disabled = false,
}: CmsSectionToggleProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) {
          onChange(!enabled);
        }
      }}
      className={cn(
        "inline-flex items-center gap-2 rounded-full px-2.5 py-1 text-[12px] font-medium transition-all",
        disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
        enabled
          ? "bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100"
          : "bg-gray-100 text-gray-600 border border-gray-200 hover:bg-gray-200"
      )}
      title={enabled ? "Section is visible on storefront. Click to hide." : "Section is hidden on storefront. Click to show."}
    >
      <span
        className={cn(
          "relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors",
          enabled ? "bg-emerald-600" : "bg-gray-300"
        )}
      >
        <span
          className={cn(
            "inline-block h-3 w-3 rounded-full bg-white shadow transition-transform",
            enabled ? "translate-x-3.5" : "translate-x-0.5"
          )}
        />
      </span>
      <span>{label || (enabled ? "Enabled" : "Disabled")}</span>
    </button>
  );
}
