import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as TiersService from "./tiers.service";

export const list = asyncHandler(async (_req, res: Response) => {
  const tiers = await TiersService.listTiers();
  return ApiResponse.success(res, "Tiers fetched.", tiers);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tier = await TiersService.createTier(req.body);
  return ApiResponse.created(res, "Tier created.", tier);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tier = await TiersService.updateTier(String(req.params.id), req.body);
  return ApiResponse.success(res, "Tier updated.", tier);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await TiersService.deleteTier(String(req.params.id));
  return ApiResponse.success(res, "Tier deleted.");
});

export const reorder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  const tiers = await TiersService.reorderTiers(items);
  return ApiResponse.success(res, "Tiers reordered.", tiers);
});

export const listCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const countries = await TiersService.listTierCountries(String(req.params.id));
  return ApiResponse.success(res, "Tier countries fetched.", countries);
});

export const updateCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  const countries = await TiersService.updateTierCountries(String(req.params.id), items);
  return ApiResponse.success(res, "Tier countries updated.", countries);
});
