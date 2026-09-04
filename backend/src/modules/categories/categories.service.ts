import { Prisma, Status } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError, slugify } from "../../utils/apiResponse";
import { readSpreadsheetRows, writeSpreadsheetBuffer } from "../../utils/spreadsheet";
import { CATEGORY_DESCRIPTION_MAX_LENGTH } from "../../constants/category.constants";

export function getMeaningfulTextLength(html: string | null | undefined): number {
  if (!html) return 0;
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim().length;
}

export function assertValidDescriptionLength(description: string | null | undefined) {
  if (!description) return;
  const length = getMeaningfulTextLength(description);
  if (length > CATEGORY_DESCRIPTION_MAX_LENGTH) {
    throw new AppError(
      `Category description cannot exceed ${CATEGORY_DESCRIPTION_MAX_LENGTH} characters. Current text length: ${length} characters.`,
      400,
    );
  }
}

const categoryInclude = {
  parent: { select: { id: true, name: true, slug: true } },
  children: { where: { deletedAt: null }, select: { id: true, name: true, slug: true, parentId: true } },
  translations: { include: { language: true } },
  _count: { select: { products: { where: { deletedAt: null } } } },
} satisfies Prisma.CategoryInclude;

type CategoryInput = {
  name?: string;
  slug?: string;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  parentId?: string | null;
  image?: string | null;
  status?: Status;
  sortOrder?: number;
};

