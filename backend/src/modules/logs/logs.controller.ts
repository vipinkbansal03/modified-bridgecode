import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as LogsService from "./logs.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await LogsService.listLogs(req.query as never);
  return ApiResponse.paginated(res, "Activity logs fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});
