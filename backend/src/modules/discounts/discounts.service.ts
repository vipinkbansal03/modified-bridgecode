import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";
import { assertTierUsable } from "../tiers/tiers.service";
import { DISCOUNT_RULE_KINDS, isDiscountRuleKind, supportsPromotionalDiscountType, type DiscountRuleKind } from "./discountRules";
const DISCOUNT_STATUSES: Status[] = ["ACTIVE", "INACTIVE"];

type DiscountInput = {
  name?: string;
  type?: DiscountRuleKind;
  status?: Status;
  tierId?: string | null;
  minQuantity?: number | string | null;
  maxQuantity?: number | string | null;
  discountPercent?: number | string | null;
  fixedAmount?: number | string | null;
  countryIds?: string[];
  productIds?: string[];
  categoryIds?: string[];
  collectionIds?: string[];
  startDate?: string | Date | null;
  endDate?: string | Date | null;
};

function blankToNull(value: unknown) {
  return value === "" || value === undefined ? null : value;
}

function decimalOrNull(value: unknown, field: string) {
  const normalized = blankToNull(value);
  if (normalized === null) return null;
  const numberValue = Number(normalized);
  if (!Number.isFinite(numberValue) || numberValue < 0) {
    throw new AppError(`${field} must be a non-negative number.`, 400);
  }
  return new Prisma.Decimal(numberValue);
}

function intOrNull(value: unknown, field: string) {
  const normalized = blankToNull(value);
  if (normalized === null) return null;
  const numberValue = Number(normalized);
  if (!Number.isInteger(numberValue) || numberValue < 1) {
    throw new AppError(`${field} must be a positive integer.`, 400);
  }
  return numberValue;
}

function dateOrNull(value: unknown, field: string) {
  const normalized = blankToNull(value);
  if (normalized === null) return null;
  const date = normalized instanceof Date ? normalized : new Date(String(normalized));
  if (Number.isNaN(date.getTime())) throw new AppError(`${field} must be a valid date.`, 400);
  return date;
}

function buildDiscountOrderBy(query: DiscountListQuery) {
  const dir = query.sortDir === "asc" ? "asc" : "desc";
  switch (query.sortBy) {
    case "updatedAt":
      return [{ updatedAt: dir }, { createdAt: "desc" }];
    case "name":
      return [{ name: dir }, { createdAt: "desc" }];
    case "type":
      return [{ type: dir }, { createdAt: "desc" }];
    case "status":
      return [{ status: dir }, { createdAt: "desc" }];
    case "startDate":
      return [{ startDate: dir }, { createdAt: "desc" }];
    case "endDate":
      return [{ endDate: dir }, { createdAt: "desc" }];
    case "createdAt":
    default:
      return [{ createdAt: dir }];
  }
}

function discountInclude() {
  return {
    tier: true,
    countries: { include: { country: true } },
    products: { include: { product: { select: { id: true, title: true, slug: true } } } },
    collections: { include: { collection: true } },
    categories: { include: { category: true } },
  };
}

export function formatDiscount<T extends Record<string, any>>(discount: T): T {
  if (!discount) return discount;
  const formatted: any = { ...discount };
  if (Array.isArray(formatted.countries)) {
    formatted.countries = formatted.countries.map((item: any) => item.country ?? item).filter(Boolean);
  }
  if (Array.isArray(formatted.products)) {
    formatted.products = formatted.products.map((item: any) => item.product ?? item).filter(Boolean);
  }
  if (Array.isArray(formatted.collections)) {
    formatted.collections = formatted.collections.map((item: any) => item.collection ?? item).filter(Boolean);
  }
  if (Array.isArray(formatted.categories)) {
    formatted.categories = formatted.categories.map((item: any) => item.category ?? item).filter(Boolean);
  }

  const isArchived = Boolean(formatted.deletedAt);
  formatted.canPermanentDelete = isArchived;
  formatted.permanentDeleteBlockReason = isArchived
    ? null
    : "Permanent Delete is available only for archived discounts. Archive the discount first.";
  formatted.dependencyCounts = {
    countries: Array.isArray(formatted.countries) ? formatted.countries.length : 0,
    products: Array.isArray(formatted.products) ? formatted.products.length : 0,
    categories: Array.isArray(formatted.categories) ? formatted.categories.length : 0,
    collections: Array.isArray(formatted.collections) ? formatted.collections.length : 0,
  };

  return formatted;
}

