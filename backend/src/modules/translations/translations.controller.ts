import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./translations.service";
export const listLanguages = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Languages.", await S.listLanguages()));
export const createLanguage = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Language added.", await S.createLanguage(req.body)));
export const getProductTranslations = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translations.", await S.getProductTranslations(req.params.productId)));
export const updateTranslation = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateTranslation(req.params.id, req.body)));
export const generateTranslations = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Generating.", await S.generateTranslations(req.body.productId)));
export const listKeywords = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Keywords.", await S.listKeywords(req.query.languageId as string)));
export const createKeyword = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Keyword added.", await S.createKeyword(req.body)));
export const deleteKeyword = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteKeyword(req.params.id); return ApiResponse.success(res, "Deleted."); });
