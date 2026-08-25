import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./orders.service";
import { generateInvoice } from "./invoice.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => { const r = await S.listOrders(req.query as never); return ApiResponse.paginated(res, "Orders.", r.data, { page: r.page, limit: r.limit, total: r.total }); });
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Order created.", await S.createAdminOrder(req.body)));
export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order.", await S.getOrder(String(req.params.id))));
export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateStatus(String(req.params.id), req.body.status)));
export const updatePayment = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updatePaymentStatus(String(req.params.id), req.body.paymentStatus)));
export const updateShipping = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateShipping(String(req.params.id), req.body)));
export const ship = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order marked as shipped.", await S.shipOrder(String(req.params.id), req.body)));
export const deliver = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order marked as delivered.", await S.deliverOrder(String(req.params.id))));
export const analytics = asyncHandler(async (_req: AuthRequest, res: Response) => ApiResponse.success(res, "Analytics.", await S.getAnalytics()));
export const invoice = asyncHandler(async (req: AuthRequest, res: Response) => {
  const id = String(req.params.id);
  const { buffer, filename } = await generateInvoice(id);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.send(buffer);
});
export const deleteOne = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteOrder(String(req.params.id));
  return ApiResponse.success(res, "Order deleted.");
});

export const refundCancelledOrder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { refundMethod, transactionReference } = req.body;
  const result = await S.refundCancelledOrder(String(req.params.id), refundMethod, transactionReference);
  return ApiResponse.success(res, "Cancelled order refund processed successfully.", result);
});
