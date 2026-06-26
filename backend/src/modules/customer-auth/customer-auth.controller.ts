import { Request, Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils/apiResponse";
import { CUSTOMER_AUTH_COOKIE } from "./customer-auth.constants";
import { CustomerAuthRequest } from "./customer-auth.middleware";
import { getCustomerMe, loginCustomer, registerCustomer } from "./customer-auth.service";
import { customerLoginSchema, registerSchema } from "./customer-auth.validation";

export const register = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);
  const customer = await registerCustomer(input);

  return ApiResponse.created(
    res,
    "Account created successfully. You can now log in.",
    customer,
  );
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = customerLoginSchema.parse(req.body);
  const result = await loginCustomer(input);

  res.cookie(CUSTOMER_AUTH_COOKIE, result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: result.maxAge,
  });

  return ApiResponse.success(res, "Logged in successfully.", result.user);
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie(CUSTOMER_AUTH_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    expires: new Date(0),
  });

  return ApiResponse.success(res, "Logged out successfully.");
});

export const me = asyncHandler(async (req: CustomerAuthRequest, res: Response) => {
  const customer = await getCustomerMe(req.customer!.id);
  return ApiResponse.success(res, "Customer profile fetched.", customer);
});
