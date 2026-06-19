import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./categories.service";
export const list = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Categories fetched.", await S.listCategories()));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Category created.", await S.createCategory(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Category updated.", await S.updateCategory(req.params.id, req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteCategory(req.params.id); return ApiResponse.success(res, "Category deleted."); });
