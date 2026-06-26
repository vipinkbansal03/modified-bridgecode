import type { AttributeRole } from "@/lib/attributeUtils";
import { cn } from "@/utils/cn";

const STYLES: Record<AttributeRole, string> = {
  DROPDOWN: "bg-blue-50 text-blue-700 border-blue-200",
  X_GRID: "bg-violet-50 text-violet-700 border-violet-200",
  Y_GRID: "bg-amber-50 text-amber-800 border-amber-200",
};

const LABELS: Record<AttributeRole, string> = {
  DROPDOWN: "Dropdown",
  X_GRID: "X-Grid",
  Y_GRID: "Y-Grid",
};

export function AttributeRoleBadge({ role }: { role: AttributeRole }) {
  return (
    <span className={cn("inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide", STYLES[role])}>
      {LABELS[role]}
    </span>
  );
}
