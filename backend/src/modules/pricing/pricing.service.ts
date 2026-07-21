import type { Prisma } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, convertPrice, getPagination } from "../../utils/apiResponse";
import { readSpreadsheetRows, removeTempFile, writeSpreadsheetBuffer } from "../../utils/spreadsheet";
import { resolvePrice } from "./priceResolver.service";
import * as ProductsService from "../products/products.service";
import { assertTierUsable } from "../tiers/tiers.service";

type PricingStatus = "ACTIVE" | "INACTIVE";
type PricingRuleType = "BASE_PRICE" | "VARIANT_PRICE" | "TIER_PRICE" | "MOQ_PRICE" | "CUSTOMER_ROLE_PRICE";

type PricingListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  ruleType?: string;
  productId?: string;
  variantId?: string;
  countryId?: string;
  tierId?: string;
  minQuantity?: string;
  sortBy?: string;
  sortDir?: string;
  ids?: string[];
};

type SpreadsheetIssue = {
  row: number;
  field: string;
  message: string;
};

type SpreadsheetPreview = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: SpreadsheetIssue[];
  duplicateWarnings: string[];
  sampleRows: Array<Record<string, unknown>>;
};

type PricingPreviewInput = {
  productId: string;
  variantId?: string | null;
  countryId: string;
  quantity: number;
  customerId?: string | null;
  customerRoleKey?: string | null;
  tierId?: string | null;
};

type PricingBulkInput = {
  ids: string[];
  ruleType: PricingRuleType;
  action: "ENABLE" | "DISABLE" | "DELETE" | "DUPLICATE";
  countryId?: string | null;
  tierId?: string | null;
};

type PriceImportRow = {
  productId?: string;
  productCode?: string;
  productSlug?: string;
  variantId?: string;
  variantSku?: string;
  countryId?: string;
  countryCode?: string;
  mrp?: string | number;
  sellingPrice?: string | number;
  dealerPrice?: string | number;
  distributorPrice?: string | number;
  status?: string;
};

type NormalizedPricingRow = {
  id: string;
  ruleType: PricingRuleType;
  ruleName: string;
  productId: string;
  variantId: string | null;
  countryId: string | null;
  tierId: string | null;
  moq: number | null;
  status: PricingStatus;
  customerRole: string | null;
  basePrice: number | null;
  discount: number | null;
  priority: number;
  createdAt: Date;
  updatedAt: Date;
  createdBy: string | null;
  product: { id: string; title: string; sku: string | null };
  variant: { id: string; title: string; sku: string | null } | null;
  country: { id: string; name: string; code: string } | null;
  tier: { id: string; name: string } | null;
  details: Record<string, unknown>;
};

type ActiveStatusRecord = {
  id: string;
  status: string;
};

function money(value: Prisma.Decimal | number | string | null | undefined) {
  return Number(value ?? 0);
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function normalizeStatus(value?: string | null): PricingStatus {
  return value?.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
}

function normalizeRuleType(value?: string | null): PricingRuleType | null {
  if (!value) return null;
  const next = value.toUpperCase();
  return ["BASE_PRICE", "VARIANT_PRICE", "TIER_PRICE", "MOQ_PRICE", "CUSTOMER_ROLE_PRICE"].includes(next) ? (next as PricingRuleType) : null;
}

function normalizeSearch(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "";
}

function toDecimal(value: string | number | null | undefined) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new AppError("Pricing values must be non-negative numbers.", 400);
  return roundMoney(parsed);
}

function toPositiveInteger(value: string | number | null | undefined, field: string) {
  if (value === undefined || value === null || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) throw new AppError(`${field} must be at least 1.`, 400);
  return parsed;
}

function getRuleLabel(row: Omit<NormalizedPricingRow, "priority" | "createdBy" | "details">) {
  switch (row.ruleType) {
    case "BASE_PRICE":
      return `${row.product.title} country price`;
    case "VARIANT_PRICE":
      return `${row.product.title} / ${row.variant?.title ?? "Variant"} country price`;
    case "TIER_PRICE":
      return `${row.tier?.name ?? "Tier"} tier pricing`;
    case "MOQ_PRICE":
      return `${row.moq ?? 1}+ MOQ pricing`;
    case "CUSTOMER_ROLE_PRICE":
      return `${row.product.title} customer pricing`;
    default:
      return row.product.title;
  }
}

function buildPriceDiscount(row: {
  mrp?: number | null;
  sellingPrice?: number | null;
  fixedPrice?: number | null;
  discountPercent?: number | null;
}) {
  if (row.fixedPrice != null) return roundMoney(row.fixedPrice);
  if (row.discountPercent != null) return roundMoney(row.discountPercent);
  if (row.mrp != null && row.sellingPrice != null && row.mrp > row.sellingPrice) {
    return roundMoney(row.mrp - row.sellingPrice);
  }
  return null;
}

function ruleIsActive(row: NormalizedPricingRow) {
  if (row.status === "INACTIVE") return false;
  if (row.product && row.product.title && row.product.id) {
    // Product and variant statuses are enforced in queries where relevant.
  }
  return true;
}

async function assertActiveProduct(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    select: { id: true, title: true, status: true, hasVariants: true, defaultCurrencyId: true },
  });
  if (!product) throw new AppError("Product not found.", 404);
  if (product.status !== "ACTIVE") throw new AppError("Inactive products cannot be priced.", 400);
  return product;
}

async function assertActiveVariant(productId: string, variantId?: string | null) {
  if (!variantId) return null;
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId, status: { not: "INACTIVE" } },
    select: { id: true, title: true, sku: true, status: true },
  });
  if (!variant) throw new AppError("Variant not found for this product or it is inactive.", 404);
  return variant;
}

