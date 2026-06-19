import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./countries.service";
export const list = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "OK", await S.listCountries()));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Created.", await S.createCountry(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateCountry(req.params.id, req.body)));
