import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { removeTempFile } from "../../utils/spreadsheet";
import * as S from "./categories.service";
export const list = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Categories fetched.", await S.listCategories(req.query as never)));
export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category fetched.", await S.getCategory(String(req.params.id))));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Category created.", await S.createCategory(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category updated.", await S.updateCategory(String(req.params.id), req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteCategory(String(req.params.id)); return ApiResponse.success(res, "Category deleted."); });
export const permanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => { await S.permanentDeleteCategory(String(req.params.id)); return ApiResponse.success(res, "Category permanently deleted."); });
export const duplicate = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Category duplicated.", await S.duplicateCategory(String(req.params.id))));
export const archive = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category archived.", await S.archiveCategory(String(req.params.id))));
export const restore = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category restored.", await S.restoreCategory(String(req.params.id))));
export const reorder = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!Array.isArray(req.body?.items)) throw new AppError("Reorder payload must include items.", 400);
  return ApiResponse.success(res, "Categories reordered.", await S.reorderCategories(req.body.items));
});
export const listCountries = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category countries fetched.", await S.listCategoryCountries(String(req.params.id))));
export const updateCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  return ApiResponse.success(res, "Category countries updated.", await S.updateCategoryCountries(String(req.params.id), items));
});

export const exportSpreadsheet = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = await S.exportCategoriesSpreadsheet();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="categories-export-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});

export const downloadSampleTemplate = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = S.generateSampleCategoriesTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="categories-template.xlsx"');
  return res.status(200).send(buffer);
});


export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { totalRows: 0, validRows: 0, invalidRows: 0, issues: ["No spreadsheet file provided."] });
  try {
    return ApiResponse.success(res, "Import preview generated.", await S.previewCategoryImport(file.path));
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rows = req.body?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    const result = await S.importCategoriesSpreadsheet(rows);
    return ApiResponse.success(res, "Categories imported successfully.", result);
  }

  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { created: 0, updated: 0, report: { totalRows: 0, validRows: 0, invalidRows: 0, issues: ["No spreadsheet file provided."], duplicateWarnings: [], sampleRows: [] } });
  try {
    return ApiResponse.success(res, "Categories imported successfully.", await S.importCategoriesSpreadsheet(file.path));
  } finally {
    removeTempFile(file.path);
  }
});