async function assertActiveCountry(countryId: string) {
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { id: true, name: true, code: true, status: true, currencyId: true },
  });
  if (!country) throw new AppError("Country not found.", 404);
  if (country.status !== "ACTIVE") throw new AppError("Inactive countries cannot be used in pricing.", 400);
  return country;
}

async function fetchActiveSnapshots() {
  const [products, variants, countries, tiers] = await Promise.all([
    prisma.product.findMany({
      where: { deletedAt: null },
      select: { id: true, title: true, status: true },
    }),
    prisma.productVariant.findMany({
      select: { id: true, title: true, status: true, productId: true, sku: true },
    }),
    prisma.country.findMany({
      select: { id: true, name: true, code: true, status: true },
    }),
    prisma.tier.findMany({
      select: { id: true, name: true, status: true },
    }),
  ]);

  return {
    productById: new Map(products.map((item) => [item.id, item])),
    variantById: new Map(variants.map((item) => [item.id, item])),
    countryById: new Map(countries.map((item) => [item.id, item])),
    tierById: new Map(tiers.map((item) => [item.id, item])),
  };
}

function mapProductPriceRow(price: Prisma.ProductPriceGetPayload<{
  include: {
    product: { select: { id: true; title: true; sku: true; status: true } };
    variant: { select: { id: true; title: true; sku: true; status: true } };
    country: { select: { id: true; name: true; code: true; status: true } };
    currency: true;
  };
}>, priority = 0): NormalizedPricingRow {
  const ruleType: PricingRuleType = price.variantId ? "VARIANT_PRICE" : "BASE_PRICE";
  const discount = buildPriceDiscount({
    mrp: money(price.mrp),
    sellingPrice: money(price.sellingPrice),
  });

  const customerRole = price.dealerPrice != null || price.distributorPrice != null
    ? [price.dealerPrice != null ? "Dealer" : null, price.distributorPrice != null ? "Doctor/Retailer" : null].filter(Boolean).join(", ")
    : null;

  return {
    id: price.id,
    ruleType,
    ruleName: price.variantId ? `${price.product.title} / ${price.variant?.title ?? "Variant"} country price` : `${price.product.title} country price`,
    productId: price.productId,
    variantId: price.variantId ?? null,
    countryId: price.countryId,
    tierId: null,
    moq: null,
    status: price.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
    customerRole,
    basePrice: money(price.sellingPrice),
    discount,
    priority,
    createdAt: price.createdAt,
    updatedAt: price.updatedAt,
    createdBy: null,
    product: {
      id: price.product.id,
      title: price.product.title,
      sku: price.product.sku,
    },
    variant: price.variant
      ? {
          id: price.variant.id,
          title: price.variant.title,
          sku: price.variant.sku,
        }
      : null,
    country: {
      id: price.country.id,
      name: price.country.name,
      code: price.country.code,
    },
    tier: null,
    details: {
      mrp: money(price.mrp),
      sellingPrice: money(price.sellingPrice),
      dealerPrice: price.dealerPrice != null ? money(price.dealerPrice) : null,
      distributorPrice: price.distributorPrice != null ? money(price.distributorPrice) : null,
      currency: {
        id: price.currency.id,
        code: price.currency.code,
        symbol: price.currency.symbol,
      },
    },
  };
}

function mapTierPriceRow(rule: Prisma.TierPricingGetPayload<{
  include: {
    tier: { select: { id: true; name: true; status: true } };
    product: { select: { id: true; title: true; sku: true; status: true } };
    variant: { select: { id: true; title: true; sku: true; status: true } };
    country: { select: { id: true; name: true; code: true; status: true } };
  };
}>, priority = 0): NormalizedPricingRow {
  return {
    id: rule.id,
    ruleType: "TIER_PRICE",
    ruleName: `${rule.tier.name} tier pricing`,
    productId: rule.productId,
    variantId: rule.variantId ?? null,
    countryId: rule.countryId,
    tierId: rule.tierId,
    moq: null,
    status: rule.tier.status === "ACTIVE" && rule.country.status === "ACTIVE" && rule.product.status === "ACTIVE" && (!rule.variant || rule.variant.status === "ACTIVE")
      ? "ACTIVE"
      : "INACTIVE",
    customerRole: null,
    basePrice: rule.fixedPrice != null ? money(rule.fixedPrice) : null,
    discount: rule.discountPercent != null ? money(rule.discountPercent) : null,
    priority,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    createdBy: null,
    product: {
      id: rule.product.id,
      title: rule.product.title,
      sku: rule.product.sku,
    },
    variant: rule.variant
      ? {
          id: rule.variant.id,
          title: rule.variant.title,
          sku: rule.variant.sku,
        }
      : null,
    country: {
      id: rule.country.id,
      name: rule.country.name,
      code: rule.country.code,
    },
    tier: {
      id: rule.tier.id,
      name: rule.tier.name,
    },
    details: {
      discountPercent: rule.discountPercent != null ? money(rule.discountPercent) : null,
      fixedPrice: rule.fixedPrice != null ? money(rule.fixedPrice) : null,
    },
  };
}

