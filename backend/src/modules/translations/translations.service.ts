import { TranslationStatus } from "@prisma/client";
import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";
import { generateProductContent } from "../ai/ai.service";

type ProductTranslationInput = {
  title?: string | null;
  shortDescription?: string | null;
  description?: string | null;
  seoTitle?: string | null;
  seoDescription?: string | null;
  isAiGenerated?: boolean;
  status?: TranslationStatus;
};

type CategoryTranslationInput = {
  name?: string | null;
  description?: string | null;
};

export const listLanguages = () => prisma.language.findMany({ orderBy: { name: "asc" } });
export const createLanguage = (data: object) => prisma.language.create({ data: data as never });

export async function getProductTranslations(productId: string) {
  const langs = await prisma.language.findMany({ where: { isEnabled: true } });
  const translations = await prisma.productTranslation.findMany({ where: { productId }, include: { language: true } });
  return langs.map((lang) => ({
    language: lang,
    translation: translations.find((t) => t.languageId === lang.id) || null,
  }));
}

export const updateTranslation = (id: string, data: object) => prisma.productTranslation.update({ where: { id }, data: data as never });

export async function upsertProductTranslation(productId: string, languageId: string, data: ProductTranslationInput) {
  const [product, language] = await Promise.all([
    prisma.product.findUnique({ where: { id: productId }, select: { id: true } }),
    prisma.language.findUnique({ where: { id: languageId }, select: { id: true } }),
  ]);

  if (!product) throw new AppError("Product not found.", 404);
  if (!language) throw new AppError("Language not found.", 404);

  const manualSave = data.isAiGenerated !== true;

  return prisma.productTranslation.upsert({
    where: { productId_languageId: { productId, languageId } },
    create: {
      productId,
      languageId,
      ...data,
      status: data.isAiGenerated ? TranslationStatus.PENDING_REVIEW : TranslationStatus.APPROVED,
      reviewedAt: data.isAiGenerated ? null : new Date(),
    },
    update: {
      ...data,
      ...(manualSave
        ? {
            status: TranslationStatus.APPROVED,
            reviewedAt: new Date(),
            isAiGenerated: false,
          }
        : {}),
    },
    include: { language: true },
  });
}

export async function upsertCategoryTranslation(categoryId: string, languageId: string, data: CategoryTranslationInput) {
  const [category, language] = await Promise.all([
    prisma.category.findUnique({ where: { id: categoryId }, select: { id: true } }),
    prisma.language.findUnique({ where: { id: languageId }, select: { id: true } }),
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

export async function generateTranslations(productId: string, languageId?: string) {
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
    const content = await generateProductContent(product, `${language.name} (${language.code})`);
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
      product: { select: { id: true, title: true, slug: true, productCode: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
}

export async function setProductTranslationStatus(id: string, status: TranslationStatus) {
  const translation = await prisma.productTranslation.findUnique({ where: { id } });
  if (!translation) throw new AppError("Translation not found.", 404);

  if (status === TranslationStatus.PENDING_REVIEW) {
    throw new AppError("Cannot move a translation back to pending review.", 400);
  }

  return prisma.productTranslation.update({
    where: { id },
    data: {
      status,
      reviewedAt: new Date(),
      ...(status === TranslationStatus.APPROVED ? { isAiGenerated: false } : {}),
    },
    include: { language: true, product: { select: { id: true, title: true, slug: true } } },
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

export const listKeywords = (languageId?: string) => prisma.translationKeyword.findMany({ where: languageId ? { languageId } : {}, include: { language: true } });
export const createKeyword = (data: object) => prisma.translationKeyword.create({ data: data as never });
export const upsertKeyword = (key: string, languageId: string, value: string) =>
  prisma.translationKeyword.upsert({
    where: { key_languageId: { key, languageId } },
    create: { key, languageId, value },
    update: { value },
    include: { language: true },
  });
export const deleteKeyword = (id: string) => prisma.translationKeyword.delete({ where: { id } });

export const listProtectedKeywords = () =>
  prisma.protectedKeyword.findMany({ orderBy: { term: "asc" } });

export async function createProtectedKeyword(term: string, note?: string | null) {
  const normalized = term.trim();
  if (!normalized) throw new AppError("Protected term is required.", 400);

  return prisma.protectedKeyword.create({
    data: { term: normalized, note: note?.trim() || null },
  });
}

export const deleteProtectedKeyword = (id: string) => prisma.protectedKeyword.delete({ where: { id } });

export { getTranslationCoverage } from "./translationCoverage.service";

export async function getProtectedTerms() {
  const rows = await prisma.protectedKeyword.findMany({ select: { term: true }, orderBy: { term: "asc" } });
  return rows.map((row) => row.term);
}
