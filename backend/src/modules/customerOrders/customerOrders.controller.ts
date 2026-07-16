import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import { createCustomerOrderSchema } from "./customerOrders.validation";
import * as CustomerOrdersService from "./customerOrders.service";
import { generateInvoice } from "../orders/invoice.service";

export const create = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const input = createCustomerOrderSchema.parse(req.body);
  const order = await CustomerOrdersService.createCustomerOrder(req.customer.id, input);
  return ApiResponse.created(res, "Order created successfully.", order);
});

export const estimate = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  console.log("ESTIMATE REQ.BODY:", JSON.stringify(req.body, null, 2));
  const input = createCustomerOrderSchema.parse(req.body);
  console.log("PARSED ESTIMATE INPUT:", JSON.stringify(input, null, 2));
  const estimateResult = await CustomerOrdersService.estimateCustomerOrder(req.customer.id, input);
  console.log("ESTIMATE RESULT:", JSON.stringify(estimateResult, null, 2));
  return ApiResponse.success(res, "Order estimate calculated.", estimateResult);
});

export const list = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orders = await CustomerOrdersService.listCustomerOrders(req.customer.id);
  return ApiResponse.success(res, "Orders.", orders);
});

export const invoice = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  await CustomerOrdersService.assertCustomerInvoiceAccess(req.customer.id, orderId);
  const pdf = await generateInvoice(orderId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="invoice-${orderId}.pdf"`);
  res.send(pdf);
});
