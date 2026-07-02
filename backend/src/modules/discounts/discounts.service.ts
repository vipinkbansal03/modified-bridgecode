import { DiscountRuleType, Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination } from "../../utils/apiResponse";
import { assertTierUsable } from "../tiers/tiers.service";

const DISCOUNT_TYPES: DiscountRuleType[] = ["TIER", "MOQ", "PROMOTIONAL"];
const DISCOUNT_STATUSES: Status[] = ["ACTIVE", "INACTIVE"];

type DiscountInput = {
  name?: string;
  type?: DiscountRuleType;
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
  if (type && !DISCOUNT_TYPES.includes(type)) throw new AppError("Discount type must be TIER, MOQ, or PROMOTIONAL.", 400);
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
};

export async function listDiscounts(query: DiscountListQuery) {
  const { page, limit, skip } = getPagination(query);
  const search = query.search?.trim();
  const type = query.type?.trim().toUpperCase();
  const status = query.status?.trim().toUpperCase();
  const scope = query.scope?.trim().toUpperCase();
  const countryId = blankToNull(query.countryId) as string | null;

  if (type && !DISCOUNT_TYPES.includes(type as DiscountRuleType)) {
    throw new AppError("Invalid discount type.", 400);
  }
  if (status && !DISCOUNT_STATUSES.includes(status as Status)) {
    throw new AppError("Invalid discount status.", 400);
  }
  if (scope && !["PLATFORM", "PRODUCT", "COLLECTION", "CATEGORY"].includes(scope)) {
    throw new AppError("Invalid discount scope.", 400);
  }

  const where: Prisma.DiscountWhereInput = {
    ...(type ? { type: type as DiscountRuleType } : {}),
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
  const [data, total] = await Promise.all([
    prisma.discount.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      include: { tier: true, country: true, product: { select: { id: true, title: true, slug: true } }, collection: true, category: true },
    }),
    prisma.discount.count({ where }),
  ]);
  return { data, total, page, limit };
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
