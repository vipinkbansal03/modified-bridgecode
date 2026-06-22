import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";
import type { Prisma } from "@prisma/client";

function buildVariantKey(attributeValueIds: string[], packageId?: string | null) {
  const valueKey = [...attributeValueIds].sort().join("-");
  return packageId ? `${packageId}::${valueKey}` : valueKey;
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
      orderBy: { createdAt: "desc" },
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
  attributes: { attributeId: string; required: boolean; allowedValueIds?: string[] }[]
) {
  await getProduct(productId);
  await prisma.productAttributeValueSelection.deleteMany({
    where: { productAttribute: { productId } },
  });
  await prisma.productAttribute.deleteMany({ where: { productId } });

  const created = await Promise.all(
    attributes.map(async (attributeConfig) => {
      const productAttribute = await prisma.productAttribute.create({
        data: {
          productId,
          attributeId: attributeConfig.attributeId,
          required: attributeConfig.required,
        },
      });

      const allowedValueIds = Array.from(new Set(attributeConfig.allowedValueIds ?? []));
      if (allowedValueIds.length) {
        await prisma.productAttributeValueSelection.createMany({
          data: allowedValueIds.map((attributeValueId) => ({
            productAttributeId: productAttribute.id,
            attributeValueId,
          })),
        });
      }

      return productAttribute;
    })
  );

  return created;
}

// ─── Generate variants from attribute combinations ────────

export async function generateVariants(
  productId: string,
  data?: { packageIds?: string[]; attributes?: { attributeId: string; attributeValueIds: string[] }[] }
) {
  const product = await getProduct(productId);

  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);

  const attributeGroups = (data?.attributes ?? []).filter((group) => group.attributeValueIds?.length);
  if (!attributeGroups.length) throw new AppError("Select attribute values before generating variants.", 400);

  const attrValueSets = await Promise.all(
    attributeGroups.map(async (group) => {
      const values = await loadActiveAttributeValues(group.attributeValueIds);
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
            sku: `${product.sku || productId}-${variantKey.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10)}`,
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
