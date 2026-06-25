import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import { createCustomerOrderSchema } from "./customerOrders.validation";
import * as CustomerOrdersService from "./customerOrders.service";

export const create = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const input = createCustomerOrderSchema.parse(req.body);
  const order = await CustomerOrdersService.createCustomerOrder(req.customer.id, input);
  return ApiResponse.created(res, "Order created successfully.", order);
});

export const list = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orders = await CustomerOrdersService.listCustomerOrders(req.customer.id);
  return ApiResponse.success(res, "Orders.", orders);
});
