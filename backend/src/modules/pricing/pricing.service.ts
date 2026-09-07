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
  deleted?: string;
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
  productTitle?: string;
  variantId?: string;
  variantSku?: string;
  countryId?: string;
  countryCode?: string;
  countryName?: string;
  mrp?: string | number;
  sellingPrice?: string | number;
  dealerPrice?: string | number;
  distributorPrice?: string | number;
  doctorRetailerPrice?: string | number;
  status?: string;
};

function getRowField(row: Record<string, any>, ...possibleKeys: string[]): string {
  if (!row || typeof row !== "object") return "";
  for (const key of possibleKeys) {
    const val = row[key];
    if (val !== undefined && val !== null) {
      if (Array.isArray(val)) {
        const joined = val.map((v) => String(v).trim()).filter(Boolean).join(", ");
        if (joined) return joined;
      } else {
        const str = String(val).trim();
        if (str !== "" && str !== "[object Object]") return str;
      }
    }
  }
  const rowEntries = Object.entries(row);
  for (const key of possibleKeys) {
    const cleanKey = key.toLowerCase().replace(/[^a-z0-9]/g, "");
    for (const [rowK, rowVal] of rowEntries) {
      const cleanRowK = rowK.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (cleanKey === cleanRowK) {
        if (rowVal !== undefined && rowVal !== null) {
          if (Array.isArray(rowVal)) {
            const joined = rowVal.map((v) => String(v).trim()).filter(Boolean).join(", ");
            if (joined) return joined;
          } else {
            const str = String(rowVal).trim();
            if (str !== "" && str !== "[object Object]") return str;
          }
        }
      }
    }
  }
  return "";
}

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
  deletedAt: Date | null;
  canPermanentDelete: boolean;
  permanentDeleteBlockReason: string | null;
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
  const clean = typeof value === "string" ? value.replace(/[^0-9.-]+/g, "") : value;
  if (clean === "" || clean === null || clean === undefined) return null;
  const parsed = Number(clean);
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
      where: { status: "ACTIVE" },
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
    deletedAt: price.deletedAt ?? null,
    canPermanentDelete: false,
    permanentDeleteBlockReason: null,
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
    deletedAt: rule.deletedAt ?? null,
    canPermanentDelete: false,
    permanentDeleteBlockReason: null,
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
    deletedAt: rule.deletedAt ?? null,
    canPermanentDelete: false,
    permanentDeleteBlockReason: null,
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

export async function checkSoleActiveBasePrice(
  priceId: string,
  action: "archive" | "deactivate" | "delete" = "archive"
): Promise<{ isSole: boolean; reason?: string }> {
  const rule = await prisma.productPrice.findUnique({
    where: { id: priceId },
    include: {
      product: {
        select: {
          id: true,
          title: true,
          status: true,
          deletedAt: true,
          hasVariants: true,
        },
      },
      variant: { select: { id: true, title: true, status: true } },
      country: { select: { id: true, name: true, code: true } },
    },
  });

  if (!rule) return { isSole: false };

  // If parent Product is inactive or soft-deleted:
  // allowing the pricing rule operation (deactivate/archive) is acceptable because the Product
  // is already unavailable for normal storefront/checkout resolution.
  const productUnavailable =
    rule.product.deletedAt !== null ||
    rule.product.status === "INACTIVE" ||
    rule.product.status === "ARCHIVED";

  if (productUnavailable) {
    // Hard-delete safety requirement: active pricing rules cannot be permanently deleted without being archived first.
    if (action === "delete" && rule.deletedAt === null) {
      return {
        isSole: true,
        reason: "Active pricing rules cannot be permanently deleted. Archive the pricing rule first.",
      };
    }
    return { isSole: false };
  }

  // If rule is already inactive or archived and action is deactivate/archive:
  if (action === "deactivate" && rule.status === "INACTIVE") {
    return { isSole: false };
  }
  if (action === "archive" && rule.deletedAt !== null) {
    return { isSole: false };
  }

  // Hard-delete requirement: must be archived first
  if (action === "delete" && rule.deletedAt === null) {
    return {
      isSole: true,
      reason: "Active pricing rules cannot be permanently deleted. Archive the pricing rule first.",
    };
  }

  // Exact resolution hierarchy check in the affected country (rule.countryId):
  // 1. If rule is a VARIANT PRICE (rule.variantId != null):
  // Context is: (Product rule.productId, Variant rule.variantId, Country rule.countryId).
  // In the resolver, fallback is: (Product rule.productId, variantId: null, Country rule.countryId, status: "ACTIVE", deletedAt: null).
  if (rule.variantId !== null) {
    const activeBaseFallback = await prisma.productPrice.findFirst({
      where: {
        productId: rule.productId,
        variantId: null,
        countryId: rule.countryId,
        status: "ACTIVE",
        deletedAt: null,
        NOT: { id: rule.id },
      },
      select: { id: true },
    });

    if (activeBaseFallback) {
      // Active base price fallback exists in the same country!
      return { isSole: false };
    }

    // No active base price exists in this country for this product!
    return {
      isSole: true,
      reason: `Cannot ${action} this pricing rule because it is the only active price available for this product/variant. Add another active base price or fallback first.`,
    };
  }

  // 2. If rule is a PRODUCT BASE PRICE (rule.variantId == null):
  // In this country (rule.countryId), this is the authoritative base price and fallback for all variants.
  // Because of @@unique([productId, variantId, countryId]), no other product-level base price can exist in this country.
  // Removing it leaves the country without a base price, breaking resolution for the product and any variants without specific prices.
  return {
    isSole: true,
    reason: `Cannot ${action} this pricing rule because it is the only active price available for this product/variant. Add another active base price or fallback first.`,
  };
}

