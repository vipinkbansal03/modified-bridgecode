import { prisma } from "../../config/database";
import { AppError } from "../../utils/apiResponse";

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

export async function generateTranslations(productId: string) {
  // AI provider is injected via the AI module — this is the scaffold hook
  const product = await prisma.product.findUnique({ where: { id: productId } });
  if (!product) throw new AppError("Product not found.", 404);
  // TODO: Call ai/translations.service.ts -> LangChain chain -> write back
  return { message: "Connect to AI module (ai/translations.service.ts) to auto-generate." };
}

export const listKeywords = (languageId?: string) => prisma.translationKeyword.findMany({ where: languageId ? { languageId } : {}, include: { language: true } });
export const createKeyword = (data: object) => prisma.translationKeyword.create({ data: data as never });
export const deleteKeyword = (id: string) => prisma.translationKeyword.delete({ where: { id } });