async function buildDiscountWhere(query: DiscountListQuery) {
  const search = query.search?.trim();
  const type = query.type?.trim().toUpperCase();
  const status = query.status?.trim().toUpperCase();
  const scope = query.scope?.trim().toUpperCase();
  const countryId = blankToNull(query.countryId) as string | null;

  if (type && !isDiscountRuleKind(type)) {
    throw new AppError("Invalid discount type.", 400);
  }
  const isArchived = status === "ARCHIVED";
  if (status && !isArchived && !DISCOUNT_STATUSES.includes(status as Status)) {
    throw new AppError("Invalid discount status.", 400);
  }
  if (scope && !["PLATFORM", "PRODUCT", "COLLECTION", "CATEGORY"].includes(scope)) {
    throw new AppError("Invalid discount scope.", 400);
  }
  if (type === "PROMOTIONAL" && !(await supportsPromotionalDiscountType())) {
    return { id: { in: [] } };
  }

  const where: Prisma.DiscountWhereInput = {
    ...(isArchived ? { deletedAt: { not: null } } : { deletedAt: null }),
    ...(type ? { type: type as never } : {}),
    ...(!isArchived && status ? { status: status as Status } : {}),
    ...(countryId ? { countries: { some: { countryId } } } : {}),
    ...(scope === "PLATFORM" ? { products: { none: {} }, collections: { none: {} }, categories: { none: {} } } : {}),
    ...(scope === "PRODUCT" ? { products: { some: {} } } : {}),
    ...(scope === "COLLECTION" ? { collections: { some: {} } } : {}),
    ...(scope === "CATEGORY" ? { categories: { some: {} } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { products: { some: { product: { title: { contains: search, mode: "insensitive" } } } } },
            { collections: { some: { collection: { name: { contains: search, mode: "insensitive" } } } } },
            { categories: { some: { category: { name: { contains: search, mode: "insensitive" } } } } },
            { tier: { name: { contains: search, mode: "insensitive" } } },
            { countries: { some: { country: { name: { contains: search, mode: "insensitive" } } } } },
            { countries: { some: { country: { code: { contains: search, mode: "insensitive" } } } } },
          ],
        }
      : {}),
  };

  return where;
}

async function assertExists(model: "tier" | "country" | "product" | "category" | "collection", id: string | null) {
  if (!id) return;
  const exists =
    model === "tier"
      ? await prisma.tier.findUnique({ where: { id }, select: { id: true } })
      : model === "country"
        ? await prisma.country.findUnique({ where: { id }, select: { id: true } })
        : model === "product"
        ? await prisma.product.findUnique({ where: { id }, select: { id: true } })
        : model === "category"
          ? await prisma.category.findUnique({ where: { id }, select: { id: true } })
          : await prisma.collection.findUnique({ where: { id }, select: { id: true } });
  if (!exists) throw new AppError(`${model} not found.`, 404);
}

