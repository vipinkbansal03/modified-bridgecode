import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./warehouse.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const query = {
    ...req.query,
    requestingUserId: req.user?.id,
  };
  const r = await S.listWarehouses(query as any);
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
  const w = await S.deleteWarehouse(req.params.id);
  return ApiResponse.success(res, "Warehouse archived successfully.", w);
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const w = await S.restoreWarehouse(req.params.id);
  return ApiResponse.success(res, "Warehouse restored successfully.", w);
});

export const permanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.permanentDeleteWarehouse(req.params.id);
  return ApiResponse.success(res, "Warehouse permanently deleted.", null);
});

export const bulkPermanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids: string[] = Array.isArray(req.body?.ids) ? req.body.ids : [];
  const result = await S.bulkPermanentDeleteWarehouses(ids);
  return ApiResponse.success(res, "Bulk permanent delete processed.", result);
});

