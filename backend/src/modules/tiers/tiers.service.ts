import { Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";

type TierListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  countryId?: string;
  sortBy?: string;
  sortDir?: string;
};

type TierInput = {
  name?: string;
  status?: string;
  sortOrder?: number | string;
};

type TierBulkInput = {
  ids?: string[];
  action?: string;
};

type TierSpreadsheetRow = {
  name: string;
  status: string;
  sortOrder: number | string;
  countryCodes: string[];
};

type SpreadsheetIssue = {
  row: number;
  field: string;
  message: string;
};

function normalizeStatus(value?: string): Status | undefined {
  if (!value) return undefined;
  const status = value.trim().toUpperCase();
  if (!["ACTIVE", "INACTIVE"].includes(status)) throw new AppError("Invalid tier status.", 400);
  return status as Status;
}

function parseSortOrder(value: number | string | undefined) {
  if (value === undefined || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new AppError("Sort order must be a non-negative integer.", 400);
  return parsed;
}

function buildTierWhere(query: TierListQuery) {
  const where: Record<string, unknown> = {};
  const search = query.search?.trim();
  if (query.status) where.status = normalizeStatus(query.status);
  if (query.countryId) {
    where.countries = { some: { countryId: query.countryId, enabled: true } };
  }
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
    ];
  }
  return where;
}

function buildTierOrderBy(query: TierListQuery) {
  const dir = query.sortDir === "asc" ? "asc" : "desc";
  switch (query.sortBy) {
    case "createdAt":
      return [{ createdAt: dir }, { sortOrder: "asc" }, { name: "asc" }];
    case "updatedAt":
      return [{ updatedAt: dir }, { sortOrder: "asc" }, { name: "asc" }];
    case "name":
      return [{ name: dir }, { sortOrder: "asc" }];
    case "status":
      return [{ status: dir }, { sortOrder: "asc" }, { name: "asc" }];
    case "sortOrder":
    default:
      return [{ sortOrder: dir }, { name: "asc" }];
  }
}

function tierInclude() {
  return {
    _count: { select: { customers: true, pricing: true, discounts: true, countries: true } },
    countries: {
      where: { enabled: true },
      include: { country: { select: { id: true, name: true, code: true, status: true } } },
    },
  };
}

export async function listTiers(query: TierListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = buildTierWhere(query);
  const orderBy = buildTierOrderBy(query);

  const [data, total] = await Promise.all([
    prisma.tier.findMany({
      where,
      skip,
      take: limit,
      include: tierInclude(),
      orderBy: orderBy as never,
    }),
    prisma.tier.count({ where }),
  ]);

  return { data, total, page, limit };
}

export async function getTierDashboard() {
  const [total, active, inactive, mappedCountries, recentlyUpdated] = await Promise.all([
    prisma.tier.count(),
    prisma.tier.count({ where: { status: "ACTIVE" } }),
    prisma.tier.count({ where: { status: "INACTIVE" } }),
    prisma.tier.count({ where: { countries: { some: { enabled: true } } } }),
    prisma.tier.findMany({
      take: 5,
      orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
      include: tierInclude(),
    }),
  ]);

  return {
    totalTiers: total,
    activeTiers: active,
    inactiveTiers: inactive,
    mappedCountries,
    recentlyUpdated,
  };
}

export function listTiersSimple() {
  return prisma.tier.findMany({
    include: { _count: { select: { customers: true, pricing: true, discounts: true, countries: true } } },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });
}

export async function createTier(data: TierInput) {
  const name = data.name?.trim();
  if (!name) throw new AppError("Tier name is required.", 400);
  const existing = await prisma.tier.findUnique({ where: { name } });
  if (existing) throw new AppError("A tier with this name already exists.", 409);

  return prisma.tier.create({
    data: {
      name,
      status: normalizeStatus(data.status) ?? Status.ACTIVE,
      sortOrder: parseSortOrder(data.sortOrder) ?? 0,
    },
    include: { _count: { select: { customers: true, pricing: true, discounts: true, countries: true } } },
  });
}

export async function updateTier(id: string, data: TierInput) {
  const tier = await prisma.tier.findUnique({ where: { id } });
  if (!tier) throw new AppError("Tier not found.", 404);

  const name = data.name?.trim();
  if (name) {
    const duplicate = await prisma.tier.findFirst({ where: { name, id: { not: id } } });
    if (duplicate) throw new AppError("A tier with this name already exists.", 409);
  }

  return prisma.tier.update({
    where: { id },
    data: {
      ...(name ? { name } : {}),
      ...(data.status ? { status: normalizeStatus(data.status) as never } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: parseSortOrder(data.sortOrder) ?? 0 } : {}),
    },
    include: { _count: { select: { customers: true, pricing: true, discounts: true, countries: true } } },
  });
}

