import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./categories.service";
export const list = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Categories fetched.", await S.listCategories()));
export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category fetched.", await S.getCategory(String(req.params.id))));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Category created.", await S.createCategory(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category updated.", await S.updateCategory(String(req.params.id), req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteCategory(String(req.params.id)); return ApiResponse.success(res, "Category deleted."); });
export const reorder = asyncHandler(async (req: AuthRequest, res: Response) => {
  if (!Array.isArray(req.body?.items)) throw new AppError("Reorder payload must include items.", 400);
  return ApiResponse.success(res, "Categories reordered.", await S.reorderCategories(req.body.items));
});
export const listCountries = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category countries fetched.", await S.listCategoryCountries(String(req.params.id))));
export const updateCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  return ApiResponse.success(res, "Category countries updated.", await S.updateCategoryCountries(String(req.params.id), items));
});
