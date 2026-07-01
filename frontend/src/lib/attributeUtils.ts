import type { ApiAttributeValue } from "@/types/api.types";

export type AttributeRole = "DROPDOWN" | "X_GRID" | "Y_GRID";
export type AttributeDisplayType = AttributeRole;

export const ATTRIBUTE_DISPLAY_TYPE_LABELS: Record<AttributeDisplayType, string> = {
  DROPDOWN: "Dropdown",
  X_GRID: "Grid X Axis",
  Y_GRID: "Grid Y Axis",
};

export const ATTRIBUTE_ROLE_LABELS = ATTRIBUTE_DISPLAY_TYPE_LABELS;

export function getDisplayTypeChangeWarnings(
  values: ApiAttributeValue[],
  nextRole: AttributeRole,
  currentRole: AttributeRole,
): string[] {
  if (nextRole === currentRole) return [];
  const activeCount = values.filter((v) => v.status !== "INACTIVE").length;
  if (activeCount === 0) return [];
  return [
    `${activeCount} active value(s) will keep working. The storefront renderer will switch automatically after you save the new display type.`,
  ];
}

export const getRoleChangeWarnings = getDisplayTypeChangeWarnings;