async function normalizeDiscountInput(input: DiscountInput, partial = false) {
  const type = input.type;
  if (!partial && !input.name?.trim()) throw new AppError("Discount name is required.", 400);
  if (!partial && !type) throw new AppError("Discount type is required.", 400);
  if (type && !DISCOUNT_RULE_KINDS.includes(type)) throw new AppError("Discount type must be TIER, MOQ, or PROMOTIONAL.", 400);
  if (input.status && !DISCOUNT_STATUSES.includes(input.status)) throw new AppError("Discount status must be ACTIVE or INACTIVE.", 400);

  const tierId = blankToNull(input.tierId) as string | null;
  const minQuantity = intOrNull(input.minQuantity, "Minimum quantity");
  const maxQuantity = intOrNull(input.maxQuantity, "Maximum quantity");
  const discountPercent = decimalOrNull(input.discountPercent, "Discount percent");
  const fixedAmount = decimalOrNull(input.fixedAmount, "Fixed amount");
  const startDate = dateOrNull(input.startDate, "Start date");
  const endDate = dateOrNull(input.endDate, "End date");
  if (endDate) {
    endDate.setUTCHours(23, 59, 59, 999);
  }

  if (discountPercent !== null && fixedAmount !== null) {
    throw new AppError("Set either discount percent or fixed amount, not both.", 400);
  }
  if (discountPercent === null && fixedAmount === null) {
    throw new AppError("Set either discount percent or fixed amount.", 400);
  }
  if (discountPercent !== null && discountPercent.gt(100)) {
    throw new AppError("Discount percent cannot exceed 100.", 400);
  }
  if (minQuantity !== null && maxQuantity !== null && maxQuantity < minQuantity) {
    throw new AppError("Maximum quantity cannot be less than minimum quantity.", 400);
  }

  const countryIds = Array.isArray(input.countryIds) ? input.countryIds : [];
  const productIds = Array.isArray(input.productIds) ? input.productIds : [];
  const categoryIds = Array.isArray(input.categoryIds) ? input.categoryIds : [];
  const collectionIds = Array.isArray(input.collectionIds) ? input.collectionIds : [];

  const scopedTargets = [productIds.length > 0, collectionIds.length > 0, categoryIds.length > 0].filter(Boolean).length;
  if (scopedTargets > 1) {
    throw new AppError("Discount can target products, collections, or categories, not more than one.", 400);
  }
  if (startDate && endDate && endDate < startDate) {
    throw new AppError("End date must be after start date.", 400);
  }
  if (type === "TIER") {
    if (!tierId) throw new AppError("Tier discounts require a tier.", 400);
    if (minQuantity !== null) throw new AppError("Tier discounts cannot set minimum quantity.", 400);
    if (maxQuantity !== null) throw new AppError("Tier discounts cannot set maximum quantity.", 400);
  }
  if (type === "MOQ") {
    if (minQuantity === null) throw new AppError("MOQ discounts require minimum quantity.", 400);
    if (tierId) throw new AppError("MOQ discounts cannot be tied to a tier.", 400);
  }
  if (type === "PROMOTIONAL") {
    if (tierId) throw new AppError("Promotional discounts cannot be tied to a tier.", 400);
    if (minQuantity !== null) throw new AppError("Promotional discounts cannot set minimum quantity.", 400);
    if (maxQuantity !== null) throw new AppError("Promotional discounts cannot set maximum quantity.", 400);
    if (!(await supportsPromotionalDiscountType())) {
      throw new AppError("Promotional discounts are not available until the database enum migration is applied.", 409);
    }
  }

  await Promise.all([
    tierId ? Promise.all(countryIds.map(cid => assertTierUsable(tierId, { countryId: cid }))) : Promise.resolve(null),
    ...countryIds.map(id => assertExists("country", id)),
    ...productIds.map(id => assertExists("product", id)),
    ...collectionIds.map(id => assertExists("collection", id)),
    ...categoryIds.map(id => assertExists("category", id)),
  ]);

  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    tierId,
    minQuantity,
    maxQuantity,
    discountPercent,
    fixedAmount,
    startDate,
    endDate,
    _relations: {
      countries: countryIds,
      products: productIds,
      categories: categoryIds,
      collections: collectionIds,
    }
  };
}

type DiscountListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  type?: string;
  status?: string;
  scope?: string;
  countryId?: string;
  sortBy?: string;
  sortDir?: string;
};

type DiscountSpreadsheetRow = {
  id: string;
  name: string;
  type: string;
  status: string;
  tierId: string;
  minQuantity: string;
  discountPercent: string;
  fixedAmount: string;
  countryId: string;
  productId: string;
  collectionId: string;
  categoryId: string;
  startDate: string;
  endDate: string;
};

type SpreadsheetIssue = {
  row: number;
  field: string;
  message: string;
};

export async function listDiscounts(query: DiscountListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = await buildDiscountWhere(query);
  const [data, total] = await Promise.all([
    prisma.discount.findMany({
      where,
      skip,
      take: limit,
      orderBy: buildDiscountOrderBy(query) as never,
      include: discountInclude(),
    }),
    prisma.discount.count({ where }),
  ]);
  return { data: data.map(formatDiscount), total, page, limit };
}

export async function getDiscountDashboard() {
  const promotionalSupported = await supportsPromotionalDiscountType();
  const [total, active, inactive, archived, tier, moq, promotional, recentlyUpdated] = await Promise.all([
    prisma.discount.count({ where: { deletedAt: null } }),
    prisma.discount.count({ where: { status: "ACTIVE", deletedAt: null } }),
    prisma.discount.count({ where: { status: "INACTIVE", deletedAt: null } }),
    prisma.discount.count({ where: { deletedAt: { not: null } } }),
    prisma.discount.count({ where: { type: "TIER", deletedAt: null } }),
    prisma.discount.count({ where: { type: "MOQ", deletedAt: null } }),
    promotionalSupported ? prisma.discount.count({ where: { type: "PROMOTIONAL", deletedAt: null } }) : Promise.resolve(0),
    prisma.discount.findMany({
      where: { deletedAt: null },
      take: 5,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: discountInclude(),
    }),
  ]);

  return {
    totalDiscounts: total,
    activeDiscounts: active,
    inactiveDiscounts: inactive,
    archivedDiscounts: archived,
    tierDiscounts: tier,
    moqDiscounts: moq,
    promotionalDiscounts: promotional,
    recentlyUpdated: recentlyUpdated.map(formatDiscount),
  };
}

