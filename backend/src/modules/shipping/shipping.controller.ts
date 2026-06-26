import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./shipping.service";

export const listProviders = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Providers.", await S.listProviders()));
export const upsertProvider = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Saved.", await S.upsertProvider(req.body)));
export const listZones = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Zones.", await S.listZones()));
export const createZone = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Zone created.", await S.createZone(req.body)));
export const updateZone = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateZone(String(req.params.id), req.body)));
export const deleteZone = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Deleted.", await S.deleteZone(String(req.params.id))));
export const calculate = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { countryCode, orderTotal } = req.body as { countryCode: string; orderTotal: number };
  return ApiResponse.success(res, "Shipping calculated.", await S.calculateShipping(countryCode, orderTotal));
});

export const calculatePublic = asyncHandler(async (req: Request, res: Response) => {
  const { countryCode, orderValue, orderTotal } = req.body as { countryCode?: string; orderValue?: number; orderTotal?: number };
  return ApiResponse.success(res, "Shipping calculated.", await S.calculateShipping(String(countryCode ?? "").toUpperCase(), Number(orderValue ?? orderTotal ?? 0)));
});
