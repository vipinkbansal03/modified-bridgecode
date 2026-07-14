import { Response } from "express";
import { asyncHandler, ApiResponse } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { removeTempFile } from "../../utils/spreadsheet";
import * as S from "./inventory.service";
export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listInventory(req.query as never);
  return ApiResponse.paginated(res, "Inventory fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});
export const dashboard = asyncHandler(async (_req: AuthRequest, res: Response) => ApiResponse.success(res, "Inventory dashboard fetched.", await S.getInventoryDashboard()));
export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Updated.", await S.updateInventory(String(req.params.id), req.body)));
export const upsert = asyncHandler(async (req: AuthRequest, res: Response) =>
  ApiResponse.success(res, "Inventory saved.", await S.upsertVariantInventory(req.body)),
);
export const alerts = asyncHandler(async (_r: AuthRequest, res: Response) => ApiResponse.success(res, "Alerts.", await S.getLowStockAlerts()));
export const listAdjustments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listInventoryAdjustments(req.query as never);
  return ApiResponse.paginated(res, "Inventory adjustments fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});
export const listVariantAdjustments = asyncHandler(async (req: AuthRequest, res: Response) => {
  const r = await S.listVariantInventoryAdjustments(String(req.params.variantId), req.query as never);
  return ApiResponse.paginated(res, "Variant inventory adjustments fetched.", r.data, { page: r.page, limit: r.limit, total: r.total });
});
export const bulkUpdate = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Inventory updated.", await S.bulkUpdateInventory(req.body)));
export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const buffer = await S.exportInventorySpreadsheet(req.query as never);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="inventory-export-${Date.now()}.xlsx"`);
  return res.status(200).send(buffer);
});
export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { totalRows: 0, validRows: 0, invalidRows: 0, issues: ["No spreadsheet file provided."] });
  try {
    return ApiResponse.success(res, "Import preview generated.", await S.previewInventoryImport(file.path));
  } finally {
    removeTempFile(file.path);
  }
});
export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = req.file as Express.Multer.File | undefined;
  if (!file) return ApiResponse.success(res, "No file uploaded.", { created: 0, updated: 0, report: { totalRows: 0, validRows: 0, invalidRows: 0, issues: ["No spreadsheet file provided."], duplicateWarnings: [], sampleRows: [] } });
  try {
    return ApiResponse.success(res, "Inventory imported successfully.", await S.importInventorySpreadsheet(file.path));
  } finally {
    removeTempFile(file.path);
  }
});