export async function deleteTier(id: string) {
  const tier = await prisma.tier.findUnique({
    where: { id },
    include: { _count: { select: { customers: true, pricing: true, discounts: true, countries: true } } },
  });
  if (!tier) throw new AppError("Tier not found.", 404);

  if (tier._count.customers > 0) {
    throw new AppError(`Cannot delete tier: ${tier._count.customers} customer${tier._count.customers === 1 ? " is" : "s are"} assigned to it.`, 400);
  }
  if (tier._count.pricing > 0) {
    throw new AppError(`Cannot delete tier: ${tier._count.pricing} tier pricing rule${tier._count.pricing === 1 ? " references" : "s reference"} it.`, 400);
  }
  if (tier._count.discounts > 0) {
    throw new AppError(`Cannot delete tier: ${tier._count.discounts} discount${tier._count.discounts === 1 ? " references" : "s reference"} it.`, 400);
  }

  await prisma.tier.delete({ where: { id } });
}

export async function reorderTiers(items: { id: string; sortOrder: number }[]) {
  if (!Array.isArray(items)) throw new AppError("Reorder payload must include an array of items.", 400);
  const ids = [...new Set(items.map((item) => item.id))];
  const tiers = await prisma.tier.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (tiers.length !== ids.length) throw new AppError("One or more tiers were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.tier.update({
        where: { id: item.id },
        data: { sortOrder: Number(item.sortOrder) },
      }),
    ),
  );
  return listTiersSimple();
}

export async function listTierCountries(tierId: string) {
  const tier = await prisma.tier.findUnique({ where: { id: tierId }, select: { id: true } });
  if (!tier) throw new AppError("Tier not found.", 404);

  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.tierCountry.findMany({ where: { tierId } }),
  ]);
  const mappingByCountry = new Map(mappings.map((mapping) => [mapping.countryId, mapping]));
  return countries.map((country) => {
    const mapping = mappingByCountry.get(country.id);
    return {
      ...country,
      tierCountryId: mapping?.id ?? null,
      enabled: mapping?.enabled ?? false,
    };
  });
}

export async function updateTierCountries(tierId: string, items: { countryId: string; enabled: boolean }[]) {
  const tier = await prisma.tier.findUnique({ where: { id: tierId }, select: { id: true } });
  if (!tier) throw new AppError("Tier not found.", 404);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);

  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds }, status: "ACTIVE" }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more active countries were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.tierCountry.upsert({
        where: { tierId_countryId: { tierId, countryId: item.countryId } },
        update: { enabled: Boolean(item.enabled) },
        create: { tierId, countryId: item.countryId, enabled: Boolean(item.enabled) },
      }),
    ),
  );
  return listTierCountries(tierId);
}

