import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../config/database";
import * as S from "./pricing.service";
export const list = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Pricing fetched.", await S.listPricing(req.query.productId as string)));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Price created.", await S.createPrice(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Price updated.", await S.updatePrice(req.params.id, req.body)));
export const generateForCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const baseCurrency = await prisma.currency.findFirst({ where: { isBase: true } });
  if (!baseCurrency) throw new AppError("No base currency configured.", 400);
  const count = await S.generateCountryPrices(req.body.productId, req.body.basePrice, baseCurrency.id);
  return ApiResponse.success(res, `${count} country prices generated.`);
});
