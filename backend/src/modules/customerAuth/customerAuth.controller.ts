import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import {
  customerLoginSchema,
  customerRegisterSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from "./customerAuth.validation";
import * as CustomerAuthService from "./customerAuth.service";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";

export const register = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = customerRegisterSchema.parse(req.body);
  const result = await CustomerAuthService.register(input);
  return ApiResponse.created(res, "Customer registered successfully.", result);
});

export const login = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = customerLoginSchema.parse(req.body);
  const result = await CustomerAuthService.login(input);
  return ApiResponse.success(res, "Logged in successfully.", result);
});

export const forgotPassword = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = forgotPasswordSchema.parse(req.body);
  const result = await CustomerAuthService.forgotPassword(input);
  return ApiResponse.success(res, result.message);
});

export const resetPassword = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  const result = await CustomerAuthService.resetPassword(input);
  return ApiResponse.success(res, result.message);
});
