import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import {
  customerLoginSchema,
  sendLoginOtpSchema,
  customerRegisterSchema,
  verifyLoginOtpSchema,
  verifyRegisterOtpSchema,
  resendOtpSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  updateCustomerProfileSchema,
} from "./customerAuth.validation";
import * as CustomerAuthService from "./customerAuth.service";
import { CustomerAuthRequest } from "../../middleware/customerAuth.middleware";

export const register = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = customerRegisterSchema.parse(req.body);
  const result = await CustomerAuthService.register(input);
  return ApiResponse.created(res, "Customer registered successfully.", result);
});

export const initiateRegister = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = customerRegisterSchema.parse(req.body);
  const result = await CustomerAuthService.initiateRegister(input);
  return ApiResponse.success(res, "OTP sent to mobile number.", result);
});

export const verifyRegisterOtp = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = verifyRegisterOtpSchema.parse(req.body);
  const result = await CustomerAuthService.verifyRegisterOtp(input);
  return ApiResponse.created(res, "Registration completed successfully.", result);
});

export const login = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = customerLoginSchema.parse(req.body);
  const result = await CustomerAuthService.login(input);
  return ApiResponse.success(res, "Login processed.", result);
});

export const sendLoginOtp = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = sendLoginOtpSchema.parse(req.body);
  const result = await CustomerAuthService.sendLoginOtp(input.phone);
  return ApiResponse.success(res, "OTP sent to your mobile number.", result);
});

export const verifyLoginOtp = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = verifyLoginOtpSchema.parse(req.body);
  const result = await CustomerAuthService.verifyLoginOtp(input);
  return ApiResponse.success(res, "Logged in successfully.", result);
});

export const resendOtp = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const input = resendOtpSchema.parse(req.body);
  const result = await CustomerAuthService.resendAuthOtp(input);
  return ApiResponse.success(res, "OTP resent successfully.", result);
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

export const getMe = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const result = await CustomerAuthService.getMe(req.customer.id);
  return ApiResponse.success(res, "Customer profile.", result);
});

export const updateProfile = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  if (!req.customer) throw new AppError("Customer authentication required.", 401);
  const input = updateCustomerProfileSchema.parse(req.body);
  const result = await CustomerAuthService.updateProfile(req.customer.id, input);
  return ApiResponse.success(res, "Profile updated successfully.", result);
});
