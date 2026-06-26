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

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.updateCustomerProfile(req.params.id, req.body);
  return ApiResponse.success(res, "Customer updated.", customer);
});

export const approve = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.approveCustomer(req.params.id);
  return ApiResponse.success(res, "Customer approved.", customer);
});

export const reject = asyncHandler(async (req: AuthRequest, res: Response) => {
  const customer = await CustomersService.rejectCustomer(req.params.id);
  return ApiResponse.success(res, "Customer rejected.", customer);
});

export const updateTier = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tierId = req.body?.tierId === "" ? null : req.body?.tierId ?? null;
  const customer = await CustomersService.updateCustomerTier(req.params.id, tierId);
  return ApiResponse.success(res, "Customer tier updated.", customer);
});

export const listOrders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const orders = await CustomersService.listCustomerOrders(req.params.id);
  return ApiResponse.success(res, "Customer orders fetched.", orders);
});

export const listAddresses = asyncHandler(async (req: AuthRequest, res: Response) => {
  const addresses = await CustomersService.listCustomerAddresses(req.params.id);
  return ApiResponse.success(res, "Customer addresses fetched.", addresses);
});