export async function createDiscount(input: DiscountInput) {
  const parsed = await normalizeDiscountInput(input);
  const { _relations, ...rest } = parsed as any;
  const created = await prisma.discount.create({
    data: {
      ...rest,
      countries: _relations.countries.length > 0 ? { create: _relations.countries.map((countryId: string) => ({ countryId })) } : undefined,
      products: _relations.products.length > 0 ? { create: _relations.products.map((productId: string) => ({ productId })) } : undefined,
      collections: _relations.collections.length > 0 ? { create: _relations.collections.map((collectionId: string) => ({ collectionId })) } : undefined,
      categories: _relations.categories.length > 0 ? { create: _relations.categories.map((categoryId: string) => ({ categoryId })) } : undefined,
    } as any,
    include: discountInclude(),
  });
  return formatDiscount(created);
}

export async function updateDiscount(id: string, input: DiscountInput) {
  const current = await prisma.discount.findUnique({
    where: { id },
    include: discountInclude(),
  });
  if (!current) throw new AppError("Discount not found.", 404);
  const formattedCurrent = formatDiscount(current);
  const merged = {
    ...current,
    ...input,
    countryIds: input.countryIds !== undefined ? input.countryIds : formattedCurrent.countries.map((c: any) => c.id),
    productIds: input.productIds !== undefined ? input.productIds : formattedCurrent.products.map((p: any) => p.id),
    collectionIds: input.collectionIds !== undefined ? input.collectionIds : formattedCurrent.collections.map((c: any) => c.id),
    categoryIds: input.categoryIds !== undefined ? input.categoryIds : formattedCurrent.categories.map((c: any) => c.id),
  } as DiscountInput;
  const parsed = await normalizeDiscountInput(merged, true);
  const { _relations, ...rest } = parsed as any;

  const updated = await prisma.$transaction(async (tx) => {
    await Promise.all([
      tx.discountCountry.deleteMany({ where: { discountId: id } }),
      tx.discountProduct.deleteMany({ where: { discountId: id } }),
      tx.discountCollection.deleteMany({ where: { discountId: id } }),
      tx.discountCategory.deleteMany({ where: { discountId: id } }),
    ]);

    return tx.discount.update({
      where: { id },
      data: {
        ...rest,
        countries: _relations.countries.length > 0 ? { create: _relations.countries.map((countryId: string) => ({ countryId })) } : undefined,
        products: _relations.products.length > 0 ? { create: _relations.products.map((productId: string) => ({ productId })) } : undefined,
        collections: _relations.collections.length > 0 ? { create: _relations.collections.map((collectionId: string) => ({ collectionId })) } : undefined,
        categories: _relations.categories.length > 0 ? { create: _relations.categories.map((categoryId: string) => ({ categoryId })) } : undefined,
      } as any,
      include: discountInclude(),
    });
  });

  return formatDiscount(updated);
}

export async function archiveDiscount(id: string) {
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) throw new AppError("Discount not found.", 404);
  if (discount.deletedAt) throw new AppError("Discount is already archived.", 400);

  const updated = await prisma.discount.update({
    where: { id },
    data: { deletedAt: new Date() },
    include: discountInclude(),
  });
  return formatDiscount(updated);
}

export async function restoreDiscount(id: string) {
  const discount = await prisma.discount.findUnique({ where: { id } });
  if (!discount) throw new AppError("Discount not found.", 404);
  if (!discount.deletedAt) throw new AppError("Discount is not archived.", 400);

  // Validate referenced Tier exists if tierId is populated or required by type
  if (discount.type === "TIER" && !discount.tierId) {
    throw new AppError(
      "Cannot restore discount: Tier-based discount has no assigned tier (referenced tier was removed).",
      400
    );
  }
  if (discount.tierId) {
    const tier = await prisma.tier.findUnique({
      where: { id: discount.tierId },
      select: { id: true, deletedAt: true },
    });
    if (!tier || tier.deletedAt) {
      throw new AppError(
        "Cannot restore discount: The referenced tier no longer exists or is archived. Please assign an active tier.",
        400
      );
    }
  }

  const updated = await prisma.discount.update({
    where: { id },
    data: { deletedAt: null },
    include: discountInclude(),
  });
  return formatDiscount(updated);
}

export async function permanentDeleteDiscount(id: string) {
  const discount = await prisma.discount.findUnique({
    where: { id },
    select: { id: true, name: true, deletedAt: true },
  });
  if (!discount) throw new AppError("Discount not found.", 404);

  // Authoritative hard-delete lifecycle guard
  if (!discount.deletedAt) {
    throw new AppError("Cannot permanently delete discount: Discount must be archived before it can be permanently deleted.", 400);
  }

  await prisma.discount.delete({ where: { id } });
  return { id: discount.id, name: discount.name };
}

