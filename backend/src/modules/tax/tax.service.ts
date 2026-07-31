import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { logger } from "../../config/logger";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";
import { validateIdentifier, clearTaxValidationCache as clearIdentifierValidationCache } from "./taxValidation.service";

const TAX_RULE_TYPES = ["CGST", "SGST", "VAT", "SALES_TAX"] as const;
const TAX_MODES = ["EXCLUSIVE", "INCLUSIVE", "EXEMPT"] as const;
const STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;
const SORTABLE_FIELDS = ["updatedAt", "createdAt", "name", "type", "percentage", "sortOrder", "country"] as const;

type TaxRuleInput = {
  name?: string;
  type?: string;
  taxMode?: string;
  percentage?: number | string;
  countryId?: string;
  countryIds?: string[];
  status?: string;
  sortOrder?: number | string;
  productIds?: string[];
};

type TaxListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  countryId?: string;
  status?: string;
  type?: string;
  sortBy?: string;
  sortDir?: string;
};

type TaxBulkInput = {
  ids?: string[];
  action?: string;
};

type TaxPreviewInput = {
  countryId?: string;
  subtotal?: number | string;
};

type TaxSpreadsheetRow = {
  name: string;
  type: string;
  percentage: number | string;
  countryCode: string;
  status: string;
  sortOrder: number | string;
};

type SpreadsheetIssue = {
  row: number;
  field: string;
  message: string;
};

function taxRuleClient() {
  return (prisma as unknown as {
    taxRule: {
      findMany: (args?: unknown) => Promise<any[]>;
      findFirst: (args?: unknown) => Promise<any | null>;
      findUnique: (args?: unknown) => Promise<any | null>;
      create: (args: unknown) => Promise<any>;
      update: (args: unknown) => Promise<any>;
      delete: (args: unknown) => Promise<any>;
      updateMany: (args: unknown) => Promise<any>;
      deleteMany: (args: unknown) => Promise<any>;
      count: (args?: unknown) => Promise<number>;
      aggregate: (args?: unknown) => Promise<any>;
    };
  }).taxRule;
}

function includeCountryAndProducts() {
  return {
    country: { include: { currency: true } },
    countries: { include: { country: { include: { currency: true } } } },
    products: { select: { id: true, title: true } },
  };
}

function formatTaxRuleResponse(rule: any) {
  if (!rule) return rule;
  const countryIds = rule.countries?.length > 0
    ? rule.countries.map((c: any) => c.countryId)
    : (rule.countryId ? [rule.countryId] : []);
  return {
    ...rule,
    countryIds,
  };
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function parsePercentage(value: number | string | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100) {
    throw new AppError("Tax percentage must be between 0 and 100.", 400);
  }
  return parsed;
}

function parseSortOrder(value: number | string | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new AppError("Sort order must be a non-negative integer.", 400);
  }
  return parsed;
}

function normalizeType(value: string | undefined) {
  if (!value) return undefined;
  const type = value.toUpperCase();
  if (!TAX_RULE_TYPES.includes(type as never)) throw new AppError("Invalid tax rule type.", 400);
  return type;
}

function normalizeTaxMode(value: string | undefined) {
  if (!value) return "EXCLUSIVE";
  const mode = value.toUpperCase();
  if (!TAX_MODES.includes(mode as never)) throw new AppError("Invalid tax mode.", 400);
  return mode;
}

function normalizeStatus(value: string | undefined) {
  if (!value) return undefined;
  const status = value.toUpperCase();
  if (!STATUS_VALUES.includes(status as never)) throw new AppError("Invalid tax rule status.", 400);
  return status;
}

export { clearIdentifierValidationCache as clearVatValidationCache };

function normalizeSortBy(value?: string) {
  if (!value) return "updatedAt";
  const normalized = value.trim();
  return (SORTABLE_FIELDS.includes(normalized as never) ? normalized : "updatedAt") as (typeof SORTABLE_FIELDS)[number];
}

function taxRuleOrderBy(query: TaxListQuery) {
  const dir = query.sortDir === "asc" ? "asc" : "desc";
  switch (normalizeSortBy(query.sortBy)) {
    case "createdAt":
      return [{ createdAt: dir }, { sortOrder: "asc" }, { name: "asc" }];
    case "name":
      return [{ name: dir }, { sortOrder: "asc" }];
    case "type":
      return [{ type: dir }, { sortOrder: "asc" }, { name: "asc" }];
    case "percentage":
      return [{ percentage: dir }, { sortOrder: "asc" }];
    case "sortOrder":
      return [{ sortOrder: dir }, { name: "asc" }];
    case "country":
      return [{ createdAt: dir }, { sortOrder: "asc" }, { name: "asc" }]; // Prisma cannot natively order by m-to-n relations easily
    case "updatedAt":
    default:
      return [{ updatedAt: dir }, { sortOrder: "asc" }, { name: "asc" }];
  }
}

