import { Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";

type CurrencyListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
};

type CurrencyInput = {
  name?: string;
  code?: string;
  symbol?: string;
  exchangeRate?: number | string;
  isBase?: boolean | string;
  status?: string;
};

type CurrencyBulkInput = {
  ids?: string[];
  action?: string;
};

type SpreadsheetIssue = { row: number; field: string; message: string };

const CURRENCY_EXPORT_COLUMNS = [
  { key: "name", header: "name" },
  { key: "code", header: "code" },
  { key: "symbol", header: "symbol" },
  { key: "exchangeRate", header: "exchangeRate" },
  { key: "isBase", header: "isBase" },
  { key: "status", header: "status" },
] as const;

function normalizeStatus(value?: string) {
  if (!value) return undefined;
  const status = value.trim().toUpperCase();
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new AppError("Currency status must be ACTIVE or INACTIVE.", 400);
  return status as Status;
}

function normalizeCode(value?: string) {
  const code = value?.trim().toUpperCase();
  if (!code) throw new AppError("Currency code is required.", 400);
  if (code.length !== 3) throw new AppError("Currency code must be 3 letters.", 400);
  return code;
}

function normalizeSymbol(value?: string) {
  const symbol = value?.trim();
  if (!symbol) throw new AppError("Currency symbol is required.", 400);
  return symbol;
}

function normalizeExchangeRate(value?: number | string) {
  if (value === undefined || value === null || value === "") throw new AppError("Exchange rate is required.", 400);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new AppError("Exchange rate must be a non-negative number.", 400);
  return parsed;
}

function normalizeBoolean(value?: boolean | string) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value.trim().toLowerCase() === "true";
  return false;
}

