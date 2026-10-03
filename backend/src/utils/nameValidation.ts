/**
 * Utility functions for validating and sanitizing customer and contact names.
 */

export function sanitizeCustomerName(firstName?: string | null, lastName?: string | null): string {
  const cleanFirst = (firstName || "").trim().replace(/^[\s\-_.,]+|[\s\-_.,]+$/g, "").trim();
  const cleanLast = (lastName || "").trim().replace(/^[\s\-_.,]+|[\s\-_.,]+$/g, "").trim();
  const parts = [cleanFirst, cleanLast].filter(Boolean).filter((p) => p !== "-" && p !== "—");
  return parts.join(" ").trim();
}

export function cleanSingleName(name?: string | null): string {
  if (!name) return "";
  return name.trim().replace(/^[\s\-_.,]+|[\s\-_.,]+$/g, "").trim();
}

export function isValidCustomerName(name?: string | null): boolean {
  if (!name || typeof name !== "string") return false;
  const cleaned = cleanSingleName(name);
  if (cleaned.length < 2) return false;
  // Must contain at least 2 alphabetic characters
  const letters = cleaned.replace(/[^a-zA-Z\u00C0-\u024F\u1E00-\u1EFF]/g, "");
  if (letters.length < 2) return false;
  // Cannot be just placeholders or invalid punctuation
  if (/^[\-_.,\s]+$/.test(cleaned)) return false;
  return true;
}
