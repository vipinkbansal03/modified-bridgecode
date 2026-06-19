import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./coupons.service";
export const list = asyncHandler(async (req: AuthRequest, res: Response) => { const r = await S.listCoupons(req.query as never); return ApiResponse.paginated(res, "Coupons.", r.data, { page: r.page, limit: r.limit, total: r.total }); });
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Coupon created.", await S.createCoupon(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateCoupon(req.params.id, req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteCoupon(req.params.id); return ApiResponse.success(res, "Deleted."); });
export const validate = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Coupon valid.", await S.validateCoupon(req.body.code, req.body.orderTotal)));
