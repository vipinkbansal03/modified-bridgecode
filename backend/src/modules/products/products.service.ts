import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";
import type { Prisma } from "@prisma/client";
import { setVariantStock } from "../inventory/inventory.service";
import { assertTierUsable } from "../tiers/tiers.service";

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

type BulkVariantUpdate = {
  variantId: string;
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

// ─── List ─────────────────────────────────────────────────

export async function listProducts(query: {
  page?: string;
  limit?: string;
  search?: string;
  categoryId?: string;
  status?: string;
}) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.ProductWhereInput = {
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
  };

  const [data, total] = await Promise.all([
    prisma.product.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: {
        category: { select: { id: true, name: true, slug: true } },
        media: { orderBy: { sortOrder: "asc" }, take: 1 },
        _count: { select: { variants: true } },
      },
    }),
    prisma.product.count({ where }),
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
          inventory: true,
        },
      },
      prices: { include: { country: true, currency: true, variant: true } },
      translations: { include: { language: true } },
    },
  });
  if (!product) throw new AppError("Product not found.", 404);
  return product;
}

// ─── Create ───────────────────────────────────────────────

export async function createProduct(data: {
  title: string;
  shortDescription?: string;
  description?: string;
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
}) {
  const slug = slugify(data.title);
  const existing = await prisma.product.findUnique({ where: { slug } });
  const finalSlug = existing ? `${slug}-${Date.now()}` : slug;

  return prisma.product.create({
    data: {
      ...data,
      slug: finalSlug,
      status: (data.status as never) || "DRAFT",
    },
  });
}

// ─── Update ───────────────────────────────────────────────

export async function updateProduct(id: string, data: Partial<ReturnType<typeof createProduct>>) {
  await getProduct(id); // Throws 404 if not found

  const updateData = { ...data } as Record<string, unknown>;
  if (data && typeof data === "object" && "title" in data && data.title) {
    updateData.slug = slugify(data.title as string);
  }
  return prisma.product.update({ where: { id }, data: updateData });
}

// ─── Soft delete ─────────────────────────────────────────

export async function deleteProduct(id: string) {
  await getProduct(id);
  return prisma.product.update({ where: { id }, data: { deletedAt: new Date() } });
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
  action?: "delete" | "enable" | "disable" | "assignCategory" | "assignCountries";
  categoryId?: string;
  countryIds?: string[];
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
    await prisma.product.updateMany({
      where: { id: { in: ids } },
      data: { status: data.action === "enable" ? "ACTIVE" : "INACTIVE" },
    });
    return { updated: ids.length };
  }

  if (data.action === "assignCategory") {
    if (!data.categoryId) throw new AppError("categoryId is required.", 400);
    const category = await prisma.category.findUnique({ where: { id: data.categoryId, deletedAt: null } });
    if (!category) throw new AppError("Category not found.", 404);
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

  throw new AppError("Unsupported bulk action.", 400);
}

export async function listProductCountries(productId: string) {
  await getProduct(productId);
  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
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
  await getProduct(productId);
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

  const attributeById = new Map(existingAttributes.map((attribute) => [attribute.id, attribute]));
  const xAxisAttributes = attributes.filter((attributeConfig) => attributeById.get(attributeConfig.attributeId)?.role === "X_GRID");
  const yAxisAttributes = attributes.filter((attributeConfig) => attributeById.get(attributeConfig.attributeId)?.role === "Y_GRID");

  if (xAxisAttributes.length > 1) {
    throw new AppError(
      `Only one Grid X Axis attribute can be mapped to a product. Remove one of: ${xAxisAttributes.map((attributeConfig) => attributeById.get(attributeConfig.attributeId)?.name ?? attributeConfig.attributeId).join(", ")}.`,
      400,
    );
  }

  if (yAxisAttributes.length > 1) {
    throw new AppError(
      `Only one Grid Y Axis attribute can be mapped to a product. Remove one of: ${yAxisAttributes.map((attributeConfig) => attributeById.get(attributeConfig.attributeId)?.name ?? attributeConfig.attributeId).join(", ")}.`,
      400,
    );
  }

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

  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  let attributeGroups = (data?.attributes ?? []).filter((group) => group.attributeValueIds?.length);
  const productAttributeMappings = await listProductAttributes(productId);
  const hasProductAttributeMappings = productAttributeMappings.length > 0;
  const allowUnmappedOverride =
    ALLOW_UNMAPPED_VARIANT_GENERATION_OVERRIDE && data?.allowUnmappedAttributeOverride === true;

  if (hasProductAttributeMappings && !allowUnmappedOverride) {
    if (!attributeGroups.length) {
      const defaultMappings = productAttributeMappings.filter((mapping) => mapping.required);
      attributeGroups = defaultMappings.map((mapping) => ({
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
        if (existing) return existing;

        const variant = await prisma.productVariant.create({
          data: {
            productId,
            packageId: pkg?.id ?? null,
            title,
            variantKey,
            sku: buildGeneratedVariantSku(product, variantKey),
          },
        });

        await prisma.productVariantAttributeValue.createMany({
          data: combo.map((v) => ({
            variantId: variant.id,
            attributeId: v.attributeId,
            attributeValueId: v.id,
          })),
        });

        await prisma.inventory.create({
          data: { productId, variantId: variant.id, stock: 0 },
        });

        return variant;
      })
    )
  );

  return createdVariants;
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
      weight: data.weight ?? null,
      length: data.length ?? null,
      width: data.width ?? null,
      height: data.height ?? null,
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

export async function deleteVariant(productId: string, variantId: string) {
  await getVariant(productId, variantId);
  return prisma.productVariant.update({
    where: { id: variantId },
    data: { status: "INACTIVE" },
  });
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

  await prisma.inventory.create({
    data: { productId, variantId: clone.id, stock: source.inventory?.stock ?? 0, lowStockThreshold: source.inventory?.lowStockThreshold ?? 10 },
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
      inventory: true,
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
