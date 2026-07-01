import { Response } from "express";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";
import { AuthRequest } from "../../middleware/auth.middleware";
import { ApiResponse, AppError, asyncHandler } from "../../utils/apiResponse";
import * as couponService from "./coupons.service";

export const list = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const result = await couponService.listCoupons(req.query as never);
  return ApiResponse.paginated(res, "Coupons.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const create = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const coupon = await couponService.createCoupon(req.body);
  return ApiResponse.created(res, "Coupon created.", coupon);
});

export const update = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const coupon = await couponService.updateCoupon(String(req.params.id), req.body);
  return ApiResponse.success(res, "Coupon updated.", coupon);
});

export const remove = asyncHandler<AuthRequest>(async (req, res: Response) => {
  await couponService.deleteCoupon(String(req.params.id));
  return ApiResponse.success(res, "Coupon deleted.");
});

export const validate = asyncHandler<AuthRequest>(async (req, res: Response) => {
  const result = await couponService.validateCoupon(
    String(req.body.code ?? ""),
    Number(req.body.orderTotal ?? req.body.orderValue ?? 0),
    req.body.countryCode,
  );
  return ApiResponse.success(res, "Coupon valid.", result.public);
});

export const validateCheckout = asyncHandler<CustomerAuthRequest>(async (req, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);

  const result = await couponService.validateCoupon(
    String(req.body.code ?? ""),
    Number(req.body.orderValue ?? 0),
    req.body.countryCode,
  );
  return ApiResponse.success(res, "Coupon valid.", result.public);
});
