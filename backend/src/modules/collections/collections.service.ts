import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";
import * as DiscountsService from "../discounts/discounts.service";

type CollectionInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  status?: Status;
  sortOrder?: number | string | null;
  productIds?: string[];
};

type CollectionQuery = {
  page?: string;
  limit?: string;
  status?: string;
  search?: string;
  sortBy?: string;
  sortDir?: string;
};

function normalize(input: CollectionInput) {
  const name = input.name?.trim();
  if (!name) throw new AppError("Collection name is required.", 400);
  const slug = input.slug?.trim() ? slugify(input.slug) : slugify(name);
  return {
    name,
    slug,
    description: input.description || null,
    image: input.image || null,
    status: input.status || "ACTIVE",
    sortOrder: input.sortOrder === undefined || input.sortOrder === null || input.sortOrder === "" ? 0 : Number(input.sortOrder),
  };
}

function normalizeStatusFilter(status?: string) {
  const value = status?.trim().toUpperCase();
  if (!value) return undefined;
  if (value === "ARCHIVED") return "INACTIVE" as Status;
  if (value === "ACTIVE" || value === "INACTIVE") return value as Status;
  throw new AppError("Invalid collection status.", 400);
}

function buildCollectionWhere(query: CollectionQuery): Prisma.CollectionWhereInput {
  const status = normalizeStatusFilter(query.status);
  const search = query.search?.trim();
  return {
    ...(status ? { status } : {}),
    ...(search
      ? {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
          ],
        }
      : {}),
  };
}

function buildCollectionOrder(query: CollectionQuery): Prisma.CollectionOrderByWithRelationInput[] {
  const sortDir = query.sortDir?.trim().toLowerCase() === "desc" ? "desc" : "asc";
  switch (query.sortBy?.trim()) {
    case "name":
      return [{ name: sortDir }, { sortOrder: "asc" }, { createdAt: "desc" }];
    case "slug":
      return [{ slug: sortDir }, { sortOrder: "asc" }, { createdAt: "desc" }];
    case "status":
      return [{ status: sortDir }, { sortOrder: "asc" }, { createdAt: "desc" }];
    case "updatedAt":
      return [{ updatedAt: sortDir }, { sortOrder: "asc" }, { createdAt: "desc" }];
    case "createdAt":
      return [{ createdAt: sortDir }, { sortOrder: "asc" }];
    case "sortOrder":
    default:
      return [{ sortOrder: sortDir }, { createdAt: "desc" }];
  }
}

const collectionInclude = {
  products: { include: { product: true }, orderBy: { sortOrder: "asc" } },
  countries: { include: { country: true }, orderBy: { country: { name: "asc" } } },
  _count: { select: { products: true } },
} satisfies Prisma.CollectionInclude;

async function syncProducts(collectionId: string, productIds?: string[]) {
  if (!productIds) return;
  const uniqueIds = [...new Set(productIds.filter(Boolean))];
  const products = await prisma.product.findMany({ where: { id: { in: uniqueIds }, deletedAt: null }, select: { id: true } });
  if (products.length !== uniqueIds.length) throw new AppError("One or more products were not found.", 400);
  await prisma.$transaction([
    prisma.collectionProduct.deleteMany({ where: { collectionId } }),
    ...uniqueIds.map((productId, index) =>
      prisma.collectionProduct.create({ data: { collectionId, productId, sortOrder: index + 1 } })
    ),
  ]);
}

export async function listCollections(query: CollectionQuery) {
  const { page, limit, skip } = getPagination(query);
  const where = buildCollectionWhere(query);
  const [data, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      skip,
      take: limit,
      orderBy: buildCollectionOrder(query),
      include: collectionInclude,
    }),
    prisma.collection.count({ where }),
  ]);
  return { data, total, page, limit };
}

export async function getCollection(id: string) {
  const collection = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: { include: { product: true }, orderBy: { sortOrder: "asc" } },
      countries: { include: { country: true }, orderBy: { country: { name: "asc" } } },
    },
  });
  if (!collection) throw new AppError("Collection not found.", 404);
  return collection;
}

export async function createCollection(input: CollectionInput) {
  const data = normalize(input);
  const existing = await prisma.collection.findUnique({ where: { slug: data.slug } });
  if (existing) throw new AppError("A collection with this slug already exists.", 409);
  const collection = await prisma.collection.create({ data });
  await syncProducts(collection.id, input.productIds);
  return getCollection(collection.id);
}

