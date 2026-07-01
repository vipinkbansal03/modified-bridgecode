import { Response } from "express";
import { ApiResponse, asyncHandler } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as CustomerRolesService from "./customerRoles.service";

export const list = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const roles = await CustomerRolesService.listCustomerRoles();
  return ApiResponse.success(res, "Customer roles fetched.", roles);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = await CustomerRolesService.createCustomerRole(req.body ?? {});
  return ApiResponse.created(res, "Customer role created.", role);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const role = await CustomerRolesService.updateCustomerRole(req.params.id, req.body ?? {});
  return ApiResponse.success(res, "Customer role updated.", role);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await CustomerRolesService.deleteCustomerRole(req.params.id);
  return ApiResponse.success(res, "Customer role deleted.");
});
