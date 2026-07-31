import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./warehouse.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listWarehouses(req.query as never);
  return ApiResponse.paginated(res, "Warehouses fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const w = await S.createWarehouse(req.body);
  return ApiResponse.created(res, "Warehouse created.", w);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const w = await S.updateWarehouse(req.params.id, req.body);
  return ApiResponse.success(res, "Warehouse updated.", w);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteWarehouse(req.params.id);
  return ApiResponse.success(res, "Warehouse deleted.", null);
});
