import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import * as TiersService from "./tiers.service";

export const list = asyncHandler(async (_req, res: Response) => {
  const tiers = await TiersService.listTiers(_req.query as Record<string, string>);
  return ApiResponse.paginated(res, "Tiers fetched.", tiers.data, {
    page: tiers.page,
    limit: tiers.limit,
    total: tiers.total,
  });
});

export const dashboard = asyncHandler(async (_req, res: Response) => {
  const data = await TiersService.getTierDashboard();
  return ApiResponse.success(res, "Tier dashboard fetched.", data);
});

export const simpleList = asyncHandler(async (_req, res: Response) => {
  const tiers = await TiersService.listTiersSimple();
  return ApiResponse.success(res, "Tiers fetched.", tiers);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tier = await TiersService.createTier(req.body);
  return ApiResponse.created(res, "Tier created.", tier);
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tier = await TiersService.updateTier(String(req.params.id), req.body);
  return ApiResponse.success(res, "Tier updated.", tier);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await TiersService.archiveTier(String(req.params.id));
  return ApiResponse.success(res, "Tier archived.");
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const tier = await TiersService.restoreTier(String(req.params.id));
  return ApiResponse.success(res, "Tier restored.", tier);
});

export const permanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  await TiersService.permanentDeleteTier(String(req.params.id));
  return ApiResponse.success(res, "Tier permanently deleted.");
});

export const bulkRestore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body) ? req.body : req.body?.ids;
  const result = await TiersService.bulkUpdateTiers({ ids, action: "RESTORE" });
  return ApiResponse.success(res, "Tier bulk restore completed.", result);
});

export const bulkPermanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body) ? req.body : req.body?.ids;
  const result = await TiersService.bulkUpdateTiers({ ids, action: "PERMANENT_DELETE" });
  return ApiResponse.success(res, "Tier bulk permanent delete completed.", result);
});

export const bulk = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await TiersService.bulkUpdateTiers(req.body);
  return ApiResponse.success(res, "Tier bulk action completed.", result);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const buffer = await TiersService.exportTiersSpreadsheet(req.query as Record<string, string>);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="tiers-export.xlsx"');
  return res.send(buffer);
});

export const downloadSampleTemplate = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = TiersService.generateSampleTiersTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="tiers-template.xlsx"');
  return res.send(buffer);
});


export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const filePath = (req as AuthRequest & { file?: { path?: string } }).file?.path;
  if (!filePath) throw new AppError("File upload failed.", 400);
  const report = await TiersService.previewTierImport(filePath);
  return ApiResponse.success(res, "Tier import preview generated.", report);
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rows = req.body?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    const report = await TiersService.importTierSpreadsheet(rows);
    return ApiResponse.success(res, "Tiers imported.", report);
  }

  const filePath = (req as AuthRequest & { file?: { path?: string } }).file?.path;
  if (!filePath) throw new AppError("File upload failed.", 400);
  const report = await TiersService.importTierSpreadsheet(filePath);
  return ApiResponse.success(res, "Tiers imported.", report);
});

export const reorder = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  const tiers = await TiersService.reorderTiers(items);
  return ApiResponse.success(res, "Tiers reordered.", tiers);
});

export const listCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const countries = await TiersService.listTierCountries(String(req.params.id));
  return ApiResponse.success(res, "Tier countries fetched.", countries);
});

export const updateCountries = asyncHandler(async (req: AuthRequest, res: Response) => {
  const items = Array.isArray(req.body) ? req.body : req.body?.items;
  const countries = await TiersService.updateTierCountries(String(req.params.id), items);
  return ApiResponse.success(res, "Tier countries updated.", countries);
});