export async function deleteDiscount(id: string) {
  return archiveDiscount(id);
}

type BulkDiscountInput = {
  ids?: string[];
  action?: "ENABLE" | "DISABLE" | "DELETE" | "ARCHIVE";
};

export async function bulkDiscounts(input: BulkDiscountInput) {
  const ids = Array.isArray(input.ids) ? input.ids.filter(Boolean) : [];
  if (!ids.length) throw new AppError("Select at least one discount.", 400);
  if (!input.action || !["ENABLE", "DISABLE", "DELETE", "ARCHIVE"].includes(input.action)) {
    throw new AppError("Invalid bulk action.", 400);
  }

  if (input.action === "DELETE" || input.action === "ARCHIVE") {
    const result = await prisma.discount.updateMany({
      where: { id: { in: ids }, deletedAt: null },
      data: { deletedAt: new Date() },
    });
    return { affected: result.count };
  }

  const result = await prisma.discount.updateMany({
    where: { id: { in: ids }, deletedAt: null },
    data: { status: input.action === "ENABLE" ? "ACTIVE" : "INACTIVE" },
  });
  return { affected: result.count };
}

export async function bulkRestoreDiscounts(ids: string[]) {
  const cleanIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!cleanIds.length) throw new AppError("Select at least one discount.", 400);

  const discounts = await prisma.discount.findMany({
    where: { id: { in: cleanIds } },
    select: { id: true, name: true, type: true, deletedAt: true, tierId: true },
  });

  const tierIds = Array.from(new Set(discounts.map((d) => d.tierId).filter(Boolean))) as string[];
  const existingTiers = tierIds.length
    ? await prisma.tier.findMany({
        where: { id: { in: tierIds }, deletedAt: null },
        select: { id: true },
      })
    : [];
  const existingTierSet = new Set(existingTiers.map((t) => t.id));

  const eligibleIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const discount of discounts) {
    if (!discount.deletedAt) {
      blocked.push({
        id: discount.id,
        name: discount.name,
        reason: "Discount is not archived.",
      });
      continue;
    }
    if (discount.type === "TIER" && !discount.tierId) {
      blocked.push({
        id: discount.id,
        name: discount.name,
        reason: "Tier-based discount has no assigned tier (referenced tier was removed).",
      });
      continue;
    }
    if (discount.tierId && !existingTierSet.has(discount.tierId)) {
      blocked.push({
        id: discount.id,
        name: discount.name,
        reason: "Referenced tier no longer exists or is archived.",
      });
      continue;
    }
    eligibleIds.push(discount.id);
  }

  if (eligibleIds.length > 0) {
    await prisma.discount.updateMany({
      where: { id: { in: eligibleIds } },
      data: { deletedAt: null },
    });
  }

  return {
    restoredCount: eligibleIds.length,
    blockedCount: blocked.length,
    restoredIds: eligibleIds,
    blocked,
  };
}

export async function bulkPermanentDeleteDiscounts(ids: string[]) {
  const cleanIds = Array.isArray(ids) ? ids.filter(Boolean) : [];
  if (!cleanIds.length) throw new AppError("Select at least one discount.", 400);

  // Batch query candidate records in a single query - zero N+1
  const discounts = await prisma.discount.findMany({
    where: { id: { in: cleanIds } },
    select: { id: true, name: true, deletedAt: true },
  });

  const discountMap = new Map(discounts.map((d) => [d.id, d]));
  const eligibleIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of cleanIds) {
    const d = discountMap.get(id);
    if (!d) {
      blocked.push({ id, name: id, reason: "Discount not found." });
      continue;
    }
    if (!d.deletedAt) {
      blocked.push({
        id: d.id,
        name: d.name,
        reason: "Permanent Delete is available only for archived discounts. Archive the discount first.",
      });
      continue;
    }
    eligibleIds.push(d.id);
  }

  if (eligibleIds.length > 0) {
    await prisma.discount.deleteMany({
      where: { id: { in: eligibleIds } },
    });
  }

  return {
    deletedCount: eligibleIds.length,
    blockedCount: blocked.length,
    deletedIds: eligibleIds,
    blocked,
  };
}

const DISCOUNT_EXPORT_COLUMNS = [
  { key: "id", header: "id" },
  { key: "name", header: "name" },
  { key: "type", header: "type" },
  { key: "status", header: "status" },
  { key: "tierId", header: "tierId" },
  { key: "minQuantity", header: "minQuantity" },
  { key: "discountPercent", header: "discountPercent" },
  { key: "fixedAmount", header: "fixedAmount" },
  { key: "countryId", header: "countryId" },
  { key: "productId", header: "productId" },
  { key: "collectionId", header: "collectionId" },
  { key: "categoryId", header: "categoryId" },
  { key: "startDate", header: "startDate" },
  { key: "endDate", header: "endDate" },
] as const;

