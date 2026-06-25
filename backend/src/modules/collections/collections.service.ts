import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, getPagination, slugify } from "../../utils/apiResponse";

type CollectionInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  image?: string | null;
  status?: Status;
  sortOrder?: number | string | null;
  productIds?: string[];
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

export async function listCollections(query: { page?: string; limit?: string; status?: Status }) {
  const { page, limit, skip } = getPagination(query);
  const where: Prisma.CollectionWhereInput = query.status ? { status: query.status } : {};
  const [data, total] = await Promise.all([
    prisma.collection.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
      include: { products: { include: { product: true }, orderBy: { sortOrder: "asc" } }, _count: { select: { products: true } } },
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
  const data = input.name ? normalize(input) : {
    ...(input.description !== undefined ? { description: input.description || null } : {}),
    ...(input.image !== undefined ? { image: input.image || null } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.sortOrder !== undefined ? { sortOrder: Number(input.sortOrder || 0) } : {}),
  };
  if ("slug" in data) {
    const existing = await prisma.collection.findFirst({ where: { slug: data.slug, id: { not: id } } });
    if (existing) throw new AppError("A collection with this slug already exists.", 409);
  }
  await prisma.collection.update({ where: { id }, data });
  await syncProducts(id, input.productIds);
  return getCollection(id);
}

export async function deleteCollection(id: string) {
  await getCollection(id);
  await prisma.collection.delete({ where: { id } });
}

export async function listCollectionCountries(collectionId: string) {
  await getCollection(collectionId);
  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
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
