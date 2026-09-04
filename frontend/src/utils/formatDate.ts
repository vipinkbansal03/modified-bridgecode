/**
 * Standardized Date Formatting Utilities for Modern Orthodontics Admin Console
 */

export function formatDate(
  dateValue?: string | number | Date | null,
  options?: {
    includeTime?: boolean;
    fallback?: string;
  }
): string {
  if (!dateValue) return options?.fallback ?? "—";
  const d = new Date(dateValue);
  if (isNaN(d.getTime())) return options?.fallback ?? "—";

  const fallback = options?.fallback ?? "—";
  const includeTime = options?.includeTime ?? false;

  try {
    if (includeTime) {
      // e.g. "Aug 25, 2026, 6:28 PM"
      const datePart = d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      const timePart = d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });
      return `${datePart}, ${timePart}`;
    }

    // e.g. "Sep 3, 2026"
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return fallback;
  }
}

export function formatDateTime(
  dateValue?: string | number | Date | null,
  fallback: string = "—"
): string {
  return formatDate(dateValue, { includeTime: true, fallback });
}