function parseDiscountRow(raw: Record<string, any>): DiscountSpreadsheetRow {
  const safeStr = (v: any) => (v !== undefined && v !== null ? String(v).trim() : "");
  return {
    id: safeStr(raw.id),
    name: safeStr(raw.name),
    type: safeStr(raw.type).toUpperCase(),
    status: safeStr(raw.status).toUpperCase() || "ACTIVE",
    tierId: safeStr(raw.tierId),
    minQuantity: safeStr(raw.minQuantity),
    discountPercent: safeStr(raw.discountPercent),
    fixedAmount: safeStr(raw.fixedAmount),
    countryId: safeStr(raw.countryId),
    productId: safeStr(raw.productId),
    collectionId: safeStr(raw.collectionId),
    categoryId: safeStr(raw.categoryId),
    startDate: safeStr(raw.startDate),
    endDate: safeStr(raw.endDate),
  };
}

function rowToPayload(row: DiscountSpreadsheetRow) {
  return {
    name: row.name,
    type: row.type as DiscountRuleKind,
    status: row.status as Status,
    tierId: row.tierId || null,
    minQuantity: row.minQuantity || null,
    discountPercent: row.discountPercent || null,
    fixedAmount: row.fixedAmount || null,
    countryIds: row.countryId ? row.countryId.split(",").map(s => s.trim()).filter(Boolean) : [],
    productIds: row.productId ? row.productId.split(",").map(s => s.trim()).filter(Boolean) : [],
    collectionIds: row.collectionId ? row.collectionId.split(",").map(s => s.trim()).filter(Boolean) : [],
    categoryIds: row.categoryId ? row.categoryId.split(",").map(s => s.trim()).filter(Boolean) : [],
    startDate: row.startDate || null,
    endDate: row.endDate || null,
  };
}

