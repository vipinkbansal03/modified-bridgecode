import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./countries.service";
export const list = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "OK", await S.listCountries(req.query as { status?: string })));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Created.", await S.createCountry(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateCountry(String(req.params.id), req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Deleted.", await S.deleteCountry(String(req.params.id))));
export const bulk = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Bulk action completed.", await S.bulkUpdateCountries(req.body)));
