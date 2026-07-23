import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import * as CustomerAddressesService from "./customerAddresses.service";

export const list = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const addresses = await CustomerAddressesService.listCustomerAddresses(req.customer.id);
  return ApiResponse.success(res, "Addresses.", addresses);
});

export const create = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const address = await CustomerAddressesService.createCustomerAddress(req.customer.id, req.body);
  return ApiResponse.created(res, "Address created successfully.", address);
});

export const update = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const address = await CustomerAddressesService.updateCustomerAddress(req.customer.id, req.params.id, req.body);
  return ApiResponse.success(res, "Address updated successfully.", address);
});

export const remove = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const result = await CustomerAddressesService.deleteCustomerAddress(req.customer.id, req.params.id);
  return ApiResponse.success(res, "Address deleted successfully.", result);
});

export const setDefault = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const address = await CustomerAddressesService.setDefaultCustomerAddress(req.customer.id, req.params.id);
  return ApiResponse.success(res, "Default address set successfully.", address);
});
