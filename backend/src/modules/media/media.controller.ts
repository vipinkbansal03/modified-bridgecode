import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as S from "./media.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listMedia(req.query as never);
  return ApiResponse.paginated(res, "Media.", r.data, { page: r.page, limit: r.limit, total: r.total });
});

export const upload = asyncHandler(async (req: AuthRequest, res: Response) => {
  return ApiResponse.created(res, "Uploaded.", await S.uploadMedia(
    req.files as Express.Multer.File[], 
    req.body.folder,
    req.body.entityType,
    req.body.entityId,
    req.body.purpose
  ));
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.updateMedia(String(req.params.id), req.body);
  return ApiResponse.success(res, "Media updated.", result);
});

export const removeByUrl = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMediaByUrl(req.query.url as string);
  return ApiResponse.success(res, "Deleted.");
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteMedia(String(req.params.id));
  return ApiResponse.success(res, "Deleted.");
});

export const presign = asyncHandler(async (req: AuthRequest, res: Response) => {
  const data = req.body;
  if (!data.filename || !data.mimeType || !data.size) {
    return ApiResponse.error(res, "Filename, mimeType, and size are required.");
  }
  const result = await S.presignUpload(data);
  return ApiResponse.success(res, "Presigned URL generated.", result);
});

export const confirm = asyncHandler(async (req: AuthRequest, res: Response) => {
  const { mediaId } = req.body;
  if (!mediaId) return ApiResponse.error(res, "mediaId is required.");
  const media = await S.confirmUpload(mediaId);
  return ApiResponse.success(res, "Upload confirmed.", media);
});

export const config = asyncHandler(async (req: AuthRequest, res: Response) => {
  // If we have AWS credentials, we can use S3. Otherwise use LOCAL.
  const storageProvider = process.env.AWS_ACCESS_KEY_ID ? "S3" : "LOCAL";
  return ApiResponse.success(res, "Media config.", { storageProvider });
});

export const folders = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.getMediaFolders(req.query);
  return ApiResponse.success(res, "Folders.", result);
});
