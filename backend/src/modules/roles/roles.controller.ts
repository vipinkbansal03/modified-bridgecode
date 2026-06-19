import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./roles.service";
export const list = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Roles.", await S.listRoles()));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Role created.", await S.createRole(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateRole(req.params.id, req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteRole(req.params.id); return ApiResponse.success(res, "Deleted."); });
