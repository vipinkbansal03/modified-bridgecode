import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./productFilters.service";

export const get = asyncHandler(async (_req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Product filters config.", await S.getGlobalProductFiltersConfig())
);

export const update = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Product filters config updated.", await S.updateGlobalProductFiltersConfig(req.body))
);

// Per-product storefront filter visibility
export const getVisibility = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ApiResponse.success(
    res,
    "Product filter visibility.",
    await S.getProductFilterVisibility(req.params.id as string),
  );
});

export const setVisibility = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ApiResponse.success(
    res,
    "Product filter visibility updated.",
    await S.setProductFilterVisibility(req.params.id as string, req.body.items ?? []),
  );
});

// Public
export const publicConfig = asyncHandler(async (_req: AuthRequest, res: Response) => {
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
  return ApiResponse.success(res, "Product filters config.", await S.getPublicProductFiltersConfig());
});