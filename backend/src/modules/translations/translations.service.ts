import { TranslationStatus } from "@prisma/client";
import Papa from "papaparse";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { generateProductContent } from "../ai/ai.service";
import { getTranslationCoverage } from "./translationCoverage.service";
import { CATEGORY_DESCRIPTION_MAX_LENGTH } from "../../constants/category.constants";

type ProductTranslationInput = {
  title?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  seoKeywords?: string | null;
  highlights?: unknown;
  technicalSpecs?: unknown;
  warranty?: unknown;
  primaryFeatures?: unknown;
  isAiGenerated?: boolean;
  status?: TranslationStatus;
};

type CategoryTranslationInput = {
  name?: string | null;
  description?: string | null;
};

type TranslationCsvRow = {
  type?: string;
  priority?: string;
  entityId?: string;
  entityLabel?: string;
  context?: string;
  cmsEntityType?: string;
  cmsPageId?: string;
  field?: string;
  fieldLabel?: string;
  englishValue?: string;
  translation?: string;
};

type LanguageInput = {
  name?: unknown;
  code?: unknown;
  isEnabled?: unknown;
  isDefault?: unknown;
};

const PRODUCT_TRANSLATION_FIELDS = new Set([
  "title",
  "shortDescription",
  "description",
  "seoTitle",
  "seoDescription",
  "seoKeywords",
  "highlights",
  "technicalSpecs",
  "warranty",
  "primaryFeatures",
]);
const CATEGORY_TRANSLATION_FIELDS = new Set(["name", "description"]);
const CMS_TRANSLATION_ENTITY_TYPES = new Set([
  "page",
  "section",
  "block",
  "menuItem",
  "footer",
]);

function cmsTranslationKey(
  entityType: string,
  entityId: string,
  field: string,
) {
  return `cms.${entityType}.${entityId}.${field}`;
}

function normalizeLanguageCode(code: unknown) {
  if (typeof code !== "string")
    throw new AppError("Language code is required.", 400);
  const normalized = code.trim().toLowerCase();
  if (!/^[a-z]{2,3}(-[a-z]{2})?$/.test(normalized)) {
    throw new AppError(
      "Use a valid language code like en, hi, ar, or en-us.",
      400,
    );
  }
  return normalized;
}

function normalizeLanguageName(name: unknown) {
  if (typeof name !== "string" || !name.trim())
    throw new AppError("Language name is required.", 400);
  return name.trim();
}

export const listLanguages = () =>
  prisma.language.findMany({
    orderBy: [{ isDefault: "desc" }, { name: "asc" }],
  });

export async function createLanguage(data: LanguageInput) {
  const name = normalizeLanguageName(data.name);
  const code = normalizeLanguageCode(data.code);

  const existing = await prisma.language.findUnique({
    where: { code },
    select: { id: true },
  });
  if (existing)
    throw new AppError("A language with this code already exists.", 409);

  return prisma.language.create({
    data: {
      name,
      code,
      isEnabled: typeof data.isEnabled === "boolean" ? data.isEnabled : true,
      isDefault: false,
    },
  });
}

export async function updateLanguage(id: string, data: LanguageInput) {
  const language = await prisma.language.findUnique({ where: { id } });
  if (!language) throw new AppError("Language not found.", 404);

  const updateData: {
    name?: string;
    code?: string;
    isEnabled?: boolean;
    isDefault?: boolean;
  } = {};

  if (data.name !== undefined)
    updateData.name = normalizeLanguageName(data.name);
  if (data.code !== undefined) {
    const code = normalizeLanguageCode(data.code);
    const existing = await prisma.language.findUnique({
      where: { code },
      select: { id: true },
    });
    if (existing && existing.id !== id)
      throw new AppError("A language with this code already exists.", 409);
    updateData.code = code;
  }
  if (typeof data.isEnabled === "boolean")
    updateData.isEnabled = data.isEnabled;
  if (typeof data.isDefault === "boolean")
    updateData.isDefault = data.isDefault;

  if (language.isDefault && updateData.isEnabled === false) {
    throw new AppError("Default language cannot be disabled.", 400);
  }

  return prisma.$transaction(async (tx) => {
    if (updateData.isDefault === true) {
      await tx.language.updateMany({
        where: { id: { not: id }, isDefault: true },
        data: { isDefault: false },
      });
      updateData.isEnabled = true;
    }

    return tx.language.update({
      where: { id },
      data: updateData,
    });
  });
}

