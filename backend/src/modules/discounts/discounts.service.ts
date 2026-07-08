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
  discountPercent?: number | string | null;
  fixedAmount?: number | string | null;
  countryId?: string | null;
  productId?: string | null;
  categoryId?: string | null;
  collectionId?: string | null;
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
    country: true,
    product: { select: { id: true, title: true, slug: true } },
    collection: true,
    category: true,
  };
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
  if (status && !DISCOUNT_STATUSES.includes(status as Status)) {
    throw new AppError("Invalid discount status.", 400);
  }
  if (scope && !["PLATFORM", "PRODUCT", "COLLECTION", "CATEGORY"].includes(scope)) {
    throw new AppError("Invalid discount scope.", 400);
  }
  if (type === "PROMOTIONAL" && !(await supportsPromotionalDiscountType())) {
    return { id: { in: [] } };
  }

  const where: Prisma.DiscountWhereInput = {
    ...(type ? { type: type as never } : {}),
    ...(status ? { status: status as Status } : {}),
    ...(countryId ? { countryId } : {}),
    ...(scope === "PLATFORM" ? { productId: null, collectionId: null, categoryId: null } : {}),
    ...(scope === "PRODUCT" ? { productId: { not: null } } : {}),
    ...(scope === "COLLECTION" ? { collectionId: { not: null } } : {}),
    ...(scope === "CATEGORY" ? { categoryId: { not: null } } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { product: { title: { contains: search, mode: "insensitive" } } },
            { collection: { name: { contains: search, mode: "insensitive" } } },
            { category: { name: { contains: search, mode: "insensitive" } } },
            { tier: { name: { contains: search, mode: "insensitive" } } },
            { country: { name: { contains: search, mode: "insensitive" } } },
            { country: { code: { contains: search, mode: "insensitive" } } },
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
  const countryId = blankToNull(input.countryId) as string | null;
  const productId = blankToNull(input.productId) as string | null;
  const categoryId = blankToNull(input.categoryId) as string | null;
  const collectionId = blankToNull(input.collectionId) as string | null;
  const minQuantity = intOrNull(input.minQuantity, "Minimum quantity");
  const discountPercent = decimalOrNull(input.discountPercent, "Discount percent");
  const fixedAmount = decimalOrNull(input.fixedAmount, "Fixed amount");
  const startDate = dateOrNull(input.startDate, "Start date");
  const endDate = dateOrNull(input.endDate, "End date");

  if (discountPercent !== null && fixedAmount !== null) {
    throw new AppError("Set either discount percent or fixed amount, not both.", 400);
  }
  if (discountPercent === null && fixedAmount === null) {
    throw new AppError("Set either discount percent or fixed amount.", 400);
  }
  if (discountPercent !== null && discountPercent.gt(100)) {
    throw new AppError("Discount percent cannot exceed 100.", 400);
  }
  const scopedTargets = [productId, collectionId, categoryId].filter(Boolean).length;
  if (scopedTargets > 1) {
    throw new AppError("Discount can target a product, collection, or category, not more than one.", 400);
  }
  if (startDate && endDate && endDate < startDate) {
    throw new AppError("End date must be after start date.", 400);
  }
  if (type === "TIER") {
    if (!tierId) throw new AppError("Tier discounts require a tier.", 400);
    if (minQuantity !== null) throw new AppError("Tier discounts cannot set minimum quantity.", 400);
  }
  if (type === "MOQ") {
    if (minQuantity === null) throw new AppError("MOQ discounts require minimum quantity.", 400);
    if (tierId) throw new AppError("MOQ discounts cannot be tied to a tier.", 400);
  }
  if (type === "PROMOTIONAL") {
    if (tierId) throw new AppError("Promotional discounts cannot be tied to a tier.", 400);
    if (minQuantity !== null) throw new AppError("Promotional discounts cannot set minimum quantity.", 400);
    if (!(await supportsPromotionalDiscountType())) {
      throw new AppError("Promotional discounts are not available until the database enum migration is applied.", 409);
    }
  }

  await Promise.all([
    tierId ? assertTierUsable(tierId, { countryId }) : Promise.resolve(null),
    assertExists("country", countryId),
    assertExists("product", productId),
    assertExists("collection", collectionId),
    assertExists("category", categoryId),
  ]);

  return {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(type !== undefined ? { type } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    tierId,
    minQuantity,
    discountPercent,
    fixedAmount,
    countryId,
    productId,
    collectionId,
    categoryId,
    startDate,
    endDate,
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
  return { data, total, page, limit };
}

export async function getDiscountDashboard() {
  const promotionalSupported = await supportsPromotionalDiscountType();
  const [total, active, inactive, tier, moq, promotional, recentlyUpdated] = await Promise.all([
    prisma.discount.count(),
    prisma.discount.count({ where: { status: "ACTIVE" } }),
    prisma.discount.count({ where: { status: "INACTIVE" } }),
    prisma.discount.count({ where: { type: "TIER" } }),
    prisma.discount.count({ where: { type: "MOQ" } }),
    promotionalSupported ? prisma.discount.count({ where: { type: "PROMOTIONAL" } }) : Promise.resolve(0),
    prisma.discount.findMany({
      take: 5,
      orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
      include: discountInclude(),
    }),
  ]);

  return {
    totalDiscounts: total,
    activeDiscounts: active,
    inactiveDiscounts: inactive,
    tierDiscounts: tier,
    moqDiscounts: moq,
    promotionalDiscounts: promotional,
    recentlyUpdated,
  };
}

export async function createDiscount(input: DiscountInput) {
  const data = await normalizeDiscountInput(input);
  return prisma.discount.create({
    data: data as Prisma.DiscountUncheckedCreateInput,
    include: { tier: true, country: true, product: { select: { id: true, title: true, slug: true } }, collection: true, category: true },
  });
}

export async function updateDiscount(id: string, input: DiscountInput) {
  const current = await prisma.discount.findUnique({ where: { id } });
  if (!current) throw new AppError("Discount not found.", 404);
  const merged = { ...current, ...input } as DiscountInput;
  const data = await normalizeDiscountInput(merged, true);
  return prisma.discount.update({
    where: { id },
    data: data as Prisma.DiscountUncheckedUpdateInput,
    include: { tier: true, country: true, product: { select: { id: true, title: true, slug: true } }, collection: true, category: true },
  });
}

export async function deleteDiscount(id: string) {
  await prisma.discount.delete({ where: { id } });
}

type BulkDiscountInput = {
  ids?: string[];
  action?: "ENABLE" | "DISABLE" | "DELETE";
};

export async function bulkDiscounts(input: BulkDiscountInput) {
  const ids = Array.isArray(input.ids) ? input.ids.filter(Boolean) : [];
  if (!ids.length) throw new AppError("Select at least one discount.", 400);
  if (!input.action || !["ENABLE", "DISABLE", "DELETE"].includes(input.action)) {
    throw new AppError("Invalid bulk action.", 400);
  }

  if (input.action === "DELETE") {
    const result = await prisma.discount.deleteMany({ where: { id: { in: ids } } });
    return { affected: result.count };
  }

  const result = await prisma.discount.updateMany({
    where: { id: { in: ids } },
    data: { status: input.action === "ENABLE" ? "ACTIVE" : "INACTIVE" },
  });
  return { affected: result.count };
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

function parseDiscountRow(raw: Record<string, string>): DiscountSpreadsheetRow {
  return {
    id: raw.id?.trim() || "",
    name: raw.name?.trim() || "",
    type: raw.type?.trim().toUpperCase() || "",
    status: raw.status?.trim().toUpperCase() || "ACTIVE",
    tierId: raw.tierId?.trim() || "",
    minQuantity: raw.minQuantity?.trim() || "",
    discountPercent: raw.discountPercent?.trim() || "",
    fixedAmount: raw.fixedAmount?.trim() || "",
    countryId: raw.countryId?.trim() || "",
    productId: raw.productId?.trim() || "",
    collectionId: raw.collectionId?.trim() || "",
    categoryId: raw.categoryId?.trim() || "",
    startDate: raw.startDate?.trim() || "",
    endDate: raw.endDate?.trim() || "",
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
    countryId: row.countryId || null,
    productId: row.productId || null,
    collectionId: row.collectionId || null,
    categoryId: row.categoryId || null,
    startDate: row.startDate || null,
    endDate: row.endDate || null,
  };
}

async function validateDiscountRows(rows: Record<string, string>[]) {
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
    if (row.countryId) relatedIds.countryIds.add(row.countryId);
    if (row.productId) relatedIds.productIds.add(row.productId);
    if (row.collectionId) relatedIds.collectionIds.add(row.collectionId);
    if (row.categoryId) relatedIds.categoryIds.add(row.categoryId);

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

  const [tiers, countries, products, categories, collections] = await Promise.all([
    relatedIds.tierIds.size ? prisma.tier.findMany({ where: { id: { in: Array.from(relatedIds.tierIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.countryIds.size ? prisma.country.findMany({ where: { id: { in: Array.from(relatedIds.countryIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.productIds.size ? prisma.product.findMany({ where: { id: { in: Array.from(relatedIds.productIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.categoryIds.size ? prisma.category.findMany({ where: { id: { in: Array.from(relatedIds.categoryIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
    relatedIds.collectionIds.size ? prisma.collection.findMany({ where: { id: { in: Array.from(relatedIds.collectionIds) } }, select: { id: true, status: true } }) : Promise.resolve([]),
  ]);

  const tierById = new Map(tiers.map((tier) => [tier.id, tier]));
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const productById = new Map(products.map((product) => [product.id, product]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const collectionById = new Map(collections.map((collection) => [collection.id, collection]));

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (row.tierId) {
      const tier = tierById.get(row.tierId);
      if (!tier) issues.push({ row: rowNumber, field: "tierId", message: "Tier not found." });
      else if (tier.status !== "ACTIVE") issues.push({ row: rowNumber, field: "tierId", message: "Tier is inactive." });
    }
    if (row.countryId) {
      const country = countryById.get(row.countryId);
      if (!country) issues.push({ row: rowNumber, field: "countryId", message: "Country not found." });
      else if (country.status !== "ACTIVE") issues.push({ row: rowNumber, field: "countryId", message: "Country is inactive." });
    }
    if (row.productId) {
      const product = productById.get(row.productId);
      if (!product) issues.push({ row: rowNumber, field: "productId", message: "Product not found." });
      else if (product.status !== "ACTIVE") issues.push({ row: rowNumber, field: "productId", message: "Product is inactive." });
    }
    if (row.categoryId) {
      const category = categoryById.get(row.categoryId);
      if (!category) issues.push({ row: rowNumber, field: "categoryId", message: "Category not found." });
      else if (category.status !== "ACTIVE") issues.push({ row: rowNumber, field: "categoryId", message: "Category is inactive." });
    }
    if (row.collectionId) {
      const collection = collectionById.get(row.collectionId);
      if (!collection) issues.push({ row: rowNumber, field: "collectionId", message: "Collection not found." });
      else if (collection.status !== "ACTIVE") issues.push({ row: rowNumber, field: "collectionId", message: "Collection is inactive." });
    }
  }

  return { parsed, issues, duplicateWarnings };
}

export async function exportDiscountsSpreadsheet(query: DiscountListQuery & { ids?: string }) {
  const ids = query.ids?.split(",").map((id) => id.trim()).filter(Boolean) ?? [];
  const where = ids.length ? { id: { in: ids } } : await buildDiscountWhere(query);
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
      countryId: discount.countryId ?? "",
      productId: discount.productId ?? "",
      collectionId: discount.collectionId ?? "",
      categoryId: discount.categoryId ?? "",
      startDate: discount.startDate ? discount.startDate.toISOString() : "",
      endDate: discount.endDate ? discount.endDate.toISOString() : "",
    })),
    "Discounts",
    DISCOUNT_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export async function previewDiscountImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await validateDiscountRows(rows);
  return {
    totalRows: preview.parsed.length,
    validRows: Math.max(0, preview.parsed.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.parsed.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
  };
}

export async function importDiscountSpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
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
              countryId: payload.countryId,
              productId: payload.productId,
              collectionId: payload.collectionId,
              categoryId: payload.categoryId,
              minQuantity: payload.minQuantity ? Number(payload.minQuantity) : null,
            },
          });

      if (existing) {
        await tx.discount.update({ where: { id: existing.id }, data: await normalizeDiscountInput(payload, true) as Prisma.DiscountUncheckedUpdateInput });
        summary.updated += 1;
      } else {
        await tx.discount.create({ data: await normalizeDiscountInput(payload) as Prisma.DiscountUncheckedCreateInput });
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
