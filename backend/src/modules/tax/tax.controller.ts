import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as TaxService from "./tax.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TaxService.listTaxRules(req.query as never);
  return ApiResponse.paginated(res, "Tax rules fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await TaxService.createTaxRule(req.body);
  return ApiResponse.created(res, "Tax rule created.", rule);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rule = await TaxService.updateTaxRule(req.params.id, req.body);
  return ApiResponse.success(res, "Tax rule updated.", rule);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await TaxService.deleteTaxRule(req.params.id);
  return ApiResponse.success(res, "Tax rule deleted.");
});