function parseCountryCodes(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return [];
  return normalized
    .split(/[;,|]/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

const TIER_EXPORT_COLUMNS = [
  { key: "name", header: "name" },
  { key: "status", header: "status" },
  { key: "sortOrder", header: "sortOrder" },
  { key: "countryCodes", header: "countryCodes" },
] as const;

function parseTierRow(raw: Record<string, string>): TierSpreadsheetRow {
  return {
    name: raw.name?.trim() || "",
    status: raw.status?.trim().toUpperCase() || "ACTIVE",
    sortOrder: raw.sortOrder?.trim() || "0",
    countryCodes: parseCountryCodes(raw.countryCodes),
  };
}

async function previewTierRows(rows: Record<string, string>[]) {
  const parsed = rows.map(parseTierRow);
  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seen = new Map<string, number>();
  const tierNames = new Set<string>();
  const countryCodes = new Set<string>();

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (!row.name) issues.push({ row: rowNumber, field: "name", message: "Name is required." });
    if (!["ACTIVE", "INACTIVE"].includes(row.status)) {
      issues.push({ row: rowNumber, field: "status", message: "Status must be ACTIVE or INACTIVE." });
    }
    const sortOrder = Number(row.sortOrder);
    if (!Number.isInteger(sortOrder) || sortOrder < 0) {
      issues.push({ row: rowNumber, field: "sortOrder", message: "Sort order must be a non-negative integer." });
    }
    const key = row.name.toLowerCase();
    const seenRow = seen.get(key);
    if (seenRow) {
      const message = `Duplicate tier name '${row.name}' found on rows ${seenRow} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "name", message });
      duplicateWarnings.push(message);
    } else {
      seen.set(key, rowNumber);
    }
    tierNames.add(row.name);
    row.countryCodes.forEach((code) => countryCodes.add(code));
  }

  const [countries, existing] = await Promise.all([
    prisma.country.findMany({ where: { code: { in: Array.from(countryCodes) } }, select: { code: true, status: true } }),
    prisma.tier.findMany({ where: { name: { in: Array.from(tierNames) } }, select: { name: true } }),
  ]);

  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const existingNames = new Set(existing.map((tier) => tier.name.toLowerCase()));

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    row.countryCodes.forEach((code) => {
      const country = countryByCode.get(code);
      if (!country) issues.push({ row: rowNumber, field: "countryCodes", message: `Country '${code}' was not found.` });
      else if (country.status !== "ACTIVE") issues.push({ row: rowNumber, field: "countryCodes", message: `Country '${code}' is inactive.` });
    });
    if (existingNames.has(row.name.toLowerCase())) {
      duplicateWarnings.push(`A tier named '${row.name}' already exists and will be updated during import.`);
    }
  }

  return { parsed, issues, duplicateWarnings, countryByCode };
}

export async function exportTiersSpreadsheet(query: TierListQuery & { ids?: string }) {
  const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const where = ids.length ? { id: { in: ids } } : buildTierWhere(query);

  const tiers = await prisma.tier.findMany({
    where,
    orderBy: buildTierOrderBy(query) as never,
    include: {
      countries: { where: { enabled: true }, include: { country: { select: { code: true } } } },
    },
  });

  return writeSpreadsheetBuffer(
    tiers.map((tier) => ({
      name: tier.name,
      status: tier.status,
      sortOrder: tier.sortOrder,
      countryCodes: tier.countries.map((mapping) => mapping.country.code).join(", "),
    })),
    "Tiers",
    TIER_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export async function previewTierImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewTierRows(rows);
  return {
    totalRows: preview.parsed.length,
    validRows: Math.max(0, preview.parsed.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.parsed.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
  };
}

export async function importTierSpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewTierRows(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of preview.parsed.entries()) {
      const existing = await tx.tier.findUnique({ where: { name: row.name } });
      const payload = {
        name: row.name,
        status: normalizeStatus(row.status) ?? Status.ACTIVE,
        sortOrder: parseSortOrder(row.sortOrder) ?? 0,
      };

      const countryIds = row.countryCodes.length
        ? (await tx.country.findMany({ where: { code: { in: row.countryCodes }, status: "ACTIVE" }, select: { id: true, code: true } }))
            .map((country) => country.id)
        : [];
      if (row.countryCodes.length && countryIds.length !== row.countryCodes.length) {
        throw new AppError(`One or more countries were not found during import on row ${index + 2}.`, 400);
      }

      if (existing) {
        await tx.tier.update({ where: { id: existing.id }, data: payload });
        for (const countryId of countryIds) {
          await tx.tierCountry.upsert({
            where: { tierId_countryId: { tierId: existing.id, countryId } },
            update: { enabled: true },
            create: { tierId: existing.id, countryId, enabled: true },
          });
        }
        summary.updated += 1;
      } else {
        const created = await tx.tier.create({ data: payload });
        for (const countryId of countryIds) {
          await tx.tierCountry.upsert({
            where: { tierId_countryId: { tierId: created.id, countryId } },
            update: { enabled: true },
            create: { tierId: created.id, countryId, enabled: true },
          });
        }
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

export async function bulkUpdateTiers(input: TierBulkInput) {
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    throw new AppError("Select at least one tier.", 400);
  }

  const action = String(input.action ?? "").toUpperCase();
  if (!["ENABLE", "DISABLE", "DELETE"].includes(action)) {
    throw new AppError("Unsupported bulk action.", 400);
  }

  const ids = Array.from(new Set(input.ids.map((id) => id.trim()).filter(Boolean)));
  const rows = await prisma.tier.findMany({ where: { id: { in: ids } }, select: { id: true } });
  if (rows.length !== ids.length) {
    const found = new Set(rows.map((row) => row.id));
    const missing = ids.filter((id) => !found.has(id));
    throw new AppError(`Tier not found for: ${missing.join(", ")}`, 404);
  }

  if (action === "DELETE") {
    const results = [];
    for (const id of ids) {
      try {
        await deleteTier(id);
        results.push({ id, success: true });
      } catch (error) {
        results.push({ id, success: false, error: error instanceof Error ? error.message : "Failed to delete tier." });
      }
    }
    return {
      action,
      results,
      summary: {
        total: ids.length,
        succeeded: results.filter((result) => result.success).length,
        failed: results.filter((result) => !result.success).length,
      },
    };
  }

  const status = action === "ENABLE" ? "ACTIVE" : "INACTIVE";
  await prisma.tier.updateMany({ where: { id: { in: ids } }, data: { status } });
  return { action, affected: ids.length, status };
}

export async function assertTierUsable(tierId: string | null | undefined, options?: { countryId?: string | null }) {
  if (!tierId) return null;

  const tier = await prisma.tier.findUnique({
    where: { id: tierId },
    include: {
      countries: {
        where: { enabled: true },
        select: { countryId: true },
      },
    },
  });

  if (!tier) throw new AppError("Tier not found.", 404);
  if (tier.status !== "ACTIVE") throw new AppError("Tier is inactive.", 400);

  const allowedCountryIds = tier.countries.map((mapping) => mapping.countryId);
  if (options?.countryId && allowedCountryIds.length > 0 && !allowedCountryIds.includes(options.countryId)) {
    throw new AppError("Tier is not enabled for the selected country.", 400);
  }

  return tier;
}
