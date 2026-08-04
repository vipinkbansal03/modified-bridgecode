import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";
import { readSpreadsheetRows, removeTempFile, writeSpreadsheetBuffer } from "../../utils/spreadsheet";
import type { Prisma } from "@prisma/client";
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

function generateProductSku(title: string): string {
  const base = slugify(title).toUpperCase();
  return base ? `MO-${base}` : "";
}

async function syncStorefrontVisibility(tx: Prisma.TransactionClient, productId: string, status: string | null | undefined, previousStatus?: string | null) {
  const nextStatus = String(status ?? previousStatus ?? "DRAFT").toUpperCase();
  if (!shouldSyncStorefrontVisibility(nextStatus, previousStatus)) return;

  const countries = await tx.country.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  if (!countries.length) return;

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

async function syncVariantsStorefrontVisibility(variantIds: string[], productId: string) {
  const uniqueVariantIds = Array.from(new Set(variantIds));
  if (!uniqueVariantIds.length) return;
  const productCountries = await prisma.productCountry.findMany({
    where: { productId, enabled: true, country: { status: "ACTIVE" } },
    select: { countryId: true },
  });

  await prisma.variantCountry.createMany({
    data: uniqueVariantIds.flatMap((variantId) =>
      productCountries.map(({ countryId }) => ({ variantId, countryId, enabled: true })),
    ),
    skipDuplicates: true,
  });
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
};

type ProductSpecInput = {
  label: string;
  value: string;
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
  highlights?: ProductHighlightInput[];
  technicalSpecs?: ProductSpecInput[];
  warranty?: string[];
  primaryFeatures?: ProductHighlightInput[];
  packageWeight?: number | string | null;
  packageLength?: number | string | null;
  packageWidth?: number | string | null;
  packageHeight?: number | string | null;
  shippingClass?: string | null;
  fragile?: boolean;
  hazardous?: boolean;
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
};

type ProductImportRow = {
  title: string;
  sku?: string | null;
  productCode?: string | null;
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
    .split(/[;,|]/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function parseProductImportRow(raw: Record<string, string>): ProductImportRow {
  return {
    title: raw.title?.trim() || "",
    sku: raw.sku?.trim() || null,
    productCode: raw.productCode?.trim() || null,
    categorySlug: raw.categorySlug?.trim() || null,
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
  action?: "delete" | "archive" | "restore";
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
}): Prisma.ProductWhereInput {
  return {
    deletedAt: null,
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
  return {
    product: { deletedAt: null },
    ...(query.productId && { productId: query.productId }),
    ...(query.status && { status: query.status as never }),
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
    case "updatedAt":
      return [{ updatedAt: sortDir }];
    case "createdAt":
      return [{ createdAt: sortDir }];
    default:
      return [{ updatedAt: "desc" }];
  }
}

// ─── List ─────────────────────────────────────────────────

export async function listProducts(query: ProductListQuery) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ProductWhereInput = buildProductWhere(query);

  const sortBy = query.sortBy || "sortOrder";
  const sortDir = query.sortDir === "asc" ? "asc" : "desc";
  const orderBy: Prisma.ProductOrderByWithRelationInput[] =
    sortBy === "title"
      ? [{ title: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "sku"
      ? [{ sku: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "brand"
      ? [{ brand: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "status"
      ? [{ status: sortDir as Prisma.SortOrder }, { createdAt: "desc" }]
      : sortBy === "updatedAt"
      ? [{ updatedAt: sortDir as Prisma.SortOrder }]
      : sortBy === "category"
      ? [{ category: { name: sortDir as Prisma.SortOrder } }, { createdAt: "desc" }]
      : [{ sortOrder: "asc" }, { createdAt: "desc" }];

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy,
      include: {
        category: { select: { id: true, name: true, slug: true, status: true } },
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
        countries: { where: { enabled: true }, select: { countryId: true } },
        inventories: { select: { stock: true, reservedStock: true } },
        prices: {
          where: { status: "ACTIVE", variantId: null },
          orderBy: [{ sellingPrice: "asc" }],
          take: 1,
          include: { country: true, currency: true },
        },
        _count: { select: { variants: true, collections: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);

  return { data, total, page, limit };
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
            media: { orderBy: { sortOrder: "asc" }, take: 1, select: { url: true, altText: true } },
          },
        },
        package: { select: { id: true, title: true } },
        countries: { where: { enabled: true }, select: { countryId: true } },
        inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
        prices: {
          where: { status: "ACTIVE" },
          orderBy: [{ sellingPrice: "asc" }],
          take: 1,
          include: { currency: true, country: true },
        },
        _count: { select: { attributeValues: true, countries: true, prices: true } },
      },
    }),
    prisma.productVariant.count({ where }),
  ]);

  return { data, total, page, limit };
}

// ─── Get one ─────────────────────────────────────────────

export async function getProduct(id: string) {
  const product = await prisma.product.findUnique({
    where: { id, deletedAt: null },
    include: {
      category: true,
      media: { orderBy: { sortOrder: "asc" } },
      packages: { where: { status: "ACTIVE" }, orderBy: { sortOrder: "asc" } },
      attributes: {
        include: {
          attribute: {
            include: {
              values: {
                where: { status: "ACTIVE" },
                orderBy: { sortOrder: "asc" },
              },
            },
          },
          allowedValues: {
            include: { attributeValue: true },
            orderBy: { attributeValue: { sortOrder: "asc" } },
          },
        },
      },
      variants: {
        where: { status: { not: "INACTIVE" } },
        include: {
          package: true,
          attributeValues: {
            include: { attribute: true, attributeValue: true },
          },
          prices: { include: { country: true, currency: true } },
          inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
        },
      },
      inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
      prices: { include: { country: true, currency: true, variant: true } },
      translations: { include: { language: true } },
    },
  });
  if (!product) throw new AppError("Product not found.", 404);
  return product;
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

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.create({
      data: {
        ...data,
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
}

// ─── Update ───────────────────────────────────────────────

export async function updateProduct(id: string, data: Partial<ProductInput>) {
  const existing = await getProduct(id); // Throws 404 if not found
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

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: updateData as Prisma.ProductUpdateInput });
    await syncStorefrontVisibility(tx, product.id, product.status, existing.status);
    return product;
  });
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

// ─── Soft delete ─────────────────────────────────────────

export async function deleteProduct(id: string) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function archiveProduct(id: string) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: { status: "ARCHIVED" } });
}

export async function restoreProduct(id: string) {
  const existing = await getProduct(id);
  return prisma.$transaction(async (tx) => {
    const product = await tx.product.update({ where: { id }, data: { status: "ACTIVE", deletedAt: null } });
    await syncStorefrontVisibility(tx, product.id, product.status, existing.status);
    return product;
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
      prices: { include: { country: true, currency: true } },
      variants: {
        where: { status: { not: "INACTIVE" } },
        include: {
          attributeValues: true,
          countries: true,
          inventories: { include: { country: true, warehouse: { include: { country: true } } }, orderBy: [{ countryId: "asc" }] },
          prices: { include: { country: true, currency: true } },
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
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
        countries: { where: { enabled: true }, select: { countryId: true } },
        inventories: { select: { stock: true, reservedStock: true } },
        prices: { where: { status: "ACTIVE", variantId: null }, orderBy: [{ sellingPrice: "asc" }], take: 1, include: { country: true, currency: true } },
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
      media: { orderBy: { sortOrder: "asc" }, take: 1 },
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
}) {
  const ids = Array.from(new Set(data.ids ?? []));
  if (!ids.length) throw new AppError("Select at least one product.", 400);

  const products = await prisma.product.findMany({ where: { id: { in: ids }, deletedAt: null }, select: { id: true } });
  if (products.length !== ids.length) throw new AppError("One or more selected products were not found.", 400);

  if (data.action === "delete") {
    const activeOrderItemCount = await prisma.orderItem.count({
      where: {
        productId: { in: ids },
        order: { status: { not: "CANCELLED" } },
      },
    });
    if (activeOrderItemCount > 0) throw new AppError("Cannot delete selected products because active orders reference them.", 400);
    await prisma.product.updateMany({ where: { id: { in: ids } }, data: { deletedAt: new Date() } });
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

    await prisma.$transaction(async (tx) => {
      for (const productId of ids) {
        const existing = await tx.inventory.findFirst({
          where: { productId, variantId: null, warehouseId: data.warehouseId },
        });
        if (!existing) {
          await tx.inventory.create({
            data: {
              productId,
              variantId: null,
              warehouseId: data.warehouseId!,
              stock: 0,
            },
          });
        }
      }
    });
    return { updated: ids.length };
  }

  throw new AppError("Unsupported bulk action.", 400);
}

export async function listProductCountries(productId: string) {
  await getProduct(productId);
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
  const product = await getProduct(productId);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);
  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.productCountry.upsert({
        where: { productId_countryId: { productId, countryId: item.countryId } },
        update: { enabled: Boolean(item.enabled) },
        create: { productId, countryId: item.countryId, enabled: Boolean(item.enabled) },
      }),
    ),
  );

  const enabledCountryIds = items.filter((item) => item.enabled).map((item) => item.countryId);
  if (enabledCountryIds.length) {
    // Storefront requires the category to be enabled for the same country, or the product stays hidden.
    if (product.categoryId) {
      await prisma.$transaction(
        enabledCountryIds.map((countryId) =>
          prisma.categoryCountry.upsert({
            where: { categoryId_countryId: { categoryId: product.categoryId, countryId } },
            update: { enabled: true },
            create: { categoryId: product.categoryId, countryId, enabled: true },
          }),
        ),
      );
    }

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
  if (!variantIds.length) return;

  const enabledCountries = await prisma.productCountry.findMany({
    where: { productId, enabled: true },
    select: { countryId: true },
  });

  if (!enabledCountries.length) return;

  await prisma.$transaction(
    variantIds.flatMap((variantId) =>
      enabledCountries.map((country) =>
        prisma.variantCountry.upsert({
          where: { variantId_countryId: { variantId, countryId: country.countryId } },
          update: { enabled: true },
          create: { variantId, countryId: country.countryId, enabled: true },
        }),
      ),
    ),
  );
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
  await getProduct(productId);
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
  altTexts: string[]
) {
  await getProduct(productId);
  
  if (!files || !files.length) {
    return [];
  }

  const results = await Promise.all(
    files.map((file) => uploadFile(file.path, `modortho/products/${productId}`))
  );

  const mediaRecords = results.map((r, i) => ({
    productId,
    url: r.url,
    publicId: r.publicId,
    storageProvider: r.storageProvider,
    altText: altTexts[i] || "",
    type: files[i].mimetype.startsWith("image") ? ("IMAGE" as const) : ("PDF" as const),
    sortOrder: i,
  }));

  return prisma.productMedia.createMany({ data: mediaRecords });
}

// ─── Delete product media ─────────────────────────────────

export async function deleteProductMedia(mediaId: string) {
  const media = await prisma.productMedia.findUnique({ where: { id: mediaId } });
  if (!media) throw new AppError("Media not found.", 404);
  await deleteFile(media.publicId || media.url, media.storageProvider);
  return prisma.productMedia.delete({ where: { id: mediaId } });
}

// ─── Assign attributes to product ────────────────────────

export async function assignAttributes(
  productId: string,
  attributes: { attributeId: string; required: boolean; gridAxis?: "ROW" | "COLUMN" | null; allowedValueIds?: string[] }[]
) {
  await getProduct(productId);
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

    const created = [];
    for (const attributeConfig of attributes) {
      const productAttribute = await tx.productAttribute.create({
        data: {
          productId,
          attributeId: attributeConfig.attributeId,
          required: Boolean(attributeConfig.required),
          gridAxis: attributeConfig.gridAxis ?? null,
        },
      });

      const uniqueAllowedValueIds = Array.from(new Set(attributeConfig.allowedValueIds ?? []));
      if (uniqueAllowedValueIds.length) {
        await tx.productAttributeValueSelection.createMany({
          data: uniqueAllowedValueIds.map((attributeValueId) => ({
            productAttributeId: productAttribute.id,
            attributeValueId,
          })),
        });
      }

      created.push(productAttribute);
    }

    return created;
  });
}