export async function getProductTranslations(productId: string) {
  const langs = await prisma.language.findMany({ where: { isEnabled: true } });
  const translations = await prisma.productTranslation.findMany({
    where: { productId },
    include: { language: true },
  });
  return langs.map((lang) => ({
    language: lang,
    translation: translations.find((t) => t.languageId === lang.id) || null,
  }));
}

export const updateTranslation = (id: string, data: object) =>
  prisma.productTranslation.update({ where: { id }, data: data as never });

export async function upsertProductTranslation(
  productId: string,
  languageId: string,
  data: ProductTranslationInput,
) {
  const [product, language] = await Promise.all([
    prisma.product.findUnique({
      where: { id: productId },
      select: { id: true },
    }),
    prisma.language.findUnique({
      where: { id: languageId },
      select: { id: true },
    }),
  ]);

  if (!product) throw new AppError("Product not found.", 404);
  if (!language) throw new AppError("Language not found.", 404);

  const manualSave = data.isAiGenerated !== true;

  // Parse JSON string fields before persisting while preserving non-string values.
  const parseJsonField = (value: unknown) => {
    if (value === undefined) return undefined;
    if (value === null) return null;

    if (typeof value !== "string") {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  };


// Normalize only the fields included in the current request to avoid
// overwriting unrelated translation fields during partial updates.
  const normalizedData = { ...data };

  if ("highlights" in data) {
    normalizedData.highlights = parseJsonField(data.highlights);
  }

  if ("technicalSpecs" in data) {
    normalizedData.technicalSpecs = parseJsonField(data.technicalSpecs);
  }

  if ("warranty" in data) {
    normalizedData.warranty = parseJsonField(data.warranty);
  }

  if ("primaryFeatures" in data) {
    normalizedData.primaryFeatures = parseJsonField(data.primaryFeatures);
  }

  return prisma.productTranslation.upsert({
    where: { productId_languageId: { productId, languageId } },
    create: {
      productId,
      languageId,
      ...normalizedData,
      status: normalizedData.isAiGenerated
        ? TranslationStatus.PENDING_REVIEW
        : TranslationStatus.APPROVED,
      reviewedAt: normalizedData.isAiGenerated ? null : new Date(),
    } as any,
    update: {
      ...normalizedData,
      ...(manualSave
        ? {
            status: TranslationStatus.APPROVED,
            reviewedAt: new Date(),
            isAiGenerated: false,
          }
        : {}),
    } as any,
    include: { language: true },
  });
}

export async function upsertCategoryTranslation(
  categoryId: string,
  languageId: string,
  data: CategoryTranslationInput,
) {
  if (data.description) {
    const plainText = data.description
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "")
      .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, "")
      .replace(/<[^>]*>/g, "")
      .replace(/&nbsp;/gi, " ")
      .trim();
    if (plainText.length > CATEGORY_DESCRIPTION_MAX_LENGTH) {
      throw new AppError(
        `Category translation description cannot exceed ${CATEGORY_DESCRIPTION_MAX_LENGTH} characters.`,
        400,
      );
    }
  }

  const [category, language] = await Promise.all([
    prisma.category.findUnique({
      where: { id: categoryId },
      select: { id: true },
    }),
    prisma.language.findUnique({
      where: { id: languageId },
      select: { id: true },
    }),
  ]);

  if (!category) throw new AppError("Category not found.", 404);
  if (!language) throw new AppError("Language not found.", 404);

  return prisma.categoryTranslation.upsert({
    where: { categoryId_languageId: { categoryId, languageId } },
    create: {
      categoryId,
      languageId,
      ...data,
      status: TranslationStatus.APPROVED,
      reviewedAt: new Date(),
    },
    update: {
      ...data,
      status: TranslationStatus.APPROVED,
      reviewedAt: new Date(),
    },
    include: { language: true },
  });
}

