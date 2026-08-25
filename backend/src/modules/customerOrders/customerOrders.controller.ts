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
  const { buffer, filename } = await generateInvoice(orderId);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});

export const createRazorpayOrder = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  const data = await CustomerOrdersService.createRazorpayOrder(req.customer.id, orderId);
  return ApiResponse.success(res, "Razorpay order created.", data);
});

export const verifyRazorpayPayment = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  const { razorpay_payment_id, razorpay_order_id, razorpay_signature } = req.body;
  if (!razorpay_payment_id || !razorpay_order_id || !razorpay_signature) {
    throw new AppError("Missing Razorpay payment parameters.", 400);
  }
  const order = await CustomerOrdersService.verifyRazorpayPayment(req.customer.id, orderId, {
    razorpay_payment_id,
    razorpay_order_id,
    razorpay_signature,
  });
  return ApiResponse.success(res, "Payment verified successfully.", order);
});

export const getPaymentSession = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  const session = await CustomerOrdersService.getPaymentSessionForCustomer(req.customer.id, orderId);
  return ApiResponse.success(res, "Payment session retrieved.", session);
});

export const recordFailure = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  const { gatewayOrderId, errorCode, errorMessage } = req.body;
  const result = await CustomerOrdersService.recordClientPaymentFailure(req.customer.id, orderId, {
    gatewayOrderId,
    errorCode,
    errorMessage,
  });
  return ApiResponse.success(res, "Payment failure recorded.", result);
});

export const getTracking = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  const tracking = await CustomerOrdersService.getCustomerOrderTracking(req.customer.id, orderId);
  return ApiResponse.success(res, "Order tracking retrieved.", tracking);
});

export const cancelOrder = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const orderId = String(req.params.id);
  const { reason, refundDetails } = req.body;
  const result = await CustomerOrdersService.cancelCustomerOrder(req.customer.id, orderId, {
    reason,
    refundDetails,
  });
  return ApiResponse.success(res, "Order cancelled successfully.", result);
});
