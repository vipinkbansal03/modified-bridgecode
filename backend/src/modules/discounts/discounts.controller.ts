import { Response } from "express";
import { asyncHandler, ApiResponse, AppError } from "../../utils/apiResponse";
import { AuthRequest } from "../../middleware/auth.middleware";
import { removeTempFile } from "../../utils/spreadsheet";
import { prisma } from "../../config/database";
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
  if (req.body?.action === "DELETE" || req.body?.action === "ARCHIVE") {
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id,
        action: "DISCOUNT_ARCHIVED",
        entityType: "Discount",
        metadata: { count: result.affected, ids: req.body.ids },
      },
    });
  }
  return ApiResponse.success(res, "Bulk action completed.", result);
});

export const bulkRestore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body) ? req.body : req.body?.ids;
  const result = await DiscountsService.bulkRestoreDiscounts(ids);
  if (result.restoredCount > 0) {
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id,
        action: "DISCOUNT_RESTORED",
        entityType: "Discount",
        metadata: { count: result.restoredCount, ids: result.restoredIds },
      },
    });
  }
  return ApiResponse.success(res, "Bulk restore completed.", result);
});

export const bulkPermanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const ids = Array.isArray(req.body) ? req.body : req.body?.ids;
  const result = await DiscountsService.bulkPermanentDeleteDiscounts(ids);
  if (result.deletedCount > 0) {
    await prisma.activityLog.create({
      data: {
        userId: req.user?.id,
        action: "DISCOUNT_PERMANENTLY_DELETED",
        entityType: "Discount",
        metadata: { count: result.deletedCount, ids: result.deletedIds },
      },
    });
  }
  return ApiResponse.success(res, "Bulk permanent deletion completed.", result);
});

export const exportSpreadsheet = asyncHandler(async (req: AuthRequest, res: Response) => {
  const buffer = await DiscountsService.exportDiscountsSpreadsheet(req.query as never);
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="discounts-export.xlsx"');
  return res.send(buffer);
});

export const downloadSampleTemplate = asyncHandler(async (_req: AuthRequest, res: Response) => {
  const buffer = DiscountsService.generateSampleDiscountsTemplate();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", 'attachment; filename="discounts-template.xlsx"');
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
  const rows = req.body?.rows;
  if (Array.isArray(rows) && rows.length > 0) {
    const result = await DiscountsService.importDiscountSpreadsheet(rows);
    return ApiResponse.success(res, "Discounts imported.", result);
  }

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
  const discount = await DiscountsService.archiveDiscount(req.params.id);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "DISCOUNT_ARCHIVED",
      entityType: "Discount",
      entityId: String(req.params.id),
      metadata: { name: discount.name, type: discount.type },
    },
  });
  return ApiResponse.success(res, "Discount archived successfully.", discount);
});

export const restore = asyncHandler(async (req: AuthRequest, res: Response) => {
  const discount = await DiscountsService.restoreDiscount(req.params.id);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "DISCOUNT_RESTORED",
      entityType: "Discount",
      entityId: String(req.params.id),
      metadata: { name: discount.name, type: discount.type },
    },
  });
  return ApiResponse.success(res, "Discount restored successfully.", discount);
});

export const permanentDelete = asyncHandler(async (req: AuthRequest, res: Response) => {
  const result = await DiscountsService.permanentDeleteDiscount(req.params.id);
  await prisma.activityLog.create({
    data: {
      userId: req.user?.id,
      action: "DISCOUNT_PERMANENTLY_DELETED",
      entityType: "Discount",
      entityId: String(req.params.id),
      metadata: { name: result.name },
    },
  });
  return ApiResponse.success(res, "Discount permanently deleted successfully.", result);
});
