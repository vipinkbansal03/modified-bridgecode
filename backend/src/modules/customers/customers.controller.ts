import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as CustomersService from "./customers.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await CustomersService.listCustomers(req.query as never);
  return ApiResponse.paginated(res, "Customers fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.getCustomer(req.params.id);
  return ApiResponse.success(res, "Customer fetched.", customer);
});

export const updateTier = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tierId = req.body?.tierId === "" ? null : req.body?.tierId ?? null;
  const customer = await CustomersService.updateCustomerTier(req.params.id, tierId);
  return ApiResponse.success(res, "Customer tier updated.", customer);
});
