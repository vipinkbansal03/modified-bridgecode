import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";

const TAX_RULE_TYPES = ["CGST", "SGST", "VAT", "SALES_TAX"] as const;
const STATUS_VALUES = ["ACTIVE", "INACTIVE"] as const;

type TaxRuleInput = {
  name?: string;
  type?: string;
  percentage?: number | string;
  countryId?: string;
  status?: string;
  sortOrder?: number | string;
};

function taxRuleClient() {
  return (prisma as unknown as { taxRule: {
    findMany: (args?: unknown) => Promise<any[]>;
    findFirst: (args?: unknown) => Promise<any | null>;
    findUnique: (args?: unknown) => Promise<any | null>;
    create: (args: unknown) => Promise<any>;
    update: (args: unknown) => Promise<any>;
    delete: (args: unknown) => Promise<any>;
    count: (args?: unknown) => Promise<number>;
  } }).taxRule;
}

function includeCountry() {
  return { country: { include: { currency: true } } };
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

function normalizeStatus(value: string | undefined) {
  if (!value) return undefined;
  const status = value.toUpperCase();
  if (!STATUS_VALUES.includes(status as never)) throw new AppError("Invalid tax rule status.", 400);
  return status;
}

export async function listTaxRules(query: { page?: string; limit?: string; countryId?: string; status?: string }) {
  const { page, limit, skip } = getPagination(query);
  const where: Record<string, unknown> = {};
  if (query.countryId) where.countryId = query.countryId;
  if (query.status) where.status = normalizeStatus(query.status);

  const [data, total] = await Promise.all([
    taxRuleClient().findMany({
      where,
      skip,
      take: limit,
      include: includeCountry(),
      orderBy: [{ country: { sortOrder: "asc" } }, { sortOrder: "asc" }, { name: "asc" }],
    }),
    taxRuleClient().count({ where }),
  ]);

  return { data, total, page, limit };
}

async function assertCountry(countryId: string) {
  const country = await prisma.country.findUnique({ where: { id: countryId }, select: { id: true } });
  if (!country) throw new AppError("Country not found.", 404);
}

async function assertUniqueName(countryId: string, name: string, excludeId?: string) {
  const existing = await taxRuleClient().findFirst({
    where: {
      countryId,
      name,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new AppError("A tax rule with this name already exists for this country.", 409);
}

export async function createTaxRule(input: TaxRuleInput) {
  const name = input.name?.trim();
  const type = normalizeType(input.type);
  const percentage = parsePercentage(input.percentage);
  const countryId = input.countryId?.trim();
  if (!name) throw new AppError("Tax rule name is required.", 400);
  if (!type) throw new AppError("Tax rule type is required.", 400);
  if (percentage === undefined) throw new AppError("Tax percentage is required.", 400);
  if (!countryId) throw new AppError("Country is required.", 400);
  await assertCountry(countryId);
  await assertUniqueName(countryId, name);

  return taxRuleClient().create({
    data: {
      name,
      type,
      percentage,
      countryId,
      status: normalizeStatus(input.status) ?? "ACTIVE",
      sortOrder: parseSortOrder(input.sortOrder) ?? 0,
    },
    include: includeCountry(),
  });
}

export async function updateTaxRule(id: string, input: TaxRuleInput) {
  const existing = await taxRuleClient().findUnique({ where: { id } });
  if (!existing) throw new AppError("Tax rule not found.", 404);

  const data: Record<string, unknown> = {};
  const nextCountryId = input.countryId?.trim() || existing.countryId;
  const nextName = input.name !== undefined ? input.name.trim() : existing.name;
  if (!nextName) throw new AppError("Tax rule name is required.", 400);
  if (input.countryId !== undefined) await assertCountry(nextCountryId);
  if (input.name !== undefined || input.countryId !== undefined) await assertUniqueName(nextCountryId, nextName, id);

  if (input.name !== undefined) data.name = nextName;
  if (input.countryId !== undefined) data.countryId = nextCountryId;
  if (input.type !== undefined) data.type = normalizeType(input.type);
  if (input.percentage !== undefined) data.percentage = parsePercentage(input.percentage);
  if (input.status !== undefined) data.status = normalizeStatus(input.status);
  if (input.sortOrder !== undefined) data.sortOrder = parseSortOrder(input.sortOrder);

  return taxRuleClient().update({ where: { id }, data, include: includeCountry() });
}

export async function deleteTaxRule(id: string) {
  const existing = await taxRuleClient().findUnique({ where: { id } });
  if (!existing) throw new AppError("Tax rule not found.", 404);
  return taxRuleClient().delete({ where: { id } });
}
