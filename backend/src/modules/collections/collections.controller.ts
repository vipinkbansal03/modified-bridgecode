import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as CollectionsService from "./collections.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await CollectionsService.listCollections(req.query as never);
  return ApiResponse.paginated(res, "Collections fetched.", result.data, { page: result.page, limit: result.limit, total: result.total });
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Collection fetched.", await CollectionsService.getCollection(req.params.id))
);

export const create = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Collection created.", await CollectionsService.createCollection(req.body))
);

export const update = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Collection updated.", await CollectionsService.updateCollection(req.params.id, req.body))
);

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await CollectionsService.deleteCollection(req.params.id);
  return ApiResponse.success(res, "Collection deleted.");
});

export const listCountries = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Collection countries fetched.", await CollectionsService.listCollectionCountries(req.params.id))
);

export const updateCountries = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Collection countries updated.", await CollectionsService.updateCollectionCountries(req.params.id, req.body.items))
);

export const listDiscounts = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Collection discounts fetched.", await CollectionsService.listCollectionDiscounts(req.params.id))
);

export const createDiscount = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.created(res, "Collection discount created.", await CollectionsService.createCollectionDiscount(req.params.id, req.body))
);

export const removeDiscount = asyncHandler(async (req: AuthRequest, res: Response) => {
  await CollectionsService.deleteCollectionDiscount(req.params.id, req.params.discountId);
  return ApiResponse.success(res, "Collection discount removed.");
});