export async function generateTranslations(
  productId: string,
  languageId?: string,
) {
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      productCode: true,
      brand: true,
      shortDescription: true,
      description: true,
      seoTitle: true,
      seoDescription: true,
      seoKeywords: true,
      highlights: true,
      technicalSpecs: true,
      warranty: true,
      primaryFeatures: true,
    },
  });
  if (!product) throw new AppError("Product not found.", 404);

  const languages = await prisma.language.findMany({
    where: {
      isEnabled: true,
      isDefault: false,
      ...(languageId ? { id: languageId } : {}),
    },
    orderBy: { name: "asc" },
  });
  if (!languages.length) throw new AppError("No target languages found.", 400);

  const translations = [];
  for (const language of languages) {
    const content = await generateProductContent(
      product as any,
      `${language.name} (${language.code})`,
    );
    const translation = await prisma.productTranslation.upsert({
      where: { productId_languageId: { productId, languageId: language.id } },
      create: {
        productId,
        languageId: language.id,
        ...content,
        isAiGenerated: true,
        status: TranslationStatus.PENDING_REVIEW,
        reviewedAt: null,
      },
      update: {
        ...content,
        isAiGenerated: true,
        status: TranslationStatus.PENDING_REVIEW,
        reviewedAt: null,
      },
      include: { language: true },
    });
    translations.push(translation);
  }

  return { generated: translations.length, translations };
}

