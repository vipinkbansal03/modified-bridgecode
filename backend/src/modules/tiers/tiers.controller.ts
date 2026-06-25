import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import * as TiersService from "./tiers.service";

export const list = asyncHandler(async (_req, res: Response) => {
  const tiers = await TiersService.listTiers();
  return ApiResponse.success(res, "Tiers fetched.", tiers);
});
