import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { removeTempFile } from "../../utils/spreadsheet";
import * as S from "./currencies.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.listCurrencies(req.query as never);
  return ApiResponse.paginated(res, "Currencies fetched.", result.data, { page: result.page, limit: result.limit, total: result.total });
});

export const simpleList = asyncHandler(async (_req: AuthRequest, res: Response) => ApiResponse.success(res, "Currencies fetched.", await S.listCurrenciesSimple()));

export const dashboard = asyncHandler(async (_req: AuthRequest, res: Response) => ApiResponse.success(res, "Currency dashboard fetched.", await S.getCurrencyDashboard()));

export const create = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.created(res, "Currency created.", await S.createCurrency(req.body)));

export const update = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Currency updated.", await S.updateCurrency(String(req.params.id), req.body)));

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await S.deleteCurrency(String(req.params.id));
  return ApiResponse.success(res, "Currency deleted.");
});

export const bulk = asyncHandler(async (req: AuthRequest, res: Response) => ApiResponse.success(res, "Bulk action completed.", await S.bulkCurrencies(req.body)));

import { prisma } from "../../config/database";

export const syncRates = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await S.syncExchangeRates();
  if (req.user?.id) {
    try {
      await prisma.activityLog.create({
        data: {
          userId: req.user.id,
          action: "CURRENCY_RATES_SYNCED",
          entityType: "Currency",
          entityId: "ALL",
        },
      });
    } catch {
      // Non-blocking activity log write
    }
  }
  return ApiResponse.success(res, "Rates synced.", result);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const buffer = await S.exportCurrenciesSpreadsheet(req.query as never);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="currencies-export.xlsx"');
  return res.send(buffer);
});

export const downloadSampleTemplate = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = S.generateSampleCurrenciesTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="currencies-template.xlsx"');
  return res.send(buffer);
});


export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = (req as AuthRequest & { file?: { path?: string } }).file;
  if (!file?.path) throw new AppError("File upload failed.", 400);
  try {
    return ApiResponse.success(res, "Currency import preview generated.", await S.previewCurrencyImport(file.path));
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const rows = req.body?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    return ApiResponse.success(res, "Currencies imported.", await S.importCurrencySpreadsheet(rows));
  }

  const file = (req as AuthRequest & { file?: { path?: string } }).file;
  if (!file?.path) throw new AppError("File upload failed.", 400);
  try {
    return ApiResponse.success(res, "Currencies imported.", await S.importCurrencySpreadsheet(file.path));
  } finally {
    removeTempFile(file.path);
  }
});
