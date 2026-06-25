import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./currencies.service";
export const list = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "OK", await S.listCurrencies()));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Created.", await S.createCurrency(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateCurrency(String(req.params.id), req.body)));
export const syncRates = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Rates synced.", await S.syncExchangeRates()));
