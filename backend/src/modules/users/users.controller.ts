import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./users.service";
export const list = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Users.", await S.listUsers()));
export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "User created.", await S.createUser(req.body)));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateUser(String(req.params.id), req.body)));
export const remove = asyncHandler(async (req: AuthRequest, res: Response) => { await S.deleteUser(String(req.params.id)); return ApiResponse.success(res, "Deleted."); });
