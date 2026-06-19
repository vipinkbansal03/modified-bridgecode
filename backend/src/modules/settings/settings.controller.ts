import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./settings.service";
export const get = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Settings.", await S.getSettings(req.query.group as string)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Settings updated.", await S.updateSettings(req.body.settings)));
