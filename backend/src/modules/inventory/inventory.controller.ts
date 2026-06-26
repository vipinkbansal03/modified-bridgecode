import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./inventory.service";
export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listInventory(req.query as never);
  return ApiResponse.paginated(res, "Inventory fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateInventory(String(req.params.id), req.body)));
export const alerts = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Alerts.", await S.getLowStockAlerts()));
export const listAdjustments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listInventoryAdjustments(req.query as never);
  return ApiResponse.paginated(res, "Inventory adjustments fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});
export const listVariantAdjustments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listVariantInventoryAdjustments(String(req.params.variantId), req.query as never);
  return ApiResponse.paginated(res, "Variant inventory adjustments fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});
