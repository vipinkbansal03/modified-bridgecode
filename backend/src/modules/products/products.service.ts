import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";
import { readSpreadsheetRows, readAllSpreadsheetSheets, removeTempFile, writeSpreadsheetBuffer, writeMultiSheetSpreadsheetBuffer } from "../../utils/spreadsheet";
import type { Prisma, GridAxis } from "@prisma/client";
import { setVariantStock } from "../inventory/inventory.service";
import { assertTierUsable } from "../tiers/tiers.service";

const { shouldSyncStorefrontVisibility } = require("./productVisibility");

const ALLOW_UNMAPPED_VARIANT_GENERATION_OVERRIDE = false;

function buildVariantKey(attributeValueIds: string[], packageId?: string | null) {
  const valueKey = [...attributeValueIds].sort().join("-");
  return packageId ? `${packageId}::${valueKey}` : valueKey;
}

function buildGeneratedVariantSku(product: { id: string; sku?: string | null }, variantKey: string) {
  let hash = 0;
  for (let i = 0; i < variantKey.length; i += 1) {
    hash = (hash * 31 + variantKey.charCodeAt(i)) >>> 0;
  }
  return `${product.sku || product.id}-${hash.toString(36)}`;
}

async function assertActiveCategory(categoryId: string) {
  const category = await prisma.category.findFirst({
    where: { id: categoryId, deletedAt: null },
    select: { id: true, status: true },
  });
  if (!category) throw new AppError("Category not found.", 404);
  if (category.status !== "ACTIVE") throw new AppError("Selected category is inactive.", 400);
  return category;
}

async function assertUniqueProductSlug(slug: string, excludeId?: string) {
  const duplicate = await prisma.product.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new AppError("A product with this slug already exists.", 409);
}

async function assertUniqueProductSku(sku?: string | null, excludeId?: string) {
  const normalized = sku?.trim();
  if (!normalized) return;
  const duplicate = await prisma.product.findFirst({
    where: {
      sku: normalized,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (duplicate) throw new AppError("A product with this SKU already exists.", 409);
}

export async function assertProductExists(productId: string) {
  const product = await prisma.product.findFirst({
    where: { id: productId, deletedAt: null },
    select: {
      id: true,
      title: true,
      slug: true,
      sku: true,
      status: true,
      categoryId: true,
      hasVariants: true,
      defaultCountryId: true,
      defaultCurrencyId: true,
    },
  });
  if (!product) throw new AppError("Product not found.", 404);
  return product;
}

function generateProductSku(title: string): string {
  const base = slugify(title).toUpperCase();
  return base ? `MO-${base}` : "";
}

async function syncStorefrontVisibility(tx: Prisma.TransactionClient, productId: string, status: string | null | undefined, previousStatus?: string | null) {
  const nextStatus = String(status ?? previousStatus ?? "DRAFT").toUpperCase();
  if (!shouldSyncStorefrontVisibility(nextStatus, previousStatus)) return;

  const countries = await tx.country.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  if (!countries.length) return;

  await tx.productCountry.createMany({
    data: countries.map((country) => ({
      productId,
      countryId: country.id,
      enabled: false,
    })),
    skipDuplicates: true,
  });
}

async function syncVariantsStorefrontVisibility(variantIds: string[], productId: string) {
  const uniqueVariantIds = Array.from(new Set(variantIds));
  if (!uniqueVariantIds.length) return;
  const productCountries = await prisma.productCountry.findMany({
    where: { productId, enabled: true, country: { status: "ACTIVE" } },
    select: { countryId: true },
  });
  if (!productCountries.length) return;

  const allRows = uniqueVariantIds.flatMap((variantId) =>
    productCountries.map(({ countryId }) => ({ variantId, countryId, enabled: true })),
  );

  for (let i = 0; i < allRows.length; i += 1000) {
    await prisma.variantCountry.createMany({
      data: allRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

async function syncVariantStorefrontVisibility(variantId: string, productId: string) {
  await syncVariantsStorefrontVisibility([variantId], productId);
}

function summarizeInventory(inventories: { stock: number; reservedStock: number }[]) {
  return inventories.reduce(
    (acc, inventory) => {
      acc.stock += inventory.stock;
      acc.available += Math.max(0, inventory.stock - inventory.reservedStock);
      return acc;
    },
    { stock: 0, available: 0 },
  );
}

type ProductHighlightInput = {
  title: string;
  description: string;
  image?: string;
};

type ProductSpecInput = {
  label: string;
  value: string;
  image?: string;
};

type ProductInput = {
  title: string;
  slug?: string;
  shortDescription?: string;
  description?: string;
  informationImage?: string;
  informationDescription?: string;
  categoryId: string;
  sku?: string;
  productCode?: string;
  brand?: string;
  status?: string;
  isFeatured?: boolean;
  hasVariants?: boolean;
  defaultCountryId?: string;
  defaultCurrencyId?: string;
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  activeCountryIds?: string[];
  highlights?: ProductHighlightInput[];
  technicalSpecs?: ProductSpecInput[];
  warranty?: string[];
  primaryFeatures?: ProductHighlightInput[];
  additionalInfo?: ProductSpecInput[];
  packageWeight?: number | string | null;
  packageLength?: number | string | null;
  packageWidth?: number | string | null;
  packageHeight?: number | string | null;
  shippingClass?: string | null;
  fragile?: boolean;
  hazardous?: boolean;
  allowQuote?: boolean;
};

type ShippingInfoInput = {
  packageWeight?: number | string | null;
  packageLength?: number | string | null;
  packageWidth?: number | string | null;
  packageHeight?: number | string | null;
  shippingClass?: string | null;
  fragile?: boolean;
  hazardous?: boolean;
};

type ProductListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  categoryId?: string;
  status?: string;
  sortBy?: string;
  sortDir?: string;
  ids?: string[];
  warehouseId?: string;
  deleted?: boolean | string;
};

type VariantListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  productId?: string;
  sortBy?: string;
  sortDir?: string;
};

type SpreadsheetIssue = {
  row: number;
  field: string;
  message: string;
};

type SpreadsheetPreviewResult = {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  issues: SpreadsheetIssue[];
  duplicateWarnings: string[];
  sampleRows: Record<string, unknown>[];
  rows?: Record<string, unknown>[];
};

type ProductImportRow = {
  title: string;
  sku?: string | null;
  productCode?: string | null;
  imageUrl?: string | null;
  imageUrls?: string[];
  categorySlug?: string | null;
  brand?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  isFeatured?: boolean | null;
  hasVariants?: boolean | null;
  shortDescription?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  countryCodes?: string[];
  stock?: number | null;
  lowStockThreshold?: number | null;
  reservedStock?: number | null;
  price?: number | null;
  sellingPrice?: number | null;
  mrp?: number | null;
  dealerPrice?: number | null;
  doctorPrice?: number | null;
  weight?: number | null;
  length?: number | null;
  width?: number | null;
  height?: number | null;
  dimensions?: string | null;
  fragile?: boolean | null;
  hazardous?: boolean | null;
  shippingClass?: string | null;
};

type CategoryImportRow = {
  name: string;
  slug?: string | null;
  parentSlug?: string | null;
  status?: string | null;
  sortOrder?: number | null;
  image?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  countryCodes?: string[];
};

function parseBooleanish(value: unknown) {
  if (typeof value === "boolean") return value;
  const normalized = String(value ?? "").trim().toLowerCase();
  if (!normalized) return null;
  if (["1", "true", "yes", "y"].includes(normalized)) return true;
  if (["0", "false", "no", "n"].includes(normalized)) return false;
  return null;
}

function parseNumberish(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseCodeList(value: unknown) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return [];
  return normalized
    .split(/[,;|]/)
    .map((code) => {
      let c = code.trim().toUpperCase();
      if (c === "ALL" || c === "GLOBAL" || c === "*" || c === "ALL COUNTRIES") return "ALL";
      const parenMatch = c.match(/\(([A-Z]{2,3})\)$/);
      if (parenMatch) c = parenMatch[1];
      return c;
    })
    .filter(Boolean);
}

function parseProductImportRow(raw: Record<string, string>): ProductImportRow {
  const rawImage =
    raw.imageUrl?.trim() ||
    raw.image?.trim() ||
    raw.imageUrls?.trim() ||
    raw.images?.trim() ||
    raw["image_url"]?.trim() ||
    raw["Image URL"]?.trim() ||
    raw["Image"]?.trim() ||
    null;

  const imageUrls = rawImage
    ? rawImage
        .split(/[,;\n]/)
        .map((u) => u.trim())
        .filter(Boolean)
    : [];

  const rawSellingPrice = parseNumberish(raw.price ?? raw.sellingPrice ?? raw["Selling Price"] ?? raw["Price"] ?? raw["price"] ?? raw["selling_price"]);
  const rawMrp = parseNumberish(raw.mrp ?? raw["MRP"] ?? raw["Mrp"]);
  const rawDealerPrice = parseNumberish(raw.dealerPrice ?? raw["Dealer Price"] ?? raw["dealer_price"]);
  const rawDoctorPrice = parseNumberish(raw.doctorPrice ?? raw["Doctor Price"] ?? raw["doctor_price"] ?? raw.distributorPrice ?? raw["Distributor Price"]);

  let lengthVal = parseNumberish(raw.length ?? raw.packageLength ?? raw["Length (cm)"] ?? raw["Length"] ?? raw["length_cm"]);
  let widthVal = parseNumberish(raw.width ?? raw.packageWidth ?? raw["Width (cm)"] ?? raw["Width"] ?? raw["width_cm"]);
  let heightVal = parseNumberish(raw.height ?? raw.packageHeight ?? raw["Height (cm)"] ?? raw["Height"] ?? raw["height_cm"]);
  const rawDims = raw.dimensions?.trim() || raw["Dimensions"]?.trim() || raw["Dimensions (cm)"]?.trim() || raw["Dimensions (L x W x H cm)"]?.trim() || null;
  if ((!lengthVal || !widthVal || !heightVal) && rawDims) {
    const parts = rawDims.split(/[\s*xX]+/).map(Number).filter((n) => !isNaN(n));
    if (parts.length >= 3) {
      lengthVal = lengthVal ?? parts[0];
      widthVal = widthVal ?? parts[1];
      heightVal = heightVal ?? parts[2];
    }
  }

  return {
    title: raw.title?.trim() || "",
    sku: raw.sku?.trim() || null,
    productCode: raw.productCode?.trim() || null,
    imageUrl: rawImage,
    imageUrls,
    categorySlug: (raw.categoryName || raw["categoryName"] || raw["category Name"] || raw["Category Name"] || raw.category || raw.Category || raw.categorySlug || raw["Category Slug"] || raw["category_slug"])?.trim() || null,
    brand: raw.brand?.trim() || null,
    status: raw.status?.trim().toUpperCase() || null,
    sortOrder: parseNumberish(raw.sortOrder),
    isFeatured: parseBooleanish(raw.isFeatured),
    hasVariants: parseBooleanish(raw.hasVariants),
    shortDescription: raw.shortDescription?.trim() || null,
    description: raw.description?.trim() || null,
    seoTitle: raw.seoTitle?.trim() || null,
    seoDescription: raw.seoDescription?.trim() || null,
    seoKeywords: raw.seoKeywords?.trim() || null,
    countryCodes: parseCodeList(raw.countryCodes),
    stock: parseNumberish(raw.stock ?? raw["Stock"] ?? raw["quantity"] ?? raw["Qty"]),
    lowStockThreshold: parseNumberish(raw.lowStock ?? raw["Low Stock"] ?? raw.lowStockThreshold ?? raw["low_stock"] ?? raw["Low Stock Threshold"]),
    reservedStock: parseNumberish(raw.reservedStock ?? raw["Reserved Stock"] ?? raw["reserved_stock"]),
    price: rawSellingPrice,
    sellingPrice: rawSellingPrice,
    mrp: rawMrp,
    dealerPrice: rawDealerPrice,
    doctorPrice: rawDoctorPrice,
    weight: parseNumberish(raw.weight ?? raw.packageWeight ?? raw["Weight (kg)"] ?? raw["Weight"] ?? raw["Package Weight"] ?? raw["weight_kg"]),
    length: lengthVal,
    width: widthVal,
    height: heightVal,
    dimensions: rawDims || (lengthVal && widthVal && heightVal ? `${lengthVal} x ${widthVal} x ${heightVal}` : null),
    fragile: parseBooleanish(raw.fragile ?? raw["Fragile"] ?? raw["Is Fragile"] ?? raw["is_fragile"]),
    hazardous: parseBooleanish(raw.hazardous ?? raw["Hazardous"] ?? raw["Is Hazardous"] ?? raw["is_hazardous"]),
    shippingClass: raw.shippingClass?.trim() || raw["Shipping Class"]?.trim() || raw["shipping_class"]?.trim() || null,
  };
}

function parseCategoryImportRow(raw: Record<string, string>): CategoryImportRow {
  return {
    name: raw.name?.trim() || "",
    slug: raw.slug?.trim() || null,
    parentSlug: raw.parentSlug?.trim() || null,
    status: raw.status?.trim().toUpperCase() || null,
    sortOrder: parseNumberish(raw.sortOrder),
    image: raw.image?.trim() || null,
    description: raw.description?.trim() || null,
    seoTitle: raw.seoTitle?.trim() || null,
    seoDescription: raw.seoDescription?.trim() || null,
    countryCodes: parseCodeList(raw.countryCodes),
  };
}

type BulkVariantUpdate = {
  variantId: string;
  action?: "delete" | "archive" | "restore" | "active" | "inactive";
  countryId?: string | null;
  price?:
    | string
    | number
    | {
        mrp?: number | string | null;
        sellingPrice?: number | string | null;
        dealerPrice?: number | string | null;
        distributorPrice?: number | string | null;
        taxPercentage?: number | string | null;
      };
  stock?: number | string | null;
};

type NormalizedBulkPrice = {
  mrp?: number;
  sellingPrice?: number;
  dealerPrice?: number;
  distributorPrice?: number;
  taxPercentage?: number;
};

type BulkVariantResult = {
  index: number;
  variantId?: string;
  success: boolean;
  error?: string;
};

const VARIANT_COUNTRY_PRICE_EXPORT_COLUMNS = [
  { key: "variantId", header: "variantId" },
  { key: "sku", header: "sku" },
  { key: "variantTitle", header: "variantTitle" },
  { key: "countryCode", header: "countryCode" },
  { key: "currencyCode", header: "currencyCode" },
  { key: "mrp", header: "mrp" },
  { key: "sellingPrice", header: "sellingPrice" },
  { key: "dealerPrice", header: "dealerPrice" },
  { key: "doctorRetailerPrice", header: "doctorRetailerPrice" },
  { key: "stock", header: "stock" },
] as const;

type PricingRuleInput = {
  tierId?: string | null;
  productId?: string;
  variantId?: string | null;
  countryId?: string | null;
  minQuantity?: number | string | null;
  maxQuantity?: number | string | null;
  discountPercent?: number | string | Prisma.Decimal | null;
  fixedPrice?: number | string | Prisma.Decimal | null;
};

function parseOptionalDecimal(value: unknown, fieldName: string) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error(`${fieldName} must be a non-negative number.`);
  return parsed;
}

function parseRequiredDecimal(value: unknown, fieldName: string) {
  const parsed = parseOptionalDecimal(value, fieldName);
  if (parsed === undefined) throw new AppError(`${fieldName} is required.`, 400);
  return parsed;
}

function normalizeExclusivePriceRule(data: PricingRuleInput) {
  const hasDiscount = data.discountPercent !== undefined && data.discountPercent !== null && data.discountPercent !== "";
  const hasFixed = data.fixedPrice !== undefined && data.fixedPrice !== null && data.fixedPrice !== "";
  if (hasDiscount === hasFixed) {
    throw new AppError("Set exactly one of discountPercent or fixedPrice.", 400);
  }
  return {
    discountPercent: hasDiscount ? parseRequiredDecimal(data.discountPercent, "Discount percent") : null,
    fixedPrice: hasFixed ? parseRequiredDecimal(data.fixedPrice, "Fixed price") : null,
  };
}

async function ensureVariantBelongsToProduct(productId: string, variantId?: string | null) {
  if (!variantId) return null;
  const variant = await prisma.productVariant.findFirst({ where: { id: variantId, productId } });
  if (!variant) throw new AppError("Variant not found for this product.", 404);
  return variant;
}

function parseOptionalStock(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) throw new Error("Stock must be a non-negative whole number.");
  return parsed;
}

function normalizeBulkPrice(price: BulkVariantUpdate["price"]): NormalizedBulkPrice | null {
  if (price === undefined || price === null) return null;
  if (typeof price === "number" || typeof price === "string") {
    const parsed = parseOptionalDecimal(price, "Price");
    return parsed === undefined ? null : { sellingPrice: parsed, mrp: parsed };
  }
  const normalized = {
    mrp: parseOptionalDecimal(price.mrp, "MRP"),
    sellingPrice: parseOptionalDecimal(price.sellingPrice, "Selling price"),
    dealerPrice: parseOptionalDecimal(price.dealerPrice, "Dealer price"),
    distributorPrice: parseOptionalDecimal(price.distributorPrice, "Distributor price"),
    taxPercentage: parseOptionalDecimal(price.taxPercentage, "Tax percentage"),
  };
  return Object.values(normalized).some((value) => value !== undefined) ? normalized : null;
}

async function ensureProductPackage(productId: string, packageId?: string | null) {
  if (!packageId) return null;
  const pkg = await prisma.productPackage.findFirst({
    where: { id: packageId, productId },
  });
  if (!pkg) throw new AppError("Package not found for this product.", 404);
  return pkg;
}

async function loadActiveAttributeValues(attributeValueIds: string[]) {
  const uniqueIds = Array.from(new Set(attributeValueIds));
  if (!uniqueIds.length) throw new AppError("Select at least one attribute value.", 400);

  const values = await prisma.attributeValue.findMany({
    where: { id: { in: uniqueIds }, status: "ACTIVE" },
  });
  if (values.length !== uniqueIds.length) throw new AppError("One or more attribute values are invalid.", 400);

  const counts = values.reduce<Record<string, number>>((acc, value) => {
    acc[value.attributeId] = (acc[value.attributeId] ?? 0) + 1;
    return acc;
  }, {});
  if (Object.values(counts).some((count) => count > 1)) {
    throw new AppError("Select only one value per attribute.", 400);
  }

  return values;
}

async function loadActiveAttributeValuesForGeneration(attributeValueIds: string[]) {
  const uniqueIds = Array.from(new Set(attributeValueIds));
  if (!uniqueIds.length) throw new AppError("Select at least one attribute value.", 400);

  const values = await prisma.attributeValue.findMany({
    where: { id: { in: uniqueIds }, status: "ACTIVE" },
  });
  if (values.length !== uniqueIds.length) throw new AppError("One or more attribute values are invalid.", 400);

  return values;
}

function buildVariantTitle(values: { value: string }[], packageTitle?: string | null, explicitTitle?: string | null) {
  if (explicitTitle?.trim()) return explicitTitle.trim();
  return [...values.map((value) => value.value), ...(packageTitle ? [packageTitle] : [])].filter(Boolean).join(" / ");
}

function buildProductWhere(query: {
  search?: string;
  categoryId?: string;
  status?: string;
  ids?: string[];
  warehouseId?: string;
  deleted?: boolean | string;
}): Prisma.ProductWhereInput {
  const isDeleted = query.deleted === true || query.deleted === "true";
  return {
    deletedAt: isDeleted ? { not: null } : null,
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
        { productCode: { contains: query.search, mode: "insensitive" } },
      ],
    }),
    ...(query.categoryId && { categoryId: query.categoryId }),
    ...(query.status && { status: query.status as never }),
    ...(query.ids?.length ? { id: { in: query.ids } } : {}),
    ...(query.warehouseId && {
      inventories: {
        some: {
          warehouseId: query.warehouseId,
        },
      },
    }),
  };
}

function buildVariantWhere(query: VariantListQuery): Prisma.ProductVariantWhereInput {
  const isArchived = query.status === "ARCHIVED";
  const status = query.status === "ACTIVE" || query.status === "INACTIVE" ? query.status : undefined;
  const productStatus = query.status === "DRAFT" ? "DRAFT" : undefined;

  return {
    deletedAt: isArchived ? { not: null } : null,
    ...(isArchived
      ? {}
      : {
          product: {
            deletedAt: null,
            ...(productStatus && { status: productStatus }),
          },
        }),
    ...(query.productId && { productId: query.productId }),
    ...(status && { status: status as any }),
    ...(query.search && {
      OR: [
        { title: { contains: query.search, mode: "insensitive" } },
        { sku: { contains: query.search, mode: "insensitive" } },
        { variantKey: { contains: query.search, mode: "insensitive" } },
        {
          product: {
            OR: [
              { title: { contains: query.search, mode: "insensitive" } },
              { sku: { contains: query.search, mode: "insensitive" } },
            ],
          },
        },
      ],
    }),
  };
}

function buildVariantOrder(query: VariantListQuery): Prisma.ProductVariantOrderByWithRelationInput[] {
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  switch (query.sortBy) {
    case "title":
      return [{ title: sortDir }, { createdAt: "desc" }];
    case "sku":
      return [{ sku: sortDir }, { createdAt: "desc" }];
    case "status":
      return [{ status: sortDir }, { createdAt: "desc" }];
    case "product":
      return [{ product: { title: sortDir } }, { title: "asc" }];
    case "deletedAt":
      return [{ deletedAt: sortDir }];
    case "updatedAt":
      return [{ updatedAt: sortDir }];
    case "createdAt":
      return [{ createdAt: sortDir }];
    default:
      return [{ updatedAt: "desc" }];
  }
}

export async function getProductCounts() {
  const [grouped, deleted] = await Promise.all([
    prisma.product.groupBy({
      by: ["status"],
      where: { deletedAt: null },
      _count: { _all: true },
    }),
    prisma.product.count({ where: { deletedAt: { not: null } } }),
  ]);

  const counts: Record<string, number> = {
    active: 0,
    draft: 0,
    inactive: 0,
    archived: 0,
    deleted,
    total: 0,
  };

  for (const item of grouped) {
    const key = item.status.toLowerCase();
    counts[key] = item._count._all;
    counts.total += item._count._all;
  }

  return counts;
}

export async function getVariantCounts() {
  const [grouped, draft, archived, total] = await Promise.all([
    prisma.productVariant.groupBy({
      by: ["status"],
      where: {
        deletedAt: null,
        product: { deletedAt: null },
      },
      _count: { _all: true },
    }),
    prisma.productVariant.count({
      where: {
        deletedAt: null,
        product: { status: "DRAFT", deletedAt: null },
      },
    }),
    prisma.productVariant.count({
      where: { deletedAt: { not: null } },
    }),
    prisma.productVariant.count({
      where: {
        deletedAt: null,
        product: { deletedAt: null },
      },
    }),
  ]);

  const counts: Record<string, number> = {
    active: 0,
    draft,
    inactive: 0,
    archived,
    total,
  };

  for (const item of grouped) {
    const key = item.status.toLowerCase();
    counts[key] = item._count._all;
  }

  return counts;
}

// ─── List ─────────────────────────────────────────────────

