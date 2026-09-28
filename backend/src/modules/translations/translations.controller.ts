import { Response } from "express";
import { TranslationStatus } from "@prisma/client";
import fs from "fs";
import Papa from "papaparse";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./translations.service";

export const listLanguages = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Languages.", await S.listLanguages()));
export const getTranslationCoverage = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(
    res,
    "Translation coverage.",
    await S.getTranslationCoverage(
      req.query.languageId ? String(req.query.languageId) : "",
      req.query as { type?: string; priority?: string; page?: string; limit?: string; search?: string },
    ),
  ),
);
export const exportCoverageCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
  const csv = await S.exportCoverageCsv(
    req.query.languageId ? String(req.query.languageId) : "",
    req.query as { type?: string; priority?: string; search?: string },
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="translation-coverage-${Date.now()}.csv"`);
  return res.status(200).send(csv);
});
export const importTranslationsCsv = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No CSV file uploaded.", { imported: 0, skipped: 0, errors: ["No CSV file provided."] });

  const csvText = fs.readFileSync(file.path, "utf-8");
  fs.unlinkSync(file.path);

  const { data, errors: parseErrors } = Papa.parse<Record<string, string>>(csvText, {
    header: true,
    skipEmptyLines: true,
  });

  if (parseErrors.length) {
    return ApiResponse.success(res, "CSV parse error.", {
      imported: 0,
      skipped: 0,
      errors: parseErrors.map((error) => error.message),
    });
  }

  const result = await S.importTranslationsCsv(req.query.languageId ? String(req.query.languageId) : "", data);
  return ApiResponse.success(res, `Import complete: ${result.imported} imported, ${result.skipped} skipped.`, result);
});
export const createLanguage = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Language added.", await S.createLanguage(req.body)));
export const updateLanguage = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Language updated.", await S.updateLanguage(String(req.params.id), req.body)));
export const deleteLanguage = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteLanguage(String(req.params.id)); return ApiResponse.success(res, "Language deleted."); });
export const getProductTranslations = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translations.", await S.getProductTranslations(String(req.params.productId))));
export const updateTranslation = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateTranslation(String(req.params.id), req.body)));
export const upsertProductTranslation = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Saved.", await S.upsertProductTranslation(String(req.params.productId), String(req.params.languageId), req.body)));
export const upsertCategoryTranslation = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Saved.", await S.upsertCategoryTranslation(String(req.params.categoryId), String(req.params.languageId), req.body)));
export const generateTranslations = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translations generated.", await S.generateTranslations(String(req.body.productId), req.body.languageId ? String(req.body.languageId) : undefined)));
export const listReviewQueue = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Review queue.", await S.listReviewQueue()));
export const approveTranslation = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translation approved.", await S.setProductTranslationStatus(String(req.params.id), TranslationStatus.APPROVED)));
export const rejectTranslation = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translation rejected.", await S.setProductTranslationStatus(String(req.params.id), TranslationStatus.REJECTED)));
export const bulkApproveTranslations = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translations approved.", await S.bulkApproveProductTranslations((req.body.ids as string[]) || [])));
export const listKeywords = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Keywords.", await S.listKeywords(req.query.languageId as string)));
export const createKeyword = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Keyword added.", await S.createKeyword(req.body)));
export const upsertKeyword = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Keyword saved.", await S.upsertKeyword(String(req.body.key), String(req.body.languageId), String(req.body.value ?? ""))));
export const deleteKeyword = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteKeyword(String(req.params.id)); return ApiResponse.success(res, "Deleted."); });
export const listProtectedKeywords = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Protected keywords.", await S.listProtectedKeywords()));
export const createProtectedKeyword = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Protected keyword added.", await S.createProtectedKeyword(String(req.body.term), req.body.note ? String(req.body.note) : null)));
export const deleteProtectedKeyword = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteProtectedKeyword(String(req.params.id)); return ApiResponse.success(res, "Deleted."); });
