import type { ApiAttributeValue } from "@/types/api.types";

export type AttributeRole = "DROPDOWN" | "X_GRID" | "Y_GRID";

export const ATTRIBUTE_ROLE_LABELS: Record<AttributeRole, string> = {
  DROPDOWN: "Dropdown",
  X_GRID: "X-Grid",
  Y_GRID: "Y-Grid",
};

export function getRoleChangeWarnings(
  values: ApiAttributeValue[],
  nextRole: AttributeRole,
  currentRole: AttributeRole,
): string[] {
  if (nextRole === currentRole) return [];
  const active = values.filter((v) => v.status !== "INACTIVE");
  const warnings: string[] = [];

  if (nextRole === "DROPDOWN") {
    const invalid = active.filter(
      (v) => v.gridRole || v.countryId || v.moq != null || v.tierPrice != null || v.dealerPrice != null,
    );
    if (invalid.length) {
      warnings.push(
        `${invalid.length} value(s) have grid/country/pricing fields that must be cleared for Dropdown.`,
      );
    }
  }

  if (nextRole === "X_GRID") {
    const missing = active.filter((v) => !v.gridRole);
    if (missing.length) {
      warnings.push(`${missing.length} value(s) need a ROW or COLUMN grid role assigned.`);
    }
    const invalid = active.filter((v) => v.countryId || v.moq != null || v.tierPrice != null || v.dealerPrice != null);
    if (invalid.length) {
      warnings.push(`${invalid.length} value(s) have Y-Grid fields that must be removed.`);
    }
  }

  if (nextRole === "Y_GRID") {
    const missingCountry = active.filter((v) => !v.countryId);
    if (missingCountry.length) {
      warnings.push(`${missingCountry.length} value(s) need a country assigned.`);
    }
    const missingPricing = active.filter(
      (v) => v.moq == null && v.tierPrice == null && v.dealerPrice == null,
    );
    if (missingPricing.length) {
      warnings.push(
        `${missingPricing.length} value(s) need at least one of MOQ, Tier Price, or Dealer Price.`,
      );
    }
    const invalid = active.filter((v) => v.gridRole);
    if (invalid.length) {
      warnings.push(`${invalid.length} value(s) have grid roles that must be removed.`);
    }
  }

  return warnings;
}