function mapMoqPriceRow(rule: Prisma.MoqPricingGetPayload<{
  include: {
    product: { select: { id: true; title: true; sku: true; status: true } };
    variant: { select: { id: true; title: true; sku: true; status: true } };
    country: { select: { id: true; name: true; code: true; status: true } };
  };
}>, priority = 0): NormalizedPricingRow {
  return {
    id: rule.id,
    ruleType: "MOQ_PRICE",
    ruleName: `${rule.minQuantity}+ MOQ pricing`,
    productId: rule.productId,
    variantId: rule.variantId ?? null,
    countryId: rule.countryId,
    tierId: null,
    moq: rule.minQuantity,
    status: rule.country.status === "ACTIVE" && rule.product.status === "ACTIVE" && (!rule.variant || rule.variant.status === "ACTIVE")
      ? "ACTIVE"
      : "INACTIVE",
    customerRole: null,
    basePrice: rule.fixedPrice != null ? money(rule.fixedPrice) : null,
    discount: rule.discountPercent != null ? money(rule.discountPercent) : null,
    priority,
    createdAt: rule.createdAt,
    updatedAt: rule.updatedAt,
    createdBy: null,
    product: {
      id: rule.product.id,
      title: rule.product.title,
      sku: rule.product.sku,
    },
    variant: rule.variant
      ? {
          id: rule.variant.id,
          title: rule.variant.title,
          sku: rule.variant.sku,
        }
      : null,
    country: {
      id: rule.country.id,
      name: rule.country.name,
      code: rule.country.code,
    },
    tier: null,
    details: {
      minQuantity: rule.minQuantity,
      discountPercent: rule.discountPercent != null ? money(rule.discountPercent) : null,
      fixedPrice: rule.fixedPrice != null ? money(rule.fixedPrice) : null,
    },
  };
}

