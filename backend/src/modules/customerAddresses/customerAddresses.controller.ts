import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import * as CustomerAddressesService from "./customerAddresses.service";

export const list = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const addresses = await CustomerAddressesService.listCustomerAddresses(req.customer.id);
  return ApiResponse.success(res, "Addresses.", addresses);
});
