import { Response } from "express"; import { asyncHandler, ApiResponse } from "../../utils/apiResponse"; import { AuthRequest } from "../../middleware/auth.middleware"; import * as S from "./payments.service";
export const listGateways = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Gateways.", await S.listGateways()));
export const upsertGateway = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Saved.", await S.upsertGateway(req.body)));