function buildWhere(query: TaxListQuery) {
  const where: Record<string, unknown> = {};
  const search = query.search?.trim();
  if (query.countryId) {
    const ids = query.countryId.split(",").map((s) => s.trim()).filter(Boolean);
    if (ids.length > 1) {
      where.OR = [
        { countryId: { in: ids } },
        { countries: { some: { countryId: { in: ids } } } },
      ];
    } else if (ids.length === 1) {
      where.OR = [
        { countryId: ids[0] },
        { countries: { some: { countryId: ids[0] } } },
      ];
    }
  }
  if (query.status) where.status = normalizeStatus(query.status);
  if (query.type) where.type = normalizeType(query.type);

  if (search) {
    const searchUpper = search.toUpperCase();
    const matchedTypes = TAX_RULE_TYPES.filter((t) => t.includes(searchUpper));

    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      ...matchedTypes.map((t) => ({ type: t })),
      { country: { name: { contains: search, mode: "insensitive" } } },
      { country: { code: { contains: search, mode: "insensitive" } } },
    ];
  }

  return where;
}

export async function listTaxRules(query: TaxListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = buildWhere(query);
  const orderBy = taxRuleOrderBy(query);

  const [data, total] = await Promise.all([
    taxRuleClient().findMany({
      where,
      skip,
      take: limit,
      include: {
        countries: {
          include: { currency: true },
        },
        products: { select: { id: true, title: true } },
      },
      orderBy: orderBy as never,
    }),
    taxRuleClient().count({ where }),
  ]);

  return { data: data.map(formatTaxRuleResponse), total, page, limit };
}

async function assertCountry(countryId: string) {
  if (!countryId) return;
  await assertCountries([countryId]);
}

async function assertCountries(countryIds: string[]) {
  if (!countryIds || countryIds.length === 0) return;
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true, status: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries not found.", 404);
  const inactive = countries.find((c) => c.status !== "ACTIVE");
  if (inactive) throw new AppError(`Country ID ${inactive.id} is not active.`, 400);
}

async function assertUniqueName(name: string, excludeId?: string) {
  const existing = await prisma.taxRule.findFirst({
    where: {
      name,
      id: excludeId ? { not: excludeId } : undefined,
    },
  });
  if (existing) throw new AppError(`A tax rule with name "${name}" already exists.`, 409);
}

export async function getTaxDashboard() {
  const [summary, recentRules, countryCount, activeByType] = await Promise.all([
    taxRuleClient().aggregate({
      _count: { id: true },
    }),
    taxRuleClient().findMany({
      take: 5,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: includeCountryAndProducts(),
    }),
    prisma.country.count({ where: { status: "ACTIVE" } }),
    taxRuleClient().findMany({
      where: { status: "ACTIVE" },
      select: { type: true },
    }),
  ]);

  const typeCounts = activeByType.reduce<Record<string, number>>((acc, rule) => {
    acc[rule.type] = (acc[rule.type] ?? 0) + 1;
    return acc;
  }, {});

  const totals = await Promise.all([
    taxRuleClient().count({ where: { status: "ACTIVE" } }),
    taxRuleClient().count({ where: { status: "INACTIVE" } }),
  ]);

  return {
    totalRules: summary._count.id ?? 0,
    activeRules: totals[0],
    inactiveRules: totals[1],
    activeCountries: countryCount,
    byType: {
      cgst: typeCounts.CGST ?? 0,
      sgst: typeCounts.SGST ?? 0,
      vat: typeCounts.VAT ?? 0,
      salesTax: typeCounts.SALES_TAX ?? 0,
    },
    recentlyUpdatedRules: recentRules,
  };
}