function buildCurrencyWhere(query: CurrencyListQuery) {
  const search = query.search?.trim();
  const status = query.status?.trim().toUpperCase();
  const where: Record<string, unknown> = {};
  if (status) where.status = normalizeStatus(status);
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { code: { contains: search, mode: "insensitive" } },
      { symbol: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

function buildCurrencyOrderBy(query: CurrencyListQuery) {
  const dir = query.sortDir === "asc" ? "asc" : "desc";
  switch (query.sortBy) {
    case "updatedAt":
      return [{ updatedAt: dir }, { code: "asc" }];
    case "name":
      return [{ name: dir }, { code: "asc" }];
    case "status":
      return [{ status: dir }, { code: "asc" }];
    case "exchangeRate":
      return [{ exchangeRate: dir }, { code: "asc" }];
    case "code":
    default:
      return [{ code: dir }];
  }
}

function currencyInclude() {
  return {
    _count: {
      select: {
        countries: true,
        Coupon: true,
        Order: true,
        prices: true,
        Quote: true,
      },
    },
    countries: { select: { id: true, name: true, code: true } },
  };
}

export async function listCurrencies(query: CurrencyListQuery = {}) {
  const { page, limit, skip } = getPagination(query);
  const where = buildCurrencyWhere(query);
  const orderBy = buildCurrencyOrderBy(query);

  const [data, total] = await Promise.all([
    prisma.currency.findMany({
      where,
      skip,
      take: limit,
      orderBy: orderBy as never,
      include: currencyInclude(),
    }),
    prisma.currency.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function listCurrenciesSimple() {
  return prisma.currency.findMany({
    orderBy: [{ code: "asc" }],
    include: { _count: { select: { countries: true, Coupon: true, Order: true, prices: true, Quote: true } } },
  });
}

export async function getCurrencyDashboard() {
  const [total, active, inactive, baseCount, mappedCountries, recentlyUpdated] = await Promise.all([
    prisma.currency.count(),
    prisma.currency.count({ where: { status: "ACTIVE" } }),
    prisma.currency.count({ where: { status: "INACTIVE" } }),
    prisma.currency.count({ where: { isBase: true } }),
    prisma.currency.count({ where: { countries: { some: {} } } }),
    prisma.currency.findMany({ take: 5, orderBy: [{ updatedAt: "desc" }, { code: "asc" }], include: currencyInclude() }),
  ]);

  return { totalCurrencies: total, activeCurrencies: active, inactiveCurrencies: inactive, baseCurrencies: baseCount, mappedCountries, recentlyUpdated };
}

async function assertBaseCurrencyAllowed(id: string | null, isBase: boolean) {
  if (!isBase) return;
  const where: { isBase: true; id?: { not: string } } = { isBase: true };
  if (id) where.id = { not: id };
  const existing = await prisma.currency.findFirst({ where, select: { id: true } });
  if (existing) throw new AppError("Only one base currency can exist at a time.", 400);
}

export async function createCurrency(input: CurrencyInput) {
  const code = normalizeCode(input.code);
  const symbol = normalizeSymbol(input.symbol);
  const exchangeRate = normalizeExchangeRate(input.exchangeRate);
  const status = normalizeStatus(input.status) ?? Status.ACTIVE;
  const isBase = normalizeBoolean(input.isBase);

  const duplicate = await prisma.currency.findUnique({ where: { code } });
  if (duplicate) throw new AppError("Currency code already exists.", 409);
  await assertBaseCurrencyAllowed(null, isBase);

  return prisma.currency.create({
    data: {
      name: input.name?.trim() || code,
      code,
      symbol,
      exchangeRate,
      isBase,
      status,
    },
    include: currencyInclude(),
  });
}

export async function updateCurrency(id: string, input: CurrencyInput) {
  const existing = await prisma.currency.findUnique({ where: { id } });
  if (!existing) throw new AppError("Currency not found.", 404);

  const code = input.code !== undefined ? normalizeCode(input.code) : existing.code;
  const symbol = input.symbol !== undefined ? normalizeSymbol(input.symbol) : existing.symbol;
  const exchangeRate = input.exchangeRate !== undefined ? normalizeExchangeRate(input.exchangeRate) : Number(existing.exchangeRate);
  const status = input.status !== undefined ? normalizeStatus(input.status) : existing.status;
  const isBase = input.isBase !== undefined ? normalizeBoolean(input.isBase) : existing.isBase;

  if (code !== existing.code) {
    const duplicate = await prisma.currency.findFirst({ where: { code, id: { not: id } } });
    if (duplicate) throw new AppError("Currency code already exists.", 409);
  }

  await assertBaseCurrencyAllowed(id, isBase);

  return prisma.currency.update({
    where: { id },
    data: {
      name: input.name?.trim() || existing.name,
      code,
      symbol,
      exchangeRate,
      isBase,
      status,
    },
    include: currencyInclude(),
  });
}

export async function deleteCurrency(id: string) {
  const currency = await prisma.currency.findUnique({
    where: { id },
    include: {
      _count: {
        select: { countries: true, Coupon: true, Order: true, prices: true, Quote: true, defaultCurrencyProducts: true },
      },
    },
  });
  if (!currency) throw new AppError("Currency not found.", 404);

  const blockedRefs =
    currency._count.countries + currency._count.Coupon + currency._count.Order + currency._count.prices + currency._count.Quote + currency._count.defaultCurrencyProducts;
  if (blockedRefs > 0) {
    throw new AppError("Currency cannot be deleted because it is referenced by existing records.", 400);
  }

  if (currency.isBase) throw new AppError("Base currency cannot be deleted.", 400);

  await prisma.currency.delete({ where: { id } });
}

export async function bulkCurrencies(input: CurrencyBulkInput) {
  const ids = Array.isArray(input.ids) ? Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean))) : [];
  if (!ids.length) throw new AppError("Select at least one currency.", 400);

  const action = String(input.action ?? "").toUpperCase();
  if (!["ENABLE", "DISABLE", "DELETE"].includes(action)) throw new AppError("Invalid bulk action.", 400);

  const existing = await prisma.currency.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (existing.length !== ids.length) throw new AppError("One or more currencies were not found.", 404);

  if (action === "DELETE") {
    const results = [];
    for (const id of ids) {
      try {
        await deleteCurrency(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error instanceof Error ? error.message : "Failed to delete currency." });
      }
    }
    return { action, results, summary: { total: ids.length, succeeded: results.filter((r) => r.success).length, failed: results.filter((r) => !r.success).length } };
  }

  const status = action === "ENABLE" ? Status.ACTIVE : Status.INACTIVE;
  await prisma.currency.updateMany({ where: { id: { in: ids } }, data: { status } });
  return { action, affected: ids.length, status };
}

function parseCurrencyRow(raw: Record<string, string>) {
  return {
    name: raw.name?.trim() || "",
    code: raw.code?.trim().toUpperCase() || "",
    symbol: raw.symbol?.trim() || "",
    exchangeRate: raw.exchangeRate?.trim() || "",
    isBase: raw.isBase?.trim().toLowerCase() === "true",
    status: raw.status?.trim().toUpperCase() || "ACTIVE",
  };
}

async function validateRows(rows: Record<string, string>[]) {
  const parsed = rows.map(parseCurrencyRow);
  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seen = new Map<string, number>();
  const codes = new Set<string>();

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (!row.name) issues.push({ row: rowNumber, field: "name", message: "Name is required." });
    if (!row.code || row.code.length !== 3) issues.push({ row: rowNumber, field: "code", message: "Code must be 3 letters." });
    if (!row.symbol) issues.push({ row: rowNumber, field: "symbol", message: "Symbol is required." });
    const rate = Number(row.exchangeRate);
    if (!Number.isFinite(rate) || rate < 0) issues.push({ row: rowNumber, field: "exchangeRate", message: "Exchange rate must be a non-negative number." });
    if (!["ACTIVE", "INACTIVE"].includes(row.status)) issues.push({ row: rowNumber, field: "status", message: "Status must be ACTIVE or INACTIVE." });

    const key = row.code;
    if (seen.has(key)) {
      const message = `Duplicate currency code '${row.code}' found on rows ${seen.get(key)} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "code", message });
      duplicateWarnings.push(message);
    } else {
      seen.set(key, rowNumber);
    }
    codes.add(row.code);
  }

  const existing = await prisma.currency.findMany({ where: { code: { in: Array.from(codes) } }, select: { code: true } });
  const existingCodes = new Set(existing.map((currency) => currency.code));
  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (existingCodes.has(row.code)) {
      duplicateWarnings.push(`Currency '${row.code}' already exists and will be updated during import.`);
    }
    if (row.isBase) {
      const otherBase = await prisma.currency.findFirst({ where: { isBase: true, code: { not: row.code } }, select: { id: true } });
      if (otherBase) issues.push({ row: rowNumber, field: "isBase", message: "Another base currency already exists." });
    }
  }

  return { parsed, issues, duplicateWarnings };
}

export async function exportCurrenciesSpreadsheet(query: CurrencyListQuery & { ids?: string }) {
  const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const where = ids.length ? { id: { in: ids } } : buildCurrencyWhere(query);
  const currencies = await prisma.currency.findMany({ where, orderBy: buildCurrencyOrderBy(query) as never });
  return writeSpreadsheetBuffer(
    currencies.map((currency) => ({
      name: currency.name,
      code: currency.code,
      symbol: currency.symbol,
      exchangeRate: Number(currency.exchangeRate),
      isBase: currency.isBase,
      status: currency.status,
    })),
    "Currencies",
    CURRENCY_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export async function previewCurrencyImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await validateRows(rows);
  return {
    totalRows: preview.parsed.length,
    validRows: Math.max(0, preview.parsed.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.parsed.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
  };
}

export async function importCurrencySpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await validateRows(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };
  await prisma.$transaction(async (tx) => {
    for (const row of preview.parsed) {
      const payload = {
        name: row.name,
        code: row.code,
        symbol: row.symbol,
        exchangeRate: normalizeExchangeRate(row.exchangeRate),
        isBase: row.isBase,
        status: normalizeStatus(row.status) ?? Status.ACTIVE,
      };

      const existing = await tx.currency.findUnique({ where: { code: row.code } });
      if (existing) {
        await tx.currency.update({ where: { id: existing.id }, data: payload });
        summary.updated += 1;
      } else {
        await tx.currency.create({ data: payload });
        summary.created += 1;
      }
    }
  });

  return {
    ...summary,
    report: {
      totalRows: preview.parsed.length,
      validRows: preview.parsed.length,
      invalidRows: 0,
      issues: [],
      duplicateWarnings: preview.duplicateWarnings,
      sampleRows: preview.parsed.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    },
  };
}

export async function syncExchangeRates() {
  return { message: "Connect to OpenExchangeRates or similar API here." };
}
