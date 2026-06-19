import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./shipping.service";
export const listProviders = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Providers.", await S.listProviders()));
export const upsertProvider = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Saved.", await S.upsertProvider(req.body)));
export const listZones = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Zones.", await S.listZones()));
export const createZone = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Zone created.", await S.createZone(req.body)));
export const updateZone = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateZone(req.params.id, req.body)));