type CategorySpreadsheetRow = {
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

type SpreadsheetIssue = {
  row: number;
  field: string;
  message: string;
};

async function syncActiveCategoryVisibility(tx: Prisma.TransactionClient, categoryId: string, status: Status | undefined) {
  if (status !== "ACTIVE") return;
  const countries = await tx.country.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
  await Promise.all(
    countries.map((country) =>
      tx.categoryCountry.upsert({
        where: { categoryId_countryId: { categoryId, countryId: country.id } },
        update: { enabled: true },
        create: { categoryId, countryId: country.id, enabled: true },
      }),
    ),
  );
}

function parseBooleanList(value: string | null | undefined) {
  const normalized = String(value ?? "").trim();
  if (!normalized) return [];
  return normalized
    .split(/[;,|]/)
    .map((code) => code.trim().toUpperCase())
    .filter(Boolean);
}

function parseCategoryRow(raw: Record<string, string>): CategorySpreadsheetRow {
  const sortOrder = String(raw.sortOrder ?? "").trim();
  return {
    name: raw.name?.trim() || "",
    slug: raw.slug?.trim() || null,
    parentSlug: raw.parentSlug?.trim() || null,
    status: raw.status?.trim().toUpperCase() || null,
    sortOrder: sortOrder ? Number(sortOrder) : null,
    image: raw.image?.trim() || null,
    description: raw.description?.trim() || null,
    seoTitle: raw.seoTitle?.trim() || null,
    seoDescription: raw.seoDescription?.trim() || null,
    countryCodes: parseBooleanList(raw.countryCodes),
  };
}

export async function listCategories(query?: { deleted?: boolean | string }) {
  const isDeleted = query?.deleted === true || query?.deleted === "true";
  return prisma.category.findMany({
    where: { deletedAt: isDeleted ? { not: null } : null },
    orderBy: isDeleted ? [{ deletedAt: "desc" }, { updatedAt: "desc" }] : [{ sortOrder: "asc" }, { name: "asc" }],
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

async function assertUniqueNameWithinParent(name: string, parentId: string | null | undefined, excludeId?: string) {
  const existing = await prisma.category.findFirst({
    where: {
      name,
      parentId: parentId ?? null,
      deletedAt: null,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new AppError("A category with this name already exists under the same parent.", 409);
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
  if (data.seoTitle !== undefined) next.seoTitle = data.seoTitle || null;
  if (data.seoDescription !== undefined) next.seoDescription = data.seoDescription || null;
  if (data.parentId !== undefined) next.parentId = data.parentId || null;
  if (data.image !== undefined) next.image = data.image || null;
  if (data.status !== undefined) next.status = data.status;
  if (data.sortOrder !== undefined) next.sortOrder = data.sortOrder;
  if (!id) next.deletedAt = null;
  return next;
}

export async function createCategory(data: CategoryInput & { name: string }) {
  if (!data.name?.trim()) throw new AppError("Category name is required.", 400);
  if (data.description !== undefined) assertValidDescriptionLength(data.description);
  const slug = slugify(data.slug?.trim() || data.name);
  if (!slug) throw new AppError("Category slug is required.", 400);
  await assertUniqueSlug(slug);
  await assertUniqueNameWithinParent(data.name.trim(), data.parentId);
  await assertValidParent(undefined, data.parentId);
  const maxOrder = await prisma.category.aggregate({ where: { deletedAt: null }, _max: { sortOrder: true } });
  const writeData = cleanCategoryData({ ...data, slug, sortOrder: data.sortOrder ?? (maxOrder._max.sortOrder ?? -1) + 1 });
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({ data: writeData as Prisma.CategoryUncheckedCreateInput, include: categoryInclude });
    await syncActiveCategoryVisibility(tx, category.id, category.status);
    return category;
  });
}

export async function updateCategory(id: string, data: CategoryInput) {
  const current = await getCategory(id);
  if (data.description !== undefined) assertValidDescriptionLength(data.description);
  const slug = data.slug !== undefined || data.name !== undefined ? slugify(data.slug?.trim() || data.name || "") : undefined;
  if (slug !== undefined) {
    if (!slug) throw new AppError("Category slug is required.", 400);
    await assertUniqueSlug(slug, id);
  }
  if (data.name !== undefined) await assertUniqueNameWithinParent(data.name.trim(), data.parentId === undefined ? current.parentId : data.parentId, id);
  await assertValidParent(id, data.parentId);
  const writeData = cleanCategoryData({ ...data, ...(slug !== undefined ? { slug } : {}) }, id);
  return prisma.$transaction(async (tx) => {
    const category = await tx.category.update({ where: { id }, data: writeData as Prisma.CategoryUncheckedUpdateInput, include: categoryInclude });
    await syncActiveCategoryVisibility(tx, category.id, category.status);
    return category;
  });
}

export async function deleteCategory(id: string) {
  const current = await getCategory(id);
  const [productCount, childCount] = await Promise.all([
    prisma.product.count({ where: { categoryId: id, deletedAt: null } }),
    prisma.category.count({ where: { parentId: id, deletedAt: null } }),
  ]);
  if (productCount > 0) throw new AppError("Cannot delete a category that is used by products.", 400);
  if (childCount > 0) throw new AppError("Cannot delete a category that still has child categories.", 400);
  return prisma.category.update({
    where: { id },
    data: {
      deletedAt: new Date(),
      slug: `${current.slug}-deleted-${Date.now()}`,
    },
  });
}

export async function permanentDeleteCategory(id: string) {
  const category = await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      _count: {
        select: {
          products: true,
          children: true,
          discounts: true,
          taxRules: true,
        },
      },
    },
  });
  if (!category) throw new AppError("Category not found.", 404);

  if (category._count.products > 0) {
    throw new AppError(
      `Cannot permanently delete category "${category.name}": referenced by ${category._count.products} product(s). Please reassign or delete the products first.`,
      400,
    );
  }
  if (category._count.children > 0) {
    throw new AppError(
      `Cannot permanently delete category "${category.name}": it has ${category._count.children} child sub-category(ies). Please reassign or delete them first.`,
      400,
    );
  }

  return prisma.$transaction(async (tx) => {
    await tx.categoryCountry.deleteMany({ where: { categoryId: id } });
    await tx.categoryTranslation.deleteMany({ where: { categoryId: id } });
    await tx.discountCategory.deleteMany({ where: { categoryId: id } });
    await tx.category.update({
      where: { id },
      data: { taxRules: { set: [] } },
    });
    return tx.category.delete({ where: { id } });
  });
}

export async function archiveCategory(id: string) {
  await getCategory(id);
  return prisma.category.update({ where: { id }, data: { status: "INACTIVE" } });
}

export async function restoreCategory(id: string) {
  const current = await prisma.category.findFirst({ where: { id } });
  if (!current) throw new AppError("Category not found.", 404);
  if (!current.deletedAt) throw new AppError("Category is already active.", 400);

  const baseSlug = current.slug.replace(/-deleted-\d+$/, "");
  const slugConflict = await prisma.category.findFirst({
    where: { slug: baseSlug, deletedAt: null, id: { not: id } },
  });
  const finalSlug = slugConflict ? `${baseSlug}-restored-${Date.now()}` : baseSlug;

  return prisma.$transaction(async (tx) => {
    const category = await tx.category.update({
      where: { id },
      data: { status: "ACTIVE", deletedAt: null, slug: finalSlug },
    });
    await syncActiveCategoryVisibility(tx, category.id, category.status);
    return category;
  });
}

export async function duplicateCategory(id: string) {
  const source = await prisma.category.findFirst({
    where: { id, deletedAt: null },
    include: {
      countries: true,
      translations: true,
    },
  });
  if (!source) throw new AppError("Category not found.", 404);

  const baseName = `${source.name} Copy`;
  const slug = `${slugify(baseName)}-${Date.now()}`;
  await assertUniqueSlug(slug);
  await assertUniqueNameWithinParent(baseName, source.parentId);

  return prisma.$transaction(async (tx) => {
    const category = await tx.category.create({
      data: {
        name: baseName,
        slug,
        description: source.description,
        seoTitle: source.seoTitle,
        seoDescription: source.seoDescription,
        parentId: source.parentId,
        image: source.image,
        status: source.status,
        sortOrder: source.sortOrder + 1,
      },
      include: categoryInclude,
    });

    if (source.countries.length) {
      await tx.categoryCountry.createMany({
        data: source.countries.map((country) => ({
          categoryId: category.id,
          countryId: country.countryId,
          enabled: country.enabled,
        })),
      });
    }

    if (source.translations.length) {
      await tx.categoryTranslation.createMany({
        data: source.translations.map((translation) => ({
          categoryId: category.id,
          languageId: translation.languageId,
          name: translation.name,
          description: translation.description,
          reviewedAt: translation.reviewedAt,
          status: translation.status,
        })),
      });
    }

    return tx.category.findFirst({
      where: { id: category.id },
      include: categoryInclude,
    });
  });
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
    prisma.country.findMany({ where: { status: "ACTIVE" }, include: { currency: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] }),
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

const CATEGORY_EXPORT_COLUMNS = [
  { key: "name", header: "name" },
  { key: "slug", header: "slug" },
  { key: "parentSlug", header: "parentSlug" },
  { key: "status", header: "status" },
  { key: "sortOrder", header: "sortOrder" },
  { key: "image", header: "image" },
  { key: "description", header: "description" },
  { key: "seoTitle", header: "seoTitle" },
  { key: "seoDescription", header: "seoDescription" },
  { key: "countryCodes", header: "countryCodes" },
] as const;

function categoryExportCountryCodes(countries: { country: { code: string } }[]) {
  return countries.map((country) => country.country.code).join(", ");
}

async function previewCategoryRows(rows: Record<string, string>[]) {
  const parsed = rows.map(parseCategoryRow);
  const issues: SpreadsheetIssue[] = [];
  const duplicateWarnings: string[] = [];
  const seenSlug = new Map<string, number>();
  const seenNameByParent = new Map<string, number>();
  const slugs = new Set<string>();
  const fileRowBySlug = new Map<string, number>();
  const countryCodes = new Set<string>();

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    if (!row.name) issues.push({ row: rowNumber, field: "name", message: "Name is required." });
    if (row.description) {
      const descLen = getMeaningfulTextLength(row.description);
      if (descLen > CATEGORY_DESCRIPTION_MAX_LENGTH) {
        issues.push({
          row: rowNumber,
          field: "description",
          message: `Category description cannot exceed ${CATEGORY_DESCRIPTION_MAX_LENGTH} characters. Current length: ${descLen} characters.`,
        });
      }
    }
    if (row.status && !["ACTIVE", "INACTIVE"].includes(row.status)) {
      issues.push({ row: rowNumber, field: "status", message: "Status must be ACTIVE or INACTIVE." });
    }
    const slug = slugify(row.slug || row.name);
    fileRowBySlug.set(slug, rowNumber);
    const seenSlugRow = seenSlug.get(slug);
    if (seenSlugRow) {
      const message = `Duplicate slug '${slug}' found on rows ${seenSlugRow} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "slug", message });
      duplicateWarnings.push(message);
    } else {
      seenSlug.set(slug, rowNumber);
    }
    const parentKey = `${row.parentSlug || ""}::${row.name.toLowerCase()}`;
    const seenNameRow = seenNameByParent.get(parentKey);
    if (seenNameRow) {
      const message = `Duplicate category name '${row.name}' under the same parent appears on rows ${seenNameRow} and ${rowNumber}.`;
      issues.push({ row: rowNumber, field: "name", message });
      duplicateWarnings.push(message);
    } else {
      seenNameByParent.set(parentKey, rowNumber);
    }
    slugs.add(slug);
    row.countryCodes?.forEach((code) => countryCodes.add(code));
  }

  const [existingCategories, countries] = await Promise.all([
    prisma.category.findMany({
      where: { slug: { in: Array.from(slugs) }, deletedAt: null },
      select: { slug: true, id: true, status: true },
    }),
    prisma.country.findMany({ where: { code: { in: Array.from(countryCodes) } }, select: { code: true, status: true } }),
  ]);

  const categoryBySlug = new Map(existingCategories.map((category) => [category.slug, category]));
  const countryByCode = new Map(countries.map((country) => [country.code, country]));
  const previewRows: Array<CategorySpreadsheetRow & { row: number }> = [];

  for (const [index, row] of parsed.entries()) {
    const rowNumber = index + 2;
    const slug = slugify(row.slug || row.name);
    const parentSlug = row.parentSlug ? slugify(row.parentSlug) : null;
    const parentExists = parentSlug ? categoryBySlug.get(parentSlug) : null;
    const parentInFile = parentSlug ? fileRowBySlug.has(parentSlug) : false;
    if (parentSlug && !parentExists && !parentInFile) {
      issues.push({ row: rowNumber, field: "parentSlug", message: `Parent category '${row.parentSlug}' was not found.` });
    }
    if (parentExists && parentExists.status !== "ACTIVE") {
      issues.push({ row: rowNumber, field: "parentSlug", message: `Parent category '${row.parentSlug}' is inactive.` });
    }
    row.countryCodes?.forEach((code) => {
      const country = countryByCode.get(code);
      if (!country) issues.push({ row: rowNumber, field: "countryCodes", message: `Country '${code}' was not found.` });
      else if (country.status !== "ACTIVE") issues.push({ row: rowNumber, field: "countryCodes", message: `Country '${code}' is inactive.` });
    });
    previewRows.push({ ...row, row: rowNumber, slug });
  }

  return { parsed, issues, duplicateWarnings, categoryBySlug, previewRows, fileRowBySlug };
}

export async function exportCategoriesSpreadsheet() {
  const categories = await prisma.category.findMany({
    where: { deletedAt: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      parent: { select: { slug: true } },
      countries: { where: { enabled: true }, include: { country: { select: { code: true } } } },
    },
  });

  return writeSpreadsheetBuffer(
    categories.map((category) => ({
      name: category.name,
      slug: category.slug,
      parentSlug: category.parent?.slug ?? "",
      status: category.status,
      sortOrder: category.sortOrder,
      image: category.image ?? "",
      description: category.description ?? "",
      seoTitle: category.seoTitle ?? "",
      seoDescription: category.seoDescription ?? "",
      countryCodes: categoryExportCountryCodes(category.countries),
    })),
    "Categories",
    CATEGORY_EXPORT_COLUMNS.map((column) => ({ key: column.key, header: column.header })),
  );
}

export async function previewCategoryImport(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewCategoryRows(rows);
  return {
    totalRows: preview.parsed.length,
    validRows: Math.max(0, preview.parsed.length - preview.issues.length),
    invalidRows: preview.issues.length,
    issues: preview.issues,
    duplicateWarnings: preview.duplicateWarnings,
    sampleRows: preview.previewRows.slice(0, 10),
  };
}

async function syncCategoryCountries(tx: Prisma.TransactionClient, categoryId: string, countryCodes: string[]) {
  if (!countryCodes.length) return;
  const countries = await tx.country.findMany({ where: { code: { in: countryCodes } }, select: { id: true, code: true } });
  if (countries.length !== countryCodes.length) throw new AppError("One or more countries were not found.", 400);
  await Promise.all(
    countries.map((country) =>
      tx.categoryCountry.upsert({
        where: { categoryId_countryId: { categoryId, countryId: country.id } },
        update: { enabled: true },
        create: { categoryId, countryId: country.id, enabled: true },
      }),
    ),
  );
}

export async function importCategoriesSpreadsheet(filePath: string) {
  const rows = readSpreadsheetRows(filePath);
  const preview = await previewCategoryRows(rows);
  if (preview.issues.length > 0) {
    throw new AppError(`Import validation failed with ${preview.issues.length} issue(s).`, 400);
  }

  const summary = { created: 0, updated: 0 };
  const nowSuffix = Date.now().toString().slice(-6);
  const rowMap = new Map<string, CategorySpreadsheetRow>();
  preview.parsed.forEach((row) => {
    const slug = slugify(row.slug || row.name);
    rowMap.set(slug, row);
  });
  const depthMemo = new Map<string, number>();
  const visitStack = new Set<string>();
  const getDepth = (slug: string): number => {
    if (depthMemo.has(slug)) return depthMemo.get(slug)!;
    if (visitStack.has(slug)) throw new AppError("Circular category references were found in the import file.", 400);
    visitStack.add(slug);
    const row = rowMap.get(slug);
    if (!row) {
      visitStack.delete(slug);
      return 0;
    }
    const parentSlug = row.parentSlug ? slugify(row.parentSlug) : null;
    const parentDepth = parentSlug && rowMap.has(parentSlug) ? getDepth(parentSlug) + 1 : 0;
    depthMemo.set(slug, parentDepth);
    visitStack.delete(slug);
    return parentDepth;
  };
  const sortedRows = [...preview.parsed].sort((a, b) => {
    const aSlug = slugify(a.slug || a.name);
    const bSlug = slugify(b.slug || b.name);
    return getDepth(aSlug) - getDepth(bSlug) || a.name.localeCompare(b.name);
  });

  await prisma.$transaction(async (tx) => {
    for (const [index, row] of sortedRows.entries()) {
      const slug = slugify(row.slug || row.name);
      const existing = await tx.category.findFirst({ where: { slug, deletedAt: null } });
      const parentSlug = row.parentSlug ? slugify(row.parentSlug) : null;
      const parent = parentSlug ? await tx.category.findFirst({ where: { slug: parentSlug, deletedAt: null }, select: { id: true } }) : null;
      const baseData = {
        name: row.name.trim(),
        slug: existing ? existing.slug : `${slug}-${nowSuffix}-${index + 1}`,
        description: row.description || null,
        seoTitle: row.seoTitle || null,
        seoDescription: row.seoDescription || null,
        parentId: parent?.id ?? null,
        image: row.image || null,
        status: (row.status as never) || "ACTIVE",
        sortOrder: row.sortOrder ?? 0,
      };

      if (existing) {
        await tx.category.update({ where: { id: existing.id }, data: baseData });
        if (row.countryCodes?.length) await syncCategoryCountries(tx, existing.id, row.countryCodes);
        summary.updated += 1;
      } else {
        const created = await tx.category.create({ data: baseData });
        if (row.countryCodes?.length) await syncCategoryCountries(tx, created.id, row.countryCodes);
        summary.created += 1;
      }
    }
  });

  return {
    ...summary,
    report: {
      totalRows: sortedRows.length,
      validRows: sortedRows.length,
      invalidRows: 0,
      issues: [],
      duplicateWarnings: preview.duplicateWarnings,
      sampleRows: sortedRows.slice(0, 10).map((row, index) => ({ row: index + 2, ...row })),
    },
  };
}