export async function updateCollection(id: string, input: CollectionInput) {
  await getCollection(id);
  const nextData: Prisma.CollectionUpdateInput = {};
  if (input.name !== undefined) {
    const normalized = normalize(input);
    nextData.name = normalized.name;
    nextData.slug = normalized.slug;
    nextData.description = normalized.description;
    nextData.image = normalized.image;
    nextData.status = normalized.status;
    nextData.sortOrder = normalized.sortOrder;
  } else {
    if (input.slug !== undefined) {
      const slug = slugify(input.slug);
      const existing = await prisma.collection.findFirst({ where: { slug, id: { not: id } } });
      if (existing) throw new AppError("A collection with this slug already exists.", 409);
      nextData.slug = slug;
    }
    if (input.description !== undefined) nextData.description = input.description || null;
    if (input.image !== undefined) nextData.image = input.image || null;
    if (input.status !== undefined) nextData.status = input.status;
    if (input.sortOrder !== undefined) nextData.sortOrder = Number(input.sortOrder || 0);
  }
  await prisma.collection.update({ where: { id }, data: nextData });
  await syncProducts(id, input.productIds);
  return getCollection(id);
}

export async function deleteCollection(id: string) {
  await getCollection(id);
  await prisma.collection.delete({ where: { id } });
}

export async function archiveCollection(id: string) {
  await getCollection(id);
  return prisma.collection.update({ where: { id }, data: { status: "INACTIVE" } });
}

export async function restoreCollection(id: string) {
  await getCollection(id);
  return prisma.collection.update({ where: { id }, data: { status: "ACTIVE" } });
}

export async function duplicateCollection(id: string) {
  const source = await prisma.collection.findUnique({
    where: { id },
    include: {
      products: { orderBy: { sortOrder: "asc" } },
      countries: true,
    },
  });
  if (!source) throw new AppError("Collection not found.", 404);

  const baseName = `${source.name} Copy`;
  let slug = `${slugify(baseName)}-${Date.now()}`;
  while (await prisma.collection.findUnique({ where: { slug } })) {
    slug = `${slugify(baseName)}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  }

  return prisma.$transaction(async (tx) => {
    const collection = await tx.collection.create({
      data: {
        name: baseName,
        slug,
        description: source.description,
        image: source.image,
        status: "ACTIVE",
        sortOrder: source.sortOrder + 1,
      },
      include: collectionInclude,
    });

    if (source.products.length) {
      await tx.collectionProduct.createMany({
        data: source.products.map((item, index) => ({
          collectionId: collection.id,
          productId: item.productId,
          sortOrder: item.sortOrder || index + 1,
        })),
      });
    }

    if (source.countries.length) {
      await tx.collectionCountry.createMany({
        data: source.countries.map((item) => ({
          collectionId: collection.id,
          countryId: item.countryId,
          enabled: item.enabled,
        })),
      });
    }

    return getCollection(collection.id);
  });
}

export async function listCollectionCountries(collectionId: string) {
  await getCollection(collectionId);
  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.collectionCountry.findMany({ where: { collectionId } }),
  ]);
  const byCountry = new Map(mappings.map((mapping) => [mapping.countryId, mapping]));
  return countries.map((country) => ({ ...country, enabled: byCountry.get(country.id)?.enabled ?? false }));
}

export async function updateCollectionCountries(collectionId: string, items: { countryId: string; enabled: boolean }[]) {
  await getCollection(collectionId);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);
  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);
  await prisma.$transaction(
    items.map((item) =>
      prisma.collectionCountry.upsert({
        where: { collectionId_countryId: { collectionId, countryId: item.countryId } },
        update: { enabled: Boolean(item.enabled) },
        create: { collectionId, countryId: item.countryId, enabled: Boolean(item.enabled) },
      })
    )
  );
  return listCollectionCountries(collectionId);
}

export async function listCollectionDiscounts(collectionId: string) {
  await getCollection(collectionId);
  return prisma.discount.findMany({
    where: { collectionId },
    orderBy: { createdAt: "desc" },
    include: { tier: true, country: true, collection: true },
  });
}

export async function createCollectionDiscount(collectionId: string, input: Record<string, unknown>) {
  await getCollection(collectionId);
  return DiscountsService.createDiscount({ ...input, collectionId, productId: null, categoryId: null } as never);
}

export async function deleteCollectionDiscount(collectionId: string, discountId: string) {
  await getCollection(collectionId);
  const discount = await prisma.discount.findFirst({ where: { id: discountId, collectionId } });
  if (!discount) throw new AppError("Collection discount not found.", 404);
  await prisma.discount.delete({ where: { id: discountId } });
}
