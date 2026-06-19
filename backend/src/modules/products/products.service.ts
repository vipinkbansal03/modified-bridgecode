import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import { uploadFile, deleteFile } from "../../config/storage";
import type { Prisma } from "@prisma/client";

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
      attributes: { include: { attribute: { include: { values: true } } } },
      variants: {
        include: {
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
  attributes: { attributeId: string; required: boolean }[]
) {
  await getProduct(productId);
  // Remove existing and re-create
  await prisma.productAttribute.deleteMany({ where: { productId } });
  return prisma.productAttribute.createMany({
    data: attributes.map((a) => ({ productId, attributeId: a.attributeId, required: a.required })),
  });
}

// ─── Generate variants from attribute combinations ────────

export async function generateVariants(productId: string) {
  const product = await getProduct(productId);

  if (!product.hasVariants) throw new AppError("Product does not use variants.", 400);
  if (!product.attributes.length) throw new AppError("No attributes assigned to this product.", 400);

  // Get all attribute values for each attribute assigned to this product
  const attrValueSets = product.attributes.map((pa) => pa.attribute.values.map((v) => v));

  // Cartesian product of all attribute value sets
  const combos = cartesian(attrValueSets);

  const createdVariants = await Promise.all(
    combos.map(async (combo) => {
      const variantKey = combo.map((v) => v.id).sort().join("-");
      const title = combo.map((v) => v.value).join(" / ");
      const existing = await prisma.productVariant.findFirst({ where: { productId, variantKey } });
      if (existing) return existing;

      const variant = await prisma.productVariant.create({
        data: { productId, title, variantKey, sku: `${product.sku || productId}-${variantKey.slice(0, 8)}` },
      });

      await prisma.productVariantAttributeValue.createMany({
        data: combo.map((v) => ({
          variantId: variant.id,
          attributeId: v.attributeId,
          attributeValueId: v.id,
        })),
      });

      // Create default inventory record
      await prisma.inventory.create({
        data: { productId, variantId: variant.id, stock: 0 },
      });

      return variant;
    })
  );

  return createdVariants;
}

function cartesian<T>(arrays: T[][]): T[][] {
  return arrays.reduce<T[][]>((acc, arr) => acc.flatMap((x) => arr.map((y) => [...x, y])), [[]]);
}
