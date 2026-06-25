import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as DiscountsService from "./discounts.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await DiscountsService.listDiscounts(req.query as never);
  return ApiResponse.paginated(res, "Discounts fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const discount = await DiscountsService.createDiscount(req.body);
  return ApiResponse.created(res, "Discount created.", discount);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const discount = await DiscountsService.updateDiscount(req.params.id, req.body);
  return ApiResponse.success(res, "Discount updated.", discount);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await DiscountsService.deleteDiscount(req.params.id);
  return ApiResponse.success(res, "Discount deleted.");
});
