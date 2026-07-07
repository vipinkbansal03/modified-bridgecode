import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { removeTempFile } from "../../utils/spreadsheet";
import * as DiscountsService from "./discounts.service";

export const list = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await DiscountsService.listDiscounts(req.query as never);
  return ApiResponse.paginated(res, "Discounts fetched.", result.data, {
    page: result.page,
    limit: result.limit,
    total: result.total,
  });
});

export const dashboard = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const result = await DiscountsService.getDiscountDashboard();
  return ApiResponse.success(res, "Discount dashboard fetched.", result);
});

export const create = asyncHandler(async (req: AuthRequest, res: Response) => {
  const discount = await DiscountsService.createDiscount(req.body);
  return ApiResponse.created(res, "Discount created.", discount);
});

export const bulk = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await DiscountsService.bulkDiscounts(req.body);
  return ApiResponse.success(res, "Bulk action completed.", result);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const buffer = await DiscountsService.exportDiscountsSpreadsheet(req.query as never);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="discounts-export.xlsx"');
  return res.send(buffer);
});

export const previewImport = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = (req as AuthRequest & { file?: { path?: string } }).file;
  if (!file?.path) throw new AppError("File upload failed.", 400);
  try {
    const result = await DiscountsService.previewDiscountImport(file.path);
    return ApiResponse.success(res, "Discount import preview generated.", result);
  } finally {
    removeTempFile(file.path);
  }
});

export const importSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const file = (req as AuthRequest & { file?: { path?: string } }).file;
  if (!file?.path) throw new AppError("File upload failed.", 400);
  try {
    const result = await DiscountsService.importDiscountSpreadsheet(file.path);
    return ApiResponse.success(res, "Discounts imported.", result);
  } finally {
    removeTempFile(file.path);
  }
});

export const update = asyncHandler(async (req: AuthRequest, res: Response) => {
  const discount = await DiscountsService.updateDiscount(req.params.id, req.body);
  return ApiResponse.success(res, "Discount updated.", discount);
});

export const remove = asyncHandler(async (req: AuthRequest, res: Response) => {
  await DiscountsService.deleteDiscount(req.params.id);
  return ApiResponse.success(res, "Discount deleted.");
});
