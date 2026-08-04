import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./media.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listMedia(req.query as never);
  return ApiResponse.paginated(res, "Media.", r.data, { page: r.page, limit: r.limit, total: r.total });
});

export const upload = asyncHandler(async (req: AuthRequest, res: Response) => {
  console.log("req.files:", req.files, "req.body:", req.body);
  return ApiResponse.created(res, "Uploaded.", await S.uploadMedia(req.files as Express.Multer.File[], req.body.folder));
});

export const removeByUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMediaByUrl(req.query.url as string);
  return ApiResponse.success(res, "Deleted.");
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMedia(String(req.params.id));
  return ApiResponse.success(res, "Deleted.");
});
