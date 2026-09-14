import { Request, Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { loginSchema } from "./auth.validation";
import { loginService, getMeService } from "./auth.service";
import { AuthRequest } from "../../middleware/auth.middleware";
import { prisma } from "../../config/database";

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const result = await loginService(input);

  // Set HTTP-only cookie as well (optional — useful for SSR)
  res.cookie("token", result.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  });

  await prisma.activityLog
    .create({
      data: {
        userId: result.user.id,
        action: "USER_LOGIN",
        entityType: "User",
        entityId: result.user.id,
        ipAddress: req.ip,
        metadata: { email: result.user.email, role: result.user.role },
      },
    })
    .catch(() => {});

  return ApiResponse.success(res, "Logged in successfully.", result);
});

export const logout = asyncHandler(async (_req: Request, res: Response) => {
  res.cookie("token", "", { httpOnly: true, expires: new Date(0) });
  return ApiResponse.success(res, "Logged out successfully.");
});

export const getMe = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await getMeService(req.user!.id);
  return ApiResponse.success(res, "User profile fetched.", user);
});
