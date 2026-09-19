/**
 * Formats product attribute labels according to domain standard naming rules:
 * - "Packing Unit" / "Package Unit" -> "Packing Type"
 * - "Wire Size" -> "Cross Section"
 */
export function formatAttributeLabel(name?: string | null): string {
  if (!name) return "";
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  if (
    lower === "packing unit" ||
    lower === "package unit" ||
    lower === "packaging unit" ||
    lower === "packing-unit" ||
    lower === "package-unit"
  ) {
    return "Packing Type";
  }

  if (
    lower === "wire size" ||
    lower === "wiresize" ||
    lower === "wire-size" ||
    lower === "wire_size"
  ) {
    return "Cross Section";
  }

  if (lower === "arch") {
    return "Upper/Lower";
  }

  return trimmed;
}
