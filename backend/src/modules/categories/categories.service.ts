import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, slugify } from "../../utils/apiResponse";

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  children: { where: { deletedAt: null }, select: { id: true, name: true, slug: true, parentId: true } },
  translations: { include: { language: true } },
  _count: { select: { products: true } },
} satisfies Prisma.CategoryInclude;

type CategoryInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  parentId?: string | null;
  image?: string | null;
  status?: Status;
  sortOrder?: number;
};

export async function listCategories() {
  return prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: categoryInclude,
  });
}

export async function getCategory(id: string) {
  const category = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    include: categoryInclude,
  });
  if (!category) throw new AppError("Category not found.", 404);
  return category;
}

async function assertUniqueSlug(slug: string, excludeId?: string) {
  const existing = await prisma.category.findFirst({
    where: {
      slug,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
  });
  if (existing) throw new AppError("A category with this slug already exists.", 409);
}

async function assertValidParent(categoryId: string | undefined, parentId: string | null | undefined) {
  if (!parentId) return;
  if (categoryId && categoryId === parentId) {
    throw new AppError("A category cannot be its own parent.", 400);
  }

  const parent = await prisma.category.findFirst({
    where: { id: parentId, deletedAt: null },
    select: { id: true, parentId: true },
  });
  if (!parent) throw new AppError("Parent category not found.", 404);

  if (!categoryId) return;
  let cursor: typeof parent | null = parent;
  while (cursor?.parentId) {
    if (cursor.parentId === categoryId) {
      throw new AppError("Circular category parent relationships are not allowed.", 400);
    }
    cursor = await prisma.category.findFirst({
      where: { id: cursor.parentId, deletedAt: null },
      select: { id: true, parentId: true },
    });
  }
}

function cleanCategoryData(data: CategoryInput, id?: string): Prisma.CategoryUncheckedCreateInput | Prisma.CategoryUncheckedUpdateInput {
  const next: Record<string, unknown> = {};
  if (data.name !== undefined) next.name = data.name.trim();
  if (data.slug !== undefined || data.name !== undefined) next.slug = slugify(data.slug?.trim() || data.name || "");
  if (data.description !== undefined) next.description = data.description || null;
  if (data.parentId !== undefined) next.parentId = data.parentId || null;
  if (data.image !== undefined) next.image = data.image || null;
  if (data.status !== undefined) next.status = data.status;
  if (data.sortOrder !== undefined) next.sortOrder = data.sortOrder;
  if (!id) next.deletedAt = null;
  return next;
}

export async function createCategory(data: CategoryInput & { name: string }) {
  if (!data.name?.trim()) throw new AppError("Category name is required.", 400);
  const slug = slugify(data.slug?.trim() || data.name);
  if (!slug) throw new AppError("Category slug is required.", 400);
  await assertUniqueSlug(slug);
  await assertValidParent(undefined, data.parentId);
  const maxOrder = await prisma.category.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } });
  const writeData = cleanCategoryData({ ...data, slug, sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1 });
  return prisma.category.create({ data: writeData as Prisma.CategoryUncheckedCreateInput, include: categoryInclude });
}

export async function updateCategory(id: string, data: CategoryInput) {
  await getCategory(id);
  const slug = data.slug !== undefined || data.name !== undefined ? slugify(data.slug?.trim() || data.name || "") : undefined;
  if (slug !== undefined) {
    if (!slug) throw new AppError("Category slug is required.", 400);
    await assertUniqueSlug(slug, id);
  }
  await assertValidParent(id, data.parentId);
  const writeData = cleanCategoryData({ ...data, ...(slug !== undefined ? { slug } : {}) }, id);
  return prisma.category.update({ where: { id }, data: writeData as Prisma.CategoryUncheckedUpdateInput, include: categoryInclude });
}

export async function deleteCategory(id: string) {
  await getCategory(id);
  return prisma.category.update({ where: { id }, data: { deletedAt: new Date() } });
}

export async function reorderCategories(items: { id: string; sortOrder: number }[]) {
  if (!Array.isArray(items)) throw new AppError("Reorder payload must include items.", 400);
  await prisma.$transaction(
    items.map((item) =>
      prisma.category.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      }),
    ),
  );
  return listCategories();
}

export async function listCategoryCountries(categoryId: string) {
  await getCategory(categoryId);
  const [countries, mappings] = await Promise.all([
    prisma.country.findMany({ include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
    prisma.categoryCountry.findMany({ where: { categoryId } }),
  ]);
  const mappingByCountry = new Map(mappings.map((mapping) => [mapping.countryId, mapping]));
  return countries.map((country) => {
    const mapping = mappingByCountry.get(country.id);
    return {
      ...country,
      categoryCountryId: mapping?.id ?? null,
      enabled: mapping?.enabled ?? false,
    };
  });
}

export async function updateCategoryCountries(categoryId: string, items: { countryId: string; enabled: boolean }[]) {
  await getCategory(categoryId);
  if (!Array.isArray(items)) throw new AppError("Country mapping payload must include an array of items.", 400);
  const countryIds = [...new Set(items.map((item) => item.countryId))];
  const countries = await prisma.country.findMany({ where: { id: { in: countryIds } }, select: { id: true } });
  if (countries.length !== countryIds.length) throw new AppError("One or more countries were not found.", 400);

  await prisma.$transaction(
    items.map((item) =>
      prisma.categoryCountry.upsert({
        where: { categoryId_countryId: { categoryId, countryId: item.countryId } },
        update: { enabled: Boolean(item.enabled) },
        create: { categoryId, countryId: item.countryId, enabled: Boolean(item.enabled) },
      }),
    ),
  );
  return listCategoryCountries(categoryId);
}
