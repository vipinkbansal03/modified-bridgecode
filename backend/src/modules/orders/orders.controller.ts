import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./orders.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => { const r = await S.listOrders(req.query as never); return ApiResponse.paginated(res, "Orders.", r.data, { page: r.page, limit: r.limit, total: r.total }); });
export const getOne = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order.", await S.getOrder(String(req.params.id))));
export const updateStatus = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateStatus(String(req.params.id), req.body.status)));
export const updatePayment = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updatePaymentStatus(String(req.params.id), req.body.paymentStatus)));
export const updateShipping = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateShipping(String(req.params.id), req.body)));
export const ship = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order marked as shipped.", await S.shipOrder(String(req.params.id), req.body)));
export const deliver = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Order marked as delivered.", await S.deliverOrder(String(req.params.id))));
export const analytics = asyncHandler(async (_req: AuthRequest, res: Response) => ApiResponse.success(res, "Analytics.", await S.getAnalytics()));