export async function previewTaxImpact(input: TaxPreviewInput) {
  const countryId = input.countryId?.trim();
  if (!countryId) throw new AppError("Country is required for preview.", 400);
  const subtotal = Number(input.subtotal ?? 0);
  if (!Number.isFinite(subtotal) || subtotal < 0) throw new AppError("Subtotal must be a non-negative number.", 400);

  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { id: true, name: true, code: true, currency: { select: { id: true, code: true, symbol: true } } },
  });
  if (!country) throw new AppError("Country not found.", 404);

  const activeRules = await taxRuleClient().findMany({
    where: { countries: { some: { id: countryId } }, status: "ACTIVE" },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  let runningTotal = roundMoney(subtotal);
  let totalTax = 0;

  const appliedRules = activeRules.map((rule) => {
    const rate = Number(rule.percentage);
    const mode = (rule.taxMode as string) || "EXCLUSIVE";

    let taxAmount = 0;
    if (mode === "EXEMPT") {
      taxAmount = 0;
    } else if (mode === "INCLUSIVE") {
      taxAmount = roundMoney(subtotal - subtotal / (1 + rate / 100));
    } else {
      taxAmount = roundMoney(subtotal * (rate / 100));
    }

    totalTax = roundMoney(totalTax + taxAmount);
    runningTotal = mode === "INCLUSIVE" ? roundMoney(subtotal) : roundMoney(subtotal + totalTax);

    return {
      id: rule.id,
      name: rule.name,
      type: rule.type,
      taxMode: mode,
      percentage: rate,
      taxAmount,
      amountBefore: subtotal,
      amountAfter: runningTotal,
    };
  });

  return {
    country,
    subtotal: roundMoney(subtotal),
    taxAmount: roundMoney(totalTax),
    total: roundMoney(runningTotal),
    appliedRules,
  };
}

export async function createTaxRule(input: TaxRuleInput) {
  const name = input.name?.trim();
  const type = normalizeType(input.type);
  const taxMode = normalizeTaxMode(input.taxMode);
  const percentage = parsePercentage(input.percentage);
  const rawCountryIds = Array.isArray(input.countryIds)
    ? input.countryIds.filter(Boolean)
    : input.countryId
    ? [input.countryId]
    : [];
  const countryIds: string[] = [...new Set(rawCountryIds.map(String))];
  const countryId = countryIds[0] ?? input.countryId?.trim() ?? null;
  if (!name) throw new AppError("Tax rule name is required.", 400);
  if (!type) throw new AppError("Tax rule type is required.", 400);
  if (percentage === undefined) throw new AppError("Tax percentage is required.", 400);
  if (countryIds.length === 0 && !countryId) throw new AppError("At least one country is required.", 400);

  for (const cId of countryIds) {
    await assertCountry(cId);
  }

  const created = await taxRuleClient().create({
    data: {
      name,
      type,
      taxMode,
      percentage,
      countryId,
      status: normalizeStatus(input.status) ?? "ACTIVE",
      sortOrder: parseSortOrder(input.sortOrder) ?? 0,
      countries: countryIds.length > 0
        ? { create: countryIds.map((cId) => ({ countryId: cId })) }
        : undefined,
      products: input.productIds && Array.isArray(input.productIds) ? {
        connect: input.productIds.map((pid) => ({ id: pid })),
      } : undefined,
    },
    include: includeCountryAndProducts(),
  });
  return formatTaxRuleResponse(created);
}

export async function updateTaxRule(id: string, input: TaxRuleInput) {
  const existing = await taxRuleClient().findUnique({ where: { id }, include: includeCountryAndProducts() });
  if (!existing) throw new AppError("Tax rule not found.", 404);

  const data: Record<string, unknown> = {};
  const rawCountryIds: string[] = (
    input.countryIds !== undefined
      ? (Array.isArray(input.countryIds) ? input.countryIds.filter(Boolean) : [])
      : (input.countryId !== undefined ? (input.countryId ? [input.countryId] : []) : (existing as any).countryIds ?? [])
  ) as string[];
  const countryIds: string[] = [...new Set(rawCountryIds.map((s) => String(s)))];
  const nextCountryId = countryIds[0] ?? existing.countryId;
  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) throw new AppError("Tax rule name is required.", 400);

  for (const cId of countryIds) {
    await assertCountry(cId);
  }

  if (input.name !== undefined) data.name = nextName;
  data.countryId = nextCountryId;
  if (input.type !== undefined) data.type = normalizeType(input.type);
  if (input.taxMode !== undefined) data.taxMode = normalizeTaxMode(input.taxMode);
  if (input.percentage !== undefined) data.percentage = parsePercentage(input.percentage);
  if (input.status !== undefined) data.status = normalizeStatus(input.status);
  if (input.sortOrder !== undefined) data.sortOrder = parseSortOrder(input.sortOrder);
  if (input.productIds !== undefined) {
    data.products = {
      set: Array.isArray(input.productIds) ? input.productIds.map((pid) => ({ id: pid })) : [],
    };
  }

  await (prisma as any).taxRuleCountry.deleteMany({ where: { taxRuleId: id } });
  if (countryIds.length > 0) {
    data.countries = { create: countryIds.map((cId) => ({ countryId: cId })) };
  }

  const updated = await taxRuleClient().update({ where: { id }, data, include: includeCountryAndProducts() });
  return formatTaxRuleResponse(updated);
}