export async function listProducts(query: ProductListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ProductWhereInput = buildProductWhere(query);

  const isDeleted = query.deleted === "true" || query.deleted === true;
  const sortBy = query.sortBy || (isDeleted ? "deletedAt" : "sortOrder");
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sortBy === "deletedAt"
      ? [{ deletedAt: sortDir as Prisma.SortOrder }, { updatedAt: "desc" }]
      : sortBy === "title"
      ? [{ title: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "sku"
      ? [{ sku: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "brand"
      ? [{ brand: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "status"
      ? [{ status: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "updatedAt"
      ? [{ updatedAt: sortDir as Prisma.SortOrder }]
      : sortBy === "createdAt"
      ? [{ createdAt: sortDir as Prisma.SortOrder }]
      : sortBy === "category"
      ? [{ category: { name: sortDir as Prisma.SortOrder } }, { createdAt: "desc" }]
      : isDeleted
      ? [{ deletedAt: "desc" }, { updatedAt: "desc" }]
      : [{ sortOrder: sortDir as Prisma.SortOrder }, { createdAt: "desc" }];

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      select: {
        id: true,
        title: true,
        slug: true,
        sku: true,
        productCode: true,
        brand: true,
        status: true,
        isFeatured: true,
        sortOrder: true,
        createdAt: true,
        updatedAt: true,
        deletedAt: true,
        category: { select: { id: true, name: true, slug: true, status: true } },
        media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1, select: { id: true, url: true, altText: true } },
        countries: { where: { enabled: true }, select: { countryId: true } },
        prices: {
          where: { status: "ACTIVE", variantId: null, deletedAt: null },
          orderBy: [{ currency: { isBase: "desc" } }, { sellingPrice: "asc" }],
          include: { country: true, currency: true },
          take: 5,
        },
        _count: { select: { variants: true, collections: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  if (data.length === 0) {
    return { data: [], total, page, limit };
  }

  const productIds = data.map((p) => p.id);
  const inventorySums = await prisma.inventory.groupBy({
    by: ["productId"],
    where: {
      productId: { in: productIds },
      ...(query.warehouseId ? { warehouseId: query.warehouseId } : {}),
    },
    _sum: {
      stock: true,
      reservedStock: true,
    },
  });

  const inventoryMap = new Map(
    inventorySums.map((inv) => [
      inv.productId,
      [{ stock: inv._sum.stock ?? 0, reservedStock: inv._sum.reservedStock ?? 0 }],
    ]),
  );

  const enrichedData = data.map((product) => ({
    ...product,
    inventories: inventoryMap.get(product.id) || [{ stock: 0, reservedStock: 0 }],
  }));

  return { data: enrichedData, total, page, limit };
}

export async function listVariants(query: VariantListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = buildVariantWhere(query);
  const orderBy = buildVariantOrder(query);

  const [data, total] = await Promise.all([
    prisma.productVariant.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        product: {
          select: {
            id: true,
            title: true,
            sku: true,
            category: { select: { id: true, name: true, slug: true } },
            media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
          },
        },
        package: { select: { id: true, title: true } },
        countries: { where: { enabled: true }, select: { countryId: true } },
        inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
        prices: {
          where: { status: "ACTIVE", deletedAt: null },
          orderBy: [{ currency: { isBase: "desc" } }, { sellingPrice: "asc" }],
          include: { currency: true, country: true },
        },
        attributeValues: {
          include: {
            attribute: { select: { id: true, name: true } },
            attributeValue: { select: { id: true, value: true } },
          },
        },
        _count: { select: { attributeValues: true, countries: true, prices: true } },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  if (data.length === 0) {
    return { data: [], total, page, limit };
  }

  const variantIds = data.map((v) => v.id);

  const [orderItemsGroupBy, quoteItemsGroupBy, adjustmentsGroupBy, inventorySumGroupBy] = await Promise.all([
    prisma.orderItem.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds } },
      _count: { _all: true },
    }),
    prisma.quoteItem.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds } },
      _count: { _all: true },
    }),
    prisma.inventoryAdjustment.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds } },
      _count: { _all: true },
    }),
    prisma.inventory.groupBy({
      by: ["variantId"],
      where: { variantId: { in: variantIds } },
      _sum: { stock: true, reservedStock: true },
    }),
  ]);

  const orderItemsCountMap = new Map<string, number>();
  (orderItemsGroupBy as { variantId: string | null; _count: { _all: number } }[]).forEach((g) => {
    if (g.variantId) orderItemsCountMap.set(g.variantId, g._count._all);
  });

  const quoteItemsCountMap = new Map<string, number>();
  (quoteItemsGroupBy as { variantId: string | null; _count: { _all: number } }[]).forEach((g) => {
    if (g.variantId) quoteItemsCountMap.set(g.variantId, g._count._all);
  });

  const adjustmentsCountMap = new Map<string, number>();
  (adjustmentsGroupBy as { variantId: string | null; _count: { _all: number } }[]).forEach((g) => {
    if (g.variantId) adjustmentsCountMap.set(g.variantId, g._count._all);
  });

  const stockMap = new Map<string, { stock: number; reservedStock: number }>();
  (inventorySumGroupBy as { variantId: string | null; _sum: { stock: number | null; reservedStock: number | null } }[]).forEach((g) => {
    if (g.variantId) {
      stockMap.set(g.variantId, {
        stock: Math.max(0, g._sum.stock || 0),
        reservedStock: Math.max(0, g._sum.reservedStock || 0),
      });
    }
  });

  const cartItemsCountMap = new Map<string, number>();
  if ("cartItem" in prisma) {
    try {
      const cartItemsGroupBy = await (prisma as any).cartItem.groupBy({
        by: ["variantId"],
        where: { variantId: { in: variantIds } },
        _count: { _all: true },
      });
      (cartItemsGroupBy as { variantId: string | null; _count: { _all: number } }[]).forEach((g) => {
        if (g.variantId) cartItemsCountMap.set(g.variantId, g._count._all);
      });
    } catch {
      // Cart table does not exist
    }
  }

  const enrichedData = data.map((v) => {
    const orderItemsCount = orderItemsCountMap.get(v.id) || 0;
    const quoteItemsCount = quoteItemsCountMap.get(v.id) || 0;
    const adjustmentsCount = adjustmentsCountMap.get(v.id) || 0;
    const stockInfo = stockMap.get(v.id) || { stock: 0, reservedStock: 0 };
    const cartItemsCount = cartItemsCountMap.get(v.id) || 0;

    let canPermanentDelete = true;
    let permanentDeleteBlockReason: string | null = null;

    if (orderItemsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Referenced by ${orderItemsCount} historical order item(s) and legal tax invoice(s).`;
    } else if (quoteItemsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Referenced by ${quoteItemsCount} quote item(s).`;
    } else if (cartItemsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = "Cannot permanently delete this variant because it exists in active customer carts.";
    } else if (stockInfo.stock > 0 || stockInfo.reservedStock > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Active stock (${stockInfo.stock} units) or reserved stock (${stockInfo.reservedStock} units) exists. Zero or transfer inventory first.`;
    } else if (adjustmentsCount > 0) {
      canPermanentDelete = false;
      permanentDeleteBlockReason = `Referenced by ${adjustmentsCount} inventory adjustment audit log(s).`;
    }

    return {
      ...v,
      dependencyCounts: {
        orderItems: orderItemsCount,
        quoteItems: quoteItemsCount,
        adjustments: adjustmentsCount,
        activeStock: stockInfo.stock,
        reservedStock: stockInfo.reservedStock,
        cartItems: cartItemsCount,
      },
      canPermanentDelete,
      permanentDeleteBlockReason,
    };
  });

  return { data: enrichedData, total, page, limit };
}

// ─── Get one ─────────────────────────────────────────────

export async function getProduct(id: string) {
  const startTime = performance.now();
  const product = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    include: {
      category: true,
      media: { orderBy: { sortOrder: "asc" } },
      packages: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      attributes: {
        orderBy: { createdAt: "asc" },
        include: {
          attribute: {
            select: {
              id: true,
              name: true,
              slug: true,
              role: true,
              status: true,
              sortOrder: true,
            },
          },
          allowedValues: {
            include: { attributeValue: true },
            orderBy: { attributeValue: { sortOrder: "asc" } },
          },
        },
      },
      variants: {
        where: { status: { not: "INACTIVE" }, deletedAt: null },
        select: {
          id: true,
          title: true,
          sku: true,
          variantKey: true,
          status: true,
          packageId: true,
          moq: true,
          weight: true,
          length: true,
          width: true,
          height: true,
          shippingClass: true,
          fragile: true,
          hazardous: true,
          package: {
            select: { id: true, title: true, slug: true, status: true, sortOrder: true },
          },
          attributeValues: {
            include: {
              attribute: { select: { id: true, name: true, slug: true, role: true } },
              attributeValue: { select: { id: true, value: true, slug: true, sortOrder: true } },
            },
          },
          prices: {
            where: { deletedAt: null },
            include: {
              country: { select: { id: true, name: true, code: true } },
              currency: { select: { id: true, code: true, symbol: true, isBase: true } },
            },
          },
          inventories: {
            include: {
              country: { select: { id: true, name: true, code: true } },
              warehouse: {
                select: {
                  id: true,
                  name: true,
                  countryId: true,
                  state: true,
                  country: { select: { id: true, name: true, code: true } },
                },
              },
            },
            orderBy: [{ countryId: "asc" }],
          },
        },
        orderBy: [{ createdAt: "asc" }],
      },
      inventories: {
        where: { variantId: null },
        include: {
          country: { select: { id: true, name: true, code: true } },
          warehouse: {
            select: {
              id: true,
              name: true,
              countryId: true,
              state: true,
              country: { select: { id: true, name: true, code: true } },
            },
          },
        },
        orderBy: [{ countryId: "asc" }],
      },
      prices: {
        where: { variantId: null, deletedAt: null },
        include: {
          country: { select: { id: true, name: true, code: true } },
          currency: { select: { id: true, code: true, symbol: true, isBase: true } },
        },
      },
      translations: { include: { language: true } },
    },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const durationMs = (performance.now() - startTime).toFixed(2);
  const variantsCount = product.variants?.length ?? 0;
  console.log(`[PERF] getProduct(${id}) executed in ${durationMs}ms | ${variantsCount} variants`);

  return product;
}

export async function getProductVariants(
  productId: string,
  query?: { page?: number | string; limit?: number | string; search?: string }
) {
  const startTime = performance.now();
  await assertProductExists(productId);

  const page = query?.page ? Math.max(1, Number(query.page)) : undefined;
  const limit = query?.limit ? Math.max(1, Number(query.limit)) : (query?.page ? 50 : undefined);
  const search = typeof query?.search === "string" ? query.search.trim() : undefined;

  const where: Prisma.ProductVariantWhereInput = {
    productId,
    status: { not: "INACTIVE" },
    deletedAt: null,
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { sku: { contains: search, mode: "insensitive" } },
            { variantKey: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const [total, variants] = await Promise.all([
    limit ? prisma.productVariant.count({ where }) : Promise.resolve(0),
    prisma.productVariant.findMany({
      where,
      skip: page && limit ? (page - 1) * limit : undefined,
      take: limit,
      include: {
        package: {
          select: { id: true, title: true, slug: true, status: true, sortOrder: true },
        },
        attributeValues: {
          include: {
            attribute: { select: { id: true, name: true, slug: true, role: true } },
            attributeValue: { select: { id: true, value: true, slug: true, sortOrder: true } },
          },
        },
        prices: {
          where: { deletedAt: null },
          include: {
            country: { select: { id: true, name: true, code: true } },
            currency: { select: { id: true, code: true, symbol: true, isBase: true } },
          },
        },
        inventories: {
          include: {
            country: { select: { id: true, name: true, code: true } },
            warehouse: {
              select: {
                id: true,
                name: true,
                countryId: true,
                state: true,
                country: { select: { id: true, name: true, code: true } },
              },
            },
          },
          orderBy: [{ countryId: "asc" }],
        },
      },
      orderBy: [{ createdAt: "asc" }],
    }),
  ]);

  const durationMs = (performance.now() - startTime).toFixed(2);
  console.log(`[PERF] getProductVariants(${productId}) executed in ${durationMs}ms | ${variants.length} variants returned`);

  if (limit) {
    return {
      data: variants,
      total,
      page: page || 1,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  return variants;
}

// ─── Create ───────────────────────────────────────────────

export async function createProduct(data: ProductInput) {
  const title = data.title.trim();
  if (!title) throw new AppError("Product title is required.", 400);
  if (!data.categoryId) throw new AppError("Category is required.", 400);
  await assertActiveCategory(data.categoryId);

  const slug = data.slug?.trim() ? slugify(data.slug) : slugify(title);
  if (!slug) throw new AppError("Product slug is required.", 400);
  await assertUniqueProductSlug(slug);
  const sku = data.sku?.trim() || generateProductSku(title);
  await assertUniqueProductSku(sku);
  const normalizedStatus = (data.status as never) || "DRAFT";

  const { activeCountryIds, ...createData } = data;
  if ("specImages" in createData) delete (createData as any).specImages;

  const createdProduct = await prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        ...createData,
        title,
        slug,
        sku,
        status: normalizedStatus,
        informationImage: data.informationImage || null,
        informationDescription: data.informationDescription || null,
      },
    });

    await syncStorefrontVisibility(tx, product.id, normalizedStatus, null);
    return product;
  });

  if (activeCountryIds?.length) {
    await updateProductCountries(createdProduct.id, activeCountryIds.map(id => ({ countryId: id, enabled: true })));
  }

  return createdProduct;
}

// ─── Update ───────────────────────────────────────────────

export async function updateProduct(id: string, data: Partial<ProductInput>) {
  const existing = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    select: { id: true, brand: true, status: true, categoryId: true },
  });
  if (!existing) throw new AppError("Product not found.", 404);
  if (data.categoryId) await assertActiveCategory(data.categoryId);

  const updateData = { ...data } as Record<string, unknown>;
  if (data.slug !== undefined || (data.title !== undefined && data.title)) {
    const nextSlug = slugify((data.slug ?? data.title) as string);
    if (!nextSlug) throw new AppError("Product slug is required.", 400);
    await assertUniqueProductSlug(nextSlug, id);
    updateData.slug = nextSlug;
  }
  if (data.sku !== undefined) {
    await assertUniqueProductSku(data.sku, id);
    updateData.sku = data.sku?.trim() || null;
  }
  if (data.title !== undefined) updateData.title = data.title.trim();
  if (data.categoryId !== undefined) {
    updateData.category = { connect: { id: data.categoryId } };
    // remove scalar foreign-key to avoid Prisma validation error
    delete updateData.categoryId;
  }
  if (data.activeCountryIds !== undefined) {
    delete updateData.activeCountryIds;
  }
  if (data.defaultCountryId !== undefined) {
    updateData.defaultCountry = data.defaultCountryId ? { connect: { id: data.defaultCountryId } } : { disconnect: true };
    delete updateData.defaultCountryId;
  }
  if (data.defaultCurrencyId !== undefined) {
    updateData.defaultCurrency = data.defaultCurrencyId ? { connect: { id: data.defaultCurrencyId } } : { disconnect: true };
    delete updateData.defaultCurrencyId;
  }
  if (data.shortDescription !== undefined) updateData.shortDescription = data.shortDescription || null;
  if (data.description !== undefined) updateData.description = data.description || null;
  if (data.brand !== undefined) updateData.brand = data.brand?.trim() || existing.brand;
  if ("specImages" in updateData) delete updateData.specImages;

  const updatedProduct = await prisma.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: updateData as Prisma.ProductUpdateInput });
    await syncStorefrontVisibility(tx, product.id, product.status, existing.status);

    if (data.activeCountryIds && Array.isArray(data.activeCountryIds) && data.activeCountryIds.length > 0) {
      const activeIds = data.activeCountryIds;
      await tx.productCountry.updateMany({
        where: { productId: product.id, countryId: { in: activeIds } },
        data: { enabled: true },
      });
      await tx.productCountry.createMany({
        data: activeIds.map((countryId) => ({ productId: product.id, countryId, enabled: true })),
        skipDuplicates: true,
      });
    }

    return product;
  });

  return updatedProduct;
}

// ─── Shipping Info ────────────────────────────────────────

export async function updateShippingInfo(id: string, data: ShippingInfoInput) {
  const existing = await prisma.product.findUnique({ where: { id, deletedAt: null }, select: { id: true } });
  if (!existing) throw new AppError("Product not found.", 404);

  return prisma.product.update({
    where: { id },
    data: {
      ...(data.packageWeight !== undefined ? { packageWeight: data.packageWeight } : {}),
      ...(data.packageLength !== undefined ? { packageLength: data.packageLength } : {}),
      ...(data.packageWidth !== undefined ? { packageWidth: data.packageWidth } : {}),
      ...(data.packageHeight !== undefined ? { packageHeight: data.packageHeight } : {}),
      ...(data.shippingClass !== undefined ? { shippingClass: data.shippingClass || null } : {}),
      ...(data.fragile !== undefined ? { fragile: data.fragile } : {}),
      ...(data.hazardous !== undefined ? { hazardous: data.hazardous } : {}),
    },
  });
}

// ─── Soft delete & Permanent delete ─────────────────────────

export async function deleteProduct(id: string) {
  await assertProductExists(id);
  return prisma.product.update({
    where: { id },
    data: {
      deletedAt: new Date(),
    },
  });
}

export async function restoreProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id },
    include: { category: true },
  });
  if (!product) throw new AppError("Product not found.", 404);
  if (!product.deletedAt) throw new AppError("Product is already active.", 400);

  // Validate Category state: cannot restore if category is soft-deleted
  if (product.category.deletedAt) {
    throw new AppError(
      `Cannot restore product: its category "${product.category.name}" is currently archived. Please restore the category first.`,
      400,
    );
  }

  // Handle SKU uniqueness conflicts if another active product has the same SKU
  if (product.sku) {
    const skuConflict = await prisma.product.findFirst({
      where: {
        sku: product.sku,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (skuConflict) {
      throw new AppError(
        `Cannot restore product: SKU "${product.sku}" is already in use by another active product "${skuConflict.title}".`,
        409,
      );
    }
  }

  // Handle Slug uniqueness conflicts
  if (product.slug) {
    const slugConflict = await prisma.product.findFirst({
      where: {
        slug: product.slug,
        deletedAt: null,
        id: { not: id },
      },
    });
    if (slugConflict) {
      const nextSlug = `${product.slug}-restored-${Date.now()}`;
      return prisma.$transaction(async (tx) => {
        const restored = await tx.product.update({
          where: { id },
          data: {
            deletedAt: null,
            status: "ACTIVE",
            slug: nextSlug,
          },
        });
        await syncStorefrontVisibility(tx, restored.id, "ACTIVE", product.status);
        return restored;
      });
    }
  }

  return prisma.$transaction(async (tx) => {
    const restored = await tx.product.update({
      where: { id },
      data: {
        deletedAt: null,
        status: "ACTIVE",
      },
    });
    await syncStorefrontVisibility(tx, restored.id, "ACTIVE", product.status);
    return restored;
  });
}

export async function permanentDeleteProduct(id: string) {
  const product = await prisma.product.findFirst({
    where: { id },
    include: {
      media: true,
      variants: true,
    },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const [orderItemCount, quoteItemCount] = await Promise.all([
    prisma.orderItem.count({ where: { productId: id } }),
    prisma.quoteItem.count({ where: { productId: id } }),
  ]);

  if (orderItemCount > 0 || quoteItemCount > 0) {
    throw new AppError(
      `Cannot permanently delete product: referenced by ${orderItemCount} order item(s) and ${quoteItemCount} quote item(s). Use normal delete (Soft Delete) instead to protect order history.`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    // Clean up join tables & children
    await tx.wishlist.deleteMany({ where: { productId: id } });
    await tx.discountProduct.deleteMany({ where: { productId: id } });
    await tx.collectionProduct.deleteMany({ where: { productId: id } });
    await tx.productCountry.deleteMany({ where: { productId: id } });
    await tx.productPaymentMethod.deleteMany({ where: { productId: id } });
    await tx.productPrice.deleteMany({ where: { productId: id } });
    await tx.moqPricing.deleteMany({ where: { productId: id } });
    await tx.tierPricing.deleteMany({ where: { productId: id } });
    await tx.productReview.deleteMany({ where: { productId: id } });
    await tx.productTranslation.deleteMany({ where: { productId: id } });

    // Clean up inventory adjustments and inventory
    await tx.inventoryAdjustment.deleteMany({ where: { inventory: { productId: id } } });

    // Clean up variants and their children
    const variantIds = product.variants.map((v) => v.id);
    if (variantIds.length > 0) {
      await tx.productVariantAttributeValue.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.variantCountry.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.variantPaymentMethod.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.productPrice.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.inventory.deleteMany({ where: { variantId: { in: variantIds } } });
      await tx.productVariant.deleteMany({ where: { productId: id } });
    }

    // Clean up attribute assignments
    await tx.productAttributeValueSelection.deleteMany({
      where: { productAttribute: { productId: id } },
    });
    await tx.productAttribute.deleteMany({ where: { productId: id } });
    await tx.productPackage.deleteMany({ where: { productId: id } });
    await tx.inventory.deleteMany({ where: { productId: id } });
    await tx.productMedia.deleteMany({ where: { productId: id } });
    await tx.product.update({
      where: { id },
      data: { taxRules: { set: [] } },
    });

    return tx.product.delete({ where: { id } });
  });
}

export async function duplicateProduct(id: string) {
  const source = await prisma.product.findFirst({
    where: { id, deletedAt: null },
    include: {
      media: { orderBy: { sortOrder: "asc" } },
      packages: { orderBy: { sortOrder: "asc" } },
      attributes: {
        include: { allowedValues: true },
        orderBy: [{ createdAt: "asc" }],
      },
      inventories: { where: { variantId: null }, include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
      countries: true,
      collections: true,
      translations: true,
      prices: { where: { deletedAt: null }, include: { country: true, currency: true } },
      variants: {
        where: { status: { not: "INACTIVE" } },
        include: {
          attributeValues: true,
          countries: true,
          inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
          prices: { where: { deletedAt: null }, include: { country: true, currency: true } },
        },
      },
    },
  });
  if (!source) throw new AppError("Product not found.", 404);

  const copiedSlug = `${slugify(source.title)}-copy-${Date.now()}`;
  const copySuffix = Date.now().toString().slice(-4);
  await assertUniqueProductSlug(copiedSlug);
  if (source.sku) await assertUniqueProductSku(`${source.sku}-copy-${copySuffix}`);

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        title: `${source.title} Copy`,
        slug: copiedSlug,
        shortDescription: source.shortDescription,
        description: source.description,
        sortOrder: source.sortOrder,
        categoryId: source.categoryId,
        sku: source.sku ? `${source.sku}-copy-${copySuffix}` : null,
        productCode: source.productCode,
        brand: source.brand,
        status: "DRAFT",
        isFeatured: source.isFeatured,
        hasVariants: source.hasVariants,
        defaultCountryId: source.defaultCountryId,
        defaultCurrencyId: source.defaultCurrencyId,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        seoKeywords: source.seoKeywords,
      },
    });

    if (source.media.length) {
      await tx.productMedia.createMany({
        data: source.media.map((media) => ({
          productId: product.id,
          url: media.url,
          publicId: media.publicId,
          type: media.type,
          altText: media.altText,
          sortOrder: media.sortOrder,
          storageProvider: media.storageProvider,
        })),
      });
    }

    if (source.countries.length) {
      await tx.productCountry.createMany({
        data: source.countries.map((country) => ({
          productId: product.id,
          countryId: country.countryId,
          enabled: country.enabled,
        })),
      });
    }

    if (source.collections.length) {
      await tx.collectionProduct.createMany({
        data: source.collections.map((collection, index) => ({
          collectionId: collection.collectionId,
          productId: product.id,
          sortOrder: collection.sortOrder || index + 1,
        })),
      });
    }

    if (source.translations.length) {
      await tx.productTranslation.createMany({
        data: source.translations.map((translation) => {
          const copiedTranslation = translation as any;
          return {
            productId: product.id,
            languageId: translation.languageId,
            title: translation.title,
            shortDescription: translation.shortDescription,
            description: translation.description,
            seoTitle: translation.seoTitle,
            seoDescription: translation.seoDescription,
            seoKeywords: copiedTranslation.seoKeywords ?? null,
            highlights: copiedTranslation.highlights ?? null,
            technicalSpecs: copiedTranslation.technicalSpecs ?? null,
            warranty: copiedTranslation.warranty ?? null,
            primaryFeatures: copiedTranslation.primaryFeatures ?? null,
            status: translation.status,
            reviewedAt: translation.reviewedAt,
            isAiGenerated: translation.isAiGenerated,
          } as never;
        }),
      });
    }

    for (const pkg of source.packages) {
      await tx.productPackage.create({
        data: {
          productId: product.id,
          title: pkg.title,
          slug: `${pkg.slug}-copy-${Date.now().toString().slice(-4)}`,
          image: pkg.image,
          description: pkg.description,
          status: pkg.status,
          sortOrder: pkg.sortOrder,
        },
      });
    }

    for (const attribute of source.attributes) {
      const copiedAttribute = await tx.productAttribute.create({
        data: {
          productId: product.id,
          attributeId: attribute.attributeId,
          required: attribute.required,
          gridAxis: attribute.gridAxis,
        },
      });

      if (attribute.allowedValues.length) {
        await tx.productAttributeValueSelection.createMany({
          data: attribute.allowedValues.map((allowedValue) => ({
            productAttributeId: copiedAttribute.id,
            attributeValueId: allowedValue.attributeValueId,
          })),
        });
      }
    }

    if (source.inventories.length) {
      await tx.inventory.createMany({
        data: source.inventories.map((inventory) => ({
          productId: product.id,
          variantId: null,
          stock: inventory.stock,
          reservedStock: inventory.reservedStock,
          lowStockThreshold: inventory.lowStockThreshold,
          status: inventory.status,
        })),
      });
    }

    if (source.prices.length) {
      await tx.productPrice.createMany({
        data: source.prices.map((price) => ({
          productId: product.id,
          variantId: null,
          countryId: price.countryId,
          currencyId: price.currencyId,
          mrp: price.mrp,
          sellingPrice: price.sellingPrice,
          dealerPrice: price.dealerPrice,
          distributorPrice: price.distributorPrice,
          taxPercentage: price.taxPercentage,
          status: price.status,
        })),
      });
    }

    return tx.product.findUnique({
      where: { id: product.id },
      include: {
        category: { select: { id: true, name: true, slug: true, status: true } },
        media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1 },
        countries: { where: { enabled: true }, select: { countryId: true } },
        inventories: { select: { stock: true, reservedStock: true } },
        prices: { where: { status: "ACTIVE", variantId: null, deletedAt: null }, orderBy: [{ sellingPrice: "asc" }], take: 1, include: { country: true, currency: true } },
        _count: { select: { variants: true, collections: true } },
      },
    });
  });
}

export async function reorderProducts(items: { id: string; sortOrder: number }[]) {
  if (!Array.isArray(items)) throw new AppError("Reorder payload must include an array of items.", 400);
  await prisma.$transaction(
    items.map((item) =>
      prisma.product.update({
        where: { id: item.id },
        data: { sortOrder: Number(item.sortOrder) || 0 },
      })
    )
  );
  return prisma.product.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      media: { where: { type: "IMAGE" }, orderBy: { sortOrder: "asc" }, take: 1 },
      _count: { select: { variants: true } },
    },
  });
}

export async function bulkUpdateProducts(data: {
  ids?: string[];
  action?: "delete" | "enable" | "disable" | "archive" | "restore" | "assignCategory" | "assignCountries" | "assignCollections" | "assignWarehouse";
  categoryId?: string;
  countryIds?: string[];
  collectionIds?: string[];
  warehouseId?: string;
  includeVariants?: boolean;
  variantIds?: string[];
  fullVariantProductIds?: string[];
  productStock?: Record<string, number>;
  variantStock?: Record<string, number>;
}) {
  const ids = Array.from(new Set(data.ids ?? []));
  const variantIds = data.variantIds ?? [];

  if (!ids.length && !variantIds.length && !(data.fullVariantProductIds?.length)) {
    throw new AppError("Select at least one product or variant.", 400);
  }

  if (ids.length > 0) {
    const products = await prisma.product.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
    if (products.length !== ids.length) throw new AppError("One or more selected products were not found.", 400);
  }

  if (data.action === "delete") {
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: {
        deletedAt: new Date(),
      },
    });
    return { updated: ids.length };
  }

  if (data.action === "enable" || data.action === "disable") {
    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id: { in: ids } },
        data: { status: data.action === "enable" ? "ACTIVE" : "INACTIVE" },
      });
      if (data.action === "enable") {
        await Promise.all(ids.map((id) => syncStorefrontVisibility(tx, id, "ACTIVE")));
      }
    });
    return { updated: ids.length };
  }

  if (data.action === "archive" || data.action === "restore") {
    await prisma.$transaction(async (tx) => {
      await tx.product.updateMany({
        where: { id: { in: ids } },
        data: { status: data.action === "archive" ? "ARCHIVED" : "ACTIVE" },
      });
      if (data.action === "restore") {
        await Promise.all(ids.map((id) => syncStorefrontVisibility(tx, id, "ACTIVE")));
      }
    });
    return { updated: ids.length };
  }

  if (data.action === "assignCategory") {
    if (!data.categoryId) throw new AppError("categoryId is required.", 400);
    await assertActiveCategory(data.categoryId);
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { categoryId: data.categoryId } });
    return { updated: ids.length };
  }

  if (data.action === "assignCountries") {
    const countryIds = Array.from(new Set(data.countryIds ?? []));
    if (!countryIds.length) throw new AppError("Select at least one country.", 400);
    const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
    if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);
    await prisma.$transaction(
      ids.flatMap((productId) =>
        countryIds.map((countryId) =>
          prisma.productCountry.upsert({
            where: { productId_countryId: { productId, countryId } },
            update: { enabled: true },
            create: { productId, countryId, enabled: true },
          })
        )
      )
    );
    return { updated: ids.length };
  }

  if (data.action === "assignCollections") {
    const collectionIds = Array.from(new Set(data.collectionIds ?? []));
    if (!collectionIds.length) throw new AppError("Select at least one collection.", 400);
    const collections = await prisma.collection.findMany({ where: { id: { in: collectionIds } }, select: { id: true } });
    if (collections.length !== collectionIds.length) throw new AppError("One or more collections were not found.", 400);
    await prisma.$transaction(
      ids.flatMap((productId) =>
        collectionIds.map((collectionId) =>
          prisma.collectionProduct.upsert({
            where: { collectionId_productId: { collectionId, productId } },
            update: {},
            create: { collectionId, productId },
          }),
        ),
      ),
    );
    return { updated: ids.length };
  }

  if (data.action === "assignWarehouse") {
    if (!data.warehouseId) throw new AppError("warehouseId is required.", 400);
    const warehouse = await prisma.warehouse.findUnique({ where: { id: data.warehouseId } });
    if (!warehouse) throw new AppError("Warehouse not found.", 400);

    // Resolve all implicated product IDs
    const allImplicatedProductIds = new Set([
      ...ids, 
      ...(data.fullVariantProductIds || [])
    ]);

    if (variantIds.length > 0) {
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { productId: true }
      });
      for (const v of variants) {
        allImplicatedProductIds.add(v.productId);
      }
    }

    const finalProductIds = Array.from(allImplicatedProductIds);

    await prisma.$transaction(async (tx) => {
      // 1. Batch fetch variants for all products in 1 query
      let variantsToAssign: Array<{ id: string; productId: string }> = [];
      if (data.includeVariants || data.fullVariantProductIds?.length) {
        variantsToAssign = await tx.productVariant.findMany({
          where: { productId: { in: finalProductIds } },
          select: { id: true, productId: true },
        });
      } else if (variantIds.length) {
        variantsToAssign = await tx.productVariant.findMany({
          where: { productId: { in: finalProductIds }, id: { in: variantIds } },
          select: { id: true, productId: true },
        });
      }

      // 2. Batch fetch existing inventory in 1 query
      const allVariantIds = variantsToAssign.map((v) => v.id);
      const existingInvs = await tx.inventory.findMany({
        where: {
          warehouseId: data.warehouseId!,
          OR: [
            { productId: { in: finalProductIds }, variantId: null },
            ...(allVariantIds.length ? [{ variantId: { in: allVariantIds } }] : []),
          ],
        },
        select: { id: true, productId: true, variantId: true, stock: true },
      });

      const existingMap = new Map<string, typeof existingInvs[0]>();
      for (const inv of existingInvs) {
        existingMap.set(`${inv.productId}:${inv.variantId ?? "__base__"}`, inv);
      }

      const toCreate: Array<{ productId: string; variantId: string | null; warehouseId: string; stock: number }> = [];
      const toUpdate: Array<{ id: string; stock: number }> = [];

      for (const productId of finalProductIds) {
        const existing = existingMap.get(`${productId}:__base__`);
        const providedStock = data.productStock?.[productId];
        if (!existing) {
          toCreate.push({
            productId,
            variantId: null,
            warehouseId: data.warehouseId!,
            stock: providedStock ?? 0,
          });
        } else if (providedStock !== undefined && existing.stock !== providedStock) {
          toUpdate.push({ id: existing.id, stock: providedStock });
        }
      }

      for (const variant of variantsToAssign) {
        const existing = existingMap.get(`${variant.productId}:${variant.id}`);
        const vProvidedStock = data.variantStock?.[variant.id];
        if (!existing) {
          toCreate.push({
            productId: variant.productId,
            variantId: variant.id,
            warehouseId: data.warehouseId!,
            stock: vProvidedStock ?? 0,
          });
        } else if (vProvidedStock !== undefined && existing.stock !== vProvidedStock) {
          toUpdate.push({ id: existing.id, stock: vProvidedStock });
        }
      }

      for (let i = 0; i < toCreate.length; i += 1000) {
        await tx.inventory.createMany({
          data: toCreate.slice(i, i + 1000),
          skipDuplicates: true,
        });
      }

      for (const item of toUpdate) {
        await tx.inventory.update({
          where: { id: item.id },
          data: { stock: item.stock },
        });
      }
    });
    return { updated: finalProductIds.length };
  }

  if (data.action === "unassignWarehouse") {
    if (!data.warehouseId) throw new AppError("warehouseId is required.", 400);
    
    const allImplicatedProductIds = new Set([
      ...ids, 
      ...(data.fullVariantProductIds || [])
    ]);

    if (variantIds.length > 0) {
      const variants = await prisma.productVariant.findMany({
        where: { id: { in: variantIds } },
        select: { productId: true }
      });
      for (const v of variants) {
        allImplicatedProductIds.add(v.productId);
      }
    }

    const finalProductIds = Array.from(allImplicatedProductIds);

    let deletedCount = 0;
    await prisma.$transaction(async (tx) => {
      const baseProductIds = finalProductIds.filter((pId) => ids.includes(pId));
      if (baseProductIds.length > 0) {
        const del = await tx.inventory.deleteMany({
          where: { productId: { in: baseProductIds }, variantId: null, warehouseId: data.warehouseId! }
        });
        deletedCount += del.count;
      }

      const fullVariantProductIds = finalProductIds.filter((pId) => data.fullVariantProductIds?.includes(pId) || data.includeVariants);
      if (fullVariantProductIds.length > 0) {
        const del = await tx.inventory.deleteMany({
          where: { productId: { in: fullVariantProductIds }, variantId: { not: null }, warehouseId: data.warehouseId! }
        });
        deletedCount += del.count;
      } else if (variantIds.length > 0) {
        const del = await tx.inventory.deleteMany({
          where: { variantId: { in: variantIds }, warehouseId: data.warehouseId! }
        });
        deletedCount += del.count;
      }
    });
    return { updated: deletedCount };
  }

  throw new AppError("Unsupported bulk action.", 400);
}

export async function listProductCountries(productId: string) {
  await assertProductExists(productId);
  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.productCountry.findMany({ where: { productId } }),
  ]);
  const mappingByCountry = new Map(mappings.map((mapping) => [mapping.countryId, mapping]));
  return countries.map((country) => {
    const mapping = mappingByCountry.get(country.id);
    return {
      ...country,
      productCountryId: mapping?.id ?? null,
      enabled: mapping?.enabled ?? false,
    };
  });
}

export async function updateProductCountries(productId: string, items: { countryId: string; enabled: boolean }[]) {
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    select: { id: true, categoryId: true },
  });
  if (!product) throw new AppError("Product not found.", 404);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);
  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);

  const enabledCountryIds = items.filter((item) => item.enabled).map((item) => item.countryId);
  const disabledCountryIds = items.filter((item) => !item.enabled).map((item) => item.countryId);

  await prisma.$transaction(async (tx) => {
    if (enabledCountryIds.length) {
      await tx.productCountry.updateMany({
        where: { productId, countryId: { in: enabledCountryIds } },
        data: { enabled: true },
      });
      await tx.productCountry.createMany({
        data: enabledCountryIds.map((countryId) => ({ productId, countryId, enabled: true })),
        skipDuplicates: true,
      });
      await tx.productPrice.updateMany({
        where: { productId, countryId: { in: enabledCountryIds } },
        data: { status: "ACTIVE" },
      });
    }

    if (disabledCountryIds.length) {
      await tx.productCountry.updateMany({
        where: { productId, countryId: { in: disabledCountryIds } },
        data: { enabled: false },
      });
      await tx.productCountry.createMany({
        data: disabledCountryIds.map((countryId) => ({ productId, countryId, enabled: false })),
        skipDuplicates: true,
      });
      await tx.productPrice.updateMany({
        where: { productId, countryId: { in: disabledCountryIds } },
        data: { status: "INACTIVE" },
      });
    }

    if (enabledCountryIds.length && product.categoryId) {
      await tx.categoryCountry.createMany({
        data: enabledCountryIds.map((countryId) => ({ categoryId: product.categoryId, countryId, enabled: true })),
        skipDuplicates: true,
      });
    }
  });

  if (enabledCountryIds.length) {
    const variants = await prisma.productVariant.findMany({
      where: { productId },
      select: { id: true },
    });
    if (variants.length) {
      await syncVariantCountriesFromProduct(
        productId,
        variants.map((variant) => variant.id),
      );
    }
  }

  return listProductCountries(productId);
}

export async function listVariantCountries(productId: string, variantId: string) {
  await getVariant(productId, variantId);
  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.variantCountry.findMany({ where: { variantId } }),
  ]);
  const mappingByCountry = new Map(mappings.map((mapping) => [mapping.countryId, mapping]));
  return countries.map((country) => {
    const mapping = mappingByCountry.get(country.id);
    return {
      ...country,
      variantCountryId: mapping?.id ?? null,
      enabled: mapping?.enabled ?? false,
    };
  });
}

async function syncVariantCountriesFromProduct(productId: string, variantIds: string[]) {
  const uniqueVariantIds = Array.from(new Set(variantIds));
  if (!uniqueVariantIds.length) return;

  const enabledCountries = await prisma.productCountry.findMany({
    where: { productId, enabled: true },
    select: { countryId: true },
  });

  if (!enabledCountries.length) return;

  const allRows = uniqueVariantIds.flatMap((variantId) =>
    enabledCountries.map((country) => ({
      variantId,
      countryId: country.countryId,
      enabled: true,
    })),
  );

  for (let i = 0; i < allRows.length; i += 1000) {
    await prisma.variantCountry.createMany({
      data: allRows.slice(i, i + 1000),
      skipDuplicates: true,
    });
  }
}

export async function updateVariantCountries(
  productId: string,
  variantId: string,
  items: { countryId: string; enabled: boolean }[]
) {
  await getVariant(productId, variantId);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);
  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.variantCountry.upsert({
        where: { variantId_countryId: { variantId, countryId: item.countryId } },
        update: { enabled: Boolean(item.enabled) },
        create: { variantId, countryId: item.countryId, enabled: Boolean(item.enabled) },
      }),
    ),
  );
  return listVariantCountries(productId, variantId);
}

export async function createPackage(
  productId: string,
  data: { title: string; image?: string | null; description?: string | null; sortOrder?: number; status?: string }
) {
  await assertProductExists(productId);
  const title = data.title.trim();
  const slug = slugify(title);
  const existing = await prisma.productPackage.findFirst({ where: { productId, slug } });
  if (existing) throw new AppError("A package with this title already exists for this product.", 409);

  return prisma.productPackage.create({
    data: {
      productId,
      title,
      slug,
      image: data.image || null,
      description: data.description || null,
      sortOrder: data.sortOrder ?? 0,
      status: (data.status as never) || "ACTIVE",
    },
  });
}

export async function updatePackage(
  productId: string,
  packageId: string,
  data: { title?: string; image?: string | null; description?: string | null; sortOrder?: number; status?: string }
) {
  const existing = await prisma.productPackage.findFirst({ where: { id: packageId, productId } });
  if (!existing) throw new AppError("Package not found.", 404);

  const nextTitle = data.title?.trim();
  const nextSlug = nextTitle ? slugify(nextTitle) : existing.slug;
  if (nextSlug !== existing.slug) {
    const duplicate = await prisma.productPackage.findFirst({
      where: { productId, slug: nextSlug, NOT: { id: packageId } },
    });
    if (duplicate) throw new AppError("A package with this title already exists for this product.", 409);
  }

  return prisma.productPackage.update({
    where: { id: packageId },
    data: {
      ...(nextTitle ? { title: nextTitle, slug: nextSlug } : {}),
      ...(data.image !== undefined ? { image: data.image || null } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.status !== undefined ? { status: data.status as never } : {}),
    },
  });
}

export async function deletePackage(productId: string, packageId: string) {
  const existing = await prisma.productPackage.findFirst({ where: { id: packageId, productId } });
  if (!existing) throw new AppError("Package not found.", 404);
  return prisma.productPackage.update({
    where: { id: packageId },
    data: { status: "INACTIVE" },
  });
}

// ─── Upload product media ─────────────────────────────────

export async function addProductMedia(
  productId: string,
  files: Express.Multer.File[],
  altTexts: string[],
  mediaIds: string[] = []
) {
  await assertProductExists(productId);
  
  if ((!files || !files.length) && (!mediaIds || !mediaIds.length)) {
    return [];
  }

  const results: any[] = [];
  const genericMediaRecords: any[] = [];
  
  // 1. Handle multer files (Legacy / Local)
  if (files && files.length > 0) {
    const uploadedFiles = await Promise.all(
      files.map((file) => uploadFile(file.path, `modortho/products/${productId}`))
    );
    uploadedFiles.forEach((r, i) => {
      results.push({
        url: r.url,
        publicId: r.publicId,
        storageProvider: r.storageProvider,
        mimeType: files[i].mimetype,
        altText: altTexts[i] || "",
        sortOrder: i,
      });
      genericMediaRecords.push({
        entityType: "PRODUCT",
        entityId: productId,
        filename: files[i].originalname,
        originalName: files[i].originalname,
        url: r.url,
        publicId: r.publicId,
        mimeType: files[i].mimetype,
        size: files[i].size,
        type: files[i].mimetype.startsWith("image") ? ("IMAGE" as const) : ("DOCUMENT" as const),
        storageProvider: r.storageProvider,
        folder: `modortho/products/${productId}`,
      });
    });
  }

  // 2. Handle pre-uploaded generic media (S3 Dual-mode)
  if (mediaIds && mediaIds.length > 0) {
    const existingMedia = await prisma.media.findMany({ where: { id: { in: mediaIds } } });
    existingMedia.forEach((media, i) => {
      if (!media.url || media.url.startsWith("temporary/")) {
        throw new AppError("Product media cannot be linked before upload confirmation produces a final URL.", 400);
      }
      results.push({
        url: media.url,
        publicId: media.publicId,
        storageProvider: media.storageProvider,
        mimeType: media.mimeType,
        altText: altTexts[files.length + i] || "",
        sortOrder: files.length + i,
      });
    });
  }

  const mediaRecords = results.map((r, i) => {
    // If it's a file, we can check mimetype. If it's from mediaIds, we mapped mimeType in results.
    const mime = files && files[i] ? files[i].mimetype : (r.mimeType || "");
    return {
      productId,
      url: r.url,
      publicId: r.publicId,
      storageProvider: r.storageProvider,
      altText: r.altText || "",
      type: mime.startsWith("image") ? ("IMAGE" as const) : ("PDF" as const),
      sortOrder: r.sortOrder || i,
    };
  });

  await prisma.productMedia.createMany({ data: mediaRecords });

  if (genericMediaRecords.length > 0) {
    await prisma.media.createMany({ data: genericMediaRecords });
  }
  
  return prisma.productMedia.findMany({ where: { productId } });
}

// ─── Set cover product media ──────────────────────────────

export async function setProductCoverMedia(productId: string, mediaId: string) {
  await assertProductExists(productId);

  const targetMedia = await prisma.productMedia.findUnique({
    where: { id: mediaId },
  });

  if (!targetMedia || targetMedia.productId !== productId) {
    throw new AppError("Media not found for this product.", 404);
  }

  // Fetch all media for this product ordered by current sortOrder, then createdAt
  const allMedia = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  // Reorder: targetMedia first (sortOrder: 0), all others sequentially (1, 2, 3...)
  const otherMedia = allMedia.filter((m) => m.id !== mediaId);
  const reordered = [targetMedia, ...otherMedia];

  await prisma.$transaction(
    reordered.map((m, index) =>
      prisma.productMedia.update({
        where: { id: m.id },
        data: { sortOrder: index },
      })
    )
  );

  return prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// ─── Reorder product media ────────────────────────────────

export async function reorderProductMedia(productId: string, mediaIds: string[]) {
  await assertProductExists(productId);

  if (!Array.isArray(mediaIds) || mediaIds.length === 0) {
    throw new AppError("Invalid media order payload.", 400);
  }

  // Fetch all existing media for this product
  const allMedia = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  const existingMap = new Map(allMedia.map((m) => [m.id, m]));

  // Build the reordered list starting with the specified order
  const specifiedMedia: typeof allMedia = [];
  for (const id of mediaIds) {
    const item = existingMap.get(id);
    if (item) {
      specifiedMedia.push(item);
      existingMap.delete(id);
    }
  }

  // Any remaining media not explicitly mentioned maintain their relative sequence at the end
  const remainingMedia = Array.from(existingMap.values());
  const finalSequence = [...specifiedMedia, ...remainingMedia];

  await prisma.$transaction(
    finalSequence.map((m, index) =>
      prisma.productMedia.update({
        where: { id: m.id },
        data: { sortOrder: index },
      })
    )
  );

  return prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });
}

// ─── Delete product media ─────────────────────────────────

export async function deleteProductMedia(mediaId: string) {
  const media = await prisma.productMedia.findUnique({ where: { id: mediaId } });
  if (!media) throw new AppError("Media not found.", 404);
  const productId = media.productId;
  await deleteFile(media.publicId || media.url, media.storageProvider);
  await prisma.media.deleteMany({ where: { url: media.url } });
  await prisma.productMedia.delete({ where: { id: mediaId } });

  // Re-index remaining media to ensure clean sequential sortOrder (0, 1, 2...)
  const remaining = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((m, index) =>
        prisma.productMedia.update({
          where: { id: m.id },
          data: { sortOrder: index },
        })
      )
    );
  }

  return remaining;
}

export async function deleteBulkProductMedia(productId: string, mediaIds: string[]) {
  if (!mediaIds || !mediaIds.length) return [];
  const mediaList = await prisma.productMedia.findMany({
    where: { id: { in: mediaIds }, productId },
  });
  if (!mediaList.length) return [];

  for (const media of mediaList) {
    try {
      await deleteFile(media.publicId || media.url, media.storageProvider);
    } catch (err) {
      console.error("Failed to delete file from storage", err);
    }
  }

  const urls = mediaList.map((m) => m.url);
  await prisma.media.deleteMany({ where: { url: { in: urls } } });
  await prisma.productMedia.deleteMany({ where: { id: { in: mediaIds }, productId } });

  // Re-index remaining media to ensure clean sequential sortOrder (0, 1, 2...)
  const remaining = await prisma.productMedia.findMany({
    where: { productId },
    orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
  });

  if (remaining.length > 0) {
    await prisma.$transaction(
      remaining.map((m, index) =>
        prisma.productMedia.update({
          where: { id: m.id },
          data: { sortOrder: index },
        })
      )
    );
  }

  return remaining;
}

// ─── Assign attributes to product ────────────────────────

export async function assignAttributes(
  productId: string,
  attributes: { attributeId: string; required: boolean; gridAxis?: "ROW" | "COLUMN" | null; allowedValueIds?: string[] }[]
) {
  await assertProductExists(productId);
  if (!Array.isArray(attributes)) throw new AppError("Attributes payload must be an array.", 400);

  const attributeIds = attributes.map((attributeConfig) => attributeConfig.attributeId);
  if (attributeIds.some((attributeId) => !attributeId)) throw new AppError("Every attribute mapping needs an attributeId.", 400);
  if (new Set(attributeIds).size !== attributeIds.length) {
    throw new AppError("Each attribute can only be mapped to the product once.", 400);
  }
  if (attributes.some((attributeConfig) => attributeConfig.gridAxis && !["ROW", "COLUMN"].includes(attributeConfig.gridAxis))) {
    throw new AppError("Grid axis must be ROW or COLUMN when provided.", 400);
  }

  const existingAttributes = await prisma.attribute.findMany({
    where: { id: { in: attributeIds } },
    select: { id: true, name: true, role: true },
  });
  if (existingAttributes.length !== attributeIds.length) throw new AppError("One or more attributes were not found.", 400);

  const allowedValueIds = Array.from(new Set(attributes.flatMap((attributeConfig) => attributeConfig.allowedValueIds ?? [])));
  const allowedValues = allowedValueIds.length
    ? await prisma.attributeValue.findMany({
        where: { id: { in: allowedValueIds } },
        select: { id: true, attributeId: true },
      })
    : [];
  if (allowedValues.length !== allowedValueIds.length) throw new AppError("One or more allowed values were not found.", 400);

  const valueAttributeById = new Map(allowedValues.map((value) => [value.id, value.attributeId]));
  for (const attributeConfig of attributes) {
    const invalidValue = (attributeConfig.allowedValueIds ?? []).find(
      (attributeValueId) => valueAttributeById.get(attributeValueId) !== attributeConfig.attributeId,
    );
    if (invalidValue) throw new AppError("Allowed values must belong to their mapped attribute.", 400);
  }

  return prisma.$transaction(async (tx) => {
    await tx.productAttributeValueSelection.deleteMany({
      where: { productAttribute: { productId } },
    });
    await tx.productAttribute.deleteMany({ where: { productId } });

    const baseTime = Date.now();
    const created: any[] = [];
    let sortIndex = 0;
    for (const attributeConfig of attributes) {
      const createdAttr = await tx.productAttribute.create({
        data: {
          productId,
          attributeId: attributeConfig.attributeId,
          required: Boolean(attributeConfig.required),
          gridAxis: attributeConfig.gridAxis ?? null,
          createdAt: new Date(baseTime + sortIndex * 1000),
        },
      });
      sortIndex++;

      const uniqueAllowedValueIds = Array.from(new Set(attributeConfig.allowedValueIds ?? []));
      if (uniqueAllowedValueIds.length) {
        await tx.productAttributeValueSelection.createMany({
          data: uniqueAllowedValueIds.map((attributeValueId) => ({
            productAttributeId: createdAttr.id,
            attributeValueId,
          })),
        });
      }

      created.push(createdAttr);
    }

    // Synchronize existing variant titles to match the updated attribute sequence
    const attributeOrderMap = new Map(attributes.map((a, idx) => [a.attributeId, idx]));
    const existingVariants = await tx.productVariant.findMany({
      where: { productId, deletedAt: null },
      include: {
        package: true,
        attributeValues: {
          include: { attributeValue: true },
        },
      },
    });

    const titlesToUpdate: { id: string; title: string }[] = [];
    for (const variant of existingVariants) {
      if (!variant.attributeValues.length) continue;
      const sortedValues = [...variant.attributeValues]
        .sort((a, b) => {
          const orderA = attributeOrderMap.has(a.attributeId) ? attributeOrderMap.get(a.attributeId)! : 9999;
          const orderB = attributeOrderMap.has(b.attributeId) ? attributeOrderMap.get(b.attributeId)! : 9999;
          return orderA - orderB;
        })
        .map((av) => av.attributeValue);

      const newTitle = buildVariantTitle(sortedValues, variant.package?.title);
      if (newTitle && newTitle !== variant.title) {
        titlesToUpdate.push({ id: variant.id, title: newTitle });
      }
    }

    if (titlesToUpdate.length > 0) {
      for (let i = 0; i < titlesToUpdate.length; i += 50) {
        const chunk = titlesToUpdate.slice(i, i + 50);
        await Promise.all(
          chunk.map((item) =>
            tx.productVariant.update({
              where: { id: item.id },
              data: { title: item.title },
            })
          )
        );
      }
    }

    return created;
  }, { timeout: 30000, maxWait: 10000 });
}

export async function listProductAttributes(productId: string) {
  await assertProductExists(productId);
  return prisma.productAttribute.findMany({
    where: { productId },
    orderBy: { createdAt: "asc" },
    include: {
      attribute: {
        include: {
          values: {
            where: { status: "ACTIVE" },
            include: { country: { select: { id: true, name: true, code: true } } },
            orderBy: [{ sortOrder: "asc" }, { value: "asc" }],
          },
        },
      },
      allowedValues: {
        include: {
          attributeValue: {
            include: { country: { select: { id: true, name: true, code: true } } },
          },
        },
        orderBy: { attributeValue: { sortOrder: "asc" } },
      },
    },
  });
}

export async function removeProductAttribute(productId: string, attributeId: string) {
  await assertProductExists(productId);
  const existing = await prisma.productAttribute.findUnique({
    where: { productId_attributeId: { productId, attributeId } },
  });
  if (!existing) throw new AppError("Attribute mapping not found for this product.", 404);

  await prisma.$transaction([
    prisma.productAttributeValueSelection.deleteMany({ where: { productAttributeId: existing.id } }),
    prisma.productAttribute.delete({ where: { id: existing.id } }),
  ]);
  return { id: existing.id, productId, attributeId };
}

// ─── Product Attributes Spreadsheet Export & Import ────────

const PRODUCT_ATTRIBUTE_EXPORT_COLUMNS = [
  { key: "attributeName", header: "attributeName" },
  { key: "slug", header: "slug" },
  { key: "displayType", header: "displayType" },
  { key: "required", header: "required" },
  { key: "allowedValues", header: "allowedValues" },
] as const;

function getProductAttrRowField(row: Record<string, string>, ...fieldNames: string[]) {
  for (const name of fieldNames) {
    const direct = row[name];
    if (direct !== undefined && direct !== "") return String(direct).trim();
    const lowerKey = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
    if (lowerKey && row[lowerKey] !== undefined && row[lowerKey] !== "") {
      return String(row[lowerKey]).trim();
    }
  }
  return "";
}

function parseBool(val?: string) {
  if (!val) return false;
  const s = val.trim().toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function normalizeDisplayTypeToGridAxis(str: string): GridAxis | null {
  const upper = str.toUpperCase().trim().replace(/[- ]/g, "_");
  if (upper === "X_GRID" || upper === "COLUMN" || upper === "MATRIX_COLUMNS") return "COLUMN";
  if (upper === "Y_GRID" || upper === "ROW" || upper === "MATRIX_ROWS") return "ROW";
  return null;
}

export async function exportProductAttributesSpreadsheet(productId: string) {
  const product = await assertProductExists(productId);
  const mappings = await listProductAttributes(productId);

  const rows = mappings.map((m) => {
    const allowedValuesStr = m.allowedValues.length
      ? m.allowedValues.map((av) => av.attributeValue.value).join(", ")
      : m.attribute.values.map((v) => v.value).join(", ");

    const displayType =
      m.gridAxis === "COLUMN" ? "X_GRID" : m.gridAxis === "ROW" ? "Y_GRID" : "DROPDOWN";

    return {
      attributeName: m.attribute.name,
      slug: m.attribute.slug,
      displayType,
      required: m.required ? "TRUE" : "FALSE",
      allowedValues: allowedValuesStr,
    };
  });

  const buffer = writeSpreadsheetBuffer(
    rows,
    "Product Attributes",
    PRODUCT_ATTRIBUTE_EXPORT_COLUMNS.map((c) => ({ key: c.key, header: c.header })),
  );

  return {
    buffer,
    filename: `product-${product.slug || product.id}-attributes.xlsx`,
  };
}

export function generateSampleProductAttributesTemplate() {
  const sampleRows = [
    {
      attributeName: "Slot",
      slug: "slot",
      displayType: "X_GRID",
      required: "TRUE",
      allowedValues: ".018, .022",
    },
    {
      attributeName: "Hook",
      slug: "hook",
      displayType: "Y_GRID",
      required: "TRUE",
      allowedValues: "None, Hook 3, Hook 4, Hook 5",
    },
    {
      attributeName: "Prescription",
      slug: "prescription",
      displayType: "DROPDOWN",
      required: "TRUE",
      allowedValues: "MBT, Roth, Alexander",
    },
    {
      attributeName: "Wire Size",
      slug: "wire-size",
      displayType: "X_GRID",
      required: "TRUE",
      allowedValues: ".018 x .025, .019 x .025",
    },
    {
      attributeName: "Arch",
      slug: "arch",
      displayType: "Y_GRID",
      required: "TRUE",
      allowedValues: "Upper, Lower",
    },
  ];

  return writeSpreadsheetBuffer(
    sampleRows,
    "Product Attributes",
    PRODUCT_ATTRIBUTE_EXPORT_COLUMNS.map((c) => ({ key: c.key, header: c.header })),
  );
}

export async function previewProductAttributesImport(productId: string, filePath: string) {
  await assertProductExists(productId);
  const rawRows = readSpreadsheetRows(filePath);
  const issues: Array<{ row: number; field: string; message: string }> = [];
  const duplicateWarnings: string[] = [];
  const previewRows: Record<string, unknown>[] = [];
  const seenAttr = new Set<string>();

  const allAttributes = await prisma.attribute.findMany({
    include: { values: { where: { status: "ACTIVE" } } },
  });
  const attributeByName = new Map(allAttributes.map((a) => [a.name.toLowerCase(), a]));
  const attributeBySlug = new Map(allAttributes.map((a) => [a.slug.toLowerCase(), a]));

  for (const [index, row] of rawRows.entries()) {
    const rowNumber = index + 2;
    const attrName = getProductAttrRowField(row, "attributeName", "name", "attribute", "attribute_name");
    const slugStr = getProductAttrRowField(row, "slug", "attributeSlug");
    const displayTypeStr = getProductAttrRowField(row, "displayType", "role", "gridAxis", "type");
    const requiredStr = getProductAttrRowField(row, "required", "isRequired");
    const valuesStr = getProductAttrRowField(row, "allowedValues", "values", "options", "value");

    if (!attrName && !slugStr) {
      issues.push({ row: rowNumber, field: "attributeName", message: "Attribute name or slug is required." });
      continue;
    }

    const key = (attrName || slugStr).toLowerCase();
    if (seenAttr.has(key)) {
      duplicateWarnings.push(`Duplicate attribute '${attrName || slugStr}' found on row ${rowNumber}.`);
    } else {
      seenAttr.add(key);
    }

    const matchedAttr =
      (attrName ? attributeByName.get(attrName.toLowerCase()) : null) ||
      (slugStr ? attributeBySlug.get(slugStr.toLowerCase()) : null);

    if (!matchedAttr) {
      issues.push({
        row: rowNumber,
        field: "attributeName",
        message: `Attribute '${attrName || slugStr}' does not exist in catalog.`,
      });
    }

    const valueCount = valuesStr
      ? valuesStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean).length
      : 0;

    previewRows.push({
      row: rowNumber,
      attributeName: matchedAttr?.name || attrName || slugStr,
      slug: matchedAttr?.slug || slugStr,
      displayType: displayTypeStr
        ? normalizeDisplayTypeToGridAxis(displayTypeStr) === "COLUMN"
          ? "X_GRID"
          : normalizeDisplayTypeToGridAxis(displayTypeStr) === "ROW"
          ? "Y_GRID"
          : "DROPDOWN"
        : "DROPDOWN",
      required: parseBool(requiredStr),
      values: valuesStr,
      valueCount,
    });
  }

  return {
    totalRows: rawRows.length,
    validRows: Math.max(0, rawRows.length - issues.length),
    invalidRows: issues.length,
    issues,
    duplicateWarnings,
    sampleRows: previewRows.slice(0, 10),
    rows: previewRows.map((r) => {
      const rowIssues = issues.filter((iss) => iss.row === r.row);
      return {
        ...r,
        rowNumber: r.row,
        isValid: rowIssues.length === 0,
        errors: rowIssues.map((iss) => (iss.field ? `[${iss.field}] ${iss.message}` : iss.message)),
        allowedValues: r.values,
        role: r.displayType,
      };
    }),
  };
}

export async function importProductAttributesSpreadsheet(productId: string, filePathOrRows: string | any[]) {
  await assertProductExists(productId);
  const rawRows: any[] = Array.isArray(filePathOrRows) ? filePathOrRows : readSpreadsheetRows(filePathOrRows);
  if (rawRows.length === 0) {
    throw new AppError("Uploaded spreadsheet is empty.", 400);
  }

  if (typeof filePathOrRows === "string") {
    const preview = await previewProductAttributesImport(productId, filePathOrRows);
    if (preview.issues.length > 0) {
      throw new AppError(`Spreadsheet validation failed with ${preview.issues.length} issue(s).`, 400);
    }
  }

  const allAttributes = await prisma.attribute.findMany({
    include: { values: true },
  });
  const attributeByName = new Map(allAttributes.map((a) => [a.name.toLowerCase(), a]));
  const attributeBySlug = new Map(allAttributes.map((a) => [a.slug.toLowerCase(), a]));

  const summary = {
    created: 0,
    updated: 0,
    totalProcessed: rawRows.length,
  };

  await prisma.$transaction(async (tx) => {
    for (const row of rawRows) {
      const attrName = getProductAttrRowField(row, "attributeName", "name", "attribute", "attribute_name");
      const slugStr = getProductAttrRowField(row, "slug", "attributeSlug");
      const displayTypeStr = getProductAttrRowField(row, "displayType", "role", "gridAxis", "type");
      const requiredStr = getProductAttrRowField(row, "required", "isRequired");
      const valuesStr = getProductAttrRowField(row, "allowedValues", "values", "options", "value");

      const matchedAttr =
        (attrName ? attributeByName.get(attrName.toLowerCase()) : null) ||
        (slugStr ? attributeBySlug.get(slugStr.toLowerCase()) : null);

      if (!matchedAttr) continue;

      const gridAxis = normalizeDisplayTypeToGridAxis(displayTypeStr);
      const required = parseBool(requiredStr);

      // Parse allowed values
      const allowedValueIds: string[] = [];
      if (valuesStr) {
        const rawValueItems = valuesStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
        for (const rawItem of rawValueItems) {
          const priceMatch = rawItem.match(/^(.*?)\s*\(\+?([0-9.]+)\)$/);
          const valName = priceMatch ? priceMatch[1].trim() : rawItem;
          if (!valName) continue;

          let existingVal = matchedAttr.values.find(
            (v) =>
              v.value.toLowerCase() === valName.toLowerCase() ||
              v.slug.toLowerCase() === slugify(valName).toLowerCase(),
          );

          if (!existingVal) {
            const valSlug = slugify(valName);
            let uniqueSlug = valSlug;
            let counter = 1;
            while (
              await tx.attributeValue.findFirst({ where: { attributeId: matchedAttr.id, slug: uniqueSlug } })
            ) {
              uniqueSlug = `${valSlug}-${counter++}`;
            }
            existingVal = await tx.attributeValue.create({
              data: {
                attributeId: matchedAttr.id,
                value: valName,
                slug: uniqueSlug,
                status: "ACTIVE",
              },
            });
            matchedAttr.values.push(existingVal);
          }
          allowedValueIds.push(existingVal.id);
        }
      }

      // Upsert product attribute mapping
      const existingMapping = await tx.productAttribute.findUnique({
        where: { productId_attributeId: { productId, attributeId: matchedAttr.id } },
      });

      let productAttributeId: string;
      if (existingMapping) {
        await tx.productAttribute.update({
          where: { id: existingMapping.id },
          data: {
            required,
            gridAxis,
          },
        });
        productAttributeId = existingMapping.id;
        summary.updated++;
      } else {
        const created = await tx.productAttribute.create({
          data: {
            productId,
            attributeId: matchedAttr.id,
            required,
            gridAxis,
          },
        });
        productAttributeId = created.id;
        summary.created++;
      }

      // Re-assign allowed values for this product attribute
      await tx.productAttributeValueSelection.deleteMany({
        where: { productAttributeId },
      });

      if (allowedValueIds.length > 0) {
        const uniqueIds = Array.from(new Set(allowedValueIds));
        await tx.productAttributeValueSelection.createMany({
          data: uniqueIds.map((id) => ({
            productAttributeId,
            attributeValueId: id,
          })),
        });
      }
    }
  });

  return summary;
}

export function generateSampleCatalogAttributeMappingsTemplate() {
  const sampleRows = [
    {
      productSku: "PRD-MB-001",
      productTitle: "Metal Bracket MBT .022",
      attributeName: "Slot",
      displayType: "X_GRID",
      required: "TRUE",
      allowedValues: ".018, .022",
    },
    {
      productSku: "PRD-MB-001",
      productTitle: "Metal Bracket MBT .022",
      attributeName: "Hook",
      displayType: "Y_GRID",
      required: "TRUE",
      allowedValues: "None, Hook 3, Hook 4, Hook 5",
    },
    {
      productSku: "PRD-MB-001",
      productTitle: "Metal Bracket MBT .022",
      attributeName: "Prescription",
      displayType: "DROPDOWN",
      required: "TRUE",
      allowedValues: "MBT, Roth",
    },
    {
      productSku: "PRD-NW-001",
      productTitle: "NiTi Archwire Natural",
      attributeName: "Wire Size",
      displayType: "X_GRID",
      required: "TRUE",
      allowedValues: ".012, .014, .016, .018, .018 x .025, .019 x .025",
    },
    {
      productSku: "PRD-NW-001",
      productTitle: "NiTi Archwire Natural",
      attributeName: "Arch",
      displayType: "Y_GRID",
      required: "TRUE",
      allowedValues: "Upper, Lower",
    },
    {
      productSku: "PRD-CB-001",
      productTitle: "Ceramic Aesthetic Bracket MBT",
      attributeName: "Slot",
      displayType: "X_GRID",
      required: "TRUE",
      allowedValues: "ALL",
    },
  ];

  const columns = [
    { key: "productSku", header: "Product SKU / Code" },
    { key: "productTitle", header: "Product Title (Optional)" },
    { key: "attributeName", header: "Attribute Name" },
    { key: "displayType", header: "Display Type" },
    { key: "required", header: "Required" },
    { key: "allowedValues", header: "Allowed Values" },
  ];

  return writeSpreadsheetBuffer(sampleRows, "Attribute Mappings", columns);
}

export async function previewCatalogAttributeMappingsImport(filePath: string) {
  const rawRows = readSpreadsheetRows(filePath);
  const issues: Array<{ row: number; field: string; message: string }> = [];
  const duplicateWarnings: string[] = [];
  const previewRows: Record<string, unknown>[] = [];
  const seenMapping = new Set<string>();

  const allProducts = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, sku: true, productCode: true, title: true, slug: true },
  });
  const productBySku = new Map(allProducts.filter((p) => p.sku).map((p) => [p.sku!.trim().toLowerCase(), p]));
  const productByCode = new Map(allProducts.filter((p) => p.productCode).map((p) => [p.productCode!.trim().toLowerCase(), p]));
  const productByTitle = new Map(allProducts.map((p) => [p.title.trim().toLowerCase(), p]));
  const productBySlug = new Map(allProducts.map((p) => [p.slug.trim().toLowerCase(), p]));
  const productById = new Map(allProducts.map((p) => [p.id, p]));

  const allAttributes = await prisma.attribute.findMany({
    include: { values: { where: { status: "ACTIVE" } } },
  });
  const attributeByName = new Map(allAttributes.map((a) => [a.name.trim().toLowerCase(), a]));
  const attributeBySlug = new Map(allAttributes.map((a) => [a.slug.trim().toLowerCase(), a]));

  for (const [index, row] of rawRows.entries()) {
    const rowNumber = index + 2;
    const prodKey = getProductAttrRowField(row, "productSku", "sku", "productCode", "code", "productTitle", "product", "title", "productId", "id");
    const attrName = getProductAttrRowField(row, "attributeName", "name", "attribute", "attribute_name");
    const slugStr = getProductAttrRowField(row, "slug", "attributeSlug");
    const displayTypeStr = getProductAttrRowField(row, "displayType", "role", "gridAxis", "type");
    const requiredStr = getProductAttrRowField(row, "required", "isRequired");
    const valuesStr = getProductAttrRowField(row, "allowedValues", "values", "options", "value");

    const rowErrors: string[] = [];

    if (!prodKey) {
      issues.push({ row: rowNumber, field: "productSku", message: "Product SKU, Code or Title is required." });
      rowErrors.push("Product identifier is required.");
    }
    if (!attrName && !slugStr) {
      issues.push({ row: rowNumber, field: "attributeName", message: "Attribute name or slug is required." });
      rowErrors.push("Attribute name is required.");
    }

    const matchedProduct = prodKey
      ? productBySku.get(prodKey.toLowerCase()) ||
        productByCode.get(prodKey.toLowerCase()) ||
        productByTitle.get(prodKey.toLowerCase()) ||
        productBySlug.get(prodKey.toLowerCase()) ||
        productById.get(prodKey)
      : null;

    if (prodKey && !matchedProduct) {
      issues.push({ row: rowNumber, field: "productSku", message: `Product '${prodKey}' not found in catalog.` });
      rowErrors.push(`Product '${prodKey}' not found.`);
    }

    const matchedAttr =
      (attrName ? attributeByName.get(attrName.toLowerCase()) : null) ||
      (slugStr ? attributeBySlug.get(slugStr.toLowerCase()) : null);

    if ((attrName || slugStr) && !matchedAttr) {
      issues.push({ row: rowNumber, field: "attributeName", message: `Attribute '${attrName || slugStr}' not found in catalog.` });
      rowErrors.push(`Attribute '${attrName || slugStr}' not found.`);
    }

    if (matchedProduct && matchedAttr) {
      const mappingKey = `${matchedProduct.id}:${matchedAttr.id}`;
      if (seenMapping.has(mappingKey)) {
        duplicateWarnings.push(`Duplicate mapping for '${matchedProduct.title}' and '${matchedAttr.name}' on row ${rowNumber}.`);
      } else {
        seenMapping.add(mappingKey);
      }
    }

    const role = displayTypeStr
      ? normalizeDisplayTypeToGridAxis(displayTypeStr) === "COLUMN"
        ? "X_GRID"
        : normalizeDisplayTypeToGridAxis(displayTypeStr) === "ROW"
        ? "Y_GRID"
        : "DROPDOWN"
      : "DROPDOWN";

    previewRows.push({
      row: rowNumber,
      rowNumber,
      productSku: matchedProduct?.sku || matchedProduct?.productCode || prodKey,
      productTitle: matchedProduct?.title || "",
      productId: matchedProduct?.id || "",
      attributeName: matchedAttr?.name || attrName || slugStr,
      attributeId: matchedAttr?.id || "",
      role,
      displayType: role,
      required: parseBool(requiredStr),
      allowedValues: valuesStr || "ALL",
      isValid: rowErrors.length === 0,
      errors: rowErrors,
    });
  }

  const validRows = previewRows.filter((r) => r.isValid).length;

  return {
    totalRows: rawRows.length,
    validRows,
    invalidRows: rawRows.length - validRows,
    issues,
    duplicateWarnings,
    sampleRows: previewRows.slice(0, 10),
    rows: previewRows,
  };
}

export async function importCatalogAttributeMappingsSpreadsheet(filePathOrRows: string | any[]) {
  const rawRows: any[] = Array.isArray(filePathOrRows) ? filePathOrRows : readSpreadsheetRows(filePathOrRows);
  if (rawRows.length === 0) {
    throw new AppError("Uploaded spreadsheet is empty.", 400);
  }

  const allProducts = await prisma.product.findMany({
    where: { deletedAt: null },
    select: { id: true, sku: true, productCode: true, title: true, slug: true },
  });
  const productBySku = new Map(allProducts.filter((p) => p.sku).map((p) => [p.sku!.trim().toLowerCase(), p]));
  const productByCode = new Map(allProducts.filter((p) => p.productCode).map((p) => [p.productCode!.trim().toLowerCase(), p]));
  const productByTitle = new Map(allProducts.map((p) => [p.title.trim().toLowerCase(), p]));
  const productBySlug = new Map(allProducts.map((p) => [p.slug.trim().toLowerCase(), p]));
  const productById = new Map(allProducts.map((p) => [p.id, p]));

  const allAttributes = await prisma.attribute.findMany({
    include: { values: true },
  });
  const attributeByName = new Map(allAttributes.map((a) => [a.name.trim().toLowerCase(), a]));
  const attributeBySlug = new Map(allAttributes.map((a) => [a.slug.trim().toLowerCase(), a]));

  const summary = {
    created: 0,
    updated: 0,
    totalProcessed: rawRows.length,
  };

  const modifiedProductIds = new Set<string>();

  await prisma.$transaction(async (tx) => {
    for (const row of rawRows) {
      const prodKey = getProductAttrRowField(row, "productSku", "sku", "productCode", "code", "productTitle", "product", "title", "productId", "id");
      const attrName = getProductAttrRowField(row, "attributeName", "name", "attribute", "attribute_name");
      const slugStr = getProductAttrRowField(row, "slug", "attributeSlug");
      const displayTypeStr = getProductAttrRowField(row, "displayType", "role", "gridAxis", "type");
      const requiredStr = getProductAttrRowField(row, "required", "isRequired");
      const valuesStr = getProductAttrRowField(row, "allowedValues", "values", "options", "value");

      const matchedProduct = prodKey
        ? productBySku.get(prodKey.toLowerCase()) ||
          productByCode.get(prodKey.toLowerCase()) ||
          productByTitle.get(prodKey.toLowerCase()) ||
          productBySlug.get(prodKey.toLowerCase()) ||
          productById.get(prodKey)
        : null;

      const matchedAttr =
        (attrName ? attributeByName.get(attrName.toLowerCase()) : null) ||
        (slugStr ? attributeBySlug.get(slugStr.toLowerCase()) : null);

      if (!matchedProduct || !matchedAttr) continue;

      const gridAxis = normalizeDisplayTypeToGridAxis(displayTypeStr);
      const required = parseBool(requiredStr);

      // Parse allowed values
      const allowedValueIds: string[] = [];
      const trimmedValuesStr = (valuesStr || "").trim();

      if (!trimmedValuesStr || trimmedValuesStr.toUpperCase() === "ALL") {
        allowedValueIds.push(...matchedAttr.values.filter((v) => v.status === "ACTIVE").map((v) => v.id));
      } else {
        const rawValueItems = trimmedValuesStr.split(/[,;\n]/).map((s) => s.trim()).filter(Boolean);
        for (const rawItem of rawValueItems) {
          const priceMatch = rawItem.match(/^(.*?)\s*\(\+?([0-9.]+)\)$/);
          const valName = priceMatch ? priceMatch[1].trim() : rawItem;
          if (!valName) continue;

          let existingVal = matchedAttr.values.find(
            (v) =>
              v.value.toLowerCase() === valName.toLowerCase() ||
              v.slug.toLowerCase() === slugify(valName).toLowerCase()
          );

          if (!existingVal) {
            const valSlug = slugify(valName);
            let uniqueSlug = valSlug;
            let counter = 1;
            while (
              await tx.attributeValue.findFirst({ where: { attributeId: matchedAttr.id, slug: uniqueSlug } })
            ) {
              uniqueSlug = `${valSlug}-${counter++}`;
            }
            existingVal = await tx.attributeValue.create({
              data: {
                attributeId: matchedAttr.id,
                value: valName,
                slug: uniqueSlug,
                status: "ACTIVE",
              },
            });
            matchedAttr.values.push(existingVal);
          }
          allowedValueIds.push(existingVal.id);
        }
      }

      // Upsert ProductAttribute
      const existingMapping = await tx.productAttribute.findUnique({
        where: { productId_attributeId: { productId: matchedProduct.id, attributeId: matchedAttr.id } },
      });

      let productAttributeId: string;
      if (existingMapping) {
        await tx.productAttribute.update({
          where: { id: existingMapping.id },
          data: { required, gridAxis },
        });
        productAttributeId = existingMapping.id;
        summary.updated++;
      } else {
        const created = await tx.productAttribute.create({
          data: {
            productId: matchedProduct.id,
            attributeId: matchedAttr.id,
            required,
            gridAxis,
          },
        });
        productAttributeId = created.id;
        summary.created++;
      }

      // Sync allowed values
      await tx.productAttributeValueSelection.deleteMany({
        where: { productAttributeId },
      });

      if (allowedValueIds.length > 0) {
        const uniqueIds = Array.from(new Set(allowedValueIds));
        await tx.productAttributeValueSelection.createMany({
          data: uniqueIds.map((id) => ({
            productAttributeId,
            attributeValueId: id,
          })),
        });
      }

      modifiedProductIds.add(matchedProduct.id);
    }

    // Ensure hasVariants = true for products that have attributes mapped
    for (const pid of modifiedProductIds) {
      await tx.product.update({
        where: { id: pid },
        data: { hasVariants: true },
      });
    }
  });

  return summary;
}

// ─── Generate variants from attribute combinations ────────

export async function generateVariants(
  productId: string,
  data?: {
    packageIds?: string[];
    attributes?: { attributeId: string; attributeValueIds: string[] }[];
    allowUnmappedAttributeOverride?: boolean;
  }
) {
  const product = await getProduct(productId);

  const productInventoryTemplates = product.inventories
    .filter((inventory) => !inventory.variantId && !inventory.warehouseId)
    .map((inventory) => ({
      countryId: inventory.countryId,
      warehouseId: inventory.warehouseId,
      stock: inventory.stock,
      reservedStock: inventory.reservedStock,
      lowStockThreshold: inventory.lowStockThreshold,
      status: inventory.status,
    }));
  const inventoryTemplates = productInventoryTemplates.length
    ? productInventoryTemplates
    : [{ countryId: null, warehouseId: null, stock: 0, reservedStock: 0, lowStockThreshold: 10, status: "OUT_OF_STOCK" as const }];

  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  let attributeGroups = (data?.attributes ?? []).filter((group) => group.attributeValueIds?.length);
  const productAttributeMappings = await listProductAttributes(productId);
  const hasProductAttributeMappings = productAttributeMappings.length > 0;
  const allowUnmappedOverride =
    ALLOW_UNMAPPED_VARIANT_GENERATION_OVERRIDE && data?.allowUnmappedAttributeOverride === true;

  if (hasProductAttributeMappings && !allowUnmappedOverride) {
    if (!attributeGroups.length) {
      attributeGroups = productAttributeMappings.map((mapping) => ({
        attributeId: mapping.attributeId,
        attributeValueIds: mapping.allowedValues.length
          ? mapping.allowedValues.map((allowedValue) => allowedValue.attributeValueId)
          : mapping.attribute.values.map((v) => v.id),
      }));
    } else {
      const mappingOrder = new Map(productAttributeMappings.map((m, idx) => [m.attributeId, idx]));
      attributeGroups.sort((a, b) => {
        const orderA = mappingOrder.has(a.attributeId) ? mappingOrder.get(a.attributeId)! : 9999;
        const orderB = mappingOrder.has(b.attributeId) ? mappingOrder.get(b.attributeId)! : 9999;
        return orderA - orderB;
      });
    }

    const mappedAttributeById = new Map(productAttributeMappings.map((mapping) => [mapping.attributeId, mapping]));

    for (const group of attributeGroups) {
      const mapping = mappedAttributeById.get(group.attributeId);
      if (!mapping) {
        throw new AppError(
          "This product has attribute mappings. Add the attribute to Product Attributes before using it for variant generation.",
          400,
        );
      }

      const allowedValueIds = new Set(mapping.allowedValues.map((allowedValue) => allowedValue.attributeValueId));
      if (allowedValueIds.size > 0) {
        const unmappedValue = group.attributeValueIds.find((attributeValueId) => !allowedValueIds.has(attributeValueId));
        if (unmappedValue) {
          throw new AppError(
            `Value "${unmappedValue}" is not mapped for "${mapping.attribute.name}". Add it to Product Attributes before generating variants.`,
            400,
          );
        }
      }
    }
  }

  if (!attributeGroups.length) throw new AppError("Select attribute values before generating variants.", 400);

  if (!hasProductAttributeMappings) {
    await prisma.$transaction(
      attributeGroups.map((group) =>
        prisma.productAttribute.create({
          data: {
            productId,
            attributeId: group.attributeId,
            required: true,
            allowedValues: {
              create: group.attributeValueIds.map((attributeValueId) => ({
                attributeValueId,
              })),
            },
          },
        })
      )
    );
  }

  const attrValueSets = await Promise.all(
    attributeGroups.map(async (group) => {
      const values = await loadActiveAttributeValuesForGeneration(group.attributeValueIds);
      if (values.some((value) => value.attributeId !== group.attributeId)) {
        throw new AppError("Selected values do not match their attribute.", 400);
      }
      return values;
    })
  );

  const combos = cartesian(attrValueSets);
  const packageIds = Array.from(new Set(data?.packageIds ?? []));
  const packages = packageIds.length
    ? await Promise.all(packageIds.map((packageId) => ensureProductPackage(productId, packageId)))
    : [null];

  const targets = combos.flatMap((combo) =>
    packages.map((pkg) => ({
      combo,
      pkg,
      variantKey: buildVariantKey(combo.map((v) => v.id), pkg?.id),
      title: buildVariantTitle(combo, pkg?.title),
    }))
  );

  const existingVariants = await prisma.productVariant.findMany({
    where: { productId },
  });
  const existingVariantMap = new Map(existingVariants.map((v) => [v.variantKey, v]));

  const newTargets: typeof targets = [];
  const existingTargets: { target: typeof targets[0]; existing: typeof existingVariants[0] }[] = [];

  for (const t of targets) {
    const existing = existingVariantMap.get(t.variantKey);
    if (existing) {
      existingTargets.push({ target: t, existing });
    } else {
      newTargets.push(t);
    }
  }

  const toRestoreIds = existingTargets
    .filter((e) => e.existing.status === "INACTIVE" || e.existing.deletedAt !== null)
    .map((e) => e.existing.id);

  if (toRestoreIds.length > 0 || (existingTargets.length > 0 && inventoryTemplates.length > 0)) {
    const existingVariantIds = existingTargets.map((e) => e.existing.id);
    const existingInventories: { id: string; variantId: string | null; countryId: string | null }[] = [];
    if (existingVariantIds.length > 0) {
      for (let i = 0; i < existingVariantIds.length; i += 500) {
        const chunk = await prisma.inventory.findMany({
          where: { variantId: { in: existingVariantIds.slice(i, i + 500) } },
          select: { id: true, variantId: true, countryId: true },
        });
        existingInventories.push(...chunk);
      }
    }

    const existingInvSet = new Set(
      existingInventories.map((inv) => `${inv.variantId}:${inv.countryId ?? "__base__"}`)
    );

    const invToCreate: any[] = [];
    if (inventoryTemplates.length > 0) {
      for (const e of existingTargets) {
        for (const template of inventoryTemplates) {
          const key = `${e.existing.id}:${template.countryId ?? "__base__"}`;
          if (!existingInvSet.has(key)) {
            invToCreate.push({
              productId,
              variantId: e.existing.id,
              ...template,
            });
          }
        }
      }
    }

    if (toRestoreIds.length > 0 || invToCreate.length > 0) {
      await prisma.$transaction(async (tx) => {
        if (toRestoreIds.length > 0) {
          for (let i = 0; i < toRestoreIds.length; i += 500) {
            await tx.productVariant.updateMany({
              where: { id: { in: toRestoreIds.slice(i, i + 500) } },
              data: {
                status: "ACTIVE",
                deletedAt: null,
              },
            });
          }
        }

        if (invToCreate.length > 0) {
          for (let i = 0; i < invToCreate.length; i += 1000) {
            await tx.inventory.createMany({
              data: invToCreate.slice(i, i + 1000),
              skipDuplicates: true,
            });
          }
        }
      });

      // Update local existing state to ACTIVE
      for (const e of existingTargets) {
        if (toRestoreIds.includes(e.existing.id)) {
          e.existing.status = "ACTIVE" as const;
          e.existing.deletedAt = null;
        }
      }
    }
  }

  const createdVariantsList: any[] = [];
  const BATCH_SIZE = 50;

  for (let i = 0; i < newTargets.length; i += BATCH_SIZE) {
    const chunk = newTargets.slice(i, i + BATCH_SIZE);
    const batchResult = await prisma.$transaction(
      async (tx) => {
        const createdInBatch: any[] = [];
        const attrValuesToCreate: any[] = [];
        const inventoriesToCreate: any[] = [];

        for (const item of chunk) {
          const variant = await tx.productVariant.create({
            data: {
              productId,
              packageId: item.pkg?.id ?? null,
              title: item.title,
              variantKey: item.variantKey,
              sku: buildGeneratedVariantSku(product, item.variantKey),
              weight: product.packageWeight ?? null,
              length: product.packageLength ?? null,
              width: product.packageWidth ?? null,
              height: product.packageHeight ?? null,
              shippingClass: product.shippingClass ?? null,
              fragile: product.fragile,
              hazardous: product.hazardous,
              status: "ACTIVE",
            },
          });
          createdInBatch.push(variant);

          for (const v of item.combo) {
            attrValuesToCreate.push({
              variantId: variant.id,
              attributeId: v.attributeId,
              attributeValueId: v.id,
            });
          }

          for (const template of inventoryTemplates) {
            inventoriesToCreate.push({
              productId,
              variantId: variant.id,
              ...template,
            });
          }
        }

        if (attrValuesToCreate.length > 0) {
          await tx.productVariantAttributeValue.createMany({
            data: attrValuesToCreate,
            skipDuplicates: true,
          });
        }

        if (inventoriesToCreate.length > 0) {
          await tx.inventory.createMany({
            data: inventoriesToCreate,
            skipDuplicates: true,
          });
        }

        return createdInBatch;
      },
      { timeout: 30000 }
    );

    createdVariantsList.push(...batchResult);
  }

  const allVariants = [
    ...existingTargets.map((e) => e.existing),
    ...createdVariantsList,
  ];
  const activeVariantIds = allVariants
    .filter((v) => v.status === "ACTIVE")
    .map((v) => v.id);

  await syncVariantsStorefrontVisibility(activeVariantIds, productId);
  await syncVariantCountriesFromProduct(productId, allVariants.map((v) => v.id));

  const newCount = createdVariantsList.length;
  const restoredCount = toRestoreIds.length;
  const totalCount = targets.length;

  const result: any = allVariants;
  result.newCount = newCount;
  result.restoredCount = restoredCount;
  result.totalCount = totalCount;

  return result;
}

export async function createVariant(
  productId: string,
  data: {
    attributeValueIds: string[];
    packageId?: string | null;
    sku?: string | null;
    title?: string | null;
    moq?: number;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    shippingClass?: string | null;
    fragile?: boolean;
    hazardous?: boolean;
    status?: string;
  }
) {
  const product = await getProduct(productId);
  const pkg = await ensureProductPackage(productId, data.packageId);
  const values = await loadActiveAttributeValues(data.attributeValueIds);
  const productMappings = await listProductAttributes(productId);
  const attrOrderMap = new Map(productMappings.map((m, idx) => [m.attributeId, idx]));
  const sortedValues = [...values].sort((a, b) => {
    const orderA = attrOrderMap.has(a.attributeId) ? attrOrderMap.get(a.attributeId)! : 9999;
    const orderB = attrOrderMap.has(b.attributeId) ? attrOrderMap.get(b.attributeId)! : 9999;
    return orderA - orderB;
  });
  const variantKey = buildVariantKey(values.map((value) => value.id), data.packageId);
  const title = buildVariantTitle(sortedValues, pkg?.title, data.title);

  const existing = await prisma.productVariant.findFirst({ where: { productId, variantKey, deletedAt: null } });
  if (existing) throw new AppError("A variant with this configuration already exists.", 409);

  const createdVariant = await prisma.$transaction(async (tx) => {
    const variant = await tx.productVariant.create({
      data: {
        productId,
        packageId: data.packageId || null,
        sku: data.sku || `${product.sku || productId}-${variantKey.slice(0, 8)}`,
        title,
        variantKey,
        moq: data.moq ?? 1,
        weight: data.weight !== undefined ? data.weight : product.packageWeight ?? null,
        length: data.length !== undefined ? data.length : product.packageLength ?? null,
        width: data.width !== undefined ? data.width : product.packageWidth ?? null,
        height: data.height !== undefined ? data.height : product.packageHeight ?? null,
        shippingClass: data.shippingClass !== undefined ? data.shippingClass || null : product.shippingClass ?? null,
        fragile: data.fragile !== undefined ? data.fragile : product.fragile,
        hazardous: data.hazardous !== undefined ? data.hazardous : product.hazardous,
        status: (data.status as never) || "ACTIVE",
      },
    });

    await tx.productVariantAttributeValue.createMany({
      data: values.map((value) => ({
        variantId: variant.id,
        attributeId: value.attributeId,
        attributeValueId: value.id,
      })),
    });

    await tx.inventory.create({
      data: { productId, variantId: variant.id, stock: 0 },
    });

    return variant;
  });

  if (createdVariant.status === "ACTIVE") {
    await syncVariantStorefrontVisibility(createdVariant.id, productId);
  }
  await syncVariantCountriesFromProduct(productId, [createdVariant.id]);

  return getVariant(productId, createdVariant.id);
}

export async function updateVariant(
  productId: string,
  variantId: string,
  data: {
    attributeValueIds?: string[];
    packageId?: string | null;
    sku?: string | null;
    title?: string | null;
    moq?: number;
    weight?: number | null;
    length?: number | null;
    width?: number | null;
    height?: number | null;
    shippingClass?: string | null;
    fragile?: boolean;
    hazardous?: boolean;
    status?: string;
  }
) {
  const existingVariant = await getVariant(productId, variantId);
  const nextPackageId = data.packageId !== undefined ? data.packageId || null : existingVariant.packageId;
  const pkg = await ensureProductPackage(productId, nextPackageId);
  const values = data.attributeValueIds?.length
    ? await loadActiveAttributeValues(data.attributeValueIds)
    : existingVariant.attributeValues.map((value) => ({
        ...value.attributeValue,
        attributeId: value.attributeId,
      }));
  const productMappings = await listProductAttributes(productId);
  const attrOrderMap = new Map(productMappings.map((m, idx) => [m.attributeId, idx]));
  const sortedValues = [...values].sort((a, b) => {
    const orderA = attrOrderMap.has(a.attributeId) ? attrOrderMap.get(a.attributeId)! : 9999;
    const orderB = attrOrderMap.has(b.attributeId) ? attrOrderMap.get(b.attributeId)! : 9999;
    return orderA - orderB;
  });
  const nextVariantKey = buildVariantKey(values.map((value) => value.id), nextPackageId);
  const duplicate = await prisma.productVariant.findFirst({
    where: { productId, variantKey: nextVariantKey, NOT: { id: variantId }, deletedAt: null },
  });
  if (duplicate) throw new AppError("A variant with this configuration already exists.", 409);
  const updateData: Prisma.ProductVariantUncheckedUpdateInput = {
    ...(data.packageId !== undefined ? { packageId: data.packageId || null } : {}),
    ...(data.sku !== undefined ? { sku: data.sku } : {}),
    title: buildVariantTitle(sortedValues, pkg?.title, data.title !== undefined ? data.title : existingVariant.title),
    ...(nextVariantKey !== existingVariant.variantKey ? { variantKey: nextVariantKey } : {}),
    ...(data.moq !== undefined ? { moq: data.moq } : {}),
    ...(data.weight !== undefined ? { weight: data.weight } : {}),
    ...(data.length !== undefined ? { length: data.length } : {}),
    ...(data.width !== undefined ? { width: data.width } : {}),
    ...(data.height !== undefined ? { height: data.height } : {}),
    ...(data.shippingClass !== undefined ? { shippingClass: data.shippingClass } : {}),
    ...(data.fragile !== undefined ? { fragile: data.fragile } : {}),
    ...(data.hazardous !== undefined ? { hazardous: data.hazardous } : {}),
    ...(data.status !== undefined ? { status: data.status as never } : {}),
  };
  await prisma.$transaction(async (tx) => {
    await tx.productVariant.update({
      where: { id: variantId },
      data: updateData,
    });

    if (data.attributeValueIds?.length) {
      await tx.productVariantAttributeValue.deleteMany({ where: { variantId } });
      await tx.productVariantAttributeValue.createMany({
        data: values.map((value) => ({
          variantId,
          attributeId: value.attributeId,
          attributeValueId: value.id,
        })),
      });
    }
  });

  return getVariant(productId, variantId);
}

export async function bulkUpdateVariants(
  productId: string,
  updates: BulkVariantUpdate[],
  adjustedBy?: string
) {
  if (!Array.isArray(updates)) throw new AppError("Bulk variant update payload must include an updates array.", 400);
  const product = await prisma.product.findUnique({
    where: { id: productId, deletedAt: null },
    include: { defaultCountry: true },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const requestedVariantIds = Array.from(new Set(updates.map((update) => update.variantId).filter(Boolean)));
  const productVariants = await prisma.productVariant.findMany({
    where: { productId, id: { in: requestedVariantIds } },
    select: { id: true },
  });
  const productVariantIds = new Set(productVariants.map((variant) => variant.id));
  const foreignVariantIds = requestedVariantIds.filter((variantId) => !productVariantIds.has(variantId));
  if (foreignVariantIds.length) {
    throw new AppError(`One or more variants do not belong to this product: ${foreignVariantIds.join(", ")}`, 400);
  }

  const candidateCountryIds = new Set<string>();
  for (const update of updates) {
    if (update.price !== undefined && update.price !== null) {
      const countryId = update.countryId || product.defaultCountryId;
      if (countryId) candidateCountryIds.add(countryId);
    }
  }
  const countries = candidateCountryIds.size
    ? await prisma.country.findMany({
        where: { id: { in: Array.from(candidateCountryIds) } },
        select: { id: true, currencyId: true },
      })
    : [];
  const countryById = new Map(countries.map((country) => [country.id, country]));
  const existingPrices = await prisma.productPrice.findMany({
    where: {
      productId,
      variantId: { in: requestedVariantIds },
      ...(candidateCountryIds.size ? { countryId: { in: Array.from(candidateCountryIds) } } : {}),
    },
    select: { id: true, variantId: true, countryId: true, mrp: true, sellingPrice: true },
  });
  const priceByVariantCountry = new Map(existingPrices.map((price) => [`${price.variantId}:${price.countryId}`, price]));

  const results: BulkVariantResult[] = updates.map((update, index) => ({
    index,
    variantId: update.variantId,
    success: false,
  }));
  const validRows: {
    index: number;
    variantId: string;
    action?: "delete" | "archive" | "restore" | "active" | "inactive";
    stock?: number;
    countryId?: string;
    currencyId?: string;
    price?: NormalizedBulkPrice;
    existingPrice?: (typeof existingPrices)[number];
  }[] = [];

  for (const [index, update] of updates.entries()) {
    try {
      if (!update.variantId) throw new Error("variantId is required.");
      if (!productVariantIds.has(update.variantId)) throw new Error("Variant was not found for this product.");

      if (update.action) {
        if (!["delete", "archive", "restore", "active", "inactive"].includes(update.action)) throw new Error("Unsupported bulk variant action.");
        validRows.push({ index, variantId: update.variantId, action: update.action });
        continue;
      }

      const stock = parseOptionalStock(update.stock);
      const price = normalizeBulkPrice(update.price);
      if (stock === undefined && !price) throw new Error("Provide stock or price to update.");

      let countryId: string | undefined;
      let currencyId: string | undefined;
      let existingPrice: (typeof existingPrices)[number] | undefined;
      if (price) {
        countryId = update.countryId || product.defaultCountryId || undefined;
        if (!countryId) throw new Error("countryId is required because this product has no default country.");
        const country = countryById.get(countryId);
        if (!country) throw new Error(`Selected country (${countryId}) was not found.`);
        currencyId = country.currencyId;
        existingPrice = priceByVariantCountry.get(`${update.variantId}:${countryId}`);
        if (!existingPrice && price.mrp === undefined && price.sellingPrice === undefined) {
          throw new Error("MRP or selling price is required when creating a new variant price.");
        }
      }

      validRows.push({ index, variantId: update.variantId, stock, countryId, currencyId, price: price ?? undefined, existingPrice });
    } catch (error) {
      results[index].error = error instanceof Error ? error.message : "Invalid bulk update row.";
    }
  }

  await prisma.$transaction(async (tx) => {
    for (const row of validRows) {
      if (row.action) {
        await tx.productVariant.update({
          where: { id: row.variantId },
          data: { status: (row.action === "restore" || row.action === "active") ? "ACTIVE" : "INACTIVE" },
        });
        results[row.index].success = true;
        continue;
      }

      if (row.price && row.countryId && row.currencyId) {
        const createMrp = row.price.mrp ?? row.price.sellingPrice ?? Number(row.existingPrice?.mrp ?? 0);
        const createSellingPrice = row.price.sellingPrice ?? row.price.mrp ?? Number(row.existingPrice?.sellingPrice ?? 0);
        await tx.productPrice.upsert({
          where: {
            productId_variantId_countryId: {
              productId,
              variantId: row.variantId,
              countryId: row.countryId,
            },
          },
          update: {
            ...(row.price.mrp !== undefined ? { mrp: row.price.mrp } : {}),
            ...(row.price.sellingPrice !== undefined ? { sellingPrice: row.price.sellingPrice } : {}),
            ...(row.price.dealerPrice !== undefined ? { dealerPrice: row.price.dealerPrice } : {}),
            ...(row.price.distributorPrice !== undefined ? { distributorPrice: row.price.distributorPrice } : {}),
            ...(row.price.taxPercentage !== undefined ? { taxPercentage: row.price.taxPercentage } : {}),
          },
          create: {
            productId,
            variantId: row.variantId,
            countryId: row.countryId,
            currencyId: row.currencyId,
            mrp: createMrp,
            sellingPrice: createSellingPrice,
            ...(row.price.dealerPrice !== undefined ? { dealerPrice: row.price.dealerPrice } : {}),
            ...(row.price.distributorPrice !== undefined ? { distributorPrice: row.price.distributorPrice } : {}),
            ...(row.price.taxPercentage !== undefined ? { taxPercentage: row.price.taxPercentage } : {}),
            status: "ACTIVE",
          },
        });
      }

      if (row.stock !== undefined) {
        const updatedInventory = await setVariantStock(
          row.variantId,
          row.stock,
          { reason: "bulk_admin_edit", adjustedBy },
          tx
        );
        if (!updatedInventory) throw new AppError(`Inventory not found for variant ${row.variantId}.`, 400);
      }

      results[row.index].success = true;
    }
  }, {
    timeout: 60000 // 60s timeout for large bulk updates
  });

  return {
    results,
    summary: {
      total: updates.length,
      succeeded: results.filter((result) => result.success).length,
      failed: results.filter((result) => !result.success).length,
    },
  };
}

async function getVariantPriceImportCountry(productId: string, countryId: string) {
  await assertProductExists(productId);
  const country = await prisma.country.findUnique({
    where: { id: countryId },
    select: { id: true, name: true, code: true, currency: { select: { code: true, symbol: true } } },
  });
  if (!country) throw new AppError("Selected country was not found.", 404);
  return country;
}

export async function exportVariantCountryPricesSpreadsheet(productId: string, countryId: string) {
  const country = await getVariantPriceImportCountry(productId, countryId);
  const variants = await prisma.productVariant.findMany({
    where: { productId },
    orderBy: [{ title: "asc" }, { sku: "asc" }],
    include: {
      prices: {
        where: { countryId, deletedAt: null },
        take: 1,
        include: { currency: true },
      },
      inventories: {
        where: { countryId: null },
        take: 1,
      },
    },
  });

  return writeSpreadsheetBuffer(
    variants.map((variant) => {
      const price = variant.prices[0];
      const inventory = variant.inventories[0];
      return {
        variantId: variant.id,
        sku: variant.sku ?? "",
        variantTitle: variant.title,
        countryCode: country.code,
        currencyCode: price?.currency.code ?? country.currency.code,
        mrp: price ? Number(price.mrp) : "",
        sellingPrice: price ? Number(price.sellingPrice) : "",
        dealerPrice: price?.dealerPrice != null ? Number(price.dealerPrice) : "",
        doctorRetailerPrice: price?.distributorPrice != null ? Number(price.distributorPrice) : "",
        stock: inventory ? inventory.stock : "",
      };
    }),
    `${country.code} Variant Prices`,
    VARIANT_COUNTRY_PRICE_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

function readVariantPriceCell(row: Record<string, string>, key: string) {
  return row[key]?.trim() ?? "";
}

export async function importVariantCountryPricesSpreadsheet(
  productId: string,
  countryId: string,
  filePath: string,
  adjustedBy?: string,
) {
  const country = await getVariantPriceImportCountry(productId, countryId);
  const rows = readSpreadsheetRows(filePath);
  if (!rows.length) throw new AppError("Spreadsheet did not contain any variant price rows.", 400);

  const variantIds = Array.from(new Set(rows.map((row) => readVariantPriceCell(row, "variantId")).filter(Boolean)));
  const skus = Array.from(new Set(rows.map((row) => readVariantPriceCell(row, "sku")).filter(Boolean)));
  if (!variantIds.length && !skus.length) {
    throw new AppError("Spreadsheet must include variantId or sku values from the export file.", 400);
  }
  const variants = await prisma.productVariant.findMany({
    where: {
      productId,
      OR: [
        ...(variantIds.length ? [{ id: { in: variantIds } }] : []),
        ...(skus.length ? [{ sku: { in: skus } }] : []),
      ],
    },
    select: { id: true, sku: true },
  });
  const variantById = new Map(variants.map((variant) => [variant.id, variant]));
  const variantBySku = new Map(variants.filter((variant) => variant.sku).map((variant) => [variant.sku as string, variant]));

  const updates: BulkVariantUpdate[] = [];
  const issues: { row: number; message: string }[] = [];

  rows.forEach((row, index) => {
    const rowNumber = index + 2;
    const rowCountryCode = readVariantPriceCell(row, "countryCode").toUpperCase();
    if (rowCountryCode && rowCountryCode !== country.code) {
      issues.push({ row: rowNumber, message: `Row countryCode must be ${country.code} for the selected country.` });
      return;
    }

    const variantId = readVariantPriceCell(row, "variantId");
    const sku = readVariantPriceCell(row, "sku");
    const variant = (variantId && variantById.get(variantId)) || (sku && variantBySku.get(sku));
    if (!variant) {
      issues.push({ row: rowNumber, message: "Variant was not found for this product. Keep variantId or sku from the export file." });
      return;
    }

    const price = {
      mrp: readVariantPriceCell(row, "mrp"),
      sellingPrice: readVariantPriceCell(row, "sellingPrice"),
      dealerPrice: readVariantPriceCell(row, "dealerPrice"),
      distributorPrice: readVariantPriceCell(row, "doctorRetailerPrice"),
    };
    const stock = readVariantPriceCell(row, "stock");

    if (!price.mrp && !price.sellingPrice && !price.dealerPrice && !price.distributorPrice && !stock) {
      issues.push({ row: rowNumber, message: "Provide at least one price field or stock value." });
      return;
    }

    updates.push({
      variantId: variant.id,
      countryId,
      price,
      ...(stock ? { stock } : {}),
    });
  });

  if (issues.length) {
    throw new AppError(`Import validation failed: ${issues.slice(0, 5).map((issue) => `row ${issue.row}: ${issue.message}`).join("; ")}`, 400);
  }

  const result = await bulkUpdateVariants(productId, updates, adjustedBy);
  return {
    country: { id: country.id, code: country.code, name: country.name },
    ...result,
  };
}

export async function deleteVariant(productId: string, variantId: string) {
  await getVariant(productId, variantId);
  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      deletedAt: new Date(),
      status: "INACTIVE",
    },
  });
}

export async function restoreVariant(productId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
  });
  if (!variant) throw new AppError("Variant not found.", 404);
  if (!variant.deletedAt) throw new AppError("Variant is not soft-deleted.", 400);

  return prisma.productVariant.update({
    where: { id: variantId },
    data: {
      deletedAt: null,
      status: "ACTIVE",
    },
  });
}

export async function permanentDeleteVariant(productId: string, variantId: string) {
  await getVariant(productId, variantId);

  const [orderItemCount, quoteItemCount, adjustmentCount, inventorySum] = await Promise.all([
    prisma.orderItem.count({ where: { variantId } }),
    prisma.quoteItem.count({ where: { variantId } }),
    prisma.inventoryAdjustment.count({ where: { variantId } }),
    prisma.inventory.aggregate({
      where: { variantId },
      _sum: { stock: true, reservedStock: true },
    }),
  ]);

  let cartItemCount = 0;
  if ("cartItem" in prisma) {
    try {
      cartItemCount = await (prisma as any).cartItem.count({ where: { variantId } });
    } catch {
      cartItemCount = 0;
    }
  }

  const activeStock = Math.max(0, inventorySum._sum.stock || 0);
  const reservedStock = Math.max(0, inventorySum._sum.reservedStock || 0);

  if (orderItemCount > 0) {
    throw new AppError(
      `Cannot permanently delete variant: referenced by ${orderItemCount} historical order item(s) and legal tax invoice(s).`,
      400,
    );
  }

  if (quoteItemCount > 0) {
    throw new AppError(
      `Cannot permanently delete variant: referenced by ${quoteItemCount} quote item(s).`,
      400,
    );
  }

  if (cartItemCount > 0) {
    throw new AppError(
      "Cannot permanently delete this variant because it exists in active customer carts.",
      400,
    );
  }

  if (activeStock > 0 || reservedStock > 0) {
    throw new AppError(
      `Cannot permanently delete variant: active stock (${activeStock} units) or reserved stock (${reservedStock} units) exists. Zero or transfer inventory first.`,
      400,
    );
  }

  if (adjustmentCount > 0) {
    throw new AppError(
      `Cannot permanently delete variant: referenced by ${adjustmentCount} inventory adjustment audit log(s).`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.productVariantAttributeValue.deleteMany({ where: { variantId } });
    await tx.variantCountry.deleteMany({ where: { variantId } });
    await tx.variantPaymentMethod.deleteMany({ where: { variantId } });
    await tx.productPrice.deleteMany({ where: { variantId } });
    await tx.inventory.deleteMany({ where: { variantId } });
    return tx.productVariant.delete({ where: { id: variantId } });
  });
}

export async function cloneVariant(productId: string, variantId: string) {
  const source = await getVariant(productId, variantId);
  const cloneSuffix = Date.now().toString().slice(-6);

  const clone = await prisma.$transaction(async (tx) => {
    const createdClone = await tx.productVariant.create({
      data: {
        productId,
        packageId: source.packageId,
        sku: source.sku ? `${source.sku}-C${cloneSuffix}` : `clone-${cloneSuffix}`,
        title: `${source.title} Copy`,
        variantKey: source.variantKey,
        moq: source.moq,
        weight: source.weight,
        length: source.length,
        width: source.width,
        height: source.height,
        status: source.status,
      },
    });

    await tx.productVariantAttributeValue.createMany({
      data: source.attributeValues.map((value) => ({
        variantId: createdClone.id,
        attributeId: value.attributeId,
        attributeValueId: value.attributeValueId,
      })),
    });

    const baseInventory = source.inventories.find((inventory) => !inventory.countryId);
    await tx.inventory.create({
      data: { productId, variantId: createdClone.id, stock: baseInventory?.stock ?? 0, lowStockThreshold: baseInventory?.lowStockThreshold ?? 10 },
    });

    return createdClone;
  });

  return getVariant(productId, clone.id);
}

export async function getVariant(productId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
    include: {
      package: true,
      attributeValues: { include: { attribute: true, attributeValue: true } },
      prices: { where: { deletedAt: null }, include: { country: true, currency: true } },
      inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
    },
  });
  if (!variant) throw new AppError("Variant not found.", 404);
  return variant;
}

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])), [[]]);
}

export async function listTierPricing(productId: string) {
  await assertProductExists(productId);
  return prisma.tierPricing.findMany({
    where: { productId, deletedAt: null },
    include: { tier: true, country: true, variant: true },
    orderBy: [{ tier: { sortOrder: "asc" } }, { country: { sortOrder: "asc" } }, { createdAt: "desc" }],
  });
}

export async function createTierPricing(productId: string, data: PricingRuleInput) {
  await assertProductExists(productId);
  if (!data.tierId) throw new AppError("Tier is required.", 400);
  if (!data.countryId) throw new AppError("Country is required.", 400);
  const rule = normalizeExclusivePriceRule(data);
  await ensureVariantBelongsToProduct(productId, data.variantId);

  const [tier, country] = await Promise.all([
    assertTierUsable(data.tierId, { countryId: data.countryId }),
    prisma.country.findUnique({ where: { id: data.countryId } }),
  ]);
  if (!country) throw new AppError("Country not found.", 404);

  const existing = await prisma.tierPricing.findFirst({
    where: { productId, tierId: data.tierId, countryId: data.countryId, variantId: data.variantId || null },
  });
  if (existing) {
    if (existing.deletedAt) {
      return prisma.tierPricing.update({
        where: { id: existing.id },
        data: { ...rule, deletedAt: null },
        include: { tier: true, country: true, variant: true },
      });
    }
    throw new AppError("A tier pricing rule already exists for this combination.", 409);
  }

  return prisma.tierPricing.create({
    data: { productId, tierId: data.tierId, countryId: data.countryId, variantId: data.variantId || null, ...rule },
    include: { tier: true, country: true, variant: true },
  });
}

export async function updateTierPricing(productId: string, ruleId: string, data: PricingRuleInput) {
  await assertProductExists(productId);
  const existing = await prisma.tierPricing.findFirst({ where: { id: ruleId, productId } });
  if (!existing) throw new AppError("Tier pricing rule not found.", 404);

  const tierId = data.tierId ?? existing.tierId;
  const countryId = data.countryId ?? existing.countryId;
  const variantId = data.variantId === undefined ? existing.variantId : data.variantId || null;
  const rule = normalizeExclusivePriceRule({
    discountPercent: data.discountPercent ?? existing.discountPercent,
    fixedPrice: data.fixedPrice ?? existing.fixedPrice,
  });
  await ensureVariantBelongsToProduct(productId, variantId);
  await assertTierUsable(tierId, { countryId });

  const duplicate = await prisma.tierPricing.findFirst({
    where: { productId, tierId, countryId, variantId, deletedAt: null, NOT: { id: ruleId } },
  });
  if (duplicate) throw new AppError("A tier pricing rule already exists for this combination.", 409);

  return prisma.tierPricing.update({
    where: { id: ruleId },
    data: { tierId, countryId, variantId, ...rule },
    include: { tier: true, country: true, variant: true },
  });
}

export async function deleteTierPricing(productId: string, ruleId: string) {
  const existing = await prisma.tierPricing.findFirst({ where: { id: ruleId, productId } });
  if (!existing) throw new AppError("Tier pricing rule not found.", 404);
  if (existing.deletedAt) return;
  await prisma.tierPricing.update({ where: { id: ruleId }, data: { deletedAt: new Date() } });
}

export async function listMoqPricing(productId: string) {
  await assertProductExists(productId);
  return prisma.moqPricing.findMany({
    where: { productId, deletedAt: null },
    include: { country: true, variant: true },
    orderBy: [{ minQuantity: "asc" }, { country: { sortOrder: "asc" } }, { createdAt: "desc" }],
  });
}

export async function createMoqPricing(productId: string, data: PricingRuleInput) {
  await assertProductExists(productId);
  if (!data.countryId) throw new AppError("Country is required.", 400);
  const minQuantity = Number(data.minQuantity);
  if (!Number.isInteger(minQuantity) || minQuantity < 1) throw new AppError("Minimum quantity must be at least 1.", 400);

  let maxQty: number | null = null;
  if (data.maxQuantity !== undefined && data.maxQuantity !== null && data.maxQuantity !== "") {
    maxQty = Number(data.maxQuantity);
    if (!Number.isInteger(maxQty) || maxQty < 0) throw new AppError("Max quantity must be a non-negative integer.", 400);
  }

  const { discountPercent, fixedPrice } = normalizeExclusivePriceRule(data);
  await ensureVariantBelongsToProduct(productId, data.variantId);

  const country = await prisma.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw new AppError("Country not found.", 404);

  const existing = await prisma.moqPricing.findFirst({
    where: { productId, countryId: data.countryId, variantId: data.variantId || null, minQuantity },
  });
  if (existing) {
    if (existing.deletedAt) {
      return prisma.moqPricing.update({
        where: { id: existing.id },
        data: {
          minQuantity,
          maxQuantity: maxQty,
          discountPercent,
          fixedPrice,
          deletedAt: null,
        },
        include: { country: true, variant: true },
      });
    }
    throw new AppError("An MOQ pricing rule already exists for this combination.", 409);
  }

  return prisma.moqPricing.create({
    data: { 
      productId, 
      countryId: data.countryId, 
      variantId: data.variantId || null, 
      minQuantity, 
      maxQuantity: maxQty,
      discountPercent, 
      fixedPrice 
    },
    include: { country: true, variant: true },
  });
}

export async function updateMoqPricing(productId: string, ruleId: string, data: PricingRuleInput) {
  await assertProductExists(productId);
  const existing = await prisma.moqPricing.findFirst({ where: { id: ruleId, productId } });
  if (!existing) throw new AppError("MOQ pricing rule not found.", 404);

  const countryId = data.countryId ?? existing.countryId;
  const variantId = data.variantId === undefined ? existing.variantId : data.variantId || null;
  const minQuantity = data.minQuantity === undefined ? existing.minQuantity : Number(data.minQuantity);
  if (!Number.isInteger(minQuantity) || minQuantity < 1) throw new AppError("Minimum quantity must be at least 1.", 400);

  let maxQty: number | null = existing.maxQuantity;
  if (data.maxQuantity !== undefined) {
    if (data.maxQuantity === null || data.maxQuantity === "") {
      maxQty = null;
    } else {
      maxQty = Number(data.maxQuantity);
      if (!Number.isInteger(maxQty) || maxQty < 0) throw new AppError("Max quantity must be a non-negative integer.", 400);
    }
  }

  const { discountPercent, fixedPrice } = normalizeExclusivePriceRule({
    discountPercent: data.discountPercent ?? existing.discountPercent,
    fixedPrice: data.fixedPrice ?? existing.fixedPrice,
  });
  await ensureVariantBelongsToProduct(productId, variantId);

  const duplicate = await prisma.moqPricing.findFirst({
    where: { productId, countryId, variantId, minQuantity, deletedAt: null, NOT: { id: ruleId } },
  });
  if (duplicate) throw new AppError("An MOQ pricing rule already exists for this combination.", 409);

  return prisma.moqPricing.update({
    where: { id: ruleId },
    data: { countryId, variantId, minQuantity, maxQuantity: maxQty, discountPercent, fixedPrice },
    include: { country: true, variant: true },
  });
}

export async function deleteMoqPricing(productId: string, ruleId: string) {
  const existing = await prisma.moqPricing.findFirst({ where: { id: ruleId, productId } });
  if (!existing) throw new AppError("MOQ pricing rule not found.", 404);
  if (existing.deletedAt) return;
  await prisma.moqPricing.update({ where: { id: ruleId }, data: { deletedAt: new Date() } });
}

const PRODUCT_EXPORT_COLUMNS = [
  { key: "title", header: "title" },
  { key: "sku", header: "sku" },
  { key: "productCode", header: "productCode" },
  { key: "imageUrl", header: "imageUrl" },
  { key: "categoryName", header: "categoryName" },
  { key: "brand", header: "brand" },
  { key: "status", header: "status" },
  { key: "stock", header: "stock" },
  { key: "lowStock", header: "lowStock" },
  { key: "price", header: "price" },
  { key: "mrp", header: "mrp" },
  { key: "dealerPrice", header: "dealerPrice" },
  { key: "doctorPrice", header: "doctorPrice" },
  { key: "weight", header: "weight" },
  { key: "dimensions", header: "dimensions" },
  { key: "fragile", header: "fragile" },
  { key: "hazardous", header: "hazardous" },
  { key: "shippingClass", header: "shippingClass" },
  { key: "countryCodes", header: "countryCodes" },
  { key: "sortOrder", header: "sortOrder" },
  { key: "isFeatured", header: "isFeatured" },
  { key: "hasVariants", header: "hasVariants" },
  { key: "shortDescription", header: "shortDescription" },
  { key: "description", header: "description" },
  { key: "seoTitle", header: "seoTitle" },
  { key: "seoDescription", header: "seoDescription" },
  { key: "seoKeywords", header: "seoKeywords" },
] as const;

function uniqueExcelSlug(title: string, suffix: string) {
  const base = slugify(title);
  return base ? `${base}-${suffix}` : suffix;
}

async function getProductSpreadsheetPreview(rows: Record<string, string>[]) {
  const parsedRows = rows.map(parseProductImportRow);
  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seenSku = new Map<string, number>();
  const seenProductCode = new Map<string, number>();
  const seenSlug = new Map<string, number>();
  const productCodes = new Set<string>();
  const skus = new Set<string>();
  const categorySlugs = new Set<string>();
  const countryCodes = new Set<string>();

  for (const [index, row] of parsedRows.entries()) {
    const rowNumber = index + 2;
    if (!row.title) issues.push({ row: rowNumber, field: "title", message: "Title is required." });
    if (!row.categorySlug) issues.push({ row: rowNumber, field: "categoryName", message: "Category name is required." });
    if (row.status && !["DRAFT", "ACTIVE", "INACTIVE", "ARCHIVED"].includes(row.status)) {
      issues.push({ row: rowNumber, field: "status", message: "Status must be DRAFT, ACTIVE, INACTIVE, or ARCHIVED." });
    }

    if (row.sku) {
      const seen = seenSku.get(row.sku);
      if (seen) {
        const message = `Duplicate SKU '${row.sku}' found on rows ${seen} and ${rowNumber}.`;
        issues.push({ row: rowNumber, field: "sku", message });
        duplicateWarnings.push(message);
      } else {
        seenSku.set(row.sku, rowNumber);
      }
      skus.add(row.sku);
    }

    if (row.productCode) {
      const seen = seenProductCode.get(row.productCode);
      if (seen) {
        const message = `Duplicate product code '${row.productCode}' found on rows ${seen} and ${rowNumber}.`;
        issues.push({ row: rowNumber, field: "productCode", message });
        duplicateWarnings.push(message);
      } else {
        seenProductCode.set(row.productCode, rowNumber);
      }
      productCodes.add(row.productCode);
    }

    if (row.title) {
      const generatedSlug = slugify(row.title);
      const seen = seenSlug.get(generatedSlug);
      if (seen) {
        const message = `Duplicate generated slug '${generatedSlug}' would be produced on rows ${seen} and ${rowNumber}.`;
        duplicateWarnings.push(message);
      } else {
        seenSlug.set(generatedSlug, rowNumber);
      }
    }

    if (row.categorySlug) categorySlugs.add(row.categorySlug);
    row.countryCodes?.forEach((code) => {
      const u = code.trim().toUpperCase();
      if (u === "ALL" || u === "GLOBAL" || u === "*" || u === "ALL COUNTRIES") return;
      countryCodes.add(code);
    });
  }

  const rawCategoryInputs = Array.from(categorySlugs);
  const [categories, countries, existingProducts] = await Promise.all([
    prisma.category.findMany({
      where: {
        deletedAt: null,
        OR: [
          { slug: { in: rawCategoryInputs, mode: "insensitive" } },
          { name: { in: rawCategoryInputs, mode: "insensitive" } },
        ],
      },
      select: { id: true, name: true, slug: true, status: true },
    }),
    prisma.country.findMany({ where: { code: { in: Array.from(countryCodes) } }, select: { code: true, status: true } }),
    prisma.product.findMany({
      where: {
        deletedAt: null,
        OR: [
          ...(skus.size ? [{ sku: { in: Array.from(skus) } }] : []),
          ...(productCodes.size ? [{ productCode: { in: Array.from(productCodes) } }] : []),
        ],
      },
      select: { id: true, sku: true, productCode: true, title: true },
    }),
  ]);

  const categoryBySlug = new Map<string, typeof categories[0]>();
  for (const category of categories) {
    categoryBySlug.set(category.slug.toLowerCase(), category);
    categoryBySlug.set(category.name.toLowerCase(), category);
  }
  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const productBySku = new Map(existingProducts.filter((product) => product.sku).map((product) => [product.sku as string, product]));
  const productByCode = new Map(existingProducts.filter((product) => product.productCode).map((product) => [product.productCode as string, product]));

  for (const [index, row] of parsedRows.entries()) {
    const rowNumber = index + 2;
    const categoryKey = row.categorySlug?.toLowerCase().trim();
    const category = categoryKey ? categoryBySlug.get(categoryKey) : null;
    if (!category) {
      issues.push({ row: rowNumber, field: "categoryName", message: `Category '${row.categorySlug || ""}' was not found.` });
    } else if (category.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "categoryName", message: `Category '${row.categorySlug}' is inactive.` });
    }

    for (const code of row.countryCodes ?? []) {
      const u = code.trim().toUpperCase();
      if (u === "ALL" || u === "GLOBAL" || u === "*" || u === "ALL COUNTRIES") continue;
      const country = countryByCode.get(code);
      if (!country) {
        issues.push({ row: rowNumber, field: "countryCodes", message: `Country '${code}' was not found.` });
      } else if (country.status !== "ACTIVE") {
        issues.push({ row: rowNumber, field: "countryCodes", message: `Country '${code}' is inactive.` });
      }
    }

    if (row.sku && productBySku.has(row.sku)) {
      const existing = productBySku.get(row.sku)!;
      if (row.productCode && existing.productCode && existing.productCode !== row.productCode) {
        issues.push({ row: rowNumber, field: "sku", message: `SKU '${row.sku}' already belongs to product '${existing.title}'.` });
      }
    }
    if (row.productCode && productByCode.has(row.productCode)) {
      const existing = productByCode.get(row.productCode)!;
      if (row.sku && existing.sku && existing.sku !== row.sku) {
        issues.push({ row: rowNumber, field: "productCode", message: `Product code '${row.productCode}' already belongs to product '${existing.title}'.` });
      }
    }
  }

  return {
    rows: parsedRows,
    issues,
    duplicateWarnings,
    categoryBySlug,
    countryByCode,
    existingProducts,
  };
}

export async function previewProductImport(filePath: string) {
  let rows: any[] = [];
  let rawTierRows: any[] = [];
  let rawMoqRows: any[] = [];

  try {
    const allSheets = readAllSpreadsheetSheets(filePath);
    const sheetNames = Object.keys(allSheets);
    const prodSheetName = sheetNames.find((s) => /product/i.test(s)) || sheetNames[0] || "Products";
    rows = allSheets[prodSheetName] || [];

    const tierSheetName = sheetNames.find((s) => /tier/i.test(s));
    rawTierRows = tierSheetName ? allSheets[tierSheetName] || [] : [];

    const moqSheetName = sheetNames.find((s) => /moq/i.test(s));
    rawMoqRows = moqSheetName ? allSheets[moqSheetName] || [] : [];
  } catch {
    rows = readSpreadsheetRows(filePath);
  }

  const preview = await getProductSpreadsheetPreview(rows);
  const sampleRows = preview.rows.slice(0, 10).map((row, index) => {
    const categoryKey = row.categorySlug?.toLowerCase().trim();
    const matchedCategory = categoryKey ? preview.categoryBySlug.get(categoryKey) : null;
    return {
      row: index + 2,
      ...row,
      categorySlug: matchedCategory ? matchedCategory.slug : (row.categorySlug || ""),
      categoryName: matchedCategory ? matchedCategory.name : (row.categorySlug || ""),
    };
  });
  const previewRows = preview.rows.map((row, index) => {
    const rowNumber = index + 2;
    const rowIssues = preview.issues.filter((iss) => iss.row === rowNumber);
    const categoryKey = row.categorySlug?.toLowerCase().trim();
    const matchedCategory = categoryKey ? preview.categoryBySlug.get(categoryKey) : null;
    return {
      ...row,
      categorySlug: matchedCategory ? matchedCategory.slug : (row.categorySlug || ""),
      categoryName: matchedCategory ? matchedCategory.name : (row.categorySlug || ""),
      rowNumber,
      isValid: rowIssues.length === 0,
      errors: rowIssues.map((iss) => (iss.field ? `[${iss.field}] ${iss.message}` : iss.message)),
      countryCodes: Array.isArray(row.countryCodes) ? row.countryCodes.join(", ") : (row.countryCodes || ""),
    };
  });

  // Parse Tier Pricing from Sheet 2 (if provided)
  const allTiers = await prisma.tier.findMany({ where: { deletedAt: null } });
  const tierByName = new Map(allTiers.map((t) => [t.name.trim().toLowerCase(), t]));
  const parsedTierPricing: any[] = [];
  for (const [tIdx, tRow] of rawTierRows.entries()) {
    const pSku = getVariantImportField(tRow, "Product SKU", "productSku", "SKU", "sku");
    const vSku = getVariantImportField(tRow, "Variant SKU", "variantSku");
    const rawTier = getVariantImportField(tRow, "Tier Name", "tierName", "Tier", "tier");
    const rawCountry = getVariantImportField(tRow, "Country", "country", "Country Code", "countryCode");
    const rawMode = getVariantImportField(tRow, "Mode", "mode", "Type", "type") || "PERCENTAGE";
    const rawVal = getVariantImportField(tRow, "Discount / Fixed Price", "value", "Discount", "discount", "Fixed Price", "fixedPrice", "discountPercent");

    if (!pSku && !rawTier && !rawCountry && !rawVal) continue;

    const tErrors: string[] = [];
    if (!pSku) tErrors.push("Product SKU is required.");

    const matchedTier = rawTier ? tierByName.get(rawTier.toLowerCase()) : null;
    if (!rawTier) tErrors.push("Tier Name is required.");
    else if (!matchedTier) tErrors.push(`Tier "${rawTier}" not found in system.`);

    const numVal = parseFloat(rawVal || "0");
    if (isNaN(numVal) || numVal < 0) tErrors.push("Discount/Price value must be non-negative.");

    parsedTierPricing.push({
      rowNumber: tIdx + 2,
      productSku: pSku || "",
      variantSku: !vSku || vSku.toUpperCase() === "ALL" ? "ALL" : vSku,
      tierName: matchedTier?.name || rawTier || "",
      tierId: matchedTier?.id || "",
      country: rawCountry || "ALL",
      mode: rawMode.toUpperCase().includes("FIXED") ? "FIXED_PRICE" : "PERCENTAGE",
      value: isNaN(numVal) ? 0 : numVal,
      isValid: tErrors.length === 0,
      errors: tErrors,
    });
  }

  // Parse MOQ Pricing from Sheet 3 (if provided)
  const parsedMoqPricing: any[] = [];
  for (const [mIdx, mRow] of rawMoqRows.entries()) {
    const pSku = getVariantImportField(mRow, "Product SKU", "productSku", "SKU", "sku");
    const vSku = getVariantImportField(mRow, "Variant SKU", "variantSku");
    const rawCountry = getVariantImportField(mRow, "Country", "country", "Country Code", "countryCode");
    const rawMinQty = getVariantImportField(mRow, "Min Qty", "minQty", "Min Quantity", "minQuantity");
    const rawMaxQty = getVariantImportField(mRow, "Max Qty", "maxQty", "Max Quantity", "maxQuantity");
    const rawMode = getVariantImportField(mRow, "Mode", "mode", "Type", "type") || "PERCENTAGE";
    const rawVal = getVariantImportField(mRow, "Discount / Fixed Price", "value", "Discount", "discount", "Fixed Price", "fixedPrice", "discountPercent");

    if (!pSku && !rawCountry && !rawMinQty && !rawVal) continue;

    const mErrors: string[] = [];
    if (!pSku) mErrors.push("Product SKU is required.");

    const minQty = parseInt(rawMinQty || "1");
    if (isNaN(minQty) || minQty < 1) mErrors.push("Min Qty must be at least 1.");

    const maxQty = rawMaxQty ? parseInt(rawMaxQty) : null;
    if (maxQty !== null && (isNaN(maxQty) || maxQty < minQty)) mErrors.push("Max Qty must be >= Min Qty.");

    const numVal = parseFloat(rawVal || "0");
    if (isNaN(numVal) || numVal < 0) mErrors.push("Discount/Price value must be non-negative.");

    parsedMoqPricing.push({
      rowNumber: mIdx + 2,
      productSku: pSku || "",
      variantSku: !vSku || vSku.toUpperCase() === "ALL" ? "ALL" : vSku,
      country: rawCountry || "ALL",
      minQuantity: isNaN(minQty) ? 1 : minQty,
      maxQuantity: maxQty,
      mode: rawMode.toUpperCase().includes("FIXED") ? "FIXED_PRICE" : "PERCENTAGE",
      value: isNaN(numVal) ? 0 : numVal,
      isValid: mErrors.length === 0,
      errors: mErrors,
    });
  }

  return {
    totalRows: preview.rows.length,
    validRows: Math.max(0, preview.rows.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows,
    rows: previewRows,
    tierPricing: parsedTierPricing,
    moqPricing: parsedMoqPricing,
  } as any;
}

function buildProductExportRow(product: any) {
  const basePrice = (product.prices || []).find((p: any) => !p.variantId && p.status === "ACTIVE") || (product.prices || [])[0];
  const baseInv = (product.inventories || []).find((inv: any) => !inv.variantId && !inv.warehouseId && !inv.countryId) || (product.inventories || [])[0];
  const dims = [product.packageLength, product.packageWidth, product.packageHeight].filter(Boolean).join(" x ");

  return {
    title: product.title,
    sku: product.sku ?? "",
    productCode: product.productCode ?? "",
    imageUrl: (product.media || []).map((m: any) => m.url).join(", "),
    categoryName: product.category?.name || product.category?.slug || "",
    brand: product.brand ?? "",
    status: product.status,
    stock: baseInv?.stock ?? "",
    lowStock: baseInv?.lowStockThreshold ?? "",
    price: basePrice?.sellingPrice ? Number(basePrice.sellingPrice) : "",
    mrp: basePrice?.mrp ? Number(basePrice.mrp) : "",
    dealerPrice: basePrice?.dealerPrice ? Number(basePrice.dealerPrice) : "",
    doctorPrice: basePrice?.distributorPrice ? Number(basePrice.distributorPrice) : "",
    weight: product.packageWeight ? Number(product.packageWeight) : "",
    dimensions: dims || "",
    fragile: product.fragile ? "TRUE" : "FALSE",
    hazardous: product.hazardous ? "TRUE" : "FALSE",
    shippingClass: product.shippingClass ?? "",
    countryCodes: (product.countries || []).map((country: any) => country.country?.code || country.code || "").filter(Boolean).join(", "),
    sortOrder: product.sortOrder,
    isFeatured: product.isFeatured ? "TRUE" : "FALSE",
    hasVariants: product.hasVariants ? "TRUE" : "FALSE",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    seoKeywords: product.seoKeywords ?? "",
  };
}

export async function exportProductsSpreadsheet(query: ProductListQuery) {
  const where = buildProductWhere(query);
  const products = await prisma.product.findMany({
    where,
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: { select: { slug: true, name: true } },
      countries: { where: { enabled: true }, include: { country: { select: { code: true } } } },
      media: { orderBy: { sortOrder: "asc" }, select: { url: true } },
      inventories: { select: { stock: true, reservedStock: true, lowStockThreshold: true, variantId: true, warehouseId: true, countryId: true } },
      prices: { where: { status: "ACTIVE", deletedAt: null }, select: { sellingPrice: true, mrp: true, dealerPrice: true, distributorPrice: true, variantId: true, status: true } },
    },
  });

  return writeSpreadsheetBuffer(
    products.map(buildProductExportRow),
    "Products",
    PRODUCT_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export async function generateSampleProductsTemplate() {
  const existingCategories = await prisma.category.findMany({
    where: { deletedAt: null, status: "ACTIVE" },
    select: { name: true, slug: true },
    take: 2,
  });

  const cat1 = existingCategories[0]?.name || existingCategories[0]?.slug || "Brackets";
  const cat2 = existingCategories[1]?.name || existingCategories[1]?.slug || "Wires";

  const sampleRows = [
    {
      title: "Metal Bracket MBT .022",
      sku: "PRD-MB-001",
      productCode: "BRK-MBT-22",
      imageUrl: "https://images.unsplash.com/photo-1588776814546-1ffcf47267a5?auto=format&fit=crop&w=800&q=80",
      categoryName: cat1,
      brand: "Modern Orthodontics",
      status: "ACTIVE",
      stock: 150,
      lowStock: 15,
      price: 80.00,
      mrp: 100.00,
      dealerPrice: 65.00,
      doctorPrice: 70.00,
      weight: 0.5,
      dimensions: "30 x 20 x 10",
      fragile: "TRUE",
      hazardous: "FALSE",
      shippingClass: "Standard",
      countryCodes: "ALL",
      sortOrder: 1,
      isFeatured: "true",
      hasVariants: "true",
      shortDescription: "Precision engineered metal bracket system.",
      description: "High performance orthodontic metal bracket with MBT prescription and .022 slot.",
      seoTitle: "Metal Bracket MBT .022 - Modern Orthodontics",
      seoDescription: "Shop high quality metal brackets with superior torque control.",
      seoKeywords: "bracket, mbt, orthodontics, metal bracket",
    },
    {
      title: "NiTi Archwire Upper .016",
      sku: "PRD-NW-002",
      productCode: "WIR-NT-16U",
      imageUrl: "https://images.unsplash.com/photo-1629909613654-28e377c37b09?auto=format&fit=crop&w=800&q=80",
      categoryName: cat2,
      brand: "Modern Orthodontics",
      status: "ACTIVE",
      stock: 300,
      lowStock: 25,
      price: 18.00,
      mrp: 25.00,
      dealerPrice: 14.00,
      doctorPrice: 16.00,
      weight: 0.15,
      dimensions: "15 x 10 x 2",
      fragile: "FALSE",
      hazardous: "FALSE",
      shippingClass: "Standard",
      countryCodes: "IN, US",
      sortOrder: 2,
      isFeatured: "false",
      hasVariants: "false",
      shortDescription: "Super elastic thermal active NiTi archwire.",
      description: "Delivers continuous gentle force for efficient tooth alignment.",
      seoTitle: "NiTi Archwire Upper .016 - Modern Orthodontics",
      seoDescription: "High elastic memory orthodontic NiTi archwire.",
      seoKeywords: "archwire, niti, upper archwire, wire",
    },
  ];

  const allTiers = await prisma.tier.findMany({ where: { deletedAt: null, status: "ACTIVE" } });
  const allCountries = await prisma.country.findMany({ where: { status: "ACTIVE" } });

  const tierCols = [
    { key: "productSku", header: "Product SKU" },
    { key: "variantSku", header: "Variant SKU" },
    { key: "tierName", header: "Tier Name" },
    { key: "country", header: "Country" },
    { key: "mode", header: "Mode" },
    { key: "value", header: "Discount / Fixed Price" },
  ];
  const sampleTiers: Record<string, unknown>[] = [
    {
      productSku: "PRD-MB-001",
      variantSku: "ALL",
      tierName: allTiers[0]?.name || "Gold",
      country: "ALL",
      mode: "PERCENTAGE",
      value: 10,
    },
    {
      productSku: "PRD-NW-002",
      variantSku: "ALL",
      tierName: allTiers[1]?.name || allTiers[0]?.name || "Platinum",
      country: allCountries[0]?.code || "IN",
      mode: "PERCENTAGE",
      value: 15,
    },
  ];

  const moqCols = [
    { key: "productSku", header: "Product SKU" },
    { key: "variantSku", header: "Variant SKU" },
    { key: "country", header: "Country" },
    { key: "minQty", header: "Min Qty" },
    { key: "maxQty", header: "Max Qty" },
    { key: "mode", header: "Mode" },
    { key: "value", header: "Discount / Fixed Price" },
  ];
  const sampleMoq: Record<string, unknown>[] = [
    {
      productSku: "PRD-MB-001",
      variantSku: "ALL",
      country: "ALL",
      minQty: 10,
      maxQty: 49,
      mode: "PERCENTAGE",
      value: 5,
    },
    {
      productSku: "PRD-MB-001",
      variantSku: "ALL",
      country: "ALL",
      minQty: 50,
      maxQty: null,
      mode: "PERCENTAGE",
      value: 10,
    },
    {
      productSku: "PRD-NW-002",
      variantSku: "ALL",
      country: "ALL",
      minQty: 25,
      maxQty: null,
      mode: "PERCENTAGE",
      value: 12,
    },
  ];

  return writeMultiSheetSpreadsheetBuffer([
    {
      name: "Products",
      rows: sampleRows,
      columns: PRODUCT_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
    },
    {
      name: "Tier_Pricing",
      rows: sampleTiers,
      columns: tierCols,
    },
    {
      name: "MOQ_Pricing",
      rows: sampleMoq,
      columns: moqCols,
    },
  ]);
}

async function syncProductImages(tx: Prisma.TransactionClient, productId: string, imageUrls: string[]) {
  if (!imageUrls.length) return;
  const existingMedia = await tx.productMedia.findMany({
    where: { productId, type: "IMAGE" },
    select: { id: true, url: true },
    orderBy: { sortOrder: "asc" },
  });
  const existingUrlSet = new Set(existingMedia.map((m) => m.url));
  const newUrls = imageUrls.filter((url) => !existingUrlSet.has(url));
  if (newUrls.length > 0) {
    const startOrder = existingMedia.length;
    await tx.productMedia.createMany({
      data: newUrls.map((url, idx) => ({
        productId,
        url,
        type: "IMAGE" as const,
        sortOrder: startOrder + idx,
        storageProvider: "LOCAL" as const,
      })),
    });
  }
}

async function syncProductCountries(tx: Prisma.TransactionClient, productId: string, countryCodes: string[]) {
  if (!countryCodes.length) return;
  const isAll = countryCodes.some((c) => {
    const u = c.trim().toUpperCase();
    return u === "ALL" || u === "GLOBAL" || u === "*" || u === "ALL COUNTRIES";
  });
  const countries = isAll
    ? await tx.country.findMany({ where: { status: "ACTIVE" }, select: { id: true, code: true } })
    : await tx.country.findMany({ where: { code: { in: countryCodes } }, select: { id: true, code: true } });
  if (!isAll && countries.length !== countryCodes.length) throw new AppError("One or more countries were not found.", 400);
  await Promise.all(
    countries.map((country) =>
      tx.productCountry.upsert({
        where: { productId_countryId: { productId, countryId: country.id } },
        update: { enabled: true },
        create: { productId, countryId: country.id, enabled: true },
      }),
    ),
  );
}

export async function importProductsSpreadsheet(filePathOrRows: string | any) {
  let rawRows: any[] = [];
  let tierPricingList: any[] = [];
  let moqPricingList: any[] = [];

  if (typeof filePathOrRows === "string") {
    try {
      const allSheets = readAllSpreadsheetSheets(filePathOrRows);
      const sheetNames = Object.keys(allSheets);
      const prodSheetName = sheetNames.find((s) => /product/i.test(s)) || sheetNames[0] || "Products";
      rawRows = allSheets[prodSheetName] || [];

      const tierSheetName = sheetNames.find((s) => /tier/i.test(s));
      tierPricingList = tierSheetName ? allSheets[tierSheetName] || [] : [];

      const moqSheetName = sheetNames.find((s) => /moq/i.test(s));
      moqPricingList = moqSheetName ? allSheets[moqSheetName] || [] : [];
    } catch {
      rawRows = readSpreadsheetRows(filePathOrRows);
    }
  } else if (Array.isArray(filePathOrRows)) {
    rawRows = filePathOrRows;
  } else if (filePathOrRows && typeof filePathOrRows === "object") {
    rawRows = Array.isArray(filePathOrRows.rows) ? filePathOrRows.rows : [];
    tierPricingList = Array.isArray(filePathOrRows.tierPricing) ? filePathOrRows.tierPricing : [];
    moqPricingList = Array.isArray(filePathOrRows.moqPricing) ? filePathOrRows.moqPricing : [];
  }

  if (!rawRows.length) throw new AppError("No product rows found.", 400);

  const preview = await getProductSpreadsheetPreview(rawRows);
  if (typeof filePathOrRows === "string" && preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const allActiveCountries = await prisma.country.findMany({ where: { status: "ACTIVE" } });
  const defaultCountry = allActiveCountries.find((c) => c.isDefault) || allActiveCountries[0];
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });

  const parsedRows = preview.rows;
  const summary = { created: 0, updated: 0 };
  const suffix = Date.now().toString().slice(-6);

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of parsedRows.entries()) {
      const categoryKey = row.categorySlug?.toLowerCase().trim();
      const category = categoryKey ? preview.categoryBySlug.get(categoryKey) : null;
      if (!category) throw new AppError(`Category '${row.categorySlug || ""}' not found during import.`, 400);

      const normalizedSku = row.sku?.trim() || null;
      const normalizedProductCode = row.productCode?.trim() || null;
      const existing = normalizedProductCode
        ? await tx.product.findFirst({ where: { productCode: normalizedProductCode, deletedAt: null } })
        : normalizedSku
          ? await tx.product.findFirst({ where: { sku: normalizedSku, deletedAt: null } })
          : null;

      const baseSlug = uniqueExcelSlug(row.title, `${suffix}-${index + 1}`);
      const slug = existing ? existing.slug : baseSlug;

      const shippingData: Record<string, any> = {};
      if (row.weight !== undefined && row.weight !== null) shippingData.packageWeight = row.weight;
      if (row.length !== undefined && row.length !== null) shippingData.packageLength = row.length;
      if (row.width !== undefined && row.width !== null) shippingData.packageWidth = row.width;
      if (row.height !== undefined && row.height !== null) shippingData.packageHeight = row.height;
      if (row.shippingClass !== undefined && row.shippingClass !== null) shippingData.shippingClass = row.shippingClass;
      if (row.fragile !== undefined && row.fragile !== null) shippingData.fragile = row.fragile;
      if (row.hazardous !== undefined && row.hazardous !== null) shippingData.hazardous = row.hazardous;

      let targetId: string;

      if (existing) {
        await tx.product.update({
          where: { id: existing.id },
          data: {
            title: row.title.trim(),
            slug,
            shortDescription: row.shortDescription || null,
            description: row.description || null,
            categoryId: category.id,
            sku: normalizedSku,
            productCode: normalizedProductCode,
            brand: row.brand || existing.brand,
            status: (row.status as never) || existing.status,
            sortOrder: row.sortOrder ?? existing.sortOrder,
            isFeatured: row.isFeatured ?? existing.isFeatured,
            hasVariants: row.hasVariants ?? existing.hasVariants,
            seoTitle: row.seoTitle || null,
            seoDescription: row.seoDescription || null,
            seoKeywords: row.seoKeywords || null,
            ...shippingData,
          },
        });
        if (row.countryCodes?.length) await syncProductCountries(tx, existing.id, row.countryCodes);
        if (row.imageUrls?.length) await syncProductImages(tx, existing.id, row.imageUrls);
        targetId = existing.id;
        summary.updated += 1;
      } else {
        const product = await tx.product.create({
          data: {
            title: row.title.trim(),
            slug,
            shortDescription: row.shortDescription || null,
            description: row.description || null,
            categoryId: category.id,
            sku: normalizedSku,
            productCode: normalizedProductCode || undefined,
            brand: row.brand || "Modern Orthodontics",
            status: (row.status as never) || "DRAFT",
            sortOrder: row.sortOrder ?? 0,
            isFeatured: row.isFeatured ?? false,
            hasVariants: row.hasVariants ?? false,
            seoTitle: row.seoTitle || null,
            seoDescription: row.seoDescription || null,
            seoKeywords: row.seoKeywords || null,
            ...shippingData,
          },
        });
        if (row.countryCodes?.length) await syncProductCountries(tx, product.id, row.countryCodes);
        if (row.imageUrls?.length) await syncProductImages(tx, product.id, row.imageUrls);
        targetId = product.id;
        summary.created += 1;
      }

      // Base Inventory
      if ((row.stock !== null && row.stock !== undefined) || (row.lowStockThreshold !== null && row.lowStockThreshold !== undefined) || (row.reservedStock !== null && row.reservedStock !== undefined)) {
        const existingBaseInventory = await tx.inventory.findFirst({
          where: { productId: targetId, variantId: null, warehouseId: null, countryId: null },
        });
        const stockVal = row.stock !== null && row.stock !== undefined ? row.stock : (existingBaseInventory?.stock ?? 0);
        const lowStockVal = row.lowStockThreshold !== null && row.lowStockThreshold !== undefined ? row.lowStockThreshold : (existingBaseInventory?.lowStockThreshold ?? 10);
        const reservedVal = row.reservedStock !== null && row.reservedStock !== undefined ? row.reservedStock : (existingBaseInventory?.reservedStock ?? 0);
        const invStatus = (stockVal - reservedVal) > 0 ? "IN_STOCK" : "OUT_OF_STOCK";

        if (existingBaseInventory) {
          await tx.inventory.update({
            where: { id: existingBaseInventory.id },
            data: {
              stock: stockVal,
              lowStockThreshold: lowStockVal,
              reservedStock: reservedVal,
              status: invStatus,
            },
          });
        } else {
          await tx.inventory.create({
            data: {
              productId: targetId,
              variantId: null,
              warehouseId: null,
              countryId: null,
              stock: stockVal,
              lowStockThreshold: lowStockVal,
              reservedStock: reservedVal,
              status: invStatus,
            },
          });
        }
      }

      // Base Pricing
      if ((row.price !== null && row.price !== undefined) || (row.sellingPrice !== null && row.sellingPrice !== undefined) || (row.mrp !== null && row.mrp !== undefined) || (row.dealerPrice !== null && row.dealerPrice !== undefined) || (row.doctorPrice !== null && row.doctorPrice !== undefined)) {
        const sellingPriceVal = row.sellingPrice ?? row.price ?? row.mrp ?? 0;
        const mrpVal = row.mrp ?? row.sellingPrice ?? row.price ?? 0;
        const dealerVal = row.dealerPrice ?? null;
        const doctorVal = row.doctorPrice ?? null;

        let targetPriceCountries = [defaultCountry].filter(Boolean);
        if (row.countryCodes && row.countryCodes.length > 0) {
          if (row.countryCodes.includes("ALL")) {
            targetPriceCountries = allActiveCountries;
          } else {
            const matched = allActiveCountries.filter((c) =>
              row.countryCodes!.some((cc) => cc.toUpperCase() === c.code.toUpperCase())
            );
            if (matched.length > 0) targetPriceCountries = matched;
          }
        }

        for (const c of targetPriceCountries) {
          const currencyId = c?.currencyId || baseCurrency?.id;
          if (!currencyId || !c) continue;

          const existingPrice = await tx.productPrice.findFirst({
            where: { productId: targetId, variantId: null, countryId: c.id, deletedAt: null },
          });

          if (existingPrice) {
            await tx.productPrice.update({
              where: { id: existingPrice.id },
              data: {
                mrp: mrpVal,
                sellingPrice: sellingPriceVal,
                dealerPrice: dealerVal,
                distributorPrice: doctorVal,
                status: "ACTIVE",
              },
            });
          } else {
            await tx.productPrice.create({
              data: {
                productId: targetId,
                variantId: null,
                countryId: c.id,
                currencyId,
                mrp: mrpVal,
                sellingPrice: sellingPriceVal,
                dealerPrice: dealerVal,
                distributorPrice: doctorVal,
                status: "ACTIVE",
              },
            });
          }
        }
      }
    }

    // Apply Tier Pricing rules from Sheet 2 (if provided)
    if (tierPricingList.length > 0) {
      const allTiers = await tx.tier.findMany({ where: { deletedAt: null } });
      const tierByName = new Map(allTiers.map((t) => [t.name.trim().toLowerCase(), t]));
      const tierById = new Map(allTiers.map((t) => [t.id, t]));

      for (const tRule of tierPricingList) {
        const pSku = getVariantImportField(tRule, "Product SKU", "productSku", "SKU", "sku");
        if (!pSku) continue;

        const targetProduct = await tx.product.findFirst({
          where: { sku: pSku, deletedAt: null },
        });
        if (!targetProduct) continue;

        const rawVSku = getVariantImportField(tRule, "Variant SKU", "variantSku");
        const isAllVariants = !rawVSku || rawVSku.toUpperCase() === "ALL" || rawVSku.toUpperCase() === "ALL VARIANTS" || rawVSku === "*";
        let targetVariantIds: (string | null)[] = [null];
        if (!isAllVariants) {
          const vTokens = String(rawVSku).split(/[,;|\n\r]+/).map((s: string) => s.trim()).filter(Boolean);
          const vMatches = await tx.productVariant.findMany({
            where: { productId: targetProduct.id, sku: { in: vTokens }, deletedAt: null },
            select: { id: true },
          });
          if (vMatches.length === 0) continue;
          targetVariantIds = vMatches.map((v) => v.id);
        }

        const rawTier = getVariantImportField(tRule, "Tier Name", "tierName", "Tier", "tier", "tierId");
        const tMatch = (tRule.tierId ? tierById.get(tRule.tierId) : null) ||
          (rawTier ? tierByName.get(rawTier.trim().toLowerCase()) : null);
        if (!tMatch) continue;

        const rawCountry = getVariantImportField(tRule, "Country", "country", "Country Code", "countryCode");
        const ruleCountry = (rawCountry || "").trim().toUpperCase();
        let targetCountries = allActiveCountries;
        if (ruleCountry && ruleCountry !== "ALL") {
          const tokens = ruleCountry.split(/[,;|]/).map((t: string) => t.trim().toUpperCase()).filter(Boolean);
          targetCountries = allActiveCountries.filter(
            (c) => tokens.includes(c.code.toUpperCase()) || tokens.includes(c.name.toUpperCase()) || tokens.includes(c.id.toUpperCase())
          );
        }
        if (targetCountries.length === 0) targetCountries = [allActiveCountries[0]];

        const rawMode = getVariantImportField(tRule, "Mode", "mode", "Type", "type") || "PERCENTAGE";
        const mode = rawMode.toUpperCase().includes("FIXED") ? "FIXED_PRICE" : "PERCENTAGE";
        const rawVal = getVariantImportField(tRule, "Discount / Fixed Price", "value", "Discount", "discount", "Fixed Price", "fixedPrice", "discountPercent");
        const val = Number(rawVal ?? 0);
        const discountPercent = mode === "FIXED_PRICE" ? null : val;
        const fixedPrice = mode === "FIXED_PRICE" ? val : null;

        for (const targetVariantId of targetVariantIds) {
          for (const c of targetCountries) {
            const existingRule = await tx.tierPricing.findFirst({
              where: {
                productId: targetProduct.id,
                tierId: tMatch.id,
                variantId: targetVariantId,
                countryId: c.id,
              },
            });

            if (existingRule) {
              await tx.tierPricing.update({
                where: { id: existingRule.id },
                data: { discountPercent, fixedPrice, deletedAt: null },
              });
            } else {
              await tx.tierPricing.create({
                data: {
                  productId: targetProduct.id,
                  tierId: tMatch.id,
                  variantId: targetVariantId,
                  countryId: c.id,
                  discountPercent,
                  fixedPrice,
                },
              });
            }
            (summary as any).tierRulesApplied = ((summary as any).tierRulesApplied || 0) + 1;
          }
        }
      }
    }

    // Apply MOQ Pricing rules from Sheet 3 (if provided)
    if (moqPricingList.length > 0) {
      for (const mRule of moqPricingList) {
        const pSku = getVariantImportField(mRule, "Product SKU", "productSku", "SKU", "sku");
        if (!pSku) continue;

        const targetProduct = await tx.product.findFirst({
          where: { sku: pSku, deletedAt: null },
        });
        if (!targetProduct) continue;

        const rawVSku = getVariantImportField(mRule, "Variant SKU", "variantSku");
        const isAllVariants = !rawVSku || rawVSku.toUpperCase() === "ALL" || rawVSku.toUpperCase() === "ALL VARIANTS" || rawVSku === "*";
        let targetVariantIds: (string | null)[] = [null];
        if (!isAllVariants) {
          const vTokens = String(rawVSku).split(/[,;|\n\r]+/).map((s: string) => s.trim()).filter(Boolean);
          const vMatches = await tx.productVariant.findMany({
            where: { productId: targetProduct.id, sku: { in: vTokens }, deletedAt: null },
            select: { id: true },
          });
          if (vMatches.length === 0) continue;
          targetVariantIds = vMatches.map((v) => v.id);
        }

        const rawCountry = getVariantImportField(mRule, "Country", "country", "Country Code", "countryCode");
        const ruleCountry = (rawCountry || "").trim().toUpperCase();
        let targetCountries = allActiveCountries;
        if (ruleCountry && ruleCountry !== "ALL") {
          const tokens = ruleCountry.split(/[,;|]/).map((t: string) => t.trim().toUpperCase()).filter(Boolean);
          targetCountries = allActiveCountries.filter(
            (c) => tokens.includes(c.code.toUpperCase()) || tokens.includes(c.name.toUpperCase()) || tokens.includes(c.id.toUpperCase())
          );
        }
        if (targetCountries.length === 0) targetCountries = [allActiveCountries[0]];

        const rawMinQty = getVariantImportField(mRule, "Min Qty", "minQty", "Min Quantity", "minQuantity");
        const rawMaxQty = getVariantImportField(mRule, "Max Qty", "maxQty", "Max Quantity", "maxQuantity");
        const minQty = Math.max(1, parseInt(rawMinQty || "1") || 1);
        const maxQty = rawMaxQty ? parseInt(rawMaxQty) : null;
        const rawMode = getVariantImportField(mRule, "Mode", "mode", "Type", "type") || "PERCENTAGE";
        const mode = rawMode.toUpperCase().includes("FIXED") ? "FIXED_PRICE" : "PERCENTAGE";
        const rawVal = getVariantImportField(mRule, "Discount / Fixed Price", "value", "Discount", "discount", "Fixed Price", "fixedPrice", "discountPercent");
        const val = Number(rawVal ?? 0);
        const discountPercent = mode === "FIXED_PRICE" ? null : val;
        const fixedPrice = mode === "FIXED_PRICE" ? val : null;
        for (const targetVariantId of targetVariantIds) {
          for (const c of targetCountries) {
            const existingRule = await tx.moqPricing.findFirst({
              where: {
                productId: targetProduct.id,
                variantId: targetVariantId,
                countryId: c.id,
                minQuantity: minQty,
              },
            });

            if (existingRule) {
              await tx.moqPricing.update({
                where: { id: existingRule.id },
                data: { maxQuantity: maxQty, discountPercent, fixedPrice, deletedAt: null },
              });
            } else {
              await tx.moqPricing.create({
                data: {
                  productId: targetProduct.id,
                  variantId: targetVariantId,
                  countryId: c.id,
                  minQuantity: minQty,
                  maxQuantity: maxQty,
                  discountPercent,
                  fixedPrice,
                },
              });
            }
            (summary as any).moqRulesApplied = ((summary as any).moqRulesApplied || 0) + 1;
          }
        }
      }
    }
  });

  return {
    ...summary,
    report: {
      totalRows: parsedRows.length,
      validRows: parsedRows.length,
      invalidRows: 0,
      issues: [],
      duplicateWarnings: preview.duplicateWarnings,
      sampleRows: parsedRows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    } satisfies SpreadsheetPreviewResult,
  };
}

function normalizeVariantAttributeValue(value: unknown): string {
  let normalized = String(value ?? "").trim().toLowerCase();

  // Normalize common smart/curly quotes.
  normalized = normalized
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'");

  // Excel may convert values such as ".022" into "0.022".
  // Normalize numeric-looking values so both formats compare equally.
  if (/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)$/.test(normalized)) {
    const numeric = Number(normalized);

    if (Number.isFinite(numeric)) {
      return String(numeric);
    }
  }

  return normalized;
}

function getVariantImportField(row: Record<string, string>, ...fieldNames: string[]): string | undefined {
  for (const name of fieldNames) {
    const direct = row[name];
    if (direct !== undefined && String(direct).trim() !== "") return String(direct).trim();
    const lowerKey = Object.keys(row).find((k) => k.toLowerCase() === name.toLowerCase());
    if (lowerKey && row[lowerKey] !== undefined && String(row[lowerKey]).trim() !== "") {
      return String(row[lowerKey]).trim();
    }
  }
  return undefined;
}

export async function generateProductVariantsMultiSheetTemplate(productId: string) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      countries: { include: { country: true } },
    },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const productAttributeMappings = await listProductAttributes(productId);
  const allTiers = await prisma.tier.findMany({ where: { deletedAt: null, status: "ACTIVE" } });
  const allCountries = await prisma.country.findMany({ where: { status: "ACTIVE" } });

  // 1. Sheet: Variants
  const attrHeaders = productAttributeMappings.map((m) => ({
    key: m.attribute.name,
    header: m.attribute.name,
  }));

  const variantCols = [
    { key: "productTitle", header: "Product" },
    { key: "sku", header: "SKU" },
    { key: "stock", header: "Stock" },
    { key: "lowStock", header: "Low Stock" },
    { key: "price", header: "Price" },
    { key: "mrp", header: "MRP" },
    { key: "dealerPrice", header: "Dealer Price" },
    { key: "doctorPrice", header: "Doctor Price" },
    { key: "countryCodes", header: "Country Codes" },
    { key: "weight", header: "Weight (kg)" },
    { key: "dimensions", header: "Dimensions (L x W x H cm)" },
    { key: "fragile", header: "Fragile" },
    { key: "hazardous", header: "Hazardous" },
    { key: "moq", header: "MOQ" },
    { key: "status", header: "Status" },
    ...attrHeaders,
  ];

  const sampleVariants: Record<string, unknown>[] = [
    {
      productTitle: product.title,
      sku: `${product.sku || "PRD"}-001`,
      stock: 100,
      lowStock: 10,
      price: 25.00,
      mrp: 35.00,
      dealerPrice: 20.00,
      doctorPrice: 22.00,
      countryCodes: "ALL",
      weight: 0.25,
      dimensions: "10 x 5 x 2",
      fragile: "FALSE",
      hazardous: "FALSE",
      moq: 1,
      status: "ACTIVE",
    },
  ];
  for (const m of productAttributeMappings) {
    sampleVariants[0][m.attribute.name] = m.allowedValues[0]?.attributeValue.value || "";
  }

  // 2. Sheet: Tier_Overrides
  const tierCols = [
    { key: "variantSku", header: "Variant SKU" },
    { key: "tierName", header: "Tier Name" },
    { key: "country", header: "Country" },
    { key: "mode", header: "Mode" },
    { key: "value", header: "Discount / Fixed Price" },
  ];
  const sampleTiers: Record<string, unknown>[] = [
    {
      variantSku: "ALL",
      tierName: allTiers[0]?.name || "Gold",
      country: "ALL",
      mode: "PERCENTAGE",
      value: 10,
    },
    {
      variantSku: `${product.sku || "PRD"}-001`,
      tierName: allTiers[1]?.name || allTiers[0]?.name || "Platinum",
      country: allCountries[0]?.code || "IN",
      mode: "PERCENTAGE",
      value: 15,
    },
  ];

  // 3. Sheet: MOQ_Overrides
  const moqCols = [
    { key: "variantSku", header: "Variant SKU" },
    { key: "country", header: "Country" },
    { key: "minQty", header: "Min Qty" },
    { key: "maxQty", header: "Max Qty" },
    { key: "mode", header: "Mode" },
    { key: "value", header: "Discount / Fixed Price" },
  ];
  const sampleMoq: Record<string, unknown>[] = [
    {
      variantSku: "ALL",
      country: "ALL",
      minQty: 10,
      maxQty: 49,
      mode: "PERCENTAGE",
      value: 5,
    },
    {
      variantSku: `${product.sku || "PRD"}-001`,
      country: allCountries[0]?.code || "IN",
      minQty: 50,
      maxQty: null,
      mode: "PERCENTAGE",
      value: 10,
    },
  ];

  return writeMultiSheetSpreadsheetBuffer([
    { name: "Variants", rows: sampleVariants, columns: variantCols },
    { name: "Tier_Overrides", rows: sampleTiers, columns: tierCols },
    { name: "MOQ_Overrides", rows: sampleMoq, columns: moqCols },
  ]);
}

export async function previewVariantsImport(productId: string, filePath: string) {
  const product = await assertProductExists(productId);
  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  const productAttributeMappings = await listProductAttributes(productId);
  const allSheets = readAllSpreadsheetSheets(filePath);
  const sheetNames = Object.keys(allSheets);

  // Identify Sheets
  const variantSheetName = sheetNames.find((s) => /variant/i.test(s)) || sheetNames[0] || "Variants";
  const rows = allSheets[variantSheetName] || [];

  const tierSheetName = sheetNames.find((s) => /tier/i.test(s));
  const rawTierRows = tierSheetName ? allSheets[tierSheetName] || [] : [];

  const moqSheetName = sheetNames.find((s) => /moq/i.test(s));
  const rawMoqRows = moqSheetName ? allSheets[moqSheetName] || [] : [];

  const existingVariants = await prisma.productVariant.findMany({
    where: { productId, deletedAt: null },
    include: {
      inventories: { where: { countryId: null } },
      prices: { where: { deletedAt: null }, include: { currency: true } },
      attributeValues: { include: { attribute: true, attributeValue: true } },
    },
  });
  const existingVariantBySku = new Map(
    existingVariants.filter((v) => v.sku).map((v) => [v.sku!.trim().toLowerCase(), v])
  );

  const parsedRows: any[] = [];
  const skuSet = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rawSku = getVariantImportField(row, "SKU", "sku");
    const sku = rawSku || "";

    const existingVariant = sku ? existingVariantBySku.get(sku.toLowerCase()) : null;

    const rawStock = getVariantImportField(row, "Stock", "Stock Level", "stock");
    let stock: number = 0;
    if (rawStock !== undefined) {
      stock = parseInt(rawStock);
    } else if (existingVariant) {
      stock = existingVariant.inventories[0]?.stock ?? 0;
    } else {
      stock = 0;
    }

    const rawLowStock = getVariantImportField(row, "Low Stock", "Low Stock Threshold", "lowStock");
    let lowStockThreshold: number = 10;
    if (rawLowStock !== undefined) {
      lowStockThreshold = parseInt(rawLowStock);
    } else if (existingVariant) {
      lowStockThreshold = existingVariant.inventories[0]?.lowStockThreshold ?? 10;
    } else {
      lowStockThreshold = 10;
    }

    const rawPrice = getVariantImportField(row, "Price", "Selling Price", "Base Price", "price");
    const defaultPriceObj = existingVariant
      ? (product.defaultCountryId ? existingVariant.prices.find((p) => p.countryId === product.defaultCountryId) : null) || existingVariant.prices[0]
      : null;

    let price: number = 0;
    if (rawPrice !== undefined) {
      price = parseFloat(rawPrice);
    } else if (existingVariant && defaultPriceObj) {
      price = Number(defaultPriceObj.sellingPrice);
    } else {
      price = 0;
    }

    const rawMRP = getVariantImportField(row, "MRP", "mrp");
    let mrp: number = price;
    if (rawMRP !== undefined) {
      mrp = parseFloat(rawMRP);
    } else if (rawPrice !== undefined) {
      mrp = price;
    } else if (existingVariant && defaultPriceObj) {
      mrp = defaultPriceObj.mrp ? Number(defaultPriceObj.mrp) : (price ?? 0);
    } else {
      mrp = price ?? 0;
    }

    const rawDealerPrice = getVariantImportField(row, "Dealer Price", "Dealer", "dealerPrice", "dealer_price");
    const dealerPrice: number | null = rawDealerPrice !== undefined && rawDealerPrice !== "" && !isNaN(parseFloat(rawDealerPrice))
      ? parseFloat(rawDealerPrice)
      : (defaultPriceObj?.dealerPrice ? Number(defaultPriceObj.dealerPrice) : null);

    const rawDoctorPrice = getVariantImportField(row, "Doctor Price", "Doctor", "doctorPrice", "doctor_price", "Distributor Price", "distributorPrice");
    const doctorPrice: number | null = rawDoctorPrice !== undefined && rawDoctorPrice !== "" && !isNaN(parseFloat(rawDoctorPrice))
      ? parseFloat(rawDoctorPrice)
      : (defaultPriceObj?.distributorPrice ? Number(defaultPriceObj.distributorPrice) : null);

    const rawCountryCodes = getVariantImportField(row, "Country Codes", "Countries", "Country", "countryCodes", "country_codes");
    const countryCodes = rawCountryCodes || "ALL";

    const rawWeight = getVariantImportField(row, "Weight", "Weight (kg)", "weight", "weightKg", "weight_kg");
    const weight: number | null = rawWeight !== undefined && rawWeight !== "" && !isNaN(parseFloat(rawWeight))
      ? parseFloat(rawWeight)
      : (existingVariant?.weight ? Number(existingVariant.weight) : null);

    let lengthVal = getVariantImportField(row, "Length", "length", "Length (cm)", "length_cm");
    let widthVal = getVariantImportField(row, "Width", "width", "Width (cm)", "width_cm");
    let heightVal = getVariantImportField(row, "Height", "height", "Height (cm)", "height_cm");
    const rawDims = getVariantImportField(row, "Dimensions", "Dimensions (cm)", "dimensions", "Dimensions (L x W x H cm)");
    if ((!lengthVal || !widthVal || !heightVal) && rawDims) {
      const parts = rawDims.split(/[\s*xX]+/).map(Number).filter((n) => !isNaN(n));
      if (parts.length >= 3) {
        lengthVal = String(parts[0]);
        widthVal = String(parts[1]);
        heightVal = String(parts[2]);
      }
    }

    const rawFragile = getVariantImportField(row, "Fragile", "fragile", "Is Fragile", "is_fragile");
    const fragile: boolean = rawFragile !== undefined
      ? (rawFragile.toUpperCase() === "TRUE" || rawFragile === "1" || rawFragile.toUpperCase() === "YES")
      : (existingVariant?.fragile ?? false);

    const rawHazardous = getVariantImportField(row, "Hazardous", "hazardous", "Is Hazardous", "is_hazardous");
    const hazardous: boolean = rawHazardous !== undefined
      ? (rawHazardous.toUpperCase() === "TRUE" || rawHazardous === "1" || rawHazardous.toUpperCase() === "YES")
      : (existingVariant?.hazardous ?? false);

    const rawMoq = getVariantImportField(row, "MOQ", "moq", "Min Order Qty", "Min Order Quantity");
    const moq: number = rawMoq !== undefined && !isNaN(parseInt(rawMoq))
      ? Math.max(1, parseInt(rawMoq))
      : (existingVariant?.moq ?? 1);

    const rawShippingClass = getVariantImportField(row, "Shipping Class", "shippingClass", "shipping_class");
    const shippingClass = rawShippingClass || existingVariant?.shippingClass || null;

    const rawStatus = getVariantImportField(row, "Status", "status");
    let status: string = "ACTIVE";
    if (rawStatus !== undefined) {
      status = rawStatus.toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";
    } else if (existingVariant) {
      status = existingVariant.status;
    } else {
      status = "ACTIVE";
    }

    const errors: string[] = [];
    const attributeValues: any[] = [];

    if (!sku) {
      errors.push("SKU is required.");
    } else {
      if (skuSet.has(sku.toLowerCase())) {
        errors.push(`Duplicate SKU "${sku}" in spreadsheet.`);
      }
      skuSet.add(sku.toLowerCase());
    }

    if (isNaN(stock) || stock < 0) {
      errors.push("Stock must be a non-negative number.");
    }
    if (isNaN(lowStockThreshold) || lowStockThreshold < 0) {
      errors.push("Low Stock must be a non-negative number.");
    }
    if (isNaN(price) || price < 0) {
      errors.push("Price must be a non-negative number.");
    }
    if (isNaN(mrp) || mrp < 0) {
      errors.push("MRP must be a non-negative number.");
    }

    // Map attributes
    for (const mapping of productAttributeMappings) {
      let cellValue = getVariantImportField(
        row,
        mapping.attribute.name,
        `attr: ${mapping.attribute.name}`,
        `attribute: ${mapping.attribute.name}`
      ) || "";

      if (!cellValue) {
        const rawAttributes = getVariantImportField(row, "Attributes", "attributes", "Attribute", "Variant Attributes") || "";
        if (rawAttributes) {
          const escapedName = mapping.attribute.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const attrRegex = new RegExp(`(?:^|[,;|])\\s*${escapedName}\\s*[:=]\\s*([^,;|]+)`, "i");
          const match = rawAttributes.match(attrRegex);
          if (match && match[1]) {
            cellValue = match[1].trim();
          } else {
            const parts = rawAttributes.split(/[,;|]/).map((p: string) => p.trim());
            for (const part of parts) {
              const normalizedPart = normalizeVariantAttributeValue(part);
              const matched = mapping.allowedValues.find(
                (v) => normalizeVariantAttributeValue(v.attributeValue.value) === normalizedPart
              );
              if (matched) {
                cellValue = part;
                break;
              }
            }
          }
        }
      }

      if (!cellValue) {
        // If this variant already exists in DB, retain its existing attribute value!
        const existingAv = existingVariant?.attributeValues.find(
          (av) => av.attributeId === mapping.attributeId
        );
        if (existingAv && existingAv.attribute && existingAv.attributeValue) {
          attributeValues.push({
            attributeId: existingAv.attributeId,
            attributeName: existingAv.attribute.name,
            attributeValueId: existingAv.attributeValueId,
            value: existingAv.attributeValue.value,
          });
        } else if (mapping.required) {
          errors.push(`Attribute "${mapping.attribute.name}" is required.`);
        }
      } else {
        const normalizedCellValue = normalizeVariantAttributeValue(cellValue);

        const matchedValue = mapping.allowedValues.find(
          (v) =>
            normalizeVariantAttributeValue(v.attributeValue.value) ===
            normalizedCellValue
        );
        if (matchedValue) {
          attributeValues.push({
            attributeId: mapping.attributeId,
            attributeName: mapping.attribute.name,
            attributeValueId: matchedValue.attributeValueId,
            value: matchedValue.attributeValue.value,
          });
        } else {
          errors.push(`Value "${cellValue}" is not mapped for "${mapping.attribute.name}".`);
        }
      }
    }

    const attrValuesText = attributeValues.map((v) => v.value).join(" / ");
    const variantTitle = attrValuesText || (existingVariant?.title ?? `Variant ${sku}`);

    parsedRows.push({
      rowNumber: index + 2,
      sku,
      variantTitle,
      stock: isNaN(stock) ? 0 : stock,
      lowStockThreshold: isNaN(lowStockThreshold) ? 10 : lowStockThreshold,
      price: isNaN(price) ? 0 : price,
      mrp: isNaN(mrp) ? 0 : mrp,
      dealerPrice,
      doctorPrice,
      countryCodes,
      weight,
      length: lengthVal ? Number(lengthVal) : null,
      width: widthVal ? Number(widthVal) : null,
      height: heightVal ? Number(heightVal) : null,
      fragile,
      hazardous,
      moq,
      shippingClass,
      status,
      attributeValues,
      isValid: errors.length === 0,
      errors,
    });
  }

  // Parse Tier Overrides (Method 2)
  const parsedTierOverrides: any[] = [];
  const allTiers = await prisma.tier.findMany({ where: { deletedAt: null } });
  const tierByName = new Map(allTiers.map((t) => [t.name.trim().toLowerCase(), t]));
  const allCountries = await prisma.country.findMany({ where: { status: "ACTIVE" } });
  const countryByCode = new Map(allCountries.map((c) => [c.code.trim().toUpperCase(), c]));
  const countryByName = new Map(allCountries.map((c) => [c.name.trim().toLowerCase(), c]));

  for (const [tIdx, tRow] of rawTierRows.entries()) {
    const rawSku = getVariantImportField(tRow, "Variant SKU", "variantSku", "SKU", "sku");
    const rawTier = getVariantImportField(tRow, "Tier Name", "tierName", "Tier", "tier", "tierId");
    const rawCountry = getVariantImportField(tRow, "Country", "country", "Country Code", "countryCode", "countryCodes");
    const rawMode = getVariantImportField(tRow, "Mode", "mode", "Type", "type", "discountType") || "PERCENTAGE";
    const rawVal = getVariantImportField(tRow, "Discount / Fixed Price", "value", "Discount", "discount", "Fixed Price", "fixedPrice", "discountPercent");

    // If whole row is empty, skip
    if (!rawSku && !rawTier && !rawCountry && !rawVal) continue;

    const isAllVariants = !rawSku || rawSku.trim().toUpperCase() === "ALL" || rawSku.trim().toUpperCase() === "ALL VARIANTS" || rawSku.trim() === "*";

    const tErrors: string[] = [];
    if (!isAllVariants && !skuSet.has(rawSku.toLowerCase()) && !existingVariantBySku.has(rawSku.toLowerCase())) {
      tErrors.push(`Variant SKU "${rawSku}" does not match any variant.`);
    }

    const matchedTier = rawTier ? tierByName.get(rawTier.toLowerCase()) : null;
    if (!rawTier) tErrors.push("Tier Name is required.");
    else if (!matchedTier) tErrors.push(`Tier "${rawTier}" not found in system.`);

    if (rawCountry && rawCountry.toUpperCase() !== "ALL") {
      const cTokens = rawCountry.split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean);
      for (const tok of cTokens) {
        if (!countryByCode.get(tok.toUpperCase()) && !countryByName.get(tok.toLowerCase())) {
          tErrors.push(`Country "${tok}" not recognized.`);
          break;
        }
      }
    }

    const numVal = parseFloat(rawVal || "0");
    if (isNaN(numVal) || numVal < 0) {
      tErrors.push("Discount/Price value must be a non-negative number.");
    }

    parsedTierOverrides.push({
      rowNumber: tIdx + 2,
      variantSku: isAllVariants ? "ALL" : rawSku,
      tierName: matchedTier?.name || rawTier,
      tierId: matchedTier?.id || "",
      country: rawCountry || "ALL",
      countryId: rawCountry || "ALL",
      mode: rawMode.toUpperCase().includes("FIXED") ? "FIXED_PRICE" : "PERCENTAGE",
      value: isNaN(numVal) ? 0 : numVal,
      isValid: tErrors.length === 0,
      errors: tErrors,
    });
  }

  // Parse MOQ Overrides (Method 2)
  const parsedMoqOverrides: any[] = [];
  for (const [mIdx, mRow] of rawMoqRows.entries()) {
    const rawSku = getVariantImportField(mRow, "Variant SKU", "variantSku", "SKU", "sku");
    const rawCountry = getVariantImportField(mRow, "Country", "country", "Country Code", "countryCode", "countryCodes");
    const rawMinQty = getVariantImportField(mRow, "Min Qty", "minQty", "Min Quantity", "minQuantity", "Quantity", "qty");
    const rawMaxQty = getVariantImportField(mRow, "Max Qty", "maxQty", "Max Quantity", "maxQuantity");
    const rawMode = getVariantImportField(mRow, "Mode", "mode", "Type", "type", "discountType") || "PERCENTAGE";
    const rawVal = getVariantImportField(mRow, "Discount / Fixed Price", "value", "Discount", "discount", "Fixed Price", "fixedPrice", "discountPercent");

    // If whole row is empty, skip
    if (!rawSku && !rawCountry && !rawMinQty && !rawVal) continue;

    const isAllVariants = !rawSku || rawSku.trim().toUpperCase() === "ALL" || rawSku.trim().toUpperCase() === "ALL VARIANTS" || rawSku.trim() === "*";

    const mErrors: string[] = [];
    if (!isAllVariants && !skuSet.has(rawSku.toLowerCase()) && !existingVariantBySku.has(rawSku.toLowerCase())) {
      mErrors.push(`Variant SKU "${rawSku}" does not match any variant.`);
    }

    if (rawCountry && rawCountry.toUpperCase() !== "ALL") {
      const cTokens = rawCountry.split(/[,;|]/).map((s: string) => s.trim()).filter(Boolean);
      for (const tok of cTokens) {
        if (!countryByCode.get(tok.toUpperCase()) && !countryByName.get(tok.toLowerCase())) {
          mErrors.push(`Country "${tok}" not recognized.`);
          break;
        }
      }
    }

    const minQty = parseInt(rawMinQty || "1");
    if (isNaN(minQty) || minQty < 1) {
      mErrors.push("Min Qty must be at least 1.");
    }
    const maxQty = rawMaxQty ? parseInt(rawMaxQty) : null;
    if (maxQty !== null && (isNaN(maxQty) || maxQty < minQty)) {
      mErrors.push("Max Qty must be greater than or equal to Min Qty.");
    }

    const numVal = parseFloat(rawVal || "0");
    if (isNaN(numVal) || numVal < 0) {
      mErrors.push("Discount/Price value must be a non-negative number.");
    }

    parsedMoqOverrides.push({
      rowNumber: mIdx + 2,
      variantSku: isAllVariants ? "ALL" : rawSku,
      country: rawCountry || "ALL",
      countryId: rawCountry || "ALL",
      minQuantity: isNaN(minQty) ? 1 : minQty,
      maxQuantity: maxQty,
      mode: rawMode.toUpperCase().includes("FIXED") ? "FIXED_PRICE" : "PERCENTAGE",
      value: isNaN(numVal) ? 0 : numVal,
      isValid: mErrors.length === 0,
      errors: mErrors,
    });
  }

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  return {
    totalRows: parsedRows.length,
    validRows: validRowsCount,
    invalidRows: parsedRows.length - validRowsCount,
    rows: parsedRows,
    tierOverrides: parsedTierOverrides,
    moqOverrides: parsedMoqOverrides,
  };
}

export async function executeVariantsImport(productId: string, payload: any) {
  const product = await assertProductExists(productId);
  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  const rows: any[] = Array.isArray(payload) ? payload : (payload?.rows || []);
  const tierOverrides: any[] = Array.isArray(payload?.tierOverrides) ? payload.tierOverrides : [];
  const moqOverrides: any[] = Array.isArray(payload?.moqOverrides) ? payload.moqOverrides : [];

  const productCountries = await prisma.productCountry.findMany({
    where: { productId, enabled: true },
    select: { countryId: true },
  });

  const allCountriesList = await prisma.country.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, code: true, name: true, currencyId: true },
  });

  const baseCurrency =
    (await prisma.currency.findFirst({ where: { isBase: true } })) ||
    (await prisma.currency.findFirst({ where: { code: "USD" } })) ||
    (await prisma.currency.findFirst());
  if (!baseCurrency) throw new AppError("Base currency not configured.", 400);

  const priceCountryId =
    product.defaultCountryId ||
    productCountries[0]?.countryId ||
    (await prisma.country.findFirst({ where: { isDefault: true }, select: { id: true } }))?.id ||
    (await prisma.country.findFirst({ select: { id: true } }))?.id;

  if (!priceCountryId) {
    throw new AppError(
      "Product country is required before importing variant prices.",
      400
    );
  }

  const priceCountry = await prisma.country.findUnique({
    where: { id: priceCountryId },
    select: {
      id: true,
      currencyId: true,
    },
  });

  if (!priceCountry) {
    throw new AppError("Product default country was not found.", 400);
  }

  const summary = {
    created: 0,
    updated: 0,
    tierOverridesApplied: 0,
    moqOverridesApplied: 0,
  };
  const CHUNK_SIZE = 500;

  for (let i = 0; i < rows.length; i += CHUNK_SIZE) {
    const chunk = rows.slice(i, i + CHUNK_SIZE);

    await prisma.$transaction(
      async (tx) => {
        const chunkSkus: string[] = [];
        const chunkVariantKeys: string[] = [];
        for (const row of chunk) {
          const sku = row.sku?.trim();
          if (sku) chunkSkus.push(sku);

          const attributeValues = Array.isArray(row.attributeValues)
            ? row.attributeValues.filter((v: any) => v?.attributeId && v?.attributeValueId)
            : [];
          if (attributeValues.length > 0) {
            const attrValueIds = attributeValues.map((v: any) => v.attributeValueId);
            chunkVariantKeys.push([...attrValueIds].sort().join("-"));
          }
        }

        const existingBySkuList = chunkSkus.length > 0
          ? await tx.productVariant.findMany({
              where: { productId, sku: { in: chunkSkus }, deletedAt: null },
              select: { id: true, sku: true, title: true, status: true, variantKey: true },
            })
          : [];
        const variantBySku = new Map(
          existingBySkuList.filter((v) => v.sku).map((v) => [v.sku!.trim().toLowerCase(), v])
        );

        const existingByKeyList = chunkVariantKeys.length > 0
          ? await tx.productVariant.findMany({
              where: { productId, variantKey: { in: chunkVariantKeys }, deletedAt: null },
              select: { id: true, sku: true, title: true, status: true, variantKey: true },
            })
          : [];
        const variantByKey = new Map(
          existingByKeyList.filter((v) => v.variantKey).map((v) => [v.variantKey!, v])
        );

        const allMatchedIds = [
          ...existingBySkuList.map((v) => v.id),
          ...existingByKeyList.map((v) => v.id),
        ];

        const existingInventories = allMatchedIds.length > 0
          ? await tx.inventory.findMany({
              where: { variantId: { in: allMatchedIds }, countryId: null },
            })
          : [];
        const inventoryByVariantId = new Map(
          existingInventories.filter((inv) => inv.variantId).map((inv) => [inv.variantId!, inv])
        );

        const existingPrices = allMatchedIds.length > 0
          ? await tx.productPrice.findMany({
              where: { variantId: { in: allMatchedIds }, countryId: priceCountryId, deletedAt: null },
            })
          : [];
        const priceByVariantId = new Map(
          existingPrices.filter((p) => p.variantId).map((p) => [p.variantId!, p])
        );

        for (const row of chunk) {
          const normalizedSku = row.sku?.trim();
          if (!normalizedSku) continue;

          const existingVariant = variantBySku.get(normalizedSku.toLowerCase());
          let variantId = "";

          // Prepare shipping details
          const shippingFields: Record<string, any> = {};
          if (row.moq !== undefined && row.moq !== null && !isNaN(parseInt(row.moq))) {
            shippingFields.moq = Math.max(1, parseInt(row.moq));
          }
          if (row.weight !== undefined && row.weight !== null && row.weight !== "" && !isNaN(parseFloat(row.weight))) {
            shippingFields.weight = parseFloat(row.weight);
          }
          if (row.length !== undefined && row.length !== null && row.length !== "" && !isNaN(parseFloat(row.length))) {
            shippingFields.length = parseFloat(row.length);
          }
          if (row.width !== undefined && row.width !== null && row.width !== "" && !isNaN(parseFloat(row.width))) {
            shippingFields.width = parseFloat(row.width);
          }
          if (row.height !== undefined && row.height !== null && row.height !== "" && !isNaN(parseFloat(row.height))) {
            shippingFields.height = parseFloat(row.height);
          }
          if (row.fragile !== undefined && row.fragile !== null && row.fragile !== "") {
            shippingFields.fragile = Boolean(row.fragile === true || String(row.fragile).toUpperCase() === "TRUE" || String(row.fragile) === "1");
          }
          if (row.hazardous !== undefined && row.hazardous !== null && row.hazardous !== "") {
            shippingFields.hazardous = Boolean(row.hazardous === true || String(row.hazardous).toUpperCase() === "TRUE" || String(row.hazardous) === "1");
          }
          if (row.shippingClass) {
            shippingFields.shippingClass = String(row.shippingClass).trim();
          }

          if (existingVariant) {
            const attributeValues = Array.isArray(row.attributeValues)
              ? row.attributeValues.filter(
                  (v: any) => v?.attributeId && v?.attributeValueId
                )
              : [];

            if (attributeValues.length > 0) {
              const attrValueIds = attributeValues.map((v: any) => v.attributeValueId);
              const variantKey = [...attrValueIds].sort().join("-");
              await tx.productVariantAttributeValue.deleteMany({ where: { variantId: existingVariant.id } });
              await tx.productVariantAttributeValue.createMany({
                data: attributeValues.map((v: any) => ({
                  variantId: existingVariant.id,
                  attributeId: v.attributeId,
                  attributeValueId: v.attributeValueId,
                })),
              });
              await tx.productVariant.update({
                where: { id: existingVariant.id },
                data: {
                  variantKey,
                  title: row.variantTitle || existingVariant.title,
                  status: row.status || existingVariant.status,
                  ...shippingFields,
                },
              });
            } else {
              await tx.productVariant.update({
                where: { id: existingVariant.id },
                data: {
                  status: row.status || existingVariant.status,
                  ...shippingFields,
                },
              });
            }
            variantId = existingVariant.id;
            summary.updated += 1;
          } else {
            const attributeValues = Array.isArray(row.attributeValues)
              ? row.attributeValues.filter(
                  (v: any) => v?.attributeId && v?.attributeValueId
                )
              : [];

            const attrValueIds = attributeValues.map(
              (v: any) => v.attributeValueId
            );
            const variantKey = [...attrValueIds].sort().join("-");

            const duplicateKeyVariant = variantKey ? variantByKey.get(variantKey) : null;

            if (duplicateKeyVariant) {
              await tx.productVariant.update({
                where: { id: duplicateKeyVariant.id },
                data: {
                  sku: normalizedSku,
                  status: row.status || duplicateKeyVariant.status,
                  ...shippingFields,
                },
              });

              variantId = duplicateKeyVariant.id;
              summary.updated += 1;
            } else {
              const variant = await tx.productVariant.create({
                data: {
                  productId,
                  title: row.variantTitle || "Imported Variant",
                  variantKey,
                  sku: normalizedSku,
                  status: row.status || "ACTIVE",
                  ...shippingFields,
                },
              });

              variantId = variant.id;

              if (attributeValues.length > 0) {
                await tx.productVariantAttributeValue.createMany({
                  data: attributeValues.map((v: any) => ({
                    variantId: variant.id,
                    attributeId: v.attributeId,
                    attributeValueId: v.attributeValueId,
                  })),
                });
              }

              variantBySku.set(normalizedSku.toLowerCase(), variant as any);
              if (variantKey) variantByKey.set(variantKey, variant as any);

              summary.created += 1;
            }
          }

          const existingInventory = inventoryByVariantId.get(variantId);

          if (existingInventory) {
            await tx.inventory.update({
              where: { id: existingInventory.id },
              data: {
                stock: row.stock ?? existingInventory.stock,
                lowStockThreshold: row.lowStockThreshold ?? existingInventory.lowStockThreshold,
              },
            });
          } else {
            const newInv = await tx.inventory.create({
              data: {
                productId,
                variantId,
                countryId: null,
                stock: row.stock ?? 0,
                lowStockThreshold: row.lowStockThreshold ?? 10,
                status: (row.stock ?? 0) > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
              },
            });
            inventoryByVariantId.set(variantId, newInv as any);
          }

          const existingPrice = priceByVariantId.get(variantId);
          const dealerPriceVal = row.dealerPrice !== undefined && row.dealerPrice !== null && row.dealerPrice !== "" && !isNaN(parseFloat(row.dealerPrice))
            ? parseFloat(row.dealerPrice)
            : undefined;
          const doctorPriceVal = row.doctorPrice !== undefined && row.doctorPrice !== null && row.doctorPrice !== "" && !isNaN(parseFloat(row.doctorPrice))
            ? parseFloat(row.doctorPrice)
            : (row.distributorPrice !== undefined && row.distributorPrice !== null && row.distributorPrice !== "" && !isNaN(parseFloat(row.distributorPrice)) ? parseFloat(row.distributorPrice) : undefined);

          if (existingPrice) {
            await tx.productPrice.update({
              where: { id: existingPrice.id },
              data: {
                mrp: row.mrp ?? existingPrice.mrp,
                sellingPrice:
                  row.price ??
                  row.sellingPrice ??
                  existingPrice.sellingPrice,
                dealerPrice: dealerPriceVal !== undefined ? dealerPriceVal : existingPrice.dealerPrice,
                distributorPrice: doctorPriceVal !== undefined ? doctorPriceVal : existingPrice.distributorPrice,
              },
            });
          } else {
            const newPrice = await tx.productPrice.create({
              data: {
                productId,
                variantId,
                countryId: priceCountryId,
                currencyId: priceCountry.currencyId || baseCurrency.id,
                mrp: row.mrp ?? row.price ?? 0,
                sellingPrice: row.price ?? row.sellingPrice ?? 0,
                dealerPrice: dealerPriceVal ?? null,
                distributorPrice: doctorPriceVal ?? null,
                status: "ACTIVE",
              },
            });
            priceByVariantId.set(variantId, newPrice as any);
          }

          // Country Visibility
          let enabledCountryIds: string[] = [];
          if (row.countryCodes && String(row.countryCodes).trim()) {
            const codeStr = String(row.countryCodes).trim().toUpperCase();
            if (codeStr === "ALL") {
              enabledCountryIds = allCountriesList.map((c) => c.id);
            } else {
              const rawTokens = codeStr.split(/[,;|]/).map((t) => t.trim()).filter(Boolean);
              for (const token of rawTokens) {
                const match = allCountriesList.find(
                  (c) => c.code.toUpperCase() === token || c.name.toUpperCase() === token || c.id === token
                );
                if (match) enabledCountryIds.push(match.id);
              }
            }
          } else {
            enabledCountryIds = productCountries.map((pc) => pc.countryId);
          }

          for (const c of allCountriesList) {
            const isEnabled = enabledCountryIds.includes(c.id);
            await tx.variantCountry.upsert({
              where: {
                variantId_countryId: {
                  variantId,
                  countryId: c.id,
                },
              },
              update: { enabled: isEnabled },
              create: {
                variantId,
                countryId: c.id,
                enabled: isEnabled,
              },
            });
          }
        }

        // Apply Tier Overrides if provided
        if (tierOverrides.length > 0) {
          const allTiers = await tx.tier.findMany({ where: { deletedAt: null } });
          const tierByName = new Map(allTiers.map((t) => [t.name.trim().toLowerCase(), t]));
          const tierById = new Map(allTiers.map((t) => [t.id, t]));

          for (const tRule of tierOverrides) {
            const rawSku = (tRule.variantSku || tRule.sku || "").trim();
            const isAllVariants = !rawSku || rawSku.toUpperCase() === "ALL" || rawSku.toUpperCase() === "ALL VARIANTS" || rawSku === "*";
            let targetVariantIds: (string | null)[] = [null];
            if (!isAllVariants) {
              const vTokens = String(rawSku).split(/[,;|\n\r]+/).map((s: string) => s.trim()).filter(Boolean);
              const vMatches = await tx.productVariant.findMany({
                where: { productId, sku: { in: vTokens }, deletedAt: null },
                select: { id: true },
              });
              if (vMatches.length === 0) continue;
              targetVariantIds = vMatches.map((v) => v.id);
            }

            const tMatch = (tRule.tierId ? tierById.get(tRule.tierId) : null) ||
              (tRule.tierName ? tierByName.get(tRule.tierName.trim().toLowerCase()) : null);
            if (!tMatch) continue;

            const ruleCountry = (tRule.country || tRule.countryCode || "").trim().toUpperCase();
            let targetCountries = allCountriesList;
            if (ruleCountry && ruleCountry !== "ALL") {
              const tokens = ruleCountry.split(/[,;|]/).map((t: string) => t.trim().toUpperCase()).filter(Boolean);
              targetCountries = allCountriesList.filter(
                (c) => tokens.includes(c.code.toUpperCase()) || tokens.includes(c.name.toUpperCase()) || tokens.includes(c.id.toUpperCase())
              );
            }
            if (targetCountries.length === 0) targetCountries = [allCountriesList[0]];

            const mode = (tRule.mode || "PERCENTAGE").toUpperCase();
            const val = Number(tRule.value ?? tRule.discount ?? tRule.fixedPrice ?? tRule.discountPercent ?? 0);
            const discountPercent = mode === "FIXED_PRICE" ? null : val;
            const fixedPrice = mode === "FIXED_PRICE" ? val : null;

            for (const targetVariantId of targetVariantIds) {
              for (const c of targetCountries) {
                const existingRule = await tx.tierPricing.findFirst({
                  where: {
                    tierId: tMatch.id,
                    productId,
                    variantId: targetVariantId,
                    countryId: c.id,
                  },
                });

                if (existingRule) {
                  await tx.tierPricing.update({
                    where: { id: existingRule.id },
                    data: {
                      discountPercent,
                      fixedPrice,
                      deletedAt: null,
                    },
                  });
                } else {
                  await tx.tierPricing.create({
                    data: {
                      tierId: tMatch.id,
                      productId,
                      variantId: targetVariantId,
                      countryId: c.id,
                      discountPercent,
                      fixedPrice,
                    },
                  });
                }
                summary.tierOverridesApplied += 1;
              }
            }
          }
        }

        // Apply MOQ Overrides if provided
        if (moqOverrides.length > 0) {
          for (const mRule of moqOverrides) {
            const rawSku = (mRule.variantSku || mRule.sku || "").trim();
            const isAllVariants = !rawSku || rawSku.toUpperCase() === "ALL" || rawSku.toUpperCase() === "ALL VARIANTS" || rawSku === "*";
            let targetVariantIds: (string | null)[] = [null];
            if (!isAllVariants) {
              const vTokens = String(rawSku).split(/[,;|\n\r]+/).map((s: string) => s.trim()).filter(Boolean);
              const vMatches = await tx.productVariant.findMany({
                where: { productId, sku: { in: vTokens }, deletedAt: null },
                select: { id: true },
              });
              if (vMatches.length === 0) continue;
              targetVariantIds = vMatches.map((v) => v.id);
            }

            const ruleCountry = (mRule.country || mRule.countryCode || "").trim().toUpperCase();
            let targetCountries = allCountriesList;
            if (ruleCountry && ruleCountry !== "ALL") {
              const tokens = ruleCountry.split(/[,;|]/).map((t: string) => t.trim().toUpperCase()).filter(Boolean);
              targetCountries = allCountriesList.filter(
                (c) => tokens.includes(c.code.toUpperCase()) || tokens.includes(c.name.toUpperCase()) || tokens.includes(c.id.toUpperCase())
              );
            }
            if (targetCountries.length === 0) targetCountries = [allCountriesList[0]];

            const minQty = Math.max(1, parseInt(mRule.minQuantity ?? mRule.minQty ?? 1) || 1);
            const maxQty = mRule.maxQuantity ?? mRule.maxQty ? parseInt(mRule.maxQuantity ?? mRule.maxQty) : null;
            const mode = (mRule.mode || "PERCENTAGE").toUpperCase();
            const val = Number(mRule.value ?? mRule.discount ?? mRule.fixedPrice ?? mRule.discountPercent ?? 0);
            const discountPercent = mode === "FIXED_PRICE" ? null : val;
            const fixedPrice = mode === "FIXED_PRICE" ? val : null;

            for (const targetVariantId of targetVariantIds) {
              for (const c of targetCountries) {
                const existingRule = await tx.moqPricing.findFirst({
                  where: {
                    productId,
                    variantId: targetVariantId,
                    countryId: c.id,
                    minQuantity: minQty,
                  },
                });

              if (existingRule) {
                await tx.moqPricing.update({
                  where: { id: existingRule.id },
                  data: {
                    maxQuantity: maxQty,
                    discountPercent,
                    fixedPrice,
                    deletedAt: null,
                  },
                });
              } else {
                await tx.moqPricing.create({
                  data: {
                    productId,
                    variantId: targetVariantId,
                    countryId: c.id,
                    minQuantity: minQty,
                    maxQuantity: maxQty,
                    discountPercent,
                    fixedPrice,
                  },
                });
              }
                summary.moqOverridesApplied += 1;
              }
            }
          }
        }
      },
      { maxWait: 20000, timeout: 60000 }
    );
  }

  return summary;
}

export async function exportProductVariantsSpreadsheet(productId: string, variantIds?: string[]) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: {
      defaultCountry: true,
      defaultCurrency: true,
    },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const productAttributeMappings = await listProductAttributes(productId);

  const productBasePrices = await prisma.productPrice.findMany({
    where: {
      productId,
      variantId: null,
      deletedAt: null,
    },
    include: {
      currency: true,
      country: true,
    },
  });

  const defaultProductBasePrice =
    (product.defaultCountryId
      ? productBasePrices.find((p) => p.countryId === product.defaultCountryId)
      : null) ||
    productBasePrices.find((p) => p.country?.name === "United States" || p.currency?.code === "USD") ||
    productBasePrices[0];

  const where: Prisma.ProductVariantWhereInput = {
    productId,
    deletedAt: null,
    status: { not: "INACTIVE" },
  };

  if (Array.isArray(variantIds) && variantIds.length > 0) {
    where.id = { in: variantIds };
    delete (where as any).status;
  }

  const variants = await prisma.productVariant.findMany({
    where,
    orderBy: [{ title: "asc" }, { sku: "asc" }],
    include: {
      attributeValues: {
        include: {
          attribute: true,
          attributeValue: true,
        },
      },
      inventories: true,
      prices: {
        where: { deletedAt: null },
        include: { currency: true, country: true },
      },
    },
  });

  const columns: { key: string; header: string }[] = [
    { key: "Product", header: "Product" },
    { key: "SKU", header: "SKU" },
    { key: "Stock", header: "Stock" },
    { key: "Low Stock", header: "Low Stock" },
    { key: "Price", header: "Price" },
    { key: "MRP", header: "MRP" },
    { key: "Status", header: "Status" },
  ];

  for (const mapping of productAttributeMappings) {
    columns.push({ key: mapping.attribute.name, header: mapping.attribute.name });
  }

  const rows = variants.map((variant) => {
    const totalStock = variant.inventories.reduce((sum, inv) => sum + (inv.stock || 0), 0);
    const lowStock = variant.inventories[0]?.lowStockThreshold ?? 10;

    const directPriceObj =
      (product.defaultCountryId ? variant.prices.find((p) => p.countryId === product.defaultCountryId) : null) ||
      variant.prices[0];
    const effectivePriceObj = directPriceObj || defaultProductBasePrice;
    const price = effectivePriceObj ? Number(effectivePriceObj.sellingPrice) : 0;
    const mrp = effectivePriceObj?.mrp ? Number(effectivePriceObj.mrp) : price;

    const rowObj: Record<string, any> = {
      Product: product.title,
      SKU: variant.sku || "",
      Stock: totalStock,
      "Low Stock": lowStock,
      Price: price,
      MRP: mrp,
      Status: variant.status,
    };

    const attrValuesMap = new Map<string, string[]>();
    for (const av of variant.attributeValues) {
      if (av.attribute && av.attributeValue) {
        const key = av.attribute.name.toLowerCase();
        const existing = attrValuesMap.get(key) || [];
        existing.push(av.attributeValue.value);
        attrValuesMap.set(key, existing);
      }
    }

    for (const mapping of productAttributeMappings) {
      const values = attrValuesMap.get(mapping.attribute.name.toLowerCase()) || [];
      rowObj[mapping.attribute.name] = values.join(", ");
    }

    return rowObj;
  });

  const buffer = writeSpreadsheetBuffer(rows, "Variants", columns);
  const sanitizedTitle = (product.slug || product.title || "product").toLowerCase().replace(/[^a-z0-9_-]/g, "-");
  const filename = `${sanitizedTitle}-variants-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return { buffer, filename };
}

export async function bulkPermanentDeleteProducts(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const prod = await prisma.product.findUnique({
        where: { id },
        select: { id: true, title: true },
      });
      if (!prod) {
        blocked.push({ id, name: id, reason: "Product not found." });
        continue;
      }
      await permanentDeleteProduct(id);
      deletedIds.push(id);
    } catch (error: any) {
      const prod = await prisma.product.findUnique({
        where: { id },
        select: { title: true },
      });
      blocked.push({
        id,
        name: prod?.title || id,
        reason: error?.message || "Failed to permanently delete product.",
      });
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}

export async function bulkPermanentDeleteVariants(ids: string[]) {
  const deletedIds: string[] = [];
  const blocked: Array<{ id: string; name: string; reason: string }> = [];

  for (const id of ids) {
    try {
      const v = await prisma.productVariant.findUnique({
        where: { id },
        select: { id: true, productId: true, title: true, sku: true },
      });
      if (!v) {
        blocked.push({ id, name: id, reason: "Variant not found." });
        continue;
      }
      await permanentDeleteVariant(v.productId, v.id);
      deletedIds.push(id);
    } catch (error: any) {
      const v = await prisma.productVariant.findUnique({
        where: { id },
        select: { title: true, sku: true },
      });
      blocked.push({
        id,
        name: v ? `${v.title} (${v.sku || "No SKU"})` : id,
        reason: error?.message || "Failed to permanently delete variant.",
      });
    }
  }

  return {
    deletedCount: deletedIds.length,
    blockedCount: blocked.length,
    deletedIds,
    blocked,
  };
}