async function collectPricingRows(query: PricingListQuery) {
  const search = normalizeSearch(query.search);
  const ruleType = normalizeRuleType(query.ruleType);
  const status = query.status ? normalizeStatus(query.status) : null;

  const ids = query.ids?.filter(Boolean) ?? [];
  const filters = {
    productId: query.productId || undefined,
    variantId: query.variantId || undefined,
    countryId: query.countryId || undefined,
    tierId: query.tierId || undefined,
    minQuantity: query.minQuantity ? Number(query.minQuantity) : undefined,
  };

  const [productPrices, tierPrices, moqPrices] = await Promise.all([
    ruleType && !["BASE_PRICE", "VARIANT_PRICE", "CUSTOMER_ROLE_PRICE"].includes(ruleType)
      ? Promise.resolve([])
      : prisma.productPrice.findMany({
          where: {
            ...(filters.productId ? { productId: filters.productId } : {}),
            ...(filters.variantId ? { variantId: filters.variantId } : {}),
            ...(filters.countryId ? { countryId: filters.countryId } : {}),
            ...(ids.length ? { id: { in: ids } } : {}),
            ...(status ? { status } : {}),
            ...(search
              ? {
                  OR: [
                    { product: { title: { contains: search, mode: "insensitive" } } },
                    { product: { sku: { contains: search, mode: "insensitive" } } },
                    { variant: { title: { contains: search, mode: "insensitive" } } },
                    { variant: { sku: { contains: search, mode: "insensitive" } } },
                    { country: { name: { contains: search, mode: "insensitive" } } },
                    { country: { code: { contains: search, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
          include: {
            product: { select: { id: true, title: true, sku: true, status: true } },
            variant: { select: { id: true, title: true, sku: true, status: true } },
            country: { select: { id: true, name: true, code: true, status: true } },
            currency: true,
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        }),
    ruleType && ruleType !== "TIER_PRICE"
      ? Promise.resolve([])
      : prisma.tierPricing.findMany({
          where: {
            ...(filters.productId ? { productId: filters.productId } : {}),
            ...(filters.variantId ? { variantId: filters.variantId } : {}),
            ...(filters.countryId ? { countryId: filters.countryId } : {}),
            ...(filters.tierId ? { tierId: filters.tierId } : {}),
            ...(ids.length ? { id: { in: ids } } : {}),
            ...(search
              ? {
                  OR: [
                    { product: { title: { contains: search, mode: "insensitive" } } },
                    { product: { sku: { contains: search, mode: "insensitive" } } },
                    { variant: { title: { contains: search, mode: "insensitive" } } },
                    { variant: { sku: { contains: search, mode: "insensitive" } } },
                    { country: { name: { contains: search, mode: "insensitive" } } },
                    { country: { code: { contains: search, mode: "insensitive" } } },
                    { tier: { name: { contains: search, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
          include: {
            tier: { select: { id: true, name: true, status: true } },
            product: { select: { id: true, title: true, sku: true, status: true } },
            variant: { select: { id: true, title: true, sku: true, status: true } },
            country: { select: { id: true, name: true, code: true, status: true } },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        }),
    ruleType && ruleType !== "MOQ_PRICE"
      ? Promise.resolve([])
      : prisma.moqPricing.findMany({
          where: {
            ...(filters.productId ? { productId: filters.productId } : {}),
            ...(filters.variantId ? { variantId: filters.variantId } : {}),
            ...(filters.countryId ? { countryId: filters.countryId } : {}),
            ...(filters.minQuantity ? { minQuantity: filters.minQuantity } : {}),
            ...(ids.length ? { id: { in: ids } } : {}),
            ...(search
              ? {
                  OR: [
                    { product: { title: { contains: search, mode: "insensitive" } } },
                    { product: { sku: { contains: search, mode: "insensitive" } } },
                    { variant: { title: { contains: search, mode: "insensitive" } } },
                    { variant: { sku: { contains: search, mode: "insensitive" } } },
                    { country: { name: { contains: search, mode: "insensitive" } } },
                    { country: { code: { contains: search, mode: "insensitive" } } },
                  ],
                }
              : {}),
          },
          include: {
            product: { select: { id: true, title: true, sku: true, status: true } },
            variant: { select: { id: true, title: true, sku: true, status: true } },
            country: { select: { id: true, name: true, code: true, status: true } },
          },
          orderBy: [{ updatedAt: "desc" }, { createdAt: "desc" }],
        }),
  ]);

  const combinedRows: NormalizedPricingRow[] = [
    ...productPrices.map((price, index) => mapProductPriceRow(price, index)),
    ...tierPrices.map((rule, index) => mapTierPriceRow(rule, index)),
    ...moqPrices.map((rule, index) => mapMoqPriceRow(rule, index)),
  ];

  const activeRows = combinedRows.filter((row) => ruleIsActive(row));
  const filteredRows = ruleType ? combinedRows.filter((row) => row.ruleType === ruleType) : combinedRows;

  const sortedRows = [...filteredRows].sort((a, b) => {
    const dir = query.sortDir === "asc" ? 1 : -1;
    switch (query.sortBy) {
      case "ruleName":
        return a.ruleName.localeCompare(b.ruleName) * dir;
      case "ruleType":
        return a.ruleType.localeCompare(b.ruleType) * dir;
      case "product":
        return a.product.title.localeCompare(b.product.title) * dir;
      case "country":
        return (a.country?.name ?? "").localeCompare(b.country?.name ?? "") * dir;
      case "tier":
        return (a.tier?.name ?? "").localeCompare(b.tier?.name ?? "") * dir;
      case "basePrice":
        return ((a.basePrice ?? 0) - (b.basePrice ?? 0)) * dir;
      case "status":
        return a.status.localeCompare(b.status) * dir;
      case "createdAt":
        return (a.createdAt.getTime() - b.createdAt.getTime()) * dir;
      case "updatedAt":
      default:
        return (a.updatedAt.getTime() - b.updatedAt.getTime()) * dir;
    }
  });

  const { page, limit, skip } = getPagination(query);
  const paged = sortedRows.slice(skip, skip + limit);

  return {
    data: paged,
    total: sortedRows.length,
    page,
    limit,
    counts: {
      totalRules: combinedRows.length,
      activeRules: activeRows.length,
      inactiveRules: combinedRows.length - activeRows.length,
      countryPricingRules: productPrices.length,
      tierPricingRules: tierPrices.length,
      moqPricingRules: moqPrices.length,
      variantPricingRules: combinedRows.filter((row) => row.ruleType === "VARIANT_PRICE").length,
      customerSpecificPricing: combinedRows.filter((row) => row.customerRole != null).length,
    },
    recentRules: [...combinedRows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5),
  };
}

async function createProductPrice(data: {
  productId: string;
  variantId?: string | null;
  countryId: string;
  currencyId: string;
  mrp: number | string;
  sellingPrice: number | string;
  dealerPrice?: number | string | null;
  distributorPrice?: number | string | null;
  status?: string;
}) {
  const product = await assertActiveProduct(data.productId);
  const variant = await assertActiveVariant(data.productId, data.variantId ?? null);
  const country = await assertActiveCountry(data.countryId);
  const currency = await prisma.currency.findUnique({ where: { id: data.currencyId }, select: { id: true, code: true, status: true } });
  if (!currency) throw new AppError("Currency not found.", 404);
  if (currency.status !== "ACTIVE") throw new AppError("Inactive currencies cannot be used in pricing.", 400);

  const mrp = toDecimal(data.mrp);
  const sellingPrice = toDecimal(data.sellingPrice);
  const dealerPrice = toDecimal(data.dealerPrice);
  const distributorPrice = toDecimal(data.distributorPrice);
  if (mrp == null || sellingPrice == null) throw new AppError("MRP and selling price are required.", 400);

  const duplicate = await prisma.productPrice.findFirst({
    where: { productId: product.id, variantId: variant?.id ?? null, countryId: country.id },
    select: { id: true },
  });
  if (duplicate) throw new AppError("A pricing rule already exists for this product/variant/country combination.", 409);

  return prisma.productPrice.create({
    data: {
      productId: product.id,
      variantId: variant?.id ?? null,
      countryId: country.id,
      currencyId: currency.id,
      mrp,
      sellingPrice,
      dealerPrice,
      distributorPrice,
      status: normalizeStatus(data.status ?? "ACTIVE"),
    },
    include: {
      product: { select: { id: true, title: true, sku: true, status: true } },
      variant: { select: { id: true, title: true, sku: true, status: true } },
      country: { select: { id: true, name: true, code: true, status: true } },
      currency: true,
    },
  });
}

async function updateProductPrice(
  id: string,
  data: {
    productId?: string;
    variantId?: string | null;
    countryId?: string;
    currencyId?: string;
    mrp?: number | string;
    sellingPrice?: number | string;
    dealerPrice?: number | string | null;
    distributorPrice?: number | string | null;
    status?: string;
  },
) {
  const existing = await prisma.productPrice.findUnique({ where: { id } });
  if (!existing) throw new AppError("Pricing rule not found.", 404);

  const productId = data.productId ?? existing.productId;
  const countryId = data.countryId ?? existing.countryId;
  const variantId = data.variantId === undefined ? existing.variantId : data.variantId;
  const currencyId = data.currencyId ?? existing.currencyId;

  await assertActiveProduct(productId);
  await assertActiveVariant(productId, variantId);
  await assertActiveCountry(countryId);
  const currency = await prisma.currency.findUnique({ where: { id: currencyId }, select: { id: true, status: true } });
  if (!currency) throw new AppError("Currency not found.", 404);
  if (currency.status !== "ACTIVE") throw new AppError("Inactive currencies cannot be used in pricing.", 400);

  const duplicate = await prisma.productPrice.findFirst({
    where: {
      productId,
      variantId: variantId ?? null,
      countryId,
      NOT: { id },
    },
    select: { id: true },
  });
  if (duplicate) throw new AppError("A pricing rule already exists for this product/variant/country combination.", 409);

  const mrp = data.mrp !== undefined ? toDecimal(data.mrp) : money(existing.mrp);
  const sellingPrice = data.sellingPrice !== undefined ? toDecimal(data.sellingPrice) : money(existing.sellingPrice);
  const dealerPrice = data.dealerPrice !== undefined ? toDecimal(data.dealerPrice) : existing.dealerPrice != null ? money(existing.dealerPrice) : null;
  const distributorPrice = data.distributorPrice !== undefined
    ? toDecimal(data.distributorPrice)
    : existing.distributorPrice != null
      ? money(existing.distributorPrice)
      : null;

  if (mrp == null || sellingPrice == null) throw new AppError("MRP and selling price are required.", 400);

  return prisma.productPrice.update({
    where: { id },
    data: {
      productId,
      variantId: variantId ?? null,
      countryId,
      currencyId,
      mrp,
      sellingPrice,
      dealerPrice,
      distributorPrice,
      status: data.status ? normalizeStatus(data.status) : existing.status,
    },
    include: {
      product: { select: { id: true, title: true, sku: true, status: true } },
      variant: { select: { id: true, title: true, sku: true, status: true } },
      country: { select: { id: true, name: true, code: true, status: true } },
      currency: true,
    },
  });
}

async function deleteProductPrice(id: string) {
  const existing = await prisma.productPrice.findUnique({ where: { id } });
  if (!existing) throw new AppError("Pricing rule not found.", 404);
  await prisma.productPrice.delete({ where: { id } });
}

async function duplicateProductPrice(id: string) {
  const existing = await prisma.productPrice.findUnique({
    where: { id },
    include: {
      product: { select: { id: true, title: true, sku: true, status: true } },
      variant: { select: { id: true, title: true, sku: true, status: true } },
      country: { select: { id: true, name: true, code: true, status: true } },
      currency: true,
    },
  });
  if (!existing) throw new AppError("Pricing rule not found.", 404);
  return existing;
}

async function bulkPricingAction(input: PricingBulkInput) {
  if (!Array.isArray(input.ids) || input.ids.length === 0) throw new AppError("Select at least one pricing rule.", 400);
  const uniqueIds = Array.from(new Set(input.ids));

  if (input.ruleType === "BASE_PRICE" || input.ruleType === "VARIANT_PRICE" || input.ruleType === "CUSTOMER_ROLE_PRICE") {
    const rules = await prisma.productPrice.findMany({ where: { id: { in: uniqueIds } } });
    if (rules.length !== uniqueIds.length) throw new AppError("One or more pricing rules were not found.", 404);

    if (input.action === "ENABLE" || input.action === "DISABLE") {
      return prisma.$transaction(
        uniqueIds.map((ruleId) =>
          prisma.productPrice.update({
            where: { id: ruleId },
            data: { status: input.action === "ENABLE" ? "ACTIVE" : "INACTIVE" },
          }),
        ),
      );
    }

    if (input.action === "DELETE") {
      await prisma.productPrice.deleteMany({ where: { id: { in: uniqueIds } } });
      return { affected: uniqueIds.length };
    }

    if (input.action === "DUPLICATE") {
      const created = [];
      for (const ruleId of uniqueIds) {
        created.push(await duplicateProductPrice(ruleId));
      }
      return created;
    }

    if (input.countryId) {
      const country = await assertActiveCountry(input.countryId);
      return prisma.$transaction(
        rules.map((rule) =>
          prisma.productPrice.update({
            where: { id: rule.id },
            data: { countryId: country.id },
          }),
        ),
      );
    }

    throw new AppError("Unsupported bulk action for product pricing rules.", 400);
  }

  if (input.ruleType === "TIER_PRICE") {
    const rules = await prisma.tierPricing.findMany({ where: { id: { in: uniqueIds } } });
    if (rules.length !== uniqueIds.length) throw new AppError("One or more pricing rules were not found.", 404);

    if (input.action === "DELETE") {
      await prisma.tierPricing.deleteMany({ where: { id: { in: uniqueIds } } });
      return { affected: uniqueIds.length };
    }

    if (input.action === "DUPLICATE") {
      return rules;
    }

    if (input.countryId) {
      const country = await assertActiveCountry(input.countryId);
      return prisma.$transaction(
        rules.map((rule) =>
          prisma.tierPricing.update({
            where: { id: rule.id },
            data: { countryId: country.id },
          }),
        ),
      );
    }

    if (input.tierId) {
      const tierId = input.tierId;
      await assertTierUsable(tierId);
      return prisma.$transaction(
        rules.map((rule) =>
          prisma.tierPricing.update({
            where: { id: rule.id },
            data: { tierId },
          }),
        ),
      );
    }

    throw new AppError("Unsupported bulk action for tier pricing rules.", 400);
  }

  if (input.ruleType === "MOQ_PRICE") {
    const rules = await prisma.moqPricing.findMany({ where: { id: { in: uniqueIds } } });
    if (rules.length !== uniqueIds.length) throw new AppError("One or more pricing rules were not found.", 404);

    if (input.action === "DELETE") {
      await prisma.moqPricing.deleteMany({ where: { id: { in: uniqueIds } } });
      return { affected: uniqueIds.length };
    }

    if (input.action === "DUPLICATE") {
      return rules;
    }

    if (input.countryId) {
      const country = await assertActiveCountry(input.countryId);
      return prisma.$transaction(
        rules.map((rule) =>
          prisma.moqPricing.update({
            where: { id: rule.id },
            data: { countryId: country.id },
          }),
        ),
      );
    }

    throw new AppError("Unsupported bulk action for MOQ pricing rules.", 400);
  }

  throw new AppError("Unsupported pricing rule type.", 400);
}

async function resolvePricingPreview(input: PricingPreviewInput) {
  if (!input.productId) throw new AppError("Product is required for preview.", 400);
  if (!input.countryId) throw new AppError("Country is required for preview.", 400);
  if (!Number.isInteger(input.quantity) || input.quantity < 1) {
    throw new AppError("Quantity must be at least 1.", 400);
  }

  return resolvePrice({
    productId: input.productId,
    variantId: input.variantId ?? null,
    countryId: input.countryId,
    customerId: input.customerId ?? null,
    customerRoleKey: input.customerRoleKey ?? null,
    tierId: input.tierId ?? null,
    quantity: input.quantity,
  });
}

async function previewPriceImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath).map((row) => ({
    productId: row.productId?.trim() || undefined,
    productCode: row.productCode?.trim() || undefined,
    productSlug: row.productSlug?.trim() || undefined,
    variantId: row.variantId?.trim() || undefined,
    variantSku: row.variantSku?.trim() || undefined,
    countryId: row.countryId?.trim() || undefined,
    countryCode: row.countryCode?.trim().toUpperCase() || undefined,
    mrp: row.mrp,
    sellingPrice: row.sellingPrice,
    dealerPrice: row.dealerPrice,
    distributorPrice: row.distributorPrice,
    status: row.status?.trim().toUpperCase() || undefined,
  })) as PriceImportRow[];

  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seen = new Set<string>();

  const productIds = new Set<string>();
  const productCodes = new Set<string>();
  const productSlugs = new Set<string>();
  const variantIds = new Set<string>();
  const variantSkus = new Set<string>();
  const countryIds = new Set<string>();
  const countryCodes = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const key = `${row.productId ?? row.productCode ?? row.productSlug ?? ""}:${row.variantId ?? row.variantSku ?? ""}:${row.countryId ?? row.countryCode ?? ""}`;
    if (seen.has(key)) {
      const message = `Duplicate pricing row detected on row ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "row", message });
      duplicateWarnings.push(message);
    }
    seen.add(key);

    if (!row.productId && !row.productCode && !row.productSlug) {
      issues.push({ row: rowNumber, field: "productId", message: "Provide productId, productCode, or productSlug." });
    }
    if (!row.countryId && !row.countryCode) {
      issues.push({ row: rowNumber, field: "countryId", message: "Provide countryId or countryCode." });
    }
    if (row.mrp === undefined || row.mrp === "") issues.push({ row: rowNumber, field: "mrp", message: "MRP is required." });
    if (row.sellingPrice === undefined || row.sellingPrice === "") issues.push({ row: rowNumber, field: "sellingPrice", message: "Selling price is required." });

    if (row.productId) productIds.add(row.productId);
    if (row.productCode) productCodes.add(row.productCode);
    if (row.productSlug) productSlugs.add(row.productSlug);
    if (row.variantId) variantIds.add(row.variantId);
    if (row.variantSku) variantSkus.add(row.variantSku);
    if (row.countryId) countryIds.add(row.countryId);
    if (row.countryCode) countryCodes.add(row.countryCode);
  }

  const [products, variants, countries, existing] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(productIds.size ? [{ id: { in: Array.from(productIds) } }] : []),
          ...(productCodes.size ? [{ productCode: { in: Array.from(productCodes) } }] : []),
          ...(productSlugs.size ? [{ slug: { in: Array.from(productSlugs) } }] : []),
        ],
      },
      select: { id: true, title: true, sku: true, productCode: true, slug: true, status: true },
    }),
    prisma.productVariant.findMany({
      where: {
        OR: [
          ...(variantIds.size ? [{ id: { in: Array.from(variantIds) } }] : []),
          ...(variantSkus.size ? [{ sku: { in: Array.from(variantSkus) } }] : []),
        ],
      },
      select: { id: true, title: true, sku: true, productId: true, status: true },
    }),
    prisma.country.findMany({
      where: {
        OR: [
          ...(countryIds.size ? [{ id: { in: Array.from(countryIds) } }] : []),
          ...(countryCodes.size ? [{ code: { in: Array.from(countryCodes) } }] : []),
        ],
      },
      select: { id: true, name: true, code: true, status: true },
    }),
    prisma.productPrice.findMany({
      where: {
        OR: [
          ...(productIds.size ? [{ productId: { in: Array.from(productIds) } }] : []),
          ...(productCodes.size
            ? [
                {
                  product: { productCode: { in: Array.from(productCodes) } },
                },
              ]
            : []),
          ...(productSlugs.size ? [{ product: { slug: { in: Array.from(productSlugs) } } }] : []),
        ],
      },
      select: {
        productId: true,
        variantId: true,
        countryId: true,
      },
    }),
  ]);

  const productById = new Map(products.map((item) => [item.id, item]));
  const productBySku = new Map(products.filter((item) => item.sku).map((item) => [item.sku as string, item]));
  const productByCode = new Map(products.filter((item) => item.productCode).map((item) => [item.productCode as string, item]));
  const productBySlug = new Map(products.filter((item) => item.slug).map((item) => [item.slug as string, item]));
  const variantById = new Map(variants.map((item) => [item.id, item]));
  const variantBySku = new Map(variants.filter((item) => item.sku).map((item) => [item.sku as string, item]));
  const countryById = new Map(countries.map((item) => [item.id, item]));
  const countryByCode = new Map(countries.map((item) => [item.code, item]));
  const existingByKey = new Set(existing.map((item) => `${item.productId}:${item.variantId ?? ""}:${item.countryId}`));

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const product =
      (row.productId ? productById.get(row.productId) : null) ||
      (row.productCode ? productByCode.get(row.productCode) : null) ||
      (row.productSlug ? productBySlug.get(row.productSlug) : null) ||
      null;
    const variant =
      (row.variantId ? variantById.get(row.variantId) : null) ||
      (row.variantSku ? variantBySku.get(row.variantSku) : null) ||
      null;
    const country =
      (row.countryId ? countryById.get(row.countryId) : null) ||
      (row.countryCode ? countryByCode.get(row.countryCode) : null) ||
      null;

    if (!product) {
      issues.push({ row: rowNumber, field: "product", message: "Product was not found." });
    } else if (product.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "product", message: "Product is inactive." });
    }

    if (variant) {
      if (!product || variant.productId !== product.id) {
        issues.push({ row: rowNumber, field: "variant", message: "Variant does not belong to the selected product." });
      }
      if (variant.status !== "ACTIVE") {
        issues.push({ row: rowNumber, field: "variant", message: "Variant is inactive." });
      }
    }

    if (!country) {
      issues.push({ row: rowNumber, field: "country", message: "Country was not found." });
    } else if (country.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "country", message: "Country is inactive." });
    }

    const priceKey = `${product?.id ?? row.productId ?? row.productCode ?? row.productSlug}:${variant?.id ?? row.variantId ?? row.variantSku ?? ""}:${country?.id ?? row.countryId ?? row.countryCode}`;
    if (product && country && existingByKey.has(`${product.id}:${variant?.id ?? row.variantId ?? ""}:${country.id}`)) {
      duplicateWarnings.push(`Row ${rowNumber} matches an existing pricing rule.`);
    }

    const numericFields = ["mrp", "sellingPrice", "dealerPrice", "distributorPrice"] as const;
    for (const field of numericFields) {
      const raw = row[field];
      if (raw !== undefined && raw !== "") {
        const parsed = Number(raw);
        if (!Number.isFinite(parsed) || parsed < 0) {
          issues.push({ row: rowNumber, field, message: `${field} must be a non-negative number.` });
        }
      }
    }
    void priceKey;
  }

  return {
    rows,
    issues,
    duplicateWarnings,
  };
}

function exportRows(rows: NormalizedPricingRow[]) {
  return writeSpreadsheetBuffer(
    rows.map((row) => ({
      ruleType: row.ruleType,
      ruleName: row.ruleName,
      productId: row.productId,
      productTitle: row.product.title,
      variantId: row.variantId ?? "",
      variantTitle: row.variant?.title ?? "",
      countryCode: row.country?.code ?? "",
      countryName: row.country?.name ?? "",
      tierName: row.tier?.name ?? "",
      moq: row.moq ?? "",
      status: row.status,
      basePrice: row.basePrice ?? "",
      discount: row.discount ?? "",
      customerRole: row.customerRole ?? "",
      updatedAt: row.updatedAt.toISOString(),
    })),
    "Pricing",
    [
      { key: "ruleType", header: "ruleType" },
      { key: "ruleName", header: "ruleName" },
      { key: "productId", header: "productId" },
      { key: "productTitle", header: "productTitle" },
      { key: "variantId", header: "variantId" },
      { key: "variantTitle", header: "variantTitle" },
      { key: "countryCode", header: "countryCode" },
      { key: "countryName", header: "countryName" },
      { key: "tierName", header: "tierName" },
      { key: "moq", header: "moq" },
      { key: "status", header: "status" },
      { key: "basePrice", header: "basePrice" },
      { key: "discount", header: "discount" },
      { key: "customerRole", header: "customerRole" },
      { key: "updatedAt", header: "updatedAt" },
    ],
  );
}

async function importPriceSpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewPriceImport(filePath);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };
  await prisma.$transaction(async (tx) => {
    for (const row of rows as PriceImportRow[]) {
      const product =
        (row.productId ? await tx.product.findUnique({ where: { id: row.productId }, select: { id: true, status: true } }) : null) ||
        (row.productCode ? await tx.product.findFirst({ where: { productCode: row.productCode, deletedAt: null }, select: { id: true, status: true } }) : null) ||
        (row.productSlug ? await tx.product.findFirst({ where: { slug: row.productSlug, deletedAt: null }, select: { id: true, status: true } }) : null);
      if (!product) throw new AppError("Product not found during import.", 400);

      const variant =
        (row.variantId ? await tx.productVariant.findUnique({ where: { id: row.variantId }, select: { id: true, productId: true, status: true } }) : null) ||
        (row.variantSku ? await tx.productVariant.findFirst({ where: { sku: row.variantSku }, select: { id: true, productId: true, status: true } }) : null);

      if (variant && variant.productId !== product.id) throw new AppError("Variant does not belong to selected product.", 400);

      const country =
        (row.countryId ? await tx.country.findUnique({ where: { id: row.countryId }, select: { id: true, status: true } }) : null) ||
        (row.countryCode ? await tx.country.findFirst({ where: { code: row.countryCode }, select: { id: true, status: true } }) : null);
      if (!country) throw new AppError("Country not found during import.", 400);

      const normalizedMrp = toDecimal(row.mrp);
      const normalizedSellingPrice = toDecimal(row.sellingPrice);
      const normalizedDealerPrice = toDecimal(row.dealerPrice);
      const normalizedDistributorPrice = toDecimal(row.distributorPrice);
      if (normalizedMrp == null || normalizedSellingPrice == null) throw new AppError("MRP and selling price are required.", 400);

      const existing = await tx.productPrice.findFirst({
        where: { productId: product.id, variantId: variant?.id ?? null, countryId: country.id },
        select: { id: true },
      });

      if (existing) {
        await tx.productPrice.update({
          where: { id: existing.id },
          data: {
            mrp: normalizedMrp,
            sellingPrice: normalizedSellingPrice,
            dealerPrice: normalizedDealerPrice,
            distributorPrice: normalizedDistributorPrice,
            status: normalizeStatus(row.status ?? "ACTIVE"),
          },
        });
        summary.updated += 1;
      } else {
        const baseCurrency = await tx.currency.findFirst({ where: { isBase: true }, select: { id: true } });
        if (!baseCurrency) throw new AppError("Base currency not configured.", 400);

        await tx.productPrice.create({
          data: {
            productId: product.id,
            variantId: variant?.id ?? null,
            countryId: country.id,
            currencyId: baseCurrency.id,
            mrp: normalizedMrp,
            sellingPrice: normalizedSellingPrice,
            dealerPrice: normalizedDealerPrice,
            distributorPrice: normalizedDistributorPrice,
            status: normalizeStatus(row.status ?? "ACTIVE"),
          },
        });
        summary.created += 1;
      }
    }
  });

  return {
    ...summary,
    report: preview,
  };
}

export async function getPricingDashboard() {
  const { counts, recentRules } = await collectPricingRows({ limit: "100", page: "1" });
  return {
    ...counts,
    recentlyUpdatedRules: recentRules,
  };
}

export async function listPricing(queryOrProductId?: PricingListQuery | string) {
  if (typeof queryOrProductId === "string") {
    const result = await collectPricingRows({ productId: queryOrProductId });
    return result.data;
  }
  const result = await collectPricingRows(queryOrProductId ?? {});
  return result;
}

export async function createPrice(data: Record<string, unknown>) {
  return createProductPrice(data as Parameters<typeof createProductPrice>[0]);
}

export async function updatePrice(id: string, data: Record<string, unknown>) {
  return updateProductPrice(id, data as Parameters<typeof updateProductPrice>[1]);
}

export async function deletePrice(id: string) {
  return deleteProductPrice(id);
}

export async function duplicatePrice(id: string) {
  return duplicateProductPrice(id);
}

export async function bulkUpdatePricing(input: PricingBulkInput) {
  return bulkPricingAction(input);
}

export type GenerateCountryPricesInput = {
  mrp: number;
  sellingPrice?: number;
  variantOverrides?: Record<string, { mrp: number; sellingPrice?: number }>;
};

function computeLandedPrice(
  basePriceInBaseCurrency: number,
  country: { currency: { exchangeRate: Prisma.Decimal | number }; dutyPercentage: Prisma.Decimal | number; shippingCharge: Prisma.Decimal | number },
  baseCurrencyRate: number,
) {
  const localBase = convertPrice(basePriceInBaseCurrency, Number(country.currency.exchangeRate) / baseCurrencyRate);
  const dutyPercent = Number(country.dutyPercentage) || 0;
  const shipping = Number(country.shippingCharge) || 0;
  const landed = localBase + (localBase * dutyPercent) / 100 + shipping;
  const mrp = Math.round((landed + Number.EPSILON) * 100) / 100;
  const sellingPrice = Math.round((landed + Number.EPSILON) * 100) / 100;
  return { mrp, sellingPrice };
}

export async function generateCountryPrices(
  productId: string,
  input: GenerateCountryPricesInput,
) {
  const product = await assertActiveProduct(productId);
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new AppError("No base currency configured.", 400);

  const [countries, variants] = await Promise.all([
    prisma.country.findMany({
      where: { status: "ACTIVE" },
      include: { currency: true },
    }),
    prisma.productVariant.findMany({
      where: { productId, status: "ACTIVE" },
      select: { id: true },
    }),
  ]);

  const baseCurrencyRate = Number(baseCurrency.exchangeRate);

  const priceRows = countries.flatMap((country) => {
    const { mrp, sellingPrice } = computeLandedPrice(input.mrp, country, baseCurrencyRate);
    const baseRow = {
      productId,
      countryId: country.id,
      currencyId: country.currencyId,
      mrp: input.sellingPrice != null ? input.sellingPrice : mrp,
      sellingPrice: input.sellingPrice != null ? input.sellingPrice : mrp,
      status: "ACTIVE" as const,
      variantId: null as string | null,
    };
    const variantRows = variants.map((variant) => {
      const override = input.variantOverrides?.[variant.id];
      const variantLanded = override
        ? { mrp: override.mrp, sellingPrice: override.sellingPrice != null ? override.sellingPrice : override.mrp }
        : computeLandedPrice(input.mrp, country, baseCurrencyRate);
      return {
        ...baseRow,
        variantId: variant.id,
        mrp: variantLanded.mrp,
        sellingPrice: variantLanded.sellingPrice,
      };
    });
    return [baseRow, ...variantRows];
  });

  for (const price of priceRows) {
    const existing = await prisma.productPrice.findFirst({
      where: {
        productId: price.productId,
        variantId: price.variantId,
        countryId: price.countryId,
      },
      select: { id: true },
    });

    if (existing) {
      await prisma.productPrice.update({
        where: { id: existing.id },
        data: {
          currencyId: price.currencyId,
          mrp: price.mrp,
          sellingPrice: price.sellingPrice,
          status: price.status,
        },
      });
      continue;
    }

    await prisma.productPrice.create({
      data: price,
    });
  }

  return {
    productId: product.id,
    generated: priceRows.length,
    variantsPriced: variants.length,
  };
}

export async function previewPricing(input: PricingPreviewInput) {
  return resolvePricingPreview(input);
}

export async function exportPricingSpreadsheet(query: PricingListQuery) {
  const result = await collectPricingRows(query);
  return exportRows(result.data);
}

export async function previewPricingImport(filePath: string) {
  const preview = await previewPriceImport(filePath);
  removeTempFile(filePath);
  return {
    totalRows: preview.rows.length,
    validRows: Math.max(0, preview.rows.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.rows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
  } satisfies SpreadsheetPreview;
}

export async function importPricingSpreadsheet(filePath: string) {
  return importPriceSpreadsheet(filePath);
}

export async function createTierPricing(productId: string, data: Record<string, unknown>) {
  return ProductsService.createTierPricing(productId, data as never);
}

export async function updateTierPricing(productId: string, ruleId: string, data: Record<string, unknown>) {
  return ProductsService.updateTierPricing(productId, ruleId, data as never);
}

export async function deleteTierPricing(productId: string, ruleId: string) {
  return ProductsService.deleteTierPricing(productId, ruleId);
}

export async function createMoqPricing(productId: string, data: Record<string, unknown>) {
  return ProductsService.createMoqPricing(productId, data as never);
}

export async function updateMoqPricing(productId: string, ruleId: string, data: Record<string, unknown>) {
  return ProductsService.updateMoqPricing(productId, ruleId, data as never);
}

export async function deleteMoqPricing(productId: string, ruleId: string) {
  return ProductsService.deleteMoqPricing(productId, ruleId);
}