export async function deleteTaxRule(id: string) {
  const existing = await taxRuleClient().findUnique({ where: { id } });
  if (!existing) throw new AppError("Tax rule not found.", 404);
  return taxRuleClient().delete({ where: { id } });
}

export async function bulkUpdateTaxRules(input: TaxBulkInput) {
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    throw new AppError("Select at least one tax rule.", 400);
  }
  const action = String(input.action ?? "").toUpperCase();
  if (!["ENABLE", "DISABLE", "DELETE"].includes(action)) {
    throw new AppError("Unsupported bulk action.", 400);
  }

  const ids = Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean)));
  const rules = await taxRuleClient().findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (rules.length !== ids.length) {
    const found = new Set(rules.map((rule) => rule.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new AppError(`Tax rule not found for: ${missing.join(", ")}`, 404);
  }

  if (action === "DELETE") {
    await taxRuleClient().deleteMany({ where: { id: { in: ids } } });
    return { action, affected: ids.length };
  }

  const status = action === "ENABLE" ? "ACTIVE" : "INACTIVE";
  await taxRuleClient().updateMany({ where: { id: { in: ids } }, data: { status } });
  return { action, affected: ids.length, status };
}

const TAX_EXPORT_COLUMNS = [
  { key: "name", header: "name" },
  { key: "type", header: "type" },
  { key: "percentage", header: "percentage" },
  { key: "countryCode", header: "countryCode" },
  { key: "status", header: "status" },
  { key: "sortOrder", header: "sortOrder" },
] as const;

function parseTaxRow(raw: Record<string, string>): TaxSpreadsheetRow {
  return {
    name: raw.name?.trim() || "",
    type: raw.type?.trim().toUpperCase() || "",
    percentage: raw.percentage?.trim() || "",
    countryCode: raw.countryCode?.trim().toUpperCase() || "",
    status: raw.status?.trim().toUpperCase() || "ACTIVE",
    sortOrder: raw.sortOrder?.trim() || "0",
  };
}

async function previewTaxRows(rows: Record<string, string>[]) {
  const parsed = rows.map(parseTaxRow);
  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const countryCodes = new Set<string>();
  const seenRules = new Map<string, number>();
  const fileRows = new Map<string, number>();

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (!row.name) issues.push({ row: rowNumber, field: "name", message: "Name is required." });
    if (!TAX_RULE_TYPES.includes(row.type as never)) {
      issues.push({ row: rowNumber, field: "type", message: "Type must be CGST, SGST, VAT, or SALES_TAX." });
    }

    const percentage = Number(row.percentage);
    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      issues.push({ row: rowNumber, field: "percentage", message: "Percentage must be between 0 and 100." });
    }

    if (!row.countryCode) {
      issues.push({ row: rowNumber, field: "countryCode", message: "Country code is required." });
    } else {
      countryCodes.add(row.countryCode);
    }

    if (!STATUS_VALUES.includes(row.status as never)) {
      issues.push({ row: rowNumber, field: "status", message: "Status must be ACTIVE or INACTIVE." });
    }

    const sortOrder = Number(row.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      issues.push({ row: rowNumber, field: "sortOrder", message: "Sort order must be a non-negative integer." });
    }

    const fileKey = `${row.countryCode}::${row.name.toLowerCase()}`;
    fileRows.set(fileKey, rowNumber);
    const seenRow = seenRules.get(fileKey);
    if (seenRow) {
      const message = `Duplicate tax rule '${row.name}' for '${row.countryCode}' found on rows ${seenRow} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "name", message });
      duplicateWarnings.push(message);
    } else {
      seenRules.set(fileKey, rowNumber);
    }
  }

  const [countries, existingRules] = await Promise.all([
    prisma.country.findMany({ where: { code: { in: Array.from(countryCodes) } }, select: { id: true, code: true, status: true } }),
    taxRuleClient().findMany({
      where: { countries: { some: { code: { in: Array.from(countryCodes) } } } },
      select: { id: true, name: true, countries: { select: { code: true } } },
    }),
  ]);

  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const existingByKey = new Map(existingRules.map((rule) => [`${rule.countries[0]?.code}::${rule.name.toLowerCase()}`, rule]));

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    const country = countryByCode.get(row.countryCode);
    if (!country) {
      issues.push({ row: rowNumber, field: "countryCode", message: `Country '${row.countryCode}' was not found.` });
    } else if (country.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "countryCode", message: `Country '${row.countryCode}' is inactive.` });
    }

    const existing = existingByKey.get(`${row.countryCode}::${row.name.toLowerCase()}`);
    if (existing) {
      duplicateWarnings.push(`A matching tax rule already exists for ${row.name} in ${row.countryCode}.`);
    }
  }

  return { parsed, issues, duplicateWarnings, countryByCode };
}

export async function exportTaxSpreadsheet(query: TaxListQuery & { ids?: string }) {
  const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const where = ids.length ? { id: { in: ids } } : buildWhere(query);

  const rules = await taxRuleClient().findMany({
    where,
    orderBy: taxRuleOrderBy(query) as never,
    include: includeCountryAndProducts(),
  });

  return writeSpreadsheetBuffer(
    rules.map((rule) => ({
      name: rule.name,
      type: rule.type,
      percentage: rule.percentage,
      countryCode: rule.countries[0]?.code,
      status: rule.status,
      sortOrder: rule.sortOrder,
    })),
    "Tax Rules",
    TAX_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export async function previewTaxImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewTaxRows(rows);
  return {
    totalRows: preview.parsed.length,
    validRows: Math.max(0, preview.parsed.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.parsed.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
  };
}

export async function importTaxSpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewTaxRows(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of preview.parsed.entries()) {
      const country = preview.countryByCode.get(row.countryCode);
      if (!country) {
        throw new AppError(`Country not found during import on row ${index + 2}.`, 400);
      }

      const payload = {
        name: row.name.trim(),
        type: row.type as (typeof TAX_RULE_TYPES)[number],
        percentage: Number(row.percentage),
        status: (row.status as (typeof STATUS_VALUES)[number]) ?? "ACTIVE",
        sortOrder: Number(row.sortOrder),
      };

      const existing = await tx.taxRule.findFirst({
        where: { countries: { some: { id: country.id } }, name: payload.name },
        select: { id: true },
      });

      if (existing) {
        await tx.taxRule.update({
          where: { id: existing.id },
          data: payload,
        });
        summary.updated += 1;
      } else {
        await tx.taxRule.create({ data: payload });
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

/**
 * Validates a business tax identifier (GSTIN for India, VAT ID for Europe, EIN for US)
 */
export async function validateTaxIdentifier(taxId: string, taxIdType: string, countryCode: string) {
  const result = await validateIdentifier(taxId, taxIdType, countryCode);
  return {
    isValid: result.isValid,
    taxId: result.taxId ?? result.identifier,
    type: result.identifierType,
    legalName: result.companyName ?? null,
    tradeName: result.companyName ?? null,
    address: result.companyAddress ?? null,
    verifiedAt: result.validatedAt,
    validatedBy: result.validationSource,
    countryCode: result.countryCode,
    validationSource: result.validationSource,
    message: result.message,
  };
}

/**
 * Validates shipping address jurisdiction fields for correct tax billing
 */
export async function validateAddressDetails(address: {
  city?: string;
  state?: string;
  postalCode?: string;
  countryId?: string;
}) {
  if (!address.city || address.city.trim().length < 2) {
    throw new AppError("City name is invalid or missing.", 400);
  }
  if (!address.state || address.state.trim().length < 2) {
    throw new AppError("State/Jurisdiction is missing or invalid.", 400);
  }
  if (!address.postalCode || address.postalCode.trim().length < 3) {
    throw new AppError("Postal code is missing or too short.", 400);
  }
  if (!address.countryId) {
    throw new AppError("Country is required.", 400);
  }

  const country = await prisma.country.findUnique({
    where: { id: address.countryId }
  });
  if (!country || country.status !== "ACTIVE") {
    throw new AppError("Shipping country is not active or supported.", 400);
  }

  return {
    isValid: true,
    normalizedAddress: {
      city: address.city.trim(),
      state: address.state.trim(),
      postalCode: address.postalCode.trim().replace(/[-\s]/g, ""),
      countryId: address.countryId,
      countryCode: country.code
    }
  };
}