export async function listProductAttributes(productId: string) {
  await getProduct(productId);
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
  await getProduct(productId);
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
    .filter((inventory) => !inventory.variantId)
    .map((inventory) => ({
      countryId: inventory.countryId,
      stock: inventory.stock,
      reservedStock: inventory.reservedStock,
      lowStockThreshold: inventory.lowStockThreshold,
      status: inventory.status,
    }));
  const inventoryTemplates = productInventoryTemplates.length
    ? productInventoryTemplates
    : [{ countryId: null, stock: 0, reservedStock: 0, lowStockThreshold: 10, status: "OUT_OF_STOCK" as const }];

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
        attributeValueIds: mapping.allowedValues.map((allowedValue) => allowedValue.attributeValueId),
      }));
    }

    const mappedAttributeById = new Map(productAttributeMappings.map((mapping) => [mapping.attributeId, mapping]));
    const mappedRequiredAttributeIds = productAttributeMappings
      .filter((mapping) => mapping.required)
      .map((mapping) => mapping.attributeId);
    const requestedAttributeIds = new Set(attributeGroups.map((group) => group.attributeId));

    const missingRequired = mappedRequiredAttributeIds.find((attributeId) => !requestedAttributeIds.has(attributeId));
    if (missingRequired) {
      const mapping = mappedAttributeById.get(missingRequired);
      throw new AppError(
        `Include required mapped attribute "${mapping?.attribute.name ?? missingRequired}" before generating variants.`,
        400,
      );
    }

    for (const group of attributeGroups) {
      const mapping = mappedAttributeById.get(group.attributeId);
      if (!mapping) {
        throw new AppError(
          "This product has attribute mappings. Add the attribute to Product Attributes before using it for variant generation.",
          400,
        );
      }

      const allowedValueIds = new Set(mapping.allowedValues.map((allowedValue) => allowedValue.attributeValueId));
      const unmappedValue = group.attributeValueIds.find((attributeValueId) => !allowedValueIds.has(attributeValueId));
      if (unmappedValue) {
        throw new AppError(
          `Value "${unmappedValue}" is not mapped for "${mapping.attribute.name}". Add it to Product Attributes before generating variants.`,
          400,
        );
      }
    }
  }

  if (!attributeGroups.length) throw new AppError("Select attribute values before generating variants.", 400);

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

  const createdVariants = await Promise.all(
    combos.flatMap((combo) =>
      packages.map(async (pkg) => {
        const variantKey = buildVariantKey(combo.map((v) => v.id), pkg?.id);
        const title = buildVariantTitle(combo, pkg?.title);
        const existing = await prisma.productVariant.findFirst({ where: { productId, variantKey } });
        if (existing) {
          const wasInactive = existing.status === "INACTIVE";
          const restored = wasInactive
            ? await prisma.productVariant.update({ where: { id: existing.id }, data: { status: "ACTIVE" } })
            : existing;
          const existingInventories = await prisma.inventory.findMany({
            where: { variantId: existing.id },
            select: { id: true, countryId: true },
          });
          const inventoryByCountry = new Map(existingInventories.map((inventory) => [inventory.countryId ?? "__base__", inventory]));
          await prisma.$transaction(
            inventoryTemplates.map((template) => {
              const matchingInventory = inventoryByCountry.get(template.countryId ?? "__base__");
              return matchingInventory
                ? prisma.inventory.update({
                    where: { id: matchingInventory.id },
                    data: {
                      stock: template.stock,
                      reservedStock: template.reservedStock,
                      lowStockThreshold: template.lowStockThreshold,
                      status: template.status,
                    },
                  })
                : prisma.inventory.create({
                    data: { productId, variantId: existing.id, ...template },
                  });
            }),
          );
          return { variant: restored, isNew: false, isRestored: wasInactive };
        }

        const variant = await prisma.productVariant.create({
          data: {
            productId,
            packageId: pkg?.id ?? null,
            title,
            variantKey,
            sku: buildGeneratedVariantSku(product, variantKey),
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

        await prisma.productVariantAttributeValue.createMany({
          data: combo.map((v) => ({
            variantId: variant.id,
            attributeId: v.attributeId,
            attributeValueId: v.id,
          })),
        });

        await prisma.inventory.createMany({
          data: inventoryTemplates.map((template) => ({ productId, variantId: variant.id, ...template })),
        });

        return { variant, isNew: true, isRestored: false };
      })
    )
  );

  const activeVariantIds = createdVariants
    .filter((v) => v.variant.status === "ACTIVE")
    .map((v) => v.variant.id);

  await syncVariantsStorefrontVisibility(activeVariantIds, productId);
  await syncVariantCountriesFromProduct(productId, createdVariants.map((v) => v.variant.id));

  const newCount = createdVariants.filter((v) => v.isNew).length;
  const restoredCount = createdVariants.filter((v) => v.isRestored).length;
  const totalCount = createdVariants.length;

  const result: any = createdVariants.map((v) => v.variant);
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
  const variantKey = buildVariantKey(values.map((value) => value.id), data.packageId);
  const title = buildVariantTitle(values, pkg?.title, data.title);

  const existing = await prisma.productVariant.findFirst({ where: { productId, variantKey } });
  if (existing) throw new AppError("A variant with this configuration already exists.", 409);

  const variant = await prisma.productVariant.create({
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

  await prisma.productVariantAttributeValue.createMany({
    data: values.map((value) => ({
      variantId: variant.id,
      attributeId: value.attributeId,
      attributeValueId: value.id,
    })),
  });

  await prisma.inventory.create({
    data: { productId, variantId: variant.id, stock: 0 },
  });

  if (variant.status === "ACTIVE") {
    await syncVariantStorefrontVisibility(variant.id, productId);
  }
  await syncVariantCountriesFromProduct(productId, [variant.id]);

  return getVariant(productId, variant.id);
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
  const nextVariantKey = buildVariantKey(values.map((value) => value.id), nextPackageId);
  const duplicate = await prisma.productVariant.findFirst({
    where: { productId, variantKey: nextVariantKey, NOT: { id: variantId } },
  });
  if (duplicate) throw new AppError("A variant with this configuration already exists.", 409);
  const updateData: Prisma.ProductVariantUncheckedUpdateInput = {
    ...(data.packageId !== undefined ? { packageId: data.packageId || null } : {}),
    ...(data.sku !== undefined ? { sku: data.sku } : {}),
    title: buildVariantTitle(values, pkg?.title, data.title !== undefined ? data.title : existingVariant.title),
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
  await prisma.productVariant.update({
    where: { id: variantId },
    data: updateData,
  });

  if (data.attributeValueIds?.length) {
    await prisma.productVariantAttributeValue.deleteMany({ where: { variantId } });
    await prisma.productVariantAttributeValue.createMany({
      data: values.map((value) => ({
        variantId,
        attributeId: value.attributeId,
        attributeValueId: value.id,
      })),
    });
  }

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
    action?: "delete" | "archive" | "restore";
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
        if (!["delete", "archive", "restore"].includes(update.action)) throw new Error("Unsupported bulk variant action.");
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
        if (!country) throw new Error("Selected country was not found.");
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
          data: { status: row.action === "restore" ? "ACTIVE" : "INACTIVE" },
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
  await getProduct(productId);
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
        where: { countryId },
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
    data: { status: "INACTIVE" },
  });
}

export async function archiveVariant(productId: string, variantId: string) {
  await getVariant(productId, variantId);
  return prisma.productVariant.update({
    where: { id: variantId },
    data: { status: "INACTIVE" },
  });
}

export async function restoreVariant(productId: string, variantId: string) {
  await getVariant(productId, variantId);
  const variant = await prisma.productVariant.update({
    where: { id: variantId },
    data: { status: "ACTIVE" },
  });
  await syncVariantStorefrontVisibility(variant.id, productId);
  return variant;
}

export async function cloneVariant(productId: string, variantId: string) {
  const source = await getVariant(productId, variantId);
  const cloneSuffix = Date.now().toString().slice(-6);
  const clone = await prisma.productVariant.create({
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

  await prisma.productVariantAttributeValue.createMany({
    data: source.attributeValues.map((value) => ({
      variantId: clone.id,
      attributeId: value.attributeId,
      attributeValueId: value.attributeValueId,
    })),
  });

  const baseInventory = source.inventories.find((inventory) => !inventory.countryId);
  await prisma.inventory.create({
    data: { productId, variantId: clone.id, stock: baseInventory?.stock ?? 0, lowStockThreshold: baseInventory?.lowStockThreshold ?? 10 },
  });

  return getVariant(productId, clone.id);
}

export async function getVariant(productId: string, variantId: string) {
  const variant = await prisma.productVariant.findFirst({
    where: { id: variantId, productId },
    include: {
      package: true,
      attributeValues: { include: { attribute: true, attributeValue: true } },
      prices: { include: { country: true, currency: true } },
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
  await getProduct(productId);
  return prisma.tierPricing.findMany({
    where: { productId },
    include: { tier: true, country: true, variant: true },
    orderBy: [{ tier: { sortOrder: "asc" } }, { country: { sortOrder: "asc" } }, { createdAt: "desc" }],
  });
}

export async function createTierPricing(productId: string, data: PricingRuleInput) {
  await getProduct(productId);
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
  if (existing) throw new AppError("A tier pricing rule already exists for this combination.", 409);

  return prisma.tierPricing.create({
    data: { productId, tierId: data.tierId, countryId: data.countryId, variantId: data.variantId || null, ...rule },
    include: { tier: true, country: true, variant: true },
  });
}

export async function updateTierPricing(productId: string, ruleId: string, data: PricingRuleInput) {
  await getProduct(productId);
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
    where: { productId, tierId, countryId, variantId, NOT: { id: ruleId } },
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
  await prisma.tierPricing.delete({ where: { id: ruleId } });
}

export async function listMoqPricing(productId: string) {
  await getProduct(productId);
  return prisma.moqPricing.findMany({
    where: { productId },
    include: { country: true, variant: true },
    orderBy: [{ minQuantity: "asc" }, { country: { sortOrder: "asc" } }, { createdAt: "desc" }],
  });
}

export async function createMoqPricing(productId: string, data: PricingRuleInput) {
  await getProduct(productId);
  if (!data.countryId) throw new AppError("Country is required.", 400);
  const minQuantity = Number(data.minQuantity);
  if (!Number.isInteger(minQuantity) || minQuantity < 1) throw new AppError("Minimum quantity must be at least 1.", 400);
  const rule = normalizeExclusivePriceRule(data);
  await ensureVariantBelongsToProduct(productId, data.variantId);

  const country = await prisma.country.findUnique({ where: { id: data.countryId } });
  if (!country) throw new AppError("Country not found.", 404);

  const existing = await prisma.moqPricing.findFirst({
    where: { productId, countryId: data.countryId, variantId: data.variantId || null, minQuantity },
  });
  if (existing) throw new AppError("An MOQ pricing rule already exists for this combination.", 409);

  return prisma.moqPricing.create({
    data: { productId, countryId: data.countryId, variantId: data.variantId || null, minQuantity, ...rule },
    include: { country: true, variant: true },
  });
}

export async function updateMoqPricing(productId: string, ruleId: string, data: PricingRuleInput) {
  await getProduct(productId);
  const existing = await prisma.moqPricing.findFirst({ where: { id: ruleId, productId } });
  if (!existing) throw new AppError("MOQ pricing rule not found.", 404);

  const countryId = data.countryId ?? existing.countryId;
  const variantId = data.variantId === undefined ? existing.variantId : data.variantId || null;
  const minQuantity = data.minQuantity === undefined ? existing.minQuantity : Number(data.minQuantity);
  if (!Number.isInteger(minQuantity) || minQuantity < 1) throw new AppError("Minimum quantity must be at least 1.", 400);
  const rule = normalizeExclusivePriceRule({
    discountPercent: data.discountPercent ?? existing.discountPercent,
    fixedPrice: data.fixedPrice ?? existing.fixedPrice,
  });
  await ensureVariantBelongsToProduct(productId, variantId);

  const duplicate = await prisma.moqPricing.findFirst({
    where: { productId, countryId, variantId, minQuantity, NOT: { id: ruleId } },
  });
  if (duplicate) throw new AppError("An MOQ pricing rule already exists for this combination.", 409);

  return prisma.moqPricing.update({
    where: { id: ruleId },
    data: { countryId, variantId, minQuantity, ...rule },
    include: { country: true, variant: true },
  });
}

export async function deleteMoqPricing(productId: string, ruleId: string) {
  const existing = await prisma.moqPricing.findFirst({ where: { id: ruleId, productId } });
  if (!existing) throw new AppError("MOQ pricing rule not found.", 404);
  await prisma.moqPricing.delete({ where: { id: ruleId } });
}

const PRODUCT_EXPORT_COLUMNS = [
  { key: "title", header: "title" },
  { key: "sku", header: "sku" },
  { key: "productCode", header: "productCode" },
  { key: "categorySlug", header: "categorySlug" },
  { key: "brand", header: "brand" },
  { key: "status", header: "status" },
  { key: "sortOrder", header: "sortOrder" },
  { key: "isFeatured", header: "isFeatured" },
  { key: "hasVariants", header: "hasVariants" },
  { key: "shortDescription", header: "shortDescription" },
  { key: "description", header: "description" },
  { key: "seoTitle", header: "seoTitle" },
  { key: "seoDescription", header: "seoDescription" },
  { key: "seoKeywords", header: "seoKeywords" },
  { key: "countryCodes", header: "countryCodes" },
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
    if (!row.categorySlug) issues.push({ row: rowNumber, field: "categorySlug", message: "Category slug is required." });
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
    row.countryCodes?.forEach((code) => countryCodes.add(code));
  }

  const [categories, countries, existingProducts] = await Promise.all([
    prisma.category.findMany({ where: { slug: { in: Array.from(categorySlugs) }, deletedAt: null }, select: { id: true, slug: true, status: true } }),
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

  const categoryBySlug = new Map(categories.map((category) => [category.slug, category]));
  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const productBySku = new Map(existingProducts.filter((product) => product.sku).map((product) => [product.sku as string, product]));
  const productByCode = new Map(existingProducts.filter((product) => product.productCode).map((product) => [product.productCode as string, product]));

  for (const [index, row] of parsedRows.entries()) {
    const rowNumber = index + 2;
    const category = row.categorySlug ? categoryBySlug.get(row.categorySlug) : null;
    if (!category) {
      issues.push({ row: rowNumber, field: "categorySlug", message: `Category '${row.categorySlug || ""}' was not found.` });
    } else if (category.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "categorySlug", message: `Category '${row.categorySlug}' is inactive.` });
    }

    for (const code of row.countryCodes ?? []) {
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
  const rows = readSpreadsheetRows(filePath);
  const preview = await getProductSpreadsheetPreview(rows);
  const sampleRows = preview.rows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row }));
  return {
    totalRows: preview.rows.length,
    validRows: Math.max(0, preview.rows.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows,
  } satisfies SpreadsheetPreviewResult;
}

function buildProductExportRow(product: {
  title: string;
  sku: string | null;
  productCode: string | null;
  brand: string;
  status: string;
  sortOrder: number;
  isFeatured: boolean;
  hasVariants: boolean;
  shortDescription: string | null;
  description: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  category: { slug: string };
  countries: { country: { code: string } }[];
}) {
  return {
    title: product.title,
    sku: product.sku ?? "",
    productCode: product.productCode ?? "",
    categorySlug: product.category.slug,
    brand: product.brand,
    status: product.status,
    sortOrder: product.sortOrder,
    isFeatured: product.isFeatured ? "TRUE" : "FALSE",
    hasVariants: product.hasVariants ? "TRUE" : "FALSE",
    shortDescription: product.shortDescription ?? "",
    description: product.description ?? "",
    seoTitle: product.seoTitle ?? "",
    seoDescription: product.seoDescription ?? "",
    seoKeywords: product.seoKeywords ?? "",
    countryCodes: product.countries.map((country) => country.country.code).join(", "),
  };
}

export async function exportProductsSpreadsheet(query: ProductListQuery) {
  const products = await prisma.product.findMany({
    where: buildProductWhere(query),
    orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
    include: {
      category: { select: { slug: true } },
      countries: { where: { enabled: true }, include: { country: { select: { code: true } } } },
    },
  });

  return writeSpreadsheetBuffer(
    products.map(buildProductExportRow),
    "Products",
    PRODUCT_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

async function syncProductCountries(tx: Prisma.TransactionClient, productId: string, countryCodes: string[]) {
  if (!countryCodes.length) return;
  const countries = await tx.country.findMany({ where: { code: { in: countryCodes } }, select: { id: true, code: true } });
  if (countries.length !== countryCodes.length) throw new AppError("One or more countries were not found.", 400);
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

export async function importProductsSpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await getProductSpreadsheetPreview(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const parsedRows = preview.rows;
  const summary = { created: 0, updated: 0 };
  const suffix = Date.now().toString().slice(-6);

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of parsedRows.entries()) {
      const category = row.categorySlug ? preview.categoryBySlug.get(row.categorySlug) : null;
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
          },
        });
        if (row.countryCodes?.length) await syncProductCountries(tx, existing.id, row.countryCodes);
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
          },
        });
        if (row.countryCodes?.length) await syncProductCountries(tx, product.id, row.countryCodes);
        summary.created += 1;
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

export async function previewVariantsImport(productId: string, filePath: string) {
  const product = await getProduct(productId);
  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  const productAttributeMappings = await listProductAttributes(productId);
  const rows = readSpreadsheetRows(filePath);

  const parsedRows: any[] = [];
  const skuSet = new Set<string>();

  for (const [index, row] of rows.entries()) {
    const rawSku = row["SKU"] || row["sku"] || "";
    const sku = rawSku.trim();

    const rawStock = row["Stock"] || row["Stock Level"] || row["stock"] || "0";
    const stock = parseInt(rawStock);

    const rawLowStock = row["Low Stock"] || row["Low Stock Threshold"] || row["lowStock"] || "10";
    const lowStockThreshold = parseInt(rawLowStock);

    const rawPrice = row["Price"] || row["Selling Price"] || row["Base Price"] || row["price"] || "0";
    const price = parseFloat(rawPrice);

    const rawMRP = row["MRP"] || row["mrp"] || rawPrice || "0";
    const mrp = parseFloat(rawMRP);

    const rawStatus = row["Status"] || row["status"] || "ACTIVE";
    const status = rawStatus.trim().toUpperCase() === "INACTIVE" ? "INACTIVE" : "ACTIVE";

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
      let cellValue = "";
      for (const key of Object.keys(row)) {
        const normalizedKey = key.toLowerCase();
        if (
          normalizedKey === mapping.attribute.name.toLowerCase() ||
          normalizedKey === `attr: ${mapping.attribute.name.toLowerCase()}` ||
          normalizedKey === `attribute: ${mapping.attribute.name.toLowerCase()}`
        ) {
          cellValue = row[key].trim();
          break;
        }
      }

      if (!cellValue) {
        if (mapping.required) {
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
    const variantTitle = attrValuesText || `Variant ${sku}`;

    parsedRows.push({
      rowNumber: index + 2,
      sku,
      variantTitle,
      stock: isNaN(stock) ? 0 : stock,
      lowStockThreshold: isNaN(lowStockThreshold) ? 10 : lowStockThreshold,
      price: isNaN(price) ? 0 : price,
      mrp: isNaN(mrp) ? 0 : mrp,
      status,
      attributeValues,
      isValid: errors.length === 0,
      errors,
    });
  }

  const validRowsCount = parsedRows.filter((r) => r.isValid).length;
  return {
    totalRows: parsedRows.length,
    validRows: validRowsCount,
    invalidRows: parsedRows.length - validRowsCount,
    rows: parsedRows,
  };
}

export async function executeVariantsImport(productId: string, rows: any[]) {
  const product = await getProduct(productId);
  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  const productCountries = await prisma.productCountry.findMany({
    where: { productId, enabled: true },
    select: { countryId: true },
  });

  const baseCurrency =
    (await prisma.currency.findFirst({ where: { isBase: true } })) ||
    (await prisma.currency.findFirst({ where: { code: "USD" } })) ||
    (await prisma.currency.findFirst());
  if (!baseCurrency) throw new AppError("Base currency not configured.", 400);

  const summary = { created: 0, updated: 0 };

  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const normalizedSku = row.sku?.trim();
      if (!normalizedSku) continue;

      const existingVariant = await tx.productVariant.findFirst({
        where: { productId, sku: normalizedSku },
      });

      let variantId = "";

      if (existingVariant) {
        await tx.productVariant.update({
          where: { id: existingVariant.id },
          data: {
            status: row.status || existingVariant.status,
          },
        });
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

  const duplicateKeyVariant = await tx.productVariant.findFirst({
    where: { productId, variantKey },
  });

  if (duplicateKeyVariant) {
    await tx.productVariant.update({
      where: { id: duplicateKeyVariant.id },
      data: {
        sku: normalizedSku,
        status: row.status || duplicateKeyVariant.status,
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

    summary.created += 1;
  }
}

      const existingInventory = await tx.inventory.findFirst({
        where: { variantId, countryId: null },
      });

      if (existingInventory) {
        await tx.inventory.update({
          where: { id: existingInventory.id },
          data: {
            stock: row.stock ?? existingInventory.stock,
            lowStockThreshold: row.lowStockThreshold ?? existingInventory.lowStockThreshold,
          },
        });
      } else {
        await tx.inventory.create({
          data: {
            productId,
            variantId,
            countryId: null,
            stock: row.stock ?? 0,
            lowStockThreshold: row.lowStockThreshold ?? 10,
            status: (row.stock ?? 0) > 0 ? "IN_STOCK" : "OUT_OF_STOCK",
          },
        });
      }

      const priceCountryId = product.defaultCountryId;

if (!priceCountryId) {
  throw new AppError(
    "Product default country is required before importing variant prices.",
    400
  );
}

const priceCountry = await tx.country.findUnique({
  where: { id: priceCountryId },
  select: {
    id: true,
    currencyId: true,
  },
});

if (!priceCountry) {
  throw new AppError("Product default country was not found.", 400);
}

const existingPrice = await tx.productPrice.findFirst({
  where: {
    productId,
    variantId,
    countryId: priceCountryId,
  },
});

if (existingPrice) {
  await tx.productPrice.update({
    where: { id: existingPrice.id },
    data: {
      mrp: row.mrp ?? existingPrice.mrp,
      sellingPrice:
        row.price ??
        row.sellingPrice ??
        existingPrice.sellingPrice,
    },
  });
} else {
  await tx.productPrice.create({
    data: {
      productId,
      variantId,
      countryId: priceCountryId,
      currencyId: priceCountry.currencyId || baseCurrency.id,
      mrp: row.mrp ?? row.price ?? 0,
      sellingPrice: row.price ?? row.sellingPrice ?? 0,
      status: "ACTIVE",
    },
  });
}

// Automatically sync country visibility from the parent product
for (const pc of productCountries) {
  await tx.variantCountry.upsert({
    where: {
      variantId_countryId: {
        variantId,
        countryId: pc.countryId,
      },
    },
    update: { enabled: true },
    create: {
      variantId,
      countryId: pc.countryId,
      enabled: true,
    },
  });
}
    }
  });

  return summary;
}