export async function validateDiscountRows(rows: Record<string, string>[]) {
  const parsed = rows.map(parseDiscountRow);
  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seen = new Map<string, number>();
  const ids = new Set<string>();
  const relatedIds = {
    tierIds: new Set<string>(),
    countryIds: new Set<string>(),
    productIds: new Set<string>(),
    collectionIds: new Set<string>(),
    categoryIds: new Set<string>(),
  };

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (!row.name) issues.push({ row: rowNumber, field: "name", message: "Name is required." });
    if (!DISCOUNT_RULE_KINDS.includes(row.type as DiscountRuleKind)) issues.push({ row: rowNumber, field: "type", message: "Type must be TIER, MOQ, or PROMOTIONAL." });
    else if (row.type === "PROMOTIONAL" && !(await supportsPromotionalDiscountType())) {
      issues.push({ row: rowNumber, field: "type", message: "PROMOTIONAL discounts are not available until the database enum migration is applied." });
    }
    if (!["ACTIVE", "INACTIVE"].includes(row.status)) issues.push({ row: rowNumber, field: "status", message: "Status must be ACTIVE or INACTIVE." });
    if (row.tierId) relatedIds.tierIds.add(row.tierId);
    if (row.countryId) row.countryId.split(",").map(id => id.trim()).filter(Boolean).forEach(id => relatedIds.countryIds.add(id));
    if (row.productId) row.productId.split(",").map(id => id.trim()).filter(Boolean).forEach(id => relatedIds.productIds.add(id));
    if (row.collectionId) row.collectionId.split(",").map(id => id.trim()).filter(Boolean).forEach(id => relatedIds.collectionIds.add(id));
    if (row.categoryId) row.categoryId.split(",").map(id => id.trim()).filter(Boolean).forEach(id => relatedIds.categoryIds.add(id));

    const duplicateKey = [row.name.toLowerCase(), row.type, row.tierId, row.countryId, row.productId, row.collectionId, row.categoryId, row.minQuantity, row.discountPercent, row.fixedAmount].join("|");
    const seenRow = seen.get(duplicateKey);
    if (seenRow) {
      const message = `Duplicate discount definition found on rows ${seenRow} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "name", message });
      duplicateWarnings.push(message);
    } else {
      seen.set(duplicateKey, rowNumber);
    }

    if (row.id) ids.add(row.id);
  }

  const [tiers, countries, products, categories, collections, existingDiscounts] = await Promise.all([
    relatedIds.tierIds.size ? prisma.tier.findMany({ where: { id: { in: Array.from(relatedIds.tierIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.countryIds.size ? prisma.country.findMany({ where: { id: { in: Array.from(relatedIds.countryIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.productIds.size ? prisma.product.findMany({ where: { id: { in: Array.from(relatedIds.productIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.categoryIds.size ? prisma.category.findMany({ where: { id: { in: Array.from(relatedIds.categoryIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.collectionIds.size ? prisma.collection.findMany({ where: { id: { in: Array.from(relatedIds.collectionIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    ids.size ? prisma.discount.findMany({ where: { id: { in: Array.from(ids) } }, select: { id: true, deletedAt: true } }) : Promise.resolve([]),
  ]);

  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));
  const archivedDiscountIdSet = new Set(
    existingDiscounts.filter((d) => d.deletedAt !== null).map((d) => d.id)
  );

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (row.id && archivedDiscountIdSet.has(row.id)) {
      issues.push({
        row: rowNumber,
        field: "id",
        message: "Discount is archived. Restore the discount before updating via spreadsheet.",
      });
    }
    if (row.tierId) {
      const tier = tierById.get(row.tierId);
      if (!tier) issues.push({ row: rowNumber, field: "tierId", message: "Tier not found." });
      else if (tier.status !== "ACTIVE") issues.push({ row: rowNumber, field: "tierId", message: "Tier is inactive." });
    }
    if (row.countryId) {
      for (const id of row.countryId.split(",").map(s => s.trim()).filter(Boolean)) {
        const country = countryById.get(id);
        if (!country) issues.push({ row: rowNumber, field: "countryId", message: `Country ${id} not found.` });
        else if (country.status !== "ACTIVE") issues.push({ row: rowNumber, field: "countryId", message: `Country ${id} is inactive.` });
      }
    }
    if (row.productId) {
      for (const id of row.productId.split(",").map(s => s.trim()).filter(Boolean)) {
        const product = productById.get(id);
        if (!product) issues.push({ row: rowNumber, field: "productId", message: `Product ${id} not found.` });
        else if (product.status !== "ACTIVE") issues.push({ row: rowNumber, field: "productId", message: `Product ${id} is inactive.` });
      }
    }
    if (row.categoryId) {
      for (const id of row.categoryId.split(",").map(s => s.trim()).filter(Boolean)) {
        const category = categoryById.get(id);
        if (!category) issues.push({ row: rowNumber, field: "categoryId", message: `Category ${id} not found.` });
        else if (category.status !== "ACTIVE") issues.push({ row: rowNumber, field: "categoryId", message: `Category ${id} is inactive.` });
      }
    }
    if (row.collectionId) {
      for (const id of row.collectionId.split(",").map(s => s.trim()).filter(Boolean)) {
        const collection = collectionById.get(id);
        if (!collection) issues.push({ row: rowNumber, field: "collectionId", message: `Collection ${id} not found.` });
        else if (collection.status !== "ACTIVE") issues.push({ row: rowNumber, field: "collectionId", message: `Collection ${id} is inactive.` });
      }
    }
  }

  return { parsed, issues, duplicateWarnings };
}

export async function exportDiscountsSpreadsheet(query: DiscountListQuery & { ids?: string }) {
  const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const isArchived = query.status === "ARCHIVED";
  const where = ids.length
    ? { id: { in: ids }, ...(isArchived ? { deletedAt: { not: null } } : { deletedAt: null }) }
    : await buildDiscountWhere(query);
  const discounts = await prisma.discount.findMany({
    where,
    orderBy: buildDiscountOrderBy(query) as never,
    include: discountInclude(),
  });

  return writeSpreadsheetBuffer(
    discounts.map((discount) => ({
      id: discount.id,
      name: discount.name,
      type: discount.type,
      status: discount.status,
      tierId: discount.tierId ?? "",
      minQuantity: discount.minQuantity ?? "",
      discountPercent: discount.discountPercent ?? "",
      fixedAmount: discount.fixedAmount ?? "",
      countryId: (discount as any).countries?.map((c: any) => c.id).join(",") ?? "",
      productId: (discount as any).products?.map((p: any) => p.id).join(",") ?? "",
      collectionId: (discount as any).collections?.map((c: any) => c.id).join(",") ?? "",
      categoryId: (discount as any).categories?.map((c: any) => c.id).join(",") ?? "",
      startDate: discount.startDate ? discount.startDate.toISOString() : "",
      endDate: discount.endDate ? discount.endDate.toISOString() : "",
    })),
    "Discounts",
    DISCOUNT_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export function generateSampleDiscountsTemplate() {
  const sampleRows = [
    {
      id: "",
      name: "Volume Discount 10%",
      type: "PERCENTAGE",
      status: "ACTIVE",
      tierId: "",
      minQuantity: "5",
      discountPercent: "10",
      fixedAmount: "",
      countryId: "",
      productId: "",
      collectionId: "",
      categoryId: "",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T23:59:59.000Z",
    },
    {
      id: "",
      name: "Flat 5.00 Off Bulk Orders",
      type: "FIXED_AMOUNT",
      status: "ACTIVE",
      tierId: "",
      minQuantity: "10",
      discountPercent: "",
      fixedAmount: "5.00",
      countryId: "",
      productId: "",
      collectionId: "",
      categoryId: "",
      startDate: "2026-01-01T00:00:00.000Z",
      endDate: "2026-12-31T23:59:59.000Z",
    },
  ];

  return writeSpreadsheetBuffer(
    sampleRows,
    "Discounts",
    DISCOUNT_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}


export async function previewDiscountImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await validateDiscountRows(rows);

  const issuesByRow = new Map<number, string[]>();
  for (const issue of preview.issues) {
    const list = issuesByRow.get(issue.row) || [];
    list.push(`${issue.field}: ${issue.message}`);
    issuesByRow.set(issue.row, list);
  }

  const previewRows = preview.parsed.map((row, index) => {
    const rowNumber = index + 2;
    const rowErrors = issuesByRow.get(rowNumber) || [];
    return {
      rowNumber,
      isValid: rowErrors.length === 0,
      errors: rowErrors,
      ...row,
    };
  });

  return {
    totalRows: preview.parsed.length,
    validRows: Math.max(0, preview.parsed.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.parsed.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    rows: previewRows,
  };
}

export async function importDiscountSpreadsheet(filePathOrRows: string | Record<string, unknown>[]) {
  const rows = typeof filePathOrRows === "string" ? readSpreadsheetRows(filePathOrRows) : (filePathOrRows as any);
  const preview = await validateDiscountRows(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };
  await prisma.$transaction(async (tx) => {
    for (const row of preview.parsed) {
      const payload = rowToPayload(row);
      const existing = row.id
        ? await tx.discount.findUnique({ where: { id: row.id } })
        : await tx.discount.findFirst({
            where: {
              name: row.name,
              type: payload.type,
              tierId: payload.tierId,
              countries: payload.countryIds.length > 0 ? { some: { id: { in: payload.countryIds } } } : undefined,
              products: payload.productIds.length > 0 ? { some: { id: { in: payload.productIds } } } : undefined,
              collections: payload.collectionIds.length > 0 ? { some: { id: { in: payload.collectionIds } } } : undefined,
              categories: payload.categoryIds.length > 0 ? { some: { id: { in: payload.categoryIds } } } : undefined,
              minQuantity: payload.minQuantity ? Number(payload.minQuantity) : null,
            },
          });

      const parsedPayload = await normalizeDiscountInput(payload, existing !== null);
      const { _relations, ...rest } = parsedPayload as any;

      if (existing) {
        await tx.discountCountry.deleteMany({ where: { discountId: existing.id } });
        await tx.discountProduct.deleteMany({ where: { discountId: existing.id } });
        await tx.discountCollection.deleteMany({ where: { discountId: existing.id } });
        await tx.discountCategory.deleteMany({ where: { discountId: existing.id } });

        await tx.discount.update({
          where: { id: existing.id },
          data: {
            ...rest,
            countries: _relations.countries.length > 0 ? { create: _relations.countries.map((countryId: string) => ({ countryId })) } : undefined,
            products: _relations.products.length > 0 ? { create: _relations.products.map((productId: string) => ({ productId })) } : undefined,
            collections: _relations.collections.length > 0 ? { create: _relations.collections.map((collectionId: string) => ({ collectionId })) } : undefined,
            categories: _relations.categories.length > 0 ? { create: _relations.categories.map((categoryId: string) => ({ categoryId })) } : undefined,
          } as any,
        });
        summary.updated += 1;
      } else {
        await tx.discount.create({
          data: {
            ...rest,
            countries: _relations.countries.length > 0 ? { create: _relations.countries.map((countryId: string) => ({ countryId })) } : undefined,
            products: _relations.products.length > 0 ? { create: _relations.products.map((productId: string) => ({ productId })) } : undefined,
            collections: _relations.collections.length > 0 ? { create: _relations.collections.map((collectionId: string) => ({ collectionId })) } : undefined,
            categories: _relations.categories.length > 0 ? { create: _relations.categories.map((categoryId: string) => ({ categoryId })) } : undefined,
          } as any,
        });
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