export async function listReviewQueue() {
  return prisma.productTranslation.findMany({
    where: { status: TranslationStatus.PENDING_REVIEW },
    include: {
      language: true,
      product: {
        select: { id: true, title: true, slug: true, productCode: true },
      },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function setProductTranslationStatus(
  id: string,
  status: TranslationStatus,
) {
  const translation = await prisma.productTranslation.findUnique({
    where: { id },
  });
  if (!translation) throw new AppError("Translation not found.", 404);

  if (status === TranslationStatus.PENDING_REVIEW) {
    throw new AppError(
      "Cannot move a translation back to pending review.",
      400,
    );
  }

  return prisma.productTranslation.update({
    where: { id },
    data: {
      status,
      reviewedAt: new Date(),
      ...(status === TranslationStatus.APPROVED
        ? { isAiGenerated: false }
        : {}),
    },
    include: {
      language: true,
      product: { select: { id: true, title: true, slug: true } },
    },
  });
}

export async function bulkApproveProductTranslations(ids: string[]) {
  if (!ids.length) throw new AppError("No translation IDs provided.", 400);

  const result = await prisma.productTranslation.updateMany({
    where: { id: { in: ids }, status: TranslationStatus.PENDING_REVIEW },
    data: {
      status: TranslationStatus.APPROVED,
      reviewedAt: new Date(),
      isAiGenerated: false,
    },
  });

  return { approved: result.count };
}

export async function exportCoverageCsv(
  languageId: string,
  query: { type?: string; priority?: string; search?: string },
) {
  const rows: TranslationCsvRow[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const coverage = await getTranslationCoverage(languageId, {
      ...query,
      page: String(page),
      limit: "100",
    });

    totalPages = coverage.gaps.totalPages;

    for (const gap of coverage.gaps.data) {
      for (const missing of gap.missingFields) {
        rows.push({
          type: gap.type,
          priority: gap.priority,
          entityId: gap.entityId,
          entityLabel: gap.entityLabel,
          context: gap.context ?? "",
          cmsEntityType: gap.cmsEntityType ?? "",
          cmsPageId: gap.cmsPageId ?? "",
          field: missing.field,
          fieldLabel: missing.fieldLabel,
          englishValue: missing.englishValue,
          translation: "",
        });
      }
    }

    page += 1;
  } while (page <= totalPages);

  return Papa.unparse(rows, {
    columns: [
      "type",
      "priority",
      "entityId",
      "entityLabel",
      "context",
      "cmsEntityType",
      "cmsPageId",
      "field",
      "fieldLabel",
      "englishValue",
      "translation",
    ],
  });
}

export async function importTranslationsCsv(
  languageId: string,
  rows: TranslationCsvRow[],
) {
  const language = await prisma.language.findUnique({
    where: { id: languageId },
    select: { id: true, isDefault: true },
  });
  if (!language) throw new AppError("Language not found.", 404);
  if (language.isDefault)
    throw new AppError(
      "Import is only available for non-default languages.",
      400,
    );

  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const [index, row] of rows.entries()) {
    const rowNumber = index + 2;
    const type = row.type?.trim();
    const entityId = row.entityId?.trim();
    const field = row.field?.trim();
    const translation = row.translation?.trim();

    if (!type || !entityId || !field) {
      skipped += 1;
      errors.push(`Row ${rowNumber}: type, entityId and field are required.`);
      continue;
    }

    if (!translation) {
      skipped += 1;
      continue;
    }

    try {
      if (type === "product") {
        if (!PRODUCT_TRANSLATION_FIELDS.has(field))
          throw new AppError(`Unsupported product field '${field}'.`, 400);
        await upsertProductTranslation(entityId, languageId, {
          [field]: translation,
        } as ProductTranslationInput);
      } else if (type === "category") {
        if (!CATEGORY_TRANSLATION_FIELDS.has(field))
          throw new AppError(`Unsupported category field '${field}'.`, 400);
        await upsertCategoryTranslation(entityId, languageId, {
          [field]: translation,
        } as CategoryTranslationInput);
      } else if (type === "static") {
        await upsertKeyword(entityId, languageId, translation);
      } else if (type === "cms") {
        const entityType = row.cmsEntityType?.trim();
        if (!entityType || !CMS_TRANSLATION_ENTITY_TYPES.has(entityType)) {
          throw new AppError("CMS entity type is required for CMS rows.", 400);
        }
        await upsertKeyword(
          cmsTranslationKey(entityType, entityId, field),
          languageId,
          translation,
        );
      } else {
        throw new AppError(`Unsupported translation type '${type}'.`, 400);
      }

      imported += 1;
    } catch (error) {
      skipped += 1;
      errors.push(`Row ${rowNumber}: ${(error as Error).message}`);
    }
  }

  return { imported, skipped, errors };
}

export const listKeywords = (languageId?: string) =>
  prisma.translationKeyword.findMany({
    where: languageId ? { languageId } : {},
    include: { language: true },
  });
export const createKeyword = (data: object) =>
  prisma.translationKeyword.create({ data: data as never });
export const upsertKeyword = (key: string, languageId: string, value: string) =>
  prisma.translationKeyword.upsert({
    where: { key_languageId: { key, languageId } },
    create: { key, languageId, value },
    update: { value },
    include: { language: true },
  });
export const deleteKeyword = (id: string) =>
  prisma.translationKeyword.delete({ where: { id } });

export const listProtectedKeywords = () =>
  prisma.protectedKeyword.findMany({ orderBy: { term: "asc" } });

export async function createProtectedKeyword(
  term: string,
  note?: string | null,
) {
  const normalized = term.trim();
  if (!normalized) throw new AppError("Protected term is required.", 400);

  return prisma.protectedKeyword.create({
    data: { term: normalized, note: note?.trim() || null },
  });
}

export const deleteProtectedKeyword = (id: string) =>
  prisma.protectedKeyword.delete({ where: { id } });

export { getTranslationCoverage } from "./translationCoverage.service";

export async function getProtectedTerms() {
  const rows = await prisma.protectedKeyword.findMany({
    select: { term: true },
    orderBy: { term: "asc" },
  });
  return rows.map((row) => row.term);
}
