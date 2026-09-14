import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./users.service";
import { prisma } from "../../config/database";

export const list = asyncHandler(async (_r: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Users.", await S.listUsers()),
);

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await S.createUser(req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "USER_CREATED",
      entityType: "User",
      entityId: user?.id,
      ipAddress: req.ip,
      metadata: { name: user?.name, email: user?.email },
    },
  }).catch(() => {});
  return ApiResponse.created(res, "User created.", user);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const user = await S.updateUser(String(req.params.id), req.body);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "USER_UPDATED",
      entityType: "User",
      entityId: String(req.params.id),
      ipAddress: req.ip,
      metadata: { name: user?.name, email: user?.email },
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Updated", user);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteUser(String(req.params.id));
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "USER_DELETED",
      entityType: "User",
      entityId: String(req.params.id),
      ipAddress: req.ip,
    },
  }).catch(() => {});
  return ApiResponse.success(res, "Deleted.");
});
