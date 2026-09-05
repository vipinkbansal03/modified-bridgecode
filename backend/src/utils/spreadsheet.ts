import fs from "fs";
import * as XLSX from "xlsx";

export type SpreadsheetRow = Record<string, string>;

function normalizeCellValue(value: unknown) {
  if (value === undefined || value === null) return "";
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "boolean") return value ? "TRUE" : "FALSE";
  return String(value).trim();
}

export function readSpreadsheetRows(filePath: string): SpreadsheetRow[] {
  const workbook = XLSX.readFile(filePath, { cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(worksheet, {
    defval: "",
    raw: false,
    blankrows: false,
  });

  return rows.map((row) =>
    Object.entries(row).reduce<SpreadsheetRow>((acc, [key, value]) => {
      const normalizedKey = key.trim();
      if (normalizedKey) acc[normalizedKey] = normalizeCellValue(value);
      return acc;
    }, {}),
  );
}

export function writeSpreadsheetBuffer(
  rows: Record<string, unknown>[],
  sheetName: string,
  columns?: { key: string; header: string }[],
) {
  const workbook = XLSX.utils.book_new();
  const sheetRows = columns
    ? rows.map((row) =>
        columns.reduce<Record<string, unknown>>((acc, column) => {
          acc[column.header] = row[column.key] ?? "";
          return acc;
        }, {}),
      )
    : rows;

  const worksheet = XLSX.utils.json_to_sheet(sheetRows);

  const headerKeys = columns ? columns.map((c) => c.header) : Object.keys(sheetRows[0] || {});
  worksheet["!cols"] = headerKeys.map((header) => {
    let maxLen = header.length;
    for (const r of sheetRows) {
      const val = String((r as Record<string, unknown>)[header] ?? "");
      if (val.length > maxLen) maxLen = val.length;
    }
    return { wch: Math.min(80, Math.max(14, maxLen + 3)) };
  });

  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

export function removeTempFile(filePath: string) {
  try {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  } catch {
    // Best-effort cleanup only.
  }
}