async function collectPricingRows(query: PricingListQuery) {
  const search = normalizeSearch(query.search);
  const ruleType = normalizeRuleType(query.ruleType);
  const status = query.status ? normalizeStatus(query.status) : null;

  const ids = query.ids?.filter(Boolean) ?? [];
  const countryIdsFilter = query.countryId && query.countryId !== "ALL"
    ? (() => {
        const parsedIds = query.countryId.split(",").map((s) => s.trim()).filter((s) => Boolean(s) && s !== "ALL");
        return parsedIds.length > 1 ? { countryId: { in: parsedIds } } : parsedIds.length === 1 ? { countryId: parsedIds[0] } : {};
      })()
    : {};
  const filters = {
    productId: query.productId || undefined,
    variantId: query.variantId || undefined,
    tierId: query.tierId || undefined,
    minQuantity: query.minQuantity ? Number(query.minQuantity) : undefined,
  };

  const isDeletedQuery = query.deleted === "true";
  const deletedWhere = isDeletedQuery ? { not: null } : null;
  const productFilter = isDeletedQuery ? {} : { product: { deletedAt: null } };

  const [productPrices, tierPrices, moqPrices, archivedProductPricesCount, archivedTierPricesCount, archivedMoqPricesCount] = await Promise.all([
    ruleType && !["BASE_PRICE", "VARIANT_PRICE", "CUSTOMER_ROLE_PRICE"].includes(ruleType)
      ? Promise.resolve([])
      : prisma.productPrice.findMany({
          where: {
            deletedAt: deletedWhere,
            ...productFilter,
            ...(filters.productId ? { productId: filters.productId } : {}),
            ...(filters.variantId ? { variantId: filters.variantId } : {}),
            ...countryIdsFilter,
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
            deletedAt: deletedWhere,
            ...productFilter,
            ...(filters.productId ? { productId: filters.productId } : {}),
            ...(filters.variantId ? { variantId: filters.variantId } : {}),
            ...countryIdsFilter,
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
            deletedAt: deletedWhere,
            ...productFilter,
            ...(filters.productId ? { productId: filters.productId } : {}),
            ...(filters.variantId ? { variantId: filters.variantId } : {}),
            ...countryIdsFilter,
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
    prisma.productPrice.count({ where: { deletedAt: { not: null } } }),
    prisma.tierPricing.count({ where: { deletedAt: { not: null } } }),
    prisma.moqPricing.count({ where: { deletedAt: { not: null } } }),
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

  await Promise.all(
    paged.map(async (row) => {
      if (row.ruleType === "BASE_PRICE" || row.ruleType === "VARIANT_PRICE" || row.ruleType === "CUSTOMER_ROLE_PRICE") {
        if (!row.deletedAt) {
          row.canPermanentDelete = false;
          row.permanentDeleteBlockReason = "Active pricing rules cannot be permanently deleted. Archive the pricing rule first.";
        } else {
          const check = await checkSoleActiveBasePrice(row.id, "delete");
          if (check.isSole) {
            row.canPermanentDelete = false;
            row.permanentDeleteBlockReason = check.reason || "Cannot permanently delete sole active pricing rule.";
          } else {
            row.canPermanentDelete = true;
            row.permanentDeleteBlockReason = null;
          }
        }
      } else if (row.ruleType === "TIER_PRICE") {
        if (!row.deletedAt) {
          row.canPermanentDelete = false;
          row.permanentDeleteBlockReason = "Active tier pricing rules cannot be permanently deleted. Archive the rule first.";
        } else {
          row.canPermanentDelete = true;
          row.permanentDeleteBlockReason = null;
        }
      } else if (row.ruleType === "MOQ_PRICE") {
        if (!row.deletedAt) {
          row.canPermanentDelete = false;
          row.permanentDeleteBlockReason = "Active MOQ pricing rules cannot be permanently deleted. Archive the rule first.";
        } else {
          row.canPermanentDelete = true;
          row.permanentDeleteBlockReason = null;
        }
      }
    }),
  );

  return {
    data: paged,
    total: sortedRows.length,
    page,
    limit,
    counts: {
      totalRules: combinedRows.length,
      activeRules: activeRows.length,
      inactiveRules: combinedRows.length - activeRows.length,
      archivedRules: archivedProductPricesCount + archivedTierPricesCount + archivedMoqPricesCount,
      countryPricingRules: productPrices.length,
      tierPricingRules: tierPrices.length,
      moqPricingRules: moqPrices.length,
      variantPricingRules: combinedRows.filter((row) => row.ruleType === "VARIANT_PRICE").length,
      customerSpecificPricing: combinedRows.filter((row) => row.customerRole != null).length,
    },
    recentRules: [...combinedRows].sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()).slice(0, 5),
  };
}

function validatePricingFields(
  roleKey: string | null | undefined,
  dealerPrice: unknown,
  distributorPrice: unknown,
) {
  if (roleKey === "DEALER") {
    if (dealerPrice == null) {
      throw new AppError("Dealer Price is required for B2B Wholesale / Dealer rules.", 400);
    }
  } else if (roleKey === "DOCTOR_RETAILER") {
    if (distributorPrice == null) {
      throw new AppError("Doctor / Retailer Price is required for Doctor / Retailer rules.", 400);
    }
  } else if (roleKey === "GUEST") {
    // Guest only requires MRP and Selling Price (already checked outside)
  } else {
    // None / Any case: all four are required
    if (dealerPrice == null || distributorPrice == null) {
      throw new AppError("Dealer Price and Doctor / Retailer Price are required for standard pricing rules.", 400);
    }
  }
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
  customerRoleKey?: string | null;
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

  if (mrp == null || sellingPrice == null) {
    throw new AppError("MRP and selling price are required.", 400);
  }

  validatePricingFields(data.customerRoleKey, dealerPrice, distributorPrice);

  const duplicate = await prisma.productPrice.findFirst({
    where: { productId: product.id, variantId: variant?.id ?? null, countryId: country.id },
    select: { id: true, deletedAt: true },
  });
  if (duplicate) {
    if (duplicate.deletedAt) {
      return prisma.productPrice.update({
        where: { id: duplicate.id },
        data: {
          currencyId: currency.id,
          mrp,
          sellingPrice,
          dealerPrice,
          distributorPrice,
          status: normalizeStatus(data.status ?? "ACTIVE"),
          deletedAt: null,
        },
        include: {
          product: { select: { id: true, title: true, sku: true, status: true } },
          variant: { select: { id: true, title: true, sku: true, status: true } },
          country: { select: { id: true, name: true, code: true, status: true } },
          currency: true,
        },
      });
    }
    throw new AppError("A pricing rule already exists for this product/variant/country combination.", 409);
  }

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
    customerRoleKey?: string | null;
  },
) {
  const existing = await prisma.productPrice.findUnique({ where: { id } });
  if (!existing) throw new AppError("Pricing rule not found.", 404);

  if (data.status && normalizeStatus(data.status) === "INACTIVE" && existing.status === "ACTIVE") {
    const check = await checkSoleActiveBasePrice(id, "deactivate");
    if (check.isSole) {
      throw new AppError(check.reason || "Cannot deactivate this pricing rule because it is the only active price available for this product/variant. Add another active base price or fallback first.", 400);
    }
  }

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
      deletedAt: null,
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

  if (mrp == null || sellingPrice == null) {
    throw new AppError("MRP and selling price are required.", 400);
  }

  validatePricingFields(data.customerRoleKey, dealerPrice, distributorPrice);

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
  return softDeletePrice(id);
}

export async function softDeletePrice(id: string) {
  const pp = await prisma.productPrice.findUnique({
    where: { id },
    include: { product: true, variant: true },
  });
  if (pp) {
    if (pp.deletedAt) throw new AppError("Pricing rule is already archived.", 400);
    const check = await checkSoleActiveBasePrice(id, "archive");
    if (check.isSole) {
      throw new AppError(check.reason || "Cannot archive this pricing rule because it is the only active price available for this product/variant. Add another active base price or fallback first.", 400);
    }
    return prisma.productPrice.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  const tp = await prisma.tierPricing.findUnique({ where: { id } });
  if (tp) {
    if (tp.deletedAt) throw new AppError("Tier pricing rule is already archived.", 400);
    return prisma.tierPricing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  const mp = await prisma.moqPricing.findUnique({ where: { id } });
  if (mp) {
    if (mp.deletedAt) throw new AppError("MOQ pricing rule is already archived.", 400);
    return prisma.moqPricing.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  throw new AppError("Pricing rule not found.", 404);
}

export async function restorePrice(id: string) {
  const pp = await prisma.productPrice.findUnique({ where: { id } });
  if (pp) {
    if (!pp.deletedAt) throw new AppError("Pricing rule is already active.", 400);

    const conflict = await prisma.productPrice.findFirst({
      where: {
        productId: pp.productId,
        variantId: pp.variantId,
        countryId: pp.countryId,
        deletedAt: null,
        NOT: { id },
      },
    });
    if (conflict) {
      throw new AppError(
        "Cannot restore this pricing rule because an active pricing rule already exists for this product/variant and country combination.",
        409,
      );
    }

    return prisma.productPrice.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  const tp = await prisma.tierPricing.findUnique({ where: { id } });
  if (tp) {
    if (!tp.deletedAt) throw new AppError("Tier pricing rule is already active.", 400);

    const conflict = await prisma.tierPricing.findFirst({
      where: {
        tierId: tp.tierId,
        productId: tp.productId,
        variantId: tp.variantId,
        countryId: tp.countryId,
        deletedAt: null,
        NOT: { id },
      },
    });
    if (conflict) {
      throw new AppError(
        "Cannot restore this tier pricing rule because an active rule already exists for this tier, product/variant, and country combination.",
        409,
      );
    }

    return prisma.tierPricing.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  const mp = await prisma.moqPricing.findUnique({ where: { id } });
  if (mp) {
    if (!mp.deletedAt) throw new AppError("MOQ pricing rule is already active.", 400);

    const conflict = await prisma.moqPricing.findFirst({
      where: {
        productId: mp.productId,
        variantId: mp.variantId,
        countryId: mp.countryId,
        minQuantity: mp.minQuantity,
        deletedAt: null,
        NOT: { id },
      },
    });
    if (conflict) {
      throw new AppError(
        "Cannot restore this MOQ pricing rule because an active rule already exists for this MOQ quantity, product/variant, and country combination.",
        409,
      );
    }

    return prisma.moqPricing.update({
      where: { id },
      data: { deletedAt: null },
    });
  }

  throw new AppError("Pricing rule not found.", 404);
}

export async function permanentDeletePrice(id: string) {
  const pp = await prisma.productPrice.findUnique({
    where: { id },
    include: { product: true, variant: true },
  });
  if (pp) {
    if (!pp.deletedAt) {
      throw new AppError("Cannot permanently delete an active pricing rule. Please archive it first.", 400);
    }
    const check = await checkSoleActiveBasePrice(id, "delete");
    if (check.isSole) {
      throw new AppError(check.reason || "Cannot permanently delete this pricing rule.", 400);
    }
    await prisma.productPrice.delete({ where: { id } });
    return { success: true };
  }

  const tp = await prisma.tierPricing.findUnique({ where: { id } });
  if (tp) {
    if (!tp.deletedAt) {
      throw new AppError("Cannot permanently delete an active tier pricing rule. Please archive it first.", 400);
    }
    await prisma.tierPricing.delete({ where: { id } });
    return { success: true };
  }

  const mp = await prisma.moqPricing.findUnique({ where: { id } });
  if (mp) {
    if (!mp.deletedAt) {
      throw new AppError("Cannot permanently delete an active MOQ pricing rule. Please archive it first.", 400);
    }
    await prisma.moqPricing.delete({ where: { id } });
    return { success: true };
  }

  throw new AppError("Pricing rule not found.", 404);
}

export async function bulkPermanentDeletePricing(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const pp = await prisma.productPrice.findUnique({
        where: { id },
        include: { product: true, variant: true },
      });
      if (pp) {
        const ruleName = pp.variantId
          ? `${pp.product.title} / ${pp.variant?.title ?? "Variant"} country price`
          : `${pp.product.title} country price`;

        if (!pp.deletedAt) {
          blocked.push({
            id,
            name: ruleName,
            reason: "Cannot permanently delete an active pricing rule. Please archive it first.",
          });
          continue;
        }

        const check = await checkSoleActiveBasePrice(id, "delete");
        if (check.isSole) {
          blocked.push({
            id,
            name: ruleName,
            reason: check.reason || "Cannot permanently delete sole active pricing rule.",
          });
          continue;
        }

        await prisma.productPrice.delete({ where: { id } });
        deletedIds.push(id);
        continue;
      }

      const tp = await prisma.tierPricing.findUnique({
        where: { id },
        include: { tier: true, product: true },
      });
      if (tp) {
        const ruleName = `${tp.tier.name} tier pricing (${tp.product.title})`;
        if (!tp.deletedAt) {
          blocked.push({
            id,
            name: ruleName,
            reason: "Cannot permanently delete an active tier pricing rule. Please archive it first.",
          });
          continue;
        }
        await prisma.tierPricing.delete({ where: { id } });
        deletedIds.push(id);
        continue;
      }

      const mp = await prisma.moqPricing.findUnique({
        where: { id },
        include: { product: true },
      });
      if (mp) {
        const ruleName = `${mp.minQuantity}+ MOQ pricing (${mp.product.title})`;
        if (!mp.deletedAt) {
          blocked.push({
            id,
            name: ruleName,
            reason: "Cannot permanently delete an active MOQ pricing rule. Please archive it first.",
          });
          continue;
        }
        await prisma.moqPricing.delete({ where: { id } });
        deletedIds.push(id);
        continue;
      }

      blocked.push({ id, name: id, reason: "Pricing rule not found." });
    } catch (err: any) {
      blocked.push({ id, name: id, reason: err?.message || "Failed to permanently delete pricing rule." });
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}

export async function bulkRestorePricing(ids: string[]) {
  const restoredIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of ids) {
    try {
      await restorePrice(id);
      restoredIds.push(id);
    } catch (err: any) {
      blocked.push({ id, name: id, reason: err?.message || "Failed to restore pricing rule." });
    }
  }

  return {
    restoredCount: restoredIds.length,
    blockedCount: blocked.length,
    restoredIds,
    blocked,
  };
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

  if (input.action === "DELETE") {
    const deletedIds: string[] = [];
    const blocked: Array<{ id: string; name: string; reason: string }> = [];

    for (const id of uniqueIds) {
      try {
        await softDeletePrice(id);
        deletedIds.push(id);
      } catch (err: any) {
        blocked.push({
          id,
          name: id,
          reason: err?.message || "Cannot archive pricing rule.",
        });
      }
    }

    return {
      affected: deletedIds.length,
      deletedCount: deletedIds.length,
      blockedCount: blocked.length,
      deletedIds,
      blocked,
    };
  }

  if (input.ruleType === "BASE_PRICE" || input.ruleType === "VARIANT_PRICE" || input.ruleType === "CUSTOMER_ROLE_PRICE") {
    const rules = await prisma.productPrice.findMany({ where: { id: { in: uniqueIds } } });
    if (rules.length !== uniqueIds.length) throw new AppError("One or more pricing rules were not found.", 404);

    if (input.action === "ENABLE") {
      return prisma.$transaction(
        uniqueIds.map((ruleId) =>
          prisma.productPrice.update({
            where: { id: ruleId },
            data: { status: "ACTIVE" },
          }),
        ),
      );
    }

    if (input.action === "DISABLE") {
      const updatedIds: string[] = [];
      const blocked: Array<{ id: string; name: string; reason: string }> = [];

      for (const rule of rules) {
        const ruleName = rule.variantId
          ? "Variant country price"
          : "Product country price";
        const check = await checkSoleActiveBasePrice(rule.id, "deactivate");
        if (check.isSole) {
          blocked.push({
            id: rule.id,
            name: ruleName,
            reason: check.reason || "Cannot deactivate this pricing rule because it is the only active price available for this product/variant. Add another active base price or fallback first.",
          });
        } else {
          await prisma.productPrice.update({
            where: { id: rule.id },
            data: { status: "INACTIVE" },
          });
          updatedIds.push(rule.id);
        }
      }

      return {
        affected: updatedIds.length,
        affectedCount: updatedIds.length,
        blockedCount: blocked.length,
        updatedIds,
        blocked,
      };
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

async function previewPriceImport(filePathOrRows: string | Record<string, unknown>[]) {
  const rawRows = typeof filePathOrRows === "string" ? readSpreadsheetRows(filePathOrRows) : filePathOrRows;
  const rows = rawRows.map((raw) => {
    const row = raw as Record<string, any>;
    const productId = getRowField(row, "productId", "product_id", "id");
    const productCode = getRowField(row, "productCode", "product_code", "code");
    const productSlug = getRowField(row, "productSlug", "product_slug", "slug");
    const productTitle = getRowField(row, "productTitle", "product_title", "productName", "product_name", "product", "title");

    const variantId = getRowField(row, "variantId", "variant_id");
    const variantSku = getRowField(row, "variantSku", "variant_sku", "sku", "variant");

    const countryId = getRowField(row, "countryId", "country_id");
    const countryCode = getRowField(row, "countryCode", "country_code", "country", "isoCode");
    const countryName = getRowField(row, "countryName", "country_name");

    const mrp = getRowField(row, "mrp", "maxRetailPrice", "maximumRetailPrice");
    const sellingPrice = getRowField(row, "sellingPrice", "selling_price", "price", "salePrice");
    const dealerPrice = getRowField(row, "dealerPrice", "dealer_price", "wholesalePrice");
    const distributorPrice = getRowField(
      row,
      "doctorRetailerPrice",
      "doctorPrice",
      "retailerPrice",
      "doctor_retailer_price",
      "doctor_price",
      "retailer_price",
      "doctor/retailer price",
      "distributorPrice",
      "distributor_price"
    );
    const status = getRowField(row, "status", "state");

    return {
      productId: productId || undefined,
      productCode: productCode || undefined,
      productSlug: productSlug || undefined,
      productTitle: productTitle || undefined,
      variantId: variantId || undefined,
      variantSku: variantSku || undefined,
      countryId: countryId || undefined,
      countryCode: countryCode ? countryCode.toUpperCase() : undefined,
      countryName: countryName || undefined,
      mrp: mrp !== "" ? mrp : undefined,
      sellingPrice: sellingPrice !== "" ? sellingPrice : undefined,
      dealerPrice: dealerPrice !== "" ? dealerPrice : undefined,
      distributorPrice: distributorPrice !== "" ? distributorPrice : undefined,
      doctorRetailerPrice: distributorPrice !== "" ? distributorPrice : undefined,
      status: status ? status.toUpperCase() : undefined,
    } as PriceImportRow;
  });

  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seen = new Set<string>();

  const productIds = new Set<string>();
  const productCodes = new Set<string>();
  const productSlugs = new Set<string>();
  const productTitles = new Set<string>();
  const variantIds = new Set<string>();
  const variantSkus = new Set<string>();
  const countryIds = new Set<string>();
  const countryCodes = new Set<string>();
  const countryNames = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const key = `${row.productId ?? row.productCode ?? row.productSlug ?? row.productTitle ?? ""}:${row.variantId ?? row.variantSku ?? ""}:${row.countryId ?? row.countryCode ?? row.countryName ?? ""}`;
    if (seen.has(key)) {
      const message = `Duplicate pricing row detected on row ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "row", message });
      duplicateWarnings.push(message);
    }
    seen.add(key);

    if (!row.productId && !row.productCode && !row.productSlug && !row.productTitle) {
      issues.push({ row: rowNumber, field: "productCode", message: "Provide productCode, productTitle, or slug." });
    }
    if (!row.countryId && !row.countryCode && !row.countryName) {
      issues.push({ row: rowNumber, field: "countryCode", message: "Provide country code or country name." });
    }
    if (row.mrp === undefined || row.mrp === "") issues.push({ row: rowNumber, field: "mrp", message: "MRP is required." });
    if (row.sellingPrice === undefined || row.sellingPrice === "") issues.push({ row: rowNumber, field: "sellingPrice", message: "Selling price is required." });

    if (row.productId) productIds.add(row.productId);
    if (row.productCode) productCodes.add(row.productCode);
    if (row.productSlug) productSlugs.add(row.productSlug);
    if (row.productTitle) productTitles.add(row.productTitle);
    if (row.variantId) variantIds.add(row.variantId);
    if (row.variantSku) variantSkus.add(row.variantSku);
    if (row.countryId) countryIds.add(row.countryId);
    if (row.countryCode) countryCodes.add(row.countryCode);
    if (row.countryName) countryNames.add(row.countryName);
  }

  const [products, variants, countries, existing] = await Promise.all([
    prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(productIds.size ? [{ id: { in: Array.from(productIds) } }] : []),
          ...(productCodes.size ? [{ productCode: { in: Array.from(productCodes) } }] : []),
          ...(productSlugs.size ? [{ slug: { in: Array.from(productSlugs) } }] : []),
          ...(productTitles.size ? [{ title: { in: Array.from(productTitles), mode: "insensitive" as const } }] : []),
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
          ...(countryCodes.size ? [{ name: { in: Array.from(countryCodes), mode: "insensitive" as const } }] : []),
          ...(countryNames.size ? [{ name: { in: Array.from(countryNames), mode: "insensitive" as const } }] : []),
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
  const productByCode = new Map(products.filter((item) => item.productCode).map((item) => [(item.productCode as string).toUpperCase(), item]));
  const productBySlug = new Map(products.filter((item) => item.slug).map((item) => [item.slug as string, item]));
  const productByTitle = new Map(products.map((item) => [item.title.toLowerCase(), item]));

  const variantById = new Map(variants.map((item) => [item.id, item]));
  const variantBySku = new Map(variants.filter((item) => item.sku).map((item) => [item.sku as string, item]));

  const countryById = new Map(countries.map((item) => [item.id, item]));
  const countryByCode = new Map(countries.map((item) => [item.code.toUpperCase(), item]));
  const countryByName = new Map(countries.map((item) => [item.name.toLowerCase(), item]));
  const existingByKey = new Set(existing.map((item) => `${item.productId}:${item.variantId ?? ""}:${item.countryId}`));

  const previewRows: any[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const product =
      (row.productId ? productById.get(row.productId) : null) ||
      (row.productCode ? productByCode.get(row.productCode.toUpperCase()) : null) ||
      (row.productSlug ? productBySlug.get(row.productSlug) : null) ||
      (row.productTitle ? productByTitle.get(row.productTitle.toLowerCase()) : null) ||
      null;
    const variant =
      (row.variantId ? variantById.get(row.variantId) : null) ||
      (row.variantSku ? variantBySku.get(row.variantSku) : null) ||
      null;
    const rawCountryCode = String(row.countryCode || "").trim();
    const rawCountryName = String(row.countryName || "").trim();
    const rawCountryId = String(row.countryId || "").trim();
    const isAllCountries =
      rawCountryCode.toUpperCase() === "ALL" ||
      rawCountryCode.toUpperCase() === "GLOBAL" ||
      rawCountryCode === "*" ||
      rawCountryName.toUpperCase() === "ALL" ||
      rawCountryName.toLowerCase() === "all countries" ||
      rawCountryCode.toLowerCase() === "all countries" ||
      rawCountryId.toUpperCase() === "ALL";

    const subCodes = rawCountryCode.split(/[,;|]/).map((s) => {
      let c = s.trim().toUpperCase();
      if (c === "ALL" || c === "GLOBAL" || c === "*" || c === "ALL COUNTRIES") return "ALL";
      const parenMatch = c.match(/\(([A-Z]{2,3})\)$/);
      if (parenMatch) c = parenMatch[1];
      return c;
    }).filter(Boolean);

    let country: any = null;
    if (isAllCountries || subCodes.includes("ALL")) {
      country = { id: "ALL", code: "ALL", name: "All countries", status: "ACTIVE" };
    } else if (subCodes.length > 1) {
      const resolved: Array<typeof countries[0]> = [];
      for (const c of subCodes) {
        const found = countryByCode.get(c) || countryByName.get(c.toLowerCase());
        if (found) resolved.push(found);
      }
      if (resolved.length === subCodes.length) {
        const inactive = resolved.find((c) => c.status !== "ACTIVE");
        country = inactive || {
          id: "MULTI",
          code: resolved.map((c) => c.code).join(", "),
          name: resolved.map((c) => c.name).join(", "),
          status: "ACTIVE",
        };
      }
    } else {
      country =
        (row.countryId ? countryById.get(row.countryId) : null) ||
        (row.countryCode ? countryByCode.get(rawCountryCode.toUpperCase()) : null) ||
        (row.countryName ? countryByName.get(rawCountryName.toLowerCase()) : null) ||
        (row.countryCode ? countryByName.get(rawCountryCode.toLowerCase()) : null) ||
        null;
    }

    if (!product) {
      issues.push({ row: rowNumber, field: "productCode", message: "Product was not found." });
    } else if (product.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "productCode", message: "Product is inactive." });
    }

    if (variant) {
      if (!product || variant.productId !== product.id) {
        issues.push({ row: rowNumber, field: "variantSku", message: "Variant does not belong to the selected product." });
      }
      if (variant.status !== "ACTIVE") {
        issues.push({ row: rowNumber, field: "variantSku", message: "Variant is inactive." });
      }
    }

    if (!country) {
      issues.push({ row: rowNumber, field: "countryCode", message: "Country was not found." });
    } else if (country.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "countryCode", message: "Country is inactive." });
    }

    if (product && country && country.id !== "ALL" && existingByKey.has(`${product.id}:${variant?.id ?? row.variantId ?? ""}:${country.id}`)) {
      duplicateWarnings.push(`Row ${rowNumber} matches an existing pricing rule.`);
    }

    const numericFields = ["mrp", "sellingPrice", "dealerPrice", "distributorPrice"] as const;
    for (const field of numericFields) {
      const raw = row[field];
      if (raw !== undefined && raw !== "") {
        const clean = typeof raw === "string" ? raw.replace(/[^0-9.-]+/g, "") : raw;
        const parsed = Number(clean);
        if (!Number.isFinite(parsed) || parsed < 0) {
          const displayField = field === "distributorPrice" ? "Doctor / Retailer price" : field;
          issues.push({ row: rowNumber, field, message: `${displayField} must be a non-negative number.` });
        }
      }
    }

    previewRows.push({
      ...row,
      productId: product?.id ?? row.productId,
      productCode: product?.productCode ?? row.productCode ?? "",
      productTitle: product?.title ?? row.productTitle ?? "",
      variantSku: variant?.sku ?? row.variantSku ?? "",
      countryId: country?.id ?? row.countryId,
      countryCode: country ? country.code.toUpperCase() : (row.countryCode ?? ""),
      countryName: country?.name ?? row.countryName ?? "",
      mrp: row.mrp,
      sellingPrice: row.sellingPrice,
      dealerPrice: row.dealerPrice,
      distributorPrice: row.distributorPrice,
      doctorRetailerPrice: row.distributorPrice,
      status: row.status ?? "ACTIVE",
    });
  }

  return {
    rows: previewRows,
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

async function importPriceSpreadsheet(filePathOrRows: string | Record<string, unknown>[]) {
  const rawRows = typeof filePathOrRows === "string" ? readSpreadsheetRows(filePathOrRows) : filePathOrRows;
  const preview = await previewPriceImport(filePathOrRows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };
  await prisma.$transaction(async (tx) => {
    for (const raw of rawRows) {
      const row = raw as Record<string, any>;
      const productId = getRowField(row, "productId", "product_id", "id");
      const productCode = getRowField(row, "productCode", "product_code", "code");
      const productSlug = getRowField(row, "productSlug", "product_slug", "slug");
      const productTitle = getRowField(row, "productTitle", "product_title", "productName", "product_name", "product", "title");

      const variantId = getRowField(row, "variantId", "variant_id");
      const variantSku = getRowField(row, "variantSku", "variant_sku", "sku", "variant");

      const countryId = getRowField(row, "countryId", "country_id");
      const countryCode = getRowField(row, "countryCode", "country_code", "country", "isoCode");
      const countryName = getRowField(row, "countryName", "country_name");

      const rawMrp = getRowField(row, "mrp", "maxRetailPrice", "maximumRetailPrice");
      const rawSelling = getRowField(row, "sellingPrice", "selling_price", "price", "salePrice");
      const rawDealer = getRowField(row, "dealerPrice", "dealer_price", "wholesalePrice");
      const rawDistributor = getRowField(
        row,
        "doctorRetailerPrice",
        "doctorPrice",
        "retailerPrice",
        "doctor_retailer_price",
        "doctor_price",
        "retailer_price",
        "doctor/retailer price",
        "distributorPrice",
        "distributor_price"
      );
      const rawStatus = getRowField(row, "status", "state");

      const product =
        (productId ? await tx.product.findUnique({ where: { id: productId }, select: { id: true, status: true } }) : null) ||
        (productCode ? await tx.product.findFirst({ where: { productCode: { equals: productCode, mode: "insensitive" }, deletedAt: null }, select: { id: true, status: true } }) : null) ||
        (productSlug ? await tx.product.findFirst({ where: { slug: { equals: productSlug, mode: "insensitive" }, deletedAt: null }, select: { id: true, status: true } }) : null) ||
        (productTitle ? await tx.product.findFirst({ where: { title: { equals: productTitle, mode: "insensitive" }, deletedAt: null }, select: { id: true, status: true } }) : null);
      if (!product) throw new AppError("Product not found during import.", 400);

      const variant =
        (variantId ? await tx.productVariant.findUnique({ where: { id: variantId }, select: { id: true, productId: true, status: true } }) : null) ||
        (variantSku ? await tx.productVariant.findFirst({ where: { sku: { equals: variantSku, mode: "insensitive" }, deletedAt: null }, select: { id: true, productId: true, status: true } }) : null);

      if (variant && variant.productId !== product.id) throw new AppError("Variant does not belong to selected product.", 400);

      const rawCountryCode = String(countryCode || "").trim();
      const rawCountryName = String(countryName || "").trim();
      const rawCountryId = String(countryId || "").trim();
      const isAllCountries =
        rawCountryCode.toUpperCase() === "ALL" ||
        rawCountryCode.toUpperCase() === "GLOBAL" ||
        rawCountryCode === "*" ||
        rawCountryName.toUpperCase() === "ALL" ||
        rawCountryName.toLowerCase() === "all countries" ||
        rawCountryCode.toLowerCase() === "all countries" ||
        rawCountryId.toUpperCase() === "ALL";

      let targetCountries: Array<{ id: string; currencyId?: string | null; status: string }> = [];
      const subCodes = rawCountryCode.split(/[,;|]/).map((s) => {
        let c = s.trim().toUpperCase();
        if (c === "ALL" || c === "GLOBAL" || c === "*" || c === "ALL COUNTRIES") return "ALL";
        const parenMatch = c.match(/\(([A-Z]{2,3})\)$/);
        if (parenMatch) c = parenMatch[1];
        return c;
      }).filter(Boolean);

      if (isAllCountries || subCodes.includes("ALL")) {
        targetCountries = await tx.country.findMany({
          where: { status: "ACTIVE" },
          select: { id: true, currencyId: true, status: true },
        });
        if (!targetCountries.length) throw new AppError("No active countries found for import.", 400);
      } else if (subCodes.length > 1) {
        targetCountries = await tx.country.findMany({
          where: {
            code: { in: subCodes, mode: "insensitive" },
          },
          select: { id: true, currencyId: true, status: true },
        });
        if (targetCountries.length !== subCodes.length) {
          throw new AppError("One or more countries not found during import.", 400);
        }
      } else {
        const country =
          (countryId ? await tx.country.findUnique({ where: { id: countryId }, select: { id: true, currencyId: true, status: true } }) : null) ||
          (countryCode ? await tx.country.findFirst({ where: { code: { equals: countryCode, mode: "insensitive" } }, select: { id: true, currencyId: true, status: true } }) : null) ||
          (countryName ? await tx.country.findFirst({ where: { name: { equals: countryName, mode: "insensitive" } }, select: { id: true, currencyId: true, status: true } }) : null) ||
          (countryCode ? await tx.country.findFirst({ where: { name: { equals: countryCode, mode: "insensitive" } }, select: { id: true, currencyId: true, status: true } }) : null);
        if (!country) throw new AppError("Country not found during import.", 400);
        targetCountries = [country];
      }

      const normalizedMrp = toDecimal(rawMrp);
      const normalizedSellingPrice = toDecimal(rawSelling);
      const normalizedDealerPrice = toDecimal(rawDealer);
      const normalizedDistributorPrice = toDecimal(rawDistributor);
      if (normalizedMrp == null || normalizedSellingPrice == null) throw new AppError("MRP and selling price are required.", 400);

      const baseCurrency = await tx.currency.findFirst({ where: { isBase: true }, select: { id: true } });

      for (const targetCountry of targetCountries) {
        const effectiveCurrencyId = targetCountry.currencyId || baseCurrency?.id;
        if (!effectiveCurrencyId) throw new AppError("Base currency not configured.", 400);

        const existing = await tx.productPrice.findFirst({
          where: { productId: product.id, variantId: variant?.id ?? null, countryId: targetCountry.id },
          select: { id: true },
        });

        if (existing) {
          await tx.productPrice.update({
            where: { id: existing.id },
            data: {
              currencyId: effectiveCurrencyId,
              mrp: normalizedMrp,
              sellingPrice: normalizedSellingPrice,
              dealerPrice: normalizedDealerPrice,
              distributorPrice: normalizedDistributorPrice,
              status: normalizeStatus(rawStatus || "ACTIVE"),
            },
          });
          summary.updated += 1;
        } else {
          await tx.productPrice.create({
            data: {
              productId: product.id,
              variantId: variant?.id ?? null,
              countryId: targetCountry.id,
              currencyId: effectiveCurrencyId,
              mrp: normalizedMrp,
              sellingPrice: normalizedSellingPrice,
              dealerPrice: normalizedDealerPrice,
              distributorPrice: normalizedDistributorPrice,
              status: normalizeStatus(rawStatus || "ACTIVE"),
            },
          });
          summary.created += 1;
        }
      }
    }
  });

  return {
    ...summary,
    report: preview,
  };
}

export async function getPricingDashboard() {
  const { counts, data: recentRules } = await collectPricingRows({});
  return {
    ...counts,
    recentlyUpdatedRules: recentRules.slice(0, 10),
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
  dealerPrice?: number;
  distributorPrice?: number;
  variantOverrides?: Record<
    string,
    { mrp: number; sellingPrice?: number; dealerPrice?: number; distributorPrice?: number }
  >;
};

/**
 * Converts a base currency price into a target country's currency and applies landed costs.
 * 
 * Base Formula:
 * targetAmount = baseAmount * (targetCurrency.exchangeRate / baseCurrency.exchangeRate)
 * 
 * Landed Cost Formula:
 * landedPrice = targetAmount + (targetAmount * dutyPercentage / 100) + shippingCharge
 */
function computeLandedPrice(
  basePriceInBaseCurrency: number,
  country: { currency?: { exchangeRate: Prisma.Decimal | number } | null; dutyPercentage?: Prisma.Decimal | number | null },
  baseCurrencyRate: number,
) {
  const currencyRate = country.currency ? Number(country.currency.exchangeRate) || 1 : 1;
  const safeBaseRate = baseCurrencyRate || 1;
  // targetAmount = baseAmount * (targetCurrency.exchangeRate / baseCurrency.exchangeRate)
  const localBase = convertPrice(basePriceInBaseCurrency, currencyRate / safeBaseRate);
  const dutyPercent = Number(country.dutyPercentage) || 0;
  const landed = localBase + (localBase * dutyPercent) / 100;
  const mrp = Math.round((landed + Number.EPSILON) * 100) / 100;
  const sellingPrice = Math.round((landed + Number.EPSILON) * 100) / 100;
  return { mrp, sellingPrice };
}

export async function generateCountryPrices(
  productId: string,
  input: GenerateCountryPricesInput,
) {
  if (!productId || typeof productId !== "string" || !productId.trim()) {
    throw new AppError("Product ID is required to generate country prices.", 400);
  }
  const product = await assertActiveProduct(productId.trim());
  const baseCurrency =
    (await prisma.currency.findFirst({ where: { isBase: true } })) ||
    (await prisma.currency.findFirst({ where: { code: "USD" } })) ||
    (await prisma.currency.findFirst());

  if (!baseCurrency) throw new AppError("No base currency configured.", 400);

  const [countries, variants] = await Promise.all([
    prisma.country.findMany({
      where: { status: "ACTIVE" },
      include: { currency: true },
    }),
    prisma.productVariant.findMany({
      where: { productId, status: { not: "INACTIVE" } },
      select: { id: true },
    }),
  ]);

  const baseCurrencyRate = Number(baseCurrency.exchangeRate) || 1;

  const priceRows = countries.flatMap((country) => {
    if (!country.currencyId) return [];

    const landedMRP = computeLandedPrice(input.mrp, country, baseCurrencyRate).mrp;
    const landedSelling = input.sellingPrice != null 
      ? computeLandedPrice(input.sellingPrice, country, baseCurrencyRate).sellingPrice 
      : landedMRP;
    const landedDealer = input.dealerPrice != null 
      ? computeLandedPrice(input.dealerPrice, country, baseCurrencyRate).sellingPrice 
      : null;
    const landedDistributor = input.distributorPrice != null 
      ? computeLandedPrice(input.distributorPrice, country, baseCurrencyRate).sellingPrice 
      : null;

    const baseRow = {
      productId,
      countryId: country.id,
      currencyId: country.currencyId,
      mrp: landedMRP,
      sellingPrice: landedSelling,
      dealerPrice: landedDealer,
      distributorPrice: landedDistributor,
      status: "ACTIVE" as const,
      variantId: null as string | null,
    };

    const variantRows = variants.map((variant) => {
      const override = input.variantOverrides?.[variant.id];
      const vMRP = override?.mrp != null
        ? computeLandedPrice(override.mrp, country, baseCurrencyRate).mrp 
        : landedMRP;
      const vSelling = override?.sellingPrice != null 
        ? computeLandedPrice(override.sellingPrice, country, baseCurrencyRate).sellingPrice 
        : (override?.mrp != null ? vMRP : landedSelling);
      const vDealer = override?.dealerPrice != null 
        ? computeLandedPrice(override.dealerPrice, country, baseCurrencyRate).sellingPrice 
        : (override?.mrp != null ? null : landedDealer);
      const vDistributor = override?.distributorPrice != null 
        ? computeLandedPrice(override.distributorPrice, country, baseCurrencyRate).sellingPrice 
        : (override?.mrp != null ? null : landedDistributor);

      return {
        ...baseRow,
        variantId: variant.id,
        mrp: vMRP,
        sellingPrice: vSelling,
        dealerPrice: vDealer,
        distributorPrice: vDistributor,
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
          dealerPrice: price.dealerPrice,
          distributorPrice: price.distributorPrice,
          status: price.status,
        },
      });
    } else {
      await prisma.productPrice.create({
        data: price,
      });
    }
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

export function generateSamplePricingTemplate() {
  const sampleRows = [
    {
      productTitle: "MBT 022 Bracket System",
      productCode: "BRK-MBT-22",
      productSlug: "metal-bracket-mbt-022",
      variantSku: "VAR-MB-001-U",
      countryCode: "IN",
      mrp: "1200",
      sellingPrice: "950",
      dealerPrice: "850",
      doctorRetailerPrice: "750",
      distributorPrice: "750",
      status: "ACTIVE",
    },
    {
      productTitle: "NiTi Archwire Upper 016",
      productCode: "WIR-NT-16U",
      productSlug: "niti-archwire-upper-016",
      variantSku: "VAR-NW-002-STD",
      countryCode: "US",
      mrp: "25",
      sellingPrice: "19.50",
      dealerPrice: "16",
      doctorRetailerPrice: "14",
      distributorPrice: "14",
      status: "ACTIVE",
    },
    {
      productTitle: "Bondable Buccal Tube 1st Molar",
      productCode: "TUB-BND-01",
      productSlug: "bondable-buccal-tube",
      variantSku: "VAR-TB-001",
      countryCode: "ALL",
      mrp: "100",
      sellingPrice: "80",
      dealerPrice: "70",
      doctorRetailerPrice: "60",
      distributorPrice: "60",
      status: "ACTIVE",
    },
  ];

  return writeSpreadsheetBuffer(
    sampleRows,
    "Pricing",
    [
      { key: "productTitle", header: "productTitle" },
      { key: "productCode", header: "productCode" },
      { key: "productSlug", header: "productSlug" },
      { key: "variantSku", header: "variantSku" },
      { key: "countryCode", header: "countryCode" },
      { key: "mrp", header: "mrp" },
      { key: "sellingPrice", header: "sellingPrice" },
      { key: "dealerPrice", header: "dealerPrice" },
      { key: "doctorRetailerPrice", header: "doctorRetailerPrice" },
      { key: "status", header: "status" },
    ],
  );
}


export async function previewPricingImport(filePath: string) {
  const preview = await previewPriceImport(filePath);
  removeTempFile(filePath);

  const issuesByRow = new Map<number, string[]>();
  for (const issue of preview.issues) {
    const list = issuesByRow.get(issue.row) || [];
    list.push(`${issue.field}: ${issue.message}`);
    issuesByRow.set(issue.row, list);
  }

  const previewRows = preview.rows.map((row, index) => {
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
    totalRows: preview.rows.length,
    validRows: Math.max(0, preview.rows.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.rows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    rows: previewRows,
  };
}

export async function importPricingSpreadsheet(filePathOrRows: string | Record<string, unknown>[]) {
  return importPriceSpreadsheet(filePathOrRows);
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
