import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as BannersService from "./banners.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Banners fetched.", await BannersService.listBanners(req.query as never))
);
export const getOne = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Banner fetched.", await BannersService.getBanner(String(req.params.id)))
);
export const create = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Banner created.", await BannersService.createBanner(req.body))
);
export const update = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Banner updated.", await BannersService.updateBanner(String(req.params.id), req.body))
);
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await BannersService.deleteBanner(String(req.params.id));
  return ApiResponse.success(res, "Banner deleted.");
});
export const reorder = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Banners reordered.", await BannersService.reorderBanners(req.body?.ids))
);
export const bulk = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Bulk banner action complete.", await BannersService.bulkUpdateBanners(req.body))
);
export const publicList = asyncHandler(async (req, res: Response) =>
  ApiResponse.success(res, "Banners fetched.", await BannersService.listPublicBanners(req.query as never))
);
