import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./ai.service";
export const generate = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Content generated.", await S.generateProductContent(req.body.productTitle, req.body.targetLanguage)));
export const translate = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Translated.", await S.translateText(req.body.text, req.body.targetLanguage)));
